/* ============================================================
   CONFIGURAÇÃO DO FIREBASE — carregada do backend (.env)
   ------------------------------------------------------------
   As chaves NÃO ficam no frontend. Elas moram no arquivo
   backend/.env (variáveis FIREBASE_*) e o backend as serve
   pelo endpoint GET /api/firebase-config.

   Como configurar:
   1. Acesse https://console.firebase.google.com e crie/abra um projeto
   2. Configurações do projeto → Seus apps → adicione um app Web (</>)
   3. Copie os valores do firebaseConfig para o backend/.env
   4. Em Authentication → Sign-in method, ative:
      E-mail/senha, Google e GitHub (opcional)
   5. Suba o backend e abra a tela de login pelo servidor local de desenvolvimento
   ============================================================ */

// Mesma regra do app principal (js/api.js → LizAPI.BASE_URL):
//   1. window.LIZ_API_BASE manda em tudo (se definida antes deste arquivo)
//   2. Na nuvem (domínio próprio, Pages, onrender...): backend publicado
//   3. Em desenvolvimento local: backend de API na porta padrão de dev
const LIZ_API_BASE = (function () {
  if (window.LIZ_API_BASE) return window.LIZ_API_BASE.replace(/\/+$/, '')
  const host = window.location.hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1'
  if (!isLocal) return 'https://liz-api.onrender.com/api'
  return 'http://localhost:3001/api'
})()
// Outras telas reaproveitam a mesma base
window.LIZ_API_BASE_URL = LIZ_API_BASE
const FIREBASE_CONFIG_URL = LIZ_API_BASE + '/firebase-config'

// Indica se o Firebase está pronto para uso (config carregado com sucesso)
window.firebaseReady = false

// Cache local do config: o backend (Render free) "dorme" quando ocioso e
// a primeira requisição pode levar dezenas de segundos. O config web do
// Firebase é público por definição, então é seguro guardar no navegador:
// a página inicia na hora e o cache é atualizado em segundo plano.
const FIREBASE_CONFIG_CACHE_KEY = 'liz-firebase-config-v1'

function readCachedFirebaseConfig() {
  try {
    const raw = localStorage.getItem(FIREBASE_CONFIG_CACHE_KEY)
    const cfg = raw ? JSON.parse(raw) : null
    return cfg && cfg.apiKey ? cfg : null
  } catch (e) { return null }
}

function writeCachedFirebaseConfig(cfg) {
  try { localStorage.setItem(FIREBASE_CONFIG_CACHE_KEY, JSON.stringify(cfg)) } catch (e) { /* sem storage */ }
}

function bootFirebase(cfg) {
  window.firebaseConfig = cfg
  firebase.initializeApp(cfg)
  firebase.auth().languageCode = 'pt_BR' // e-mails de recuperação em português
  // App Check: só ativa quando o backend fornece a chave do reCAPTCHA v3.
  // Com ele, scripts fora do site oficial não conseguem usar as APIs
  // do Firebase (proteção recomendada pra config pública).
  if (cfg.recaptchaSiteKey && typeof firebase.appCheck === 'function') {
    firebase.appCheck().activate({
      siteKey: cfg.recaptchaSiteKey,
      isTokenAutoRefreshEnabled: true,
    })
  }
  window.firebaseReady = true
}

// Promise que o app.js aguarda antes de qualquer operação de auth
window.firebaseConfigPromise = (async () => {
  try {
    if (typeof firebase === 'undefined') {
      throw new Error('SDK do Firebase não carregou (sem internet?)')
    }
    // Caminho rápido: config em cache → inicia na hora, sem esperar o backend.
    const cached = readCachedFirebaseConfig()
    if (cached) {
      bootFirebase(cached)
      // Mantém o cache fresco pra próxima visita (não bloqueia nada).
      fetch(FIREBASE_CONFIG_URL)
        .then((res) => (res.ok ? res.json() : null))
        .then((cfg) => { if (cfg && cfg.apiKey) writeCachedFirebaseConfig(cfg) })
        .catch(() => { /* backend dormindo agora; o cache atual segue válido */ })
      return
    }
    // Primeira visita: precisa esperar o backend responder.
    const res = await fetch(FIREBASE_CONFIG_URL)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.message || `HTTP ${res.status}`)
    }
    const cfg = await res.json()
    writeCachedFirebaseConfig(cfg)
    bootFirebase(cfg)
  } catch (err) {
    console.warn('[Liz] Firebase indisponível:', err.message)
  }
})()
