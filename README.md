# Parqueo Quilla

Liquidador de estacionamiento, importación CSV y cierre de caja. El enunciado original está en [INFO](INFO).

## Ejecutar

Con Node.js 22.20 o superior, desde la raíz del repositorio:

```bash
npm start
```

Abre [http://localhost:3000](http://localhost:3000). Node trae SQLite integrado y el proyecto funciona sin instalar paquetes. La base se crea en `data/tickets.sqlite`. Las variables opcionales `PORT` y `DB_PATH` cambian el puerto y la ruta de la base.

```bash
npm test
```

Las 22 pruebas cubren los doce artículos, las dos adendas, el Anexo A y los cinco ejemplos públicos. Las pruebas HTTP importan el CSV oficial, validan el cierre en Lima y vuelven a abrir la base después de apagar el servidor. También comprueban la corrección de un ticket existente, su traslado entre cierres y la conservación del cobro anterior cuando una corrección se rechaza. Una prueba adicional verifica la reversión completa de una transacción que falla a mitad del lote.

En Windows, si PowerShell bloquea el script `npm.ps1`, usa `npm.cmd start` o `npm.cmd test`.

## Demostración

1. Liquida un AUTO con ticket `DEMO-1`, entrada el 12/10/2026 a las 10:00 y salida a las 11:20. Verás 80 minutos y S/ 9.00.
2. Importa [legado_ejemplo.csv](legado_ejemplo.csv). Verás cuatro filas aceptadas y cuatro rechazadas. La primera aparición de `T-1001` queda sustituida por la última.
3. Consulta el cierre del 12/10/2026. En una base inicialmente vacía, luego de los pasos anteriores, verás cinco tickets y S/ 80.70. Si solo importas el CSV, serán cuatro tickets y S/ 71.70.

## API

Todos los montos de la API son céntimos enteros. Un error de validación a nivel de solicitud devuelve HTTP 422 con `codigo` y `mensaje`. Por ejemplo, `{"codigo":"E01","mensaje":"La salida es anterior a la entrada"}`. Las filas rechazadas se reportan individualmente en una importación con cabecera válida.

### POST /api/liquidaciones

Envía JSON con `ticket`, `tipo` (`AUTO` o `MOTO`), `entrada`, `salida` y `ticket_perdido` booleano.

```json
{
  "ticket": "DEMO-1",
  "tipo": "AUTO",
  "entrada": "2026-10-12T10:00:00-05:00",
  "salida": "2026-10-12T11:20:00-05:00",
  "ticket_perdido": false
}
```

HTTP 200. Devuelve `ticket`, `minutos`, `total_centimos` y `detalle`. Cada línea del detalle incluye `concepto`, `articulo` y `monto_centimos`. Los ajustes hacia abajo son negativos. Un cobro de cero devuelve un detalle vacío.

### POST /api/importaciones

Envía el CSV UTF-8 como `multipart/form-data` en el campo `archivo`. El límite del cuerpo es 5 MiB. HTTP 200 con esta estructura:

```json
{
  "aceptadas": [{"ticket":"T-1002","total_centimos":670}],
  "rechazadas": [{"fila":4,"ticket":"T-1003","codigo":"E02","motivo":"El tipo de vehículo no es AUTO ni MOTO"}]
}
```

La fila es la línea física en la que empieza el registro, contando la cabecera como línea 1. Los duplicados se resuelven antes de validar y se conserva la última fila del archivo por ticket. En ambos endpoints de escritura, una operación aceptada con un identificador existente actualiza ese ticket.

Las consultas al evaluador siguen sin respuesta. El comportamiento de duplicados y la asignación de fecha a los tramos nocturnos se mantienen como supuestos documentados en DECISIONES.md. Si una corrección válida cambia la fecha de salida en Lima, el ticket se traslada al nuevo cierre. Una corrección rechazada conserva el cobro anterior.

### GET /api/cierre?fecha=2026-10-12

HTTP 200. Ejemplo después de importar únicamente el CSV de muestra:

```json
{
  "cantidad": 4,
  "total_centimos": 7170,
  "por_tipo": {"AUTO":3700,"MOTO":3470},
  "tickets_perdidos_centimos": 2800
}
```

La fecha del cierre es la de la salida en Lima. El subtotal de perdidos suma el cobro completo de esos tickets. Los importes de perdidos ya están incluidos en su tipo de vehículo y en el total.

| Código | Motivo |
| --- | --- |
| E01 | Salida anterior a la entrada. |
| E02 | Tipo distinto de AUTO o MOTO. |
| E03 | Marca de tiempo o fecha de cierre inválida. |
| E04 | Indicador perdido inválido en una fila CSV. |
| E05 | Error estructural de solicitud o fila, como cabecera inválida, archivo ausente o ticket vacío. |

Consulta [DECISIONES.md](DECISIONES.md) para las interpretaciones del contrato, [DEFENSA.md](DEFENSA.md) para las preguntas y el recorrido del código, e [IA.md](IA.md) para la declaración de asistencia.
