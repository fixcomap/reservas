// Todo lo que tenga que ver con días y horas pasa por acá.
// La regla: el usuario siempre ve la hora de Argentina, sin importar
// dónde esté configurada su computadora.

export const ZONA = 'America/Argentina/Buenos_Aires';

const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// "Hoy" en Argentina como AAAA-MM-DD. El locale en-CA justamente
// formatea las fechas en ese orden, así que sale listo para la API.
export function hoyEnArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// Partimos el texto a mano y hacemos la cuenta en UTC para que no se
// corra un día por el horario de verano ni por la zona del navegador.
function partes(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

// Suma (o resta, con cantidad negativa) días a una fecha AAAA-MM-DD.
// La usa proximosSieteDias acá abajo, y también la agenda del panel
// para las flechas de "día anterior / día siguiente".
export function sumarDias(iso, cantidad) {
  const fecha = partes(iso);
  fecha.setUTCDate(fecha.getUTCDate() + cantidad);
  return fecha.toISOString().slice(0, 10);
}

// Los 7 días que se pueden reservar, empezando por hoy.
export function proximosSieteDias() {
  const hoy = hoyEnArgentina();
  return Array.from({ length: 7 }, (_, i) => {
    const iso = sumarDias(hoy, i);
    const fecha = partes(iso);
    return {
      iso,
      esHoy: i === 0,
      etiqueta: i === 0 ? 'HOY' : DIAS_CORTOS[fecha.getUTCDay()],
      numero: String(fecha.getUTCDate()),
      mes: MESES_CORTOS[fecha.getUTCMonth()],
      // Las tres líneas del chip juntas se leen "HOY15OCT" en un lector
      // de pantalla, así que le damos un nombre en castellano normal.
      nombreAccesible: i === 0 ? `Hoy, ${tituloLargo(iso)}` : tituloLargo(iso),
    };
  });
}

// "Jueves 15 de octubre"
export function tituloLargo(iso) {
  const fecha = partes(iso);
  return `${DIAS_LARGOS[fecha.getUTCDay()]} ${fecha.getUTCDate()} de ${MESES_LARGOS[fecha.getUTCMonth()]}`;
}

// "Jueves 15 oct", o "Hoy 15 oct" si es el día de hoy.
export function tituloCorto(iso) {
  const fecha = partes(iso);
  const dia = iso === hoyEnArgentina() ? 'Hoy' : DIAS_LARGOS[fecha.getUTCDay()];
  return `${dia} ${fecha.getUTCDate()} ${MESES_CORTOS[fecha.getUTCMonth()].toLowerCase()}`;
}

// "21:00" + 90 -> "22:30"
export function sumarMinutos(hora, minutos) {
  const [h, m] = hora.split(':').map(Number);
  const total = (h * 60 + m + minutos) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Día de la semana (0 = domingo, igual que EXTRACT(DOW) de Postgres)
// de una fecha AAAA-MM-DD. La usa la agenda del panel para armar el
// "todos los jue" de los turnos fijos.
export function diaDeLaSemana(iso) {
  return partes(iso).getUTCDay();
}

// "Hoy · jueves 15 oct" (o sin el "Hoy · " si no es hoy). Formato del
// encabezado de la agenda del panel.
export function tituloAgenda(iso) {
  const fecha = partes(iso);
  const dia = `${DIAS_LARGOS[fecha.getUTCDay()].toLowerCase()} ${fecha.getUTCDate()} ${MESES_CORTOS[fecha.getUTCMonth()].toLowerCase()}`;
  return iso === hoyEnArgentina() ? `Hoy · ${dia}` : dia;
}

// "jue" a partir de un dia_semana de Postgres (0 = domingo). La usa el
// panel para mostrar "Fijo · todos los jue" en los turnos fijos.
export function nombreDiaCorto(diaSemana) {
  return DIAS_CORTOS[diaSemana].toLowerCase();
}

// La API devuelve vence_en en UTC ("2026-10-15T21:59:43.177Z").
// Acá lo pasamos a la hora que ve el jugador en Argentina.
export function horaArgentina(fechaUtc) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(fechaUtc));
}
