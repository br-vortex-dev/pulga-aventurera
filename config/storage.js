/* ============================================================
 *  Liz Chat Backend — config/storage.js
 *  Armazenamento de arquivos (fotos, imagens, documentos).
 *  Produção: Backblaze B2 (compatível com S3) via variáveis B2_*.
 *  Dev/testes sem as variáveis: disco local em data/uploads/
 *  (mesma convenção de fallback do SQLite no database.js).
 *  Os arquivos são PRIVADOS: só o backend entrega, e só ao dono.
 * ============================================================ */

const fs = require('fs');
const path = require('path');

const B2 = {
  keyId: process.env.B2_KEY_ID || '',
  applicationKey: process.env.B2_APPLICATION_KEY || '',
  bucket: process.env.B2_BUCKET || '',
  endpoint: process.env.B2_ENDPOINT || '',
};

/** B2 configurado? Sem isso, usa o fallback local. */
function isConfigured() {
  return Boolean(B2.keyId && B2.applicationKey && B2.bucket && B2.endpoint);
}

let s3 = null;
function client() {
  if (s3) return s3;
  const { S3Client } = require('@aws-sdk/client-s3');
  s3 = new S3Client({
    // B2 não valida a região — o endpoint é quem manda.
    region: 'us-east-005',
    endpoint: B2.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: B2.keyId,
      secretAccessKey: B2.applicationKey,
    },
  });
  return s3;
}

/* ---------- Fallback local (dev/testes) ---------- */

const LOCAL_DIR = path.join(__dirname, '..', 'data', 'uploads');

// Chave = "<uid>/<uuid>" — sanitiza cada segmento e bloqueia
// qualquer tentativa de sair do diretório (path traversal).
function localPath(key) {
  const safe = key
    .split('/')
    .map((p) => p.replace(/[^a-zA-Z0-9._-]/g, '_'))
    .join(path.sep);
  const full = path.join(LOCAL_DIR, safe);
  if (!full.startsWith(LOCAL_DIR + path.sep)) throw new Error('chave inválida');
  return full;
}

/* ---------- API única (B2 ou local) ---------- */

async function put(key, body, contentType) {
  if (isConfigured()) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    await client().send(new PutObjectCommand({
      Bucket: B2.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));
    return;
  }
  const full = localPath(key);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
}

async function get(key) {
  if (isConfigured()) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const out = await client().send(new GetObjectCommand({ Bucket: B2.bucket, Key: key }));
    const chunks = [];
    for await (const c of out.Body) chunks.push(c);
    return Buffer.concat(chunks);
  }
  return fs.promises.readFile(localPath(key));
}

async function del(key) {
  if (isConfigured()) {
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3');
    await client().send(new DeleteObjectCommand({ Bucket: B2.bucket, Key: key }));
    return;
  }
  try {
    await fs.promises.unlink(localPath(key));
  } catch (e) { /* já removido */ }
}

module.exports = { isConfigured, put, get, del };
