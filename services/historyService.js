/* ============================================================
 *  Liz Chat Backend — services/historyService.js
 *  Lógica de leitura do histórico: lista de conversas com
 *  paginação e mensagens de uma conversa com paginação.
 * ============================================================ */

const Conversation = require('../models/conversation');
const Message = require('../models/message');
const { ApiError } = require('./chatService');

/* ---------- Sanitização de paginação ----------
 * Cliente pode mandar qualquer lixo; clamp garante faixa segura. */

function clampPage(value) {
  const n = Math.floor(Number(value));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function clampLimit(value, fallback = 20, max = 100) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/* ---------- Serialização ---------- */

function serializeMessage(m) {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
  };
}

function serializeConversation(conv, lastMessage) {
  return {
    id: conv.id,
    title: conv.title,
    pinned: conv.pinned,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    lastMessage: lastMessage
      ? { role: lastMessage.role, content: lastMessage.content, createdAt: lastMessage.createdAt }
      : null,
  };
}

/* ---------- Operações ---------- */

/**
 * Busca uma conversa garantindo que ela pertence ao usuário.
 * Conversa de outro usuário → 404 (não vazar que existe).
 */
async function findOwnedConversation(id, userId) {
  const conv = await Conversation.findOne({ where: { id, userId } });
  if (!conv) throw new ApiError(404, 'Conversa não encontrada');
  return conv;
}

/**
 * Lista conversas paginadas DO USUÁRIO.
 * Ordenação: fixadas primeiro, depois pela mais recente atividade.
 * Inclui a última mensagem de cada conversa (preview) via include separado —
 * uma query por página, não N+1 por conversa.
 */
async function listConversations(userId, pageRaw, limitRaw) {
  const page = clampPage(pageRaw);
  const limit = clampLimit(limitRaw, 20, 100);

  const { count, rows } = await Conversation.findAndCountAll({
    where: { userId },
    order: [
      ['pinned', 'DESC'],
      ['updatedAt', 'DESC'],
    ],
    limit,
    offset: (page - 1) * limit,
    distinct: true,
    include: [{
      model: Message,
      attributes: ['id', 'role', 'content', 'createdAt'],
      separate: true,
      limit: 1,
      order: [['createdAt', 'DESC']],
      required: false,
    }],
  });

  const conversations = rows.map((conv) => {
    const last = Array.isArray(conv.Messages) ? conv.Messages[0] : null;
    return serializeConversation(conv, last);
  });

  return {
    conversations,
    total: count,
    page,
    pages: Math.max(1, Math.ceil(count / limit)),
  };
}

/**
 * Busca uma conversa pelo id, com todas as mensagens em ordem cronológica.
 * 404 quando não existe ou pertence a outro usuário.
 */
async function getConversation(id, userId) {
  await findOwnedConversation(id, userId); // garante posse antes de ler

  const conv = await Conversation.findByPk(id, {
    include: [{
      model: Message,
      order: [['createdAt', 'ASC']],
      required: false,
    }],
    order: [[Message, 'createdAt', 'ASC']],
  });

  if (!conv) throw new ApiError(404, 'Conversa não encontrada');

  return {
    id: conv.id,
    title: conv.title,
    pinned: conv.pinned,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
    messages: (conv.Messages || []).map(serializeMessage),
  };
}

/**
 * Mensagens de uma conversa com paginação (histórico longo).
 */
async function getMessages(conversationId, userId, pageRaw, limitRaw) {
  await findOwnedConversation(conversationId, userId);

  const page = clampPage(pageRaw);
  const limit = clampLimit(limitRaw, 50, 100);

  const { count, rows } = await Message.findAndCountAll({
    where: { conversationId },
    order: [['createdAt', 'ASC']],
    limit,
    offset: (page - 1) * limit,
  });

  return {
    messages: rows.map(serializeMessage),
    total: count,
    page,
    pages: Math.max(1, Math.ceil(count / limit)),
  };
}

module.exports = {
  listConversations,
  getConversation,
  getMessages,
  findOwnedConversation,
};
