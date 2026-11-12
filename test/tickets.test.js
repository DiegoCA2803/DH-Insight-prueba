import assert from 'node:assert/strict';
import { test } from 'node:test';
import { abrirTickets } from '../src/tickets.js';
import { calcularLiquidacion } from '../src/tarifa.js';

test('Persistencia: un fallo a mitad del lote revierte también las actualizaciones anteriores', (t) => {
  const tickets = abrirTickets(':memory:');
  t.after(() => tickets.cerrar());
  const datos = {
    ticket: 'ORIGINAL', tipo: 'AUTO', entrada: '2026-10-12 10:00',
    salida: '2026-10-12 11:00', ticket_perdido: false,
  };
  tickets.guardar([{ datos, resultado: calcularLiquidacion(datos) }]);
  const modificados = { ...datos, salida: '2026-10-13 11:00' };
  assert.throws(() => tickets.guardar([
    { datos: modificados, resultado: calcularLiquidacion(modificados) },
    { datos: { ...datos, ticket: 'FALLA', tipo: 'CAMION' }, resultado: calcularLiquidacion(datos) },
  ]));
  assert.equal(tickets.cierre('2026-10-12').total_centimos, 600);
  assert.equal(tickets.cierre('2026-10-12').cantidad, 1);
  assert.equal(tickets.cierre('2026-10-13').cantidad, 0);
});
