import { ErrorRegla, validarFechaCierre } from './fechas.js';
import { calcularLiquidacion } from './tarifa.js';
import { procesarCsv } from './importacion.js';

/** Valida los campos de la solicitud y calcula el cobro antes de permitir cualquier escritura. */
function prepararLiquidacion(solicitud) {
  if (!solicitud || typeof solicitud.ticket !== 'string' || !solicitud.ticket.trim()
      || typeof solicitud.ticket_perdido !== 'boolean') {
    throw new ErrorRegla('E05', 'Se requiere ticket y ticket_perdido booleano');
  }
  const datos = { ...solicitud, ticket: solicitud.ticket.trim(), placa: undefined };
  const resultado = calcularLiquidacion(datos);
  return { datos, resultado };
}

/** Liquida y guarda un ticket; una operación válida sustituye el registro del mismo identificador. */
export function liquidarTicket(solicitud, tickets) {
  const registro = prepararLiquidacion(solicitud);
  tickets.guardar([registro]);
  return registro.resultado;
}

/** Recalcula un ticket existente manteniendo fijo su identificador; si falla, no modifica la caja. */
export function editarTicket(ticket, solicitud, tickets) {
  if (solicitud?.ticket !== undefined && solicitud.ticket !== ticket) {
    throw new ErrorRegla('E05', 'El identificador del ticket no se puede cambiar');
  }
  const registro = prepararLiquidacion({ ...solicitud, ticket });
  if (!tickets.editar(registro)) throw new ErrorRegla('E06', 'El ticket no existe', 404);
  return registro.resultado;
}

/** Elimina un ticket existente o devuelve E06 si ya no está registrado. */
export function borrarTicket(ticket, tickets) {
  if (!tickets.borrar(ticket)) throw new ErrorRegla('E06', 'El ticket no existe', 404);
  return { ticket, eliminado: true };
}

/** Consulta los tickets cuya salida corresponde a la fecha indicada en Lima. */
export function listarTickets(fecha, tickets) {
  return tickets.listar(validarFechaCierre(fecha));
}

/** Procesa el CSV y guarda las filas aceptadas juntas; las rechazadas se devuelven al operador. */
export function importarTickets(archivo, tickets) {
  const { registros, ...resultado } = procesarCsv(archivo);
  if (registros.length) tickets.guardar(registros);
  return resultado;
}

/** Valida la fecha y obtiene cantidad, total y subtotales del cierre. */
export function consultarCierre(fecha, tickets) {
  return tickets.cierre(validarFechaCierre(fecha));
}
