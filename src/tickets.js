import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fechaLima, marcaLima } from './fechas.js';

export function abrirTickets(ruta) {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec(`
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS tickets (
      ticket TEXT PRIMARY KEY,
      placa TEXT,
      tipo TEXT NOT NULL CHECK (tipo IN ('AUTO', 'MOTO')),
      entrada TEXT NOT NULL,
      salida TEXT NOT NULL,
      fecha_salida TEXT NOT NULL,
      perdido INTEGER NOT NULL CHECK (perdido IN (0, 1)),
      minutos INTEGER NOT NULL,
      total_centimos INTEGER NOT NULL,
      detalle TEXT NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS tickets_fecha_salida ON tickets (fecha_salida);
  `);
  const insertar = db.prepare(`
    INSERT INTO tickets (ticket, placa, tipo, entrada, salida, fecha_salida, perdido, minutos, total_centimos, detalle)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(ticket) DO UPDATE SET
      placa = COALESCE(excluded.placa, tickets.placa), tipo = excluded.tipo,
      entrada = excluded.entrada, salida = excluded.salida, fecha_salida = excluded.fecha_salida,
      perdido = excluded.perdido, minutos = excluded.minutos,
      total_centimos = excluded.total_centimos, detalle = excluded.detalle
  `);
  const consultar = db.prepare(`
    SELECT COUNT(*) AS cantidad, COALESCE(SUM(total_centimos), 0) AS total_centimos,
      COALESCE(SUM(CASE WHEN tipo = 'AUTO' THEN total_centimos END), 0) AS auto,
      COALESCE(SUM(CASE WHEN tipo = 'MOTO' THEN total_centimos END), 0) AS moto,
      COALESCE(SUM(CASE WHEN perdido = 1 THEN total_centimos END), 0) AS perdidos
    FROM tickets WHERE fecha_salida = ?
  `);

  return {
    guardar(registros) {
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const { datos, resultado } of registros) {
          insertar.run(datos.ticket, datos.placa ?? null, datos.tipo, datos.entrada, datos.salida,
            fechaLima(marcaLima(datos.salida)), Number(datos.ticket_perdido), resultado.minutos,
            resultado.total_centimos, JSON.stringify(resultado.detalle));
        }
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    cierre(fecha) {
      const { cantidad, total_centimos, auto, moto, perdidos } = consultar.get(fecha);
      return {
        cantidad, total_centimos, por_tipo: { AUTO: auto, MOTO: moto },
        tickets_perdidos_centimos: perdidos,
      };
    },
    cerrar: () => db.close(),
  };
}
