/* ============================================================
 *  Liz — mural-viewers.js
 *  Visualizadores: leitor de imagens (zoom/tela cheia) e leitor de arquivos (PDF/texto/binário).
 *  Módulo parcial: é misturado ao objeto principal pelo entrypoint.
 * ============================================================ */

window.LizMuralViewers = {
  /* ---- Visualizador de Imagem ---- */
  _openViewer: async function(file) {
    if (!file) return;
    if (!(await this._ensureDataUrl(file))) return;
    this._closeViewer();
    this._viewerFile = file;
    this._viewerZoom = 1;

    const viewer = document.createElement('div');
    viewer.className = 'mural-viewer';
    viewer.id = 'mural-viewer';
    viewer.innerHTML = `
      <div class="mural-viewer-bg" id="mural-viewer-bg"></div>
      <img class="mural-viewer-img" id="mural-viewer-img" src="${file.dataUrl}" alt="${this._esc(file.name||'')}" />
      <div class="mural-viewer-controls">
        <button class="mural-viewer-btn" id="mv-zoom-in" type="button" aria-label="Aumentar zoom" title="Aumentar zoom">${this._icons.zoomIn}</button>
        <button class="mural-viewer-btn" id="mv-zoom-out" type="button" aria-label="Diminuir zoom" title="Diminuir zoom">${this._icons.zoomOut}</button>
        <button class="mural-viewer-btn" id="mv-fullscreen" type="button" aria-label="Tela cheia" title="Tela cheia">${this._icons.fullscreen}</button>
        <button class="mural-viewer-btn" id="mv-download" type="button" aria-label="Baixar" title="Baixar">${this._icons.download}</button>
        <button class="mural-viewer-btn" id="mv-share" type="button" aria-label="Compartilhar" title="Compartilhar">${this._icons.share}</button>
        <button class="mural-viewer-btn mural-viewer-btn-close" id="mv-close" type="button" aria-label="Fechar" title="Fechar">${this._icons.close}</button>
      </div>
      <div class="mural-viewer-info" id="mural-viewer-info">${this._esc(file.name||'')}</div>
    `;
    document.body.appendChild(viewer);
    requestAnimationFrame(() => viewer.classList.add('is-open'));

    // Eventos
    const img = viewer.querySelector('#mural-viewer-img');
    const bg = viewer.querySelector('#mural-viewer-bg');

    document.getElementById('mv-close').addEventListener('click', () => this._closeViewer());
    bg.addEventListener('click', () => this._closeViewer());

    document.getElementById('mv-zoom-in').addEventListener('click', () => {
      this._viewerZoom = Math.min(3, this._viewerZoom + 0.25);
      img.style.transform = 'scale(' + this._viewerZoom + ')';
      img.classList.toggle('is-zoomed', this._viewerZoom > 1);
    });
    document.getElementById('mv-zoom-out').addEventListener('click', () => {
      this._viewerZoom = Math.max(0.25, this._viewerZoom - 0.25);
      img.style.transform = 'scale(' + this._viewerZoom + ')';
      img.classList.toggle('is-zoomed', this._viewerZoom > 1);
    });

    document.getElementById('mv-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen();
      } else {
        document.exitFullscreen();
      }
    });

    document.getElementById('mv-download').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = file.dataUrl;
      a.download = file.name || 'imagem';
      a.click();
    });

    document.getElementById('mv-share').addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({ title: file.name || 'Imagem', url: file.dataUrl });
      }
    });

    // ESC
    this._viewerEscHandler = (e) => { if (e.key === 'Escape') this._closeViewer(); };
    document.addEventListener('keydown', this._viewerEscHandler);
  },

  _closeViewer: function() {
    const viewer = document.getElementById('mural-viewer');
    if (!viewer) return;
    viewer.classList.remove('is-open');
    viewer.classList.add('is-closing');
    if (this._viewerEscHandler) {
      document.removeEventListener('keydown', this._viewerEscHandler);
      this._viewerEscHandler = null;
    }
    setTimeout(() => { if (viewer.parentNode) viewer.remove(); }, 280);
  },

  /* ============================================================
   * LEITOR DE ARQUIVOS — texto, código, PDF e binários
   * ============================================================ */

  /* ---- Auxiliar: converte dataUrl em bytes ---- */
  _dataUrlToBytes: function(dataUrl) {
    try {
      const b64 = String(dataUrl).split(',')[1] || '';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch (e) {
      return new Uint8Array(0);
    }
  },

  /* ---- Descobre se o arquivo é texto legível ---- */
  _isTextFile: function(file) {
    if (!file || !file.name && !file.type) return false;
    const type = String(file.type || '').toLowerCase();
    const name = String(file.name || '').toLowerCase();
    if (type.startsWith('text/')) return true;
    if (type === 'application/json' || type === 'application/xml' ||
        type === 'application/javascript' || type === 'application/x-javascript' ||
        type === 'application/x-httpd-php' || type === 'application/x-sh') return true;
    return /\.(txt|log|md|csv|json|js|mjs|cjs|ts|tsx|jsx|py|html|htm|css|scss|xml|yml|yaml|sh|bat|cmd|sql|ini|conf|cfg|env|gitignore|dockerfile|vue|svelte|php|rb|go|rs|java|c|h|cpp|hpp|lua|r|ps1)$/.test(name);
  },

  /* ---- Abre um arquivo no leitor ---- */
  _openFileReader: async function(file) {
    if (!file) return;
    if (!(await this._ensureDataUrl(file))) return;
    this._closeFileReader();
    this._readerFile = file;
    this._readerObjectUrl = null;

    const isPdf = String(file.type || '').toLowerCase() === 'application/pdf' ||
                  /\.pdf$/i.test(String(file.name || ''));
    const isText = this._isTextFile(file);

    // Monta URL de objeto (para PDF / abrir em nova aba)
    const bytes = this._dataUrlToBytes(file.dataUrl);
    if (bytes.length) {
      const mime = file.type || 'application/octet-stream';
      const blob = new Blob([bytes], { type: mime });
      this._readerObjectUrl = URL.createObjectURL(blob);
    }

    const reader = document.createElement('div');
    reader.className = 'mural-reader';
    reader.id = 'mural-reader';
    const name = this._esc(file.name || 'arquivo');
    const meta = `${this._esc(file.type || 'arquivo')} · ${this._formatSize(file.size)}`;

    reader.innerHTML = `
      <div class="mural-reader-bg" id="mural-reader-bg"></div>
      <div class="mural-reader-panel">
        <header class="mural-reader-head">
          <div class="mural-reader-head-info">
            <div class="mural-reader-name" id="mural-reader-name">${name}</div>
            <div class="mural-reader-meta" id="mural-reader-meta">${meta}</div>
          </div>
          <div class="mural-reader-actions">
            <button class="mural-viewer-btn" id="mr-copy" type="button" aria-label="Copiar" title="Copiar">${this._icons.file}</button>
            <button class="mural-viewer-btn" id="mr-open" type="button" aria-label="Abrir em nova aba" title="Abrir em nova aba">${this._icons.fullscreen}</button>
            <button class="mural-viewer-btn" id="mr-download" type="button" aria-label="Baixar" title="Baixar">${this._icons.download}</button>
            <button class="mural-viewer-btn mural-viewer-btn-close" id="mr-close" type="button" aria-label="Fechar" title="Fechar">${this._icons.close}</button>
          </div>
        </header>
        <div class="mural-reader-body" id="mural-reader-body"></div>
      </div>
    `;
    document.body.appendChild(reader);
    requestAnimationFrame(() => reader.classList.add('is-open'));

    // Eventos
    const bg = reader.querySelector('#mural-reader-bg');
    document.getElementById('mr-close').addEventListener('click', () => this._closeFileReader());
    bg.addEventListener('click', () => this._closeFileReader());

    document.getElementById('mr-open').addEventListener('click', () => {
      if (this._readerObjectUrl) window.open(this._readerObjectUrl, '_blank');
      else window.open(file.dataUrl, '_blank');
    });

    document.getElementById('mr-download').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = this._readerObjectUrl || file.dataUrl;
      a.download = file.name || 'arquivo';
      a.click();
    });

    document.getElementById('mr-copy').addEventListener('click', () => {
      const el = document.getElementById('mural-reader-text');
      if (!el) return;
      const text = el.innerText;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).catch(() => {});
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
    });

    // ESC
    this._readerEscHandler = (e) => { if (e.key === 'Escape') this._closeFileReader(); };
    document.addEventListener('keydown', this._readerEscHandler);

    // Conteúdo conforme o tipo
    const body = reader.querySelector('#mural-reader-body');

    if (isPdf && this._readerObjectUrl) {
      const iframe = document.createElement('iframe');
      iframe.className = 'mural-reader-frame';
      iframe.src = this._readerObjectUrl;
      iframe.setAttribute('title', file.name || 'arquivo');
      body.appendChild(iframe);
      document.getElementById('mr-copy').style.display = 'none';
      return;
    }

    if (isText) {
      const bytes2 = this._dataUrlToBytes(file.dataUrl);
      let text = '';
      try {
        text = new TextDecoder('utf-8').decode(bytes2);
      } catch (e) {
        text = '';
      }
      const pre = document.createElement('pre');
      pre.className = 'mural-reader-text';
      pre.id = 'mural-reader-text';
      pre.textContent = text;
      body.appendChild(pre);
      return;
    }

    // Tipo não suportado para leitura direta
    document.getElementById('mr-copy').style.display = 'none';
    const uns = document.createElement('div');
    uns.className = 'mural-reader-unsupported';
    uns.innerHTML = `
      <div class="mural-reader-unsupported-icon">${this._icons.file}</div>
      <h3>Este tipo de arquivo não pode ser visualizado aqui</h3>
      <p>Você pode baixá-lo ou abri-lo em nova aba.</p>
    `;
    body.appendChild(uns);
  },

  _closeFileReader: function() {
    const reader = document.getElementById('mural-reader');
    if (!reader) return;
    reader.classList.remove('is-open');
    reader.classList.add('is-closing');
    if (this._readerEscHandler) {
      document.removeEventListener('keydown', this._readerEscHandler);
      this._readerEscHandler = null;
    }
    if (this._readerObjectUrl) {
      URL.revokeObjectURL(this._readerObjectUrl);
      this._readerObjectUrl = null;
    }
    setTimeout(() => { if (reader.parentNode) reader.remove(); }, 280);
  },
};
