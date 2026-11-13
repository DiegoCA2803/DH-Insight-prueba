import { ErrorRegla } from './fechas.js';
import { calcularLiquidacion } from './tarifa.js';

const CABECERA = ['ticket', 'placa', 'tipo', 'entrada', 'salida', 'perdido'];

function* leerCsv(texto) {
  let campos = [];
  let campo = '';
  let estado = 'inicio';
  let malformada = false;
  let linea = 1;
  let fila = 1;
  for (let i = 0; i < texto.length; i++) {
    const caracter = texto[i];
    if (estado === 'entrecomillado') {
      if (caracter === '"') {
        if (texto[i + 1] === '"') {
          campo += '"';
          i++;
        } else estado = 'cerrado';
      } else {
        campo += caracter;
        if (caracter === '\n' || (caracter === '\r' && texto[i + 1] !== '\n')) linea++;
      }
    } else if (caracter === ',') {
      campos.push(campo);
      campo = '';
      estado = 'inicio';
    } else if (caracter === '\n' || caracter === '\r') {
      yield { fila, campos: [...campos, campo], malformada };
      if (caracter === '\r' && texto[i + 1] === '\n') i++;
      linea++;
      fila = linea;
      campos = [];
      campo = '';
      estado = 'inicio';
      malformada = false;
    } else if (caracter === '"' && estado === 'inicio') {
      estado = 'entrecomillado';
    } else {
      if (caracter === '"' || estado === 'cerrado') malformada = true;
      campo += caracter;
      estado = 'texto';
    }
  }
  if (campos.length || campo || estado !== 'inicio') {
    yield { fila, campos: [...campos, campo], malformada: malformada || estado === 'entrecomillado' };
  }
}

export function procesarCsv(bytes) {
  let texto;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new ErrorRegla('E05', 'El archivo debe estar codificado en UTF-8');
  }
  const filas = leerCsv(texto);
  const cabecera = filas.next().value;
  if (!cabecera || cabecera.malformada || cabecera.campos.join(',') !== CABECERA.join(',')
      || cabecera.campos.length !== CABECERA.length) {
    throw new ErrorRegla('E05', 'Cabecera CSV inválida');
  }

  const ultimasValidas = new Map();
  const rechazadas = [];
  for (const { fila, campos, malformada } of filas) {
    if (!malformada && campos.length === 1 && !campos[0].trim()) continue;
    const ticket = campos[0].trim();
    try {
      if (malformada || campos.length !== CABECERA.length || !ticket) {
        throw new ErrorRegla('E05', 'Fila CSV inválida o sin identificador de ticket');
      }
      const [, placa, tipo, entrada, salida, perdido] = campos;
      const indicador = perdido.trim().toUpperCase();
      if (!['SI', 'NO', ''].includes(indicador)) {
        throw new ErrorRegla('E04', 'El campo perdido no es SI, NO ni vacío');
      }
      const datos = {
        ticket, placa, tipo: tipo.trim().toUpperCase(), entrada: entrada.trim(), salida: salida.trim(),
        ticket_perdido: indicador === 'SI',
      };
      const resultado = calcularLiquidacion(datos);
      ultimasValidas.set(ticket, { fila, datos, resultado });
    } catch (error) {
      if (!(error instanceof ErrorRegla)) throw error;
      rechazadas.push({ fila, ticket, codigo: error.codigo, motivo: error.message });
    }
  }
  const registros = [...ultimasValidas.values()]
    .sort((a, b) => a.fila - b.fila)
    .map(({ datos, resultado }) => ({ datos, resultado }));
  const aceptadas = registros.map(({ resultado }) => ({
    ticket: resultado.ticket, total_centimos: resultado.total_centimos,
  }));
  return { aceptadas, rechazadas, registros };
}
