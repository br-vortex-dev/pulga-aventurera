/* ============================================================
 *  Liz Chat Backend — server.js
 *  Ponto de entrada: sobe o Express, aplica middlewares de
 *  segurança, registra as rotas e conecta ao banco.
 * ============================================================ */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const sequelize = require('./config/database');
const Conversation = require('./models/conversation');
const Message = require('./models/message');
const chatRoutes = require('./routes/chatRoutes');
const { ApiError } = require('./services/chatService');

/* ---------- Associações ---------- */
Conversation.hasMany(Message, {
  foreignKey: 'conversationId',
  onDelete: 'CASCADE',
  hooks: true,
});
Message.belongsTo(Conversation, { foreignKey: 'conversationId' });

/* ---------- CORS ----------
 * Produção: defina CORS_ORIGIN com as origens exatas (csv).
 * Dev sem CORS_ORIGIN: libera localhost em qualquer porta e
 * origem 'null' (página aberta direto por file://).
 * Origem não permitida NÃO gera erro — apenas responde sem os
 * headers CORS (o navegador bloqueia a leitura; erro viraria 500
 * e qualquer um poderia derrubar o serviço com um Origin falso). */
function buildCorsOptions() {
  const raw = process.env.CORS_ORIGIN;
  if (raw) {
    const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
    return {
      origin(origin, cb) {
        // Requisições sem Origin (curl, apps nativos) passam.
        if (!origin || allowed.includes(origin)) return cb(null, true);
        return cb(null, false);
      },
    };
  }
  return {
    origin(origin, cb) {
      const devOrigin = !origin ||
        origin === 'null' ||
        /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (devOrigin) return cb(null, true);
      return cb(null, false);
    },
  };
}

/* ---------- App ---------- */
const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Helmet com CSP ajustada: a interface carrega o SDK do Firebase (gstatic),
// chama as APIs do Google (googleapis/firebaseapp) e usa Google Fonts.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'script-src': ["'self'", "'unsafe-inline'", 'https://www.gstatic.com', 'https://apis.google.com'],
      'connect-src': ["'self'", 'https://*.googleapis.com', 'https://*.gstatic.com', 'https://*.firebaseapp.com', 'https://*.firebaseio.com'],
      'frame-src': ["'self'", 'https://*.firebaseapp.com', 'https://accounts.google.com', 'https://*.google.com'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'img-src': ["'self'", 'data:', 'https:'],
    },
  },
}));
app.use(cors(buildCorsOptions()));
app.use(express.json({ limit: '1mb' }));

// Rate limit global — protege de abuso sem atrapalhar uso normal.
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Muitas requisições. Tente novamente em instantes.' },
}));

// Rate limit mais rígido no endpoint que chama a IA (custo real).
app.use('/api/chat', rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Limite de mensagens por minuto atingido.' },
}));

// O backend é SOMENTE API — o frontend é servido separado
// (node frontend/scripts/serve.js → http://localhost:8321).

app.use('/api', chatRoutes);

// 404 padronizado
app.use((req, res) => {
  res.status(404).json({ message: 'Rota não encontrada' });
});

// Handler central de erros — nunca vaza detalhe interno.
// ApiError carrega mensagem escrita pra ser segura pro cliente (inclusive 5xx);
// erros inesperados 5xx ficam com mensagem genérica.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status && Number.isInteger(err.status) ? err.status : 500;
  const isApiError = err instanceof ApiError;
  const message = isApiError ? err.message : (status < 500 ? err.message : 'Erro interno do servidor');
  if (status >= 500) {
    // Log server-side sim, resposta limpa pro cliente.
    console.error('[liz-backend] erro não tratado:', err);
  }
  res.status(status).json({ message });
});

/* ---------- Migração leve ----------
 * O Neon já tem a tabela 'conversations' criada antes do userId;
 * sequelize.sync() não altera tabelas existentes, então garantimos
 * a coluna aqui (idempotente — roda em todo boot sem efeito colateral). */
async function ensureSchema() {
  const dialect = sequelize.getDialect();
  if (dialect === 'postgres') {
    await sequelize.query('ALTER TABLE conversations ADD COLUMN IF NOT EXISTS "userId" VARCHAR(64);');
    await sequelize.query('CREATE INDEX IF NOT EXISTS conversations_user_id ON conversations ("userId");');
  } else if (dialect === 'sqlite') {
    // SQLite não tem IF NOT EXISTS pra ADD COLUMN — "duplicada" é o caso normal.
    try {
      await sequelize.query('ALTER TABLE conversations ADD COLUMN userId VARCHAR(64);');
    } catch (err) {
      if (!/duplicate column/i.test(err.message)) throw err;
    }
    await sequelize.query('CREATE INDEX IF NOT EXISTS conversations_user_id ON conversations (userId);');
  }
}

/* ---------- Boot ---------- */
async function start() {
  const port = Number(process.env.PORT || 3000);

  await sequelize.authenticate();
  await sequelize.sync();
  await ensureSchema();

  const server = app.listen(port, () => {
    const dialect = sequelize.getDialect();
    console.log(`[liz-backend] ouvindo em http://localhost:${port} (db: ${dialect})`);
  });

  // Encerramento gracioso
  const shutdown = async (signal) => {
    console.log(`[liz-backend] ${signal} recebido, encerrando...`);
    server.close(async () => {
      try { await sequelize.close(); } catch (e) { /* já fechado */ }
      process.exit(0);
    });
    // Se algo travar o close, força a saída.
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

if (require.main === module) {
  start().catch((err) => {
    console.error('[liz-backend] falha ao iniciar:', err.message);
    process.exit(1);
  });
}

module.exports = { app, start };
