/* ============================================================
 *  Liz Chat — chat-intro.js
 *  Utilitários e apresentação: delays, settings, toast e animação de introdução da coroa.
 *  Módulo parcial: é misturado no objeto LizChat pelo chat.js
 * ============================================================ */

window.LizChatIntro = {
  /* ===========================================================
   * UTILITÁRIOS
   * =========================================================== */
  _delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  _now() {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  },

  /** Pausa animações quando a página está oculta (economiza CPU/GPU) */
  _initVisibilityOptimization() {
    if (typeof document.hidden !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          document.documentElement.classList.add('liz-page-hidden');
        } else {
          document.documentElement.classList.remove('liz-page-hidden');
        }
      });
    }
  },

  /** Aplica as configurações de chat em tempo real */
  applyChatSettings() {
    const showTimestamp = localStorage.getItem('liz-timestamp') !== 'false';
    const showAnimations = localStorage.getItem('liz-animations') !== 'false';
    const showGlow = localStorage.getItem('liz-glow') !== 'false';
    const enterSend = localStorage.getItem('liz-enter-send') !== 'false';
    const showSuggestions = localStorage.getItem('liz-show-suggestions') !== 'false';

    // Usa CSS classes para controle em tempo real (funciona pra mensagens novas também)
    document.documentElement.classList.toggle('liz-no-timestamp', !showTimestamp);
    document.documentElement.classList.toggle('liz-no-animations', !showAnimations);
    document.documentElement.classList.toggle('liz-no-glow', !showGlow);
    document.documentElement.classList.toggle('liz-no-suggestions', !showSuggestions);

    // Enter para enviar: atualiza o placeholder
    const input = document.getElementById('chat-input');
    if (input) {
      input.placeholder = enterSend
        ? 'Digite sua mensagem para a Liz...'
        : 'Digite sua mensagem (Ctrl+Enter para enviar)...';
    }
  },

  _autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 140) + 'px';
  },

  /** Toast discreto no rodapé. */
  toast(message) {
    const toast = LizUI.el.toast;
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
  },

  _introStage: null,
  _introCrown: null,
  _introCrownMover: null,
  _introCrownImg: null,
  _introAnim: null,
  _appReady: false,
  _revealed: false,
  _revealTimer: null,
  CROWN_MOVE_DURATION: 750,
  REVEAL_OVERLAP: 180,
  _minTimeElapsed: false,

  runIntroAnimation() {
    // Nota: a intro é identidade da marca (como na tela de login) —
    // roda mesmo com "reduzir movimento" do sistema (decisão do projeto).
    if (this._introStage) return;

    this._introStage = 'loading';

    const { el } = LizUI;
    const app = document.querySelector('.chat-app');
    if (!app) return;

    app.style.pointerEvents = 'none';

    this._hideAllInterface();

    const crownInInterface = el.emptyState?.querySelector('.empty-crown');
    if (crownInInterface) {
      crownInInterface.style.visibility = 'hidden';
      crownInInterface.style.animation = 'none';
    }

    this._introCrown = document.createElement('div');
    this._introCrown.className = 'intro-crown-wrap';

    const mover = document.createElement('div');
    mover.className = 'intro-crown-mover';
    mover.innerHTML = `<img src="coroa.svg" alt="" class="intro-crown-img" />`;

    this._introCrown.appendChild(mover);
    this._introCrownImg = mover.querySelector('.intro-crown-img');
    this._introCrownMover = mover;

    document.body.appendChild(this._introCrown);

    void this._introCrown.offsetWidth;

    requestAnimationFrame(() => {
      this._introCrown.classList.add('intro-crown-enter');
    });

    // Flutuação só depois da entrada TERMINAR (700ms). Antes ela entrava
    // aos 480ms e substituía crownEntrance no meio — a coroa "repetia".
    const startFloat = () => {
      if (!this._introCrown || this._introStage === 'complete') return;
      this._introCrown.classList.add('intro-crown-float');
    };
    this._floatFallbackTimer = setTimeout(startFloat, 740);
    this._introCrownImg.addEventListener('animationend', (e) => {
      if (e.animationName !== 'crownEntrance') return;
      clearTimeout(this._floatFallbackTimer);
      startFloat();
    }, { once: true });

    setTimeout(() => {
      this._minTimeElapsed = true;
      this._checkReveal();
    }, 700);

    this._waitForAppReady();
  },

  _hideAllInterface() {
    const elements = [
      document.querySelector('.chat-header'),
      document.getElementById('floating-menu'),
      document.querySelector('.chat-main'),
      document.querySelector('.composer')
    ];

    elements.forEach((el) => {
      if (el) {
        el.style.willChange = 'opacity, transform';
        el.classList.add('intro-interface-hidden');
      }
    });
  },

  _waitForAppReady() {
    let checks = 0;
    const maxChecks = 100;

    const check = () => {
      checks++;
      const fontsReady = !document.fonts || document.fonts.status === 'loaded';
      const layoutReady = this._isLayoutReady();

      if ((fontsReady && layoutReady) || checks >= maxChecks) {
        this._appReady = true;
        this._checkReveal();
        return;
      }

      setTimeout(check, 50);
    };

    setTimeout(check, 100);
  },

  _isLayoutReady() {
    const { el } = LizUI;
    const targetCrown = el.emptyState?.querySelector('.empty-crown');
    if (!targetCrown) return false;

    const rect = targetCrown.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  },

  _checkReveal() {
    if (this._appReady && this._minTimeElapsed && this._introStage === 'loading') {
      this._startCrownMove();
    }
  },

  _startCrownMove() {
    this._introStage = 'moving';

    const mover = this._introCrownMover;
    const crownImg = this._introCrownImg;

    if (!mover || !crownImg) {
      this._finalizeCrown();
      return;
    }

    const { el } = LizUI;
    const targetSlot = el.emptyState?.querySelector('.hero-crown-slot');
    const targetCrown = el.emptyState?.querySelector('.empty-crown');

    if (!targetSlot || !targetCrown) {
      this._finalizeCrown();
      return;
    }

    targetCrown.classList.add('crown-target-only');

    crownImg.classList.add('preparing-to-move');

    setTimeout(() => {
      mover.classList.add('is-moving');
      crownImg.classList.remove('preparing-to-move');

      const movingRect = mover.getBoundingClientRect();
      const slotRect = targetSlot.getBoundingClientRect();

      const movingCenterX = movingRect.left + movingRect.width / 2;
      const movingCenterY = movingRect.top + movingRect.height / 2;
      const targetCenterX = slotRect.left + slotRect.width / 2;
      const targetCenterY = slotRect.top + slotRect.height / 2;

      const deltaX = targetCenterX - movingCenterX;
      const deltaY = targetCenterY - movingCenterY;

      this._introAnim = mover.animate(
        [
          { transform: 'translate(-50%, -50%) scale(1)' },
          { transform: `translate3d(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px), 0) scale(1)` }
        ],
        {
          duration: this.CROWN_MOVE_DURATION,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
          fill: 'forwards'
        }
      );

      const revealDelay = this.CROWN_MOVE_DURATION - this.REVEAL_OVERLAP;
      this._revealTimer = setTimeout(() => {
        this._revealInterface();
      }, revealDelay);

      this._introAnim.finished.then(() => {
        clearTimeout(this._revealTimer);
        this._finalizeCrown();
      });
    }, 120);
  },

  _revealInterface() {
    if (this._revealed) return;
    this._revealed = true;

    // Restaura a coroa da tela inicial que foi escondida durante a intro
    const ec = document.getElementById('empty-crown');
    if (ec) {
      ec.classList.remove('crown-target-only');
      ec.style.visibility = '';
      ec.style.animation = '';
    }

    document.documentElement.classList.remove('liz-booting');
    document.documentElement.classList.add('liz-intro-complete');

    const elements = [
      document.querySelector('.chat-header'),
      document.getElementById('floating-menu'),
      document.querySelector('.chat-main'),
      document.querySelector('.composer')
    ];

    elements.forEach((elem) => {
      if (elem) {
        elem.classList.remove('intro-interface-hidden', 'intro-interface-visible');
        elem.style.willChange = '';
      }
    });

    const app = document.querySelector('.chat-app');
    if (app) app.style.pointerEvents = '';

    // Reconstrói navegação Tab agora que os elementos estão visíveis
    this._rebuildTabFocusable();
  },

  _finalizeCrown() {
    if (this._introStage !== 'moving') return;
    this._introStage = 'complete';

    const anim = this._introAnim;
    const mover = this._introCrownMover;
    const crownImg = this._introCrownImg;
    const crownWrap = this._introCrown;

    if (anim) {
      if (typeof anim.commitStyles === 'function') {
        anim.commitStyles();
      }
      anim.cancel();
    }
    this._introAnim = null;

    if (crownImg) {
      crownImg.classList.remove('preparing-to-move');
      crownImg.classList.add('intro-crown-float');
    }

    if (mover) {
      mover.classList.remove('is-moving');
    }

    if (crownWrap) {
      crownWrap.classList.add('crown-is-final');
    }

    // Remove o elemento do DOM após a animação terminar,
    // evitando que a coroa fique flutuando no meio da tela.
    if (crownWrap && crownWrap.parentNode) {
      crownWrap.remove();
    }

    this._revealInterface();
  },

  _showInterfaceImmediately() {
    this._revealInterface();
  },
};
