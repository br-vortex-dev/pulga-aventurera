/* ============================================================
 *  Liz — mural-render.js
 *  Renderização da lista: filtro/busca/ordenação, estado vazio e eventos das linhas.
 *  Módulo parcial: é misturado ao objeto principal pelo entrypoint.
 * ============================================================ */

window.LizMuralRender = {
  /* ---- Renderizar ---- */
  render: function() {
    LizData.loadUploadedFiles();
    let files = [...LizData.uploadedFiles];

    // Filtro
    if (this.filter !== 'all') {
      files = files.filter(f => this._getType(f) === this.filter);
    }

    // Busca
    if (this.search) {
      const q = this.search.toLowerCase();
      files = files.filter(f => (f.name||'').toLowerCase().includes(q));
    }

    // Ordenação
    const sortField = this.sortBy;
    const dir = this.sortDir === 'asc' ? 1 : -1;
    files.sort((a, b) => {
      let va, vb;
      if (sortField === 'name') { va = (a.name||'').toLowerCase(); vb = (b.name||'').toLowerCase(); return va < vb ? -dir : va > vb ? dir : 0; }
      if (sortField === 'date') { va = a.timestamp||0; vb = b.timestamp||0; return (va - vb) * dir; }
      if (sortField === 'type') { va = this._getType(a); vb = this._getType(b); return va < vb ? -dir : va > vb ? dir : 0; }
      if (sortField === 'size') { va = a.size||0; vb = b.size||0; return (va - vb) * dir; }
      return 0;
    });

    if (files.length === 0) {
      this._renderEmpty();
      return;
    }

    const viewClass = this.viewMode === 'grid' ? ' mural-grid-view' : '';
    let h = `<table class="mural-table${viewClass}">
      <thead><tr>
        <th class="col-name">Nome</th>
        <th class="col-date">Modificado</th>
        <th class="col-size">Tamanho</th>
      </tr></thead><tbody>`;

    files.forEach((f, i) => {
      const type = this._getType(f);
      const name = f.name || 'arquivo';
      const date = f.timestamp ? new Date(f.timestamp).toLocaleDateString('pt-BR') : '—';
      const size = this._formatSize(f.size);
      const icon = this._getIcon(type);
      const isImg = type === 'image';
      const selected = f.id === this.selectedId ? ' is-selected' : '';
      const tag = type !== 'file' ? '<span class="mural-file-tag">' + type + '</span>' : '';

      h += `<tr class="mural-row${selected}" data-id="${this._esc(f.id)}" data-type="${type}" style="animation-delay:${Math.min(i*30,500)}ms">
        <td class="col-name">
          <div class="mural-file-cell">
            <div class="mural-thumb">${isImg ? '<img src="'+(f.dataUrl||'')+'" alt=""'+((!f.dataUrl && f.uploadId) ? ' data-upload-id="'+this._esc(f.uploadId)+'"' : '')+' />' : '<span class="mural-thumb-icon">'+icon+'</span>'}</div>
            <div>
              <div class="mural-file-name">${this._esc(name)}</div>
              <div class="mural-file-info">${date} ${tag}</div>
            </div>
          </div>
        </td>
        <td class="col-date">${date}</td>
        <td class="col-size">${size}</td>
      </tr>`;
    });

    h += '</tbody></table>';
    this.body.innerHTML = h;
    if (typeof LizUI !== 'undefined' && LizUI.hydrateUploads) LizUI.hydrateUploads(this.body);
    this._bindRowEvents();
  },

  /* ---- Estado vazio ---- */
  _renderEmpty: function() {
    const hasFilters = this.filter !== 'all' || this.search;
    this.body.innerHTML = `
      <div class="mural-empty">
        <div class="mural-empty-icon">${this._icons.image}</div>
        <h2>${hasFilters ? 'Nenhum arquivo encontrado' : 'Nenhum arquivo guardado'}</h2>
        <p>${hasFilters ? 'Tente ajustar os filtros ou a pesquisa.' : 'Envie imagens para começar a preencher seu mural.'}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:center">
          ${!hasFilters ? '<button class="mural-empty-btn" id="mural-empty-upload" type="button">' + this._icons.upload + ' Enviar arquivos</button>' : ''}
          ${!hasFilters ? '<button class="mural-empty-btn" id="mural-empty-example" type="button" style="background:transparent;border-color:rgba(139,92,246,0.15);color:var(--mural-text-sec)">Carregar exemplos</button>' : ''}
        </div>
      </div>`;
    const btn = document.getElementById('mural-empty-upload');
    if (btn) btn.addEventListener('click', () => this._triggerUpload());
    const exBtn = document.getElementById('mural-empty-example');
    if (exBtn) exBtn.addEventListener('click', () => {
      // Cria 6 arquivos de exemplo (cores sólidas)
      const colors = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899'];
      const names = ['Design.webp','Dashboard.webp','Gráfico.webp','Mockup.webp','Logo.webp','App.webp'];
      colors.forEach((c, i) => {
        // Cria um SVG colorido como dataUrl
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="'+c+'"/><text x="200" y="160" text-anchor="middle" fill="rgba(255,255,255,0.3)" font-size="24" font-family="Inter,sans-serif">'+names[i]+'</text></svg>';
        LizData.saveUploadedFile({
          name: names[i],
          size: Math.floor(Math.random()*500000)+50000,
          type: 'image/webp',
          dataUrl: 'data:image/svg+xml;base64,'+btoa(svg),
          convTitle: 'Mural'
        });
      });
      this.render();
    });
  },

  /* ---- Eventos dos botões das linhas ---- */
  _bindRowEvents: function() {
    this.body.querySelectorAll('.mural-row').forEach(row => {
      row.addEventListener('click', (e) => {
        const id = row.dataset.id;
        if (!id) return;
        // Selecionar
        this.body.querySelectorAll('.mural-row.is-selected').forEach(r => r.classList.remove('is-selected'));
        row.classList.add('is-selected');
        this.selectedId = id;

        // Se for imagem, abrir visualizador; senão, abrir leitor de arquivos
        LizData.loadUploadedFiles();
        const file = LizData.uploadedFiles.find(f => f.id === id);
        if (file && file.type && file.type.startsWith('image/')) {
          this._openViewer(file);
        } else if (file) {
          this._openFileReader(file);
        }
      });

      // Clique direito
      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const id = row.dataset.id;
        this._openContextMenu(e.clientX, e.clientY, id);
      });
    });
  },
};
