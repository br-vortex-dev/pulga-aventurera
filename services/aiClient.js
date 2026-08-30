/* ============================================================
 *  Liz Chat Backend — services/aiClient.js
 *  Cliente do provedor de IA (OpenAI-compatível). Extraído do
 *  chatService para ser reaproveitado pela memória em segundo
 *  plano (resumos e ficha do usuário) sem dependência circular.
 * ============================================================ */

/* ---------- Erro com status HTTP ---------- */
class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/* ---------- Tuning do provedor ----------
 * Provedor próprio com limite de mensagens por minuto (não é cota compartilhada).
 * Estratégia: timeout generoso por tentativa + retry que respeita a janela de 1 min. */
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

module.exports = { callAI, ApiError };
