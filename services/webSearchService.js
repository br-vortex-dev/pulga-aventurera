/* ============================================================
 * Liz Chat Backend — services/webSearchService.js
 * Busca web no servidor. O navegador recebe apenas resultados
 * normalizados, nunca chaves de provedores.
 * ============================================================ */

const { ApiError } = require('./aiClient');

const MAX_RESULTS = 6;
const BRAVE_URL = 'https://api.search.brave.com/res/v1/web/search';

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

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function extractQuery(text) {
  return String(text || '')
    .replace(/\b(por favor|pode|poderia|me|na|no|nas|nos|a|o|as|os|internet|web|site|sites|fonte|fontes|link|links|pesquise|pesquisar|pesquisar|pesquisar|pesquisar|busque|buscar|procure|procurar|encontre|encontrar|consulte|consultar|not[ií]cia|not[ií]cias|informa[cç][aã]o|informa[cç][oõ]es)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function isWebRequest(text) {
  const value = String(text || '').toLowerCase();
  const action = /\b(pesquise|pesquisar|busque|buscar|procure|procurar|encontre|encontrar|consulte|consultar|veja|ver|mostre|mostrar)\b/.test(value);
  const webSource = /\b(internet|web|site|sites|fonte|fontes|link|links|not[ií]cia|not[ií]cias|atual|atualizado|hoje)\b/.test(value);
  return action && webSource ? { query: extractQuery(text) || String(text).trim().slice(0, 220) } : null;
}

function hostFromUrl(value) {
  try { return new URL(value).hostname.replace(/^www\./, ''); } catch (_) { return ''; }
}

async function searchBrave(query) {
  const { controller, done } = withTimeout();
  try {
    const url = `${BRAVE_URL}?q=${encodeURIComponent(query)}&count=${MAX_RESULTS}&safesearch=strict&search_lang=pt-br&text_decorations=0`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY,
      },
      signal: controller.signal,
    });
    if (!response.ok) throw new ApiError(502, 'A busca na internet não respondeu');
    const data = await response.json();
    return (Array.isArray(data?.web?.results) ? data.web.results : []).slice(0, MAX_RESULTS).map((item) => {
      const urlValue = safeHttpUrl(item.url);
      return {
        title: stripHtml(item.title || 'Resultado da busca').slice(0, 180),
        url: urlValue,
        description: stripHtml(item.description || '').slice(0, 420),
        source: hostFromUrl(urlValue),
        age: stripHtml(item.age || item.page_age || '').slice(0, 60),
        provider: 'Brave Search',
      };
    }).filter((item) => item.url);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'Não consegui consultar a internet agora');
  } finally {
    done();
  }
}

function flattenDuckTopics(items, out = []) {
  (Array.isArray(items) ? items : []).forEach((item) => {
    if (item?.FirstURL && item?.Text) out.push(item);
    if (Array.isArray(item?.Topics)) flattenDuckTopics(item.Topics, out);
  });
  return out;
}

async function searchDuckDuckGo(query) {
  const { controller, done } = withTimeout();
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=0`;
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) return [];
    const data = await response.json();
    const results = [];
    if (data.AbstractURL && data.AbstractText) {
      results.push({
        title: stripHtml(data.Heading || 'Resultado'),
        url: safeHttpUrl(data.AbstractURL),
        description: stripHtml(data.AbstractText).slice(0, 420),
        source: hostFromUrl(data.AbstractURL),
        provider: 'DuckDuckGo',
      });
    }
    flattenDuckTopics(data.RelatedTopics).slice(0, MAX_RESULTS - results.length).forEach((item) => {
      results.push({
        title: stripHtml(item.Text).split(' - ')[0].slice(0, 180),
        url: safeHttpUrl(item.FirstURL),
        description: stripHtml(item.Text).slice(0, 420),
        source: hostFromUrl(item.FirstURL),
        provider: 'DuckDuckGo',
      });
    });
    return results.filter((item) => item.url).slice(0, MAX_RESULTS);
  } catch (_) {
    return [];
  } finally {
    done();
  }
}

async function searchWikipedia(query) {
  const { controller, done } = withTimeout();
  try {
    const url = `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=${MAX_RESULTS}&format=json&utf8=1&origin=*`;
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) return [];
    const data = await response.json();
    return (Array.isArray(data?.query?.search) ? data.query.search : []).map((item) => ({
      title: stripHtml(item.title || 'Wikipedia').slice(0, 180),
      url: `https://pt.wikipedia.org/?curid=${encodeURIComponent(item.pageid)}`,
      description: stripHtml(item.snippet || '').slice(0, 420),
      source: 'pt.wikipedia.org',
      provider: 'Wikipedia',
    })).slice(0, MAX_RESULTS);
  } catch (_) {
    return [];
  } finally {
    done();
  }
}

async function searchWeb(query) {
  const cleanQuery = String(query || '').trim().slice(0, 220);
  if (!cleanQuery) return [];
  if (process.env.BRAVE_SEARCH_API_KEY) return searchBrave(cleanQuery);
  const publicResults = await searchDuckDuckGo(cleanQuery);
  if (publicResults.length) return publicResults;
  return searchWikipedia(cleanQuery);
}

module.exports = { isWebRequest, searchWeb, _private: { safeHttpUrl, extractQuery, stripHtml } };
