/* ============================================================
 *  Liz Chat — chat.js
 *  Orquestra a aplicação: inicializa a UI, cuida do envio de
 *  mensagens, transição entre estados (inicial → conversa),
 *  resposta simulada e conecta os eventos do menu flutuante.
 * ============================================================ */

/**
 * Objeto principal do chat. Os métodos vivem nos módulos parciais
 * (js/chat/*.js) e são misturados aqui via Object.assign no fim do arquivo.
 * @property {Array<{role: string, content: string, time?: string}>} messages
 * @property {?string} currentTitle            Título da conversa atual.
 * @property {?string} currentConversationId   Id local da conversa (persistência por id).
 * @property {boolean} isGenerating            Lock: só uma geração por vez.
 * @property {boolean} _stopRequested          Usuário pediu para parar a geração.
 * @property {Object<string, Object<string, number>>} messageReactions Reações por índice de mensagem.
 * @property {boolean} isFocused               Modo foco ativo.
 * @property {?string} backendConversationId   Id da conversa no backend (quando online).
 * @property {string}  selectedModel           Modelo de IA ativo (localStorage 'liz-model').
 */
const LizChat = {
  /** Estado da conversa atual */
  messages: [],
  currentTitle: null,          // título da conversa atual
  currentConversationId: null, // id da conversa salva (persistência por id, não por título)
  isGenerating: false,         // lock: uma geração por vez
  _stopRequested: false,       // usuário pediu para parar a geração
  messageReactions: {},        // { [msgIndex]: { [reactionKey]: count } }
  isFocused: false,
  backendConversationId: null, // ID da conversa no backend (quando online)
  selectedModel: localStorage.getItem('liz-model') || 'liz-3', // modelo ativo

  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB

  init() {
    // Carrega conversas e uploads salvos
    LizData.loadSavedConversations();
    LizData.loadUploadedFiles();

    // 1. Monta a UI
    LizUI.init();
    LizUI.renderBrand();
    LizUI.renderSuggestions();
    LizUI.renderStarters();
    LizUI.renderPanels();
    LizUI.initTheme();
    LizUI.bindMessageActions();

    // 2. Componentes auxiliares
    LizUI.renderSearchBar();
    LizUI.renderScrollButton();
    LizUI.initDragDrop();

    // 3. Começa no estado inicial (coroa no centro)
    LizUI.showEmptyState();
    LizUI.updateSendState();

    // 4. Conecta eventos
    this._bindEvents();

    // 5. Aplica configurações salvas
    this.applyChatSettings();

    // 6. Otimização: pausa animações quando a página não está visível
    this._initVisibilityOptimization();

    // 7. Executa animação de introdução
    this.runIntroAnimation();

    // Sincroniza o histórico depois que o login foi confirmado.
    this._syncHistoryOnBoot();

    // Verifica disponibilidade do backend (não bloqueia)
    LizAPI.checkBackend().then((online) => {
      if (online) {
        console.log('%cLiz API → backend conectado ✓', 'color:#4ade80;font-weight:600');
      } else {
        console.log('%cLiz API → modo local (backend offline)', 'color:#facc15;font-weight:600');
      }
    });

    console.log('%cLiz Chat pronto ✨', 'color:#a78bfa;font-weight:600');
  },

};

/* ------------------------------------------------------------
 * Mistura os módulos parciais no objeto principal.
 * A API pública do LizChat continua exatamente a mesma.
 * ------------------------------------------------------------ */
Object.assign(
  LizChat,
  window.LizChatEvents,
  window.LizChatConversations,
  window.LizChatGeneration,
  window.LizChatAttachments,
  window.LizChatActions,
  window.LizChatIntro
);

/* ---------- Boot ---------- */
document.addEventListener('DOMContentLoaded', () => LizChat.init());
