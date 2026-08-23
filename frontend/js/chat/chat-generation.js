/* ============================================================
 *  Liz Chat — chat-generation.js
 *  Ciclo de geração: envio, lock/cooldown, parar, regenerar, continuar e streaming.
 *  Módulo parcial: é misturado no objeto LizChat pelo chat.js
 * ============================================================ */

window.LizChatGeneration = {
  /* ===========================================================
   * ENVIO DE MENSAGEM
   * =========================================================== */

  /**
   * Envia a mensagem do usuário: valida o texto, persiste localmente
   * e dispara a geração da resposta (real via backend ou simulada).
   * Respeita o lock de geração (isGenerating) e o cooldown do provedor.
   * @returns {void}
   */
  sendMessage() {
    const { el } = LizUI;
    if (this.isGenerating) return; // lock: uma resposta por vez
    if (Date.now() < this._cooldownUntil) {
      const rest = Math.ceil((this._cooldownUntil - Date.now()) / 1000);
      this.toast('Espera ' + rest + 's — o provedor tem limite de requisições');
      return;
    }
    const text = el.input.value.trim();
    if (!text) return;

    // Primeira mensagem → entra em modo conversa
    const wasEmpty = !this.messages.length;
    this.messages.push({ role: 'user', content: text, time: this._now() });
    if (wasEmpty) {
      const autoBase = LizData.autoTitleFromMessages(this.messages) || text.slice(0, 40);
      const title = LizUI.activeMode
        ? (LizConfig.suggestions.find((s) => s.id === LizUI.activeMode)?.status || 'Conversa') + ' — ' + autoBase
        : autoBase;
      this.currentTitle = title;
      LizUI.showConversation(title);
      LizUI.clearMode();
      LizUI.renderMessages(this.messages);
      LizUI.addExportButton();

    } else {
      LizUI.appendMessage(this.messages[this.messages.length - 1], this.messages.length - 1);
    }

    // Limpa o input
    el.input.value = '';
    this._autoResize(el.input);
    LizUI.updateSendState();

    // Salva progresso localmente e recebe um ID estável imediatamente.
    this._saveCurrentConversation();

    // A criação remota começa depois que o ID local já existe, permitindo
    // promovê-lo para o UUID definitivo sem duplicar a conversa.
    if (wasEmpty) {
      this._backendCreatePromise = this._tryCreateBackendConversation(this.currentTitle, this.currentConversationId);
    }

    // Resposta simulada
    this._simulateReply(text);
  },

  /* ===========================================================
   * LOCK DE GERAÇÃO + PARAR GERAÇÃO
   * =========================================================== */
  /** Ativa o lock de geração e o estado visual "gerando". @returns {void} */
  _beginGeneration() {
    this.isGenerating = true;
    this._stopRequested = false;
    LizUI.setGeneratingState(true);
  },

  /**
   * Encerra a geração (sempre chamado no finally). Se a resposta veio
   * do backend, inicia o cooldown antes do próximo envio.
   * @returns {void}
   */
  _endGeneration() {
    this.isGenerating = false;
    this._stopRequested = false;
    LizUI.setGeneratingState(false);
    // Chamada real ao provedor consome cota: cooldown curto antes do próximo
    // envio evita estourar o rate limit e tomar 429 em sequência.
    if (this._usedBackend) {
      this._usedBackend = false;
      this._startSendCooldown();
    }
  },

  /* ===========================================================
   * COOLDOWN PÓS-ENVIO (respeita o rate limit do provedor)
   * =========================================================== */
  SEND_COOLDOWN_MS: 15000,

  _startSendCooldown() {
    this._cooldownUntil = Date.now() + this.SEND_COOLDOWN_MS;
    LizUI.setCooldownState(true, this.SEND_COOLDOWN_MS);
    clearTimeout(this._cooldownTimer);
    this._cooldownTimer = setTimeout(() => {
      this._cooldownUntil = 0;
      LizUI.setCooldownState(false);
    }, this.SEND_COOLDOWN_MS);
  },

  /** Usuário clicou em "Parar geração". */
  stopGeneration() {
    if (!this.isGenerating) return;
    this._stopRequested = true;
    LizUI.removeTyping();
  },

  async _simulateReply(userText) {
    await this._streamReply(userText);
  },

  _pickReply(userText) {
    const t = userText.toLowerCase();
    const r = LizData.replies;
    if (/(c[oó]digo|codigo|fun[çc][aã]o|script|react|javascript|\bjs\b)/.test(t)) return r.code[0];
    if (/(design|ui|visual|cor|css|estilo)/.test(t)) return r.design[0];
    if (/(erro|error|bug|falha)/.test(t)) return r.error[0];
    if (/(ideia|ideias|brainstorm|nome|sugest)/.test(t)) return r.ideas[0];
    return r.default[0];
  },


  /* ===========================================================
   * REGENERAR RESPOSTA (Refazer)
   * =========================================================== */
  /**
   * Regenera a resposta da Liz numa mensagem existente (ação "Refazer").
   * Remove a resposta atual e gera outra a partir do texto do usuário.
   * @param {number} index Índice da mensagem da Liz na conversa.
   * @returns {Promise<void>}
   */
  async regenerateMessage(index) {
    if (index < 0 || index >= this.messages.length) return;
    if (this.messages[index].role !== 'liz') return;
    if (this.isGenerating) return;

    // Encontra a mensagem do usuário imediatamente anterior
    let userMsgIndex = index - 1;
    while (userMsgIndex >= 0 && this.messages[userMsgIndex].role !== 'user') {
      userMsgIndex--;
    }
    if (userMsgIndex < 0) return;

    const userText = this.messages[userMsgIndex].content;

    // Remove a resposta antiga
    this.messages.splice(index, 1);
    delete this.messageReactions[index];
    LizUI.renderMessages(this.messages);

    // Gera nova resposta com streaming
    this.toast('Gerando nova resposta...');
    await this._streamReply(userText, index);
  },

  /* ===========================================================
   * CONTINUAR RESPOSTA
   * =========================================================== */
  /**
   * Continua uma resposta da Liz que ficou truncada, anexando texto
   * ao final da mensagem existente.
   * @param {number} index Índice da mensagem da Liz na conversa.
   * @returns {Promise<void>}
   */
  async continueMessage(index) {
    if (index < 0 || index >= this.messages.length) return;
    if (this.messages[index].role !== 'liz') return;
    if (this.isGenerating) return;

    this._beginGeneration();
    try {
      this.toast('Continuando...');

      // Encontra a mensagem do usuário anterior pra contexto
      let userMsgIndex = index - 1;
      while (userMsgIndex >= 0 && this.messages[userMsgIndex].role !== 'user') {
        userMsgIndex--;
      }
      const userText = userMsgIndex >= 0 ? this.messages[userMsgIndex].content : '';

      // Gera continuacao e append na mensagem existente
      const continuation = this._pickContinuation(userText);
      await this._streamAppendToMessage(index, continuation);
    } finally {
      this._endGeneration();
    }
  },

  _pickContinuation(userText) {
    const continuations = [
      'Além disso, vale considerar que cada decisão de arquitetura tem um custo de manutenção a longo prazo. O que parece simples hoje pode cobrar juros amanhã.',
      'Outro ponto importante: teste o caminho infeliz antes do caminho feliz. Se o sistema não sabe lidar com erro, ele não está pronto.',
      'Pra complementar — se quiser aprofundar, posso detalhar qualquer um desses pontos ou mostrar um exemplo prático. É só pedir.',
    ];
    return continuations[Math.floor(Math.random() * continuations.length)];
  },

  /* ===========================================================
   * STREAMING SIMULADO
   * =========================================================== */
  /**
   * Gera a resposta da Liz com streaming palavra a palavra.
   * Tenta o backend primeiro; em caso de falha/ausência, usa resposta
   * simulada local. Sempre encerra via _endGeneration (finally).
   * @param {string} userText       Texto enviado pelo usuário.
   * @param {?number} insertAtIndex Índice onde inserir a resposta
   *                                (usado por regenerar/continuar); null = nova mensagem.
   * @returns {Promise<void>}
   */
  async _streamReply(userText, insertAtIndex) {
    this._beginGeneration();
    this._usedBackend = false;
    try {
      LizUI.showTyping();

      // Tenta backend primeiro
      let backendOnline = false;
      try {
        if (this._backendCreatePromise) await this._backendCreatePromise;
        backendOnline = await LizAPI.checkBackend();
        if (backendOnline) {
          // Requisição vai consumir cota do provedor (mesmo se falhar):
          // marca pra disparar o cooldown pós-envio.
          this._usedBackend = true;
          const response = await LizAPI.sendMessage(
            this.backendConversationId, userText, LizUI.activeMode || null, this.selectedModel
          );
          LizUI.removeTyping();
          if (this._stopRequested) return; // parou durante a espera
          if (response.conversationId) {
            const previousId = this.currentConversationId;
            this.backendConversationId = response.conversationId;
            if (previousId && String(previousId).startsWith('local_')) {
              LizData.promoteConversationId(previousId, response.conversationId);
            }
            this.currentConversationId = response.conversationId;
          }
          const content = response.assistantMessage?.content || response.reply || 'Sem resposta.';
          const msg = {
            role: 'liz',
            content,
            demo: response.demo === true,
            images: Array.isArray(response.assistantMessage?.images) ? response.assistantMessage.images : [],
            webResults: Array.isArray(response.assistantMessage?.webResults) ? response.assistantMessage.webResults : [],
            time: this._now(),
          };
          if (insertAtIndex !== undefined) {
            this.messages.splice(insertAtIndex, 0, msg);
          } else {
            this.messages.push(msg);
          }
          LizUI.renderMessages(this.messages);
          this._saveCurrentConversation();
          return;
        }
      } catch (e) {
        if (backendOnline) {
          // Backend online mas a chamada falhou: mostra o erro real.
          // Nunca inventa resposta — resposta fake disfarçada era o que
          // fazia parecer que a IA não funcionava.
          LizUI.removeTyping();
          if (this._stopRequested) return;
          LizAPI.online = false; // força nova checagem na próxima mensagem
          const errMsg = { role: 'liz', content: 'Não consegui falar com a IA agora (' + (e.message || 'erro de conexão') + '). Me pede de novo?', time: this._now() };
          if (insertAtIndex !== undefined) this.messages.splice(insertAtIndex, 0, errMsg);
          else this.messages.push(errMsg);
          LizUI.renderMessages(this.messages);
          this._saveCurrentConversation();
          return;
        }
        console.warn('Backend offline — usando modo local:', e.message);
      }

      if (this._stopRequested) { LizUI.removeTyping(); return; }

      // Fallback: simulação local com efeito de digitação
      await this._delay(400);
      LizUI.removeTyping();
      if (this._stopRequested) return;

      const fullText = this._pickReply(userText);
      const msg = { role: 'liz', content: '', time: this._now() };

      if (insertAtIndex !== undefined) {
        this.messages.splice(insertAtIndex, 0, msg);
      } else {
        this.messages.push(msg);
      }

      const msgIndex = insertAtIndex !== undefined ? insertAtIndex : this.messages.length - 1;

      // Se inseriu no meio da lista, re-renderiza tudo pra manter ordem DOM correta.
      // Se é a última posição, append simples basta.
      let node;
      if (insertAtIndex !== undefined && insertAtIndex < this.messages.length - 1) {
        LizUI.renderMessages(this.messages);
        node = LizUI.el.messagesList.querySelectorAll('.msg')[msgIndex];
      } else {
        node = LizUI.appendMessage(msg, msgIndex);
      }

      // Streaming: revela palavra por palavra
      await this._typeWords(node, fullText, msgIndex);
      this._saveCurrentConversation();
    } finally {
      this._endGeneration();
    }
  },

  async _streamAppendToMessage(index, continuationText) {
    const msg = this.messages[index];
    if (!msg) return;

    const msgs = LizUI.el.messagesList.querySelectorAll('.msg');
    const node = msgs[index];
    if (!node) return;

    const textEl = node.querySelector('.msg-text');
    if (!textEl) return;

    // Adiciona separador e streama a continuação
    const separator = '\n\n';
    const words = continuationText.split(' ');
    let accumulated = msg.content + separator;

    for (let i = 0; i < words.length; i++) {
      if (this._stopRequested) break;
      accumulated += (i > 0 ? ' ' : '') + words[i];
      msg.content = accumulated;
      textEl.innerHTML = LizUI._markdown(accumulated);
      await this._delay(25 + Math.random() * 20);
    }

    this._saveCurrentConversation();
  },

  async _typeWords(node, fullText, msgIndex) {
    const textEl = node.querySelector('.msg-text');
    if (!textEl) {
      this.messages[msgIndex].content = fullText;
      return;
    }

    const words = fullText.split(' ');
    let accumulated = '';

    for (let i = 0; i < words.length; i++) {
      if (this._stopRequested) break; // "Parar geração" — conteúdo parcial fica
      accumulated += (i > 0 ? ' ' : '') + words[i];
      this.messages[msgIndex].content = accumulated;
      textEl.innerHTML = LizUI._markdown(accumulated);
      LizUI._scrollToBottom();
      await this._delay(18 + Math.random() * 22);
    }
  },

};
