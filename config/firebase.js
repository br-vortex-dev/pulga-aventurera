/* ============================================================
 *  Liz Chat Backend — config/firebase.js
 *  Inicializa o Firebase Admin SDK para validar os ID tokens
 *  que o frontend envia no header Authorization.
 *
 *  A credencial é uma Service Account (JSON) colada na env
 *  FIREBASE_SERVICE_ACCOUNT — nunca commitada no repo.
 *  Como gerar: Firebase Console → Configurações do projeto →
 *  Contas de serviço → "Gerar nova chave privada".
 * ============================================================ */

let admin = null;
let configured = false;

function init() {
  if (admin !== null) return; // já tentou inicializar (com ou sem sucesso)
  admin = undefined;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return;

  try {
    const serviceAccount = JSON.parse(raw);
    // require aqui (e não no topo) pra quem não usa auth não precisar
    // nem instalar o firebase-admin.
    const firebaseAdmin = require('firebase-admin');
    firebaseAdmin.initializeApp({
      credential: firebaseAdmin.credential.cert(serviceAccount),
    });
    admin = firebaseAdmin;
    configured = true;
    console.log('[liz-backend] Firebase Admin configurado — tokens serão validados');
  } catch (err) {
    console.error('[liz-backend] FIREBASE_SERVICE_ACCOUNT inválida:', err.message);
  }
}

init();

/** O Admin SDK está pronto para validar tokens? */
function isConfigured() {
  return configured;
}

/**
 * Valida um ID token do Firebase e devolve o usuário decodificado
 * ({ uid, email, name, ... }). Lança erro quando o token é
 * inválido/expirado — quem chama traduz pro HTTP adequado.
 */
async function verifyIdToken(idToken) {
  if (!configured) throw new Error('Firebase Admin não configurado');
  return admin.auth().verifyIdToken(idToken);
}

module.exports = { isConfigured, verifyIdToken };
