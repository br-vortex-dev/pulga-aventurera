/* ============================================================
 *  Liz Chat Backend — routes/chatRoutes.js
 *  Endpoints HTTP da API. Camada fina: valida formato, delega
 *  pros services e serializa a resposta. Nada de regra de
 *  negócio aqui.
 *
 *  GET    /api/health
 *  GET    /api/firebase-config
 *  POST   /api/auth/signup
 *  POST   /api/chat/upload           (auth)
 *  GET    /api/uploads               (auth)
 *  GET    /api/uploads/:id           (auth)
 *  DELETE /api/uploads/:id           (auth)
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
const rateLimit = require('express-rate-limit');
const multer = require('multer');
const crypto = require('node:crypto');
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const Attachment = require('../models/attachment');
const chatService = require('../services/chatService');
const historyService = require('../services/historyService');
const storage = require('../config/storage');
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
    // App Check (opcional): chave pública do reCAPTCHA v3. Quando presente,
    // o frontend ativa o App Check e o Firebase passa a exigir token válido,
    // bloqueando scripts que chamem as APIs fora do site oficial.
    recaptchaSiteKey: process.env.FIREBASE_RECAPTCHA_SITE_KEY || '',
  };
  if (!cfg.apiKey || !cfg.projectId) {
    throw new ApiError(503, 'Firebase não configurado — preencha as variáveis FIREBASE_* no backend/.env');
  }
  res.json(cfg);
});

/* ---------- Cadastro (política de senha no servidor) ----------
 * O cadastro com e-mail/senha passa pelo Admin SDK pra que a política
 * de senha (mínimo 8 caracteres + número ou símbolo) seja imposta no
 * SERVIDOR — o JavaScript do navegador valida primeiro (UX), mas um
 * atacante que chamasse o Firebase direto ainda cairia nestas regras.
 * Rate limit rígido: criar conta é operação sensível e cara. */

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MAX_NAME_LENGTH = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const signupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Muitas tentativas de cadastro. Tente novamente mais tarde.' },
});

router.post('/auth/signup', signupLimiter, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!name) throw new ApiError(400, 'Nome é obrigatório');
  if (name.length > MAX_NAME_LENGTH) {
    throw new ApiError(400, `Nome muito longo (máx. ${MAX_NAME_LENGTH} caracteres)`);
  }
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    throw new ApiError(400, 'E-mail inválido');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ApiError(400, `A senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`);
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    throw new ApiError(400, `A senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres`);
  }
  if (!/[\d\W_]/.test(password)) {
    throw new ApiError(400, 'A senha deve conter ao menos 1 número ou símbolo');
  }

  // Sem Admin SDK não há como criar a conta com validação no servidor.
  if (!firebase.isConfigured()) {
    throw new ApiError(503, 'Cadastro indisponível no servidor');
  }

  let uid;
  try {
    uid = await firebase.createAuthUser({ email, password, displayName: name });
  } catch (err) {
    if (err.code === 'auth/email-already-exists') {
      throw new ApiError(409, 'Este e-mail já está cadastrado');
    }
    if (err.code === 'auth/invalid-email') throw new ApiError(400, 'E-mail inválido');
    console.error('[liz-backend] falha ao criar usuário:', err);
    throw new ApiError(502, 'Não foi possível criar a conta. Tente novamente');
  }

  res.status(201).json({ ok: true, uid });
}));

/* ---------- Uploads (arquivos privados por usuário) ----------
 * O conteúdo vai pro storage (B2 em produção, disco local em dev)
 * com a chave "<uid>/<uuid>"; o metadado vira uma linha em
 * attachments. Download só pro dono — o bucket nunca é público. */

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // mesmo limite do frontend
const uploadParser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

router.post('/chat/upload', requireAuth, (req, res, next) => {
  uploadParser.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return next(new ApiError(400, 'Arquivo muito grande (máx. 10 MB)'));
    }
    return next(new ApiError(400, 'Upload inválido'));
  });
}, asyncHandler(async (req, res) => {
  if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
    throw new ApiError(400, 'Nenhum arquivo enviado');
  }

  const name = String(req.file.originalname || 'arquivo')
    .replace(/[\u0000-\u001f<>:"\\|?*]/g, '_')
    .slice(0, 200) || 'arquivo';
  const contentType = req.file.mimetype || 'application/octet-stream';
  const key = `${req.user.uid}/${crypto.randomUUID()}`;

  await storage.put(key, req.file.buffer, contentType);

  let attachment;
  try {
    attachment = await Attachment.create({
      userId: req.user.uid,
      storageKey: key,
      name,
      contentType,
      size: req.file.buffer.length,
    });
  } catch (err) {
    // Não deixa órfão no storage se o banco falhar.
    await storage.del(key);
    throw err;
  }

  res.status(201).json({
    id: attachment.id,
    name,
    size: attachment.size,
    contentType,
    url: `/api/uploads/${attachment.id}`,
  });
}));

router.get('/uploads', requireAuth, asyncHandler(async (req, res) => {
  const rows = await Attachment.findAll({
    where: { userId: req.user.uid },
    order: [['createdAt', 'DESC']],
    limit: 200,
  });
  res.json({
    uploads: rows.map((a) => ({
      id: a.id,
      name: a.name,
      size: a.size,
      contentType: a.contentType,
      url: `/api/uploads/${a.id}`,
      createdAt: a.createdAt,
    })),
  });
}));

async function findOwnAttachment(id, uid) {
  requireUuid(id);
  const attachment = await Attachment.findByPk(id);
  // 404 (não 403) pra não revelar existência de arquivo alheio.
  if (!attachment || attachment.userId !== uid) {
    throw new ApiError(404, 'Arquivo não encontrado');
  }
  return attachment;
}

router.get('/uploads/:id', requireAuth, asyncHandler(async (req, res) => {
  const attachment = await findOwnAttachment(req.params.id, req.user.uid);
  let body;
  try {
    body = await storage.get(attachment.storageKey);
  } catch (e) {
    throw new ApiError(404, 'Arquivo não encontrado');
  }
  res.set('Content-Type', attachment.contentType);
  res.set('Content-Disposition', `inline; filename="${attachment.name.replace(/"/g, '')}"`);
  res.set('Cache-Control', 'private, max-age=31536000, immutable');
  res.send(body);
}));

router.delete('/uploads/:id', requireAuth, asyncHandler(async (req, res) => {
  const attachment = await findOwnAttachment(req.params.id, req.user.uid);
  await storage.del(attachment.storageKey);
  await attachment.destroy();
  res.json({ ok: true });
}));

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
