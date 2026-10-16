// Único lugar del front que habla con la API.
// Vite redirige /api a http://localhost:3000 (ver vite.config.js).

const BASE = '/api';

// Error propio para poder distinguir en las pantallas un 409
// ("alguien te ganó el turno") de una caída de red.
export class ErrorApi extends Error {
  constructor(mensaje, estado) {
    super(mensaje);
    this.name = 'ErrorApi';
    this.estado = estado; // número de status HTTP, o 0 si no hubo respuesta
  }
}

async function pedir(ruta, opciones) {
  let respuesta;
  try {
    respuesta = await fetch(BASE + ruta, opciones);
  } catch {
    // No hubo respuesta: la API está apagada o no hay internet.
    throw new ErrorApi('No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.', 0);
  }

  const cuerpo = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ErrorApi(cuerpo?.error || 'Algo salió mal. Intentá de nuevo.', respuesta.status);
  }
  return cuerpo;
}

export function getDisponibilidad(fecha) {
  return pedir(`/disponibilidad?fecha=${encodeURIComponent(fecha)}`);
}

export function getClub() {
  return pedir('/club');
}

export function crearReserva(datos) {
  return pedir('/reservas', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });
}
