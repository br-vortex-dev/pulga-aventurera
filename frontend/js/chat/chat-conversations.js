/* ============================================================
 *  Liz Chat — chat-conversations.js
 *  Gestão de conversas: renomear/excluir, nova conversa, abrir por id, exportar e persistência.
 *  Módulo parcial: é misturado no objeto LizChat pelo chat.js
 * ============================================================ */

window.LizChatConversations = {
  /* ===========================================================
   * CONVERSAS — fixar, renomear, excluir (desktop)
   * =========================================================== */
  _renameConversationPrompt(conv) {
    if (!conv) return;
    const v = prompt('Novo título da conversa:', conv.title);
    if (v && v.trim() && LizData.renameConversation(conv.id, v)) {
      LizUI._renderConversations(LizUI.el.conversationsSearch?.value || '');
      this.toast('Conversa renomeada');
    }
  },

  _deleteConversationConfirm(id) {
    const conv = LizData.getConversationById(id);
    const title = conv ? conv.title : 'esta conversa';
    if (confirm('Excluir "' + title + '"? Essa ação não pode ser desfeita.')) {
      LizData.deleteConversation(id);
      LizUI._renderConversations(LizUI.el.conversationsSearch?.value || '');
      this.toast('Conversa excluída');
    }
  },


  /* ===========================================================
   * AÇÕES DE NAVEGAÇÃO
   * =========================================================== */

  /** Volta à tela inicial (coroa no centro). */
  newConversation() {
    // Cancela geração em andamento pra não escrever no array errado
    if (this.isGenerating) this._stopRequested = true;

    // Salva a conversa atual antes de limpar
    if (this.messages.length > 0) {
      this._saveCurrentConversation();
    }
    this.messages = [];
    this.currentTitle = null;
    this.currentConversationId = null;
    this.messageReactions = {};
    this.backendConversationId = null;
    this._backendCreatePromise = null;
    LizUI.showEmptyState();
    LizUI.clearMode();
    LizUI.el.title.textContent = 'Liz';
    LizUI.el.input.value = '';
    LizUI.updateSendState();
    LizUI.closePanel();
    LizUI.hideSearchBar();
    LizUI.removeExportButton();
    LizUI.el.input.focus();
  },

  /**
   * Abre uma conversa salva a partir do painel (por id — título pode colidir).
   * Restaura mensagens, título e vínculo com o backend quando existir.
   * @param {string} id Id local da conversa (LizData).
   * @returns {Promise<void>}
   */
  async openConversationById(id) {
    let savedConv = LizData.getConversationById(id);
    if (!savedConv) {
      this.toast('Conversa não encontrada');
      return;
    }

    // A listagem remota traz somente a última mensagem. Busca o detalhe
    // completo ao abrir uma conversa com UUID remoto.
    if (!String(id).startsWith('local_') && LizData.isBackendOnline && typeof LizAPI !== 'undefined') {
      try {
        const remote = await LizAPI.getConversation(id);
        const mapped = LizAPI.mapConversationToFrontend(remote);
        const index = LizData.savedConversations.findIndex((c) => String(c.id) === String(id));
        if (index >= 0) {
          LizData.savedConversations[index] = mapped;
          LizData._persistToLocalStorage();
        }
        savedConv = mapped;
      } catch (e) {
        console.warn('[LizChat] Não foi possível carregar a conversa completa:', e.message);
      }
    }

    // Cancela geração em andamento pra não contaminar a nova conversa
    if (this.isGenerating) this._stopRequested = true;

    this.messages = (savedConv.messages || []).map((m) => ({ ...m }));
    this.currentTitle = savedConv.title;
    this.currentConversationId = savedConv.id;
    this.messageReactions = {};
    LizUI.showConversation(this.currentTitle);
    LizUI.renderMessages(this.messages);
    LizUI.updateSendState();
    LizUI.addExportButton();
    LizUI.el.input.focus();
  },


  /* ===========================================================
   * EXPORTAR CONVERSA
   * =========================================================== */
  exportConversation() {
    if (this.messages.length === 0) {
      this.toast('Nenhuma mensagem para exportar');
      return;
    }

    const title = this.currentTitle || 'Conversa Liz';
    let md = '# ' + title + '\n\n' + 'Exportado em: ' + new Date().toLocaleString('pt-BR') + '\n\n---\n\n';

    this.messages.forEach((m) => {
      const prefix = m.role === 'user' ? '**Você:**' : '**Liz:**';
      md += prefix + ' ' + m.content + '\n';
      if (m.time) md += '*(' + m.time + ')*';
      md += '\n\n';
    });

    md += '---\n*Exportado por Liz Chat*';

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = title.replace(/[^a-zA-Z0-9À-ÿ ]/g, '').trim().slice(0, 50) + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.toast('Conversa exportada!');
  },

  /* ===========================================================
   * PERSISTÊNCIA
   * =========================================================== */
  /**
   * Salva (cria ou atualiza) a conversa atual no cache local.
   * Define o título na primeira gravação e mantém o mesmo id nas seguintes.
   * @returns {void}
   */
  _saveCurrentConversation() {
    if (this.messages.length === 0) return;
    const title = this.currentTitle || 'Nova conversa';
    if (!this.currentTitle) {
      this.currentTitle = title;
    }
    this.currentConversationId = LizData.saveConversation(
      this.currentTitle, this.messages, this.currentConversationId
    );
  },

  /** Tenta criar a conversa no backend (não bloqueia a UI) */
  async _tryCreateBackendConversation(title, localId) {
    try {
      const online = await LizAPI.checkBackend();
      if (online && !this.backendConversationId) {
        const res = await LizAPI.createConversation(title);
        if (res && res.id) {
          this.backendConversationId = res.id;
          const previousId = localId || this.currentConversationId;
          if (previousId && String(previousId).startsWith('local_')) {
            LizData.promoteConversationId(previousId, res.id);
          }
          this.currentConversationId = res.id;
          console.log('%cLiz API → conversa criada no backend: ' + res.id, 'color:#4ade80');
        }
      }
    } catch (e) {
      console.warn('Não foi possível criar conversa no backend:', e.message);
    }
  },

  /** Aguarda o login e sincroniza o histórico remoto sem travar a interface. */
  async _syncHistoryOnBoot() {
    try {
      const authPromise = typeof window !== 'undefined' ? window.lizAuthReadyPromise : null;
      const authenticated = authPromise ? await authPromise : true;
      if (authenticated === false) return;
      await LizData.syncWithBackend();
    } catch (e) {
      console.warn('[LizChat] Sincronização inicial indisponível:', e.message);
    }
  },
};
