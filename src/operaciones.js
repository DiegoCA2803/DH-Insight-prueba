import { ErrorRegla, validarFechaCierre } from './fechas.js';
import { calcularLiquidacion } from './tarifa.js';
import { procesarCsv } from './importacion.js';

function prepararLiquidacion(solicitud) {
  if (!solicitud || typeof solicitud.ticket !== 'string' || !solicitud.ticket.trim()
      || typeof solicitud.ticket_perdido !== 'boolean') {
    throw new ErrorRegla('E05', 'Se requiere ticket y ticket_perdido booleano');
  }
  const datos = { ...solicitud, ticket: solicitud.ticket.trim(), placa: undefined };
  const resultado = calcularLiquidacion(datos);
  return { datos, resultado };
}

export function liquidarTicket(solicitud, tickets) {
  const registro = prepararLiquidacion(solicitud);
  tickets.guardar([registro]);
  return registro.resultado;
}

export function editarTicket(ticket, solicitud, tickets) {
  if (solicitud?.ticket !== undefined && solicitud.ticket !== ticket) {
    throw new ErrorRegla('E05', 'El identificador del ticket no se puede cambiar');
  }
  const registro = prepararLiquidacion({ ...solicitud, ticket });
  if (!tickets.editar(registro)) throw new ErrorRegla('E06', 'El ticket no existe', 404);
  return registro.resultado;
}

export function borrarTicket(ticket, tickets) {
  if (!tickets.borrar(ticket)) throw new ErrorRegla('E06', 'El ticket no existe', 404);
  return { ticket, eliminado: true };
}

export function listarTickets(fecha, tickets) {
  return tickets.listar(validarFechaCierre(fecha));
}

export function importarTickets(archivo, tickets) {
  const { registros, ...resultado } = procesarCsv(archivo);
  if (registros.length) tickets.guardar(registros);
  return resultado;
}

export function consultarCierre(fecha, tickets) {
  return tickets.cierre(validarFechaCierre(fecha));
}
