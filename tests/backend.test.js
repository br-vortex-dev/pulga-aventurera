/* ============================================================
 *  Testes do backend — roda contra o servidor na porta 3000.
 *  Uso: node backend/tests/backend.test.js
 *  (o servidor precisa estar rodando: node backend/server.js)
 * ============================================================ */
const BASE = 'http://localhost:3000/api';

let passed = 0;
let failed = 0;

function assert(cond, name) {
  if (cond) {
    passed++;
    console.log('  ok  ' + name);
  } else {
    failed++;
    console.error('  FAIL ' + name);
  }
}

async function api(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch (e) { /* corpo vazio */ }
  return { status: res.status, json };
}

(async () => {
  console.log('\n--- Health ---');
  const health = await api('GET', '/health');
  assert(health.status === 200, 'health retorna 200');
  assert(health.json && health.json.ok === true, 'health ok:true');

  console.log('\n--- CRUD de conversa ---');
  const created = await api('POST', '/conversations', { title: 'Conversa de teste' });
  assert(created.status === 201, 'criar conversa retorna 201');
  const convId = created.json.id;
  assert(typeof convId === 'string' && convId.length > 5, 'id gerado');

  const got = await api('GET', '/conversations/' + convId);
  assert(got.status === 200 && got.json.title === 'Conversa de teste', 'buscar conversa por id');

  const renamed = await api('PUT', '/conversations/' + convId, { title: 'Título novo' });
  assert(renamed.status === 200 && renamed.json.title === 'Título novo', 'renomear conversa');

  const pinned = await api('PUT', '/conversations/' + convId + '/pin', { pinned: true });
  assert(pinned.status === 200 && pinned.json.pinned === true, 'fixar conversa');

  const list = await api('GET', '/conversations?page=1&limit=5');
  assert(list.status === 200 && Array.isArray(list.json.conversations), 'listar conversas');
  assert(list.json.conversations.some((c) => c.id === convId), 'conversa criada aparece na lista');

  console.log('\n--- Chat / envio ---');
  const send = await api('POST', '/chat/send', {
    conversationId: convId,
    message: 'Me ajude com um código JavaScript',
    mode: 'code',
    model: 'liz-3',
  });
  assert(send.status === 200, 'chat/send retorna 200');
  assert(send.json.conversationId === convId, 'resposta mantém conversationId');
  assert(send.json.userMessage && send.json.userMessage.role === 'user', 'userMessage salva');
  assert(send.json.assistantMessage && send.json.assistantMessage.role === 'assistant', 'assistantMessage gerada');
  assert(/c[oó]digo|exemplo|limpo/i.test(send.json.assistantMessage.content), 'resposta coerente com a palavra-chave');

  const msgs = await api('GET', '/conversations/' + convId + '/messages?page=1&limit=50');
  assert(msgs.status === 200 && msgs.json.total === 2, 'histórico com 2 mensagens persistidas');

  console.log('\n--- Validação de entrada ---');
  const emptyMsg = await api('POST', '/chat/send', { message: '   ' });
  assert(emptyMsg.status === 400, 'mensagem vazia rejeitada');

  const notFound = await api('GET', '/conversations/nao_existe_123');
  assert(notFound.status === 404, 'conversa inexistente retorna 404');

  const badJson = await fetch(BASE + '/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{json quebrado',
  });
  assert(badJson.status === 400, 'JSON malformado retorna 400');

  const badRoute = await api('GET', '/rota_inexistente');
  assert(badRoute.status === 404, 'rota inexistente retorna 404');

  console.log('\n--- Upload multipart ---');
  const boundary = '----TestBoundary' + Date.now();
  const fileContent = Buffer.from('conteudo de teste do arquivo');
  const parts = [];
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="conversationId"\r\n\r\n${convId}\r\n`));
  parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="teste.txt"\r\nContent-Type: text/plain\r\n\r\n`));
  parts.push(fileContent);
  parts.push(Buffer.from(`\r\n--${boundary}--\r\n`));
  const multipartBody = Buffer.concat(parts);

  const uploadRes = await fetch(BASE + '/chat/upload', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body: multipartBody,
  });
  const uploadJson = await uploadRes.json();
  assert(uploadRes.status === 200, 'upload retorna 200');
  assert(uploadJson.name === 'teste.txt', 'nome original preservado na resposta');
  assert(uploadJson.size === fileContent.length, 'tamanho correto');
  assert(typeof uploadJson.url === 'string' && uploadJson.url.startsWith('/api/uploads/'), 'url de download retornada');

  const download = await fetch(BASE.replace('/api', '') + uploadJson.url);
  assert(download.status === 200, 'arquivo baixável');
  const downloaded = Buffer.from(await download.arrayBuffer());
  assert(downloaded.equals(fileContent), 'conteúdo íntegro no download');

  console.log('\n--- Limpeza ---');
  const del = await api('DELETE', '/conversations/' + convId);
  assert(del.status === 200, 'deletar conversa');
  const afterDel = await api('GET', '/conversations/' + convId);
  assert(afterDel.status === 404, 'conversa sumiu após delete');

  console.log(`\nResultado: ${passed} ok, ${failed} falhas`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('Erro fatal no teste:', e.message);
  process.exit(1);
});
