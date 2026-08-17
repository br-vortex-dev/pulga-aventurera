/* ============================================================
 *  Liz — backend/tests/backend-api.test.js
 *  Teste de integração REAL: sobe o backend/server.js num processo
 *  filho (SQLite em memória, porta isolada) e exercita os
 *  endpoints via HTTP — caminho feliz, bordas e erros.
 *  Rodar com: node backend/tests/backend-api.test.js
 *  (ou, dentro de backend/: npm test)
 * ============================================================ */

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 3211;
const BASE = `http://localhost:${PORT}/api`;

let child;
let createdConvId;
let sendConvId;

async function waitForServer(timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch (e) { /* ainda subindo */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Servidor de teste não subiu no tempo esperado');
}

async function api(method, url, body) {
  const res = await fetch(BASE + url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* corpo vazio */ }
  return { status: res.status, data };
}

before(async () => {
  child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_DIALECT: 'sqlite',
      DB_STORAGE: ':memory:',
      AI_API_URL: '',
      CORS_ORIGIN: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => process.stdout.write('[server] ' + d));
  child.stderr.on('data', (d) => process.stderr.write('[server:err] ' + d));
  await waitForServer();
});

after(() => {
  if (child && !child.killed) child.kill('SIGTERM');
});

/* ---------- 1. Health (caminho normal) ---------- */
test('GET /health responde ok=true', async () => {
  const { status, data } = await api('GET', '/health');
  assert.strictEqual(status, 200);
  assert.strictEqual(data.ok, true);
  assert.strictEqual(data.service, 'liz-chat-backend');
});

/* ---------- 2. CRUD de conversa (caminho normal) ---------- */
test('POST /conversations cria conversa com título', async () => {
  const { status, data } = await api('POST', '/conversations', { title: 'Conversa de teste' });
  assert.strictEqual(status, 201);
  assert.ok(data.id);
  assert.strictEqual(data.title, 'Conversa de teste');
  assert.strictEqual(data.pinned, false);
  createdConvId = data.id;
});

test('GET /conversations lista com paginação e formato correto', async () => {
  const { status, data } = await api('GET', '/conversations?page=1&limit=10');
  assert.strictEqual(status, 200);
  assert.ok(Array.isArray(data.conversations));
  assert.ok(data.total >= 1);
  assert.strictEqual(data.page, 1);
  assert.ok(data.pages >= 1);
  const found = data.conversations.find((c) => c.id === createdConvId);
  assert.ok(found, 'conversa criada deve aparecer na lista');
});

test('PUT /conversations/:id renomeia', async () => {
  const { status, data } = await api('PUT', `/conversations/${createdConvId}`, { title: 'Título novo' });
  assert.strictEqual(status, 200);
  assert.strictEqual(data.title, 'Título novo');
});

test('PUT /conversations/:id/pin fixa e desfixa', async () => {
  let r = await api('PUT', `/conversations/${createdConvId}/pin`, { pinned: true });
  assert.strictEqual(r.status, 200);
  assert.strictEqual(r.data.pinned, true);

  r = await api('PUT', `/conversations/${createdConvId}/pin`, { pinned: false });
  assert.strictEqual(r.data.pinned, false);
});

/* ---------- 3. Chat send (integração completa) ---------- */
test('POST /chat/send sem conversationId cria conversa automaticamente', async () => {
  const { status, data } = await api('POST', '/chat/send', {
    message: 'Olá Liz, como você está?',
    model: 'liz-3',
  });
  assert.strictEqual(status, 200);
  assert.ok(data.conversationId, 'deve retornar o id da conversa criada');
  assert.strictEqual(data.userMessage.role, 'user');
  assert.strictEqual(data.userMessage.content, 'Olá Liz, como você está?');
  assert.strictEqual(data.assistantMessage.role, 'assistant');
  assert.ok(data.assistantMessage.content.length > 0);
  assert.strictEqual(data.demo, true, 'sem AI_API_URL a resposta deve ser demo');
  sendConvId = data.conversationId;
});

test('POST /chat/send com conversationId existente continua a conversa', async () => {
  const { status, data } = await api('POST', '/chat/send', {
    conversationId: sendConvId,
    message: 'Segunda mensagem da mesma conversa',
  });
  assert.strictEqual(status, 200);
  assert.strictEqual(data.conversationId, sendConvId);
});

test('GET /conversations/:id retorna mensagens em ordem cronológica', async () => {
  const { status, data } = await api('GET', `/conversations/${sendConvId}`);
  assert.strictEqual(status, 200);
  assert.strictEqual(data.messages.length, 4); // 2 user + 2 assistant
  assert.strictEqual(data.messages[0].role, 'user');
  assert.strictEqual(data.messages[1].role, 'assistant');
  assert.strictEqual(data.messages[0].content, 'Olá Liz, como você está?');
  // Ordem temporal estrita
  for (let i = 1; i < data.messages.length; i++) {
    assert.ok(new Date(data.messages[i].createdAt) >= new Date(data.messages[i - 1].createdAt));
  }
});

test('GET /conversations/:id/messages pagina corretamente', async () => {
  const page1 = await api('GET', `/conversations/${sendConvId}/messages?page=1&limit=3`);
  assert.strictEqual(page1.status, 200);
  assert.strictEqual(page1.data.messages.length, 3);
  assert.strictEqual(page1.data.total, 4);
  assert.strictEqual(page1.data.pages, 2);

  const page2 = await api('GET', `/conversations/${sendConvId}/messages?page=2&limit=3`);
  assert.strictEqual(page2.data.messages.length, 1);
  // Páginas não se sobrepõem
  assert.notStrictEqual(page1.data.messages[0].id, page2.data.messages[0].id);
});

test('GET /conversations lista conversa com lastMessage (preview)', async () => {
  const { data } = await api('GET', '/conversations');
  const conv = data.conversations.find((c) => c.id === sendConvId);
  assert.ok(conv);
  assert.ok(conv.lastMessage, 'deve incluir preview da última mensagem');
  assert.strictEqual(conv.lastMessage.role, 'assistant');
});

/* ---------- 4. Bordas ---------- */
test('Paginação com valores absurdos é clampada, não quebra', async () => {
  const { status, data } = await api('GET', '/conversations?page=-5&limit=99999');
  assert.strictEqual(status, 200);
  assert.strictEqual(data.page, 1);
  assert.ok(data.conversations.length <= 100);
});

test('Modelo desconhecido degrada pro padrão sem falhar', async () => {
  const { status, data } = await api('POST', '/chat/send', {
    message: 'teste de modelo inválido',
    model: 'modelo-que-nao-existe',
  });
  assert.strictEqual(status, 200);
  assert.ok(data.assistantMessage.content.length > 0);
});

test('conversationId inválido (não existe) retorna 404', async () => {
  const ghost = '00000000-0000-4000-8000-000000000000';
  const { status } = await api('POST', '/chat/send', {
    conversationId: ghost,
    message: 'oi',
  });
  assert.strictEqual(status, 404);
});

/* ---------- 5. Erros / entradas hostis ---------- */
test('Mensagem vazia retorna 400', async () => {
  const { status, data } = await api('POST', '/chat/send', { message: '   ' });
  assert.strictEqual(status, 400);
  assert.ok(data.message);
});

test('Mensagem sem campo message retorna 400', async () => {
  const { status } = await api('POST', '/chat/send', {});
  assert.strictEqual(status, 400);
});

test('Mensagem gigante (>8000 chars) retorna 400', async () => {
  const { status } = await api('POST', '/chat/send', { message: 'a'.repeat(8001) });
  assert.strictEqual(status, 400);
});

test('Título gigante (>200 chars) retorna 400', async () => {
  const { status } = await api('POST', '/conversations', { title: 'x'.repeat(201) });
  assert.strictEqual(status, 400);
});

test('Título ausente retorna 400', async () => {
  const { status } = await api('POST', '/conversations', {});
  assert.strictEqual(status, 400);
});

test('UUID malformado retorna 400 (não 500)', async () => {
  const r1 = await api('GET', '/conversations/nao-e-um-uuid');
  assert.strictEqual(r1.status, 400);
  const r2 = await api('GET', '/conversations/nao-e-um-uuid/messages');
  assert.strictEqual(r2.status, 400);
  const r3 = await api('DELETE', '/conversations/nao-e-um-uuid');
  assert.strictEqual(r3.status, 400);
});

test('Conversa inexistente retorna 404 em todas as operações', async () => {
  const ghost = '00000000-0000-4000-8000-000000000000';
  assert.strictEqual((await api('GET', `/conversations/${ghost}`)).status, 404);
  assert.strictEqual((await api('PUT', `/conversations/${ghost}`, { title: 'x' })).status, 404);
  assert.strictEqual((await api('DELETE', `/conversations/${ghost}`)).status, 404);
  assert.strictEqual((await api('GET', `/conversations/${ghost}/messages`)).status, 404);
});

test('pinned não-booleano retorna 400', async () => {
  const { status } = await api('PUT', `/conversations/${createdConvId}/pin`, { pinned: 'sim' });
  assert.strictEqual(status, 400);
});

/* ---------- 6. DELETE limpa mensagens junto ---------- */
test('DELETE remove conversa e suas mensagens', async () => {
  const del = await api('DELETE', `/conversations/${sendConvId}`);
  assert.strictEqual(del.status, 200);

  const gone = await api('GET', `/conversations/${sendConvId}`);
  assert.strictEqual(gone.status, 404);
});

test('Rota desconhecida retorna 404 padronizado', async () => {
  const { status, data } = await api('GET', '/rota-que-nao-existe');
  assert.strictEqual(status, 404);
  assert.ok(data.message);
});
