import { ErrorRegla, validarFechaCierre } from './fechas.js';
import { calcularLiquidacion } from './tarifa.js';
import { procesarCsv } from './importacion.js';

export function liquidarTicket(solicitud, tickets) {
  if (!solicitud || typeof solicitud.ticket !== 'string' || !solicitud.ticket.trim()
      || typeof solicitud.ticket_perdido !== 'boolean') {
    throw new ErrorRegla('E05', 'Se requiere ticket y ticket_perdido booleano');
  }
  const datos = { ...solicitud, ticket: solicitud.ticket.trim(), placa: undefined };
  const resultado = calcularLiquidacion(datos);
  tickets.guardar([{ datos, resultado }]);
  return resultado;
}

export function importarTickets(archivo, tickets) {
  const { registros, ...resultado } = procesarCsv(archivo);
  if (registros.length) tickets.guardar(registros);
  return resultado;
}

export function consultarCierre(fecha, tickets) {
  return tickets.cierre(validarFechaCierre(fecha));
}
