// Fechas y horas, siempre en hora de Argentina.

export const ZONA = 'America/Argentina/Buenos_Aires';

const DIAS_CORTOS = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
const DIAS_LARGOS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES_CORTOS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const MESES_LARGOS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// "Hoy" en Argentina como AAAA-MM-DD
export function hoyEnArgentina() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

// AAAA-MM-DD -> Date en UTC (evita corrimientos por zona horaria)
function partes(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia));
}

// Suma (o resta) días a una fecha AAAA-MM-DD
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
      // Nombre para lectores de pantalla
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

// Día de la semana de una fecha AAAA-MM-DD (0 = domingo)
export function diaDeLaSemana(iso) {
  return partes(iso).getUTCDay();
}

// "Hoy · jueves 15 oct" (encabezado de la agenda)
export function tituloAgenda(iso) {
  const fecha = partes(iso);
  const dia = `${DIAS_LARGOS[fecha.getUTCDay()].toLowerCase()} ${fecha.getUTCDate()} ${MESES_CORTOS[fecha.getUTCMonth()].toLowerCase()}`;
  return iso === hoyEnArgentina() ? `Hoy · ${dia}` : dia;
}

// Próxima fecha que cae en ese día de la semana (hoy incluido)
export function proximaFecha(diaSemana) {
  const hoy = hoyEnArgentina();
  const delta = (diaSemana - diaDeLaSemana(hoy) + 7) % 7;
  return sumarDias(hoy, delta);
}

// "19/10"
export function fechaCorta(iso) {
  const [, mes, dia] = iso.split('-');
  return `${dia}/${mes}`;
}

// 4 -> "jue"
export function nombreDiaCorto(diaSemana) {
  return DIAS_CORTOS[diaSemana].toLowerCase();
}

// "09:00" -> "9:00"
function sinCeroInicial(hora) {
  return hora.replace(/^0/, '');
}

// Agrupa días seguidos con el mismo horario: "Lunes a viernes 9:00 a 24:00"
export function agruparHorarios(horarios) {
  const orden = [1, 2, 3, 4, 5, 6, 0];
  const porDia = new Map(horarios.map((h) => [h.dia_semana, h]));

  const grupos = [];
  let actual = null;
  for (const dia of orden) {
    const h = porDia.get(dia);
    if (!h) {
      actual = null;
      continue;
    }
    if (actual && actual.abre === h.abre && actual.cierra === h.cierra) {
      actual.dias.push(dia);
    } else {
      actual = { abre: h.abre, cierra: h.cierra, dias: [dia] };
      grupos.push(actual);
    }
  }

  return grupos.map((g) => {
    const primero = DIAS_LARGOS[g.dias[0]];
    const ultimo = DIAS_LARGOS[g.dias[g.dias.length - 1]];
    const etiquetaDias =
      g.dias.length === 1
        ? primero
        : g.dias.length === 2
          ? `${primero} y ${ultimo}`
          : `${primero} a ${ultimo}`;
    return { texto: `${etiquetaDias} ${sinCeroInicial(g.abre)} a ${sinCeroInicial(g.cierra)}` };
  });
}

// Fecha UTC -> "HH:MM" en Argentina
export function horaArgentina(fechaUtc) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(fechaUtc));
}
