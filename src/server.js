import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ErrorRegla, validarFechaCierre } from './fechas.js';
import { calcularLiquidacion } from './tarifa.js';
import { procesarCsv } from './importacion.js';
import { abrirTickets } from './tickets.js';

const LIMITE_BYTES = 5 * 1024 * 1024;
const PUBLICOS = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/estilos.css', ['estilos.css', 'text/css; charset=utf-8']],
]);

function json(res, status, datos) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(datos));
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

async function leerTicket(req) {
  const cuerpo = await leerCuerpo(req);
  let datos;
  try {
    datos = JSON.parse(cuerpo.toString('utf8'));
  } catch {
    throw new ErrorRegla('E05', 'Se esperaba un objeto JSON');
  }
  if (!datos || typeof datos.ticket !== 'string' || !datos.ticket.trim()
      || typeof datos.ticket_perdido !== 'boolean') {
    throw new ErrorRegla('E05', 'Se requiere ticket y ticket_perdido booleano');
  }
  return { ...datos, ticket: datos.ticket.trim(), placa: undefined };
}

async function leerArchivo(req) {
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

export function crearServidor({ rutaDb = process.env.DB_PATH || 'data/tickets.sqlite' } = {}) {
  const tickets = abrirTickets(rutaDb);
  const servidor = createServer(async (req, res) => {
    try {
      let url;
      try {
        url = new URL(req.url, 'http://localhost');
      } catch {
        throw new ErrorRegla('E05', 'URL de solicitud inválida');
      }
      const { pathname, searchParams } = url;
      if (req.method === 'POST' && pathname === '/api/liquidaciones') {
        const datos = await leerTicket(req);
        const resultado = calcularLiquidacion(datos);
        tickets.guardar([{ datos, resultado }]);
        return json(res, 200, resultado);
      }
      if (req.method === 'POST' && pathname === '/api/importaciones') {
        const { registros, ...resultado } = procesarCsv(await leerArchivo(req));
        if (registros.length) tickets.guardar(registros);
        return json(res, 200, resultado);
      }
      if (req.method === 'GET' && pathname === '/api/cierre') {
        return json(res, 200, tickets.cierre(validarFechaCierre(searchParams.get('fecha'))));
      }
      if (req.method === 'GET' && PUBLICOS.has(pathname)) {
        const [nombre, tipo] = PUBLICOS.get(pathname);
        const contenido = await readFile(new URL('../public/' + nombre, import.meta.url));
        res.writeHead(200, { 'Content-Type': tipo });
        return res.end(contenido);
      }
      return json(res, 404, { codigo: 'E05', mensaje: 'Ruta no encontrada' });
    } catch (error) {
      if (error instanceof ErrorRegla) {
        return json(res, 422, { codigo: error.codigo, mensaje: error.message });
      }
      console.error(error);
      return json(res, 500, { codigo: 'E05', mensaje: 'Error interno del servidor' });
    }
  });
  servidor.on('close', () => tickets.cerrar());
  return servidor;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const puerto = Number(process.env.PORT ?? 3000);
  const servidor = crearServidor();
  servidor.listen(puerto, () => console.log('Parqueo Quilla en http://localhost:' + servidor.address().port));
}
