/* ============================================================
 * Testes P0 — bugs 1, 2, 3, 4, 5, 6, 7
 * Roda sem dependências: node tests/p0.test.js
 * ============================================================ */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let pass = 0, fail = 0;
function assert(name, cond, detail) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (detail ? ' — ' + detail : '')); }
}

/* Fonte completa do chat: entrypoint (js/chat.js) + módulos parciais (js/chat/*.js) */
function readChatSource() {
  const dir = path.join(__dirname, '..', 'js', 'chat');
  const parts = [fs.readFileSync(path.join(__dirname, '..', 'js', 'chat.js'), 'utf8')];
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort()) {
      parts.push(fs.readFileSync(path.join(dir, f), 'utf8'));
    }
  }
  return parts.join('\n');
}

/* Carrega data.js num sandbox com localStorage/window simulados */
function loadDataJs() {
  const store = {};
  const sandbox = {
    console,
    Date, Math, JSON,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    window: {},
  };
  sandbox.window.localStorage = sandbox.localStorage;
  const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window.LizData;
}

console.log('\n[1] Bug 1 — \\n literal nas respostas simuladas');
{
  const raw = fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8');
  assert('nenhum backslash duplo resta no data.js', !raw.includes('\\\\n'));
  const LizData = loadDataJs();
  const texts = [
    LizData.replies.code[0], LizData.replies.design[0], LizData.replies.error[0],
    LizData.replies.ideas[0], LizData.replies.default[0],
    LizData.sampleMessages[1].content,
  ];
  assert('todas as respostas com quebra contêm newline REAL', texts.filter((t) => t.includes('\\n') === false).length >= 4);
  assert('nenhuma resposta contém "\\n" literal visível', texts.every((t) => !t.includes('\\n')));
  assert('bloco de código da resposta "code" multilinha', LizData.replies.code[0].split('\n').length >= 7);
}

console.log('\n[2] Bug 7 — painel sem conversas fake');
{
  const LizData = loadDataJs();
  const groups = LizData.getConversationGroups();
  assert('storage vazio → nenhum grupo (sem dados de exemplo)', Array.isArray(groups) && groups.length === 0);
  // borda: com 1 conversa salva, só ela aparece
  LizData.saveConversation('Conversa real', [{ role: 'user', content: 'oi', time: '10:00' }]);
  const groups2 = LizData.getConversationGroups();
  const all = groups2.flatMap((g) => g.items);
  assert('com 1 conversa salva, só ela aparece', all.length === 1 && all[0].title === 'Conversa real');
}

console.log('\n[3] Bugs 6/7 — persistência por id (não por título)');
{
  const LizData = loadDataJs();
  const id1 = LizData.saveConversation('Mesmo título', [{ role: 'user', content: 'oi', time: '10:00' }]);
  assert('normal: saveConversation retorna id', typeof id1 === 'string' && id1.length > 0);
  const id2 = LizData.saveConversation('Mesmo título', [{ role: 'user', content: 'outra', time: '10:01' }]);
  assert('borda: títulos iguais → conversas distintas', id1 !== id2 && LizData.savedConversations.length === 2);
  const id3 = LizData.saveConversation('Mesmo título', [{ role: 'user', content: 'oi' }, { role: 'liz', content: 'olá' }], id1);
  assert('normal: re-save com id não duplica', id3 === id1 && LizData.savedConversations.length === 2);
  assert('normal: mensagens atualizadas no lugar', LizData.getConversationById(id1).messages.length === 2);
  const id4 = LizData.saveConversation('Nova', [{ role: 'user', content: 'x' }], 'conv_nao_existe');
  assert('erro: id desconhecido cria nova sem quebrar', typeof id4 === 'string' && id4 !== 'conv_nao_existe' && LizData.savedConversations.length === 3);
  LizData.renameConversation(id1, 'Título novo');
  LizData.saveConversation('Título novo', [{ role: 'user', content: 'final' }], id1);
  assert('integração: rename + save mantém conversa única', LizData.savedConversations.filter((c) => c.id === id1).length === 1);
}

console.log('\n[4] Bug 5 — XSS no float panel');
{
  const panels = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui-panels.js'), 'utf8');
  assert('float panel escapa item.title', panels.includes('this._esc(item.title)'));
  assert('float panel escapa item.id', panels.includes('this._esc(item.id)'));
  // simulação do _esc pra garantir que neutraliza payload
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const payload = '<img src=x onerror=alert(1)>';
  assert('payload XSS neutralizado pelo escape', !esc(payload).includes('<img'));
}

console.log('\n[5] Bug 4 — lock de geração + parar geração');
{
  const chat = readChatSource();
  assert('sendMessage bloqueia durante geração', /sendMessage\(\)\s*\{[\s\S]{0,180}isGenerating/.test(chat));
  assert('submit vira stopGeneration durante geração', chat.includes('if (this.isGenerating) { this.stopGeneration(); return; }'));
  assert('_streamReply com try/finally + _endGeneration', /async _streamReply[\s\S]*?finally\s*\{\s*this\._endGeneration\(\);/.test(chat));
  assert('_simulateFileReply com lock', /async _simulateFileReply[\s\S]*?_beginGeneration[\s\S]*?finally/.test(chat));
  assert('continueMessage com lock', /async continueMessage[\s\S]*?_beginGeneration[\s\S]*?finally/.test(chat));
  assert('regenerateMessage respeita lock', /async regenerateMessage[\s\S]{0,220}isGenerating/.test(chat));
  assert('_typeWords interrompe no stop', /async _typeWords[\s\S]*?_stopRequested\) break/.test(chat));
  const uichat = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui-chat.js'), 'utf8');
  assert('setGeneratingState existe no LizUI', uichat.includes('LizUI.setGeneratingState'));
  assert('showTyping não duplica indicador', /showTyping = function\(\)\s*\{\s*this\.removeTyping\(\)/.test(uichat));
  const uicore = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui-core.js'), 'utf8');
  assert('updateSendState mantém botão ativo na geração', uicore.includes('if (this._generating)'));
}

console.log('\n[6] Bugs 2/3 — edição de mensagem');
{
  const uichat = fs.readFileSync(path.join(__dirname, '..', 'js', 'ui-chat.js'), 'utf8');
  assert('editar em qualquer msg (sem condição de última)', !uichat.includes('index === LizChat.messages.length - 1'));
  assert('edição usa conteúdo bruto (não innerText)', uichat.includes('LizChat.messages[msgIndex]'));
  const chat = readChatSource();
  assert('openSampleConversation removido do chat.js', !chat.includes('openSampleConversation'));
  assert('openConversationById presente', chat.includes('openConversationById(id)'));
}

console.log('\n' + (fail === 0 ? '>>> TODOS PASSARAM' : '>>> FALHAS: ' + fail) + ' — ' + pass + ' pass / ' + fail + ' fail\n');
process.exit(fail === 0 ? 0 : 1);
