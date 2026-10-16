const pool = require('./db');

// Error con status HTTP propio, para poder armar la respuesta correcta
// (400, 404, 409...) desde cualquier punto de una ruta sin repetir el
// try/catch en cada lugar. `detalle` son campos extra que se mezclan en
// el JSON de respuesta (por ejemplo, la lista de conflictos).
class ErrorTurno extends Error {
  constructor(mensaje, status, detalle) {
    super(mensaje);
    this.status = status;
    this.detalle = detalle;
  }
}

// ---------------------------------------------------------------------
// La única definición de "¿este turno fijo ocupa este slot?"
// ---------------------------------------------------------------------
// La arma una vez esta función y la interpolan las tres consultas que
// necesitan saberlo: /disponibilidad (index.js), buscarTurno acá abajo
// (la usan POST /reservas y las rutas de /admin que cargan a mano) y la
// agenda del panel (rutasAdmin.js). Antes esta regla estaba repetida en
// cada lugar; si alguien cambiaba una copia y se olvidaba de las otras,
// la disponibilidad pública y la agenda podían mostrar cosas distintas.
//
// Un turno fijo ocupa el slot generado (cancha "c", instante "s.inicio",
// club "cl") cuando: coincide en cancha + día de la semana + hora,
// está activo, la fecha $1 cae dentro de su vigencia (fecha_desde /
// fecha_hasta), y no tiene una excepción cargada para esa fecha puntual.
//
// Con `liberado: true` se arma la condición INVERSA del último punto
// (SÍ tiene una excepción esa fecha): la usa la agenda para detectar un
// turno "liberado hoy" y poder mostrar la nota y la opción de deshacer.
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

// La grilla de turnos de un día sale de combinar los horarios de
// apertura del club con la duración de cada cancha. Esta consulta busca
// un turno puntual (una cancha, una hora) dentro de esa grilla y dice
// si coincide con un turno fijo vigente (y sin excepción) ese día.
//
// Nota: /disponibilidad arma una grilla parecida pero para todas las
// canchas de un día a la vez, así que tiene su propia consulta en
// index.js. Repetir el generate_series en los dos lugares no es ideal,
// pero juntarlos en una sola consulta genérica los hacía bastante menos
// legibles; queda anotado como para revisar más adelante.
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

// Devuelve { inicio, fin, esFijo, precio, seniaPorcentaje } si ese turno
// existe en la grilla del club, o null si no (cancha de otro club,
// inactiva, fuera de horario, o una hora que no es múltiplo de la
// duración del turno). precio y seniaPorcentaje vienen de la cancha y
// el club en este mismo instante: quien llama los usa para calcular los
// montos de la reserva, siempre del lado del servidor.
//
// `ejecutor` es el pool por defecto, pero las rutas que escriben le
// pasan el `client` de su transacción con lock (ver conLockDeCancha)
// para que esta lectura quede adentro de esa misma transacción.
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

// precio × porcentaje, redondeado a pesos enteros. La única definición
// de cómo se calcula la seña, para no repetir la cuenta en cada lugar
// que arma un monto.
function calcularSenia(precio, seniaPorcentaje) {
  return Math.round((precio * seniaPorcentaje) / 100);
}

// Las reservas 'retenidas' vencen a los 10 minutos si nadie pagó la
// seña. Esto las libera para que dejen de bloquear el turno.
async function liberarVencidas(ejecutor = pool) {
  await ejecutor.query(`
    UPDATE reservas SET estado = 'cancelada'
    WHERE estado = 'retenida' AND vence_en < now()
  `);
}

// Hay una reserva (de un jugador, cargada a mano, o un bloqueo) activa
// que se superpone con ese rango horario en esa cancha. La usa, por
// ejemplo, "deshacer excepción" para no volver a tapar el turno fijo si
// alguien lo reservó mientras estaba liberado.
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

// Reservas activas que chocarían con un turno fijo nuevo (o con un
// cambio de vigencia): misma cancha, mismo día de la semana y hora, en
// cualquier fecha desde fecha_desde en adelante (y hasta fecha_hasta si
// tiene). Solo mira para adelante: una reserva de una fecha que ya pasó
// no es un choque real, nadie se puede cruzar en un turno que ya pasó.
// Se usa para avisarle al dueño antes de crear el fijo, así puede
// cancelarlas o elegir otra fecha de inicio.
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

// Día de la semana (0 = domingo, igual que EXTRACT(DOW) de Postgres) de
// una fecha AAAA-MM-DD, calculado en JS sin pegarle a la base.
function diaSemanaDe(fechaIso) {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

// Toma un lock exclusivo "por cancha" para toda la transacción. Mientras
// una transacción lo tiene, cualquier otra que pida el lock de la MISMA
// cancha se queda esperando hasta que la primera termine (commit o
// rollback) — recién ahí sigue, y para entonces ya ve confirmado
// cualquier INSERT que la primera haya hecho.
//
// Esto es lo que cierra el hueco entre "leer si el turno está libre" y
// "insertarlo": sin el lock, una reserva de un jugador y un turno fijo
// que el dueño está creando al mismo tiempo podrían los dos leer "libre"
// antes de que ninguno insertara nada (no hay ninguna restricción de la
// base que los vincule entre sí, a diferencia de reserva-contra-reserva
// que sí tiene la exclusion constraint). Con el lock, el segundo en
// llegar espera, repite su chequeo ya con el primero confirmado, y lo ve.
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
