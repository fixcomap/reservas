// Único lugar del panel que habla con /admin/*. Mismo patrón que
// src/api.js (el de la app del jugador): un ErrorApi con el status HTTP
// para poder distinguir, por ejemplo, un 401 de una caída de red.
import { ErrorApi } from '../api.js';

const BASE = '/api/admin';

// Cuando cualquier pedido vuelve con 401, la sesión ya no sirve (se
// venció, o nunca hubo login). En vez de que cada pantalla se fije en
// el status a mano, avisamos acá una sola vez y AdminApp decide volver
// al login.
let alPerderSesion = null;
export function escucharPerdidaDeSesion(fn) {
  alPerderSesion = fn;
}

async function pedir(ruta, opciones) {
  let respuesta;
  try {
    respuesta = await fetch(BASE + ruta, {
      headers: { 'Content-Type': 'application/json' },
      ...opciones,
    });
  } catch {
    throw new ErrorApi('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.', 0);
  }

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    if (respuesta.status === 401 && alPerderSesion) alPerderSesion();
    throw new ErrorApi(cuerpo?.error || 'Algo salió mal. Intentá de nuevo.', respuesta.status);
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
