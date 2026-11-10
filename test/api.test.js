import assert from 'node:assert/strict';
import { once } from 'node:events';
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

test('API: errores 422 uniformes y solo la última fila CSV se valida', async (t) => {
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
  assert.deepEqual(reporte.aceptadas, [{ ticket: 'T,1', total_centimos: 2800 }]);
  assert.deepEqual(reporte.rechazadas.map(({ fila, codigo }) => [fila, codigo]), [[3, 'E04']]);
  const sinCabecera = await importar(app, 'a,b,c');
  assert.equal(sinCabecera.status, 422);
  assert.equal((await sinCabecera.json()).codigo, 'E05');
});
