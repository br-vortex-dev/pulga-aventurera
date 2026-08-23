/* ============================================================
 *  Liz Chat — chat-actions.js
 *  Ações sobre mensagens: editar, apagar e reagir.
 *  Módulo parcial: é misturado no objeto LizChat pelo chat.js
 * ============================================================ */

window.LizChatActions = {
  /* ===========================================================
   * EDIÇÃO DE MENSAGEM
   * =========================================================== */
  editMessage(index, newText) {
    if (index < 0 || index >= this.messages.length) return;
    this.messages[index].content = newText;
    this.messages[index].edited = true;
    // Re-renderiza só esta mensagem
    const newHTML = LizUI._messageHTML(this.messages[index], index);
    LizUI.replaceMessageAtIndex(index, newHTML);
    this._saveCurrentConversation();
    this.toast('Mensagem editada');
  },


  /* ===========================================================
   * DELEÇÃO DE MENSAGEM
   * =========================================================== */
  deleteMessage(index) {
    if (index < 0 || index >= this.messages.length) return;
    this.messages.splice(index, 1);
    // Remove reações associadas
    delete this.messageReactions[index];
    // Re-indexa reações para índices > index
    const newReactions = {};
    Object.keys(this.messageReactions).forEach((key) => {
      const k = parseInt(key);
      if (k > index) {
        newReactions[k - 1] = this.messageReactions[k];
      } else if (k < index) {
        newReactions[k] = this.messageReactions[k];
      }
    });
    this.messageReactions = newReactions;

    if (this.messages.length === 0) {
      this.newConversation();
      this.toast('Mensagem apagada');
      return;
    }
    LizUI.renderMessages(this.messages);
    this._saveCurrentConversation();
    this.toast('Mensagem apagada');
  },

  /* ===========================================================
   * REAÇÕES
   * =========================================================== */
  toggleReaction(msgIndex, reactionKey) {
    if (!this.messageReactions[msgIndex]) {
      this.messageReactions[msgIndex] = {};
    }
    const current = this.messageReactions[msgIndex][reactionKey] || 0;
    // Alterna entre 0 e 1 (like/unlike simples)
    this.messageReactions[msgIndex][reactionKey] = current > 0 ? 0 : 1;
    // Re-renderiza a mensagem
    const msg = this.messages[msgIndex];
    if (msg) {
      const newHTML = LizUI._messageHTML(msg, msgIndex);
      LizUI.replaceMessageAtIndex(msgIndex, newHTML);
    }
  },

};
