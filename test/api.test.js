import assert from 'node:assert/strict';
import { once } from 'node:events';
import { request } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { crearServidor } from '../src/server.js';

async function abrir(rutaDb) {
  const servidor = crearServidor({ rutaDb });
  servidor.listen(0, '127.0.0.1');
  await once(servidor, 'listening');
  const base = 'http://127.0.0.1:' + servidor.address().port;
  return {
    base,
    pedir: (ruta, opciones) => fetch(base + ruta, opciones),
    parar: () => new Promise((resolver, rechazar) =>
      servidor.close((error) => error ? rechazar(error) : resolver())),
  };
}

function liquidar(app, cambios = {}) {
  return app.pedir('/api/liquidaciones', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticket: 'T-ZONA', tipo: 'AUTO', entrada: '2026-10-13T03:00:00Z', salida: '2026-10-13T04:10:00Z',
      ticket_perdido: false, ...cambios,
    }),
  });
}

function importar(app, csv) {
  const form = new FormData();
  form.set('archivo', new Blob([csv], { type: 'text/csv' }), 'legado.csv');
  return app.pedir('/api/importaciones', { method: 'POST', body: form });
}

test('API: ejemplos CSV, cierre en Lima, actualización sin duplicar y persistencia al reabrir', async () => {
  const carpeta = await mkdtemp(join(tmpdir(), 'quilla-'));
  const rutaDb = join(carpeta, 'tickets.sqlite');
  let app = await abrir(rutaDb);
  try {
    const portada = await app.pedir('/');
    assert.equal(portada.status, 200);
    assert.match(await portada.text(), /form-liquidar[\s\S]*form-importar[\s\S]*form-cierre/);
    for (const ruta of ['/app.js', '/estilos.css']) {
      const recurso = await app.pedir(ruta);
      assert.equal(recurso.status, 200);
      await recurso.text();
    }
    const csv = await readFile(new URL('../legado_ejemplo.csv', import.meta.url));
    const importacion = await importar(app, csv);
    assert.equal(importacion.status, 200);
    const { aceptadas, rechazadas } = await importacion.json();
    assert.deepEqual(aceptadas.map((fila) => [fila.ticket, fila.total_centimos]),
      [['T-1002', 670], ['T-1001', 2100], ['T-1006', 1600], ['T-1007', 2800]]);
    assert.deepEqual(rechazadas.map(({ fila, codigo }) => [fila, codigo]),
      [[4, 'E02'], [5, 'E03'], [6, 'E01'], [10, 'E03']]);

    const primera = await liquidar(app);
    assert.equal(primera.status, 200);
    assert.equal((await primera.json()).total_centimos, 1000);
    const segunda = await liquidar(app);
    assert.equal(segunda.status, 200);
    await segunda.json();

    await app.parar();
    app = await abrir(rutaDb);
    const cierre = await app.pedir('/api/cierre?fecha=2026-10-12');
    assert.equal(cierre.status, 200);
    assert.deepEqual(await cierre.json(), {
      cantidad: 5, total_centimos: 8170, por_tipo: { AUTO: 4700, MOTO: 3470 },
      tickets_perdidos_centimos: 2800,
    });
    const siguiente = await app.pedir('/api/cierre?fecha=2026-10-13');
    assert.equal((await siguiente.json()).cantidad, 0);
  } finally {
    await app.parar();
    await rm(carpeta, { recursive: true, force: true });
  }
});

test('API: corregir por JSON y CSV mantiene una sola liquidación y traslada el cierre', async (t) => {
  const app = await abrir(':memory:');
  t.after(() => app.parar());
  const original = await liquidar(app, {
    ticket: 'CORRECCION', entrada: '2026-10-12 08:15', salida: '2026-10-12 11:40',
  });
  assert.equal(original.status, 200);
  assert.equal((await original.json()).total_centimos, 2100);

  const corregida = await liquidar(app, {
    ticket: 'CORRECCION', entrada: '2026-10-12 08:15', salida: '2026-10-12 12:10',
  });
  assert.equal(corregida.status, 200);
  assert.equal((await corregida.json()).total_centimos, 2400);
  const cierreCorregido = await app.pedir('/api/cierre?fecha=2026-10-12');
  assert.deepEqual(await cierreCorregido.json(), {
    cantidad: 1, total_centimos: 2400, por_tipo: { AUTO: 2400, MOTO: 0 },
    tickets_perdidos_centimos: 0,
  });

  const importada = await importar(app, [
    'ticket,placa,tipo,entrada,salida,perdido',
    'CORRECCION,ABC,MOTO,2026-10-13 08:15,2026-10-13 09:15,SI',
  ].join('\n'));
  assert.equal(importada.status, 200);
  assert.deepEqual((await importada.json()).aceptadas, [{ ticket: 'CORRECCION', total_centimos: 2800 }]);
  const cierreAnterior = await app.pedir('/api/cierre?fecha=2026-10-12');
  assert.equal((await cierreAnterior.json()).cantidad, 0);
  const cierreNuevo = await app.pedir('/api/cierre?fecha=2026-10-13');
  assert.deepEqual(await cierreNuevo.json(), {
    cantidad: 1, total_centimos: 2800, por_tipo: { AUTO: 0, MOTO: 2800 },
    tickets_perdidos_centimos: 2800,
  });
});

test('API: última fila inválida conserva la última válida y una corrección JSON rechazada no la modifica', async (t) => {
  const app = await abrir(':memory:');
  t.after(() => app.parar());
  const original = await liquidar(app);
  await original.json();
  const importada = await importar(app, [
    'ticket,placa,tipo,entrada,salida,perdido',
    'T-ZONA,ABC,AUTO,2026-10-13 09:00,2026-10-13 10:00,NO',
    'T-ZONA,ABC,AUTO,2026-10-13 09:00,,NO',
    'NUEVO,ABC,AUTO,2026-10-13 09:00,2026-10-13 10:00,NO',
  ].join('\n'));
  const reporte = await importada.json();
  assert.deepEqual(reporte.aceptadas, [{ ticket: 'T-ZONA', total_centimos: 600 }, { ticket: 'NUEVO', total_centimos: 600 }]);
  assert.deepEqual(reporte.rechazadas.map(({ fila, ticket, codigo }) => ({ fila, ticket, codigo })),
    [{ fila: 3, ticket: 'T-ZONA', codigo: 'E03' }]);
  const rechazada = await liquidar(app, { salida: '' });
  assert.equal(rechazada.status, 422);
  assert.equal((await rechazada.json()).codigo, 'E03');
  const anterior = await app.pedir('/api/cierre?fecha=2026-10-12');
  assert.equal((await anterior.json()).total_centimos, 0);
  const nuevo = await app.pedir('/api/cierre?fecha=2026-10-13');
  assert.equal((await nuevo.json()).total_centimos, 1200);
});

test('API: solicitudes malformadas devuelven error sin detener el servidor', async (t) => {
  const app = await abrir(':memory:');
  t.after(() => app.parar());
  const malformada = await new Promise((resolver, rechazar) => {
    const req = request(app.base, { path: 'http://[' }, (res) => {
      const partes = [];
      res.on('data', (parte) => partes.push(parte));
      res.on('end', () => resolver({ status: res.statusCode, cuerpo: JSON.parse(Buffer.concat(partes)) }));
      res.on('error', rechazar);
    });
    req.on('error', rechazar);
    req.end();
  });
  assert.equal(malformada.status, 422);
  assert.equal(malformada.cuerpo.codigo, 'E05');
  const jsonInvalido = await app.pedir('/api/liquidaciones', {
    method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' },
  });
  assert.equal(jsonInvalido.status, 422);
  assert.equal((await jsonInvalido.json()).codigo, 'E05');
  const sinArchivo = await app.pedir('/api/importaciones', { method: 'POST', body: new FormData() });
  assert.equal(sinArchivo.status, 422);
  assert.equal((await sinArchivo.json()).codigo, 'E05');
  const normal = await liquidar(app);
  assert.equal(normal.status, 200);
  assert.equal((await normal.json()).total_centimos, 1000);
});

test('API: errores 422 uniformes y última fila válida entre duplicados', async (t) => {
  const app = await abrir(':memory:');
  t.after(() => app.parar());
  for (const [cambios, codigo] of [
    [{ tipo: 'moto' }, 'E02'], [{ salida: '2026-02-30 10:00' }, 'E03'],
    [{ salida: '2026-10-13T02:10:00Z' }, 'E01'],
  ]) {
    const respuesta = await liquidar(app, cambios);
    assert.equal(respuesta.status, 422);
    const error = await respuesta.json();
    assert.deepEqual(Object.keys(error), ['codigo', 'mensaje']);
    assert.equal(error.codigo, codigo);
  }
  const cierre = await app.pedir('/api/cierre?fecha=2026-02-30');
  assert.equal(cierre.status, 422);
  assert.equal((await cierre.json()).codigo, 'E03');

  const importacion = await importar(app, [
    'ticket,placa,tipo,entrada,salida,perdido',
    'REPETIDO,ABC,AUTO,2026-10-12 09:00,2026-10-12 10:00,NO',
    'REPETIDO,ABC,AUTO,2026-10-12 09:00,2026-10-12 10:00,X',
    '"T,1","ABC\r\n123", moto ,2026-10-12 09:00,2026-10-12 10:00,si',
  ].join('\r\n'));
  assert.equal(importacion.status, 200);
  const reporte = await importacion.json();
  assert.deepEqual(reporte.aceptadas, [{ ticket: 'REPETIDO', total_centimos: 600 }, { ticket: 'T,1', total_centimos: 2800 }]);
  assert.deepEqual(reporte.rechazadas.map(({ fila, codigo }) => [fila, codigo]), [[3, 'E04']]);
  const sinCabecera = await importar(app, 'a,b,c');
  assert.equal(sinCabecera.status, 422);
  assert.equal((await sinCabecera.json()).codigo, 'E05');
});

test('API: listar, editar, trasladar y borrar un ticket recalcula los cierres', async (t) => {
  const app = await abrir(':memory:');
  t.after(() => app.parar());
  const id = 'T /#?';
  const original = await liquidar(app, { ticket: id });
  await original.json();
  const lista = await app.pedir('/api/tickets?fecha=2026-10-12');
  const { tickets } = await lista.json();
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].ticket, id);
  assert.equal(tickets[0].ticket_perdido, false);
  assert.equal(tickets[0].entrada, '2026-10-13T03:00:00Z');

  const ruta = '/api/tickets/' + encodeURIComponent(id);
  const editada = await app.pedir(ruta, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo: 'MOTO', entrada: '2026-10-13T10:00:10.123-05:00',
      salida: '2026-10-13T12:00:12.456-05:00', ticket_perdido: true }),
  });
  assert.equal(editada.status, 200);
  assert.equal((await editada.json()).total_centimos, 3100);
  const anterior = await app.pedir('/api/cierre?fecha=2026-10-12');
  assert.equal((await anterior.json()).cantidad, 0);
  const siguiente = await app.pedir('/api/cierre?fecha=2026-10-13');
  assert.deepEqual(await siguiente.json(), {
    cantidad: 1, total_centimos: 3100, por_tipo: { AUTO: 0, MOTO: 3100 }, tickets_perdidos_centimos: 3100,
  });
  const nuevaLista = await app.pedir('/api/tickets?fecha=2026-10-13');
  const [nuevo] = (await nuevaLista.json()).tickets;
  assert.equal(nuevo.entrada, '2026-10-13T10:00:10.123-05:00');
  assert.equal(nuevo.ticket_perdido, true);
  const borrada = await app.pedir(ruta, { method: 'DELETE' });
  assert.equal(borrada.status, 200);
  assert.deepEqual(await borrada.json(), { ticket: id, eliminado: true });
  const cierre = await app.pedir('/api/cierre?fecha=2026-10-13');
  assert.equal((await cierre.json()).total_centimos, 0);
  const segunda = await app.pedir(ruta, { method: 'DELETE' });
  assert.equal(segunda.status, 404);
  assert.equal((await segunda.json()).codigo, 'E06');
});

test('API: editar con errores conserva el registro y editar un inexistente no lo crea', async (t) => {
  const app = await abrir(':memory:');
  t.after(() => app.parar());
  const original = await liquidar(app);
  await original.json();
  const datos = { tipo: 'AUTO', entrada: '2026-10-12 10:00', salida: '2026-10-12 11:00', ticket_perdido: false };
  const error = await app.pedir('/api/tickets/T-ZONA', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...datos, salida: '2026-10-12 09:00' }),
  });
  assert.equal(error.status, 422);
  assert.equal((await error.json()).codigo, 'E01');
  const ausente = await app.pedir('/api/tickets/AUSENTE', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
  });
  assert.equal(ausente.status, 404);
  assert.equal((await ausente.json()).codigo, 'E06');
  const lista = await app.pedir('/api/tickets?fecha=2026-10-12');
  const { tickets } = await lista.json();
  assert.equal(tickets.length, 1);
  assert.equal(tickets[0].total_centimos, 1000);
});
