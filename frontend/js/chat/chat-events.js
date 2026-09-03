/* ============================================================
 *  Liz Chat — chat-events.js
 *  Eventos globais: formulário, teclado, abas, pills, seletor de modelo e modo foco.
 *  Módulo parcial: é misturado no objeto LizChat pelo chat.js
 * ============================================================ */

window.LizChatEvents = {
  /* ===========================================================
   * EVENTOS
   * =========================================================== */
  _bindEvents() {
    const { el } = LizUI;

    // Envio do formulário
    el.form.addEventListener('submit', (e) => {
      e.preventDefault();
      // Durante a geração, o botão de enviar vira "Parar geração"
      if (this.isGenerating) { this.stopGeneration(); return; }
      this.sendMessage();
    });

    // Estado do botão enviar + Enter (sem Shift) + auto-resize
    el.input.addEventListener('input', () => {
      LizUI.updateSendState();
      this._autoResize(el.input);
    });
    el.input.addEventListener('paste', (e) => {
      const clipboard = e.clipboardData;
      if (!clipboard) return;
      const files = Array.from(clipboard.files || []);
      if (!files.length && clipboard.items) {
        Array.from(clipboard.items).forEach((item) => {
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) files.push(file);
          }
        });
      }
      if (files.length) {
        e.preventDefault();
        this._handleFiles(files);
        this.toast(files.length === 1 ? 'Arquivo colado e anexado' : files.length + ' arquivos colados e anexados');
      }
    });

    el.input.addEventListener('keydown', (e) => {
      const enterSends = localStorage.getItem('liz-enter-send') !== 'false';
      if (e.key === 'Enter' && !e.shiftKey) {
        if (enterSends) {
          e.preventDefault();
          if (this.isGenerating) { this.stopGeneration(); return; }
          this.sendMessage();
        }
        // Se enterSends for false, o Enter padrão adiciona nova linha (comportamento nativo)
      }
      // Ctrl+Enter sempre envia, independente da config
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (this.isGenerating) { this.stopGeneration(); return; }
        this.sendMessage();
      }
      // Tab no textarea: sempre previne tabulação e pula para o
      // próximo elemento focável (evita ficar preso no loop)
      if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        if (el.sendBtn && !el.sendBtn.disabled) {
          el.sendBtn.focus();
        } else {
          // Pula para o próximo elemento focável no ciclo
          const taIdx = this._tabFocusable.indexOf(el.input);
          const next = this._tabFocusable.find((e, i) => i > taIdx && !e.disabled);
          (next || this._tabFocusable[0])?.focus();
        }
      }
    });

    // Coroa no header — recolhe/expande o menu lateral
    el.crownToggle.addEventListener('click', () => LizUI.toggleTools());
    el.crownToggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        LizUI.toggleTools();
      }
    });

    // Seletor de modelo
    this._bindModelSelector();

    // No mobile, o botão no topo abre o painel de conversas
    el.mobileMenuBtn.addEventListener('click', () => LizUI.openPanel('conversations'));

    // Anexar — abre seletor de arquivos
    el.attachBtn.addEventListener('click', () => LizUI.triggerFilePicker());

    // Pesquisa na web — toggle visual (wiring com o backend vem depois)
    if (el.websearchBtn) {
      el.websearchBtn.addEventListener('click', () => {
        const active = el.websearchBtn.classList.toggle('is-active');
        el.websearchBtn.setAttribute('aria-pressed', String(active));
      });
    }

    // File input change
    el.fileInput.addEventListener('change', (e) => {
      if (e.target.files.length) {
        this._handleFiles(e.target.files);
        e.target.value = '';
      }
    });

    // Drag & drop na área de conteúdo
    const dropTargets = [el.contentWrap, document.querySelector('.chat-main')];
    dropTargets.forEach((target) => {
      if (!target) return;
      target.addEventListener('dragenter', (e) => {
        e.preventDefault();
        e.stopPropagation();
        LizUI.showDragOverlay();
      });
      target.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
      target.addEventListener('dragleave', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Só esconde se sair do alvo completamente
        if (e.target === target || !target.contains(e.relatedTarget)) {
          LizUI.hideDragOverlay();
        }
      });
      target.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        LizUI.hideDragOverlay();
        if (e.dataTransfer.files.length) {
          this._handleFiles(e.dataTransfer.files);
        }
      });
    });

    // Preview modal events
    // Delegated click para imagens nas mensagens
    el.messagesList.addEventListener('click', (e) => {
      const previewBtn = e.target.closest('.file-image-preview, .ai-image-preview');
      if (previewBtn) {
        const img = previewBtn.querySelector('img');
        // Imagens da IA: a galeria carrega o thumbnail e o expand abre a
        // imagem cheia guardada em data-file-url.
        const fullSrc = previewBtn.classList.contains('ai-image-preview')
          ? previewBtn.dataset.fileUrl : '';
        if (fullSrc) {
          LizUI.openPreview(fullSrc, previewBtn.dataset.fileName || (img && img.alt) || 'Imagem');
        } else if (img) {
          LizUI.openPreview(img.src, previewBtn.dataset.fileName || img.alt);
        }
        return;
      }
    });

    // Fechar preview: overlay, botão X, Esc
    el.previewOverlay?.addEventListener('click', (e) => {
      if (e.target === el.previewOverlay) LizUI.closePreview();
    });
    el.previewClose?.addEventListener('click', () => LizUI.closePreview());

    // Menu flutuante (pílulas laterais)
    document.querySelectorAll('.float-pill[data-action]').forEach((pill) => {
      pill.addEventListener('click', () => this._handlePill(pill.dataset.action));
    });

    // Fechar painéis: overlay, botão X, Esc
    el.overlay.addEventListener('click', () => LizUI.closePanel());
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => LizUI.closePanel());
    });
    document.addEventListener('keydown', (e) => {
      // === ATALHOS DE TECLADO ===

      // Escape: fecha painéis, preview, galeria, sai do foco
      if (e.key === 'Escape') {
        if (this.isFocused) { this.exitFocusMode(); return; }
        if (el.previewOverlay?.classList.contains('is-visible')) { LizUI.closePreview(); return; }
        LizUI.closePanel();
        return;
      }

      // Ctrl/Cmd + N: Nova conversa
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        this.newConversation();
        return;
      }

      // Ctrl/Cmd + E: Modo foco
      if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
        e.preventDefault();
        this.toggleFocusMode();
        return;
      }

      // Ctrl/Cmd + Shift + Delete: Limpar conversa
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Delete') {
        e.preventDefault();
        if (this.messages.length > 0 && confirm('Limpar toda a conversa atual?')) {
          this.newConversation();
          this.toast('Conversa limpa');
        }
        return;
      }

      // Ctrl/Cmd + F: Busca na conversa
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        if (this.messages.length > 0) {
          e.preventDefault();
          LizUI.showSearchBar();
        }
        return;
      }

      // / (barra): Foca no input
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && document.activeElement !== el.input) {
        const tag = document.activeElement?.tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
          e.preventDefault();
          el.input.focus();
        }
      }
    });

    // Focus mode: botão de sair
    const focusExitBtn = document.getElementById('focus-exit-btn');
    if (focusExitBtn) {
      focusExitBtn.addEventListener('click', () => this.exitFocusMode());
    }

    // Busca no painel de conversas
    el.conversationsSearch.addEventListener('input', (e) => {
      LizUI._renderConversations(e.target.value);
    });

    // Abrir conversa a partir do card (painel) + ações fixar/renomear/excluir
    el.conversationsContent.addEventListener('click', (e) => {
      const actBtn = e.target.closest('.conv-act');
      const card = e.target.closest('.conv-card');
      if (!card) return;
      const convId = card.dataset.id;

      // Ações nos botões do card
      if (actBtn) {
        e.stopPropagation();
        const act = actBtn.dataset.act;
        if (act === 'pin') {
          LizData.togglePinConversation(convId);
          LizUI._renderConversations(el.conversationsSearch?.value || '');
        } else if (act === 'rename') {
          const conv = LizData.getConversationById(convId);
          this._renameConversationPrompt(conv);
        } else if (act === 'delete') {
          this._deleteConversationConfirm(convId);
        }
        return;
      }

      const savedConv = LizData.getConversationById(convId);
      if (savedConv) {
        LizUI.closePanel();
        this.openConversationById(savedConv.id);
      }
    });

    // Tab Navigation Mode — ciclo fechado de navegação
    this._initTabNavigation();

    // Esconde o indicador ao interagir com mouse/clique
    document.addEventListener('mousedown', () => {
      const indicator = document.getElementById('tab-nav-indicator');
      if (!indicator) return;
      indicator.classList.remove('is-visible');
      indicator.setAttribute('aria-hidden', 'true');
      clearTimeout(this._tabNavTimer);
    });
  },

  /** Timer para o indicador de navegação Tab */
  _tabNavTimer: null,
  _tabFocusable: [],

  /** Inicializa o ciclo fechado de navegação por Tab. */
  _initTabNavigation() {
    // Lista de seletores dos principais elementos focáveis
    // (elementos intermediários como chips de sugestão fluem naturalmente)
    this._tabSelectors = [
      '#crown-toggle',
      '#theme-toggle',
      '.float-pill[data-action="new"]',
      '.float-pill[data-action="conversations"]',
      '.float-pill[data-action="mural"]',
      '.float-pill[data-action="settings"]',
      '#attach-btn',
      '#websearch-btn',
      '#chat-input',
      '#send-btn',
    ];

    // Cache inicial (pode ser vazio durante intro — rebuild depois)
    this._rebuildTabFocusable();

    document.addEventListener('keydown', (e) => {
      const indicator = document.getElementById('tab-nav-indicator');

      if (e.key === 'Tab') {
        // Mostra o indicador
        if (indicator) {
          indicator.classList.add('is-visible');
          indicator.setAttribute('aria-hidden', 'false');
          clearTimeout(this._tabNavTimer);
          this._tabNavTimer = setTimeout(() => {
            indicator.classList.remove('is-visible');
            indicator.setAttribute('aria-hidden', 'true');
          }, 4000);
        }

        const els = this._tabFocusable;
        if (!els.length) return;

        const active = document.activeElement;
        const idx = els.indexOf(active);
        const last = els.length - 1;

        // Só interfere nos extremos do ciclo.
        // Elementos não-listados (chips, starters) fluem naturalmente.
        if (idx !== -1) {
          if (e.shiftKey) {
            // Shift+Tab no primeiro → vai para o último
            if (idx <= 0) {
              e.preventDefault();
              els[last]?.focus();
            }
          } else {
            // Tab no último → volta para o primeiro (coroa)
            if (idx === last) {
              e.preventDefault();
              els[0]?.focus();
            }
          }
        }
      }

      // Escape → fecha o indicador
      if (e.key === 'Escape') {
        if (indicator) {
          indicator.classList.remove('is-visible');
          indicator.setAttribute('aria-hidden', 'true');
          clearTimeout(this._tabNavTimer);
        }
      }
    });
  },

  /** Reconstrói a lista de elementos focáveis (chamar após intro/visibility changes). */
  _rebuildTabFocusable() {
    this._tabFocusable = (this._tabSelectors || [])
      .map((sel) => document.querySelector(sel))
      .filter((el) => el && el.offsetParent !== null);
  },

  /** Roteia o clique nas pílulas do menu flutuante. */
  _handlePill(action) {
    // Sempre limpa painel/estado anterior antes de processar nova action
    LizUI._hideMainFloatPanel();

    if (action === 'new') {
      this.newConversation();
      return;
    }
    // Mural → overlay fullscreen
    if (action === 'mural') {
      LizUI.mural.open();
      return;
    }
    // Conversas → float panel ao lado do menu
    if (action === 'conversations') {
      LizUI._showMainFloatPanel(action);
      return;
    }
    // Ajustes → float panel via LizSettings
    if (action === 'settings') {
      LizSettings.showFloatPanel(action);
      return;
    }
    // Conta → abre o painel flutuante já na página de conta
    if (action === 'account') {
      LizSettings.showFloatPanel('account');
      LizSettings.showSettingsPage('account');
      return;
    }
    // Fallback: abre painel (para outros casos não mapeados)
    if (LizUI.activePanel === action) {
      LizUI.closePanel();
    } else {
      LizUI.openPanel(action);
    }
  },

  /* ===========================================================
   * SELETOR DE MODELO
   * =========================================================== */
  _bindModelSelector() {
    const btn = document.getElementById('model-selector-btn');
    const dropdown = document.getElementById('model-selector-dropdown');
    const label = document.getElementById('model-selector-label');
    if (!btn || !dropdown || !label) return;

    // Nomes legíveis
    const modelNames = {
      'liz-3': 'Liz 3',
      'liz-3-flash': 'Liz 3 Flash',
      'nable-35-mini': 'Nable 3.5 Mini',
      'nable-35': 'Nable 3.5',
    };

    // Restaura modelo salvo
    label.textContent = modelNames[this.selectedModel] || 'Liz 3';
    this._syncModelActive(dropdown);

    // Toggle dropdown
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.contains('is-open');
      if (isOpen) {
        this._closeModelDropdown();
      } else {
        dropdown.classList.add('is-open');
        dropdown.setAttribute('aria-hidden', 'false');
        btn.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });

    // Seleção de modelo
    dropdown.querySelectorAll('.model-option').forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.stopPropagation();
        const model = opt.dataset.model;
        this.selectedModel = model;
        localStorage.setItem('liz-model', model);
        label.textContent = modelNames[model] || model;
        this._syncModelActive(dropdown);

        // Animação de pulso no botão
        btn.classList.remove('just-changed');
        void btn.offsetWidth; // force reflow
        btn.classList.add('just-changed');

        this._closeModelDropdown();
        this.toast('Modelo: ' + (modelNames[model] || model));
      });
    });

    // Fecha ao clicar fora
    document.addEventListener('click', () => {
      if (dropdown.classList.contains('is-open')) {
        this._closeModelDropdown();
      }
    });

    // Fecha com Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && dropdown.classList.contains('is-open')) {
        this._closeModelDropdown();
      }
    });
  },

  _closeModelDropdown() {
    const btn = document.getElementById('model-selector-btn');
    const dropdown = document.getElementById('model-selector-dropdown');
    if (!btn || !dropdown) return;
    dropdown.classList.remove('is-open');
    dropdown.setAttribute('aria-hidden', 'true');
    btn.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
  },

  _syncModelActive(dropdown) {
    dropdown.querySelectorAll('.model-option').forEach((opt) => {
      opt.classList.toggle('is-active', opt.dataset.model === this.selectedModel);
    });
  },


  /* ===========================================================
   * MODO FOCO
   * =========================================================== */
  toggleFocusMode() {
    this.isFocused = !this.isFocused;
    const app = document.querySelector('.chat-app');
    const focusBtn = document.getElementById('focus-exit-btn');
    if (!app || !focusBtn) return;

    app.classList.toggle('is-focused', this.isFocused);
    focusBtn.classList.toggle('is-visible', this.isFocused);

    if (this.isFocused) {
      LizUI.closePanel();
      this.toast('Modo foco ativado — pressione Esc para sair');
    }
  },

  exitFocusMode() {
    if (this.isFocused) {
      this.isFocused = false;
      const app = document.querySelector('.chat-app');
      const focusBtn = document.getElementById('focus-exit-btn');
      if (app) app.classList.remove('is-focused');
      if (focusBtn) focusBtn.classList.remove('is-visible');
    }
  },

};
