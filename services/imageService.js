/* ============================================================
 * Liz Chat Backend — services/imageService.js
 * Busca imagens abertas e normaliza respostas de geração de imagens.
 * Chaves e chamadas de provedores ficam exclusivamente no backend.
 * ============================================================ */

const crypto = require('node:crypto');
const Attachment = require('../models/attachment');
const storage = require('../config/storage');
const { ApiError } = require('./aiClient');

const MAX_RESULTS = 6;
// Pede mais resultados do que mostra pra poder sortear — sem isso o
// Openverse devolve sempre as mesmas 6 imagens pra mesma query.
const SEARCH_POOL = 20;
// Abaixo disso a busca em português provavelmente não casou com o
// índice (majoritariamente inglês) — tenta tradução/simplificação.
const MIN_GOOD_RESULTS = 2;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const OPENVERSE_URL = 'https://api.openverse.org/v1/images/';

function withTimeout(ms = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return { controller, done: () => clearTimeout(timer) };
}

function safeHttpUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'https:' ? url.toString() : null;
  } catch (_) {
    return null;
  }
}

/* ---------- Detecção de intenção ----------
 * A versão anterior exigia verbos muito específicos ("pesquise",
 * "mostre") e perdia pedidos naturais como "quero imagens de gatos"
 * ou "imagens de gato laranja com branco". Agora: verbos ampliados,
 * texto normalizado sem acentos e pedido sem verbo ("imagens de X")
 * também conta como busca. */

function normalizeForDetection(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const IMAGE_WORDS_RE = /\b(imagem|imagens|foto|fotos|fotografia|fotografias|figura|figuras|ilustracao|ilustracoes|desenho|desenhos|image|images|picture|pictures|wallpaper|wallpapers)\b/;

const SEARCH_VERBS_RE = /\b(ache|achar|achou|encontre|encontrar|encontra|busque|buscar|busca|procure|procurar|procuro|pesquise|pesquisar|pesquisa|mostre|mostra|mostrar|mande|manda|mandar|envie|enviar|envia|quero|quer|queira|ver|veja|vejo|ve|cade|gostaria|preciso)\b/;

const GENERATION_VERBS_RE = /\b(crie|cria|criar|gere|gera|gerar|desenhe|desenhar|faca|fazer|pinte|pintar|invente|inventar)\b/;

function isImageRequest(text) {
  const value = normalizeForDetection(text);
  if (!IMAGE_WORDS_RE.test(value)) return null;

  const mentionsSearch = SEARCH_VERBS_RE.test(value) || /\bme\s+de\b/.test(value);
  const mentionsGeneration = GENERATION_VERBS_RE.test(value);

  if (mentionsSearch) return { kind: 'search', query: extractQuery(text) };
  if (mentionsGeneration) {
    return { kind: 'generate', prompt: extractQuery(text) || String(text).trim() };
  }

  // Pedido sem verbo: "imagens de gato laranja com branco". Exige uma
  // preposição ("de/da/sobre") e mensagem curta pra não transformar
  // qualquer menção a fotos em busca.
  const short = value.split(/\s+/).length <= 12;
  if (short && /\b(de|do|da|dos|das|sobre)\b/.test(value)) {
    return { kind: 'search', query: extractQuery(text) };
  }
  return null;
}

const QUERY_STOPWORDS =
  'por favor|pode|poderia|me|mim|uma|um|umas|uns|as|os|a|o|' +
  'ache|achar|achou|encontre|encontrar|encontra|busque|buscar|busca|' +
  'procure|procurar|procuro|pesquise|pesquisar|pesquisa|mostre|mostra|mostrar|' +
  'mande|manda|mandar|envie|enviar|envia|crie|cria|criar|gere|gera|gerar|' +
  'desenhe|desenhar|fa[cç]a|fazer|pinte|pintar|invente|inventar|' +
  'imagem|imagens|foto|fotos|fotografia|fotografias|figura|figuras|' +
  'ilustra[cç][aã]o|ilustra[cç][oõ]es|desenho|desenhos|' +
  'image|images|picture|pictures|wallpaper|wallpapers|' +
  'quero|quer|queira|ver|veja|vejo|cad[eê]|gostaria|preciso|tem|pra|para|' +
  'd[eê]|da|d[aá]|v[eê]|voc[eê]';

function extractQuery(text) {
  // \b não funciona em volta de acentos ("dragão" → \bo\b casa dentro da
  // palavra), então casa os stopwords por fronteira de espaço/início/fim.
  const stopRe = new RegExp('(^|\\s)(?:' + QUERY_STOPWORDS + ')(?=$|\\s)', 'gi');
  return String(text || '')
    .replace(/[?!.,;:()"]/g, ' ')
    .replace(stopRe, '$1')
    // "gostaria de ver fotos de praia" → sobram preposições encadeadas
    // no início; remove todas de uma vez.
    .replace(/^\s*(?:(?:de|do|da|dos|das|sobre)\s+)+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

/* ---------- Tradução da query (PT → EN) ----------
 * O índice do Openverse é majoritariamente em inglês: "gato laranja
 * com branco" casa com quase nada, "orange and white cat" casa com
 * centenas. Tradução leve com o provedor já configurado — timeout
 * curto e tentativa única pra nunca atrasar a busca; se falhar, o
 * fallback por simplificação de palavras assume. */

// Sinais de que a query está em português (acentos ou palavras comuns).
const PT_HINTS_RE = /[áàâãéêíóôõúç]|\b(de|do|da|dos|das|com|para|pra|uma|um|e|ao|aos|no|na|nos|nas|gato|gata|gatos|cachorro|cavalo|passaro|peixe|coelho|praia|montanha|floresta|cidade|campo|noite|pôr do sol|laranja|branco|preto|azul|verde|vermelho|amarelo|roxo|rosa|marrom|cinza|filhote|dormindo)\b/i;

async function translateQuery(query) {
  const url = process.env.AI_API_URL;
  if (!url || !PT_HINTS_RE.test(query)) return null;
  const { controller, done } = withTimeout(6000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.AI_API_KEY ? { Authorization: `Bearer ${process.env.AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'Translate this image search query from Portuguese to English. Reply with ONLY the English keywords (max 6 words). No quotes, no punctuation, no explanation.',
          },
          { role: 'user', content: query },
        ],
        max_tokens: 30,
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = await response.json();
    const translated = String(data?.choices?.[0]?.message?.content || '')
      .trim()
      .replace(/^["'`]+|["'`]+$/g, '')
      .slice(0, 120);
    if (!translated || translated.toLowerCase() === query.toLowerCase()) return null;
    return translated;
  } catch (_) {
    return null;
  } finally {
    done();
  }
}

/* ---------- Busca no Openverse ---------- */

/** Gera URL relativa do proxy de imagens do backend. */
function proxyImageUrl(originalUrl) {
  if (!originalUrl) return '';
  return '/api/proxy-image?url=' + encodeURIComponent(originalUrl);
}

/** Busca crua no Openverse (pool maior que o exibido). */
async function queryOpenversePool(query) {
  const { controller, done } = withTimeout();
  try {
    const url = `${OPENVERSE_URL}?q=${encodeURIComponent(query)}&page_size=${SEARCH_POOL}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new ApiError(502, 'A busca de imagens não respondeu');
    const data = await response.json();
    return Array.isArray(data.results) ? data.results : [];
  } finally {
    done();
  }
}

/** Converte um resultado do Openverse pro formato da API. */
function toResultItem(item) {
  const fullUrl = safeHttpUrl(item.url);
  // Galeria carrega o thumbnail (~30 KB); a imagem cheia fica pro expand.
  const thumbUrl = safeHttpUrl(item.thumbnail) || fullUrl;
  return {
    url: proxyImageUrl(thumbUrl),
    fullUrl: proxyImageUrl(fullUrl),
    sourceUrl: safeHttpUrl(item.foreign_landing_url || item.detail_url),
    title: String(item.title || 'Imagem encontrada').slice(0, 180),
    creator: String(item.creator || '').slice(0, 120),
    license: String(item.license || '').slice(0, 80),
    licenseUrl: safeHttpUrl(item.license_url),
    source: 'Openverse',
  };
}

/** Sorteia MAX_RESULTS do pool (Fisher–Yates) e converte. */
function pickResults(pool) {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, MAX_RESULTS).map(toResultItem).filter((item) => item.url);
}

/** Variantes mais curtas da query: remove palavras do fim, uma a uma. */
function buildFallbackCandidates(query) {
  const words = query.split(/\s+/);
  const candidates = [];
  for (let n = words.length - 1; n >= 2 && candidates.length < 3; n--) {
    candidates.push(words.slice(0, n).join(' '));
  }
  return candidates;
}

async function searchOpenverse(query) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return [];

  let direct;
  try {
    direct = await queryOpenversePool(cleanQuery);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'Não consegui buscar imagens agora');
  }
  if (direct.length >= MIN_GOOD_RESULTS) return pickResults(direct);

  // Poucos resultados: tenta em paralelo a tradução pro inglês e a
  // simplificação progressiva da query original. Cada tentativa falha
  // isolada sem derrubar as demais.
  const attempts = [
    translateQuery(cleanQuery).then((translated) => {
      if (!translated) return [];
      return queryOpenversePool(translated).catch(() => []);
    }),
    ...buildFallbackCandidates(cleanQuery).map((candidate) => queryOpenversePool(candidate).catch(() => [])),
  ];
  const pools = await Promise.all(attempts);

  let best = direct;
  for (const pool of pools) {
    if (pool.length > best.length) best = pool;
  }
  return pickResults(best);
}

/* ---------- Geração de imagens ---------- */

function decodeBase64Image(value) {
  const match = String(value || '').match(/^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/=\s]+)$/i);
  if (!match) return null;
  const body = Buffer.from(match[2], 'base64');
  if (!body.length || body.length > MAX_IMAGE_BYTES) throw new ApiError(502, 'Imagem gerada excede o limite permitido');
  return { body, contentType: match[1].toLowerCase() };
}

async function downloadGeneratedImage(url) {
  const safeUrl = safeHttpUrl(url);
  if (!safeUrl) return null;
  const { controller, done } = withTimeout(30000);
  try {
    const response = await fetch(safeUrl, { signal: controller.signal });
    if (!response.ok) return null;
    const contentType = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!contentType.startsWith('image/')) return null;
    const body = Buffer.from(await response.arrayBuffer());
    if (!body.length || body.length > MAX_IMAGE_BYTES) return null;
    return { body, contentType };
  } catch (_) {
    return null;
  } finally {
    done();
  }
}

async function storeImage({ body, contentType, name, userId }) {
  const id = crypto.randomUUID();
  const storageKey = `${userId}/${id}`;
  await storage.put(storageKey, body, contentType);
  await Attachment.create({
    id,
    userId,
    storageKey,
    name: String(name || 'imagem-gerada.png').slice(0, 255),
    contentType,
    size: body.length,
  });
  return {
    uploadId: id,
    name: String(name || 'imagem-gerada.png').slice(0, 255),
    type: contentType,
    size: body.length,
    alt: 'Imagem gerada pela Liz',
    source: 'Liz',
  };
}

function imageEndpoint() {
  if (process.env.AI_IMAGE_API_URL) return process.env.AI_IMAGE_API_URL;
  const chatEndpoint = process.env.AI_API_URL || '';
  // Compatibilidade automática com o endpoint oficial da OpenAI quando o
  // projeto já usa /v1/chat/completions e a mesma chave de API.
  if (/api\.openai\.com\/v1\/chat\/completions\/?$/i.test(chatEndpoint)) {
    return chatEndpoint.replace(/chat\/completions\/?$/i, 'images/generations');
  }
  return '';
}

async function generateImage(prompt, userId) {
  const endpoint = imageEndpoint();
  if (!endpoint) {
    throw new ApiError(503, 'Geração de imagens não configurada — preencha AI_IMAGE_API_URL no backend');
  }
  const { controller, done } = withTimeout(90000);
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.AI_IMAGE_API_KEY || process.env.AI_API_KEY
          ? { Authorization: `Bearer ${process.env.AI_IMAGE_API_KEY || process.env.AI_API_KEY}` }
          : {}),
      },
      body: JSON.stringify({
        model: process.env.AI_IMAGE_MODEL || 'gpt-image-1',
        prompt: String(prompt).slice(0, 2000),
        size: process.env.AI_IMAGE_SIZE || '1024x1024',
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(502, 'O provedor de imagens recusou a solicitação');
    const data = await response.json();
    const item = Array.isArray(data?.data) ? data.data[0] : (Array.isArray(data?.images) ? data.images[0] : data);
    const encoded = decodeBase64Image(item?.b64_json || item?.base64 || item?.data);
    const downloaded = encoded || await downloadGeneratedImage(item?.url || item?.image_url);
    if (!downloaded) throw new ApiError(502, 'O provedor não devolveu uma imagem válida');
    return [await storeImage({
      ...downloaded,
      name: 'imagem-gerada.png',
      userId,
    })];
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'Não consegui gerar a imagem agora');
  } finally {
    done();
  }
}

module.exports = {
  isImageRequest,
  searchOpenverse,
  generateImage,
};

/* Exportado para testes locais sem tornar o contrato HTTP público. */
module.exports._private = { safeHttpUrl, extractQuery, decodeBase64Image, translateQuery, buildFallbackCandidates };
