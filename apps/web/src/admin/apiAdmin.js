// Llamadas a /api/admin/*
import { ErrorApi, URL_API } from '../api.js';

const BASE = `${URL_API}/admin`;

// Avisa a AdminApp cuando un pedido vuelve con 401
let alPerderSesion = null;
export function escucharPerdidaDeSesion(fn) {
  alPerderSesion = fn;
}

async function pedir(ruta, opciones) {
  let respuesta;
  try {
    respuesta = await fetch(BASE + ruta, {
      // Manda la cookie de sesión aunque la API esté en otro subdominio
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      ...opciones,
    });
  } catch {
    throw new ErrorApi('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.', 0);
  }

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    if (respuesta.status === 401 && alPerderSesion) alPerderSesion();
    const error = new ErrorApi(cuerpo?.error || 'Algo salió mal. Intentá de nuevo.', respuesta.status);
    // Datos extra del error (por ejemplo, la lista de conflictos)
    error.detalle = cuerpo;
    throw error;
  }
  return cuerpo;
}

export function login(email, password) {
  return pedir('/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export function logout() {
  return pedir('/logout', { method: 'POST' });
}

export function getYo() {
  return pedir('/yo');
}

export function getCanchas() {
  return pedir('/canchas');
}

export function getAgenda(fecha) {
  return pedir(`/agenda?fecha=${encodeURIComponent(fecha)}`);
}

export function crearReservaManual(datos) {
  return pedir('/reservas', { method: 'POST', body: JSON.stringify(datos) });
}

export function crearBloqueo(datos) {
  return pedir('/bloqueos', { method: 'POST', body: JSON.stringify(datos) });
}

export function cancelarReserva(id) {
  return pedir(`/reservas/${id}/cancelar`, { method: 'POST' });
}

export function getTurnosFijos() {
  return pedir('/turnos-fijos');
}

export function crearTurnoFijo(datos) {
  return pedir('/turnos-fijos', { method: 'POST', body: JSON.stringify(datos) });
}

export function desactivarTurnoFijo(id) {
  return pedir(`/turnos-fijos/${id}/desactivar`, { method: 'POST' });
}

export function crearExcepcion(turnoFijoId, datos) {
  return pedir(`/turnos-fijos/${turnoFijoId}/excepciones`, { method: 'POST', body: JSON.stringify(datos) });
}

export function deshacerExcepcion(turnoFijoId, fecha) {
  return pedir(`/turnos-fijos/${turnoFijoId}/excepciones/${fecha}/deshacer`, { method: 'POST' });
}

export function getAjustes() {
  return pedir('/ajustes');
}

export function guardarPrecios(precios) {
  return pedir('/ajustes/precios', { method: 'PUT', body: JSON.stringify(precios) });
}

export function guardarSenia(senia_porcentaje) {
  return pedir('/ajustes/senia', { method: 'PUT', body: JSON.stringify({ senia_porcentaje }) });
}

export function getClubInfo() {
  return pedir('/club-info');
}

export function guardarClubInfo(datos) {
  return pedir('/club-info', { method: 'PUT', body: JSON.stringify(datos) });
}

export function reintentarReembolso(reservaId) {
  return pedir(`/reservas/${reservaId}/reintentar-reembolso`, { method: 'POST' });
}
