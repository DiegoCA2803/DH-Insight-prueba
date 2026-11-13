# Preparación para la defensa

Las consultas siguen pendientes de respuesta. Durante la defensa se explican como interpretaciones propias documentadas en DECISIONES.md.

## Preguntas para enviar antes del día 3

Estas preguntas piden aclaraciones sobre casos en los que dos lecturas producen cobros o registros distintos. La última columna recoge la interpretación aplicada mientras llega una respuesta.

| Pregunta para el evaluador | De dónde sale y por qué importa | Implementación actual |
| --- | --- | --- |
| Un AUTO entra el 12/10 a las 03:00 y sale a las 11:00. ¿Los S/ 10 nocturnos se imputan al 11/10, cuando comenzó la franja, o al 12/10, cuando empezó el tramo del ticket? | Arts. 3 y 7. Con la fecha del tramo se cobran S/ 35 por el tope. Con la fecha de la franja serían S/ 40. | [`tramos()`](src/tarifa.js) usa la fecha de las 03:00. |
| Si se liquida o importa un ticket que ya existe en la base, ¿se actualiza o se rechaza? | La regla de duplicados solo describe repeticiones dentro de un archivo. Cambiar una salida puede trasladar el ticket a otro cierre. | [`guardar()`](src/tickets.js) actualiza el registro existente mediante su clave única. Las operaciones rechazadas no lo modifican. |
| Si la entrada es 10:00:50 y la salida 10:00:01, ¿corresponde E01 aunque ambas marcas se reduzcan a 10:00? | Art. 2 y contrato E01. Validar después del truncamiento podría aceptar una salida anterior y guardarla en caja. | [`calcularLiquidacion()`](src/tarifa.js) compara primero los instantes. |
| Si la última fila de un ticket repetido es inválida, ¿qué se hace? | El enunciado habla de la última fila y el candidato pidió aceptar la última válida. Hay que explicar esa diferencia durante la defensa. | procesarCsv valida todas las filas, conserva la última válida en un Map por ticket y reporta las inválidas. Si todas fallan, la base mantiene el registro anterior. |
| Para un ticket perdido desde el 01/10, si las marcas quedan en el mismo minuto después de descartar segundos, ¿se cobra solo S/ 25 o también una primera hora o tarifa nocturna? | Arts. 2–6, Art. 10 y Adenda 2. La adenda elimina la tolerancia para perdidos y deja abierto cómo tratar un tramo de duración cero. | [`tramos()`](src/tarifa.js) genera tramos de duración positiva. El resultado es S/ 25. |
| ¿El subtotal de tickets perdidos en el cierre incluye el cobro completo de cada uno o únicamente el cargo fijo de S/ 25? | Contrato de cierre y Art. 10. Para una moto perdida cobrada a S/ 31, el subtotal cambia entre S/ 31 y S/ 25. | [Consulta de cierre](src/tickets.js) suma el cobro completo y documenta el solapamiento con el subtotal de vehículo. |

## Preguntas que podrían hacerte en la defensa

| Pregunta | Por qué podrían hacerla | Dónde mostrarlo y cómo responder |
| --- | --- | --- |
| ¿Por qué el caso de 80 minutos da S/ 9.00? | Comprueba la primera hora y el cobro por fracciones. | [`cobrarTramos()`](src/tarifa.js). S/ 6 por los primeros 60 minutos y dos cuartos de S/ 1.50 para los 20 restantes. |
| ¿Cómo funciona la primera hora si el ticket cruza varios días? | Evalúa la Adenda 1 y la separación de tramos. | [`primeraHoraPendiente`](src/tarifa.js). Solo el primer tramo diurno activa la tarifa base. En el E5, el segundo diurno dura 840 min y son 56 cuartos a S/ 1.50, es decir S/ 84 antes del tope. |
| ¿Cómo obtienes S/ 70 en E5? | Evalúa el desglose exacto y la agrupación del Art. 7. | [Prueba E5](test/tarifa.test.js). El 12/10 suma 90 + 10 = 100 y se ajusta en −65. El 13/10 suma 84 y se ajusta en −49. Quedan dos subtotales de S/ 35. |
| ¿Por qué la moto T-1002 paga S/ 6.70? | Comprueba que entiendes el sentido del redondeo. | [`calcularLiquidacion()`](src/tarifa.js). El tramo cuesta 1350 céntimos. El descuento deja 675 y el resto al dividir entre 10 es 5. Se restan esos 5 céntimos. |
| ¿Por qué T-1007 paga S/ 28 con solo 14 minutos? | La Adenda 2 cambia el resultado de un ticket perdido corto. | [Bloque de tolerancia](src/tarifa.js). La entrada es posterior al cambio y el ticket es perdido. Su tramo cuesta S/ 6, con moto queda S/ 3 y se agregan S/ 25. |
| ¿Cómo sabes que API e importador cobran igual? | Evalúa si duplicaste las reglas y si puedes cambiar ambas entradas desde un punto. | [Operaciones](src/operaciones.js) e [importador](src/importacion.js). Ambos llaman a `calcularLiquidacion()`. El importador convierte `moto ` y `si` a los valores que espera el motor. |
| ¿En qué cierre entra una salida a las 04:10 UTC del 13/10? | Verifica que la fecha de caja se calcula en Lima y que es independiente de la fecha del tope. | [`guardar()`](src/tickets.js). Es el 12/10 a las 23:10 en Lima. Se guarda `fecha_salida` como 12/10 y el cierre filtra por esa columna. |

## Ensayo de cambio en vivo

Si la nueva adenda dijera «desde el 01/11/2026, la tolerancia para tickets con comprobante pasa a 20 minutos», empieza en [`calcularLiquidacion()`](src/tarifa.js). Compara la entrada con el nuevo corte de Lima. Conserva las dos reglas históricas para entradas anteriores y la excepción de ticket perdido. Agrega pruebas en [`tarifa.test.js`](test/tarifa.test.js) para 20 y 21 minutos, un ingreso anterior al corte y un ticket perdido de 20 minutos. Ejecuta `npm test` y muestra el cambio de resultado en el formulario.
