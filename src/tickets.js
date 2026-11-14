import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fechaLima, marcaLima } from './fechas.js';

/** Abre SQLite y devuelve las operaciones de persistencia usadas por los servicios de negocio. */
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
  // Consultas parametrizadas: los datos del ticket nunca se concatenan al SQL.
  // La clave única permite corregir o reimportar sin duplicar el cobro del cierre.
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
  const listar = db.prepare(`
    SELECT ticket, placa, tipo, entrada, salida, perdido AS ticket_perdido, minutos, total_centimos
    FROM tickets WHERE fecha_salida = ?
  `);
  const actualizar = db.prepare(`
    UPDATE tickets SET tipo = ?, entrada = ?, salida = ?, fecha_salida = ?,
      perdido = ?, minutos = ?, total_centimos = ?, detalle = ? WHERE ticket = ?
  `);
  const borrar = db.prepare('DELETE FROM tickets WHERE ticket = ?');

  return {
    /** Ordena por el instante de salida en Lima, aunque las marcas usen zonas distintas. */
    listar(fecha) {
      return listar.all(fecha)
        .sort((a, b) => marcaLima(a.salida) - marcaLima(b.salida) || a.ticket.localeCompare(b.ticket))
        .map((fila) => ({ ...fila, ticket_perdido: Boolean(fila.ticket_perdido) }));
    },
    /** Actualiza un registro existente y su fecha de caja; no crea tickets por accidente. */
    editar({ datos, resultado }) {
      const cambio = actualizar.run(datos.tipo, datos.entrada, datos.salida,
        fechaLima(marcaLima(datos.salida)), Number(datos.ticket_perdido), resultado.minutos,
        resultado.total_centimos, JSON.stringify(resultado.detalle), datos.ticket);
      return cambio.changes === 1;
    },
    /** Informa si se eliminó un registro para distinguir un borrado de un ticket inexistente. */
    borrar(ticket) {
      return borrar.run(ticket).changes === 1;
    },
    /** Guarda el lote completo en una transacción: ante un fallo se revierte toda la escritura. */
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
    /** Agrupa por salida en Lima; el subtotal de perdidos ya forma parte del total por vehículo. */
    cierre(fecha) {
      const { cantidad, total_centimos, auto, moto, perdidos } = consultar.get(fecha);
      return {
        cantidad, total_centimos, por_tipo: { AUTO: auto, MOTO: moto },
        tickets_perdidos_centimos: perdidos,
      };
    },
    // Libera la conexión cuando el servidor o las pruebas terminan de usarla.
    cerrar: () => db.close(),
  };
}
