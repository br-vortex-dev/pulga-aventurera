/* ============================================================
 *  Liz — ui-core.js
 *  Objeto base LizUI: cache de elementos, init, marca, utils
 * ============================================================ */

const LizUI = {
  el: {},
  activePanel: null,
  activePill: null,
  activeMode: null,
  _defaultPlaceholder: 'Digite sua mensagem para a Liz...',

  /* ---------- Inicialização (cache dos elementos) ---------- */
  init() {
    this.el = {
      emptyCrown: document.getElementById('empty-crown'),
      title: document.getElementById('chat-title'),
      status: document.getElementById('chat-status'),
      crownToggle: document.getElementById('crown-toggle'),
      themeToggle: document.getElementById('theme-toggle'),
      themeThumb: document.querySelector('.theme-toggle-thumb'),
      mobileMenuBtn: document.getElementById('mobile-menu-btn'),
      emptyState: document.getElementById('empty-state'),
      messagesList: document.getElementById('messages-list'),
      contentWrap: document.getElementById('content-wrap'),
      suggestions: document.getElementById('suggestions'),
      starters: document.getElementById('starters'),
      form: document.getElementById('chat-form'),
      input: document.getElementById('chat-input'),
      sendBtn: document.getElementById('send-btn'),
      attachBtn: document.getElementById('attach-btn'),
      websearchBtn: document.getElementById('websearch-btn'),
      overlay: document.getElementById('overlay'),
      panels: {
        conversations: document.getElementById('panel-conversations'),
      },
      conversationsContent: document.getElementById('conversations-content'),
      conversationsSearch: document.getElementById('conversations-search'),
      toast: document.getElementById('liz-toast'),
      fileInput: document.getElementById('file-input'),
      previewOverlay: document.getElementById('preview-overlay'),
      previewImg: document.getElementById('preview-img'),
      previewFilename: document.getElementById('preview-filename'),
      previewDownload: document.getElementById('preview-download'),
      previewClose: document.getElementById('preview-close'),
    };
  },

  /* ===========================================================
   * MARCA — injeta a coroa oficial na tela inicial
   * =========================================================== */
  renderBrand() {
    this.el.emptyCrown.innerHTML = LizConfig.crown;
    const iconMap = { new: 'newChat', conversations: 'chats', 'mural': 'gallery', settings: 'settings' };
    document.querySelectorAll('.float-pill[data-action]').forEach((pill) => {
      const ico = pill.querySelector('.float-pill-ico');
      if (ico) ico.innerHTML = LizConfig.icons[iconMap[pill.dataset.action]];
    });
    document.querySelectorAll('.panel-close span').forEach((s) => s.innerHTML = LizConfig.icons.close);
    const previewCloseIcon = document.querySelector('.preview-close-icon');
    if (previewCloseIcon) previewCloseIcon.innerHTML = LizConfig.icons.close;
    const searchIco = document.querySelector('.panel-search-ico');
    if (searchIco) searchIco.innerHTML = LizConfig.icons.search;
    if (this.el.attachBtn) this.el.attachBtn.querySelector('span').innerHTML = LizConfig.icons.attach;
    if (this.el.websearchBtn) this.el.websearchBtn.querySelector('span').innerHTML = LizConfig.icons.globe;
    if (this.el.sendBtn) this.el.sendBtn.querySelector('span').innerHTML = LizConfig.icons.send;
  },

  /* ===========================================================
   * UTILITÁRIOS
   * =========================================================== */
  _esc(str = '') {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },

  _setIcon(el, svg) {
    if (el) el.innerHTML = svg;
  },

  _formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  },

  _scrollToBottom() {
    requestAnimationFrame(() => {
      this.el.contentWrap.scrollTop = this.el.contentWrap.scrollHeight + 40;
    });
  },

  _safeImageUrl(value) {
    const raw = String(value || '').trim();
    if (/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(raw)) return raw;
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' ? url.toString() : '';
    } catch (_) {
      return '';
    }
  },

  _safeLinkUrl(value) {
    try {
      const url = new URL(String(value || '').trim());
      return url.protocol === 'https:' ? url.toString() : '';
    } catch (_) {
      return '';
    }
  },

  _markdown(text) {
    const placeholders = [];
    const token = (html) => {
      const marker = `\u0000LIZ_TOKEN_${placeholders.length}\u0000`;
      placeholders.push(html);
      return marker;
    };
    let source = String(text || '');
    var copyIcon = LizConfig.icons.copy;

    // Protege blocos de código antes de interpretar imagens, para que um
    // exemplo de Markdown dentro do código continue sendo apenas código.
    source = source.replace(/```(\w+)?\n?([\s\S]*?)```/g, function(_, lang, code) {
      var hasLang = lang ? true : false;
      var langLabel = lang || 'code';
      var header = '<div class="code-block-header">' +
        '<span class="code-block-lang">' + langLabel + '</span>' +
        '<button class="code-block-copy" type="button" data-copy-code>' + copyIcon + 'Copiar</button>' +
      '</div>';
      return token('<pre class="code-block' + (hasLang ? ' has-lang' : '') + '">' + header + '<code>' + this._esc(code).replace(/\n$/, '') + '</code></pre>');
    }.bind(this));

    source = source.replace(/!\[([^\]]{0,160})\]\((https:\/\/[^\s)]+|data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+)\)/gi, (match, alt, src) => {
      const safe = this._safeImageUrl(src);
      if (!safe) return match;
      return token('<img class="md-image" src="' + this._esc(safe) + '" alt="' + this._esc(alt || 'Imagem') + '" loading="lazy" />');
    });

    let html = this._esc(source);
    html = html.replace(/`([^`\n]+)`/g, '<code class="code-inline">$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\n/g, '<br>');
    placeholders.forEach((value, index) => {
      html = html.replace(`\u0000LIZ_TOKEN_${index}\u0000`, value);
    });
    return html;
  },

  updateSendState() {
    // Durante a geração o botão vira "Parar" e precisa continuar habilitado
    if (this._generating) { this.el.sendBtn.disabled = false; return; }
    this.el.sendBtn.disabled = this.el.input.value.trim().length === 0;
  },

  /* ===========================================================
   * HEADER ACTIONS REF
   * =========================================================== */
  get headerActions() {
    return document.querySelector('.header-actions');
  },

  /* ===========================================================
   * DRAG & DROP
   * =========================================================== */
  initDragDrop() {
    if (this.el.dragOverlay) return;
    const overlay = document.createElement('div');
    overlay.className = 'drag-overlay';
    overlay.innerHTML = '<div class="drag-overlay-content">' +
      '<span class="drag-overlay-icon">' + LizConfig.icons.upload + '</span>' +
      '<p class="drag-overlay-text">Solte o arquivo aqui</p>' +
      '<p class="drag-overlay-hint">Imagens, PDFs, documentos e código</p>' +
    '</div>';
    document.body.appendChild(overlay);
    this.el.dragOverlay = overlay;
  },

  showDragOverlay() {
    this.initDragDrop();
    this.el.dragOverlay.classList.add('is-visible-drag');
  },

  hideDragOverlay() {
    if (this.el.dragOverlay) this.el.dragOverlay.classList.remove('is-visible-drag');
  },

  triggerFilePicker() {
    if (this.el.fileInput) {
      this.el.fileInput.value = '';
      this.el.fileInput.click();
    }
  },
};

window.LizUI = LizUI;
