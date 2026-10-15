const express = require('express');
const pool = require('./db');

const app = express();
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

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});