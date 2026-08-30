/* ============================================================
 *  Liz Chat Backend — services/memoryService.js
 *  Memória de longo prazo sem inchar o prompt nem o storage:
 *   1. Ficha do usuário — texto curto (KB) sempre injetado no
 *      prompt de toda conversa.
 *   2. Resumo por conversa — quando a conversa cresce, um
 *      resumo substitui as mensagens antigas no contexto.
 *  As atualizações rodam em segundo plano (fire-and-forget),
 *  respeitando o rate limit do provedor (intervalo mínimo).
 * ============================================================ */

const Conversation = require('../models/conversation');
const Message = require('../models/message');
const UserMemory = require('../models/userMemory');
const { callAI } = require('./aiClient');

const MAX_MEMORY_LENGTH = 4000;
const MAX_SUMMARY_LENGTH = 1200;
// Resumo: só a partir de N mensagens, e só atualiza a cada M novas.
const SUMMARY_MIN_MESSAGES = 12;
const SUMMARY_REFRESH_EVERY = 8;
// Ficha: no máximo uma extração por intervalo (provedor tem rate limit).
const MEMORY_MIN_INTERVAL_MS = 10 * 60 * 1000;
const lastMemoryRunAt = new Map(); // userId -> timestamp (ok perder em restart)

/* ---------- Ficha do usuário ---------- */

async function getUserMemory(userId) {
  const mem = await UserMemory.findOne({ where: { userId } });
  return mem ? mem.content : '';
}

async function setUserMemory(userId, rawContent) {
  const content = typeof rawContent === 'string'
    ? rawContent.trim().slice(0, MAX_MEMORY_LENGTH)
    : '';
  const [mem] = await UserMemory.upsert({ userId, content });
  return { content: mem.content, updatedAt: mem.updatedAt };
}

/* ---------- Jobs em segundo plano ---------- */

/**
 * Dispara (sem bloquear a resposta) os dois jobs de memória.
 * Sem provedor de IA não há o que extrair — pula silenciosamente.
 */
function scheduleBackgroundJobs({ userId, conversationId }) {
  if (!process.env.AI_API_URL) return;
  refreshSummary(conversationId).catch((e) => {
    console.warn('[liz-memory] resumo falhou:', e.message);
  });
  maybeExtractUserMemory(userId, conversationId).catch((e) => {
    console.warn('[liz-memory] ficha falhou:', e.message);
  });
}

/**
 * (Re)gera o resumo da conversa quando ela cresce: só depois de
 * SUMMARY_MIN_MESSAGES mensagens, e só a cada SUMMARY_REFRESH_EVERY novas.
 */
async function refreshSummary(conversationId) {
  const conv = await Conversation.findByPk(conversationId);
  if (!conv) return;

  const total = await Message.count({ where: { conversationId } });
  if (total < SUMMARY_MIN_MESSAGES) return;
  if (total - (conv.summaryCount || 0) < SUMMARY_REFRESH_EVERY) return;

  const msgs = await Message.findAll({
    where: { conversationId },
    order: [['createdAt', 'ASC']],
    limit: 60,
    attributes: ['role', 'content'],
  });
  const transcript = msgs
    .map((m) => `${m.role === 'user' ? 'Usuário' : 'Liz'}: ${m.content}`)
    .join('\n')
    .slice(0, 12000);

  const summary = await callAI([
    { role: 'system', content: 'Você resume conversas de forma densa e factual, em português do Brasil.' },
    {
      role: 'user',
      content:
        'Resuma esta conversa em até 150 palavras, preservando fatos, decisões, ' +
        'preferências e pedidos em aberto. Responda apenas com o resumo.\n\n' + transcript,
    },
  ]);

  await conv.update({
    summary: summary.slice(0, MAX_SUMMARY_LENGTH),
    summaryCount: total,
  });
}

/**
 * Extrai fatos duradouros do trecho recente pra ficha do usuário.
 * Throttle: uma tentativa por usuário a cada MEMORY_MIN_INTERVAL_MS.
 */
async function maybeExtractUserMemory(userId, conversationId) {
  const last = lastMemoryRunAt.get(userId) || 0;
  if (Date.now() - last < MEMORY_MIN_INTERVAL_MS) return;
  lastMemoryRunAt.set(userId, Date.now());

  const msgs = await Message.findAll({
    where: { conversationId },
    order: [['createdAt', 'DESC']],
    limit: 10,
    attributes: ['role', 'content'],
  });
  if (msgs.length < 2) return;

  const recent = msgs
    .reverse()
    .map((m) => `${m.role === 'user' ? 'Usuário' : 'Liz'}: ${m.content}`)
    .join('\n')
    .slice(0, 6000);

  const current = await getUserMemory(userId);
  const updated = await callAI([
    {
      role: 'system',
      content:
        'Você mantém a ficha de memória de um usuário. Extraia apenas fatos DURADOUROS ' +
        '(nome, profissão, projetos, gostos, preferências, objetivos). Ignore assunto efêmero.',
    },
    {
      role: 'user',
      content:
        'Ficha atual:\n' + (current || '(vazia)') +
        '\n\nTrecho recente da conversa:\n' + recent +
        '\n\nSe o trecho revela fatos duradouros NOVOS, responda com a ficha completa ' +
        'atualizada (máx. 4000 caracteres, em tópicos curtos). Se não revela nada novo, ' +
        'responda exatamente: NO_UPDATE',
    },
  ]);

  const clean = (updated || '').trim();
  if (!clean || /NO_UPDATE/i.test(clean)) return;
  await setUserMemory(userId, clean);
}

module.exports = {
  getUserMemory,
  setUserMemory,
  scheduleBackgroundJobs,
  MAX_MEMORY_LENGTH,
};
