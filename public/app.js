const porId = (id) => document.getElementById(id);
const moneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
const soles = (centimos) => moneda.format(centimos / 100);

const vistas = [...document.querySelectorAll('.vista')];
const enlaces = [...document.querySelectorAll('nav a')];

function activarVista() {
  const seleccionada = vistas.find((vista) => '#' + vista.id === location.hash) ?? vistas[0];
  for (const vista of vistas) vista.hidden = vista !== seleccionada;
  for (const enlace of enlaces) {
    if (enlace.hash === '#' + seleccionada.id) enlace.setAttribute('aria-current', 'page');
    else enlace.removeAttribute('aria-current');
  }
  document.title = seleccionada.querySelector('h1').textContent + ' | Parqueo Quilla';
}

window.addEventListener('hashchange', activarVista);
activarVista();

const ahora = new Date();
porId('fecha-actual').textContent = new Intl.DateTimeFormat('es-PE', {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Lima',
}).format(ahora);
const partes = Object.fromEntries(new Intl.DateTimeFormat('en', {
  year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Lima',
}).formatToParts(ahora).map(({ type, value }) => [type, value]));
const hoyLima = partes.year + '-' + partes.month + '-' + partes.day;
porId('fecha-actual').dateTime = hoyLima;
document.querySelector('#form-cierre [name="fecha"]').value = hoyLima;

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

function mostrarDesglose(detalle) {
  const cuerpo = porId('detalle-liquidar');
  cuerpo.replaceChildren();
  for (const item of detalle) {
    const fila = cuerpo.insertRow();
    const concepto = fila.insertCell();
    concepto.textContent = item.concepto;
    const articulo = document.createElement('span');
    articulo.className = 'articulo';
    articulo.textContent = item.articulo;
    concepto.append(articulo);
    fila.insertCell().textContent = soles(item.monto_centimos);
  }
  if (!detalle.length) tabla('detalle-liquidar', [], 2, 'Este ticket no tiene cargos.');
}

async function api(ruta, opciones) {
  let respuesta;
  try {
    respuesta = await fetch(ruta, opciones);
  } catch {
    throw new Error('No se pudo conectar. Revisa la conexión y vuelve a intentarlo.');
  }
  const datos = await respuesta.json();
  if (!respuesta.ok) throw new Error(datos.codigo + ' · ' + datos.mensaje);
  return datos;
}

function operar(nombre, ejecutar) {
  const form = porId('form-' + nombre);
  const estado = porId('estado-' + nombre);
  const resultado = porId('resultado-' + nombre);
  const vacio = porId('vacio-' + nombre);
  const boton = form.querySelector('button');
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    const datos = new FormData(form);
    resultado.hidden = true;
    if (vacio) vacio.hidden = false;
    boton.disabled = true;
    form.setAttribute('aria-busy', 'true');
    estado.dataset.tipo = 'proceso';
    estado.textContent = 'Procesando…';
    try {
      estado.textContent = await ejecutar(datos);
      estado.dataset.tipo = 'exito';
      resultado.hidden = false;
      if (vacio) vacio.hidden = true;
    } catch (error) {
      estado.dataset.tipo = 'error';
      estado.textContent = error.message;
    } finally {
      boton.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
}

operar('liquidar', async (datos) => {
  const ticket = Object.fromEntries(datos);
  ticket.ticket_perdido = datos.has('ticket_perdido');
  for (const campo of ['entrada', 'salida']) ticket[campo] += '-05:00';
  const respuesta = await api('/api/liquidaciones', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ticket),
  });
  porId('ticket-liquidar').textContent = 'Ticket ' + respuesta.ticket;
  porId('total-liquidar').textContent = soles(respuesta.total_centimos);
  porId('minutos-liquidar').textContent = respuesta.minutos + ' minutos de permanencia';
  mostrarDesglose(respuesta.detalle);
  return 'Ticket ' + respuesta.ticket + ' calculado y guardado.';
});

operar('importar', async (datos) => {
  const archivo = datos.get('archivo');
  if (archivo.size > 5 * 1024 * 1024) throw new Error('El archivo supera 5 MiB. Selecciona un archivo más pequeño.');
  const { aceptadas, rechazadas } = await api('/api/importaciones', { method: 'POST', body: datos });
  porId('cantidad-aceptadas').textContent = aceptadas.length;
  porId('cantidad-rechazadas').textContent = rechazadas.length;
  tabla('aceptadas', aceptadas.map((fila) => [fila.ticket, soles(fila.total_centimos)]), 2, 'No se aceptaron filas.');
  tabla('rechazadas', rechazadas.map((fila) => [fila.fila, fila.ticket || '—', fila.codigo + ' · ' + fila.motivo]),
    3, 'Todas las filas procesadas son válidas.');
  return 'Importación finalizada. Revisa los resultados debajo.';
});

operar('cierre', async (datos) => {
  const fecha = datos.get('fecha');
  const cierre = await api('/api/cierre?' + new URLSearchParams({ fecha }));
  porId('total-cierre').textContent = soles(cierre.total_centimos);
  porId('cantidad-cierre').textContent = cierre.cantidad;
  const [anio, mes, dia] = fecha.split('-');
  porId('fecha-cierre').textContent = dia + '/' + mes + '/' + anio;
  tabla('detalle-cierre', [
    ['Autos', soles(cierre.por_tipo.AUTO)],
    ['Motos', soles(cierre.por_tipo.MOTO)],
    ['Tickets perdidos', soles(cierre.tickets_perdidos_centimos)],
  ]);
  return cierre.cantidad ? 'Cierre consultado.' : 'No hay tickets registrados para esta fecha.';
});
