const porId = (id) => document.getElementById(id);
const moneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const soles = (centimos) => moneda.format(centimos / 100);

function tabla(id, valores, columnas, vacio) {
  const cuerpo = porId(id);
  cuerpo.replaceChildren();
  for (const celdas of valores) {
    const fila = cuerpo.insertRow();
    for (const valor of celdas) fila.insertCell().textContent = valor;
  }
  if (!valores.length) {
    const celda = cuerpo.insertRow().insertCell();
    celda.colSpan = columnas;
    celda.textContent = vacio;
  }
}

async function api(ruta, opciones) {
  const respuesta = await fetch(ruta, opciones);
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.codigo + ' · ' + datos.mensaje);
  return datos;
}

function operar(nombre, ejecutar) {
  const form = porId('form-' + nombre);
  const estado = porId('estado-' + nombre);
  const resultado = porId('resultado-' + nombre);
  const boton = form.querySelector('button');
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const datos = new FormData(form);
    resultado.hidden = true;
    boton.disabled = true;
    estado.textContent = 'Procesando…';
    try {
      estado.textContent = await ejecutar(datos);
      resultado.hidden = false;
    } catch (error) {
      estado.textContent = error.message;
    } finally {
      boton.disabled = false;
    }
  });
}

operar('liquidar', async (datos) => {
  const ticket = Object.fromEntries(datos);
  ticket.ticket_perdido = datos.has('ticket_perdido');
  for (const campo of ['entrada', 'salida']) {
    ticket[campo] += '-05:00';
  }
  const respuesta = await api('/api/liquidaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticket),
  });
  porId('total-liquidar').textContent = soles(respuesta.total_centimos);
  porId('minutos-liquidar').textContent = '· ' + respuesta.minutos + ' min';
  tabla('detalle-liquidar', respuesta.detalle.map((item) =>
    [item.concepto, item.articulo, soles(item.monto_centimos)]), 3, 'Sin cargos');
  return 'Ticket ' + respuesta.ticket + ' guardado.';
});

operar('importar', async (datos) => {
  const { aceptadas, rechazadas } = await api('/api/importaciones', { method: 'POST', body: datos });
  tabla('aceptadas', aceptadas.map((fila) => [fila.ticket, soles(fila.total_centimos)]), 2, 'Sin filas aceptadas');
  tabla('rechazadas', rechazadas.map((fila) => [fila.fila, fila.ticket || '—', fila.codigo + ' · ' + fila.motivo]),
    3, 'Sin filas rechazadas');
  return aceptadas.length + ' aceptadas · ' + rechazadas.length + ' rechazadas';
});

operar('cierre', async (datos) => {
  const fecha = datos.get('fecha');
  const cierre = await api('/api/cierre?' + new URLSearchParams({ fecha }));
  tabla('detalle-cierre', [
    ['Cantidad de tickets', cierre.cantidad],
    ['Total cobrado', soles(cierre.total_centimos)],
    ['Autos', soles(cierre.por_tipo.AUTO)],
    ['Motos', soles(cierre.por_tipo.MOTO)],
    ['Tickets perdidos', soles(cierre.tickets_perdidos_centimos)],
  ]);
  return 'Cierre del ' + fecha;
});
