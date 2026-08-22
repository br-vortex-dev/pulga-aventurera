/* ============================================================
 *  Liz Chat Backend — services/chatService.js
 *  Lógica de enviar mensagem: valida entrada, garante a
 *  conversa, chama a IA (ou gera resposta demo quando não há
 *  provedor configurado) e persiste o histórico.
 * ============================================================ */

const { Op } = require('sequelize');
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const { callAI, ApiError } = require('./aiClient');
const memoryService = require('./memoryService');
const imageService = require('./imageService');
const webSearchService = require('./webSearchService');

/* ---------- Constantes de validação ---------- */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_LENGTH = 8000;
const MAX_TITLE_LENGTH = 200;
const ALLOWED_MODELS = ['liz-3', 'liz-3-flash', 'nable-35', 'nable-35-mini'];
const ALLOWED_MODES = ['code', 'design', 'errors', 'ideas'];
const CONTEXT_WINDOW = 10; // últimas N mensagens enviadas à IA

const SYSTEM_PROMPT =
  'Você é Liz, uma assistente de IA brasileira criada pela Liz Ai Studios. ' +
  'Responda sempre em português do Brasil, de forma direta, precisa e útil. ' +
  'Use markdown leve quando ajudar na leitura (listas, blocos de código). ' +
  'Quando receber imagens reais no campo de imagens, descreva a origem sem inventar links. ' +
  'Não invente URLs de imagens: só use imagens quando elas forem fornecidas pelo sistema.';

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

/**
 * Sanitiza os metadados do arquivo anexado à mensagem.
 * Só a referência (uploadId) e os dados de exibição — o conteúdo
 * em si mora no storage privado (B2), nunca no banco.
 */
function sanitizeFile(file) {
  if (file === null || file === undefined) return null;
  if (typeof file !== 'object' || Array.isArray(file)) {
    throw new ApiError(400, 'file inválido');
  }
  if (typeof file.uploadId !== 'string' || !UUID_RE.test(file.uploadId)) {
    throw new ApiError(400, 'file.uploadId inválido');
  }
  return {
    uploadId: file.uploadId,
    name: typeof file.name === 'string' ? file.name.slice(0, 200) : '',
    type: typeof file.type === 'string' ? file.type.slice(0, 100) : '',
    size: Number.isFinite(Number(file.size)) ? Math.min(Number(file.size), 100 * 1024 * 1024) : 0,
  };
}

/**
 * Persiste uma mensagem isolada numa conversa existente — ex.: o anexo
 * de arquivo (que não passa pelo /chat/send). role aceita 'user' ou
 * 'assistant' (respostas locais do app); qualquer outra vira 'user'.
 */
async function addMessage(conversationId, rawInput, userId) {
  if (typeof conversationId !== 'string' || !UUID_RE.test(conversationId)) {
    throw new ApiError(400, 'conversationId inválido');
  }
  const { content, role, file, demo } = rawInput || {};
  const cleanRole = role === 'assistant' ? 'assistant' : 'user';
  const cleanContent = typeof content === 'string'
    ? content.trim().slice(0, MAX_MESSAGE_LENGTH)
    : '';
  const cleanFile = sanitizeFile(file);
  if (!cleanContent && !cleanFile) {
    throw new ApiError(400, 'Mensagem vazia');
  }

  const conversation = await Conversation.findOne({ where: { id: conversationId, userId } });
  if (!conversation) throw new ApiError(404, 'Conversa não encontrada');

  const message = await Message.create({
    conversationId: conversation.id,
    role: cleanRole,
    content: cleanContent,
    demo: demo === true,
    file: cleanFile,
  });

  // Toca updatedAt pra conversa subir no histórico.
  conversation.changed('updatedAt', true);
  await conversation.save();

  return {
      id: message.id,
      role: message.role,
      content: message.content,
      demo: message.demo === true,
      file: message.file || undefined,
    createdAt: message.createdAt,
  };
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
 * Monta o prompt completo: persona + ficha do usuário + resumo da
 * conversa atual (quando existe) + resumo de conversas recentes
 * (no primeiro giro) + últimas mensagens. É assim que a IA
 * "lembra" do usuário e do passado sem reenviar o histórico inteiro.
 */
async function buildPromptMessages(userId, conversation, context) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  const memory = await memoryService.getUserMemory(userId);
  if (memory) {
    messages.push({
      role: 'system',
      content:
        'O que você sabe sobre este usuário (ficha de memória — use naturalmente, sem citar a fonte):\n' + memory,
    });
  }

  if (conversation.summary) {
    messages.push({
      role: 'system',
      content: 'Resumo do início desta conversa (mensagens mais antigas):\n' + conversation.summary,
    });
  } else if (context.length <= 2) {
    // Conversa começando agora e sem resumo próprio → traz resumos das
    // conversas recentes do usuário pra IA lembrar do que já foi falado.
    const others = await Conversation.findAll({
      where: {
        userId,
        id: { [Op.ne]: conversation.id },
        summary: { [Op.ne]: null },
      },
      order: [['updatedAt', 'DESC']],
      limit: 3,
      attributes: ['title', 'summary'],
    });
    if (others.length) {
      messages.push({
        role: 'system',
        content: 'Resumos de conversas recentes deste usuário:\n' +
          others.map((c) => `- "${c.title}": ${c.summary}`).join('\n'),
      });
    }
  }

  messages.push(...context);
  return messages;
}

/**
 * Envia uma mensagem do usuário e produz a resposta da assistente.
 *
 * Fluxo: valida → garante conversa → salva msg do usuário →
 *        gera resposta (IA real ou demo) → salva msg da assistente →
 *        toca updatedAt da conversa (ordenação correta no histórico).
 * Depois dispara (sem bloquear) os jobs de memória: resumo da
 * conversa e atualização da ficha do usuário.
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
    demo: false,
  });

  let content;
  let demo = false;
  let images = [];
  let webResults = [];
  const imageIntent = imageService.isImageRequest(message);
  const webIntent = webSearchService.isWebRequest(message);

  if (imageIntent?.kind === 'search' || webIntent) {
    const [foundImages, foundWeb] = await Promise.all([
      imageIntent?.kind === 'search' ? imageService.searchOpenverse(imageIntent.query) : Promise.resolve([]),
      webIntent ? webSearchService.searchWeb(webIntent.query) : Promise.resolve([]),
    ]);
    images = foundImages;
    webResults = foundWeb;
    const pieces = [];
    if (webResults.length) pieces.push(`Consultei a internet e encontrei ${webResults.length} resultado(s).`);
    if (images.length) pieces.push(`Também encontrei ${images.length} imagem(ns) com licença aberta.`);
    content = pieces.length
      ? pieces.join(' ') + ' Confira os links e as fontes abaixo.'
      : 'Não encontrei resultados para essa busca. Tente usar outras palavras ou uma descrição mais específica.';
  } else if (imageIntent?.kind === 'generate') {
    images = await imageService.generateImage(imageIntent.prompt, userId);
    content = 'Criei esta imagem para você. Se quiser, posso tentar outra versão com mudanças no estilo, nas cores ou no enquadramento.';
  } else if (process.env.AI_API_URL) {
    const context = await buildContext(conversation.id);
    content = await callAI(
      await buildPromptMessages(userId, conversation, context),
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
    demo,
    images,
    webResults,
  });

  // Atualiza updatedAt pra conversa subir no histórico.
  conversation.changed('updatedAt', true);
  await conversation.save();

  // Memória em segundo plano (nunca atrasa a resposta do usuário).
  memoryService.scheduleBackgroundJobs({ userId, conversationId: conversation.id });

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
      demo: assistantMessage.demo === true,
      images: assistantMessage.images || [],
      webResults: assistantMessage.webResults || [],
      createdAt: assistantMessage.createdAt,
    },
    demo,
  };
}

module.exports = {
  sendMessage,
  addMessage,
  autoTitle,
  ApiError,
  MAX_TITLE_LENGTH,
};
