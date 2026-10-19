const pool = require('./db');

// Error con status HTTP. `detalle` se suma al JSON de respuesta.
class ErrorTurno extends Error {
  constructor(mensaje, status, detalle) {
    super(mensaje);
    this.status = status;
    this.detalle = detalle;
  }
}

// Condición SQL "este turno fijo ocupa el slot" (fecha en $1).
// Con liberado: true, el fijo que tiene una excepción esa fecha.
function condicionTurnoFijo({ tf = 'tf', c = 'c', s = 's', cl = 'cl', liberado = false } = {}) {
  const tieneExcepcion = `EXISTS (
    SELECT 1 FROM turnos_fijos_excepciones tfe
    WHERE tfe.turno_fijo_id = ${tf}.id AND tfe.fecha = $1::date
  )`;
  return `
    ${tf}.cancha_id = ${c}.id
    AND ${tf}.activo
    AND ${tf}.dia_semana = EXTRACT(DOW FROM $1::date)
    AND ${tf}.hora_inicio = (${s}.inicio AT TIME ZONE ${cl}.zona_horaria)::time
    AND $1::date >= ${tf}.fecha_desde
    AND ($1::date <= ${tf}.fecha_hasta OR ${tf}.fecha_hasta IS NULL)
    AND ${liberado ? '' : 'NOT '}${tieneExcepcion}
  `;
}

// Busca un turno puntual (cancha + hora) en la grilla del día
const SQL_VALIDAR_TURNO = `
  SELECT s.inicio,
         s.inicio + make_interval(mins => c.duracion_min) AS fin,
         c.precio,
         cl.senia_porcentaje,
         EXISTS (
           SELECT 1 FROM turnos_fijos tf
           WHERE ${condicionTurnoFijo()}
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

// { inicio, fin, esFijo, precio, seniaPorcentaje } o null si el turno no existe
async function buscarTurno(fecha, canchaId, clubId, hora, ejecutor = pool) {
  const { rows } = await ejecutor.query(SQL_VALIDAR_TURNO, [fecha, canchaId, clubId, hora]);
  if (rows.length === 0) return null;
  return {
    inicio: rows[0].inicio,
    fin: rows[0].fin,
    esFijo: rows[0].es_fijo,
    precio: rows[0].precio,
    seniaPorcentaje: rows[0].senia_porcentaje,
  };
}

// precio × porcentaje, redondeado a pesos enteros
function calcularSenia(precio, seniaPorcentaje) {
  return Math.round((precio * seniaPorcentaje) / 100);
}

// Cancela las reservas retenidas que ya vencieron
async function liberarVencidas(ejecutor = pool) {
  await ejecutor.query(`
    UPDATE reservas SET estado = 'cancelada'
    WHERE estado = 'retenida' AND vence_en < now()
  `);
}

// ¿Hay una reserva activa en ese rango y cancha?
async function hayReservaActiva(canchaId, inicio, fin, ejecutor = pool) {
  const { rows } = await ejecutor.query(
    `SELECT 1 FROM reservas
     WHERE cancha_id = $1
       AND horario && tstzrange($2, $3)
       AND (estado = 'confirmada' OR (estado = 'retenida' AND vence_en > now()))
     LIMIT 1`,
    [canchaId, inicio, fin]
  );
  return rows.length > 0;
}

// Reservas futuras que chocarían con un turno fijo nuevo
async function buscarConflictosFijo({ canchaId, diaSemana, horaInicio, fechaDesde, fechaHasta }, ejecutor = pool) {
  const { rows } = await ejecutor.query(
    `SELECT r.id AS reserva_id, r.cliente_nombre, r.cliente_tel, r.origen, r.estado,
            to_char(lower(r.horario) AT TIME ZONE cl.zona_horaria, 'YYYY-MM-DD') AS fecha,
            to_char(lower(r.horario) AT TIME ZONE cl.zona_horaria, 'HH24:MI') AS hora
     FROM reservas r
     JOIN canchas c ON c.id = r.cancha_id
     JOIN clubes cl ON cl.id = c.club_id
     WHERE r.cancha_id = $1
       AND (r.estado = 'confirmada' OR (r.estado = 'retenida' AND r.vence_en > now()))
       AND lower(r.horario) > now()
       AND EXTRACT(DOW FROM (lower(r.horario) AT TIME ZONE cl.zona_horaria)) = $2
       AND (lower(r.horario) AT TIME ZONE cl.zona_horaria)::time = $3::time
       AND (lower(r.horario) AT TIME ZONE cl.zona_horaria)::date >= $4::date
       AND ($5::date IS NULL OR (lower(r.horario) AT TIME ZONE cl.zona_horaria)::date <= $5::date)
     ORDER BY lower(r.horario)
     LIMIT 20`,
    [canchaId, diaSemana, horaInicio, fechaDesde, fechaHasta || null]
  );
  return rows;
}

// Día de la semana de una fecha AAAA-MM-DD (0 = domingo)
function diaSemanaDe(fechaIso) {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

// Corre fn(client) en una transacción con un lock por cancha, para que
// dos operaciones sobre la misma cancha no se pisen.
async function conLockDeCancha(canchaId, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [canchaId]);
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  ErrorTurno,
  condicionTurnoFijo,
  buscarTurno,
  calcularSenia,
  liberarVencidas,
  hayReservaActiva,
  buscarConflictosFijo,
  diaSemanaDe,
  conLockDeCancha,
};
