/* ============================================================
 *  Liz Chat Backend — routes/chatRoutes.js
 *  Endpoints HTTP da API. Camada fina: valida formato, delega
 *  pros services e serializa a resposta. Nada de regra de
 *  negócio aqui.
 *
 *  GET    /api/health
 *  GET    /api/firebase-config
 *  GET    /api/conversations          (auth)
 *  POST   /api/conversations          (auth)
 *  GET    /api/conversations/:id      (auth)
 *  PUT    /api/conversations/:id      (auth)
 *  DELETE /api/conversations/:id      (auth)
 *  PUT    /api/conversations/:id/pin  (auth)
 *  GET    /api/conversations/:id/messages (auth)
 *  POST   /api/chat/send              (auth)
 * ============================================================ */

const express = require('express');
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const chatService = require('../services/chatService');
const historyService = require('../services/historyService');
const firebase = require('../config/firebase');

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

/* ---------- Firebase (config pública do cliente) ----------
 * O config web do Firebase é público por design (a segurança vem das
 * Security Rules). As chaves moram no .env do backend e são servidas
 * aqui pra tela de login inicializar o SDK. */

router.get('/firebase-config', (req, res) => {
  const cfg = {
    apiKey: process.env.FIREBASE_API_KEY || '',
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.FIREBASE_APP_ID || '',
    googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  };
  if (!cfg.apiKey || !cfg.projectId) {
    throw new ApiError(503, 'Firebase não configurado — preencha as variáveis FIREBASE_* no backend/.env');
  }
  res.json(cfg);
});

/* ---------- Autenticação ----------
 * Toda rota de dados exige um ID token válido do Firebase Auth
 * (header "Authorization: Bearer <token>").
 * Sem credencial de Service Account fora de produção, degrada
 * para um usuário local — dev/testes continuam funcionando sem
 * configurar nada. Em produção (Render) exige sempre. */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

async function requireAuth(req, res, next) {
  if (!firebase.isConfigured()) {
    if (IS_PRODUCTION) {
      return next(new ApiError(503, 'Autenticação indisponível no servidor'));
    }
    req.user = { uid: 'dev-local' }; // dev/testes sem Service Account
    return next();
  }

  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return next(new ApiError(401, 'Faça login para continuar'));

  try {
    const decoded = await firebase.verifyIdToken(match[1]);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || null,
      name: decoded.name || null,
    };
    return next();
  } catch (err) {
    return next(new ApiError(401, 'Sessão inválida ou expirada — faça login novamente'));
  }
}

/* ---------- Conversas (autenticadas) ---------- */

router.use('/conversations', requireAuth);
router.use('/chat', requireAuth);

router.get('/conversations', asyncHandler(async (req, res) => {
  const result = await historyService.listConversations(req.user.uid, req.query.page, req.query.limit);
  res.json(result);
}));

router.post('/conversations', asyncHandler(async (req, res) => {
  const title = parseTitle(req.body);
  const conv = await Conversation.create({ title, userId: req.user.uid });
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
  const conv = await historyService.getConversation(req.params.id, req.user.uid);
  res.json(conv);
}));

router.put('/conversations/:id', asyncHandler(async (req, res) => {
  requireUuid(req.params.id);
  const title = parseTitle(req.body);

  const conv = await historyService.findOwnedConversation(req.params.id, req.user.uid);

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

  const conv = await historyService.findOwnedConversation(req.params.id, req.user.uid);

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

  const conv = await historyService.findOwnedConversation(req.params.id, req.user.uid);

  conv.pinned = pinned;
  await conv.save();

  res.json({ id: conv.id, pinned: conv.pinned });
}));

/* ---------- Mensagens ---------- */

router.get('/conversations/:id/messages', asyncHandler(async (req, res) => {
  requireUuid(req.params.id);
  const result = await historyService.getMessages(req.params.id, req.user.uid, req.query.page, req.query.limit);
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
  }, req.user.uid);
  res.json(result);
}));

module.exports = router;
