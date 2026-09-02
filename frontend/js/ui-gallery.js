/* ============================================================
 *  Liz — ui-gallery.js
 *  Preview, galeria, upload panel, file messages
 * ============================================================ */

// ===================== FILE MESSAGE =====================
LizUI.renderFileMessage = function(file, index) {
  const isImage = file.type && file.type.startsWith('image/');
  const size = this._formatFileSize(file.size);
  const name = this._esc(file.name);
  const dataUrl = file.dataUrl || '';
  // Sem dataUrl mas com uploadId: o conteúdo mora no storage do backend
  // e é baixado sob demanda pelo hydrateUploads.
  const uploadAttr = (!dataUrl && file.uploadId) ? ' data-upload-id="' + this._esc(file.uploadId) + '"' : '';
  if (isImage) {
    return '<div class="file-msg file-msg-image"><div class="file-image-preview"' + uploadAttr + ' style="background-image: url(' + dataUrl + ')" role="button" tabindex="0" data-file-url="' + dataUrl + '" data-file-name="' + name + '">' +
      '<img src="' + dataUrl + '" alt="' + name + '" loading="lazy" /><span class="file-image-expand">' + LizConfig.icons.expand + '</span></div>' +
      '<div class="file-info"><span class="file-name">' + name + '</span><span class="file-size">' + size + '</span></div></div>';
  }
  return '<div class="file-msg file-msg-doc"><span class="file-doc-icon">' + LizConfig.icons.file + '</span>' +
    '<div class="file-info"><span class="file-name">' + name + '</span><span class="file-size">' + size + '</span></div></div>';
};

// ===================== IMAGENS DA IA =====================
LizUI._safeImageUrl = function(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=\s]+$/i.test(raw)) return raw;
  // Proxy URLs do backend (relativos: /api/proxy-image?url=...)
  if (raw.startsWith('/api/proxy-image')) return raw;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' ? url.toString() : '';
  } catch (_) {
    return '';
  }
};

LizUI.renderAIImages = function(images) {
  if (!Array.isArray(images)) return '';
  const apiBase = (typeof LizAPI !== 'undefined' && LizAPI.BASE_URL) ? LizAPI.BASE_URL : '';
  return images.map((image) => {
    var src = this._safeImageUrl(image.url || image.src);
    if (src && src.startsWith('/api/') && apiBase) {
      src = apiBase.replace(/\/api\/?$/, '') + src;
    }
    // A galeria carrega o thumbnail leve; o expand abre a imagem cheia.
    // Mensagens antigas não têm fullUrl — cai pro próprio src.
    var fullSrc = this._safeImageUrl(image.fullUrl) || src;
    if (fullSrc && fullSrc.startsWith('/api/') && apiBase) {
      fullSrc = apiBase.replace(/\/api\/?$/, '') + fullSrc;
    }
    const uploadAttr = (!src && image.uploadId)
      ? ' data-upload-id="' + this._esc(image.uploadId) + '"' : '';
    if (!src && !uploadAttr) return '';
    const alt = this._esc(image.alt || image.title || 'Imagem da Liz');
    const title = this._esc(image.title || 'Imagem');
    const sourceUrl = this._safeImageUrl(image.sourceUrl);
    const source = this._esc(image.source || 'Fonte');
    const creator = image.creator ? ' · ' + this._esc(image.creator) : '';
    const license = image.license ? ' · ' + this._esc(image.license) : '';
    const link = sourceUrl
      ? '<a class="ai-image-source-link" href="' + this._esc(sourceUrl) + '" target="_blank" rel="noopener noreferrer">Abrir fonte</a>'
      : '';
    var loadClass = src.startsWith('/api/') ? ' is-loading' : '';
    var onError = ' onerror="this.parentElement.classList.remove(\'is-loading\');this.style.display=\'none\'" onload="this.parentElement.classList.remove(\'is-loading\')"';
    return '<figure class="ai-image-card"' + uploadAttr + '>' +
      '<div class="ai-image-preview' + loadClass + '" data-file-url="' + this._esc(fullSrc) + '" data-file-name="' + alt + '" role="button" tabindex="0">' +
      '<img src="' + this._esc(src) + '" alt="' + alt + '" loading="lazy"' + onError + ' />' +
      '<span class="ai-image-expand">' + LizConfig.icons.expand + '</span></div>' +
      '<figcaption><span class="ai-image-title">' + title + '</span><span class="ai-image-meta">' + source + creator + license + '</span>' + link + '</figcaption>' +
      '</figure>';
  }).join('');
};

// ===================== HIDRATAÇÃO DE UPLOADS =====================
/** Baixa sob demanda o conteúdo de arquivos que estão no storage do
 *  backend (uploadId) e não têm dataUrl local. Cada id é baixado uma
 *  vez por sessão (cache em LizAPI.getUploadDataUrl). */
LizUI.hydrateUploads = function(root) {
  const scope = root || document;
  scope.querySelectorAll('[data-upload-id]').forEach((el) => {
    if (el.dataset.hydrated) return;
    const id = el.getAttribute('data-upload-id');
    if (!id) return;
    el.dataset.hydrated = '1';
    LizAPI.getUploadDataUrl(id).then((url) => {
      if (!url) return;
      const img = el.matches('img') ? el : el.querySelector('img');
      // getAttribute: img.src vazio resolve pra URL da página, então
      // checamos o atributo cru pra saber se já tem conteúdo.
      if (img && !img.getAttribute('src')) img.src = url;
      if (el.style && el.style.backgroundImage !== undefined &&
          (el.classList.contains('file-image-preview') ||
           el.classList.contains('upload-panel-thumb') ||
           el.classList.contains('mural-thumb'))) {
        el.style.backgroundImage = 'url(' + url + ')';
      }
      // Alimenta os handlers de preview/download que leem dataset
      if (el.hasAttribute('data-file-url')) el.dataset.fileUrl = url;
      if (el.hasAttribute('data-url')) el.dataset.url = url;
    }).catch(() => { el.dataset.hydrated = ''; });
  });
};

// ===================== PREVIEW =====================
LizUI.openPreview = function(src, filename) {
  if (!this.el.previewOverlay) return;
  this.el.previewImg.src = src;
  this.el.previewImg.alt = filename || 'Preview';
  this.el.previewFilename.textContent = filename || 'Imagem';
  this.el.previewDownload.innerHTML = LizConfig.icons.download;
  this.el.previewDownload.onclick = () => { var a = document.createElement('a'); a.href = src; a.download = filename || 'imagem'; a.click(); };
  this.el.previewOverlay.setAttribute('aria-hidden', 'false');
  this.el.previewOverlay.classList.add('is-visible');
  document.body.style.overflow = 'hidden';
};

LizUI.closePreview = function() {
  if (!this.el.previewOverlay) return;
  this.el.previewOverlay.classList.remove('is-visible');
  this.el.previewOverlay.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
};

// ===================== UPLOAD PANEL =====================
LizUI.openUploadPanel = function() {
  let panel = document.getElementById('upload-panel');
  let overlay = document.getElementById('upload-panel-overlay');
  if (!panel) {
    panel = document.createElement('section');
    panel.id = 'upload-panel'; panel.className = 'upload-panel';
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Histórico de arquivos');
    overlay = document.createElement('div');
    overlay.id = 'upload-panel-overlay'; overlay.className = 'upload-panel-overlay';
    overlay.addEventListener('click', () => this.closeUploadPanel());
    document.body.appendChild(overlay); document.body.appendChild(panel);
    document.addEventListener('keydown', function _upEsc(e) {
      const p = document.getElementById('upload-panel');
      if (e.key === 'Escape' && p && p.classList.contains('is-open')) LizUI.closeUploadPanel();
    });
  }
  LizData.loadUploadedFiles();
  const files = LizData.uploadedFiles;
  const images = files.filter((f) => f.type && f.type.startsWith('image/'));
  const docs = files.filter((f) => !f.type || !f.type.startsWith('image/'));
  let html = '<header class="upload-panel-head"><h3 class="upload-panel-title">Arquivos enviados</h3><div class="upload-panel-actions">' +
    '<button class="panel-close" data-close-uploads type="button" aria-label="Fechar"><span>' + LizConfig.icons.close + '</span></button></div></header>';
  html += '<div class="upload-panel-body">';
  if (files.length === 0) {
    html += '<div class="upload-panel-empty"><span class="upload-panel-empty-icon">' + LizConfig.icons.upload + '</span>Nenhum arquivo enviado ainda.<br>Arraste ou clique em Anexar para começar.</div>';
  } else {
    if (images.length > 0) {
      html += '<p class="upload-panel-section-title">Imagens (' + images.length + ')</p><div class="upload-panel-grid">';
      images.forEach((f) => {
        const upAttr = (!f.dataUrl && f.uploadId) ? ' data-upload-id="' + this._esc(f.uploadId) + '"' : '';
        html += '<div class="upload-panel-thumb"' + upAttr + ' data-url="' + (f.dataUrl || '') + '" data-name="' + this._esc(f.name) + '"><img src="' + (f.dataUrl || '') + '" alt="' + this._esc(f.name) + '" loading="lazy" /></div>';
      });
      html += '</div>';
    }
    if (docs.length > 0) {
      html += '<p class="upload-panel-section-title">Documentos (' + docs.length + ')</p>';
      docs.forEach((f) => { html += '<div class="upload-panel-file"><span class="upload-panel-file-icon">' + LizConfig.icons.file + '</span><div class="upload-panel-file-info"><span class="upload-panel-file-name">' + this._esc(f.name) + '</span><span class="upload-panel-file-meta">' + this._formatFileSize(f.size) + '</span></div><button class="upload-panel-file-delete" data-delete-id="' + this._esc(f.id) + '" type="button" aria-label="Remover">' + LizConfig.icons.trash + '</button></div>'; });
    }
  }
  html += '</div>';
  panel.innerHTML = html;
  this.hydrateUploads(panel);
  overlay.classList.add('is-visible');
  panel.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  const closeBtn = panel.querySelector('[data-close-uploads]');
  if (closeBtn) closeBtn.addEventListener('click', () => this.closeUploadPanel());
  panel.querySelectorAll('.upload-panel-thumb').forEach((thumb) => { thumb.addEventListener('click', () => this.openPreview(thumb.dataset.url, thumb.dataset.name)); });
  panel.querySelectorAll('.upload-panel-file-delete').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); const id = btn.dataset.deleteId; if (id) { LizData.deleteUploadedFile(id); this.openUploadPanel(); } });
  });
};

LizUI.closeUploadPanel = function() {
  const panel = document.getElementById('upload-panel');
  const overlay = document.getElementById('upload-panel-overlay');
  if (panel) panel.classList.remove('is-open');
  if (overlay) overlay.classList.remove('is-visible');
  document.body.style.overflow = '';
};

