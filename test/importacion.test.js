import assert from 'node:assert/strict';
import { test } from 'node:test';
import { procesarCsv } from '../src/importacion.js';

/** Añade la cabecera oficial para probar combinaciones de filas del CSV. */
function importar(filas) {
  return procesarCsv(Buffer.from(['ticket,placa,tipo,entrada,salida,perdido', ...filas].join('\n')));
}

const valida = 'DUP,ABC,AUTO,2026-10-12 10:00,2026-10-12 11:00,NO';
const invalida = 'DUP,ABC,CAMION,2026-10-12 10:00,2026-10-12 11:00,NO';
const corregida = 'DUP,ABC,AUTO,2026-10-12 10:00,2026-10-12 11:40,NO';

test('CSV: entre cinco duplicados se conserva la última válida aunque termine con una inválida', () => {
  const resultado = importar([valida, invalida, corregida, invalida, invalida]);
  assert.deepEqual(resultado.aceptadas, [{ ticket: 'DUP', total_centimos: 1050 }]);
  assert.deepEqual(resultado.rechazadas.map(({ fila, codigo }) => [fila, codigo]), [[3, 'E02'], [5, 'E02'], [6, 'E02']]);
  assert.equal(resultado.registros.length, 1);
});

test('CSV: una válida posterior permite aceptar el ticket y reportar la inválida anterior', () => {
  const resultado = importar([invalida, valida]);
  assert.deepEqual(resultado.aceptadas, [{ ticket: 'DUP', total_centimos: 600 }]);
  assert.equal(resultado.rechazadas.length, 1);
});

test('CSV: si todas las filas del ticket son inválidas, ninguna se guarda', () => {
  const resultado = importar([invalida, invalida]);
  assert.equal(resultado.aceptadas.length, 0);
  assert.equal(resultado.registros.length, 0);
  assert.equal(resultado.rechazadas.length, 2);
});

test('CSV: las válidas sustituidas no se cuentan como rechazadas', () => {
  const resultado = importar([valida, corregida, valida]);
  assert.deepEqual(resultado.aceptadas, [{ ticket: 'DUP', total_centimos: 600 }]);
  assert.equal(resultado.rechazadas.length, 0);
});
