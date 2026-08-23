/* ============================================================
 *  Liz — settings-pages.js
 *  Templates HTML das páginas de ajustes (aparência, notificações, chat etc.).
 *  Módulo parcial: é misturado ao objeto principal pelo entrypoint.
 * ============================================================ */

window.LizSettingsPages = {
  _getPageHTML(pageId) {
    const pages = {
      appearance: `
        <div class="liz-float-settings-page">
          <div class="settings-group">
            <p class="settings-label">Tema</p>
            <div class="segmented" id="float-appearance-segmented">
              <button class="seg-btn" data-theme-val="dark" type="button">Escuro</button>
              <button class="seg-btn" data-theme-val="light" type="button">Claro</button>
              <button class="seg-btn" data-theme-val="auto" type="button">Automático</button>
            </div>
          </div>
          <div class="settings-group">
            <p class="settings-label">Tamanho da Fonte</p>
            <div class="segmented" id="float-font-size-segmented">
              <button class="seg-btn" data-font-size="small" type="button">Pequena</button>
              <button class="seg-btn" data-font-size="medium" type="button">Média</button>
              <button class="seg-btn" data-font-size="large" type="button">Grande</button>
            </div>
          </div>
          <div class="settings-group">
            <p class="settings-label">Cor de Destaque</p>
            <div class="accent-color-grid" id="float-accent-color-grid">
              <button class="accent-color-btn is-active" data-accent="purple" type="button" style="--accent-color:#8b5cf6" aria-label="Roxo"></button>
              <button class="accent-color-btn" data-accent="blue" type="button" style="--accent-color:#3b82f6" aria-label="Azul"></button>
              <button class="accent-color-btn" data-accent="green" type="button" style="--accent-color:#10b981" aria-label="Verde"></button>
              <button class="accent-color-btn" data-accent="rose" type="button" style="--accent-color:#f43f5e" aria-label="Rosa"></button>
            </div>
          </div>
          <div class="settings-group">
            <p class="settings-label">Personalização</p>
            <label class="settings-row">
              <span>Como a Liz te chama</span>
              <input type="text" class="settings-input" id="float-user-name-input" value="${LizUI._esc(localStorage.getItem('liz-user-name') || '')}" placeholder="Seu nome" />
            </label>
          </div>
        </div>`,
      notifications: `
        <div class="liz-float-settings-page">
          <div class="settings-group">
            <p class="settings-label">Notificações</p>
            <label class="settings-toggle">
              <input type="checkbox" id="float-notifications" checked />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Notificações de mensagens</span>
            </label>
            <label class="settings-toggle">
              <input type="checkbox" id="float-notification-sound" checked />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Som de notificação</span>
            </label>
            <label class="settings-toggle">
              <input type="checkbox" id="float-notification-vibrate" checked />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Vibrar ao receber mensagem</span>
            </label>
            <label class="settings-toggle">
              <input type="checkbox" id="float-notification-preview" />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Prévia da mensagem</span>
            </label>
            <label class="settings-toggle">
              <input type="checkbox" id="float-notification-group" checked />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Agrupar notificações</span>
            </label>
          </div>
        </div>`,
      chat: `
        <div class="liz-float-settings-page">
          <div class="settings-group">
            <p class="settings-label">Comportamento</p>
            <label class="settings-toggle">
              <input type="checkbox" id="float-show-suggestions" checked />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Mostrar sugestões iniciais</span>
            </label>
            <label class="settings-toggle">
              <input type="checkbox" id="float-continuation-suggestions" checked />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Sugestões de continuação</span>
            </label>
            <label class="settings-toggle">
              <input type="checkbox" id="float-timestamp" checked />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Mostrar timestamp</span>
            </label>
          </div>
          <div class="settings-group">
            <p class="settings-label">Aparência</p>
            <label class="settings-toggle">
              <input type="checkbox" id="float-animations" checked />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Animações suaves</span>
            </label>
            <label class="settings-toggle">
              <input type="checkbox" id="float-glow" checked />
              <span class="toggle-track"><span class="toggle-thumb"></span></span>
              <span class="toggle-text">Brilho roxo premium</span>
            </label>
          </div>
        </div>`,
      history: `
        <div class="liz-float-settings-page">
          <div class="settings-group">
            <p class="settings-label">Histórico</p>
            <div class="settings-info-row">
              <span class="settings-info-text" id="float-history-count">0 conversas</span>
              <span class="settings-info-text" id="float-files-count">0 arquivos</span>
            </div>
            <div class="settings-actions-row">
              <button class="settings-action-btn" id="float-export-all" type="button">
                <span class="settings-action-btn-ico">${LizConfig.icons.download || ''}</span>
                Exportar conversas
              </button>
              <button class="settings-action-btn settings-action-btn-danger" id="float-clear-history" type="button">
                <span class="settings-action-btn-ico settings-action-btn-ico-danger">${LizConfig.icons.trash || ''}</span>
                Limpar histórico
              </button>
            </div>
          </div>
        </div>`,
      shortcuts: `
        <div class="liz-float-settings-page">
          <div class="settings-group">
            <p class="settings-label">Atalhos de Teclado</p>
            <div class="shortcuts-grid">
              <div class="shortcut-row"><kbd class="shortcut-key">Enter</kbd><span class="shortcut-desc">Enviar mensagem</span></div>
              <div class="shortcut-row"><kbd class="shortcut-key">Shift</kbd><span class="shortcut-plus">+</span><kbd class="shortcut-key">Enter</kbd><span class="shortcut-desc">Nova linha</span></div>
              <div class="shortcut-row"><kbd class="shortcut-key">⌘/Ctrl</kbd><span class="shortcut-plus">+</span><kbd class="shortcut-key">N</kbd><span class="shortcut-desc">Nova conversa</span></div>
              <div class="shortcut-row"><kbd class="shortcut-key">⌘/Ctrl</kbd><span class="shortcut-plus">+</span><kbd class="shortcut-key">F</kbd><span class="shortcut-desc">Buscar na conversa</span></div>
              <div class="shortcut-row"><kbd class="shortcut-key">⌘/Ctrl</kbd><span class="shortcut-plus">+</span><kbd class="shortcut-key">E</kbd><span class="shortcut-desc">Modo foco</span></div>
              <div class="shortcut-row"><kbd class="shortcut-key">Esc</kbd><span class="shortcut-desc">Fechar painel</span></div>
              <div class="shortcut-row"><kbd class="shortcut-key">Espaço</kbd><span class="shortcut-desc">Abrir/Recolher menu</span></div>
            </div>
          </div>
        </div>`,
      memory: `
        <div class="liz-float-settings-page">
          <div class="settings-group">
            <p class="settings-label">O que a Liz lembra de você</p>
            <p class="liz-memory-hint">Fatos duradouros (nome, projetos, gostos, preferências) que a Liz usa em toda conversa. Ela atualiza sozinha com o tempo — e você pode editar ou apagar aqui.</p>
            <textarea class="liz-memory-textarea" id="float-user-memory" rows="6" maxlength="4000" placeholder="Ex.: Me chamo Ana, sou designer, prefiro respostas curtas e diretas..."></textarea>
            <button class="settings-action-btn" id="float-save-memory" type="button">
              <span class="settings-action-btn-ico">${LizConfig.icons.sparkle || ''}</span>
              Salvar memória
            </button>
          </div>
          <div class="settings-group">
            <p class="settings-label">Armazenamento</p>
            <div class="memory-info">
              <div class="memory-bar-track">
                <div class="memory-bar-fill" id="float-memory-bar-fill" style="width: 0%"></div>
              </div>
              <div class="memory-details">
                <span id="float-memory-used-text">Calculando...</span>
                <span class="memory-limit-text">~5 MB</span>
              </div>
            </div>
          </div>
          <div class="settings-group">
            <p class="settings-label">Gerenciamento</p>
            <button class="settings-action-btn" id="float-clear-cache" type="button">
              <span class="settings-action-btn-ico">${LizConfig.icons.trash || ''}</span>
              Limpar cache do navegador
            </button>
          </div>
        </div>`,
      account: `
        <div class="liz-float-settings-page">
          <div class="settings-group">
            <p class="settings-label">Conta</p>
            <div class="account-card">
              <div class="account-avatar"><span class="account-avatar-letter">${this._initial()}</span></div>
              <div class="account-info">
                <span class="account-name">${this._userName()}</span>
                <span class="account-email">${LizUI._esc(this._userEmail() || 'Sem email definido')}</span>
                <span class="account-plan">Plano Gratuito</span>
              </div>
            </div>
            <label class="settings-row" style="margin-top: 10px;">
              <span>Email</span>
              <input type="email" class="settings-input" id="float-email-input" value="${LizUI._esc(this._userEmail())}" placeholder="seu@email.com" />
            </label>
          </div>
        </div>`,
      language: `
        <div class="liz-float-settings-page">
          <div class="settings-group">
            <p class="settings-label">Idioma</p>
            <div class="settings-row">
              <span>Idioma</span>
              <div class="settings-dropdown" id="float-language" data-value="${localStorage.getItem('liz-language') || 'pt-BR'}">
                <button class="settings-dropdown-btn" type="button">
                  <span class="settings-dropdown-label">${(localStorage.getItem('liz-language') || 'pt-BR') === 'pt-BR' ? 'Português' : (localStorage.getItem('liz-language') === 'en' ? 'English' : 'Español')}</span>
                  <span class="settings-dropdown-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
                </button>
                <div class="settings-dropdown-menu">
                  <button class="settings-dropdown-item${(localStorage.getItem('liz-language') || 'pt-BR') === 'pt-BR' ? ' is-active' : ''}" data-val="pt-BR" type="button">Português</button>
                  <button class="settings-dropdown-item${localStorage.getItem('liz-language') === 'en' ? ' is-active' : ''}" data-val="en" type="button">English</button>
                  <button class="settings-dropdown-item${localStorage.getItem('liz-language') === 'es' ? ' is-active' : ''}" data-val="es" type="button">Español</button>
                </div>
              </div>
            </div>
          </div>
          <div class="settings-group">
            <p class="settings-label">Regional</p>
            <div class="settings-row">
              <span>Formato de data</span>
              <div class="settings-dropdown" id="float-date-format" data-value="${localStorage.getItem('liz-date-format') || 'DMY'}">
                <button class="settings-dropdown-btn" type="button">
                  <span class="settings-dropdown-label">${(localStorage.getItem('liz-date-format') || 'DMY') === 'DMY' ? 'Dia/Mês/Ano' : 'Mês/Dia/Ano'}</span>
                  <span class="settings-dropdown-arrow"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></span>
                </button>
                <div class="settings-dropdown-menu">
                  <button class="settings-dropdown-item${(localStorage.getItem('liz-date-format') || 'DMY') === 'DMY' ? ' is-active' : ''}" data-val="DMY" type="button">Dia/Mês/Ano</button>
                  <button class="settings-dropdown-item${localStorage.getItem('liz-date-format') === 'MDY' ? ' is-active' : ''}" data-val="MDY" type="button">Mês/Dia/Ano</button>
                </div>
              </div>
            </div>
          </div>
        </div>`,
    };
    return pages[pageId] || '';
  },
};
