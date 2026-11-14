import { DIA, MINUTO, ErrorRegla, fechaLima, horaLima, marcaLima } from './fechas.js';

// Art. 5 y Anexo A: se usa solo la lista del reto, sin consultar otros feriados.
const FERIADOS = new Set([
  '2026-01-01', '2026-04-02', '2026-04-03', '2026-05-01', '2026-06-29',
  '2026-07-28', '2026-07-29', '2026-08-30', '2026-10-08', '2026-11-01',
  '2026-12-08', '2026-12-25',
]);
const CAMBIO_TOLERANCIA = marcaLima('2026-10-01T00:00');

/** Valida el tipo estricto de la API; el importador normaliza el CSV antes de llamar al motor. */
export function validarTipo(tipo) {
  if (tipo !== 'AUTO' && tipo !== 'MOTO') {
    throw new ErrorRegla('E02', 'El tipo de vehículo no es AUTO ni MOTO');
  }
  return tipo;
}

/** Divide la permanencia por cambios de franja, con inicio incluido y fin excluido (Art. 3). */
function* tramos(entrada, salida) {
  for (let inicio = entrada; inicio < salida;) {
    const medianoche = Math.floor(inicio / DIA) * DIA;
    const amanecer = medianoche + 360 * MINUTO;
    const anochecer = medianoche + 1_320 * MINUTO;
    const diurno = inicio >= amanecer && inicio < anochecer;
    const limite = diurno ? anochecer : (inicio < amanecer ? amanecer : amanecer + DIA);
    const fin = Math.min(limite, salida);
    // La fecha corresponde al inicio efectivo del vehículo, no al inicio de la franja.
    // A las 03:00 se atribuye a ese día; a las 23:00, a la fecha de entrada aunque termine al siguiente.
    // No se corta a medianoche: ese corte inventaría otro tramo y otro cargo nocturno.
    yield { inicio, fin, diurno, fecha: fechaLima(inicio), minutos: (fin - inicio) / MINUTO };
    inicio = fin;
  }
}

/** Cobra las tarifas de los Arts. 4-6 y acumula por fecha para aplicar luego el tope. */
function cobrarTramos(entrada, salida, agregar) {
  const porFecha = new Map();
  // Adenda 1: la primera hora pertenece al primer tramo diurno de toda la permanencia.
  let primeraHoraPendiente = true;
  for (const tramo of tramos(entrada, salida)) {
    const horario = horaLima(tramo.inicio) + '-' + horaLima(tramo.fin);
    let monto = 1_000;
    if (tramo.diurno) {
      const especial = new Date(tramo.inicio).getUTCDay() === 0 || FERIADOS.has(tramo.fecha);
      const base = especial ? 500 : 600;
      const fraccion = especial ? 100 : 150;
      const articulo = especial ? 'Art. 5' : 'Art. 4';
      const clase = especial ? 'especial' : 'normal';

      if (primeraHoraPendiente) {
        monto = base + Math.ceil(Math.max(0, tramo.minutos - 60) / 15) * fraccion;
        agregar('Tramo diurno ' + clase + ' ' + tramo.fecha + ' ' + horario, articulo, monto);
        primeraHoraPendiente = false;
      } else {
        monto = Math.ceil(tramo.minutos / 15) * fraccion;
        agregar('Tramo diurno ' + clase + ' ' + tramo.fecha + ' ' + horario + ', sin primera hora',
          articulo + ', Adenda 1', monto);
      }
    } else {
      agregar('Tramo nocturno ' + tramo.fecha + ' ' + horario, 'Art. 6', monto);
    }
    porFecha.set(tramo.fecha, (porFecha.get(tramo.fecha) ?? 0) + monto);
  }
  return porFecha;
}

/** Calcula minutos, total en céntimos y desglose sin acceder a HTTP ni a la base de datos. */
export function calcularLiquidacion({ ticket, tipo, entrada, salida, ticket_perdido }) {
  validarTipo(tipo);
  const entradaExacta = marcaLima(entrada);
  const salidaExacta = marcaLima(salida);
  // E01 se valida con las marcas completas; truncar antes podría ocultar una salida anterior.
  if (salidaExacta < entradaExacta) {
    throw new ErrorRegla('E01', 'La salida es anterior a la entrada');
  }
  const inicio = Math.floor(entradaExacta / MINUTO) * MINUTO;
  const fin = Math.floor(salidaExacta / MINUTO) * MINUTO;
  const minutos = (fin - inicio) / MINUTO;
  const detalle = [];
  let total = 0;
  /** Registra solo los pasos que cambian el cobro y mantiene la suma del desglose igual al total. */
  function agregar(concepto, articulo, monto_centimos) {
    if (monto_centimos === 0) return;
    detalle.push({ concepto, articulo, monto_centimos });
    total += monto_centimos;
  }

  // Art. 11 y Adenda 2: la entrada elige la versión, incluso si la salida cruza el cambio.
  const tolerancia = entradaExacta < CAMBIO_TOLERANCIA
    ? minutos <= 10
    : !ticket_perdido && minutos <= 15;
  // Art. 12: tarifas → topes por fecha → descuento de moto → redondeo → cargo por pérdida.
  if (!tolerancia) {
    const porFecha = cobrarTramos(inicio, fin, agregar);
    for (const [fecha, subtotal] of porFecha) {
      agregar('Tope diario del ' + fecha, 'Art. 7', -Math.max(0, subtotal - 3_500));
    }
    if (tipo === 'MOTO') agregar('Descuento de motocicleta', 'Art. 8', -total / 2);
    agregar('Redondeo hacia abajo', 'Art. 9', -(total % 10));
  }
  if (ticket_perdido) agregar('Cargo por ticket perdido', 'Art. 10', 2_500);

  return { ticket, minutos, total_centimos: total, detalle };
}
