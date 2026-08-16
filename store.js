/* ============================================================
 *  Liz Chat Backend — store.js
 *  Persistência de conversas em arquivo JSON com escrita
 *  atômica (escreve em .tmp e faz rename — nunca corrompe).
 * ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

// Dados do usuário vivem no perfil do SO — não dentro do projeto.
// Isso evita servir conversas pelo servidor estático e impede que o
// watcher de dev recarregue a página a cada mensagem salva.
function resolveDataDir() {
  if (process.env.LIZ_DATA_DIR) return process.env.LIZ_DATA_DIR;
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'liz-chat');
  }
  return path.join(os.homedir(), '.liz-chat');
}

const DATA_DIR = resolveDataDir();
const DATA_FILE = path.join(DATA_DIR, 'conversations.json');
const TMP_FILE = DATA_FILE + '.tmp';

const LIMITS = {
  TITLE_MAX: 120,
  MESSAGE_MAX: 20000,
  MESSAGES_PER_CONVERSATION: 2000,
};

let conversations = [];
let loaded = false;

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function load() {
  if (loaded) return;
  loaded = true;
  ensureDir();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      conversations = parsed.filter(isValidConversation);
    }
  } catch (e) {
    if (e.code !== 'ENOENT') {
      console.error('[store] Falha ao carregar dados, iniciando vazio:', e.message);
    }
    conversations = [];
  }
}

function persist() {
  ensureDir();
  const payload = JSON.stringify(conversations, null, 2);
  fs.writeFileSync(TMP_FILE, payload, 'utf8');
  fs.renameSync(TMP_FILE, DATA_FILE);
}

function isValidConversation(conv) {
  return conv && typeof conv.id === 'string' && typeof conv.title === 'string' && Array.isArray(conv.messages);
}

function sanitizeText(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > max) return null;
  return trimmed;
}

function genId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + crypto.randomBytes(6).toString('hex');
}

/* ---------- API pública ---------- */

function listConversations(page, limit) {
  load();
  const sorted = [...conversations].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  // Fixadas primeiro
  sorted.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
  const start = (page - 1) * limit;
  const items = sorted.slice(start, start + limit).map((c) => ({
    id: c.id,
    title: c.title,
    pinned: !!c.pinned,
    messageCount: c.messages.length,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
  return { items, page, limit, total: conversations.length };
}

function getConversation(id) {
  load();
  return conversations.find((c) => c.id === id) || null;
}

function createConversation(title) {
  load();
  const cleanTitle = sanitizeText(title, LIMITS.TITLE_MAX) || 'Nova conversa';
  const now = Date.now();
  const conv = {
    id: genId('conv'),
    title: cleanTitle,
    pinned: false,
    messages: [],
    createdAt: now,
    updatedAt: now,
  };
  conversations.unshift(conv);
  persist();
  return conv;
}

function renameConversation(id, title) {
  load();
  const conv = conversations.find((c) => c.id === id);
  if (!conv) return null;
  const cleanTitle = sanitizeText(title, LIMITS.TITLE_MAX);
  if (!cleanTitle) return null;
  conv.title = cleanTitle;
  conv.updatedAt = Date.now();
  persist();
  return conv;
}

function deleteConversation(id) {
  load();
  const before = conversations.length;
  conversations = conversations.filter((c) => c.id !== id);
  if (conversations.length === before) return false;
  persist();
  return true;
}

function setPinned(id, pinned) {
  load();
  const conv = conversations.find((c) => c.id === id);
  if (!conv) return null;
  conv.pinned = !!pinned;
  conv.updatedAt = Date.now();
  persist();
  return conv;
}

function addMessage(conversationId, role, content) {
  load();
  const conv = conversations.find((c) => c.id === conversationId);
  if (!conv) return null;
  const cleanContent = sanitizeText(content, LIMITS.MESSAGE_MAX);
  if (!cleanContent) return null;
  if (role !== 'user' && role !== 'assistant') return null;

  const msg = {
    id: genId('msg'),
    role,
    content: cleanContent,
    createdAt: new Date().toISOString(),
  };

  conv.messages.push(msg);
  // Proteção contra crescimento descontrolado
  if (conv.messages.length > LIMITS.MESSAGES_PER_CONVERSATION) {
    conv.messages = conv.messages.slice(-LIMITS.MESSAGES_PER_CONVERSATION);
  }
  // Primeira mensagem do usuário vira título automático se a conversa ainda tem o padrão
  if (conv.title === 'Nova conversa' && role === 'user') {
    conv.title = cleanContent.slice(0, 48);
  }
  conv.updatedAt = Date.now();
  persist();
  return msg;
}

module.exports = {
  LIMITS,
  dataDir: () => DATA_DIR,
  listConversations,
  getConversation,
  createConversation,
  renameConversation,
  deleteConversation,
  setPinned,
  addMessage,
};
