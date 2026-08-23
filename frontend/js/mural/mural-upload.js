/* ============================================================
 *  Liz — mural-upload.js
 *  Upload pelo mural: seleção de arquivos, progresso e cancelamento.
 *  Módulo parcial: é misturado ao objeto principal pelo entrypoint.
 * ============================================================ */

window.LizMuralUpload = {
  /* ---- Upload ---- */
  _triggerUpload: function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.pdf,.doc,.docx,.txt,.csv,.json,.js,.ts,.py,.html,.css,.md,.mp3,.wav,.mp4';
    input.onchange = (e) => {
      this._handleUpload(e.target.files);
      input.value = '';
    };
    input.click();
  },

  _handleUpload: function(files) {
    const MAX = 10 * 1024 * 1024;
    const valid = [];
    for (const f of files) { if (f.size <= MAX) valid.push(f); }
    if (!valid.length) return;

    // Mostrar overlay de progresso
    if (!this._uploadOverlay) {
      this._uploadOverlay = document.createElement('div');
      this._uploadOverlay.className = 'mural-upload-overlay';
      this._uploadOverlay.innerHTML = '<div class="mural-upload-card" id="mural-upload-card"></div>';
      document.body.appendChild(this._uploadOverlay);
    }
    const card = this._uploadOverlay.querySelector('#mural-upload-card');
    card.innerHTML = '';
    const total = valid.length;
    let completed = 0;

    valid.forEach((file) => {
      const item = document.createElement('div');
      item.className = 'mural-upload-item';
      item.innerHTML = `
        <span class="mural-upload-icon">${this._icons.file}</span>
        <div class="mural-upload-info">
          <div class="mural-upload-name">${this._esc(file.name)}</div>
          <div class="mural-upload-progress">
            <div class="mural-upload-bar"><div class="mural-upload-bar-fill" id="uf-${this._esc(file.name)}"></div></div>
            <span class="mural-upload-pct" id="up-${this._esc(file.name)}">0%</span>
          </div>
        </div>
        <button class="mural-upload-cancel" data-file="${this._esc(file.name)}">${this._icons.close}</button>
      `;
      card.appendChild(item);

      const reader = new FileReader();
      // Cancelar upload: aborta a leitura e remove o item da lista
      const cancelBtn = item.querySelector('.mural-upload-cancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          try { reader.abort(); } catch (e) { /* já finalizado */ }
          item.remove();
          completed++;
          if (completed === total) {
            this._uploadOverlay.classList.remove('is-open');
            this.render();
          }
        });
      }
      reader.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          const bar = document.getElementById('uf-' + this._esc(file.name));
          const pctEl = document.getElementById('up-' + this._esc(file.name));
          if (bar) bar.style.width = pct + '%';
          if (pctEl) pctEl.textContent = pct + '%';
        }
      };
      reader.onload = (e) => {
        LizData.saveUploadedFile({
          name: file.name,
          size: file.size,
          type: file.type,
          dataUrl: e.target.result,
          timestamp: Date.now()
        });
        completed++;
        if (completed === total) {
          this._uploadOverlay.classList.remove('is-open');
          this.render();
        }
      };
      reader.readAsDataURL(file);
    });

    this._uploadOverlay.classList.add('is-open');
  },
};
