const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const { buscarTurno, liberarVencidas } = require('./turnos');
const { verificarPassword, hashFalso, crearSesion, destruirSesion, requireAdmin } = require('./auth');

const router = express.Router();

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{2}:\d{2}$/;
const RE_TEL = /^\+?[\d\s-]{8,20}$/;

// 5 intentos cada 15 minutos por IP. No distingue si el intento fue con
// un email que existe o no: alguien que prueba fuerza bruta igual se
// queda sin intentos aunque esté adivinando emails al mismo tiempo.
const limitadorLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Probá de nuevo en unos minutos.' },
});

// -----------------------------------------------------------------
// Login (sin requireAdmin: todavía no hay sesión)
// -----------------------------------------------------------------
router.post('/login', limitadorLogin, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(401).json({ error: 'Email o contraseña incorrectos' });
  }

  try {
    const { rows } = await pool.query(
      'SELECT id, password_hash FROM administradores WHERE email = $1',
      [email]
    );
    const admin = rows[0];

    // Comparamos siempre contra ALGÚN hash bcrypt, exista o no el admin,
    // para que el tiempo de respuesta sea parecido en los dos casos y no
    // delate, por la demora, qué emails están registrados.
    const hashAComparar = admin ? admin.password_hash : await hashFalso();
    const coincide = await verificarPassword(password, hashAComparar);

    if (!admin || !coincide) {
      return res.status(401).json({ error: 'Email o contraseña incorrectos' });
    }

    await crearSesion(res, admin.id);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// A partir de acá, todas las rutas necesitan una sesión válida.
router.use(requireAdmin);

router.post('/logout', async (req, res) => {
  try {
    await destruirSesion(req, res);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/yo', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT nombre FROM clubes WHERE id = $1', [req.admin.clubId]);
    res.json({
      email: req.admin.email,
      club: { id: req.admin.clubId, nombre: rows[0]?.nombre || null },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Lista simple de canchas del club, para el selector del formulario de
// turnos fijos (la agenda y el resto de las rutas no la necesitan: ya
// traen sus propios datos de cancha).
router.get('/canchas', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, nombre FROM canchas WHERE club_id = $1 AND activa ORDER BY id', [
      req.admin.clubId,
    ]);
    res.json({ canchas: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// -----------------------------------------------------------------
// Agenda del día
// -----------------------------------------------------------------

// Igual que la grilla de /disponibilidad (horarios de apertura +
// duración de cada cancha) pero sin ocultar los turnos que ya pasaron,
// y trayendo los datos del cliente cuando el turno está ocupado: por un
// turno fijo (tabla turnos_fijos) o por una reserva (tabla reservas,
// 'online' | 'manual' | 'bloqueo' según su origen).
const SQL_AGENDA = `
  SELECT c.id AS cancha_id, c.nombre AS cancha_nombre,
         to_char(s.inicio AT TIME ZONE cl.zona_horaria, 'HH24:MI') AS hora,
         tf.id AS turno_fijo_id,
         tf.cliente_nombre AS fijo_nombre,
         tf.cliente_tel AS fijo_tel,
         r.id AS reserva_id,
         r.estado AS reserva_estado,
         r.origen AS reserva_origen,
         r.cliente_nombre AS reserva_nombre,
         r.cliente_tel AS reserva_tel,
         r.vence_en AS reserva_vence_en
  FROM canchas c
  JOIN clubes cl ON cl.id = c.club_id
  JOIN horarios_apertura h
    ON h.club_id = c.club_id AND h.dia_semana = EXTRACT(DOW FROM $1::date)
  CROSS JOIN LATERAL generate_series(
    ($1::date + h.abre) AT TIME ZONE cl.zona_horaria,
    ($1::date + h.cierra) AT TIME ZONE cl.zona_horaria - make_interval(mins => c.duracion_min),
    make_interval(mins => c.duracion_min)
  ) AS s(inicio)
  LEFT JOIN turnos_fijos tf
    ON tf.cancha_id = c.id AND tf.activo
    AND tf.dia_semana = EXTRACT(DOW FROM $1::date)
    AND tf.hora_inicio = (s.inicio AT TIME ZONE cl.zona_horaria)::time
  LEFT JOIN reservas r
    ON r.cancha_id = c.id
    AND r.horario && tstzrange(s.inicio, s.inicio + make_interval(mins => c.duracion_min))
    AND (r.estado = 'confirmada' OR (r.estado = 'retenida' AND r.vence_en > now()))
  WHERE c.club_id = $2 AND c.activa
  ORDER BY c.id, s.inicio;
`;

router.get('/agenda', async (req, res) => {
  const { fecha } = req.query;
  if (!RE_FECHA.test(fecha || '')) {
    return res.status(400).json({ error: 'Usá fecha=AAAA-MM-DD' });
  }

  try {
    await liberarVencidas();
    const { rows } = await pool.query(SQL_AGENDA, [fecha, req.admin.clubId]);

    const canchas = [];
    const porId = new Map();
    let reservas = 0;
    let libres = 0;

    for (const r of rows) {
      if (!porId.has(r.cancha_id)) {
        const cancha = { id: r.cancha_id, nombre: r.cancha_nombre, turnos: [] };
        porId.set(r.cancha_id, cancha);
        canchas.push(cancha);
      }

      let turno;
      if (r.turno_fijo_id) {
        turno = {
          hora: r.hora,
          estado: 'fijo',
          turno_fijo_id: r.turno_fijo_id,
          cliente_nombre: r.fijo_nombre,
          cliente_tel: r.fijo_tel,
        };
        reservas++;
      } else if (r.reserva_id) {
        // origen 'online' | 'manual' | 'bloqueo'
        turno = {
          hora: r.hora,
          estado: r.reserva_origen,
          reserva_id: r.reserva_id,
          reserva_estado: r.reserva_estado,
          cliente_nombre: r.reserva_nombre,
          cliente_tel: r.reserva_tel,
          vence_en: r.reserva_vence_en,
        };
        // Un bloqueo no es una reserva de un cliente, así que no cuenta
        // ni como "reservas hoy" ni como turno libre.
        if (r.reserva_origen !== 'bloqueo') reservas++;
      } else {
        turno = { hora: r.hora, estado: 'libre' };
        libres++;
      }

      porId.get(r.cancha_id).turnos.push(turno);
    }

    res.json({
      fecha,
      // Mercado Pago todavía no está integrado: no hay forma de saber
      // cuánto se cobró en señas, así que va en null a propósito.
      resumen: { reservas, senias_cobradas: null, libres },
      canchas,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// -----------------------------------------------------------------
// Carga manual de una reserva (la que llega por WhatsApp o en persona)
// -----------------------------------------------------------------
router.post('/reservas', async (req, res) => {
  const { cancha_id, fecha, hora, cliente_nombre, cliente_tel } = req.body || {};

  if (!Number.isInteger(cancha_id)) {
    return res.status(400).json({ error: 'cancha_id inválido' });
  }
  if (!RE_FECHA.test(fecha || '')) {
    return res.status(400).json({ error: 'Usá fecha=AAAA-MM-DD' });
  }
  if (!RE_HORA.test(hora || '')) {
    return res.status(400).json({ error: 'Usá hora=HH:MM' });
  }
  const nombre = String(cliente_nombre || '').trim();
  if (nombre.length < 2 || nombre.length > 80) {
    return res.status(400).json({ error: 'Nombre inválido' });
  }
  let tel = null;
  if (cliente_tel != null && String(cliente_tel).trim() !== '') {
    tel = String(cliente_tel).trim();
    if (!RE_TEL.test(tel)) {
      return res.status(400).json({ error: 'Teléfono inválido' });
    }
  }

  try {
    await liberarVencidas();

    // buscarTurno ya filtra por club_id, así que un admin nunca puede
    // cargar una reserva en una cancha que no es de su club: si manda
    // un cancha_id ajeno, esto da "no existe" igual que si no existiera.
    const turno = await buscarTurno(fecha, cancha_id, req.admin.clubId, hora);
    if (!turno) {
      return res.status(400).json({ error: 'Ese turno no existe' });
    }
    if (turno.inicio < new Date()) {
      return res.status(400).json({ error: 'Ese turno ya pasó' });
    }
    if (turno.esFijo) {
      return res.status(409).json({ error: 'Ese turno ya está tomado' });
    }

    const insert = await pool.query(
      `INSERT INTO reservas (cancha_id, horario, estado, origen, cliente_nombre, cliente_tel)
       VALUES ($1, tstzrange($2, $3), 'confirmada', 'manual', $4, $5)
       RETURNING id`,
      [cancha_id, turno.inicio, turno.fin, nombre, tel]
    );

    res.status(201).json({ id: insert.rows[0].id });
  } catch (err) {
    if (err.code === '23P01') {
      return res.status(409).json({ error: 'Ese turno ya está tomado' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// -----------------------------------------------------------------
// Bloquear un turno (cancha en mantenimiento, torneo, etc.)
// -----------------------------------------------------------------
router.post('/bloqueos', async (req, res) => {
  const { cancha_id, fecha, hora, motivo } = req.body || {};

  if (!Number.isInteger(cancha_id)) {
    return res.status(400).json({ error: 'cancha_id inválido' });
  }
  if (!RE_FECHA.test(fecha || '')) {
    return res.status(400).json({ error: 'Usá fecha=AAAA-MM-DD' });
  }
  if (!RE_HORA.test(hora || '')) {
    return res.status(400).json({ error: 'Usá hora=HH:MM' });
  }
  let nota = null;
  if (motivo != null && String(motivo).trim() !== '') {
    nota = String(motivo).trim().slice(0, 80);
  }

  try {
    await liberarVencidas();

    const turno = await buscarTurno(fecha, cancha_id, req.admin.clubId, hora);
    if (!turno) {
      return res.status(400).json({ error: 'Ese turno no existe' });
    }
    if (turno.inicio < new Date()) {
      return res.status(400).json({ error: 'Ese turno ya pasó' });
    }
    if (turno.esFijo) {
      return res.status(409).json({ error: 'Ese turno ya está tomado' });
    }

    // El motivo del bloqueo se guarda en cliente_nombre: no hay un
    // cliente real, pero así se ve en la agenda sin agregar una columna.
    const insert = await pool.query(
      `INSERT INTO reservas (cancha_id, horario, estado, origen, cliente_nombre)
       VALUES ($1, tstzrange($2, $3), 'confirmada', 'bloqueo', $4)
       RETURNING id`,
      [cancha_id, turno.inicio, turno.fin, nota]
    );

    res.status(201).json({ id: insert.rows[0].id });
  } catch (err) {
    if (err.code === '23P01') {
      return res.status(409).json({ error: 'Ese turno ya está tomado' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// -----------------------------------------------------------------
// Cancelar una reserva (online, manual o un bloqueo)
// -----------------------------------------------------------------
router.post('/reservas/:id/cancelar', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Id inválido' });
  }

  try {
    // El JOIN con canchas filtrado por club_id es lo que impide que un
    // admin cancele una reserva de otro club aunque adivine su id.
    const { rows } = await pool.query(
      `UPDATE reservas r SET estado = 'cancelada'
       FROM canchas c
       WHERE r.id = $1 AND r.cancha_id = c.id AND c.club_id = $2
         AND r.estado IN ('retenida', 'confirmada')
       RETURNING r.id`,
      [id, req.admin.clubId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No encontramos esa reserva' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// -----------------------------------------------------------------
// Turnos fijos
// -----------------------------------------------------------------
router.get('/turnos-fijos', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT tf.id, tf.cancha_id, c.nombre AS cancha_nombre, tf.dia_semana,
              to_char(tf.hora_inicio, 'HH24:MI') AS hora_inicio,
              tf.cliente_nombre, tf.cliente_tel
       FROM turnos_fijos tf
       JOIN canchas c ON c.id = tf.cancha_id
       WHERE c.club_id = $1 AND tf.activo
       ORDER BY tf.dia_semana, tf.hora_inicio`,
      [req.admin.clubId]
    );
    res.json({ turnosFijos: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/turnos-fijos', async (req, res) => {
  const { cancha_id, dia_semana, hora_inicio, cliente_nombre, cliente_tel } = req.body || {};

  if (!Number.isInteger(cancha_id)) {
    return res.status(400).json({ error: 'cancha_id inválido' });
  }
  if (!Number.isInteger(dia_semana) || dia_semana < 0 || dia_semana > 6) {
    return res.status(400).json({ error: 'dia_semana inválido (0 a 6)' });
  }
  if (!RE_HORA.test(hora_inicio || '')) {
    return res.status(400).json({ error: 'Usá hora_inicio=HH:MM' });
  }
  const nombre = String(cliente_nombre || '').trim();
  if (nombre.length < 2 || nombre.length > 80) {
    return res.status(400).json({ error: 'Nombre inválido' });
  }
  const tel = String(cliente_tel || '').trim();
  if (!RE_TEL.test(tel)) {
    return res.status(400).json({ error: 'Teléfono inválido' });
  }

  try {
    const { rows: canchaRows } = await pool.query(
      'SELECT id FROM canchas WHERE id = $1 AND club_id = $2 AND activa',
      [cancha_id, req.admin.clubId]
    );
    if (canchaRows.length === 0) {
      return res.status(400).json({ error: 'Esa cancha no existe' });
    }

    // Dos turnos fijos activos en la misma cancha/día/hora harían que la
    // agenda mostrara el turno duplicado, así que lo evitamos acá.
    const { rows: choqueRows } = await pool.query(
      `SELECT id FROM turnos_fijos
       WHERE cancha_id = $1 AND dia_semana = $2 AND hora_inicio = $3 AND activo`,
      [cancha_id, dia_semana, hora_inicio]
    );
    if (choqueRows.length > 0) {
      return res.status(409).json({ error: 'Ya hay un turno fijo en ese horario' });
    }

    const insert = await pool.query(
      `INSERT INTO turnos_fijos (cancha_id, dia_semana, hora_inicio, cliente_nombre, cliente_tel, activo)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id`,
      [cancha_id, dia_semana, hora_inicio, nombre, tel]
    );

    res.status(201).json({ id: insert.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/turnos-fijos/:id/desactivar', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Id inválido' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE turnos_fijos tf SET activo = false
       FROM canchas c
       WHERE tf.id = $1 AND tf.cancha_id = c.id AND c.club_id = $2 AND tf.activo
       RETURNING tf.id`,
      [id, req.admin.clubId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'No encontramos ese turno fijo' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
