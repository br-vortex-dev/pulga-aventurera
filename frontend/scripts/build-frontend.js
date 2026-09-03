/* ============================================================
 *  Liz — build do frontend para a nuvem (Render Static Site)
 *  Layout publicado:
 *    /        → tela de login (conteúdo de tela-login-html)
 *    /chat/   → app principal do chat
 *  Deixa de fora backend, testes e afins (nada sensível vai pro ar).
 *  Uso: node scripts/build-frontend.js
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'public');

// Garante saída limpa
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// 1) Login na raiz (tudo que está em tela-login-html)
fs.cpSync(path.join(ROOT, 'tela-login-html'), OUT, { recursive: true });
console.log('[build] raiz: tela de login (/)');

// 2) App principal em /chat
const APP = path.join(OUT, 'chat');
fs.mkdirSync(APP, { recursive: true });
for (const f of ['index.html', 'manifest.json', 'sw.js', 'coroa.svg']) {
  fs.copyFileSync(path.join(ROOT, f), path.join(APP, f));
}
for (const d of ['css', 'js', 'mobile']) {
  fs.cpSync(path.join(ROOT, d), path.join(APP, d), { recursive: true });
}
console.log('[build] /chat: chat principal');

// 3) Carimbo de versão nos scripts/styles locais (?v=...) — força o navegador
//    a buscar o arquivo novo a cada publicação (mata o cache velho).
const STAMP = Date.now().toString(36);
function stampHtml(file) {
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(
    /(src|href)="((?!https?:\/\/|\/\/)[^"]+?\.(?:js|css))(?:\?[^""]*)?"/g,
    // (qualquer ?v= antigo é descartado e substituído pelo carimbo novo)
    (m, attr, url) => `${attr}="${url}?v=${STAMP}"`
  );
  fs.writeFileSync(file, html);
}
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.html')) stampHtml(p);
  }
})(OUT);
console.log('[build] cache-bust ?v=' + STAMP);

// 4) Bump automático do CACHE_NAME do service worker (cache-first):
//    sw.js novo a cada build → navegador reinstala e limpa o cache velho.
const swPath = path.join(APP, 'sw.js');
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, 'utf8');
  sw = sw.replace(/const CACHE_NAME = '[^']+'/, `const CACHE_NAME = 'liz-chat-${STAMP}'`);
  fs.writeFileSync(swPath, sw);
  console.log('[build] sw.js CACHE_NAME -> liz-chat-' + STAMP);
}

console.log('[build] pronto ->', OUT);
