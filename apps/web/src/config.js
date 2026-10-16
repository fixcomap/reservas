// Minutos que dura un turno. La API ya los usa para armar la grilla.
export const DURACION_MIN = 90;

// Misma lista que SERVICIOS_DISPONIBLES en apps/api/src/rutasAdmin.js:
// los checkboxes de Ajustes solo pueden elegir de acá, para no guardar
// texto libre como servicio. Cada uno tiene su ícono en
// componentes/InfoClub.jsx (IconoServicio si en algún momento se
// desincroniza esta lista con esa otra).
export const SERVICIOS_DISPONIBLES = [
  'Wi-Fi',
  'Vestuario',
  'Gimnasio',
  'Estacionamiento',
  'Ayuda médica',
  'Torneos',
  'Cumpleaños',
  'Parrilla',
  'Escuelita',
  'Colegios',
  'Bar / Restaurante',
  'Quincho',
  'Alquiler de paletas',
];
