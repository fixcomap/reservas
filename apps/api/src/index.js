const express = require('express');
const cookieParser = require('cookie-parser');
const pool = require('./db');
const { buscarTurno, liberarVencidas } = require('./turnos');
const rutasAdmin = require('./rutasAdmin');

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
const PORT = process.env.API_PORT || 3000;
const CLUB_ID = Number(process.env.CLUB_ID || 1);

// Para chequear rápido que la API ve la base
app.get('/salud', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

const SQL_DISPONIBILIDAD = `
  SELECT c.id AS cancha_id, c.nombre, c.descripcion, c.precio,
         to_char(s.inicio AT TIME ZONE cl.zona_horaria, 'HH24:MI') AS hora,
         NOT EXISTS (
           SELECT 1 FROM reservas r
           WHERE r.cancha_id = c.id
             AND r.horario && tstzrange(s.inicio, s.inicio + make_interval(mins => c.duracion_min))
             AND (r.estado = 'confirmada' OR (r.estado = 'retenida' AND r.vence_en > now()))
         )
         AND NOT EXISTS (
           SELECT 1 FROM turnos_fijos tf
           WHERE tf.cancha_id = c.id AND tf.activo
             AND tf.dia_semana = EXTRACT(DOW FROM $1::date)
             AND tf.hora_inicio = (s.inicio AT TIME ZONE cl.zona_horaria)::time
         ) AS libre
  FROM canchas c
  JOIN clubes cl ON cl.id = c.club_id
  JOIN horarios_apertura h
    ON h.club_id = c.club_id AND h.dia_semana = EXTRACT(DOW FROM $1::date)
  CROSS JOIN LATERAL generate_series(
    ($1::date + h.abre) AT TIME ZONE cl.zona_horaria,
    ($1::date + h.cierra) AT TIME ZONE cl.zona_horaria - make_interval(mins => c.duracion_min),
    make_interval(mins => c.duracion_min)
  ) AS s(inicio)
  WHERE c.club_id = $2 AND c.activa
    AND s.inicio > now()
  ORDER BY c.id, s.inicio;
`;

app.get('/disponibilidad', async (req, res) => {
  const { fecha } = req.query;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) {
    return res.status(400).json({ error: 'Usá fecha=AAAA-MM-DD' });
  }

  try {
    const { rows } = await pool.query(SQL_DISPONIBILIDAD, [fecha, CLUB_ID]);

    // Agrupar los turnos por cancha
    const canchas = [];
    const porId = new Map();
    for (const r of rows) {
      if (!porId.has(r.cancha_id)) {
        const cancha = {
          id: r.cancha_id,
          nombre: r.nombre,
          descripcion: r.descripcion,
          precio: r.precio,
          turnos: [],
        };
        porId.set(r.cancha_id, cancha);
        canchas.push(cancha);
      }
      porId.get(r.cancha_id).turnos.push({ hora: r.hora, libre: r.libre });
    }

    res.json({ fecha, canchas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/reservas', async (req, res) => {
  const { cancha_id, fecha, hora, cliente_nombre, cliente_tel } = req.body || {};

  // 1. Validar lo que llega: nunca confiar en el cliente
  if (!Number.isInteger(cancha_id)) {
    return res.status(400).json({ error: 'cancha_id inválido' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha || '')) {
    return res.status(400).json({ error: 'Usá fecha=AAAA-MM-DD' });
  }
  if (!/^\d{2}:\d{2}$/.test(hora || '')) {
    return res.status(400).json({ error: 'Usá hora=HH:MM' });
  }
  const nombre = String(cliente_nombre || '').trim();
  if (nombre.length < 2 || nombre.length > 80) {
    return res.status(400).json({ error: 'Nombre inválido' });
  }
  const tel = String(cliente_tel || '').trim();
  if (!/^\+?[\d\s-]{8,20}$/.test(tel)) {
    return res.status(400).json({ error: 'Teléfono inválido' });
  }

  try {
    await liberarVencidas();

    // 2. Verificar que el turno exista y se pueda reservar
    const turno = await buscarTurno(fecha, cancha_id, CLUB_ID, hora);
    if (!turno) {
      return res.status(400).json({ error: 'Ese turno no existe' });
    }
    if (turno.inicio < new Date()) {
      return res.status(400).json({ error: 'Ese turno ya pasó' });
    }
    if (turno.esFijo) {
      return res.status(409).json({ error: 'Ese turno ya está tomado' });
    }

    // 3. Crear la reserva retenida por 10 minutos
    const insert = await pool.query(
      `INSERT INTO reservas
         (cancha_id, horario, estado, origen, cliente_nombre, cliente_tel, vence_en)
       VALUES ($1, tstzrange($2, $3), 'retenida', 'online', $4, $5, now() + interval '10 minutes')
       RETURNING id, vence_en`,
      [cancha_id, turno.inicio, turno.fin, nombre, tel]
    );

    res.status(201).json({ id: insert.rows[0].id, vence_en: insert.rows[0].vence_en });
  } catch (err) {
    // 23P01 = la regla anti doble reserva de Postgres rechazó el insert
    if (err.code === '23P01') {
      return res.status(409).json({ error: 'Ese turno ya está tomado' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.use('/admin', rutasAdmin);

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});