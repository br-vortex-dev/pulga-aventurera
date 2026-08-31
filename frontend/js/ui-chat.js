/* ============================================================
 *  Liz — ui-chat.js
 *  Sugestões, starters, mensagens, busca, reações, edição
 * ============================================================ */

// ===================== SUGESTÕES =====================
// Os cards de sugestão (Código/Design/Erros/Ideias) foram removidos da UI;
// as funções abaixo ficam com guarda pra não quebrar chamadas antigas.
LizUI.renderSuggestions = function() {
  if (!this.el.suggestions) return;
  this.el.suggestions.innerHTML = LizConfig.suggestions
    .map((s) => '<button class="suggestion" type="button" data-mode="' + this._esc(s.id) + '">' +
      '<span class="suggestion-ico">' + (LizConfig.icons[s.icon] || LizConfig.icons.sparkle) + '</span>' +
      this._esc(s.label) + '</button>').join('');
  this.el.suggestions.querySelectorAll('.suggestion').forEach((chip) => {
    chip.addEventListener('click', () => this.selectMode(chip.dataset.mode));
  });
};

LizUI.selectMode = function(modeId) {
  if (!this.el.suggestions) return;
  if (this.activeMode === modeId) { this.clearMode(); return; }
  const mode = LizConfig.suggestions.find((s) => s.id === modeId);
  if (!mode) return;
  this.activeMode = modeId;
  this.el.suggestions.querySelectorAll('.suggestion').forEach((chip) => {
    chip.classList.toggle('is-active', chip.dataset.mode === modeId);
  });
  this.setStatus(mode.status);
  this.el.input.placeholder = mode.placeholder;
  this._renderStarters(modeId);
};

LizUI.clearMode = function() {
  this.activeMode = null;
  if (this.el.suggestions) {
    this.el.suggestions.querySelectorAll('.suggestion').forEach((chip) => chip.classList.remove('is-active'));
  }
  this.setStatus('Nova conversa');
  this.el.input.placeholder = this._defaultPlaceholder;
  if (this.el.starters) this.el.starters.innerHTML = '';
};

LizUI._renderStarters = function(modeId) {
  if (!this.el.starters) return;
  const items = LizConfig.startersByMode[modeId] || [];
  this.el.starters.innerHTML = items.map((s) => {
    const isLink = !!s.link;
    const dataAttr = isLink
      ? 'data-link="' + this._esc(s.link) + '"'
      : 'data-prompt="' + this._esc(s.prompt) + '"';
    return '<button class="starter' + (isLink ? ' starter-external' : '') + '" type="button" ' + dataAttr + '>' +
      '<span class="starter-ico">' + (LizConfig.icons[s.icon] || LizConfig.icons.sparkle) + '</span>' +
      '<span class="starter-label">' + this._esc(s.title) + '</span>' +
      '<span class="starter-arrow">' + (isLink ? LizConfig.icons.expand : LizConfig.icons.continue) + '</span></button>';
  }).join('');
  this.el.starters.querySelectorAll('.starter').forEach((card) => {
    card.addEventListener('click', () => {
      if (card.dataset.link) {
        window.open(card.dataset.link, '_blank', 'noopener');
        return;
      }
      this.el.input.value = card.dataset.prompt;
      this.updateSendState();
      this.el.input.focus();
    });
  });
};

LizUI.renderStarters = function() {
  if (this.el.starters) this.el.starters.innerHTML = '';
};

// ===================== BUSCA NA CONVERSA =====================
LizUI.renderSearchBar = function() {
  if (this.el.searchBar) return;
  const searchBar = document.createElement('div');
  searchBar.id = 'search-bar';
  searchBar.className = 'search-bar is-hidden';
  searchBar.innerHTML = '<div class="search-bar-inner">' +
    '<span class="search-bar-ico">' + LizConfig.icons.filter + '</span>' +
    '<input type="text" id="search-input" placeholder="Buscar na conversa..." autocomplete="off" />' +
    '<button class="search-bar-close" type="button" aria-label="Fechar busca">' + LizConfig.icons.close + '</button></div>';
  this.el.contentWrap.parentNode.insertBefore(searchBar, this.el.contentWrap);
  this.el.searchBar = searchBar;
  this.el.searchInput = searchBar.querySelector('#search-input');
  this.el.searchInput.addEventListener('input', () => this._filterMessages());
  searchBar.querySelector('.search-bar-close').addEventListener('click', () => this.hideSearchBar());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && this.el.searchBar && !this.el.searchBar.classList.contains('is-hidden')) this.hideSearchBar();
  });
};

LizUI.showSearchBar = function() {
  this.renderSearchBar();
  this.el.searchBar.classList.remove('is-hidden');
  setTimeout(() => this.el.searchInput?.focus(), 100);
};

LizUI.hideSearchBar = function() {
  if (this.el.searchBar) { this.el.searchBar.classList.add('is-hidden'); this.el.searchInput.value = ''; }
  document.querySelectorAll('.msg').forEach((m) => m.classList.remove('is-filtered-out', 'is-highlighted'));
};

LizUI._filterMessages = function() {
  const query = this.el.searchInput?.value.trim().toLowerCase() || '';
  document.querySelectorAll('.msg').forEach((m) => {
    const text = m.querySelector('.msg-text')?.innerText.toLowerCase() || '';
    if (!query) { m.classList.remove('is-filtered-out', 'is-highlighted'); }
    else if (text.includes(query)) { m.classList.remove('is-filtered-out'); m.classList.add('is-highlighted'); }
    else { m.classList.add('is-filtered-out'); m.classList.remove('is-highlighted'); }
  });
};

// ===================== SCROLL BOTTOM BUTTON =====================
LizUI.renderScrollButton = function() {
  if (this.el.scrollBtn) return;
  const btn = document.createElement('button');
  btn.id = 'scroll-bottom-btn';
  btn.className = 'scroll-bottom-btn is-hidden';
  btn.innerHTML = LizConfig.icons.arrowDown;
  btn.setAttribute('aria-label', 'Rolar para o final');
  btn.addEventListener('click', () => { this._scrollToBottom(); btn.classList.add('is-hidden'); });
  document.querySelector('.chat-main')?.appendChild(btn);
  this.el.scrollBtn = btn;
  this.el.contentWrap.addEventListener('scroll', () => {
    const { scrollTop, scrollHeight, clientHeight } = this.el.contentWrap;
    btn.classList.toggle('is-hidden', scrollHeight - scrollTop - clientHeight < 120);
  });
};

// ===================== REAÇÕES =====================
LizUI._reactionsHTML = function(msgIndex) {
  const reactions = (typeof LizChat !== 'undefined' && LizChat.messageReactions?.[msgIndex]) || {};
  let html = '<div class="reactions-bar" data-msg-index="' + msgIndex + '">';
  LizData.reactionEmojis.forEach((r) => {
    const count = reactions[r.key] || 0;
    html += '<button class="reaction-btn' + (count > 0 ? ' is-active' : '') + '" data-reaction="' + r.key + '" type="button" aria-label="' + this._esc(r.label || r.key) + '">' +
      '<span class="reaction-emoji">' + (LizConfig.icons[r.icon] || '') + '</span>' + (count > 0 ? '<span class="reaction-count">' + count + '</span>' : '') + '</button>';
  });
  html += '</div>';
  return html;
};

// ===================== EDIÇÃO =====================
LizUI.enterEditMode = function(msgElement, msgIndex) {
  const textEl = msgElement.querySelector('.msg-text');
  if (!textEl) return;
  // Conteúdo bruto (markdown) — innerText perderia a formatação original
  const stored = (typeof LizChat !== 'undefined' && LizChat.messages) ? LizChat.messages[msgIndex] : null;
  const originalText = (stored && typeof stored.content === 'string') ? stored.content : textEl.innerText;
  const textarea = document.createElement('textarea');
  textarea.className = 'edit-textarea';
  textarea.value = originalText;
  textarea.rows = 3;
  textarea.setAttribute('aria-label', 'Editar mensagem');
  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'edit-actions';
  actionsDiv.innerHTML = '<button class="edit-save" type="button">Salvar</button><button class="edit-cancel" type="button">Cancelar</button>';
  textEl.style.display = 'none';
  textEl.parentNode.insertBefore(textarea, textEl.nextSibling);
  textarea.parentNode.insertBefore(actionsDiv, textarea.nextSibling);
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  textarea.addEventListener('input', () => { textarea.style.height = 'auto'; textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'; });
  setTimeout(() => { textarea.style.height = 'auto'; textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'; }, 0);
  const save = () => {
    const newText = textarea.value.trim();
    if (newText && newText !== originalText && typeof LizChat !== 'undefined') LizChat.editMessage(msgIndex, newText);
    this._exitEditMode(textEl, textarea, actionsDiv);
  };
  const cancel = () => { this._exitEditMode(textEl, textarea, actionsDiv); };
  actionsDiv.querySelector('.edit-save').addEventListener('click', save);
  actionsDiv.querySelector('.edit-cancel').addEventListener('click', cancel);
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save(); }
    if (e.key === 'Escape') cancel();
  });
};

LizUI._exitEditMode = function(textEl, textarea, actionsDiv) {
  textEl.style.display = '';
  if (textarea.parentNode) textarea.remove();
  if (actionsDiv.parentNode) actionsDiv.remove();
};

LizUI.replaceMessageAtIndex = function(index, newHTML) {
  const msgs = this.el.messagesList.querySelectorAll('.msg');
  if (msgs[index]) msgs[index].outerHTML = newHTML;
};

// ===================== ESTADOS =====================
LizUI.showEmptyState = function() {
  this.el.emptyState.classList.remove('is-hidden');
  this.el.messagesList.classList.add('is-hidden');
  this.setStatus('Nova conversa');
};

LizUI.showConversation = function(title) {
  this.el.emptyState.classList.add('is-hidden');
  this.el.messagesList.classList.remove('is-hidden');
  if (title) this.setStatus(title);
};

LizUI.setStatus = function(text) {
  const node = this.el.status?.querySelector('.header-status-text');
  if (node && node.textContent !== text) node.textContent = text;
};

// ===================== FONTES DA WEB =====================
LizUI.renderWebResults = function(results) {
  if (!Array.isArray(results)) return '';
  var apiBase = (typeof LizAPI !== 'undefined' && LizAPI.BASE_URL) ? LizAPI.BASE_URL : '';
  var cards = results.map((item) => {
    var url = this._safeLinkUrl(item.url);
    if (!url) return '';
    var title = this._esc(item.title || 'Resultado da busca');
    var description = this._esc(item.description || '');
    var source = this._esc(item.source || 'Fonte consultada');
    var age = item.age ? ' · ' + this._esc(item.age) : '';
    var thumbHtml = '';
    if (item.thumbnail) {
      var thumbSrc = item.thumbnail;
      if (thumbSrc.startsWith('/api/') && apiBase) thumbSrc = apiBase.replace(/\/api\/?$/, '') + thumbSrc;
      var thumbOnErr = ' onerror="this.style.display=\'none\'" onload="this.classList.remove(\'is-loading\')"';
      thumbHtml = '<img class="web-result-thumb is-loading" src="' + this._esc(thumbSrc) + '" alt="" loading="lazy"' + thumbOnErr + ' />';
    }
    return '<a class="web-result-card" href="' + this._esc(url) + '" target="_blank" rel="noopener noreferrer">' + thumbHtml +
      '<div class="web-result-text"><span class="web-result-title">' + title + '</span>' +
      '<span class="web-result-description">' + description + '</span>' +
      '<span class="web-result-source">' + source + age + '</span></div>' +
      '</a>';
  }).join('');
  return cards ? '<section class="web-results" aria-label="Fontes consultadas"><div class="web-results-heading">Fontes consultadas</div><div class="web-results-list">' + cards + '</div></section>' : '';
};

// ===================== MENSAGENS =====================
LizUI.renderMessages = function(messages) {
  this.el.messagesList.innerHTML = messages.map((m, i) => this._messageHTML(m, i)).join('');
  this.hydrateUploads(this.el.messagesList);
  this._scrollToBottom();
};

LizUI.appendMessage = function(msg, index) {
  const div = document.createElement('div');
  div.innerHTML = this._messageHTML(msg, index);
  const node = div.firstElementChild;
  this.el.messagesList.appendChild(node);
  this.hydrateUploads(node);
  this._scrollToBottom();
  return node;
};

LizUI._messageHTML = function(m, index) {
  var timeHtml = m.time ? '<p class="msg-time">' + this._esc(m.time) + '</p>' : '';
  var dataIdx = index !== undefined ? ' data-msg-index="' + index + '"' : '';
  if (m.file) {
    var fileHtml = this.renderFileMessage(m.file, index);
    return '<div class="msg msg-user"' + dataIdx + '><div class="msg-bubble msg-bubble-user">' + fileHtml + '</div>' +
      '<div class="msg-user-actions"><button class="msg-action js-delete" type="button" title="Apagar">' + LizConfig.icons.trash + '</button>' + timeHtml + '</div></div>';
  }
  if (m.role === 'user') {
    // Editar disponível em qualquer mensagem do usuário (não apenas na última)
    var editBtn = '<button class="msg-action js-edit" type="button" title="Editar">' + LizConfig.icons.edit + '</button>';
    return '<div class="msg msg-user"' + dataIdx + '><div class="msg-bubble msg-bubble-user"><div class="msg-text">' + this._markdown(m.content) + '</div></div>' +
      '<div class="msg-user-actions">' + editBtn + '<button class="msg-action js-delete" type="button" title="Apagar">' + LizConfig.icons.trash + '</button>' + timeHtml + '</div></div>';
  }
  var reactionsHtml = index !== undefined ? this._reactionsHTML(index) : '';
  var demoBadge = m.demo === true ? '<span class="msg-demo-badge">Modo demonstração</span>' : '';
  var aiImages = typeof this.renderAIImages === 'function' ? this.renderAIImages(m.images) : '';
  var webResults = typeof this.renderWebResults === 'function' ? this.renderWebResults(m.webResults) : '';
  return '<div class="msg msg-liz"' + dataIdx + '><div class="msg-avatar">' + LizConfig.crown + '</div><div>' +
    '<div class="msg-bubble msg-bubble-liz"><span class="msg-name">Liz</span>' + demoBadge + '<div class="msg-text">' + this._markdown(m.content) + '</div>' + aiImages + webResults + '</div>' + timeHtml +
    '<div class="msg-actions"><button class="msg-action js-copy" type="button" title="Copiar">' + LizConfig.icons.copy + 'Copiar</button>' +
    '<button class="msg-action js-continue" type="button" title="Continuar">' + LizConfig.icons.continue + 'Continuar</button>' +
    '<button class="msg-action js-redo" type="button" title="Refazer">' + LizConfig.icons.redo + 'Refazer</button>' +
    '<button class="msg-action js-delete" type="button" title="Apagar">' + LizConfig.icons.trash + '</button></div>' + reactionsHtml + '</div></div>';
};

LizUI.bindMessageActions = function() {
  this.el.messagesList.addEventListener('click', (e) => {
    const copyBtn = e.target.closest('.js-copy');
    if (copyBtn) {
      const text = copyBtn.closest('.msg-liz').querySelector('.msg-text').innerText;
      navigator.clipboard?.writeText(text).then(() => { if (typeof LizChat !== 'undefined') LizChat.toast('Copiado'); }, () => { if (typeof LizChat !== 'undefined') LizChat.toast('Não foi possível copiar'); });
      return;
    }
    const codeCopyBtn = e.target.closest('[data-copy-code]');
    if (codeCopyBtn) {
      const code = codeCopyBtn.closest('.code-block')?.querySelector('code')?.textContent || '';
      navigator.clipboard?.writeText(code).then(() => { if (typeof LizChat !== 'undefined') LizChat.toast('Código copiado'); });
      return;
    }
    const redoBtn = e.target.closest('.js-redo');
    if (redoBtn) {
      const msgEl = redoBtn.closest('.msg-liz');
      const idx = parseInt(msgEl?.dataset?.msgIndex);
      if (!isNaN(idx) && typeof LizChat !== 'undefined') LizChat.regenerateMessage(idx);
      return;
    }
    const continueBtn = e.target.closest('.js-continue');
    if (continueBtn) {
      const msgEl = continueBtn.closest('.msg-liz');
      const idx = parseInt(msgEl?.dataset?.msgIndex);
      if (!isNaN(idx) && typeof LizChat !== 'undefined') LizChat.continueMessage(idx);
      return;
    }
    const editBtn = e.target.closest('.js-edit');
    if (editBtn) {
      const msgEl = editBtn.closest('.msg');
      const idx = parseInt(msgEl?.dataset?.msgIndex);
      if (!isNaN(idx)) this.enterEditMode(msgEl, idx);
      return;
    }
    const deleteBtn = e.target.closest('.js-delete');
    if (deleteBtn) {
      const idx = parseInt(deleteBtn.closest('.msg')?.dataset?.msgIndex);
      if (!isNaN(idx) && typeof LizChat !== 'undefined') LizChat.deleteMessage(idx);
      return;
    }
    const reactionBtn = e.target.closest('.reaction-btn');
    if (reactionBtn) {
      const msgIndex = parseInt(reactionBtn.closest('.reactions-bar')?.dataset?.msgIndex);
      const reaction = reactionBtn.dataset.reaction;
      if (!isNaN(msgIndex) && reaction && typeof LizChat !== 'undefined') LizChat.toggleReaction(msgIndex, reaction);
    }
  });
};

LizUI.showTyping = function() {
  this.removeTyping(); // garante indicador único (sem duplicar nó)
  const node = document.createElement('div');
  node.id = 'typing-indicator';
  node.className = 'msg msg-liz';
  node.innerHTML = '<div class="msg-avatar">' + LizConfig.crown + '</div><div class="msg-bubble msg-bubble-liz msg-typing">' +
    '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>';
  this.el.messagesList.appendChild(node);
  this._scrollToBottom();
};

LizUI.removeTyping = function() {
  const node = document.getElementById('typing-indicator');
  if (node) node.remove();
};

/* ---------- Estado de geração: botão enviar vira "Parar geração" ---------- */
LizUI.setGeneratingState = function(generating) {
  this._generating = generating;
  const btn = this.el.sendBtn;
  if (!btn) return;
  const ico = btn.querySelector('span');
  if (generating) {
    if (ico && !this._sendIconHtml) this._sendIconHtml = ico.innerHTML;
    if (ico) ico.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="6.5" width="11" height="11" rx="2.5"/></svg>';
    btn.classList.add('is-generating');
    btn.disabled = false;
    btn.setAttribute('aria-label', 'Parar geração');
    btn.setAttribute('title', 'Parar geração');
  } else {
    if (ico && this._sendIconHtml) ico.innerHTML = this._sendIconHtml;
    btn.classList.remove('is-generating');
    btn.removeAttribute('title');
    btn.setAttribute('aria-label', 'Enviar mensagem');
    this.updateSendState();
  }
};

/* ---------- Cooldown pós-envio: botão descansa com contagem regressiva ----------
 * O provedor tem rate limit agressivo. Depois de cada chamada real o botão
 * fica bloqueado por alguns segundos, com respiração suave e barra drenando —
 * comunica "aguarda um pouco" sem parecer erro. */
LizUI.setCooldownState = function(active, totalMs) {
  const btn = this.el.sendBtn;
  if (!btn) return;
  clearInterval(this._cooldownTick);

  if (active) {
    const endTime = Date.now() + totalMs;
    const update = () => {
      const rest = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      const label = 'Aguardando limite do provedor (' + rest + 's)';
      btn.setAttribute('aria-label', label);
      btn.setAttribute('title', label);
    };
    update();
    btn.classList.add('is-cooldown');
    btn.disabled = true;
    btn.style.setProperty('--cooldown-ms', totalMs + 'ms');
    this._cooldownTick = setInterval(() => {
      if (Date.now() >= endTime) clearInterval(this._cooldownTick);
      else update();
    }, 1000);
  } else {
    btn.classList.remove('is-cooldown');
    btn.removeAttribute('title');
    btn.setAttribute('aria-label', 'Enviar mensagem');
    btn.style.removeProperty('--cooldown-ms');
    this.updateSendState();
  }
};

// ===================== BOTÃO EXPORTAR =====================
LizUI.addExportButton = function() {
  if (this.el.exportBtn) return;
  const btn = document.createElement('button');
  btn.className = 'header-btn header-export-btn';
  btn.innerHTML = LizConfig.icons.download + ' Exportar';
  btn.setAttribute('aria-label', 'Exportar conversa');
  btn.addEventListener('click', () => { if (typeof LizChat !== 'undefined') LizChat.exportConversation(); });
  this.headerActions?.appendChild(btn);
  this.el.exportBtn = btn;
};

LizUI.removeExportButton = function() {
  if (this.el.exportBtn) { this.el.exportBtn.remove(); this.el.exportBtn = null; }
};
