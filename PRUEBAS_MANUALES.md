# Checklist de aceptación de Parqueo Quilla

Abre http://localhost:3000. Se inició la aplicación con DB_PATH=data/pruebas-manuales.sqlite. Al preparar este checklist, esa base estaba vacía. Completa la columna «Cumple» después de verificar cada resultado. En los formularios, las horas son de Lima y el formato visible de fecha depende de tu navegador.

## Orden para probar

1. Importa primero legado_ejemplo.csv y verifica I01–I03 y C00.
2. Importa pruebas/cierre.csv y verifica C01–C03.
3. Importa pruebas/correccion_caja.csv y verifica C04–C05.
4. Importa pruebas/validaciones.csv y verifica I04–I06.
5. Prueba los formularios con los tickets L01-L29 y E01.
6. Comprueba la API, la persistencia, los documentos y la defensa.

Usa los identificadores indicados. Repetir un ticket válido lo actualiza. Los totales de caja de este documento se refieren a los pasos y las fechas indicados.

## Liquidación en la interfaz

Selecciona «Liquidar ticket». Usa el ID de la primera columna como identificador del ticket. Pulsa «Calcular y guardar» en cada caso. Todos los años son 2026. «No» significa dejar desmarcado «El cliente perdió su ticket».

| ID / ticket | Tipo | Entrada | Salida | Perdido | Total esperado | Qué valida | Cumple |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L01 | AUTO | 12/10 10:00 | 12/10 11:20 | No | S/ 9.00 y 80 minutos | Ejemplo E1, Art. 4 | [ ] |
| L02 | AUTO | 12/10 10:00 | 12/10 10:15 | No | S/ 0.00 | Ejemplo E2, Adenda 2 | [ ] |
| L03 | AUTO | 18/10 09:00 | 18/10 11:01 | No | S/ 10.00 | Ejemplo E3, domingo | [ ] |
| L04 | MOTO | 13/10 10:00 | 13/10 12:00 | Sí | S/ 31.00 | Ejemplo E4, descuento antes del cargo | [ ] |
| L05 | AUTO | 12/10 07:00 | 13/10 20:00 | No | S/ 70.00 | Ejemplo E5, dos topes y primera hora única | [ ] |
| L06 | AUTO | 12/10 10:00 | 12/10 11:00 | No | S/ 6.00 | Primera hora completa | [ ] |
| L07 | AUTO | 12/10 10:00 | 12/10 11:01 | No | S/ 7.50 | Un minuto adicional activa un cuarto | [ ] |
| L08 | AUTO | 12/10 10:00 | 12/10 11:15 | No | S/ 7.50 | Cuarto exacto | [ ] |
| L09 | AUTO | 12/10 10:00 | 12/10 11:16 | No | S/ 9.00 | Siguiente cuarto | [ ] |
| L10 | AUTO | 08/10 10:00 | 08/10 11:01 | No | S/ 6.00 | Feriado del Anexo A, Art. 5 | [ ] |
| L11 | AUTO | 17/10 10:00 | 17/10 11:00 | No | S/ 6.00 | Sábado normal | [ ] |
| L12 | AUTO | 12/10 22:00 | 12/10 22:16 | No | S/ 10.00 | Noche corta, Art. 6 | [ ] |
| L13 | AUTO | 12/10 22:00 | 13/10 06:00 | No | S/ 10.00 | Noche completa, medianoche no corta el tramo | [ ] |
| L14 | AUTO | 12/10 21:50 | 12/10 22:10 | No | S/ 16.00 | Cruce de franja, dos cargos | [ ] |
| L15 | AUTO | 12/10 21:00 | 12/10 22:00 | No | S/ 6.00 | Salida a las 22:00 sin tramo nocturno de duración cero | [ ] |
| L16 | AUTO | 12/10 05:50 | 12/10 06:10 | No | S/ 16.00 | Cruce de las 06:00 | [ ] |
| L17 | AUTO | 12/10 07:00 | 12/10 22:00 | No | S/ 35.00 | Tope diario antes de descuentos, Art. 7 | [ ] |
| L18 | MOTO | 12/10 08:00 | 12/10 10:10 | No | S/ 6.70 | Descuento y redondeo, Arts. 8–9 | [ ] |
| L19 | AUTO | 30/09 10:00 | 30/09 10:10 | No | S/ 0.00 | Tolerancia original inclusiva | [ ] |
| L20 | AUTO | 30/09 10:00 | 30/09 10:11 | No | S/ 6.00 | Se supera la tolerancia original | [ ] |
| L21 | AUTO | 12/10 10:00 | 12/10 10:16 | No | S/ 6.00 | Se supera la nueva tolerancia | [ ] |
| L22 | AUTO | 30/09 10:00 | 30/09 10:10 | Sí | S/ 25.00 | La regla original conserva el cargo perdido | [ ] |
| L23 | MOTO | 12/10 07:00 | 12/10 07:14 | Sí | S/ 28.00 | Nueva tolerancia no se aplica a perdidos | [ ] |
| L24 | AUTO | 12/10 10:00 | 12/10 10:00 | Sí | S/ 25.00 | Supuesto de cero minutos sin tramos | [ ] |
| L25 | AUTO | 12/10 03:00 | 12/10 11:00 | No | S/ 35.00 | Confirmado por el evaluador: ambos tramos pertenecen al 12/10 y comparten tope | [ ] |
| L26 | AUTO | 17/10 21:58 | 18/10 06:16 | No | S/ 18.00 | Primera hora del sábado, noche y cuartos del domingo | [ ] |
| L27 | AUTO | 30/09 23:59 | 01/10 00:10 | No | S/ 10.00 | La versión de tolerancia depende de la entrada | [ ] |
| L28 | MOTO | 12/10 10:00 | 13/10 07:10 | Sí | S/ 46.20 | Orden completo del Art. 12 | [ ] |
| L29 | AUTO | 11/10 23:00 | 12/10 11:00 | No | S/ 40.00 | Confirmado por el evaluador: noche del 11/10 S/ 10 y día del 12/10 S/ 30, sin ajuste de tope | [ ] |
| E01 | AUTO | 12/10 11:00 | 12/10 10:00 | No | Error E01, sin guardar el ticket | Salida anterior a entrada | [ ] |

### Desglose obligatorio de L05

| Línea | Artículo | Monto esperado | Cumple |
| --- | --- | --- | --- |
| Primer diurno del 12/10 | Art. 4 | S/ 90.00 | [ ] |
| Nocturno del 12/10 | Art. 6 | S/ 10.00 | [ ] |
| Segundo diurno del 13/10 | Art. 4, Adenda 1 | S/ 84.00 | [ ] |
| Ajuste del 12/10 | Art. 7 | −S/ 65.00 | [ ] |
| Ajuste del 13/10 | Art. 7 | −S/ 49.00 | [ ] |

En L18 el cálculo debe mostrar S/ 13.50, −S/ 6.75 por moto y −S/ 0.05 de redondeo. En L28, después de los cargos por tramos, deben aparecer el tope, el descuento, el redondeo y el cargo perdido, en ese orden.

## Importación

| ID | Acción | Resultado esperado | Cumple |
| --- | --- | --- | --- |
| I01 | Sube legado_ejemplo.csv antes de las liquidaciones manuales | 4 aceptadas, 4 rechazadas. T-1001 anterior se descarta y no cuenta como rechazo | [ ] |
| I02 | Revisa los importes de aceptadas | T-1001 S/ 21.00, T-1002 S/ 6.70, T-1006 S/ 16.00 y T-1007 S/ 28.00 | [ ] |
| I03 | Revisa las rechazadas | Fila 4 T-1003 E02, fila 5 T-1004 E03, fila 6 T-1005 E01 y fila 10 T-1008 E03 | [ ] |
| I04 | Sube pruebas/validaciones.csv | 6 aceptadas y 7 rechazadas. CSV-DUP se acepta con la fila 13 válida y se rechaza la fila 14 inválida | [ ] |
| I05 | Revisa las seis aceptadas | CSV-TIPO S/ 3.00, CSV-ZONA S/ 6.00, CSV-DESFASE S/ 6.00, CSV-SINZONA S/ 6.00, CSV-SEGUNDOS S/ 6.00 y CSV-DUP S/ 6.00 | [ ] |
| I06 | Revisa errores y normalización | E02 para CAMION y última CSV-DUP, E03 para formato, fecha imposible y salida vacía, E01 para orden y E04 para perdido. CSV-TIPO acepta espacios y minúsculas. CSV-ZONA acepta perdido vacío como NO | [ ] |
| I07 | Vuelve a subir legado_ejemplo.csv | Se actualizan los mismos cuatro tickets. No se duplica la cantidad ni el cobro | [ ] |

Antes de importar, comprueba que el formulario explique la política de última fila válida y advierta que una corrección inválida podría conservar un dato anterior. CSV-DUP se acepta con su última fila válida y su fila inválida posterior se reporta como rechazo. El evaluador admitió esta política si se muestra claramente y se justifica en DECISIONES.md.

## Cierre y correcciones

| ID | Acción | Resultado esperado | Cumple |
| --- | --- | --- | --- |
| C00 | Después de importar solo el CSV oficial, consulta 12/10/2026 | 4 tickets, S/ 71.70. Autos S/ 37.00, motos S/ 34.70 y perdidos S/ 28.00 | [ ] |
| C01 | Sube pruebas/cierre.csv y consulta 10/11/2026 | 4 tickets, S/ 50.00. Autos S/ 19.00, motos S/ 31.00 y perdidos S/ 28.00 | [ ] |
| C02 | Consulta 11/11/2026 antes de subir validaciones.csv | 0 tickets y S/ 0.00. CAJA-UTC sale el 10/11 a las 23:00 Lima aunque su marca UTC diga 11/11 | [ ] |
| C03 | Vuelve a importar pruebas/cierre.csv | El cierre del 10/11 continúa con 4 tickets y S/ 50.00 | [ ] |
| C04 | Sube pruebas/correccion_caja.csv y consulta 10/11/2026 | 3 tickets, S/ 41.00. Autos S/ 10.00, motos S/ 31.00 y perdidos S/ 28.00 | [ ] |
| C05 | Consulta 16/11/2026 | 1 ticket y S/ 10.50 de AUTO. La corrección trasladó CAJA-AUTO a este cierre | [ ] |
| C06 | Consulta 01/01/2025 | 0 tickets y S/ 0.00 | [ ] |
| C07 | Refresca la página y vuelve a consultar los cierres C04–C05 | Se conservan cantidades e importes | [ ] |
| C08 | Reinicia el servidor con la misma DB_PATH y repite C04–C05 | Se conservan cantidades e importes después del reinicio | [ ] |

Los perdidos ya están incluidos en AUTO o MOTO. No sumes los tres subtotales entre sí para compararlos con el total.

## Actualizar por formulario

| ID | Acción | Resultado esperado | Cumple |
| --- | --- | --- | --- |
| D01 | Crea ticket DUP-MANUAL, AUTO, 20/10/2026 10:00–11:20, sin pérdida | S/ 9.00. Cierre del 20/10 con 1 ticket y S/ 9.00 si no agregaste otros para ese día | [ ] |
| D02 | Mismo ticket, cambia salida a 11:40 | S/ 10.50. Cierre sigue con 1 ticket, ahora S/ 10.50 | [ ] |
| D03 | Mismo ticket, intenta salida 09:00 | E01. Cierre conserva 1 ticket y S/ 10.50 | [ ] |

## Contrato HTTP y casos que el formulario restringe

Puedes usar Postman o la consola de PowerShell 7. Las pruebas automatizadas también cubren estas validaciones.

Solicitud base para modificar y repetir:

```powershell
$datos = @{
  ticket = 'API-1'
  tipo = 'AUTO'
  entrada = '2026-10-12T10:00:00-05:00'
  salida = '2026-10-12T11:20:00-05:00'
  ticket_perdido = $false
} | ConvertTo-Json

Invoke-WebRequest -Uri 'http://localhost:3000/api/liquidaciones' -Method Post -ContentType 'application/json' -Body $datos -SkipHttpErrorCheck | Select-Object StatusCode, Content
```

| ID | Acción | Resultado esperado | Cumple |
| --- | --- | --- | --- |
| A01 | Ejecuta la solicitud base | HTTP 200, minutos 80, total_centimos 900, detalle con Art. 4 y monto_centimos 900 | [ ] |
| A02 | Cambia tipo por CAMION | HTTP 422, objeto con codigo E02 y mensaje | [ ] |
| A03 | Usa entrada 2026-02-30T10:00:00-05:00 | HTTP 422, codigo E03 | [ ] |
| A04 | Usa entrada 2026-10-12T10:00:59-05:00 y salida 2026-10-12T10:16:00-05:00 | HTTP 200, minutos 16 y total_centimos 600 | [ ] |
| A05 | Entrada 2026-10-12T10:00:50-05:00, salida 2026-10-12T10:00:01-05:00 | HTTP 422 E01. Se valida el orden real antes de descartar segundos, según DECISIONES.md | [ ] |
| A06 | Consulta GET /api/cierre?fecha=2026-02-30 | HTTP 422 E03 con el mismo formato de error | [ ] |
| A07 | En Postman, POST /api/importaciones, Body → form-data, campo archivo de tipo File | HTTP 200 con aceptadas y rechazadas, montos en céntimos enteros | [ ] |
| A08 | Revisa importes y desglose en las respuestas | Montos enteros, suma de detalle igual a total_centimos. Los descuentos y ajustes son negativos | [ ] |

## Checklist de lo solicitado

| Requisito del enunciado | Cómo comprobarlo | Cumple |
| --- | --- | --- |
| Liquidar y guardar un ticket | L01 y C07–C08 | [ ] |
| Tarifa normal, especial y nocturna | L06–L16 | [ ] |
| Tope diario, descuento, redondeo y cargo perdido | L17–L18 y L22–L28 | [ ] |
| Tolerancias históricas y ambas adendas | L02, L05 y L19–L28 | [ ] |
| Una sola primera hora por permanencia | Desglose L05 y caso L26 | [ ] |
| Tramos y agrupación por fecha Lima | L05, L13–L16, L25 y C02 | [ ] |
| Formulario con total y artículos por línea | L01, L05 y L18 | [ ] |
| Importar multipart archivo con aceptación parcial | I01–I06 y A07 | [ ] |
| Normalizar tipo, perdido, fechas y zonas | I04–I06 | [ ] |
| Aceptar la última válida y reportar las inválidas, descartando válidas sustituidas | I01, I04 e I07 | [ ] |
| Decidir y justificar el caso T-1008 | I03 y DECISIONES.md | [ ] |
| Cierre con cantidad, total y subtotales | C00–C06 | [ ] |
| Persistir tras reiniciar el servidor | C08 usando la misma base | [ ] |
| Contrato JSON y errores 422 uniformes | A01–A08 | [ ] |
| Un solo comando para arrancar | README.md y npm.cmd start con Node compatible | [ ] |
| Documentar cómo correr tests | README.md y npm.cmd test | [ ] |
| Tests de cada artículo | test/tarifa.test.js y npm.cmd test, incluidos los dos ejemplos aclarados por el evaluador | [ ] |
| Historial real de commits | git log --oneline | [ ] |
| DECISIONES.md con supuestos y motivos | Leer las decisiones, especialmente L24–L25 y D01–D03 | [ ] |
| IA.md con declaración de asistencia | Leer IA.md | [ ] |
| Repositorio remoto y enlace para entregar | git remote -v debe mostrar https://github.com/DiegoCA2803/DH-Insight-prueba.git; comprobar además que el último commit esté publicado | [ ] |
| Explicar el código y cambiar una adenda en vivo | Recorrer DEFENSA.md e implementar el ensayo con sus tests | [ ] |

## Cómo reiniciar conservando estas pruebas

Desde la carpeta del proyecto, detén el servidor que usa el puerto 3000 y vuelve a arrancar con la misma base. Si lo está ejecutando Codex, pide «reinicia el servidor para comprobar persistencia» y vuelve a consultar los cierres.

```powershell
$env:DB_PATH = 'data/pruebas-manuales.sqlite'
npm.cmd start
```

Si se inicia sin DB_PATH se utiliza data/tickets.sqlite, que es otra base.

Para reportar resultados, usa los IDs, por ejemplo «L01 cumple, L05 no muestra el ajuste de -S/ 49, C01 cumple». Los resultados siguen DECISIONES.md, que distingue las aclaraciones recibidas de los supuestos aún pendientes.


## Ventanas y gestión desde caja

- [ ] Abre «Consultar artículos». Revisa los doce artículos, las dos adendas y el Anexo A. Cierra con el botón y con Escape.
- [ ] Liquida un ticket y pulsa el artículo en su comprobante. Debe abrir la explicación de ese artículo.
- [ ] Consulta un cierre y comprueba que la lista tenga tantos tickets como indica la cantidad.
- [ ] Pulsa Editar. Cambia una hora o tipo y guarda. Deben recalcularse el cobro y los subtotales.
- [ ] Cambia la fecha de salida. El ticket debe dejar el cierre anterior y aparecer en el nuevo.
- [ ] Intenta una salida anterior a la entrada. Debe aparecer E01 y conservarse el cobro anterior.
- [ ] Pulsa Borrar y después Cancelar. El ticket debe conservarse.
- [ ] Confirma Borrar. Debe desaparecer de la lista y reducirse la cantidad y los importes.
