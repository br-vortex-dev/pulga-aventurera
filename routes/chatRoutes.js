/* ============================================================
 *  Liz Chat Backend — routes/chatRoutes.js
 *  Endpoints HTTP da API. Camada fina: valida formato, delega
 *  pros services e serializa a resposta. Nada de regra de
 *  negócio aqui.
 *
 *  GET    /api/health
 *  GET    /api/conversations
 *  POST   /api/conversations
 *  GET    /api/conversations/:id
 *  PUT    /api/conversations/:id
 *  DELETE /api/conversations/:id
 *  PUT    /api/conversations/:id/pin
 *  GET    /api/conversations/:id/messages
 *  POST   /api/chat/send
 * ============================================================ */

const express = require('express');
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const chatService = require('../services/chatService');
const historyService = require('../services/historyService');

const { ApiError, MAX_TITLE_LENGTH } = chatService;

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Envolve handlers async pra qualquer reject cair no error handler central. */
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

function requireUuid(value) {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new ApiError(400, 'ID inválido');
  }
}

function parseTitle(body) {
  const title = typeof body?.title === 'string' ? body.title.trim() : '';
  if (!title) throw new ApiError(400, 'Título é obrigatório');
  if (title.length > MAX_TITLE_LENGTH) {
    throw new ApiError(400, `Título muito longo (máx. ${MAX_TITLE_LENGTH} caracteres)`);
  }
  return title;
}

/* ---------- Health ---------- */

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'liz-chat-backend',
    uptime: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/* ---------- Conversas ---------- */

router.get('/conversations', asyncHandler(async (req, res) => {
  const result = await historyService.listConversations(req.query.page, req.query.limit);
  res.json(result);
}));

router.post('/conversations', asyncHandler(async (req, res) => {
  const title = parseTitle(req.body);
  const conv = await Conversation.create({ title });
  res.status(201).json({
    id: conv.id,
    title: conv.title,
    pinned: conv.pinned,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  });
}));

router.get('/conversations/:id', asyncHandler(async (req, res) => {
  requireUuid(req.params.id);
  const conv = await historyService.getConversation(req.params.id);
  res.json(conv);
}));

router.put('/conversations/:id', asyncHandler(async (req, res) => {
  requireUuid(req.params.id);
  const title = parseTitle(req.body);

  const conv = await Conversation.findByPk(req.params.id);
  if (!conv) throw new ApiError(404, 'Conversa não encontrada');

  conv.title = title;
  await conv.save();

  res.json({
    id: conv.id,
    title: conv.title,
    pinned: conv.pinned,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  });
}));

router.delete('/conversations/:id', asyncHandler(async (req, res) => {
  requireUuid(req.params.id);

  const conv = await Conversation.findByPk(req.params.id);
  if (!conv) throw new ApiError(404, 'Conversa não encontrada');

  // Deleta mensagens primeiro — determinístico em qualquer dialeto.
  await Message.destroy({ where: { conversationId: conv.id } });
  await conv.destroy();

  res.json({ ok: true });
}));

router.put('/conversations/:id/pin', asyncHandler(async (req, res) => {
  requireUuid(req.params.id);

  const pinned = req.body?.pinned;
  if (typeof pinned !== 'boolean') {
    throw new ApiError(400, 'pinned deve ser booleano');
  }

  const conv = await Conversation.findByPk(req.params.id);
  if (!conv) throw new ApiError(404, 'Conversa não encontrada');

  conv.pinned = pinned;
  await conv.save();

  res.json({ id: conv.id, pinned: conv.pinned });
}));

/* ---------- Mensagens ---------- */

router.get('/conversations/:id/messages', asyncHandler(async (req, res) => {
  requireUuid(req.params.id);
  const result = await historyService.getMessages(req.params.id, req.query.page, req.query.limit);
  res.json(result);
}));

/* ---------- Chat ---------- */

router.post('/chat/send', asyncHandler(async (req, res) => {
  const body = req.body || {};
  const result = await chatService.sendMessage({
    conversationId: body.conversationId ?? null,
    message: body.message,
    mode: body.mode ?? null,
    model: body.model ?? 'liz-3',
  });
  res.json(result);
}));

module.exports = router;
