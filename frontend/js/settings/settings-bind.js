/* ============================================================
 *  Liz — settings-bind.js
 *  Comportamento das páginas de ajustes: ligações de eventos por página.
 *  Módulo parcial: é misturado ao objeto principal pelo entrypoint.
 * ============================================================ */

window.LizSettingsBind = {
  _bindPageActions(pageId, panel) {
    if (pageId === 'history') {
      // Contadores reais, calculados na hora (nada de "0" fixo)
      LizData.loadSavedConversations();
      LizData.loadUploadedFiles();
      const histCount = panel.querySelector('#float-history-count');
      if (histCount) histCount.textContent = LizData.savedConversations.length + ' conversas';
      const filesCount = panel.querySelector('#float-files-count');
      if (filesCount) filesCount.textContent = LizData.uploadedFiles.length + ' arquivos';

      const exportBtn = panel.querySelector('#float-export-all');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => {
          LizData.loadSavedConversations();
          const allConvs = LizData.savedConversations;
          if (allConvs.length === 0) { if (typeof LizChat !== 'undefined' && LizChat.toast) LizChat.toast('Nenhuma conversa para exportar'); return; }
          let md = '# Todas as conversas - Liz\n\n';
          allConvs.forEach((conv) => {
            md += '## ' + conv.title + '\n\n';
            conv.messages.forEach((m) => {
              md += (m.role === 'user' ? '**Você:**' : '**Liz:**') + ' ' + m.content + '\n';
              if (m.time) md += '*(' + m.time + ')*';
              md += '\n\n';
            });
            md += '---\n\n';
          });
          md += '*Exportado por Liz Chat*';
          const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
          a.download = 'liz-conversas-completas.md'; document.body.appendChild(a); a.click();
          document.body.removeChild(a); URL.revokeObjectURL(a.href);
          if (typeof LizChat !== 'undefined' && LizChat.toast) LizChat.toast(allConvs.length + ' conversas exportadas!');
        });
      }
      const clearBtn = panel.querySelector('#float-clear-history');
      if (clearBtn) {
        clearBtn.addEventListener('click', () => {
          if (confirm('Tem certeza? Todas as conversas salvas serão apagadas.')) {
            LizData.savedConversations = [];
            try { localStorage.removeItem(LizData.STORAGE_KEY); } catch (e) { /* ignore */ }
            const countEl = panel.querySelector('#float-history-count');
            if (countEl) countEl.textContent = '0 conversas';
            if (typeof LizChat !== 'undefined' && LizChat.toast) LizChat.toast('Histórico limpo');
          }
        });
      }
    }
    if (pageId === 'memory') {
      this._renderMemoryUsage(panel);
      this._loadUserMemory(panel);
      const saveMemBtn = panel.querySelector('#float-save-memory');
      if (saveMemBtn) {
        saveMemBtn.addEventListener('click', () => this._saveUserMemory(panel));
      }
      const cacheBtn = panel.querySelector('#float-clear-cache');
      if (cacheBtn) {
        cacheBtn.addEventListener('click', () => {
          if (confirm('Limpar cache local?')) {
            try {
              localStorage.removeItem(LizData.STORAGE_KEY);
              localStorage.removeItem(LizData.UPLOADS_KEY);
              LizData.savedConversations = [];
              LizData.uploadedFiles = [];
              this._renderMemoryUsage(panel);
              if (typeof LizChat !== 'undefined' && LizChat.toast) LizChat.toast('Cache limpo');
            } catch (e) { /* ignore */ }
          }
        });
      }
    }
    if (pageId === 'appearance') {
      // Estado inicial: o botão ativo reflete o valor salvo (ou o default do config)
      const savedTheme = localStorage.getItem(LizConfig.theme.storageKey) || LizConfig.theme.default;
      document.querySelectorAll('#float-appearance-segmented .seg-btn[data-theme-val]').forEach((b) => {
        b.classList.toggle('is-active', b.dataset.themeVal === savedTheme);
      });
      // Theme segmented
      document.querySelectorAll('#float-appearance-segmented .seg-btn[data-theme-val]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const val = btn.dataset.themeVal;
          const effective = val === 'auto' ? (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : val;
          LizUI.setTheme(effective, true);
          localStorage.setItem(LizConfig.theme.storageKey, val);
          document.querySelectorAll('#float-appearance-segmented .seg-btn').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
        });
      });
      // Font size
      document.querySelectorAll('#float-font-size-segmented .seg-btn[data-font-size]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const size = btn.dataset.fontSize;
          document.querySelectorAll('#float-font-size-segmented .seg-btn').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          document.documentElement.setAttribute('data-font-size', size);
          localStorage.setItem('liz-font-size', size);
        });
      });
      // Accent color
      document.querySelectorAll('#float-accent-color-grid .accent-color-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#float-accent-color-grid .accent-color-btn').forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const color = getComputedStyle(btn).getPropertyValue('--accent-color').trim();
          document.documentElement.style.setProperty('--color-brand', color);
          localStorage.setItem('liz-accent-color', color);
          localStorage.setItem('liz-accent-name', btn.dataset.accent);
        });
      });
      // Nome do usuário — persiste e alimenta a página Conta
      const nameInput = panel.querySelector('#float-user-name-input');
      if (nameInput) {
        nameInput.addEventListener('change', () => {
          const v = nameInput.value.trim().slice(0, 40);
          if (v) localStorage.setItem('liz-user-name', v);
          else localStorage.removeItem('liz-user-name');
          if (typeof LizChat !== 'undefined' && LizChat.toast) LizChat.toast('Nome salvo');
        });
      }
    }
    if (pageId === 'account') {
      const emailInput = panel.querySelector('#float-email-input');
      if (emailInput) {
        emailInput.addEventListener('change', () => {
          const v = emailInput.value.trim().slice(0, 80);
          if (v) localStorage.setItem('liz-user-email', v);
          else localStorage.removeItem('liz-user-email');
          const cardEmail = panel.querySelector('.account-email');
          if (cardEmail) cardEmail.textContent = v || 'Sem email definido';
          if (typeof LizChat !== 'undefined' && LizChat.toast) LizChat.toast('Email salvo');
        });
      }
    }
    if (pageId === 'chat') {
      const chatToggles = [
        'float-show-suggestions', 'float-continuation-suggestions',
        'float-timestamp', 'float-animations', 'float-glow'
      ];
      chatToggles.forEach((id) => {
        const el = panel.querySelector('#' + id);
        if (el) {
          // Restore saved state
          const saved = localStorage.getItem('liz-' + id.replace('float-', ''));
          if (saved !== null) el.checked = saved === 'true';

          el.addEventListener('change', () => {
            const key = 'liz-' + id.replace('float-', '');
            localStorage.setItem(key, el.checked);
            if (typeof LizChat !== 'undefined' && typeof LizChat.applyChatSettings === 'function') {
              LizChat.applyChatSettings();
            }
          });
        }
      });
    }
    if (pageId === 'notifications') {
      const notifToggles = ['float-notifications', 'float-notification-sound', 'float-notification-vibrate', 'float-notification-preview', 'float-notification-group'];
      notifToggles.forEach((id) => {
        const el = panel.querySelector('#' + id);
        if (el) {
          const saved = localStorage.getItem('liz-' + id.replace('float-', ''));
          if (saved !== null) el.checked = saved === 'true';
          el.addEventListener('change', () => {
            localStorage.setItem('liz-' + id.replace('float-', ''), el.checked);
          });
        }
      });
    }
    if (pageId === 'language') {
      // Dropdowns customizados (sem <select> nativo — popup do Windows não respeita CSS)
      panel.querySelectorAll('.settings-dropdown').forEach((dd) => {
        const btn = dd.querySelector('.settings-dropdown-btn');
        const menu = dd.querySelector('.settings-dropdown-menu');
        const label = dd.querySelector('.settings-dropdown-label');
        if (!btn || !menu) return;

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          // Fecha outros dropdowns abertos
          panel.querySelectorAll('.settings-dropdown.is-open').forEach((other) => {
            if (other !== dd) other.classList.remove('is-open');
          });
          dd.classList.toggle('is-open');
        });

        menu.querySelectorAll('.settings-dropdown-item').forEach((item) => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = item.dataset.val;
            dd.dataset.value = val;
            label.textContent = item.textContent;
            menu.querySelectorAll('.settings-dropdown-item').forEach((i) => i.classList.remove('is-active'));
            item.classList.add('is-active');
            dd.classList.remove('is-open');
            // Persiste
            if (dd.id === 'float-language') localStorage.setItem('liz-language', val);
            if (dd.id === 'float-date-format') localStorage.setItem('liz-date-format', val);
          });
        });
      });

      // Fecha dropdown ao clicar fora
      const outsideHandler = (e) => {
        if (!e.target.closest('.settings-dropdown')) {
          panel.querySelectorAll('.settings-dropdown.is-open').forEach((dd) => dd.classList.remove('is-open'));
        }
      };
      document.addEventListener('click', outsideHandler);
      // Limpa handler quando o painel fecha
      const origHide = this.hideFloatPanel.bind(this);
      this.hideFloatPanel = function() {
        document.removeEventListener('click', outsideHandler);
        this.hideFloatPanel = origHide;
        origHide();
      };
    }
  },

  /** Carrega a ficha de memória do usuário (nuvem). Sem backend, fica quieto. */
  async _loadUserMemory(panel) {
    const textarea = panel.querySelector('#float-user-memory');
    if (!textarea) return;
    try {
      const online = await LizAPI.checkBackend();
      if (!online) return;
      const data = await LizAPI.getMemory();
      if (data && typeof data.content === 'string') textarea.value = data.content;
    } catch (e) {
      // memória é opcional — se não carregar, campo fica vazio
    }
  },

  /** Salva a ficha de memória na nuvem e avisa via toast */
  async _saveUserMemory(panel) {
    const textarea = panel.querySelector('#float-user-memory');
    const btn = panel.querySelector('#float-save-memory');
    if (!textarea) return;
    const content = textarea.value.trim().slice(0, 4000);
    if (btn) btn.disabled = true;
    try {
      await LizAPI.saveMemory(content);
      if (typeof LizChat !== 'undefined' && LizChat.toast) LizChat.toast('Memória salva');
    } catch (e) {
      if (typeof LizChat !== 'undefined' && LizChat.toast) LizChat.toast('Não consegui salvar a memória');
    } finally {
      if (btn) btn.disabled = false;
    }
  },
};
