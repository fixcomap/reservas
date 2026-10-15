const pool = require('./db');

// La grilla de turnos de un día sale de combinar los horarios de
// apertura del club con la duración de cada cancha. Esta consulta busca
// un turno puntual (una cancha, una hora) dentro de esa grilla y dice
// si coincide con un turno fijo activo. La usan POST /reservas y las
// rutas de /admin que cargan o bloquean turnos a mano.
//
// Nota: /disponibilidad arma una grilla parecida pero para todas las
// canchas de un día a la vez, así que tiene su propia consulta en
// index.js. Repetir el generate_series en los dos lugares no es ideal,
// pero juntarlos en una sola consulta genérica los hacía bastante menos
// legibles; queda anotado como para revisar más adelante.
const SQL_VALIDAR_TURNO = `
  SELECT s.inicio,
         s.inicio + make_interval(mins => c.duracion_min) AS fin,
         EXISTS (
           SELECT 1 FROM turnos_fijos tf
           WHERE tf.cancha_id = c.id AND tf.activo
             AND tf.dia_semana = EXTRACT(DOW FROM $1::date)
             AND tf.hora_inicio = (s.inicio AT TIME ZONE cl.zona_horaria)::time
         ) AS es_fijo
  FROM canchas c
  JOIN clubes cl ON cl.id = c.club_id
  JOIN horarios_apertura h
    ON h.club_id = c.club_id AND h.dia_semana = EXTRACT(DOW FROM $1::date)
  CROSS JOIN LATERAL generate_series(
    ($1::date + h.abre) AT TIME ZONE cl.zona_horaria,
    ($1::date + h.cierra) AT TIME ZONE cl.zona_horaria - make_interval(mins => c.duracion_min),
    make_interval(mins => c.duracion_min)
  ) AS s(inicio)
  WHERE c.id = $2 AND c.club_id = $3 AND c.activa
    AND to_char(s.inicio AT TIME ZONE cl.zona_horaria, 'HH24:MI') = $4;
`;

// Devuelve { inicio, fin, esFijo } si ese turno existe en la grilla del
// club, o null si no (cancha de otro club, inactiva, fuera de horario,
// o una hora que no es múltiplo de la duración del turno).
async function buscarTurno(fecha, canchaId, clubId, hora) {
  const { rows } = await pool.query(SQL_VALIDAR_TURNO, [fecha, canchaId, clubId, hora]);
  if (rows.length === 0) return null;
  return { inicio: rows[0].inicio, fin: rows[0].fin, esFijo: rows[0].es_fijo };
}

// Las reservas 'retenidas' vencen a los 10 minutos si nadie pagó la
// seña. Esto las libera para que dejen de bloquear el turno.
async function liberarVencidas() {
  await pool.query(`
    UPDATE reservas SET estado = 'cancelada'
    WHERE estado = 'retenida' AND vence_en < now()
  `);
}

module.exports = { buscarTurno, liberarVencidas };
