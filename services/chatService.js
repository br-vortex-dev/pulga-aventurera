/* ============================================================
 *  Liz Chat Backend — services/chatService.js
 *  Lógica de enviar mensagem: valida entrada, garante a
 *  conversa, chama a IA (ou gera resposta demo quando não há
 *  provedor configurado) e persiste o histórico.
 * ============================================================ */

const Conversation = require('../models/conversation');
const Message = require('../models/message');

/* ---------- Erro com status HTTP (usado também pelas routes) ---------- */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ---------- Constantes de validação ---------- */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 8000;
const MAX_TITLE_LENGTH = 200;
const ALLOWED_MODELS = ['liz-3', 'liz-3-flash', 'nable-35', 'nable-35-mini'];
const ALLOWED_MODES = ['code', 'design', 'errors', 'ideas'];
const CONTEXT_WINDOW = 10; // últimas N mensagens enviadas à IA
// Provedor próprio com limite de mensagens por minuto (não é cota compartilhada).
// Estratégia: timeout generoso por tentativa + retry que respeita a janela de 1 min.
const AI_ATTEMPT_TIMEOUT_MS = 60000;
// 2 tentativas com espaçamento de 60s — respeita o rate limit por minuto.
const AI_MAX_ATTEMPTS = 2;
const AI_RETRY_BASE_MS = 60000;
const AI_RETRY_AFTER_CAP_MS = 90000;

/* ---------- Circuit breaker (limite de uso do provedor) ----------
 * Quando o provedor responde 429, insistir com retries só queima tempo:
 * o circuito abre e as mensagens seguintes recebem erro claro na hora,
 * sem esperar ~25s de tentativas. Ao fim do cooldown, tenta de novo. */
let circuitOpenUntil = 0;
// O limite do proxy é por minuto — circuit breaker precisa cobrir a janela
// inteira pra próxima tentativa já cair fora do rate limit.
const CIRCUIT_COOLDOWN_MS = 65000;

const SYSTEM_PROMPT =
  'Você é Liz, uma assistente de IA brasileira criada pela Liz Ai Studios. ' +
  'Responda sempre em português do Brasil, de forma direta, precisa e útil. ' +
  'Use markdown leve quando ajudar na leitura (listas, blocos de código).';

/* ---------- Utilitários ---------- */

/** Gera título automático a partir da primeira mensagem. */
function autoTitle(text) {
  let t = String(text).replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim();
  if (t.length > 48) t = t.slice(0, 48).trim() + '…';
  return t || 'Nova conversa';
}

/** Valida e normaliza o payload de envio. Toda entrada é hostil até provar o contrário. */
function validateSendInput({ conversationId, message, mode, model }) {
  if (typeof message !== 'string' || message.trim().length === 0) {
    throw new ApiError(400, 'Mensagem é obrigatória');
  }
  const cleanMessage = message.trim();
  if (cleanMessage.length > MAX_MESSAGE_LENGTH) {
    throw new ApiError(400, `Mensagem muito longa (máx. ${MAX_MESSAGE_LENGTH} caracteres)`);
  }

  if (conversationId !== null && conversationId !== undefined) {
    // Formato validado antes de tocar o banco: id malformado em coluna UUID
    // gera erro do driver (500) — rejeita aqui com 400 determinístico.
    if (typeof conversationId !== 'string' || !UUID_RE.test(conversationId)) {
      throw new ApiError(400, 'conversationId inválido');
    }
  }

  if (mode !== null && mode !== undefined) {
    if (typeof mode !== 'string' || !ALLOWED_MODES.includes(mode)) {
      throw new ApiError(400, 'Modo inválido');
    }
  }

  const cleanModel = typeof model === 'string' && ALLOWED_MODELS.includes(model)
    ? model
    : 'liz-3'; // modelo desconhecido degrada pro padrão, não falha

  return { conversationId: conversationId || null, message: cleanMessage, mode: mode || null, model: cleanModel };
}

/** Busca a conversa pelo id (validando o dono) ou cria uma nova com título automático. */
async function ensureConversation(conversationId, firstMessage, userId) {
  if (conversationId) {
    const conv = await Conversation.findOne({ where: { id: conversationId, userId } });
    if (!conv) throw new ApiError(404, 'Conversa não encontrada');
    return conv;
  }
  return Conversation.create({ title: autoTitle(firstMessage), userId });
}

/** Monta o contexto (últimas mensagens) para enviar à IA. */
async function buildContext(conversationId) {
  const recent = await Message.findAll({
    where: { conversationId },
    order: [['createdAt', 'DESC']],
    limit: CONTEXT_WINDOW,
    attributes: ['role', 'content'],
  });
  return recent.reverse().map((m) => ({ role: m.role, content: m.content }));
}

/** Erro transitório do provedor (429/5xx/rede) — candidato a retry. */
class RetryableError extends Error {
  constructor(message, { upstreamStatus = null, retryAfterMs = null, freeLimit = false } = {}) {
    super(message);
    this.upstreamStatus = upstreamStatus;
    this.retryAfterMs = retryAfterMs;
    this.freeLimit = freeLimit;
  }
}

/** Converte o header Retry-After (segundos ou data HTTP) em ms. */
function parseRetryAfter(res) {
  const raw = res.headers.get('retry-after');
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000));
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return null;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Uma tentativa de completion. Retorna o conteúdo (string, possivelmente vazia).
 * Falhas transitórias (429, 5xx, rede, timeout) viram RetryableError;
 * falhas definitivas (4xx do provedor) viram ApiError. Não vaza detalhe interno.
 */
async function requestCompletion(url, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_ATTEMPT_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.AI_API_KEY ? { Authorization: `Bearer ${process.env.AI_API_KEY}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const retryAfterMs = parseRetryAfter(res);
      if (res.status === 429) {
        // O provedor sinaliza limite de cota gratuita no corpo (FreeUsageLimitError).
        // Nesse caso retry imediato é inútil — marca freeLimit pra abrir o circuito.
        const bodyText = await res.text().catch(() => '');
        const freeLimit = /FreeUsageLimit|usage.?limit|free.?tier/i.test(bodyText);
        throw new RetryableError(
          freeLimit ? 'limite gratuito do provedor esgotado' : 'limite de requisições do provedor',
          { upstreamStatus: 429, retryAfterMs, freeLimit }
        );
      }
      if (res.status >= 500) {
        throw new RetryableError('provedor fora do ar', { upstreamStatus: res.status, retryAfterMs });
      }
      throw new ApiError(502, 'Provedor de IA recusou a requisição');
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === 'string' ? content.trim() : '';
  } catch (e) {
    if (e instanceof RetryableError || e instanceof ApiError) throw e;
    const reason = e.name === 'AbortError' ? 'tempo esgotado' : 'falha na comunicação';
    throw new RetryableError(reason);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chama um provedor OpenAI-compatível (qualquer endpoint /chat/completions).
 * Configurado via env: AI_API_URL, AI_API_KEY, AI_MODEL, AI_MAX_TOKENS.
 *
 * Duas camadas de resiliência:
 * 1. Retry com backoff para erros transitórios (429/5xx/rede) — o provedor
 *    tem rate limit agressivo, então a 2ª/3ª tentativa quase sempre resolve.
 * 2. Modelos de raciocínio podem esgotar o orçamento "pensando" e devolver
 *    conteúdo vazio — nesse caso tenta de novo com orçamento dobrado (teto 8192).
 */
async function callAI(messages, model) {
  const url = process.env.AI_API_URL;
  const base = Number(process.env.AI_MAX_TOKENS || 2048);
  const basePayload = {
    model: process.env.AI_MODEL || model,
    messages,
    stream: false,
  };

  // Circuito aberto (limite recente do provedor): falha rápido com erro claro,
  // sem queimar ~25s de tentativas que vão dar 429 de novo.
  if (Date.now() < circuitOpenUntil) {
    throw new ApiError(502, 'Provedor de IA com limite de uso ativo — espera um instante e envia de novo');
  }

  let lastError = null;

  for (let attempt = 1; attempt <= AI_MAX_ATTEMPTS; attempt++) {
    try {
      let content = await requestCompletion(url, { ...basePayload, max_tokens: base });
      if (!content) {
        content = await requestCompletion(url, { ...basePayload, max_tokens: Math.min(base * 2, 8192) });
      }
      if (!content) {
        throw new ApiError(502, 'Provedor de IA retornou resposta vazia');
      }
      circuitOpenUntil = 0; // sucesso fecha o circuito
      return content;
    } catch (e) {
      if (!(e instanceof RetryableError)) throw e;
      lastError = e;
      // Cota gratuita esgotada: retry nos próximos segundos é inútil.
      if (e.freeLimit) break;
      if (attempt === AI_MAX_ATTEMPTS) break;
      // Respeita Retry-After quando vier; senão, espera a janela de 1 min.
      const backoff = e.retryAfterMs !== null
        ? Math.min(e.retryAfterMs, AI_RETRY_AFTER_CAP_MS)
        : AI_RETRY_BASE_MS;
      await sleep(backoff);
    }
  }

  const is429 = lastError && lastError.upstreamStatus === 429;
  if (is429) circuitOpenUntil = Date.now() + CIRCUIT_COOLDOWN_MS;

  const detail = lastError && lastError.freeLimit
    ? 'limite gratuito do provedor esgotado — tente de novo em alguns minutos'
    : is429
      ? 'limite de requisições atingido — tente de novo em instantes'
      : (lastError ? lastError.message : 'falha na comunicação');
  throw new ApiError(502, `Provedor de IA indisponível (${detail})`);
}

/**
 * Resposta local usada quando AI_API_URL não está configurado.
 * Mantém o produto funcional em dev/teste — e deixa explícito no payload
 * (demo: true) que não houve chamada real de IA.
 */
function demoReply(userText, mode) {
  const t = userText.toLowerCase();

  if (mode === 'code' || /(código|codigo|função|funcao|script|react|javascript|\bjs\b|python)/.test(t)) {
    return 'Recebi seu pedido de código. Em produção, esta resposta viria do modelo de IA configurado em `AI_API_URL`.\n\nEnquanto isso, me diga: linguagem, objetivo e restrições — que eu estruturo a solução.';
  }
  if (mode === 'design' || /(design|ui|visual|cor|css|estilo|layout)/.test(t)) {
    return 'Pedido de design registrado. Com o provedor de IA configurado, eu analisaria sua descrição e devolveria uma proposta visual completa.\n\nMe conta: qual é o produto e quem vai usar?';
  }
  if (mode === 'errors' || /(erro|error|bug|falha|exception)/.test(t)) {
    return 'Erro recebido. Para análise completa, conecte um provedor de IA em `AI_API_URL` no backend.\n\nPor enquanto: cole o stack trace completo, a linguagem e o que você já tentou.';
  }
  if (mode === 'ideas' || /(ideia|ideias|brainstorm|sugest)/.test(t)) {
    return 'Boa — brainstorm é comigo mesmo. Esta é uma resposta de demonstração (backend sem provedor de IA configurado).\n\nMe dá o contexto: o que você quer resolver e pra quem?';
  }
  return 'Mensagem recebida e processada pelo backend. Esta é uma resposta de demonstração — para respostas reais de IA, configure `AI_API_URL` no arquivo `.env` do backend.\n\nO fluxo completo (salvar mensagem, gerar resposta, persistir histórico) já está funcionando.';
}

/* ---------- Operação principal ---------- */

/**
 * Envia uma mensagem do usuário e produz a resposta da assistente.
 *
 * Fluxo: valida → garante conversa → salva msg do usuário →
 *        gera resposta (IA real ou demo) → salva msg da assistente →
 *        toca updatedAt da conversa (ordenação correta no histórico).
 *
 * Retorna: { conversationId, userMessage, assistantMessage, demo }
 */
async function sendMessage(rawInput, userId) {
  const { conversationId, message, mode, model } = validateSendInput(rawInput);

  const conversation = await ensureConversation(conversationId, message, userId);

  const userMessage = await Message.create({
    conversationId: conversation.id,
    role: 'user',
    content: message,
  });

  let content;
  let demo = false;

  if (process.env.AI_API_URL) {
    const context = await buildContext(conversation.id);
    content = await callAI(
      [{ role: 'system', content: SYSTEM_PROMPT }, ...context],
      model
    );
  } else {
    content = demoReply(message, mode);
    demo = true;
  }

  const assistantMessage = await Message.create({
    conversationId: conversation.id,
    role: 'assistant',
    content,
  });

  // Atualiza updatedAt pra conversa subir no histórico.
  conversation.changed('updatedAt', true);
  await conversation.save();

  return {
    conversationId: conversation.id,
    userMessage: {
      id: userMessage.id,
      role: userMessage.role,
      content: userMessage.content,
      createdAt: userMessage.createdAt,
    },
    assistantMessage: {
      id: assistantMessage.id,
      role: assistantMessage.role,
      content: assistantMessage.content,
      createdAt: assistantMessage.createdAt,
    },
    demo,
  };
}

module.exports = {
  sendMessage,
  autoTitle,
  ApiError,
  MAX_TITLE_LENGTH,
};
