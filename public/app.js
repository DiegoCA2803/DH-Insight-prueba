/** Obtiene un elemento de las vistas por su identificador. */
const porId = (id) => document.getElementById(id);
const moneda = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' });
/** Convierte los céntimos enteros de la API a soles solo para su presentación. */
const soles = (centimos) => moneda.format(centimos / 100);
let fechaConsultada;

/** Abre el diccionario y enfoca el artículo citado en el comprobante. */
function abrirArticulos(referencia = '') {
  const ventana = porId('dialogo-articulos');
  ventana.showModal();
  const numero = /Art\. (\d+)/.exec(referencia);
  const destino = numero ? porId('articulo-' + numero[1]) : porId('articulo-1');
  ventana.scrollTop = destino.offsetTop - ventana.querySelector('header').offsetHeight - 20;
  destino.focus({ preventScroll: true });
}

porId('ver-articulos').addEventListener('click', () => abrirArticulos());
for (const boton of document.querySelectorAll('[data-cerrar]')) {
  boton.addEventListener('click', () => porId(boton.dataset.cerrar).close());
}

const vistas = [...document.querySelectorAll('.vista')];
const enlaces = [...document.querySelectorAll('nav a')];

/** Sincroniza la vista visible, la navegación accesible y el título con el fragmento de la URL. */
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

// La fecha inicial del cierre usa Lima, independientemente de la zona del navegador.
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

/** Dibuja una tabla o su estado vacío usando texto, sin interpretar los datos como HTML. */
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

/** Muestra cargos y ajustes, con botones que enlazan cada línea con su artículo. */
function mostrarDesglose(detalle) {
  const cuerpo = porId('detalle-liquidar');
  cuerpo.replaceChildren();
  for (const item of detalle) {
    const fila = cuerpo.insertRow();
    const concepto = fila.insertCell();
    concepto.textContent = item.concepto;
    const articulo = document.createElement('button');
    articulo.type = 'button';
    articulo.className = 'articulo';
    articulo.textContent = item.articulo;
    articulo.addEventListener('click', () => abrirArticulos(item.articulo));
    concepto.append(articulo);
    fila.insertCell().textContent = soles(item.monto_centimos);
  }
  if (!detalle.length) tabla('detalle-liquidar', [], 2, 'Este ticket no tiene cargos.');
}

/** Ejecuta una solicitud y convierte errores HTTP o de conexión en mensajes para el operador. */
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

/** Comparte el ciclo de envío de los formularios: espera, resultado, error y desbloqueo. */
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

// Formulario de liquidación: las horas ingresadas son de Lima; el backend calcula el cobro.
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

// Importación: conserva el multipart y muestra aceptadas y rechazadas en tablas separadas.
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

/** Interpreta una marca con zona o asume Lima si proviene del CSV sin zona explícita. */
function instante(valor) {
  const iso = valor.replace(' ', 'T');
  return new Date(/(Z|[+-]\d{2}:\d{2})$/.test(iso) ? iso : iso + '-05:00');
}

/** Convierte la marca a hora de pared de Lima para editarla en un campo datetime-local. */
function fechaFormulario(valor) {
  return new Date(instante(valor).getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, -1);
}

const formatoFecha = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima',
});

/** Carga los datos guardados en el editor, conservando segundos y el identificador original. */
function abrirEditor(ticket) {
  const form = porId('form-editar');
  form.elements.ticket.value = ticket.ticket;
  form.elements.tipo.value = ticket.tipo;
  form.elements.entrada.value = fechaFormulario(ticket.entrada);
  form.elements.salida.value = fechaFormulario(ticket.salida);
  form.elements.ticket_perdido.checked = ticket.ticket_perdido;
  porId('estado-editar').textContent = '';
  porId('dialogo-editar').showModal();
}

let ticketPorBorrar;
/** Prepara la confirmación; abrir o cancelar la ventana no modifica la base de datos. */
function confirmarBorrado(ticket) {
  ticketPorBorrar = ticket.ticket;
  porId('confirmacion-borrar').textContent = '¿Borrar el ticket ' + ticket.ticket + ' por ' + soles(ticket.total_centimos) + '?';
  porId('estado-borrar').textContent = '';
  porId('dialogo-borrar').showModal();
}

/** Construye la lista del cierre con acciones de edición y borrado para cada ticket. */
function mostrarTickets(tickets) {
  const cuerpo = porId('tickets-cierre');
  cuerpo.replaceChildren();
  for (const ticket of tickets) {
    const fila = cuerpo.insertRow();
    for (const valor of [ticket.ticket, ticket.tipo, formatoFecha.format(instante(ticket.entrada)),
      formatoFecha.format(instante(ticket.salida)), ticket.ticket_perdido ? 'Sí' : 'No', soles(ticket.total_centimos)]) {
      fila.insertCell().textContent = valor;
    }
    const acciones = fila.insertCell();
    acciones.className = 'acciones-ticket';
    const editar = document.createElement('button');
    editar.type = 'button';
    editar.className = 'boton secundario pequeno';
    editar.textContent = 'Editar';
    editar.setAttribute('aria-label', 'Editar ticket ' + ticket.ticket);
    editar.addEventListener('click', () => abrirEditor(ticket));
    const borrar = document.createElement('button');
    borrar.type = 'button';
    borrar.className = 'boton borrar pequeno';
    borrar.textContent = 'Borrar';
    borrar.setAttribute('aria-label', 'Borrar ticket ' + ticket.ticket);
    borrar.addEventListener('click', () => confirmarBorrado(ticket));
    acciones.append(editar, borrar);
  }
  if (!tickets.length) tabla('tickets-cierre', [], 7, 'No hay tickets para esta fecha.');
}

/** Consulta el resumen y la lista de la misma fecha y actualiza la pantalla cuando ambos llegan. */
async function cargarCierre(fecha) {
  const consulta = '?' + new URLSearchParams({ fecha });
  const [cierre, listado] = await Promise.all([api('/api/cierre' + consulta), api('/api/tickets' + consulta)]);
  porId('total-cierre').textContent = soles(cierre.total_centimos);
  porId('cantidad-cierre').textContent = cierre.cantidad;
  const [anio, mes, dia] = fecha.split('-');
  porId('fecha-cierre').textContent = dia + '/' + mes + '/' + anio;
  tabla('detalle-cierre', [
    ['Autos', soles(cierre.por_tipo.AUTO)],
    ['Motos', soles(cierre.por_tipo.MOTO)],
    ['Tickets perdidos', soles(cierre.tickets_perdidos_centimos)],
  ]);
  mostrarTickets(listado.tickets);
  fechaConsultada = fecha;
  return cierre.cantidad ? 'Cierre consultado.' : 'No hay tickets registrados para esta fecha.';
}

operar('cierre', (datos) => cargarCierre(datos.get('fecha')));

/** Recarga los totales después de una modificación y avisa si la consulta posterior falla. */
async function refrescarCierre(mensaje) {
  const estado = porId('estado-cierre');
  try {
    await cargarCierre(fechaConsultada);
    estado.dataset.tipo = 'exito';
    estado.textContent = mensaje;
  } catch (error) {
    porId('resultado-cierre').hidden = true;
    estado.dataset.tipo = 'error';
    estado.textContent = mensaje + ' Vuelve a consultar el cierre. ' + error.message;
  }
}

/** Oculta un comprobante que quedó desactualizado al editar o borrar ese ticket desde caja. */
function limpiarComprobante(ticket) {
  if (porId('ticket-liquidar').textContent !== 'Ticket ' + ticket) return;
  porId('resultado-liquidar').hidden = true;
  porId('vacio-liquidar').hidden = false;
  porId('estado-liquidar').textContent = 'El ticket ' + ticket + ' se modificó desde el cierre de caja.';
}

// Guardar recalcula en el servidor antes de actualizar caja; un rechazo deja abierta la edición.
porId('form-editar').addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const form = evento.currentTarget;
  const boton = form.querySelector('button');
  const estado = porId('estado-editar');
  const datos = Object.fromEntries(new FormData(form));
  datos.ticket_perdido = form.elements.ticket_perdido.checked;
  datos.entrada += '-05:00';
  datos.salida += '-05:00';
  boton.disabled = true;
  estado.textContent = 'Guardando…';
  try {
    await api('/api/tickets/' + encodeURIComponent(datos.ticket), {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
    });
    porId('dialogo-editar').close();
    limpiarComprobante(datos.ticket);
    await refrescarCierre('Ticket ' + datos.ticket + ' actualizado y recalculado.');
  } catch (error) {
    estado.dataset.tipo = 'error';
    estado.textContent = error.message;
  } finally {
    boton.disabled = false;
  }
});

// Solo la confirmación envía DELETE; se bloquea el botón mientras la solicitud está pendiente.
porId('confirmar-borrar').addEventListener('click', async (evento) => {
  const boton = evento.currentTarget;
  const estado = porId('estado-borrar');
  const ticket = ticketPorBorrar;
  boton.disabled = true;
  estado.textContent = 'Borrando…';
  try {
    await api('/api/tickets/' + encodeURIComponent(ticket), { method: 'DELETE' });
    porId('dialogo-borrar').close();
    limpiarComprobante(ticket);
    await refrescarCierre('Ticket ' + ticket + ' borrado.');
  } catch (error) {
    estado.dataset.tipo = 'error';
    estado.textContent = error.message;
  } finally {
    boton.disabled = false;
  }
});
