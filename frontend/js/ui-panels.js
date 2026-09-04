/* ============================================================
 *  Liz — ui-panels.js
 *  Painéis modais, menu pills, tema, settings count/memory
 * ============================================================ */

// ===================== MENU PILLS =====================
// Ao desativar, o pill ganha .is-deactivating por um instante pra barra
// ativa encolher suave em vez de sumir do nada quando o painel fecha.
LizUI._deactivatePill = function(p) {
  p.classList.remove('is-deactivating');
  void p.offsetWidth;
  p.classList.add('is-deactivating');
  setTimeout(() => p.classList.remove('is-deactivating'), 350);
};

LizUI.setActivePill = function(action) {
  document.querySelectorAll('.float-pill[data-action]').forEach((p) => {
    const on = p.dataset.action === action;
    if (!on && p.classList.contains('is-active')) this._deactivatePill(p);
    p.classList.toggle('is-active', on);
  });
  this.activePill = action;
};

LizUI.clearActivePill = function() {
  document.querySelectorAll('.float-pill[data-action]').forEach((p) => {
    if (p.classList.contains('is-active')) this._deactivatePill(p);
    p.classList.remove('is-active');
  });
  this.activePill = null;
};

// ===================== COROA TOGGLE =====================
LizUI._pulseMainCrown = function() {
  this.el.crownToggle.classList.remove('is-pulsing');
  void this.el.crownToggle.offsetWidth;
  this.el.crownToggle.classList.add('is-pulsing');
};

LizUI.toggleTools = function() {
  if (window.matchMedia('(max-width: 700px)').matches) return;
  const menu = document.getElementById('floating-menu');
  const app = document.querySelector('.chat-app');
  if (!menu || !app) return;
  this._hideMainFloatPanel();
  this._pulseMainCrown();
  const willCollapse = !menu.classList.contains('is-collapsed');
  if (willCollapse) {
    menu.classList.remove('is-expanded'); menu.classList.add('is-collapsed');
    app.classList.add('is-menu-collapsed');
  } else {
    menu.classList.remove('is-collapsed'); menu.classList.add('is-expanded');
    app.classList.remove('is-menu-collapsed');
  }
  this.el.crownToggle.setAttribute('aria-expanded', String(!willCollapse));
};

// ===================== PAINÉIS MODAIS =====================
LizUI.openPanel = function(name) {
  const panel = this.el.panels[name];
  if (!panel) return;
  if (this._closePanelTimer) { clearTimeout(this._closePanelTimer); this._closePanelTimer = null; }
  this.closePanel();
  this.activePanel = name;
  panel.classList.remove('is-closing');
  this.el.overlay.classList.remove('is-closing');
  this.el.overlay.classList.add('is-visible');
  panel.classList.add('is-open');
  panel.setAttribute('aria-hidden', 'false');
  this.setActivePill(name);
};

LizUI.closePanel = function() {
  this._hideMainFloatPanel();
  if (!this.activePanel) return;
  if (this._closePanelTimer) { clearTimeout(this._closePanelTimer); this._closePanelTimer = null; }
  const panel = this.el.panels[this.activePanel];
  if (panel) {
    panel.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    this.el.overlay.classList.remove('is-visible');
    if (!panel.classList.contains('panel-fullscreen')) {
      panel.classList.add('is-closing');
      this.el.overlay.classList.add('is-closing');
    }
    this._closePanelTimer = setTimeout(() => {
      panel.classList.remove('is-closing');
      this.el.overlay.classList.remove('is-closing');
      this._closePanelTimer = null;
    }, 280);
  } else {
    this.el.overlay.classList.remove('is-visible');
  }
  this.activePanel = null;
  this.clearActivePill();
};

// ===================== MAIN FLOAT PANEL =====================
LizUI._showMainFloatPanel = function(action) {
  const existing = document.getElementById('main-float-panel');
  if (existing && existing.classList.contains('is-visible') && existing.dataset.action === action) { this._hideMainFloatPanel(); return; }
  const old = document.getElementById('main-float-panel');
  if (old) old.remove();
  this.setActivePill(action);
  const panel = document.createElement('div');
  panel.id = 'main-float-panel';
  panel.className = 'liz-main-float-panel';
  panel.dataset.action = action;
  const titles = { conversations: 'Conversas recentes', settings: 'Ajustes' };
  const icons = { conversations: LizConfig.icons.chats || '', settings: LizConfig.icons.settings || '' };
  const title = titles[action] || action;
  let bodyHtml = '';
  if (action === 'conversations') {
    const groups = typeof LizData.getConversationGroups === 'function' ? LizData.getConversationGroups() : [];
    if (!groups.length || !groups[0].items.length) {
      bodyHtml = '<div class="liz-float-empty">Nenhuma conversa ainda</div>';
    } else {
      bodyHtml = '<div class="liz-float-convs">';
      groups.forEach((g) => g.items.forEach((item) => {
        const pinned = !!item.pinned;
        bodyHtml += '<div class="liz-float-conv" data-id="' + this._esc(item.id) + '" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 10px;border-radius:6px;transition:background 0.15s">' +
          '<span class="liz-float-conv-ico">' + (LizConfig.icons.chats || '') + '</span>' +
          '<span class="liz-float-conv-title" style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:4px">' +
            (pinned ? '<span style="color:#a78bfa;font-size:0.7rem;display:flex"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="none"><path d="M12 17v5M9 3h6l1 7 2 2H6l2-2 1-7z"/></svg></span>' : '') +
            this._esc(item.title) +
          '</span>' +
          '<button class="float-conv-act" data-act="pin" data-id="' + item.id + '" aria-label="' + (pinned ? 'Desfixar' : 'Fixar') + '" title="' + (pinned ? 'Desfixar' : 'Fixar') + '" style="width:24px;height:24px;border-radius:4px;border:none;background:transparent;color:var(--color-text-muted);opacity:0.6;cursor:pointer">' + (pinned ? '<svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" stroke="none" style="color:#a78bfa"><path d="M12 17v5M9 3h6l1 7 2 2H6l2-2 1-7z"/></svg>' : '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M9 3h6l1 7 2 2H6l2-2 1-7z"/></svg>') + '</button>' +
          '<button class="float-conv-act" data-act="rename" data-id="' + item.id + '" aria-label="Renomear" title="Renomear" style="width:24px;height:24px;border-radius:4px;border:none;background:transparent;color:var(--color-text-muted);opacity:0.6;cursor:pointer"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
          '<button class="float-conv-act" data-act="delete" data-id="' + item.id + '" aria-label="Excluir" title="Excluir" style="width:24px;height:24px;border-radius:4px;border:none;background:transparent;color:var(--color-text-muted);opacity:0.6;cursor:pointer"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        '</div>';
      }));
      bodyHtml += '</div>';
    }
  }
  panel.innerHTML = '<div class="liz-float-head"><span class="liz-float-title"><span class="liz-float-title-ico">' + (icons[action] || '') + '</span>' + title + '</span>' +
    '<button class="liz-float-close" type="button">' + (LizConfig.icons.close || '×') + '</button></div><div class="liz-float-body">' + bodyHtml + '</div>';
  document.body.appendChild(panel);
  void panel.offsetHeight;
  panel.classList.add('is-visible');
  panel.querySelector('.liz-float-close').addEventListener('click', () => this._hideMainFloatPanel());
  setTimeout(() => {
    const handler = (e) => {
      if (!panel.contains(e.target) && !e.target.closest('.float-pill')) { this._hideMainFloatPanel(); document.removeEventListener('click', handler); }
    };
    document.addEventListener('click', handler);
    panel._outsideHandler = handler;
  }, 10);
  const escHandler = (e) => { if (e.key === 'Escape') { this._hideMainFloatPanel(); document.removeEventListener('keydown', escHandler); } };
  document.addEventListener('keydown', escHandler);
  panel._escHandler = escHandler;

  // Event delegation para conversas no float panel
  if (action === 'conversations') {
    panel.addEventListener('click', (e) => {
      const actBtn = e.target.closest('.float-conv-act');
      const conv = e.target.closest('.liz-float-conv');
      if (!conv) return;
      const convId = conv.dataset.id;

      if (actBtn) {
        e.stopPropagation();
        const act = actBtn.dataset.act;
        if (act === 'pin') {
          LizData.togglePinConversation(convId);
          this._hideMainFloatPanel();
          setTimeout(() => this._showMainFloatPanel('conversations'), 300);
        } else if (act === 'rename') {
          const c = LizData.getConversationById(convId);
          if (c) {
            const v = prompt('Novo título da conversa:', c.title);
            if (v && v.trim() && LizData.renameConversation(convId, v)) {
              this._hideMainFloatPanel();
              setTimeout(() => this._showMainFloatPanel('conversations'), 300);
            }
          }
        } else if (act === 'delete') {
          const c = LizData.getConversationById(convId);
          if (c && confirm('Excluir "' + c.title + '"? Essa ação não pode ser desfeita.')) {
            LizData.deleteConversation(convId);
            this._hideMainFloatPanel();
            setTimeout(() => this._showMainFloatPanel('conversations'), 300);
          }
        }
        return;
      }

      // Abrir conversa
      const savedConv = LizData.getConversationById(convId);
      if (savedConv) {
        this._hideMainFloatPanel();
        if (typeof LizChat !== 'undefined') LizChat.openConversationById(savedConv.id);
      }
    });
  }
};

LizUI._hideMainFloatPanel = function() {
  const panel = document.getElementById('main-float-panel');
  if (!panel) return;
  panel.classList.remove('is-visible');
  if (panel._outsideHandler) document.removeEventListener('click', panel._outsideHandler);
  if (panel._escHandler) document.removeEventListener('keydown', panel._escHandler);
  this.clearActivePill();
  setTimeout(() => panel.remove(), 260);
};

// ===================== RENDER PANELS =====================
LizUI.renderPanels = function() {
  this._renderConversations('');
  this._syncThemeSegmented();
  this._initSettingsEvents();
};

LizUI._renderConversations = function(filter) {
  const f = filter.trim().toLowerCase();
  let html = '';
  var groups = (typeof LizData.getConversationGroups === 'function') ? LizData.getConversationGroups() : LizData.conversationGroups;
  groups.forEach((group) => {
    const items = group.items.filter((it) => it.title.toLowerCase().includes(f) || it.preview.toLowerCase().includes(f));
    if (!items.length) return;
    html += '<p class="panel-group-title">' + this._esc(group.period) + '</p>';
    items.forEach((it) => {
      const pinned = !!it.pinned;
      html += '<div class="conv-card" data-id="' + this._esc(it.id) + '">' +
        '<div style="flex:1;min-width:0"><div class="conv-card-title" style="display:flex;align-items:center;gap:5px">' + (pinned ? '<span style="color:var(--color-brand-light);display:flex"><svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none"><path d="M12 17v5M9 3h6l1 7 2 2H6l2-2 1-7z"/></svg></span>' : '') + this._esc(it.title) + '</div><div class="conv-card-preview">' + this._esc(it.preview) + '</div></div>' +
        '<div style="display:flex;gap:2px;flex-shrink:0">' +
          '<button class="conv-act" data-act="pin" data-id="' + this._esc(it.id) + '" aria-label="' + (pinned ? 'Desfixar' : 'Fixar') + '" title="' + (pinned ? 'Desfixar' : 'Fixar') + '">' + (pinned ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" stroke="none" style="color:var(--color-brand-light)"><path d="M12 17v5M9 3h6l1 7 2 2H6l2-2 1-7z"/></svg>' : '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 17v5M9 3h6l1 7 2 2H6l2-2 1-7z"/></svg>') + '</button>' +
          '<button class="conv-act" data-act="rename" data-id="' + this._esc(it.id) + '" aria-label="Renomear" title="Renomear"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>' +
          '<button class="conv-act" data-act="delete" data-id="' + this._esc(it.id) + '" aria-label="Excluir" title="Excluir"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        '</div></div>';
    });
  });
  if (!html) html = '<p class="panel-group-title">Nenhuma conversa encontrada.</p>';
  this.el.conversationsContent.innerHTML = html;
};

// ===================== TEMA =====================
LizUI.initTheme = function() {
  const stored = localStorage.getItem(LizConfig.theme.storageKey) || LizConfig.theme.default;
  const effective = stored === 'auto' ? this._systemTheme() : stored;
  this.setTheme(effective, false);
  localStorage.setItem(LizConfig.theme.storageKey, stored);
  this.el.themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const nextTheme = current === 'dark' ? 'light' : 'dark';
    if (document.startViewTransition) {
      document.startViewTransition(() => { this.setTheme(nextTheme, true); });
    } else {
      const root = document.documentElement;
      root.classList.remove('theme-morphing');
      void root.offsetWidth;
      root.classList.add('theme-morphing');
      this.setTheme(nextTheme, true);
      setTimeout(() => root.classList.remove('theme-morphing'), 850);
    }
  });
  if (stored === 'auto') this._watchSystemTheme();
};

LizUI.setTheme = function(theme, persist) {
  document.documentElement.setAttribute('data-theme', theme);
  // Atualiza a cor da barra de endereço no mobile
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#050505' : '#faf5f0');
  if (persist !== false) localStorage.setItem(LizConfig.theme.storageKey, theme);
  const isDark = theme === 'dark';
  const thumb = this.el.themeThumb || document.querySelector('.theme-toggle-thumb');
  if (thumb) {
    thumb.innerHTML = isDark
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    thumb.style.transform = `translateX(${isDark ? 0 : 24}px) rotate(${isDark ? 0 : 180}deg)`;
    thumb.style.background = isDark ? '#8b5cf6' : '#f59e0b';
  }
  this.el.themeToggle.setAttribute('aria-label', theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro');
  this._syncThemeSegmented();
};

LizUI._systemTheme = function() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
};

LizUI._watchSystemTheme = function() {
  this._unwatchSystemTheme();
  this._themeMedia = window.matchMedia('(prefers-color-scheme: light)');
  this._themeHandler = (e) => {
    if (localStorage.getItem(LizConfig.theme.storageKey) === 'auto') {
      const theme = e.matches ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', theme);
    }
  };
  this._themeMedia.addEventListener('change', this._themeHandler);
};

LizUI._unwatchSystemTheme = function() {
  if (this._themeMedia && this._themeHandler) { this._themeMedia.removeEventListener('change', this._themeHandler); }
  this._themeMedia = null;
  this._themeHandler = null;
};

LizUI._syncThemeSegmented = function() {
  const stored = localStorage.getItem(LizConfig.theme.storageKey) || LizConfig.theme.default;
  document.querySelectorAll('.seg-btn[data-theme-val]').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.themeVal === stored);
  });
};

// ===================== SETTINGS EVENTS =====================
LizUI._initSettingsEvents = function() {
  this._restoreNewSettings();
};

LizUI._restoreNewSettings = function() {
  const savedFontSize = localStorage.getItem('liz-font-size');
  if (savedFontSize) document.documentElement.setAttribute('data-font-size', savedFontSize);
  const savedDensity = localStorage.getItem('liz-density');
  if (savedDensity) document.documentElement.setAttribute('data-density', savedDensity);
  const savedAccent = localStorage.getItem('liz-accent-color');
  if (savedAccent) document.documentElement.style.setProperty('--color-brand', savedAccent);
  const savedCodeFont = localStorage.getItem('liz-code-font');
  if (savedCodeFont) document.documentElement.setAttribute('data-code-font', savedCodeFont);
};


