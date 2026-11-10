import assert from 'node:assert/strict';
import { test } from 'node:test';
import { marcaLima } from '../src/fechas.js';
import { calcularLiquidacion } from '../src/tarifa.js';

function liquidar(entrada, salida, tipo = 'AUTO', ticket_perdido = false) {
  return calcularLiquidacion({ ticket: 'T-TEST', tipo, entrada, salida, ticket_perdido });
}

test('Art. 1: zonas distintas se convierten al mismo instante de Lima', () => {
  assert.equal(marcaLima('2026-10-12T05:00:00Z'), marcaLima('2026-10-12 00:00'));
  assert.equal(marcaLima('2026-10-12T00:30:00+01:00'), marcaLima('2026-10-11 18:30'));
});

test('Art. 2: se descartan los segundos de ambas marcas, no de la diferencia', () => {
  const resultado = liquidar('2026-10-12T10:00:59', '2026-10-12T10:16:00');
  assert.equal(resultado.minutos, 16);
  assert.equal(resultado.total_centimos, 600);
});

test('Art. 3: 22:00 inicia la noche, medianoche no la corta y 06:00 inicia el día', () => {
  const { detalle } = liquidar('2026-10-12 21:59', '2026-10-13 06:01');
  assert.deepEqual(detalle.map(({ articulo, monto_centimos }) => [articulo, monto_centimos]),
    [['Art. 4', 600], ['Art. 6', 1000], ['Art. 4, Adenda 1', 150]]);
  assert.equal(liquidar('2026-10-12 21:00', '2026-10-12 22:00').total_centimos, 600);
});

test('Art. 4: primera hora y fracciones diurnas normales', () => {
  const entrada = '2026-10-12 10:00';
  assert.equal(liquidar(entrada, '2026-10-12 11:00').total_centimos, 600);
  assert.equal(liquidar(entrada, '2026-10-12 11:01').total_centimos, 750);
  assert.equal(liquidar(entrada, '2026-10-12 11:20').total_centimos, 900); // E1
});

test('Art. 5 y Anexo A: domingo y feriado listado, sábado normal', () => {
  assert.equal(liquidar('2026-10-18 09:00', '2026-10-18 11:01').total_centimos, 1000); // E3
  assert.equal(liquidar('2026-10-08 09:00', '2026-10-08 10:01').total_centimos, 600);
  assert.equal(liquidar('2026-10-17 09:00', '2026-10-17 10:01').total_centimos, 750);
  assert.equal(liquidar('2026-10-09 09:00', '2026-10-09 10:01').total_centimos, 750);
});

test('Art. 6: 16 minutos y ocho horas nocturnas cuestan S/ 10', () => {
  assert.equal(liquidar('2026-10-12 22:00', '2026-10-12 22:16').total_centimos, 1000);
  assert.equal(liquidar('2026-10-12 22:00', '2026-10-13 06:00').total_centimos, 1000);
});

test('Art. 7: E5 limita cada fecha y conserva el desglose exacto', () => {
  const { total_centimos, detalle } = liquidar('2026-10-12 07:00', '2026-10-13 20:00');
  assert.equal(total_centimos, 7000);
  assert.deepEqual(detalle.map(({ articulo, monto_centimos }) => [articulo, monto_centimos]),
    [['Art. 4', 9000], ['Art. 6', 1000], ['Art. 4, Adenda 1', 8400], ['Art. 7', -6500], ['Art. 7', -4900]]);
});

test('Art. 3 y 7: una estancia que empieza a las 03:00 asigna su primer tramo a ese día', () => {
  const { total_centimos } = liquidar('2026-10-12 03:00', '2026-10-12 11:00');
  assert.equal(total_centimos, 3500);
});

test('Art. 8: la moto paga la mitad del subtotal', () => {
  assert.equal(liquidar('2026-10-12 10:00', '2026-10-12 11:20', 'MOTO').total_centimos, 450);
});

test('Art. 9: 675 céntimos baja a 670 y registra el ajuste', () => {
  const { total_centimos, detalle } = liquidar('2026-10-12 08:00', '2026-10-12 10:10', 'MOTO');
  assert.equal(total_centimos, 670);
  assert.equal(detalle.at(-1).articulo, 'Art. 9');
  assert.equal(detalle.at(-1).monto_centimos, -5);
});

test('Art. 10: el cargo perdido se suma después del descuento de moto (E4)', () => {
  const { total_centimos, detalle } = liquidar('2026-10-13 10:00', '2026-10-13 12:00', 'MOTO', true);
  assert.equal(total_centimos, 3100);
  assert.equal(detalle.at(-1).monto_centimos, 2500);
});

test('Art. 11: regla original de diez minutos conserva el cargo por pérdida', () => {
  assert.equal(liquidar('2026-09-30 10:00', '2026-09-30 10:10', 'AUTO', true).total_centimos, 2500);
  assert.equal(liquidar('2026-09-30 10:00', '2026-09-30 10:11').total_centimos, 600);
});

test('Art. 12: tope, descuento, redondeo y cargo perdido se aplican en ese orden', () => {
  const { detalle, total_centimos } = liquidar('2026-10-12 10:00', '2026-10-13 07:10', 'MOTO', true);
  assert.deepEqual(detalle.slice(-4).map(({ articulo }) => articulo), ['Art. 7', 'Art. 8', 'Art. 9', 'Art. 10']);
  assert.equal(total_centimos, 4620);
  assert.equal(detalle.reduce((suma, item) => suma + item.monto_centimos, 0), total_centimos);
});

test('Adenda 1: la primera hora se cobra solo en el primer tramo diurno con su propia tarifa', () => {
  const { detalle } = liquidar('2026-10-17 21:58', '2026-10-18 06:16');
  assert.deepEqual(detalle.map(({ monto_centimos }) => monto_centimos), [600, 1000, 200]);
});

test('Adenda 2: corte por entrada Lima, quince minutos inclusive y excepción por pérdida', () => {
  assert.equal(liquidar('2026-10-12 10:00', '2026-10-12 10:15').total_centimos, 0); // E2
  assert.equal(liquidar('2026-10-12 10:00', '2026-10-12 10:16').total_centimos, 600);
  assert.equal(liquidar('2026-10-01T04:59:00Z', '2026-10-01 00:10').total_centimos, 1000);
  assert.equal(liquidar('2026-10-01T05:00:00Z', '2026-10-01 00:15').total_centimos, 0);
  assert.equal(liquidar('2026-10-12 07:00', '2026-10-12 07:14', 'MOTO', true).total_centimos, 2800);
  assert.equal(liquidar('2026-10-12 07:00:04', '2026-10-12 07:00:12', 'MOTO', true).total_centimos, 2500);
});

test('Validación estricta del calendario y de la inversión real dentro del mismo minuto', () => {
  for (const fecha of ['2026-02-29T10:00', '2026-04-31T10:00', '2026-10-12T24:00',
    '2026-10-12T08:30+05:60', '12/10/2026 09:00', '']) {
    assert.throws(() => marcaLima(fecha), { codigo: 'E03' });
  }
  assert.equal(marcaLima('2028-02-29T10:00Z'), marcaLima('2028-02-29T05:00'));
  assert.throws(() => liquidar('2026-10-12T10:00:50', '2026-10-12T10:00:01'), { codigo: 'E01' });
});
