/* ============================================================
 *  Liz — mural-events.js
 *  Eventos globais do mural: voltar, filtros, pesquisa, ordenação, visualização e ESC.
 *  Módulo parcial: é misturado ao objeto principal pelo entrypoint.
 * ============================================================ */

window.LizMuralEvents = {
  /* ---- Eventos globais ---- */
  bindEvents: function() {
    // Botão voltar
    this.overlay.querySelector('#mural-back').addEventListener('click', () => this.close());

    // Filtros
    this.overlay.querySelectorAll('.mural-filter').forEach(btn => {
      btn.addEventListener('click', () => {
        this.overlay.querySelectorAll('.mural-filter').forEach(b => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        this.filter = btn.dataset.filter;
        this.render();
      });
    });

    // Pesquisa
    this.overlay.querySelector('#mural-search').addEventListener('input', (e) => {
      this.search = e.target.value;
      // Debounce
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => this.render(), 200);
    });

    // Ordenação
    this.overlay.querySelector('#mural-sort-btn').addEventListener('click', () => {
      document.getElementById('mural-sort-dropdown').classList.toggle('is-open');
    });
    this.overlay.querySelectorAll('.mural-sort-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const sort = opt.dataset.sort;
        if (this.sortBy === sort) {
          this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortBy = sort;
          this.sortDir = 'asc';
        }
        this.overlay.querySelectorAll('.mural-sort-option').forEach(o => o.classList.remove('is-active'));
        opt.classList.add('is-active');
        document.getElementById('mural-sort-dropdown').classList.remove('is-open');
        document.querySelector('#mural-sort-btn span').textContent = opt.textContent;
        this.render();
      });
    });

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', (e) => {
      const wrap = document.getElementById('mural-sort-wrap');
      if (wrap && !wrap.contains(e.target)) {
        document.getElementById('mural-sort-dropdown')?.classList.remove('is-open');
      }
    });

    // Alternar visualização
    document.getElementById('mural-view-toggle').addEventListener('click', () => {
      this.viewMode = this.viewMode === 'list' ? 'grid' : 'list';
      document.getElementById('mural-view-toggle').innerHTML = this.viewMode === 'list' ? this._icons.grid : this._icons.list;
      this.render();
    });

    // ESC para fechar
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay && this.overlay.classList.contains('is-open')) {
        this.close();
      }
    });
  }
};
