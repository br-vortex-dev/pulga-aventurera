/* ============================================================
 *  Liz — settings.js
 *  Lógica do painel flutuante de ajustes (categorias, páginas)
 * ============================================================ */

const LizSettings = {
  /** Mostra painel flutuante de ajustes ao lado do menu */
  showFloatPanel(action) {
    const existing = document.getElementById('main-float-panel');
    if (existing && existing.classList.contains('is-visible') && existing.dataset.action === action) {
      this.hideFloatPanel();
      return;
    }
    const old = document.getElementById('main-float-panel');
    if (old) old.remove();

    LizUI._hideMainFloatPanel();
    LizUI.setActivePill(action);

    const panel = document.createElement('div');
    panel.id = 'main-float-panel';
    panel.className = 'liz-main-float-panel';
    panel.dataset.action = action;

    const titles = {
      conversations: 'Conversas recentes',
      settings: 'Ajustes',
      account: 'Conta',
    };
    const icons = {
      conversations: LizConfig.icons.chats || '',
      settings: LizConfig.icons.settings || '',
      account: LizConfig.icons.user || '',
    };
    const title = titles[action] || action;
    let bodyHtml = '';

    if (action === 'settings') {
      const cats = [
        { id: 'appearance', icon: 'sun', label: 'Aparência' },
        { id: 'notifications', icon: 'chats', label: 'Notificações' },
        { id: 'chat', icon: 'sparkle', label: 'Chat' },
        { id: 'history', icon: 'folder', label: 'Histórico' },
        { id: 'shortcuts', icon: 'code', label: 'Atalhos' },
        { id: 'memory', icon: 'filesMenu', label: 'Memória' },
        { id: 'account', icon: 'settings', label: 'Conta' },
        { id: 'language', icon: 'filter', label: 'Idioma e Região' },
      ];
      bodyHtml = '<div class="liz-float-settings" id="main-float-settings-hub">';
      cats.forEach((c) => {
        bodyHtml += '<button class="liz-float-set-btn" data-cat="' + c.id + '" type="button">' +
          '<span class="liz-float-set-ico">' + (LizConfig.icons[c.icon] || LizConfig.icons.sparkle) + '</span>' +
          '<span>' + c.label + '</span>' +
          '<span class="liz-float-set-arrow">' + (LizConfig.icons.continue || '') + '</span>' +
          '</button>';
      });
      bodyHtml += '</div>';
    }

    panel.innerHTML = '<div class="liz-float-head">' +
      '<span class="liz-float-title">' +
        '<span class="liz-float-title-ico">' + (icons[action] || '') + '</span>' + title +
      '</span>' +
      '<button class="liz-float-close" type="button">' + (LizConfig.icons.close || '×') + '</button>' +
      '</div>' +
      '<div class="liz-float-body">' + bodyHtml + '</div>';

    document.body.appendChild(panel);
    void panel.offsetHeight;
    panel.classList.add('is-visible');

    panel.querySelector('.liz-float-close').addEventListener('click', () => this.hideFloatPanel());
    panel.querySelectorAll('.liz-float-set-btn[data-cat]').forEach((btn) => {
      btn.addEventListener('click', () => this.showSettingsPage(btn.dataset.cat));
    });

    setTimeout(() => {
      const handler = (e) => {
        if (!panel.contains(e.target) && !e.target.closest('.float-pill')) {
          this.hideFloatPanel();
          document.removeEventListener('click', handler);
        }
      };
      document.addEventListener('click', handler);
      panel._outsideHandler = handler;
    }, 10);

    const escHandler = (e) => {
      if (e.key === 'Escape') { this.hideFloatPanel(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);
    panel._escHandler = escHandler;
  },

  hideFloatPanel() {
    const panel = document.getElementById('main-float-panel');
    if (!panel) return;
    panel.classList.remove('is-visible');
    if (panel._outsideHandler) document.removeEventListener('click', panel._outsideHandler);
    if (panel._escHandler) document.removeEventListener('keydown', panel._escHandler);
    LizUI.clearActivePill();
    setTimeout(() => panel.remove(), 260);
  },

  showSettingsPage(pageId) {
    const panel = document.getElementById('main-float-panel');
    if (!panel) return;
    const body = panel.querySelector('.liz-float-body');
    if (!body) return;

    const titles = {
      appearance: 'Aparência', notifications: 'Notificações', chat: 'Chat',
      history: 'Histórico', shortcuts: 'Atalhos', memory: 'Memória',
      account: 'Conta', language: 'Idioma e Região',
    };
    const title = titles[pageId] || pageId;

    setTimeout(() => {
      body.innerHTML = '<div class="settings-page-anim">' +
        '<div class="liz-float-settings-top">' +
        '<button class="liz-float-settings-back" type="button" aria-label="Voltar">' +
          (LizConfig.icons.continue || '←') +
        '</button>' +
        '<span class="liz-float-settings-page-title">' + title + '</span>' +
        '</div>' +
        this._getPageHTML(pageId) +
        '</div>';

      body.querySelector('.liz-float-settings-back').addEventListener('click', () => {
        // Anima saída: fade out rápido
        const animWrap = body.querySelector('.settings-page-anim');
        if (animWrap) animWrap.style.opacity = '0';

        setTimeout(() => {
          const cats = [
            { id: 'appearance', icon: 'sun', label: 'Aparência' },
            { id: 'notifications', icon: 'chats', label: 'Notificações' },
            { id: 'chat', icon: 'sparkle', label: 'Chat' },
            { id: 'history', icon: 'folder', label: 'Histórico' },
            { id: 'shortcuts', icon: 'code', label: 'Atalhos' },
            { id: 'memory', icon: 'filesMenu', label: 'Memória' },
            { id: 'account', icon: 'settings', label: 'Conta' },
            { id: 'language', icon: 'filter', label: 'Idioma e Região' },
          ];
          let html = '<div class="liz-float-settings" id="main-float-settings-hub">';
          cats.forEach((c, i) => {
            html += '<button class="liz-float-set-btn settings-cat-anim" data-cat="' + c.id + '" type="button" style="animation-delay:' + (i * 0.03) + 's">' +
              '<span class="liz-float-set-ico">' + (LizConfig.icons[c.icon] || LizConfig.icons.sparkle) + '</span>' +
              '<span>' + c.label + '</span>' +
              '<span class="liz-float-set-arrow">' + (LizConfig.icons.continue || '') + '</span>' +
              '</button>';
          });
          html += '</div>';
          body.innerHTML = html;
          body.querySelectorAll('.liz-float-set-btn[data-cat]').forEach((btn) => {
            btn.addEventListener('click', () => this.showSettingsPage(btn.dataset.cat));
          });
        }, 120);
      });

      this._bindPageActions(pageId, panel);
    }, 0);
  },

  /* ---------- Identidade do usuário (Firebase primeiro, depois storage) ---------- */
  _fbUser() {
    try {
      if (window.firebase && firebase.auth && firebase.auth().currentUser) return firebase.auth().currentUser;
    } catch (e) { /* SDK indisponível */ }
    return null;
  },
  _userName() {
    const f = this._fbUser();
    if (f && (f.displayName || f.email)) return f.displayName || f.email.split('@')[0];
    return localStorage.getItem('liz-user-name') || 'Você';
  },
  _userEmail() {
    const f = this._fbUser();
    if (f && f.email) return f.email;
    return localStorage.getItem('liz-user-email') || '';
  },
  _initial() {
    const n = this._userName().trim();
    return n ? n.charAt(0).toUpperCase() : '?';
  },

  /** Calcula uso real do localStorage e atualiza barra + texto */
  _renderMemoryUsage(panel) {
    const bar = panel.querySelector('#float-memory-bar-fill');
    const text = panel.querySelector('#float-memory-used-text');
    if (!bar || !text) return;
    let bytes = 0;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        bytes += (k.length + (localStorage.getItem(k) || '').length) * 2; // UTF-16
      }
    } catch (e) { /* storage indisponível */ }
    const LIMIT = 5 * 1024 * 1024;
    const pct = bytes === 0 ? 0 : Math.max(1, Math.min(100, Math.round((bytes / LIMIT) * 100)));
    bar.style.width = pct + '%';
    const kb = bytes / 1024;
    text.textContent = (kb < 1024 ? kb.toFixed(1) + ' KB' : (kb / 1024).toFixed(2) + ' MB') + ' usados';
  },
};

/* ------------------------------------------------------------
 * Mistura os módulos parciais no objeto principal.
 * A API pública (LizSettings) continua exatamente a mesma.
 * ------------------------------------------------------------ */
Object.assign(
  LizSettings,
  window.LizSettingsPages,
  window.LizSettingsBind
);

window.LizSettings = LizSettings;
