/* ============================================================
 *  Liz — mural.js
 *  Interface premium para visualização de arquivos
 * ============================================================ */

LizUI.mural = {
  overlay: null,
  container: null,
  body: null,
  files: [],
  filter: 'all',
  search: '',
  sortBy: 'name',
  sortDir: 'asc',
  viewMode: 'list', // 'list' | 'grid'
  selectedId: null,
  contextFileId: null,
  _esc: function(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); },

  /* ---- Ícones SVG ---- */
  _icons: {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
    list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>',
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>',
    upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>',
    file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
    sort: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5h10M11 12h7M11 19h4"/><path d="M3 5l3-3 3 3M9 19H3M3 12h6"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    zoomIn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    zoomOut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
    fullscreen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
  },

  /* ---- Inicialização ---- */
  init: function() {
    this.createOverlay();
    this.bindEvents();
  },

  /* ---- Criar overlay ---- */
  createOverlay: function() {
    if (this.overlay) return;
    const o = document.createElement('section');
    o.className = 'mural-overlay';
    o.id = 'mural-overlay';
    o.setAttribute('role', 'dialog');
    o.setAttribute('aria-modal', 'true');
    o.setAttribute('aria-label', 'Mural de Arquivos');
    o.innerHTML = `
      <div class="mural-header">
        <div class="mural-header-top">
          <div class="mural-header-left">
            <button class="mural-back-btn" id="mural-back" type="button" aria-label="Voltar">${this._icons.back}</button>
            <span class="mural-header-title">Mural</span>
          </div>
          <div class="mural-header-right">
            <button class="mural-header-btn" id="mural-view-toggle" type="button" aria-label="Alternar visualização" title="Alternar visualização">${this._icons.grid}</button>
            <button class="mural-header-btn" id="mural-menu-btn" type="button" aria-label="Menu" title="Menu">${this._icons.menu}</button>
          </div>
        </div>
        <div class="mural-filters" id="mural-filters">
          <button class="mural-filter is-active" data-filter="all">Tudo</button>
          <button class="mural-filter" data-filter="image">Imagens</button>
          <button class="mural-filter" data-filter="file">Arquivos</button>
          <button class="mural-filter" data-filter="video">Vídeos</button>
        </div>
        <div class="mural-toolbar">
          <div class="mural-search-wrap">
            <span class="mural-search-icon">${this._icons.search}</span>
            <input class="mural-search" id="mural-search" type="text" placeholder="Pesquisar no mural..." autocomplete="off" />
          </div>
          <div class="mural-sort" id="mural-sort-wrap">
            <button class="mural-sort-btn" id="mural-sort-btn" type="button">${this._icons.sort}<span>Nome</span></button>
            <div class="mural-sort-dropdown" id="mural-sort-dropdown">
              <button class="mural-sort-option is-active" data-sort="name">Nome</button>
              <button class="mural-sort-option" data-sort="date">Data</button>
              <button class="mural-sort-option" data-sort="type">Tipo</button>
              <button class="mural-sort-option" data-sort="size">Tamanho</button>
            </div>
          </div>
        </div>
      </div>
      <div class="mural-body" id="mural-body"></div>
    `;
    document.body.appendChild(o);
    this.overlay = o;
    this.container = o;
    this.body = o.querySelector('#mural-body');
  },

  /* ---- Abrir ---- */
  open: function() {
    if (!this.overlay) this.init();
    this.render();
    this.overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  },

  /* ---- Fechar ---- */
  close: function() {
    if (!this.overlay) return;
    this.overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    if (typeof this.onClose === 'function') this.onClose();
  },

  /* ---- Determinar tipo ---- */
  _getType: function(f) {
    if (!f || !f.type) return 'file';
    if (f.type.startsWith('image/')) return 'image';
    if (f.type.startsWith('video/')) return 'video';
    return 'file';
  },

  _getIcon: function(type) {
    return this._icons[type] || this._icons.file;
  },

  /* ---- Formatar tamanho ---- */
  _formatSize: function(bytes) {
    if (!bytes || bytes === 0) return '—';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0; let sz = bytes;
    while (sz >= 1024 && i < units.length - 1) { sz /= 1024; i++; }
    return sz.toFixed(i === 0 ? 0 : 1) + ' ' + units[i];
  },

  /* ---- Garante o conteúdo do arquivo ----
   * Arquivo enviado pro storage do backend (uploadId) pode não ter
   * dataUrl local — baixa sob demanda antes de abrir/baixar/copiar. */
  _ensureDataUrl: async function(file) {
    if (!file) return false;
    if (file.dataUrl) return true;
    if (!file.uploadId || typeof LizAPI === 'undefined') return false;
    try {
      file.dataUrl = await LizAPI.getUploadDataUrl(file.uploadId);
      return Boolean(file.dataUrl);
    } catch (e) {
      return false;
    }
  },
};

/* ------------------------------------------------------------
 * Mistura os módulos parciais no objeto do mural.
 * A API pública (LizUI.mural) continua exatamente a mesma.
 * ------------------------------------------------------------ */
Object.assign(
  LizUI.mural,
  window.LizMuralViewers,
  window.LizMuralRender,
  window.LizMuralContext,
  window.LizMuralUpload,
  window.LizMuralEvents
);
