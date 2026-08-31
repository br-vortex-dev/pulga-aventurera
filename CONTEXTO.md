# CONTEXTO DO PROJETO — LIZ (handoff para outra IDE)

_Data: 23/08/2026 — gerado após sessão de deploy + integração_

---

## 1. Visão geral

- **Projeto:** Liz AI — chat com IA (frontend estático + backend Node/Express)
- **Repo principal (monorepo):** `https://github.com/br-vortex-dev/liz-interface` (branch `main`, remoto `origin`)
- **Repo do backend (só backend na raiz):** `https://github.com/emanueldasilvaparaisovictor-lab/minha-bugiganga` (público; antes se chamava `liz-backend`, remoto antigo `liz-backend` ainda aponta pra ele)
- **Estrutura local:**
  - `backend/` — Express + Sequelize (Postgres via `DATABASE_URL`, fallback sqlite via `DB_DIALECT=sqlite`)
  - `frontend/` — site estático (login + chat). Build: `node frontend/scripts/build-frontend.js` → gera `frontend/public/`
  - `frontend/mobile/` — versão mobile separada
  - `render.yaml` — blueprint antigo (não é mais o modo de deploy em uso)

## 2. Infra em produção (como ficou)

### Backend — Render
- Serviço: **liz-api** (workspace "liz", `tea-da5gnfou01pc73f6erh0`)
- ID: `srv-da5ht53l550s73ctmqqg`
- URL: **https://liz-api-xgti.onrender.com** (health: `/api/health`)
- Plano free, região oregon, runtime node, build `npm install`, start `npm start`
- **Auto-deploy ligado**: push na `main` do repo `minha-bugiganga` redeploya sozinho
- Env vars já configuradas (via API do Render, valores vieram do `backend/.env` local):
  `NODE_ENV=production`, `DB_DIALECT=sqlite` (sem efeito agora, ver abaixo), `CORS_ORIGIN` (inclui `https://lizia.qzz.io`), `AI_API_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_MAX_TOKENS`, `FIREBASE_*` (todas), `GOOGLE_OAUTH_CLIENT_ID`, `AI_IMAGE_MODEL=gpt-image-1`, `AI_IMAGE_SIZE=1024x1024`, `DATABASE_URL` (Neon)
- **Render API key** existe (foi usada nesta sessão) — NÃO está neste arquivo de propósito (repo público). Pegar em: Render → Account Settings → API Keys

### Banco — Neon (Postgres)
- Projeto **liz** (org "liz's projects"), região São Paulo, plano free
- `DATABASE_URL` (pooled, com `-pooler`) já configurada no Render. Tabelas criadas pelo `sequelize.sync()`: `attachments, conversations, messages, user_memories`
- Senha do Neon foi exposta em conversa — recomendo resetar (Neon → Roles → Reset password) e atualizar a env var no painel do Render

### Frontend — Cloudflare Pages
- Projeto Pages: **liz** (conta `studiosluxgames@gmail.com`, account_id `ab7424760f00835b21251c0d28b8d707`)
- Domínio: **https://lizia.qzz.io** (+ `liz-363.pages.dev`)
- **Deploy é UPLOAD DIRETO via wrangler (NÃO é por Git!)** — push no GitHub não redeploya o front
- Deploy manual (já logado nesta máquina):
  ```
  node frontend/scripts/build-frontend.js
  npx wrangler pages deploy frontend/public --project-name=liz --branch=main --commit-dirty=true
  ```
- O front aponta pra API nova: `js/api.js`, `js/firebase-config.js`, `frontend/tela-login-html/js/firebase-config.js` e `_headers` (CSP) usam `https://liz-api-xgti.onrender.com/api` (a antiga `liz-api.onrender.com` está morta/503)

## 3. Problema histórico (importante!)

- A conta Render do usuário **nunca conseguiu conectar no GitHub** (tela "No repositories found", API retorna "repository URL is invalid or unfetchable" pra QUALQUER repo, mesmo com o GitHub App instalado e autorizado com All repositories). Causa desconhecida.
- **Solução encontrada:** deixar o repo do backend **público** (Render busca repo público sem credencial). O repo `minha-bugiganga` é público — código visível, mas SEM segredos (`.env`, sqlite e service account nunca foram commitados — verificado).
- Se um dia quiser repo privado de novo: suporte Render, ou GitLab/Bitbucket, ou deploy via imagem Docker.

## 4. Pendências / observações

- Render free **dorme** após ~15 min de inatividade (primeira request demora ~50s). O front já trata isso.
- `DB_DIALECT=sqlite` ainda existe como env var no Render mas é ignorada quando há `DATABASE_URL` (pode remover).
- O backend lê `.env` local via dotenv — no Render as env vars vêm do painel (dotenv não encontra arquivo, ok).
- Último commit no monorepo: `eb3e376 fix: aponta frontend para nova API no Render (liz-api-xgti)` (pushed).

---

## 5. TAREFA EM ANDAMENTO: redesign do prompt box (composer)

**Pedido do usuário:** reformatar o composer do chat desktop no estilo da referência (estilo ChatGPT):
- Caixa arredondada com textarea **no topo** (placeholder no canto superior esquerdo)
- **Barra de baixo**: à ESQUERDA botões **+ (anexar)** e **globo (pesquisa web)**; à DIREITA o **seletor de modelo (chip "Liz 3 ▾")** e **botão de enviar CIRCULAR**
- **Cores têm que combinar com o site** (tema roxo da Liz: `--color-brand-light #8b5cf6`, glass escuro `rgba(16,10,26,0.55)` etc. — manter o estilo glass atual do composer)

**NÃO foi feito nada ainda no site** (o usuário pediu pra apagar o `prompt-box.html` standalone que eu tinha criado — já apagado — e integrar direto no site).

### Estrutura atual do composer

`frontend/index.html` (linhas ~170-235):
```html
<form class="composer" id="chat-form" autocomplete="off">
  <div class="composer-inner">
    <button class="composer-btn" id="attach-btn" type="button" aria-label="Anexar arquivo" title="Anexar">
      <span></span>  <!-- ícone injetado via JS -->
    </button>
    <textarea class="composer-input" id="chat-input" rows="1" placeholder="Digite sua mensagem para a Liz..."></textarea>
    <div class="model-selector" id="model-selector"> ... chip "Liz 3" + dropdown com modelos (nable-35, nable-35-mini, liz-3-flash, liz-3) ... </div>
    <button class="send-btn" id="send-btn" type="submit" disabled><span></span></button>  <!-- ícone via JS -->
  </div>
</form>
```

### Hooks de JS que NÃO podem quebrar (IDs/classes usados)
- `frontend/js/ui-core.js`:
  - linha ~29-31: pega `#chat-input`, `#send-btn`, `#attach-btn`
  - linhas 63-64: injeta ícones em `querySelector('span')` de attach e send (usar `LizConfig.icons.attach` / `.send`) → **manter o `<span></span>` dentro dos botões**
  - linha ~150: habilita/desabilita send conforme input
- `frontend/js/chat/chat-events.js`:
  - linha ~66-67, 93: listeners de send/attach
  - linhas 286-288: referências `'#attach-btn'`, `'#send-btn'`, `'#chat-input'`
  - linhas 389, 456: `#model-selector-btn` (dropdown do seletor de modelo)
- `frontend/js/chat/chat-intro.js` linhas 47, 138, 267: usa `#chat-input` e `.composer`
- `frontend/js/ui-chat.js` linhas ~335, 359: estado do sendBtn (is-generating etc.)

### CSS do composer (onde mexer)
- `frontend/css/chat.css` linhas ~308-384:
  - `.composer` (wrapper com gradiente), `.composer-inner` (glass: `rgba(16,10,26,0.55)`, blur 28px, borda `rgba(139,92,246,0.18)`, radius 22px, tem variante `[data-theme="light"]` e `:focus-within`)
  - `.composer-input`, `.composer-btn` (36px), `.send-btn` (38px, radius 13px → mudar pra 50% circular)
  - `.send-btn.is-generating`, `.is-cooldown` (linhas ~693-707) — estados especiais, manter funcionando
- `frontend/css/responsive.css` linhas ~115-120 e ~249: ajustes mobile do composer
- `frontend/css/theme.css` linha ~12 e ~84: `.composer-inner` em temas/densidade

### Plano de mudança (sugerido)
1. `index.html`: reorganizar o composer em 2 linhas:
   - Linha 1: `<textarea>` sozinho (largura total)
   - Linha 2 (`.composer-toolbar`): esquerda = `#attach-btn` (+) e NOVO botão globo (`#websearch-btn`, toggle `aria-pressed`, ícone SVG inline); direita = `.model-selector` (chip) + `#send-btn`
   - Manter TODOS os IDs atuais; manter `<span></span>` nos botões attach/send
2. `chat.css`: `.composer-inner` vira `flex-direction: column; align-items: stretch;`; criar `.composer-toolbar { display:flex; justify-content:space-between }`; `.send-btn { border-radius: 50%; }`; chip do model-selector já existe, só ajustar paddings se precisar; adicionar estilo `.composer-btn.is-active` (globo ativado, roxo)
3. Responsivo: revisar `responsive.css` para a nova estrutura
4. Globo: por enquanto só toggle visual (formato). Wiring com o backend (`services/webSearchService.js` — pesquisa web automática) é opcional/depósito futuro
5. Deploy: build + `npx wrangler pages deploy frontend/public --project-name=liz --branch=main --commit-dirty=true`

### Referência visual (o que copiar)
- Placeholder cinza claro no topo; ícones ~20px cinza; chip "Deep Think" = nosso model selector; send circular cinza→roxo quando habilitado (usar gradiente roxo da casa pra "combinar com o site")
