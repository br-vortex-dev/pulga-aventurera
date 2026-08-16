/* ============================================================
 *  Liz Chat Backend — multipart.js
 *  Parser mínimo de multipart/form-data para uploads.
 *  Sem dependências externas. Retorna campos e arquivos
 *  como Buffers brutos — quem decide o que fazer é a rota.
 * ============================================================ */

/**
 * Extrai o boundary do header Content-Type.
 * @returns {string|null}
 */
function getBoundary(contentType) {
  if (!contentType) return null;
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  return match ? (match[1] || match[2] || '').trim() : null;
}

/**
 * Faz o parse de um corpo multipart/form-data.
 * @param {Buffer} body
 * @param {string} boundary
 * @returns {Array<{name:string, filename:string|null, contentType:string|null, data:Buffer}>}
 */
function parse(body, boundary) {
  const parts = [];
  if (!Buffer.isBuffer(body) || !boundary) return parts;

  const delim = Buffer.from('--' + boundary);
  const end = Buffer.from('--' + boundary + '--');
  const crlf = Buffer.from('\r\n');
  const doubleCrlf = Buffer.from('\r\n\r\n');

  let cursor = indexOf(body, delim, 0);
  if (cursor === -1) return parts;
  cursor += delim.length;

  while (cursor < body.length) {
    // Fim do multipart
    if (body.slice(cursor, cursor + 2).toString() === '--') break;
    // Pula CRLF após o boundary
    if (body[cursor] === 0x0d && body[cursor + 1] === 0x0a) cursor += 2;

    const headerEnd = indexOf(body, doubleCrlf, cursor);
    if (headerEnd === -1) break;
    const headerBlock = body.slice(cursor, headerEnd).toString('utf8');
    const dataStart = headerEnd + doubleCrlf.length;

    const nextDelim = indexOf(body, Buffer.concat([crlf, delim]), dataStart);
    const dataEnd = nextDelim === -1 ? body.length : nextDelim;
    const data = body.slice(dataStart, dataEnd);

    const headers = parseHeaders(headerBlock);
    const disposition = headers['content-disposition'] || '';
    const nameMatch = /name="([^"]*)"/i.exec(disposition);
    const fileMatch = /filename="([^"]*)"/i.exec(disposition);

    parts.push({
      name: nameMatch ? nameMatch[1] : '',
      filename: fileMatch ? fileMatch[1] : null,
      contentType: headers['content-type'] || null,
      data,
    });

    if (nextDelim === -1) break;
    cursor = nextDelim + crlf.length + delim.length;
  }

  return parts;
}

function parseHeaders(block) {
  const headers = {};
  block.split('\r\n').forEach((line) => {
    const idx = line.indexOf(':');
    if (idx > 0) {
      headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
    }
  });
  return headers;
}

/** indexOf de Buffer compatível (Node moderno já tem, wrapper por segurança). */
function indexOf(buf, search, from) {
  return buf.indexOf(search, from);
}

module.exports = { getBoundary, parse };
