# Parqueo Quilla

Liquidador de estacionamiento, importación CSV y cierre de caja. El enunciado original está en [INFO](INFO).

## Iniciar con Docker

Requisito: Docker con Compose. En Windows o macOS, abre Docker Desktop y usa contenedores Linux. No necesitas instalar Node.js ni SQLite en tu equipo.

Desde la carpeta que contiene `compose.yaml`, ejecuta:

```bash
docker compose up --build -d
```

Abre [http://localhost:3000](http://localhost:3000). La primera ejecución descarga la imagen de Node.js 22.20.0, construye la aplicación y ejecuta las 30 pruebas antes de iniciar el servidor. Si una prueba falla, la construcción se detiene.

Para revisar el estado o ver los mensajes del servidor:

```bash
docker compose ps
docker compose logs -f app
```

Para detener la aplicación:

```bash
docker compose down
```

Los tickets se guardan en SQLite dentro del volumen `datos`, separado del contenedor. Se conservan al detener, reconstruir o volver a iniciar con `docker compose up --build -d`. La base de Docker es independiente de `data/tickets.sqlite` y de las pruebas manuales ejecutadas sin Docker; el primer arranque crea una base vacía. `docker compose down --volumes` elimina ese volumen y todos los tickets guardados en él.

Si el puerto 3000 está ocupado, puedes usar otro puerto. Por ejemplo, en PowerShell:

```powershell
$env:APP_PORT = '3001'
docker compose up --build -d
```

En ese caso abre [http://localhost:3001](http://localhost:3001). El servidor dentro del contenedor mantiene su puerto 3000.

### Ejecutar las pruebas con Docker

Después de construir la imagen, puedes repetir las pruebas sin mantener el servidor encendido:

```bash
docker compose run --rm --no-deps app npm test
```

Las pruebas usan bases temporales y no modifican los tickets de la aplicación. El contexto de construcción incluye solo código, pruebas y el CSV de ejemplo; excluye las bases locales y los archivos personales.

## Ejecutar sin Docker

Con Node.js 22.20 o superior, desde la raíz del repositorio:

```bash
npm start
```

Abre [http://localhost:3000](http://localhost:3000). Node trae SQLite integrado y el proyecto funciona sin instalar paquetes. La base se crea en `data/tickets.sqlite`. Las variables opcionales `PORT` y `DB_PATH` cambian el puerto y la ruta de la base.

```bash
npm test
```

Las 30 pruebas cubren los doce artículos, las dos adendas, el Anexo A y los cinco ejemplos públicos. Incluyen los dos casos de atribución de tramos confirmados por el evaluador, verificando sus totales y desgloses. Las pruebas HTTP importan el CSV oficial, validan el cierre en Lima y vuelven a abrir la base después de apagar el servidor. También comprueban la corrección de un ticket existente, su traslado entre cierres y la conservación del cobro anterior cuando una corrección se rechaza. Una prueba adicional verifica la reversión completa de una transacción que falla a mitad del lote.

En Windows, si PowerShell bloquea el script `npm.ps1`, usa `npm.cmd start` o `npm.cmd test`.

## Organización del código

| Archivo | Responsabilidad |
| --- | --- |
| `src/server.js` | Arranque del servidor, rutas, recursos de la interfaz y respuesta de errores. |
| `src/http.js` | Lectura de JSON y multipart, límite del cuerpo HTTP y serialización de respuestas. |
| `src/operaciones.js` | Validación de solicitudes de negocio y coordinación entre cálculo y guardado. |
| `src/tarifa.js` | Motor tarifario independiente de HTTP y SQLite. |
| `src/fechas.js` | Conversión a Lima y validación del calendario. |
| `src/importacion.js` | Lectura del CSV, resolución de duplicados y validación por fila. |
| `src/tickets.js` | Persistencia SQLite, transacciones y consulta de caja. |
| `public/` | Navegación de las tres vistas, formularios y presentación de resultados. |

La interfaz usa una navegación lateral que se adapta a móvil. La liquidación muestra un comprobante con el total y los artículos aplicados. La importación distingue aceptadas y rechazadas, y el cierre presenta el total y la distribución por vehículo y por tickets perdidos. Los datos recibidos se insertan como texto en la página.

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

La fila es la línea física en la que empieza el registro, contando la cabecera como línea 1. Se valida cada fila y se conserva la última válida de cada ticket. Las inválidas se reportan con su número de fila y motivo, incluso cuando otra fila del mismo ticket se acepta. Las válidas sustituidas no se cuentan como rechazadas. En ambos endpoints de escritura, una operación aceptada con un identificador existente actualiza ese ticket.

El evaluador confirmó la fecha del inicio efectivo de cada tramo: un AUTO del 12/10 a las 03:00 a las 11:00 paga S/ 35; si entra el 11/10 a las 23:00 y sale el 12/10 a las 11:00, paga S/ 40 porque los tramos pertenecen a fechas distintas. También admitió ambas políticas para duplicados con una última fila inválida. Elegimos la última válida, lo advertimos en la pantalla de importación y justificamos sus ventajas y límites en DECISIONES.md. Los demás supuestos siguen documentados por separado. Si una corrección válida cambia la fecha de salida en Lima, el ticket se traslada al nuevo cierre. Una corrección rechazada conserva el cobro anterior.

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

Consulta [DECISIONES.md](DECISIONES.md) para las interpretaciones del contrato e [IA.md](IA.md) para la declaración de asistencia.

## Gestión de tickets y consulta del reglamento

El botón «Consultar artículos» abre una ventana con los doce artículos, ambas adendas y los feriados. Los artículos citados en el comprobante abren la misma ventana en la explicación correspondiente.

El cierre muestra los tickets de la fecha consultada. Editar permite cambiar vehículo, entrada, salida y pérdida del ticket. El identificador permanece fijo. El cobro se recalcula con el mismo motor y se refrescan los totales del cierre. Borrar pide confirmación y elimina el ticket de la base.

| Endpoint adicional | Resultado |
| --- | --- |
| GET /api/tickets?fecha=2026-10-12 | Objeto con tickets, ordenados por salida en Lima. Cada ticket incluye ticket, placa, tipo, entrada, salida, ticket_perdido, minutos y total_centimos. |
| PUT /api/tickets/{ticket} | Recibe tipo, entrada, salida y ticket_perdido. Devuelve la liquidación recalculada. Si se incluye ticket, debe coincidir con la ruta. |
| DELETE /api/tickets/{ticket} | Devuelve ticket y eliminado=true. |

Un ticket inexistente en edición o borrado devuelve HTTP 404 con codigo E06 y mensaje. Los errores de validación siguen devolviendo HTTP 422. Los tres endpoints originales mantienen sus contratos.
