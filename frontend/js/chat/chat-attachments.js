/* ============================================================
 *  Liz Chat — chat-attachments.js
 *  Upload de arquivos: validação, anexo e resposta simulada para arquivos.
 *  Módulo parcial: é misturado no objeto LizChat pelo chat.js
 * ============================================================ */

window.LizChatAttachments = {
  /* ===========================================================
   * UPLOAD DE ARQUIVOS
   * =========================================================== */
  _handleFiles(files) {
    const validFiles = [];
    for (const file of files) {
      if (file.size > this.MAX_FILE_SIZE) {
        this.toast('Arquivo muito grande (máx. 10 MB): ' + file.name);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length === 0) return;

    validFiles.forEach((file, i) => {
      this._attachFile(file, i === validFiles.length - 1);
    });
  },

  /** Anexa um arquivo: envia pro storage do backend (B2) quando online;
   *  se falhar, degrada para base64 local (mesma convenção do chat). */
  async _attachFile(file, isLast) {
    const dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });

    // Tenta mandar pro backend primeiro (o conteúdo fica no storage privado)
    let upload = null;
    try {
      if (await LizAPI.checkBackend()) {
        upload = await LizAPI.uploadFile(file, this.backendConversationId);
      }
    } catch (e) {
      console.warn('[LizChat] Upload pro backend falhou, usando modo local:', e.message);
    }

    const wasEmpty = !this.messages.length;
    const msg = {
      role: 'user',
      content: '',
      file: {
        name: file.name,
        size: file.size,
        type: file.type,
        dataUrl,
        uploadId: upload ? upload.id : undefined,
        url: upload ? upload.url : undefined,
      },
      time: this._now(),
    };
    this.messages.push(msg);

    if (wasEmpty) {
      const title = 'Arquivo: ' + file.name.slice(0, 30);
      this.currentTitle = title;
      LizUI.showConversation(title);
      LizUI.clearMode();
      LizUI.renderMessages(this.messages);
      LizUI.addExportButton();
    } else {
      LizUI.appendMessage(this.messages[this.messages.length - 1], this.messages.length - 1);
    }

    // Salva no histórico de uploads (com uploadId o base64 não é persistido)
    LizData.saveUploadedFile({
      name: file.name,
      size: file.size,
      type: file.type,
      dataUrl: upload ? undefined : dataUrl,
      uploadId: upload ? upload.id : undefined,
      url: upload ? upload.url : undefined,
      convTitle: this.currentTitle || 'Nova conversa',
    });

    this._saveCurrentConversation();

    // Persiste a mensagem de arquivo na nuvem (histórico entre dispositivos):
    // o conteúdo está no B2 (uploadId), o banco guarda só a referência.
    if (upload) {
      try {
        if (this._backendCreatePromise) await this._backendCreatePromise;
        if (!this.backendConversationId) {
          await this._tryCreateBackendConversation(this.currentTitle || 'Nova conversa', this.currentConversationId);
        }
        if (this.backendConversationId) {
          await LizAPI.addMessage(this.backendConversationId, {
            content: '',
            role: 'user',
            file: { uploadId: upload.id, name: file.name, size: file.size, type: file.type },
          });
        }
      } catch (e) {
        console.warn('[LizChat] Não deu pra salvar o anexo na nuvem:', e.message);
      }
    }

    // Se for o último arquivo, simula resposta
    if (isLast) {
      this._simulateFileReply(file);
    }
  },

  async _simulateFileReply(file) {
    this._beginGeneration();
    try {
      LizUI.showTyping();
      await this._delay(900);
      LizUI.removeTyping();
      if (this._stopRequested) return;

      const isImage = file.type && file.type.startsWith('image/');
      let reply;
      if (isImage) {
        reply = 'Recebi sua imagem! Posso analisá-la, descrevê-la ou ajudar com edições. O que você gostaria de fazer?';
      } else {
        reply = 'Arquivo recebido! Posso ler o conteúdo, resumir ou extrair informações. Me diga o que precisa.';
      }

      const msg = { role: 'liz', content: reply, demo: true, time: this._now() };
      this.messages.push(msg);
      LizUI.appendMessage(msg, this.messages.length - 1);
      this._saveCurrentConversation();

      // Espelha a resposta local na nuvem (não bloqueia a UI)
      if (this.backendConversationId) {
        LizAPI.addMessage(this.backendConversationId, {
          content: reply,
          role: 'assistant',
          demo: true,
        }).catch(() => { /* conversa segue salva no cache local */ });
      }
    } finally {
      this._endGeneration();
    }
  },

};
