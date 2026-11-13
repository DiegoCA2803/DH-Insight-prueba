import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

test('Persistencia: edición y borrado se conservan al volver a abrir una base existente', () => {
  const carpeta = mkdtempSync(join(tmpdir(), 'quilla-edicion-'));
  const ruta = join(carpeta, 'tickets.sqlite');
  let tickets = abrirTickets(ruta);
  try {
    const datos = { ticket: 'PERSISTENTE', tipo: 'AUTO', entrada: '2026-10-12 10:00',
      salida: '2026-10-12 11:00', ticket_perdido: false };
    tickets.guardar([{ datos, resultado: calcularLiquidacion(datos) }]);
    const editados = { ...datos, tipo: 'MOTO', salida: '2026-10-12 11:40' };
    assert(tickets.editar({ datos: editados, resultado: calcularLiquidacion(editados) }));
    tickets.cerrar();
    tickets = abrirTickets(ruta);
    assert.equal(tickets.listar('2026-10-12')[0].total_centimos, 520);
    assert.equal(tickets.cierre('2026-10-12').por_tipo.MOTO, 520);
    assert(tickets.borrar('PERSISTENTE'));
    tickets.cerrar();
    tickets = abrirTickets(ruta);
    assert.equal(tickets.listar('2026-10-12').length, 0);
    assert.equal(tickets.cierre('2026-10-12').total_centimos, 0);
  } finally {
    tickets.cerrar();
    rmSync(carpeta, { recursive: true, force: true });
  }
});
