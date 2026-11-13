import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ErrorRegla } from './fechas.js';
import { leerArchivo, leerJson, leerUrl, responderJson } from './http.js';
import { borrarTicket, consultarCierre, editarTicket, importarTickets, liquidarTicket, listarTickets } from './operaciones.js';
import { abrirTickets } from './tickets.js';

const PUBLICOS = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/estilos.css', ['estilos.css', 'text/css; charset=utf-8']],
]);

export function crearServidor({ rutaDb = process.env.DB_PATH || 'data/tickets.sqlite' } = {}) {
  const tickets = abrirTickets(rutaDb);
  const servidor = createServer(async (req, res) => {
    try {
      const { pathname, searchParams } = leerUrl(req);
      if (req.method === 'GET' && pathname === '/api/tickets') {
        return responderJson(res, 200, { tickets: listarTickets(searchParams.get('fecha'), tickets) });
      }
      const rutaTicket = /^\/api\/tickets\/([^/]+)$/.exec(pathname);
      if (rutaTicket && ['PUT', 'DELETE'].includes(req.method)) {
        let ticket;
        try {
          ticket = decodeURIComponent(rutaTicket[1]);
        } catch {
          throw new ErrorRegla('E05', 'Identificador de ticket inválido');
        }
        if (req.method === 'DELETE') return responderJson(res, 200, borrarTicket(ticket, tickets));
        return responderJson(res, 200, editarTicket(ticket, await leerJson(req), tickets));
      }
      if (req.method === 'POST' && pathname === '/api/liquidaciones') {
        const resultado = liquidarTicket(await leerJson(req), tickets);
        return responderJson(res, 200, resultado);
      }
      if (req.method === 'POST' && pathname === '/api/importaciones') {
        const resultado = importarTickets(await leerArchivo(req), tickets);
        return responderJson(res, 200, resultado);
      }
      if (req.method === 'GET' && pathname === '/api/cierre') {
        return responderJson(res, 200, consultarCierre(searchParams.get('fecha'), tickets));
      }
      if (req.method === 'GET' && PUBLICOS.has(pathname)) {
        const [nombre, tipo] = PUBLICOS.get(pathname);
        const contenido = await readFile(new URL('../public/' + nombre, import.meta.url));
        res.writeHead(200, { 'Content-Type': tipo });
        return res.end(contenido);
      }
      return responderJson(res, 404, { codigo: 'E05', mensaje: 'Ruta no encontrada' });
    } catch (error) {
      if (error instanceof ErrorRegla) {
        return responderJson(res, error.status, { codigo: error.codigo, mensaje: error.message });
      }
      console.error(error);
      return responderJson(res, 500, { codigo: 'E05', mensaje: 'Error interno del servidor' });
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
