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

function isImageRequest(text) {
  const value = String(text || '').toLowerCase();
  const mentionsImage = /\b(imagem|imagens|foto|fotos|figura|figuras|ilustra[cç][aã]o|desenho)\b/.test(value);
  const mentionsSearch = /\b(ache|achar|encontre|encontrar|busque|buscar|procure|pesquise|pesquisar|mostre|mostrar|mande|manda|mandar|envie|enviar)\b/.test(value);
  const mentionsGeneration = /\b(crie|cria|criar|gere|gera|gerar|desenhe|desenhar|fa[cç]a|fazer)\b/.test(value);
  if (mentionsImage && mentionsSearch) return { kind: 'search', query: extractQuery(text) };
  if (mentionsImage && mentionsGeneration) return { kind: 'generate', prompt: extractQuery(text) || String(text).trim() };
  return null;
}

function extractQuery(text) {
  return String(text || '')
    .replace(/\b(por favor|pode|poderia|me|uma|um|as|os|a|o|ache|achar|encontre|encontrar|busque|buscar|procure|pesquise|pesquisar|mostre|mostra|mostrar|mande|manda|mandar|envie|enviar|crie|cria|criar|gere|gera|gerar|desenhe|desenhar|fa[cç]a|fazer|imagem|imagens|foto|fotos|figura|figuras|ilustra[cç][aã]o|desenho)\b/gi, ' ')
    .replace(/^\s*(de|do|da|dos|das|sobre)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

async function searchOpenverse(query) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return [];
  const { controller, done } = withTimeout();
  try {
    const url = `${OPENVERSE_URL}?q=${encodeURIComponent(cleanQuery)}&page_size=${MAX_RESULTS}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (!response.ok) throw new ApiError(502, 'A busca de imagens não respondeu');
    const data = await response.json();
    return (Array.isArray(data.results) ? data.results : []).slice(0, MAX_RESULTS).map((item) => ({
      url: safeHttpUrl(item.thumbnail || item.url),
      sourceUrl: safeHttpUrl(item.foreign_landing_url || item.detail_url),
      title: String(item.title || 'Imagem encontrada').slice(0, 180),
      creator: String(item.creator || '').slice(0, 120),
      license: String(item.license || '').slice(0, 80),
      licenseUrl: safeHttpUrl(item.license_url),
      source: 'Openverse',
    })).filter((item) => item.url);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(502, 'Não consegui buscar imagens agora');
  } finally {
    done();
  }
}

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
module.exports._private = { safeHttpUrl, extractQuery, decodeBase64Image };
