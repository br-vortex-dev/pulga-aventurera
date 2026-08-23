/* ============================================================
 *  Liz — mural-context.js
 *  Menu de contexto (clique direito): abrir, renomear, compartilhar, copiar, baixar e excluir.
 *  Módulo parcial: é misturado ao objeto principal pelo entrypoint.
 * ============================================================ */

window.LizMuralContext = {
  /* ---- Menu de contexto ---- */
  _openContextMenu: function(x, y, fileId) {
    this._closeContextMenu();
    this.contextFileId = fileId;

    const menu = document.createElement('div');
    menu.className = 'mural-context';
    menu.id = 'mural-context';
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.innerHTML = `
      <button class="mural-context-item" data-action="open">${this._icons.image}<span>Abrir</span></button>
      <button class="mural-context-item" data-action="preview">${this._icons.search}<span>Visualizar</span></button>
      <div class="mural-context-divider"></div>
      <button class="mural-context-item" data-action="rename">${this._icons.file}<span>Renomear</span></button>
      <button class="mural-context-item" data-action="share">${this._icons.upload}<span>Compartilhar</span></button>
      <div class="mural-context-divider"></div>
      <button class="mural-context-item" data-action="copy">${this._icons.file}<span>Copiar</span></button>
      <button class="mural-context-item" data-action="download">${this._icons.upload}<span>Baixar</span></button>
      <div class="mural-context-divider"></div>
      <button class="mural-context-item danger" data-action="delete">${this._icons.close}<span>Excluir</span></button>
    `;

    document.body.appendChild(menu);
    requestAnimationFrame(() => menu.classList.add('is-open'));

    // Ajustar se sair da tela
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';

    // Ações
    menu.querySelectorAll('.mural-context-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        const id = this.contextFileId;
        this._closeContextMenu();
        if (action === 'delete') {
          LizData.deleteUploadedFile(id);
          this.render();
        } else if (action === 'open' || action === 'preview') {
          LizData.loadUploadedFiles();
          const file = LizData.uploadedFiles.find(f => f.id === id);
          if (file && file.type && file.type.startsWith('image/')) {
            this._openViewer(file);
          } else if (file) {
            this._openFileReader(file);
          }
        } else if (action === 'rename') {
          LizData.loadUploadedFiles();
          const file = LizData.uploadedFiles.find(f => f.id === id);
          if (!file) return;
          const newName = prompt('Novo nome do arquivo:', file.name);
          if (newName && LizData.renameUploadedFile(id, newName)) {
            this.render();
            if (typeof LizChat !== 'undefined' && LizChat.toast) LizChat.toast('Arquivo renomeado');
          }
        } else if (action === 'download') {
          LizData.loadUploadedFiles();
          const file = LizData.uploadedFiles.find(f => f.id === id);
          if (!file) return;
          this._ensureDataUrl(file).then((ok) => {
            if (!ok || !file.dataUrl) return;
            const a = document.createElement('a');
            a.href = file.dataUrl;
            a.download = file.name || 'arquivo';
            document.body.appendChild(a);
            a.click();
            a.remove();
          });
        } else if (action === 'share') {
          LizData.loadUploadedFiles();
          const file = LizData.uploadedFiles.find(f => f.id === id);
          if (!file) return;
          if (navigator.share) {
            navigator.share({ title: file.name || 'Arquivo', url: file.dataUrl }).catch(() => {});
          } else if (typeof LizChat !== 'undefined' && LizChat.toast) {
            LizChat.toast('Compartilhamento não suportado neste navegador');
          }
        } else if (action === 'copy') {
          LizData.loadUploadedFiles();
          const file = LizData.uploadedFiles.find(f => f.id === id);
          if (!file) return;
          this._copyFile(file);
        }
      });
    });

    // Fechar ao clicar fora
    this._contextCloseHandler = (e) => { if (!menu.contains(e.target)) this._closeContextMenu(); };
    setTimeout(() => document.addEventListener('click', this._contextCloseHandler), 10);
  },

  _closeContextMenu: function() {
    const menu = document.getElementById('mural-context');
    if (menu) { menu.classList.remove('is-open'); setTimeout(() => menu.remove(), 200); }
    if (this._contextCloseHandler) { document.removeEventListener('click', this._contextCloseHandler); this._contextCloseHandler = null; }
  },

  /* ---- Copiar arquivo ----
   * Imagens vão pro clipboard como PNG (ClipboardItem);
   * demais tipos copiam o nome. Degrada com toast em cada falha. */
  _copyFile: function(file) {
    const toast = (typeof LizChat !== 'undefined' && LizChat.toast)
      ? (m) => LizChat.toast(m)
      : () => {};

    if (file.type && file.type.startsWith('image/') && navigator.clipboard && window.ClipboardItem) {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 1;
        canvas.height = img.naturalHeight || 1;
        canvas.getContext('2d').drawImage(img, 0, 0);
        canvas.toBlob(async (blob) => {
          if (!blob) { toast('Não foi possível copiar'); return; }
          try {
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            toast('Imagem copiada');
          } catch (e) {
            toast('Não foi possível copiar');
          }
        }, 'image/png');
      };
      img.onerror = () => toast('Não foi possível copiar');
      // Sem dataUrl local? Baixa do storage antes de copiar
      this._ensureDataUrl(file).then((ok) => {
        if (!ok || !file.dataUrl) { toast('Não foi possível copiar'); return; }
        img.src = file.dataUrl;
      });
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(file.name || '')
        .then(() => toast('Nome do arquivo copiado'), () => toast('Não foi possível copiar'));
    } else {
      toast('Cópia não suportada neste navegador');
    }
  },
};
