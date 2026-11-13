export const MINUTO = 60_000;
export const DIA = 1_440 * MINUTO;
const DESFASE_LIMA = -5 * 60;
const FORMATO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/u;

export class ErrorRegla extends Error {
  constructor(codigo, mensaje, status = 422) {
    super(mensaje);
    this.codigo = codigo;
    this.status = status;
  }
}

// Representamos la hora de pared de Lima con componentes UTC para que
// el huso horario del servidor no intervenga en las operaciones.
export function marcaLima(valor) {
  const partes = typeof valor === 'string' && FORMATO.exec(valor);
  if (!partes || partes[0] !== valor) throw fechaInvalida();
  const [, a, m, d, h, min, s = '0', ms = '', zona] = partes;
  const fecha = new Date(0);
  fecha.setUTCFullYear(Number(a), Number(m) - 1, Number(d));
  fecha.setUTCHours(Number(h), Number(min), Number(s), Number(ms.padEnd(3, '0')));
  if (fecha.getUTCFullYear() !== Number(a) || fecha.getUTCMonth() + 1 !== Number(m)
      || fecha.getUTCDate() !== Number(d) || Number(h) > 23
      || Number(min) > 59 || Number(s) > 59) throw fechaInvalida();

  let desfase = DESFASE_LIMA;
  if (zona === 'Z') desfase = 0;
  else if (zona) {
    const horas = Number(zona.slice(1, 3));
    const minutos = Number(zona.slice(4));
    if (horas > 23 || minutos > 59) throw fechaInvalida();
    desfase = (zona[0] === '-' ? -1 : 1) * (horas * 60 + minutos);
  }
  const marca = fecha.getTime() + (DESFASE_LIMA - desfase) * MINUTO;
  const anio = new Date(marca).getUTCFullYear();
  if (anio < 0 || anio > 9999) throw fechaInvalida();
  return marca;
}

export function fechaInvalida() {
  return new ErrorRegla('E03', 'Una fecha u hora no tiene un formato aceptado');
}

export function fechaLima(marca) {
  return new Date(marca).toISOString().slice(0, 10);
}

export function horaLima(marca) {
  return new Date(marca).toISOString().slice(11, 16);
}

export function validarFechaCierre(fecha) {
  if (typeof fecha !== 'string' || fecha.length !== 10) throw fechaInvalida();
  marcaLima(fecha + 'T00:00');
  return fecha;
}
