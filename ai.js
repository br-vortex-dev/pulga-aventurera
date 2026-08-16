/* ============================================================
 *  Liz Chat Backend — ai.js
 *  Motor de resposta simulada. Mantém a mesma lógica de
 *  palavras-chave do frontend para consistência de produto.
 *  Quando houver IA real, troque apenas este módulo.
 * ============================================================ */

const REPLIES = {
  code: [
    'Claro! Aqui vai um exemplo limpo e comentado:\n\n```js\nfunction saudar(nome) {\n  return `Olá, ${nome}!`;\n}\n\nconsole.log(saudar("Victor"));\n```\n\nQuer que eu adapte para outra linguagem?',
  ],
  design: [
    'Para melhorar o design, sugiro três ajustes rápidos: **1)** aumentar o contraste do texto, **2)** alinhar os elementos a uma grid de 8px, **3)** usar uma única cor de destaque — o roxo já está ótimo!',
  ],
  error: [
    'Esse erro costuma indicar que algo não foi encontrado. Verifique: o nome da variável/função, se ela foi declarada antes do uso e se há algum `import` faltando. Cole a mensagem completa se quiser que eu analise melhor.',
  ],
  ideas: [
    'Vamos de brainstorm:\n\n1. Comece pelo problema que você resolve\n2. Liste 10 variações sem filtrar\n3. Teste falar em voz alta\n4. Veja o que te anima mais\n\nQuer que eu gere 10 ideias agora?',
  ],
  default: [
    'Entendi! Deixa comigo — aqui vai uma resposta direta e organizada pra te ajudar com isso.\n\nQuer que eu detalhe algum ponto específico?',
  ],
};

function classify(message) {
  const t = String(message || '').toLowerCase();
  if (/(c[oó]digo|codigo|fun[çc][aã]o|script|react|javascript|\bjs\b)/.test(t)) return 'code';
  if (/(design|ui|visual|cor|css|estilo)/.test(t)) return 'design';
  if (/(erro|error|bug|falha)/.test(t)) return 'error';
  if (/(ideia|ideias|brainstorm|nome|sugest)/.test(t)) return 'ideas';
  return 'default';
}

/**
 * Gera a resposta da assistente para uma mensagem.
 * @param {string} message  mensagem do usuário
 * @param {string|null} mode  modo ativo no frontend (code/design/errors/ideas)
 * @param {string} model  modelo selecionado (liz-3, nable-35, ...)
 * @returns {string} conteúdo da resposta
 */
function generateReply(message, mode, model) {
  const category = classify(message);
  const base = REPLIES[category][0];

  // Modelos diferentes ganham variação sutil de sufixo — mantém o produto
  // honesto (simulação) sem repetir texto idêntico em conversas longas.
  if (model && model !== 'liz-3') {
    const suffixes = {
      'liz-3-flash': '\n\n(Resposta gerada pelo Liz 3 Flash — modo rápido.)',
      'nable-35-mini': '\n\nSe quiser, posso aprofundar qualquer ponto dessa resposta.',
      'nable-35': '\n\nPosso detalhar cada parte com exemplos práticos, se ajudar.',
    };
    if (suffixes[model]) return base + suffixes[model];
  }
  return base;
}

/** Latência simulada (ms) — evita resposta instantânea artificial. */
function simulatedDelay() {
  return 350 + Math.floor(Math.random() * 500);
}

module.exports = { generateReply, simulatedDelay, classify };
