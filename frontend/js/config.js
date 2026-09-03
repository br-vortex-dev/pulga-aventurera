/* ============================================================
 *  Liz Chat — config.js
 *  Configurações centrais: identidade da IA (coroa = logo
 *  oficial), design tokens e sugestões iniciais.
 *  Tudo que for "ajustável" mora aqui.
 * ============================================================ */

const LizConfig = {
  /* ---------- Identidade da IA ---------- */
  brand: {
    name: 'Liz',
    tagline: 'Sua assistência com inteligência.',
  },

  /* ---------- Tema ---------- */
  theme: {
    storageKey: 'liz-chat-theme',
    default: 'dark',
  },

  /* ---------- Modos (chips do estado inicial) ----------
     Cada chip é um MODO da Liz. Ao clicar, o chip fica ativo, o
     status da topbar muda, o placeholder do input muda e os cards
     específicos do modo aparecem. No estado inicial nenhum card
     aparece — a tela fica limpa. */
  suggestions: [
    { id: 'code',   label: 'Código', icon: 'code',    status: 'Código',  placeholder: 'Digite um comando, erro ou pedido de código...' },
    { id: 'design', label: 'Design', icon: 'sparkle', status: 'Design',  placeholder: 'Descreva a interface, componente ou paleta que quer criar...' },
    { id: 'errors', label: 'Erros',  icon: 'bug',     status: 'Debug',   placeholder: 'Cole o erro ou log que você quer analisar...' },
    { id: 'ideas',  label: 'Ideias', icon: 'bulb',    status: 'Ideias',  placeholder: 'Sobre o que você quer gerar ideias?' },
  ],

  /* ---------- Starters por modo (cards que aparecem ao escolher) ---------- */
  startersByMode: {
    code: [
      { icon: 'code',   title: 'Revisar uma função ou arquivo',   prompt: 'Revise meu código apontando bugs, gargalos de performance e más práticas. Diga a linguagem, cole o trecho ou arquivo, e mencione se há alguma restrição (ex: precisa rodar em produção, não pode usar libs externas).' },
      { icon: 'bolt',   title: 'Refatorar algo que funciona mas incomoda', prompt: 'Esse código funciona, mas está difícil de manter. Cole o trecho, diga a linguagem/framework, e me conta o que te irrita: nomes confusos, repetição, função gigante, ou tudo junto.' },
      { icon: 'prompt', title: 'Converter entre linguagens',       prompt: 'Preciso portar esse código. Cole o trecho, diga a linguagem de origem e a de destino, e se tem alguma dependência que preciso substituir ou evitar.' },
      { icon: 'code',   title: 'Travei e não sei como continuar', prompt: 'Estou escrevendo código e travei. Me diz: o que você está tentando fazer, em qual linguagem, o que já escreveu, e onde exatamente parou. Não precisa estar bonito — descreve do seu jeito.' },
    ],
    design: [
      { icon: 'layers',  title: 'Criar uma landing page',              prompt: 'Quero uma landing page. Me conta: o que é o produto/serviço, quem vai acessar, qual a única ação que o visitante precisa tomar, e se já tem alguma referência visual ou cor definida.' },
      { icon: 'sparkle', title: 'Adaptar interface pra mobile',        prompt: 'Tenho uma tela que precisa funcionar bem em celular. Cole o HTML/CSS ou descreva o layout, diga qual framework usa (se usa), e quais elementos são mais importantes de manter visíveis.' },
      { icon: 'sparkle', title: 'Definir paleta e tipografia',         prompt: 'Preciso de paleta e tipografia pra um projeto. Me diz: o que é o projeto, qual sensação quer passar (sério, leve, tech, editorial), e se já existe alguma cor ou fonte que precisa respeitar.' },
      { icon: 'layers',  title: 'Não tenho referência, só uma ideia vaga', prompt: 'Quero criar algo visual mas não sei descrever direito. Me conta: pra que serve, quem vai usar, e me dá 2 ou 3 palavras que definem o clima que você imagina. Eu monto a direção a partir disso.' },
    ],
    errors: [
      { icon: 'bug',    title: 'Erro no código / stack trace',         prompt: 'Cole o erro ou stack trace completo. Me diz: linguagem, framework, e o que você tentou antes de travar. Se tiver o trecho de código que dispara o erro, cola junto.' },
      { icon: 'prompt', title: 'Build ou deploy quebrado',             prompt: 'Meu build/deploy está falhando. Cole o log do erro, diga a ferramenta (Vite, Webpack, Docker, Vercel, CI...) e se funcionava antes ou se é a primeira vez que roda.' },
      { icon: 'bolt',   title: 'Funciona local, quebra em produção',   prompt: 'No meu ambiente funciona, mas em produção dá erro. Descreva: onde funciona, onde quebra, qual o erro exato, e se tem diferença de versão, config ou variável de ambiente entre os dois.' },
      { icon: 'bulb',   title: 'Não sei descrever o erro',             prompt: 'Algo está errado mas não sei explicar direito. Me conta: o que você esperava que acontecesse, o que aconteceu de fato, e em que momento parou de funcionar. Não precisa ter mensagem de erro — descreve o comportamento.' },
    ],
    ideas: [
      { icon: 'bulb',    title: 'Tirar um projeto do papel',            prompt: 'Quero começar um projeto novo. Me diz: o que ele resolve, pra quem, e qual stack você já domina ou quer aprender. Se não souber a stack, só descreve a ideia que eu sugiro.' },
      { icon: 'sparkle', title: 'Cortar escopo pra caber num MVP',      prompt: 'Tenho uma ideia grande e preciso reduzir pro mínimo viável. Descreva a visão completa — pode ser bagunçado — e me diz qual é o prazo ou restrição principal.' },
      { icon: 'bulb',    title: 'Travei no meio, preciso de próximos passos', prompt: 'Tenho um projeto em andamento e não sei qual o próximo passo. Me conta: o que já está pronto, o que falta, onde você parou, e o que te faz sentir travado.' },
      { icon: 'feather', title: 'Só tenho uma intuição, não uma ideia formada', prompt: 'Tenho um incômodo ou uma intuição mas não consigo transformar em projeto ainda. Me fala: qual problema te incomoda, pra quem você imagina resolvendo, e por que isso te interessa. Eu ajudo a dar forma.' },
    ],
  },

  /* ----------
   * Coroa oficial da Liz — SÍMBOLO PRINCIPAL.
   * É a mesma coroa usada no favicon e nas telas de Login/Cadastro.
   * Nunca substituir por robô/cérebro/estrela/ícone genérico.
   * Polygon roxo (#b040d0), viewBox 0 0 810 580.
   * ---------- */
  crown:
    '<svg viewBox="0 0 810 580" role="img" xmlns="http://www.w3.org/2000/svg" aria-label="Liz">' +
      '<polygon points="0,520 160,520 60,140 270,310 400,80 530,310 740,140 640,520 800,520" fill="#b040d0" stroke="none" />' +
    '</svg>',

  /* ----------
   * Ícones SVG inline reutilizáveis (traço fino, 24x24).
   * O ui.js injeta via innerHTML.
   * ---------- */
  icons: {
    newChat:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
    chats:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',
    tools:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.1-2.1z"/></svg>',
    settings:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    close:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    attach:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>',
    send:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    search:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    globe:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
    sun:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
    moon:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    code:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    sparkle:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/></svg>',
    bug:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="6" width="8" height="14" rx="4"/><path d="M9 6V4a3 3 0 0 1 6 0v2"/></svg>',
    bulb:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1V17h6v-.2c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z"/></svg>',
    prompt:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1M22 22l-5-10-5 10M14 18h6"/></svg>',
    layers:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
    bolt:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    feather:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><line x1="16" y1="8" x2="2" y2="22"/><line x1="17.5" y1="15" x2="9" y2="15"/></svg>',
    folder:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    copy:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
    continue:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h13M12 5l7 7-7 7"/></svg>',
    redo:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>',
    edit:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    trash:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    pin:       '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 3h6l1 7 2 2H6l2-2 1-7z"/></svg>',
    thumbsUp:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
    heart:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    smile:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    party:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    thinking:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    download:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
    filter:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
    arrowDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>',
    image:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
    gallery:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    file:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>',
    expand:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>',
    upload:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>',
    focus:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
    filesMenu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/><path d="M9 13h6M9 17h6"/></svg>',
    user:      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  },
};

// Exporta para o escopo global (projeto vanilla, sem bundler)
window.LizConfig = LizConfig;
