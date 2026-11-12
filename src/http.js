import { ErrorRegla } from './fechas.js';

const LIMITE_BYTES = 5 * 1024 * 1024;

export function responderJson(res, status, datos) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(datos));
}

export function leerUrl(req) {
  try {
    return new URL(req.url, 'http://localhost');
  } catch {
    throw new ErrorRegla('E05', 'URL de solicitud inválida');
  }
}

async function leerCuerpo(req) {
  const partes = [];
  let total = 0;
  for await (const parte of req.iterator({ destroyOnReturn: false })) {
    total += parte.length;
    if (total > LIMITE_BYTES) {
      req.resume();
      throw new ErrorRegla('E05', 'El cuerpo de la solicitud supera 5 MiB');
    }
    partes.push(parte);
  }
  return Buffer.concat(partes, total);
}

export async function leerJson(req) {
  const cuerpo = await leerCuerpo(req);
  try {
    return JSON.parse(cuerpo.toString('utf8'));
  } catch {
    throw new ErrorRegla('E05', 'Se esperaba un objeto JSON');
  }
}

export async function leerArchivo(req) {
  const cuerpo = await leerCuerpo(req);
  let archivo;
  try {
    const tipo = req.headers['content-type'] ?? '';
    if (!/^multipart\/form-data(?:;|$)/i.test(tipo)) throw new Error();
    const form = await new Response(cuerpo, { headers: { 'Content-Type': tipo } }).formData();
    archivo = form.get('archivo');
  } catch {
    throw new ErrorRegla('E05', 'Se esperaba un formulario multipart válido');
  }
  if (!(archivo instanceof Blob)) throw new ErrorRegla('E05', 'Falta el archivo en el campo archivo');
  return archivo.arrayBuffer();
}
