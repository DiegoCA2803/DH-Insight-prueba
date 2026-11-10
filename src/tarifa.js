import { DIA, MINUTO, ErrorRegla, fechaLima, horaLima, marcaLima } from './fechas.js';

const FERIADOS = new Set([
  '2026-01-01', '2026-04-02', '2026-04-03', '2026-05-01', '2026-06-29',
  '2026-07-28', '2026-07-29', '2026-08-30', '2026-10-08', '2026-11-01',
  '2026-12-08', '2026-12-25',
]);
const CAMBIO_TOLERANCIA = marcaLima('2026-10-01T00:00');

export function validarTipo(tipo) {
  if (tipo !== 'AUTO' && tipo !== 'MOTO') {
    throw new ErrorRegla('E02', 'El tipo de vehículo no es AUTO ni MOTO');
  }
  return tipo;
}

function* tramos(entrada, salida) {
  for (let inicio = entrada; inicio < salida;) {
    const medianoche = Math.floor(inicio / DIA) * DIA;
    const amanecer = medianoche + 360 * MINUTO;
    const anochecer = medianoche + 1_320 * MINUTO;
    const diurno = inicio >= amanecer && inicio < anochecer;
    const limite = diurno ? anochecer : (inicio < amanecer ? amanecer : amanecer + DIA);
    const fin = Math.min(limite, salida);
    yield { inicio, fin, diurno, fecha: fechaLima(inicio), minutos: (fin - inicio) / MINUTO };
    inicio = fin;
  }
}

function cobrarTramos(entrada, salida, agregar) {
  const porFecha = new Map();
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

export function calcularLiquidacion({ ticket, tipo, entrada, salida, ticket_perdido }) {
  validarTipo(tipo);
  const entradaExacta = marcaLima(entrada);
  const salidaExacta = marcaLima(salida);
  if (salidaExacta < entradaExacta) {
    throw new ErrorRegla('E01', 'La salida es anterior a la entrada');
  }
  const inicio = Math.floor(entradaExacta / MINUTO) * MINUTO;
  const fin = Math.floor(salidaExacta / MINUTO) * MINUTO;
  const minutos = (fin - inicio) / MINUTO;
  const detalle = [];
  let total = 0;
  function agregar(concepto, articulo, monto_centimos) {
    if (monto_centimos === 0) return;
    detalle.push({ concepto, articulo, monto_centimos });
    total += monto_centimos;
  }

  const tolerancia = entradaExacta < CAMBIO_TOLERANCIA
    ? minutos <= 10
    : !ticket_perdido && minutos <= 15;
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
