const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('./db');
const {
  buscarTurno,
  liberarVencidas,
  hayReservaActiva,
  buscarConflictosFijo,
  diaSemanaDe,
  condicionTurnoFijo,
  conLockDeCancha,
  ErrorTurno,
} = require('./turnos');
const { verificarPassword, hashFalso, crearSesion, destruirSesion, requireAdmin } = require('./auth');

const router = express.Router();

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^\d{2}:\d{2}$/;
const RE_TEL = /^\+?[\d\s-]{8,20}$/;

const DIAS_SEMANA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

// Misma lista que SERVICIOS_DISPONIBLES en apps/web/src/config.js: el
// panel manda checkboxes de esta lista, pero igual la validamos acá
// para no guardar un servicio inventado si alguien manda el request a mano.
const SERVICIOS_DISPONIBLES = [
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
const RE_INSTAGRAM = /^[A-Za-z0-9_.]{1,30}$/;
const RE_WHATSAPP = /^\d{8,15}$/;

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
// Datos del club (pestaña Ajustes del panel)
// -----------------------------------------------------------------
router.get('/club-info', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT direccion_completa, localidad, telefono_whatsapp, instagram, mapa_consulta, servicios
       FROM clubes WHERE id = $1`,
      [req.admin.clubId]
    );
    const club = rows[0] || {};
    res.json({
      direccion_completa: club.direccion_completa || '',
      localidad: club.localidad || '',
      telefono_whatsapp: club.telefono_whatsapp || '',
      instagram: club.instagram || '',
      mapa_consulta: club.mapa_consulta || '',
      servicios: club.servicios || [],
      servicios_disponibles: SERVICIOS_DISPONIBLES,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/club-info', async (req, res) => {
  const { direccion_completa, localidad, telefono_whatsapp, instagram, mapa_consulta, servicios } = req.body || {};

  const direccion = String(direccion_completa || '').trim().slice(0, 200);
  const loc = String(localidad || '').trim().slice(0, 100);
  const mapa = String(mapa_consulta || '').trim().slice(0, 200);

  const whatsapp = String(telefono_whatsapp || '').trim();
  if (whatsapp && !RE_WHATSAPP.test(whatsapp)) {
    return res.status(400).json({ error: 'El WhatsApp tiene que tener solo números, sin +, espacios ni guiones (8 a 15 dígitos)' });
  }

  const insta = String(instagram || '').trim().replace(/^@/, '');
  if (insta && !RE_INSTAGRAM.test(insta)) {
    return res.status(400).json({ error: 'El usuario de Instagram no es válido (sin @, solo letras, números, puntos o guiones bajos)' });
  }

  if (!Array.isArray(servicios)) {
    return res.status(400).json({ error: 'servicios tiene que ser una lista' });
  }
  for (const s of servicios) {
    if (!SERVICIOS_DISPONIBLES.includes(s)) {
      return res.status(400).json({ error: `Servicio inválido: ${s}` });
    }
  }

  try {
    await pool.query(
      `UPDATE clubes
       SET direccion_completa = $1, localidad = $2, telefono_whatsapp = $3,
           instagram = $4, mapa_consulta = $5, servicios = $6
       WHERE id = $7`,
      [direccion || null, loc || null, whatsapp || null, insta || null, mapa || null, servicios, req.admin.clubId]
    );
    res.json({ ok: true });
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
// turno fijo (tabla turnos_fijos, condicionTurnoFijo) o por una reserva
// (tabla reservas, 'online' | 'manual' | 'bloqueo' según su origen).
//
// El segundo LEFT JOIN (tf_lib) es el mismo turno fijo pero visto al
// revés: solo pega cuando ESE día puntual tiene una excepción cargada,
// o sea cuando el fijo normalmente ocuparía el turno pero lo liberaron.
// Así la agenda puede mostrar "Fijo liberado" en vez de un libre común.
const SQL_AGENDA = `
  SELECT c.id AS cancha_id, c.nombre AS cancha_nombre,
         to_char(s.inicio AT TIME ZONE cl.zona_horaria, 'HH24:MI') AS hora,
         s.inicio AS inicio_ts,
         tf.id AS turno_fijo_id,
         tf.cliente_nombre AS fijo_nombre,
         tf.cliente_tel AS fijo_tel,
         tf_lib.id AS turno_fijo_liberado_id,
         r.id AS reserva_id,
         r.estado AS reserva_estado,
         r.origen AS reserva_origen,
         r.cliente_nombre AS reserva_nombre,
         r.cliente_tel AS reserva_tel,
         r.vence_en AS reserva_vence_en,
         r.monto_total AS reserva_monto_total,
         r.tipo_pago AS reserva_tipo_pago,
         r.monto_pagado AS reserva_monto_pagado
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
    ON ${condicionTurnoFijo()}
  LEFT JOIN turnos_fijos tf_lib
    ON ${condicionTurnoFijo({ tf: 'tf_lib', liberado: true })}
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

    const ahora = new Date();
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

      const pasado = new Date(r.inicio_ts) < ahora;
      let turno;

      if (r.turno_fijo_id) {
        turno = {
          hora: r.hora,
          estado: 'fijo',
          pasado,
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
          pasado,
          reserva_id: r.reserva_id,
          reserva_estado: r.reserva_estado,
          cliente_nombre: r.reserva_nombre,
          cliente_tel: r.reserva_tel,
          vence_en: r.reserva_vence_en,
          monto_total: r.reserva_monto_total,
          tipo_pago: r.reserva_tipo_pago,
          monto_pagado: r.reserva_monto_pagado,
        };
        // Un bloqueo no es una reserva de un cliente, así que no cuenta
        // ni como "reservas hoy" ni como turno libre.
        if (r.reserva_origen !== 'bloqueo') reservas++;
      } else if (r.turno_fijo_liberado_id) {
        turno = {
          hora: r.hora,
          estado: 'libre',
          pasado,
          liberado: true,
          turno_fijo_id: r.turno_fijo_liberado_id,
        };
        if (!pasado) libres++;
      } else {
        turno = { hora: r.hora, estado: 'libre', pasado };
        if (!pasado) libres++;
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

    const resultado = await conLockDeCancha(cancha_id, async (client) => {
      // buscarTurno ya filtra por club_id, así que un admin nunca puede
      // cargar una reserva en una cancha que no es de su club: si manda
      // un cancha_id ajeno, esto da "no existe" igual que si no existiera.
      const turno = await buscarTurno(fecha, cancha_id, req.admin.clubId, hora, client);
      if (!turno) {
        throw new ErrorTurno('Ese turno no existe', 400);
      }
      if (turno.inicio < new Date()) {
        throw new ErrorTurno('Ese turno ya pasó', 400);
      }
      if (turno.esFijo) {
        throw new ErrorTurno('Ese turno ya está tomado', 409);
      }

      // tipo_pago queda NULL (las cargas manuales no pasan por la
      // elección de seña/total), pero el total sí se guarda, con el
      // precio de la cancha en este momento.
      const insert = await client.query(
        `INSERT INTO reservas (cancha_id, horario, estado, origen, cliente_nombre, cliente_tel, monto_total)
         VALUES ($1, tstzrange($2, $3), 'confirmada', 'manual', $4, $5, $6)
         RETURNING id`,
        [cancha_id, turno.inicio, turno.fin, nombre, tel, turno.precio]
      );
      return insert.rows[0];
    });

    res.status(201).json({ id: resultado.id });
  } catch (err) {
    if (err instanceof ErrorTurno) {
      return res.status(err.status).json({ error: err.message, ...(err.detalle || {}) });
    }
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

    const resultado = await conLockDeCancha(cancha_id, async (client) => {
      const turno = await buscarTurno(fecha, cancha_id, req.admin.clubId, hora, client);
      if (!turno) {
        throw new ErrorTurno('Ese turno no existe', 400);
      }
      if (turno.inicio < new Date()) {
        throw new ErrorTurno('Ese turno ya pasó', 400);
      }
      if (turno.esFijo) {
        throw new ErrorTurno('Ese turno ya está tomado', 409);
      }

      // El motivo del bloqueo se guarda en cliente_nombre: no hay un
      // cliente real, pero así se ve en la agenda sin agregar una columna.
      const insert = await client.query(
        `INSERT INTO reservas (cancha_id, horario, estado, origen, cliente_nombre)
         VALUES ($1, tstzrange($2, $3), 'confirmada', 'bloqueo', $4)
         RETURNING id`,
        [cancha_id, turno.inicio, turno.fin, nota]
      );
      return insert.rows[0];
    });

    res.status(201).json({ id: resultado.id });
  } catch (err) {
    if (err instanceof ErrorTurno) {
      return res.status(err.status).json({ error: err.message, ...(err.detalle || {}) });
    }
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
      `SELECT r.id, r.estado, lower(r.horario) AS inicio
       FROM reservas r
       JOIN canchas c ON c.id = r.cancha_id
       WHERE r.id = $1 AND c.club_id = $2`,
      [id, req.admin.clubId]
    );
    const reserva = rows[0];

    if (!reserva || !['retenida', 'confirmada'].includes(reserva.estado)) {
      return res.status(404).json({ error: 'No encontramos esa reserva' });
    }
    if (new Date(reserva.inicio) < new Date()) {
      return res.status(400).json({ error: 'Ese turno ya empezó, no se puede cancelar' });
    }

    await pool.query(`UPDATE reservas SET estado = 'cancelada' WHERE id = $1`, [id]);
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
              tf.cliente_nombre, tf.cliente_tel,
              to_char(tf.fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
              to_char(tf.fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta
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
  const { cancha_id, dia_semana, hora_inicio, cliente_nombre, cliente_tel, fecha_desde, fecha_hasta } = req.body || {};

  if (!Number.isInteger(cancha_id)) {
    return res.status(400).json({ error: 'cancha_id inválido' });
  }
  if (!Number.isInteger(dia_semana) || dia_semana < 0 || dia_semana > 6) {
    return res.status(400).json({ error: 'dia_semana inválido (0 a 6)' });
  }
  if (!RE_HORA.test(hora_inicio || '')) {
    return res.status(400).json({ error: 'Usá hora_inicio=HH:MM' });
  }
  if (!RE_FECHA.test(fecha_desde || '')) {
    return res.status(400).json({ error: 'Usá fecha_desde=AAAA-MM-DD' });
  }
  let hasta = null;
  if (fecha_hasta != null && String(fecha_hasta).trim() !== '') {
    hasta = String(fecha_hasta).trim();
    if (!RE_FECHA.test(hasta)) {
      return res.status(400).json({ error: 'Usá fecha_hasta=AAAA-MM-DD' });
    }
    if (hasta < fecha_desde) {
      return res.status(400).json({ error: 'La fecha de fin no puede ser anterior a la fecha de inicio' });
    }
  }
  const nombre = String(cliente_nombre || '').trim();
  if (nombre.length < 2 || nombre.length > 80) {
    return res.status(400).json({ error: 'Nombre inválido' });
  }
  const tel = String(cliente_tel || '').trim();
  if (!RE_TEL.test(tel)) {
    return res.status(400).json({ error: 'Teléfono inválido' });
  }
  if (diaSemanaDe(fecha_desde) !== dia_semana) {
    return res
      .status(400)
      .json({ error: `fecha_desde tiene que ser un ${DIAS_SEMANA[dia_semana]}, igual que el día elegido` });
  }

  try {
    // Mismo lock que usan las reservas y los bloqueos: mientras se
    // valida y se crea este turno fijo, nadie más puede insertar una
    // reserva en esta cancha, así los dos chequeos (choque con otro
    // fijo, choque con reservas existentes) ven el estado real y no se
    // puede colar nada entre el chequeo y el insert.
    const resultado = await conLockDeCancha(cancha_id, async (client) => {
      const { rows: canchaRows } = await client.query(
        'SELECT id FROM canchas WHERE id = $1 AND club_id = $2 AND activa',
        [cancha_id, req.admin.clubId]
      );
      if (canchaRows.length === 0) {
        throw new ErrorTurno('Esa cancha no existe', 400);
      }

      // Otro turno fijo activo en la misma cancha/día/hora, pero solo
      // es choque real si sus vigencias se superponen en el tiempo:
      // A.desde <= B.hasta (o B no tiene fin) y B.desde <= A.hasta (o A
      // no tiene fin). Con 'infinity' para "sin fin" evita tener que
      // repetir la comparación con OR por cada lado NULL.
      const { rows: choqueRows } = await client.query(
        `SELECT id FROM turnos_fijos
         WHERE cancha_id = $1 AND dia_semana = $2 AND hora_inicio = $3 AND activo
           AND $4::date <= COALESCE(fecha_hasta, 'infinity'::date)
           AND COALESCE($5::date, 'infinity'::date) >= fecha_desde`,
        [cancha_id, dia_semana, hora_inicio, fecha_desde, hasta]
      );
      if (choqueRows.length > 0) {
        throw new ErrorTurno('Ya hay un turno fijo en ese horario que se superpone con estas fechas', 409);
      }

      // El chequeo que pedía este cambio: si ya hay reservas de
      // jugadores (u otras cargas) en ese horario para fechas futuras
      // dentro de la vigencia, no se puede crear el fijo sin que el
      // dueño las vea primero.
      const conflictos = await buscarConflictosFijo(
        { canchaId: cancha_id, diaSemana: dia_semana, horaInicio: hora_inicio, fechaDesde: fecha_desde, fechaHasta: hasta },
        client
      );
      if (conflictos.length > 0) {
        throw new ErrorTurno('Hay reservas que chocan con este turno fijo', 409, { conflictos });
      }

      const insert = await client.query(
        `INSERT INTO turnos_fijos
           (cancha_id, dia_semana, hora_inicio, cliente_nombre, cliente_tel, activo, fecha_desde, fecha_hasta)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7)
         RETURNING id`,
        [cancha_id, dia_semana, hora_inicio, nombre, tel, fecha_desde, hasta]
      );
      return insert.rows[0];
    });

    res.status(201).json({ id: resultado.id });
  } catch (err) {
    if (err instanceof ErrorTurno) {
      return res.status(err.status).json({ error: err.message, ...(err.detalle || {}) });
    }
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

// -----------------------------------------------------------------
// Excepciones: liberar (o volver a ocupar) una fecha puntual de un fijo
// -----------------------------------------------------------------
router.post('/turnos-fijos/:id/excepciones', async (req, res) => {
  const id = Number(req.params.id);
  const { fecha, motivo } = req.body || {};

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Id inválido' });
  }
  if (!RE_FECHA.test(fecha || '')) {
    return res.status(400).json({ error: 'Usá fecha=AAAA-MM-DD' });
  }
  let nota = null;
  if (motivo != null && String(motivo).trim() !== '') {
    nota = String(motivo).trim().slice(0, 80);
  }

  try {
    const { rows } = await pool.query(
      `SELECT tf.id, tf.activo, tf.dia_semana,
              to_char(tf.fecha_desde, 'YYYY-MM-DD') AS fecha_desde,
              to_char(tf.fecha_hasta, 'YYYY-MM-DD') AS fecha_hasta,
              ($2::date + tf.hora_inicio) AT TIME ZONE cl.zona_horaria AS instante
       FROM turnos_fijos tf
       JOIN canchas c ON c.id = tf.cancha_id
       JOIN clubes cl ON cl.id = c.club_id
       WHERE tf.id = $1 AND c.club_id = $3`,
      [id, fecha, req.admin.clubId]
    );
    const tf = rows[0];
    if (!tf) {
      return res.status(404).json({ error: 'No encontramos ese turno fijo' });
    }
    if (!tf.activo) {
      return res.status(400).json({ error: 'Ese turno fijo está desactivado' });
    }
    if (diaSemanaDe(fecha) !== tf.dia_semana) {
      return res.status(400).json({ error: `Ese turno fijo es los ${DIAS_SEMANA[tf.dia_semana]}, elegí una fecha de ese día` });
    }
    if (fecha < tf.fecha_desde || (tf.fecha_hasta && fecha > tf.fecha_hasta)) {
      return res.status(400).json({ error: 'Esa fecha está fuera de la vigencia del turno fijo' });
    }
    if (new Date(tf.instante) <= new Date()) {
      return res.status(400).json({ error: 'Esa fecha ya pasó, no se puede liberar' });
    }

    const insert = await pool.query(
      `INSERT INTO turnos_fijos_excepciones (turno_fijo_id, fecha, motivo)
       VALUES ($1, $2, $3)
       RETURNING id, to_char(fecha, 'YYYY-MM-DD') AS fecha`,
      [id, fecha, nota]
    );
    res.status(201).json(insert.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Esa fecha ya estaba liberada' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/turnos-fijos/:id/excepciones/:fecha/deshacer', async (req, res) => {
  const id = Number(req.params.id);
  const { fecha } = req.params;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Id inválido' });
  }
  if (!RE_FECHA.test(fecha || '')) {
    return res.status(400).json({ error: 'Fecha inválida' });
  }

  try {
    const { rows: tfRows } = await pool.query(
      `SELECT tf.id, tf.cancha_id, to_char(tf.hora_inicio, 'HH24:MI') AS hora_inicio
       FROM turnos_fijos tf
       JOIN canchas c ON c.id = tf.cancha_id
       WHERE tf.id = $1 AND c.club_id = $2`,
      [id, req.admin.clubId]
    );
    const tf = tfRows[0];
    if (!tf) {
      return res.status(404).json({ error: 'No encontramos ese turno fijo' });
    }

    const { rows: excRows } = await pool.query(
      'SELECT id FROM turnos_fijos_excepciones WHERE turno_fijo_id = $1 AND fecha = $2',
      [id, fecha]
    );
    if (excRows.length === 0) {
      return res.status(404).json({ error: 'No encontramos esa excepción' });
    }

    // Mismo lock que al crear una reserva o un fijo: entre que se
    // chequea si alguien reservó el turno liberado y se borra la
    // excepción (lo que lo vuelve a tapar), no puede colarse una
    // reserva nueva sin que la veamos.
    await conLockDeCancha(tf.cancha_id, async (client) => {
      const turno = await buscarTurno(fecha, tf.cancha_id, req.admin.clubId, tf.hora_inicio, client);
      if (turno && (await hayReservaActiva(tf.cancha_id, turno.inicio, turno.fin, client))) {
        throw new ErrorTurno('Ese turno ya tiene una reserva, no se puede volver a ocupar', 409);
      }
      await client.query('DELETE FROM turnos_fijos_excepciones WHERE turno_fijo_id = $1 AND fecha = $2', [id, fecha]);
    });

    res.json({ ok: true });
  } catch (err) {
    if (err instanceof ErrorTurno) {
      return res.status(err.status).json({ error: err.message, ...(err.detalle || {}) });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// -----------------------------------------------------------------
// Ajustes: precio por cancha y porcentaje de seña del club
// -----------------------------------------------------------------
router.get('/ajustes', async (req, res) => {
  try {
    const [{ rows: canchas }, { rows: clubRows }] = await Promise.all([
      pool.query('SELECT id, nombre, precio FROM canchas WHERE club_id = $1 AND activa ORDER BY id', [
        req.admin.clubId,
      ]),
      pool.query('SELECT senia_porcentaje FROM clubes WHERE id = $1', [req.admin.clubId]),
    ]);
    res.json({ canchas, senia_porcentaje: clubRows[0]?.senia_porcentaje ?? null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/ajustes/precios', async (req, res) => {
  const precios = req.body;

  if (!Array.isArray(precios) || precios.length === 0) {
    return res.status(400).json({ error: 'Mandá una lista de { cancha_id, precio }' });
  }
  for (const item of precios) {
    if (!Number.isInteger(item?.cancha_id)) {
      return res.status(400).json({ error: 'cancha_id inválido' });
    }
    if (!Number.isInteger(item?.precio) || item.precio < 0 || item.precio > 10000000) {
      return res.status(400).json({ error: 'El precio tiene que ser un entero entre 0 y 10.000.000' });
    }
  }

  try {
    // Validamos que TODAS las canchas sean del club antes de tocar
    // ninguna, para no dejar a medio guardar si una viene de otro club
    // (o no existe).
    const { rows: propias } = await pool.query('SELECT id FROM canchas WHERE club_id = $1', [req.admin.clubId]);
    const idsPropios = new Set(propias.map((c) => c.id));
    for (const item of precios) {
      if (!idsPropios.has(item.cancha_id)) {
        return res.status(404).json({ error: `No encontramos la cancha ${item.cancha_id}` });
      }
    }

    await Promise.all(
      precios.map((item) => pool.query('UPDATE canchas SET precio = $1 WHERE id = $2', [item.precio, item.cancha_id]))
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/ajustes/senia', async (req, res) => {
  const { senia_porcentaje } = req.body || {};

  if (!Number.isInteger(senia_porcentaje) || senia_porcentaje < 1 || senia_porcentaje > 100) {
    return res.status(400).json({ error: 'El porcentaje de seña tiene que ser un entero entre 1 y 100' });
  }

  try {
    await pool.query('UPDATE clubes SET senia_porcentaje = $1 WHERE id = $2', [senia_porcentaje, req.admin.clubId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

module.exports = router;
