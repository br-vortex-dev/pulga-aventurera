/* ============================================================
 *  Liz Chat — api.js
 *  Camada de comunicação com o backend Express.
 *  Detecta automaticamente se o backend está online.
 *  Se offline, o frontend continua funcionando em modo local.
 * ============================================================ */

const LizAPI = {
  /* ---------- Configuração ---------- */
  // Base da API — resolvida automaticamente:
  //   1. window.LIZ_API_BASE (se definida antes deste arquivo) manda em tudo
  //   2. Na nuvem (domínio próprio, Pages, onrender...): backend publicado
  //   3. Em desenvolvimento local: backend de API na porta padrão de dev
  BASE_URL: (function resolveApiBase() {
    if (window.LIZ_API_BASE) return window.LIZ_API_BASE;
    const host = window.location.hostname;
    const isLocal = host === 'localhost' || host === '127.0.0.1';
    if (!isLocal) return 'https://liz-api.onrender.com/api';
    return 'http://localhost:3001/api';
  })(),
  // A Liz 3 é um modelo de raciocínio: pensa antes de responder.
  // O backend tenta até 3 vezes com backoff em caso de rate limit (429),
  // então o timeout precisa cobrir o pior caso (~2min) sem desistir cedo demais.
  TIMEOUT: 150000,
  online: false,
  _lastCheck: 0,
  _checkInterval: 30000, // re-verifica a cada 30s

  /* ---------- Health Check ---------- */
  async checkBackend() {
    const now = Date.now();
    if (now - this._lastCheck < this._checkInterval && this.online) {
      return this.online;
    }
    this._lastCheck = now;
    try {
      const res = await this._fetch('/health', { method: 'GET', timeout: 3000 });
      this.online = res && res.ok !== false;
    } catch (e) {
      this.online = false;
    }
    return this.online;
  },

  /* ---------- Conversas ---------- */

  /** Lista conversas com paginação */
  async getConversations(page = 1, limit = 20) {
    return this._fetch(`/conversations?page=${page}&limit=${limit}`);
  },

  /** Busca uma conversa pelo ID (com mensagens) */
  async getConversation(id) {
    return this._fetch(`/conversations/${id}`);
  },

  /** Cria uma nova conversa */
  async createConversation(title) {
    return this._fetch('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  },

  /** Renomeia uma conversa */
  async renameConversation(id, title) {
    return this._fetch(`/conversations/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  },

  /** Deleta uma conversa */
  async deleteConversation(id) {
    return this._fetch(`/conversations/${id}`, {
      method: 'DELETE',
    });
  },

  /** Fixa/desfixa uma conversa */
  async togglePinConversation(id, pinned) {
    return this._fetch(`/conversations/${id}/pin`, {
      method: 'PUT',
      body: JSON.stringify({ pinned }),
    });
  },

  /* ---------- Mensagens ---------- */

  /** Persiste uma mensagem isolada numa conversa (ex.: anexo de arquivo,
   *  que não passa pelo /chat/send). */
  async addMessage(conversationId, { content = '', role = 'user', file = null } = {}) {
    return this._fetch(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, role, file }),
    });
  },

  /**
   * Envia uma mensagem e recebe a resposta da IA.
   * Retorna: { conversationId, userMessage, assistantMessage }
   */
  async sendMessage(conversationId, content, mode, model) {
    return this._fetch('/chat/send', {
      method: 'POST',
      body: JSON.stringify({
        conversationId,
        message: content,
        mode: mode || null,
        model: model || 'liz-3',
      }),
      timeout: this.TIMEOUT,
    });
  },

  /** Carrega histórico de mensagens de uma conversa (paginação) */
  async getMessages(conversationId, page = 1, limit = 50) {
    return this._fetch(`/conversations/${conversationId}/messages?page=${page}&limit=${limit}`);
  },

  /* ---------- Memória do usuário ---------- */

  /** Busca a ficha de memória do usuário logado */
  async getMemory() {
    return this._fetch('/memory');
  },

  /** Salva/edita a ficha de memória do usuário logado */
  async saveMemory(content) {
    return this._fetch('/memory', {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
  },

  /* ---------- Upload ---------- */

  /** Envia um arquivo para o backend (storage privado: B2/local) */
  async uploadFile(file, conversationId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversationId', conversationId || '');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT);

    try {
      const res = await fetch(`${this.BASE_URL}/chat/upload`, {
        method: 'POST',
        body: formData,
        headers: await this._authHeaders(),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `HTTP ${res.status}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  },

  /** Lista os arquivos do usuário no storage */
  async getUploads() {
    return this._fetch('/uploads', { timeout: 15000 });
  },

  /** Remove um arquivo do storage */
  async deleteUpload(id) {
    return this._fetch(`/uploads/${id}`, { method: 'DELETE' });
  },

  /** Baixa um arquivo do storage com auth e devolve como dataUrl.
   *  Cache em memória: cada id é baixado uma vez por sessão. */
  _uploadCache: {},
  async getUploadDataUrl(id) {
    if (this._uploadCache[id]) return this._uploadCache[id];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.TIMEOUT);
    try {
      const res = await fetch(`${this.BASE_URL}/uploads/${id}`, {
        headers: await this._authHeaders(),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('falha ao ler arquivo'));
        reader.readAsDataURL(blob);
      });
      this._uploadCache[id] = dataUrl;
      return dataUrl;
    } finally {
      clearTimeout(timer);
    }
  },

  /* ---------- Mapeamento de roles ---------- */

  /** Converte role do backend ('assistant') para o frontend ('liz') */
  mapRoleToFrontend(role) {
    return role === 'assistant' ? 'liz' : role;
  },

  /** Converte role do frontend ('liz') para o backend ('assistant') */
  mapRoleToBackend(role) {
    return role === 'liz' ? 'assistant' : role;
  },

  /** Converte uma mensagem do backend para o formato do frontend */
  mapMessageToFrontend(msg) {
    return {
      role: this.mapRoleToFrontend(msg.role),
      content: msg.content,
      demo: msg.demo === true,
      images: Array.isArray(msg.images) ? msg.images.map((image) => ({
        url: typeof image.url === 'string' ? image.url : '',
        uploadId: typeof image.uploadId === 'string' ? image.uploadId : '',
        sourceUrl: typeof image.sourceUrl === 'string' ? image.sourceUrl : '',
        title: typeof image.title === 'string' ? image.title : '',
        creator: typeof image.creator === 'string' ? image.creator : '',
        license: typeof image.license === 'string' ? image.license : '',
        licenseUrl: typeof image.licenseUrl === 'string' ? image.licenseUrl : '',
        alt: typeof image.alt === 'string' ? image.alt : 'Imagem da Liz',
        source: typeof image.source === 'string' ? image.source : '',
      })) : [],
      webResults: Array.isArray(msg.webResults) ? msg.webResults.map((item) => ({
        title: typeof item.title === 'string' ? item.title : 'Resultado da busca',
        url: typeof item.url === 'string' ? item.url : '',
        description: typeof item.description === 'string' ? item.description : '',
        source: typeof item.source === 'string' ? item.source : '',
        age: typeof item.age === 'string' ? item.age : '',
        provider: typeof item.provider === 'string' ? item.provider : '',
        thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : '',
      })) : [],
      // Anexo: só a referência (uploadId) — a imagem é reidratada sob
      // demanda via getUploadDataUrl (atributo data-upload-id na tela).
      file: msg.file && msg.file.uploadId
        ? {
            name: msg.file.name,
            size: msg.file.size,
            type: msg.file.type,
            uploadId: msg.file.uploadId,
          }
        : undefined,
      time: msg.createdAt
        ? new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : msg.time || '',
    };
  },

  /** Converte uma conversa do backend para o formato do frontend */
  mapConversationToFrontend(conv) {
    return {
      id: conv.id,
      title: conv.title,
      pinned: !!conv.pinned,
      messages: (conv.messages || []).map((m) => this.mapMessageToFrontend(m)),
      lastMessage: conv.lastMessage ? {
        role: this.mapRoleToFrontend(conv.lastMessage.role),
        content: conv.lastMessage.content || '',
        time: conv.lastMessage.createdAt
          ? new Date(conv.lastMessage.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
          : '',
      } : null,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
    };
  },

  /* ---------- Auth: ID token do Firebase ----------
   * Toda chamada de dados anexa "Authorization: Bearer <token>".
   * O backend valida o token e devolve 401 sem sessão válida. */
  async _authHeaders() {
    try {
      if (typeof firebase !== 'undefined' && firebase.auth) {
        const auth = firebase.auth();
        const user = auth && auth.currentUser;
        if (user) {
          const token = await user.getIdToken();
          if (token) return { Authorization: `Bearer ${token}` };
        }
      }
    } catch (e) { /* sem sessão — segue sem header; o backend decide */ }
    return {};
  },

  /* ---------- Interno: fetch com timeout ---------- */
  async _fetch(endpoint, options = {}) {
    const { timeout = 8000, ...fetchOpts } = options;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(`${this.BASE_URL}${endpoint}`, {
        ...fetchOpts,
        headers: {
          'Content-Type': 'application/json',
          ...(await this._authHeaders()),
          ...(fetchOpts.headers || {}),
        },
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `HTTP ${res.status}`);
      }

      return await res.json();
    } catch (e) {
      if (e.name === 'AbortError') {
        throw new Error('Tempo esgotado — o backend não respondeu.');
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  },
};

window.LizAPI = LizAPI;
