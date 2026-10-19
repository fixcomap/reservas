const express = require('express');
const cookieParser = require('cookie-parser');
const pool = require('./db');
const {
  buscarTurno,
  liberarVencidas,
  conLockDeCancha,
  ErrorTurno,
  condicionTurnoFijo,
  calcularSenia,
} = require('./turnos');
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
           WHERE ${condicionTurnoFijo()}
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
    // Consulta aparte (por clave primaria, prácticamente gratis) en vez
    // de sacar el porcentaje de la primera fila de SQL_DISPONIBILIDAD:
    // así sigue viniendo aunque ese día el club esté cerrado y la
    // consulta principal no devuelva ninguna fila.
    const [{ rows }, { rows: clubRows }] = await Promise.all([
      pool.query(SQL_DISPONIBILIDAD, [fecha, CLUB_ID]),
      pool.query('SELECT senia_porcentaje FROM clubes WHERE id = $1', [CLUB_ID]),
    ]);

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

    res.json({ fecha, senia_porcentaje: clubRows[0]?.senia_porcentaje ?? null, canchas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Datos públicos del club para la pantalla 1 (cabecera, "Dónde
// estamos", contacto, pie de página). Nada que no deba verse sin
// loguearse: ni emails de admin, ni nada de reservas.
app.get('/club', async (req, res) => {
  try {
    const [{ rows: clubRows }, { rows: horarioRows }] = await Promise.all([
      pool.query(
        `SELECT nombre, direccion_completa, localidad, telefono_whatsapp, instagram, mapa_consulta, servicios
         FROM clubes WHERE id = $1`,
        [CLUB_ID]
      ),
      pool.query(
        `SELECT dia_semana, to_char(abre, 'HH24:MI') AS abre, to_char(cierra, 'HH24:MI') AS cierra
         FROM horarios_apertura WHERE club_id = $1 ORDER BY dia_semana`,
        [CLUB_ID]
      ),
    ]);
    const club = clubRows[0];
    if (!club) {
      return res.status(404).json({ error: 'No encontramos el club' });
    }
    res.json({
      nombre: club.nombre,
      direccion: club.direccion_completa,
      localidad: club.localidad,
      whatsapp: club.telefono_whatsapp,
      instagram: club.instagram,
      mapa_consulta: club.mapa_consulta,
      servicios: club.servicios || [],
      horarios: horarioRows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/reservas', async (req, res) => {
  // Fijate que acá nunca se lee cliente_body.monto_total ni nada
  // parecido: aunque el body traiga montos inventados, ni siquiera se
  // desestructuran, así que no hay forma de que lleguen a usarse. Los
  // montos los calcula el servidor más abajo, con el precio y el
  // porcentaje que están guardados en la base en este momento.
  const { cancha_id, fecha, hora, cliente_nombre, cliente_tel, tipo_pago } = req.body || {};

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
  if (tipo_pago !== 'senia' && tipo_pago !== 'total') {
    return res.status(400).json({ error: "Usá tipo_pago='senia' o tipo_pago='total'" });
  }

  try {
    await liberarVencidas();

    // El lock por cancha evita que esta reserva y, por ejemplo, un
    // turno fijo que el dueño está creando en simultáneo lean los dos
    // "libre" antes de que ninguno haya insertado nada (ver conLockDeCancha
    // en turnos.js para la explicación completa).
    const resultado = await conLockDeCancha(cancha_id, async (client) => {
      // 2. Verificar que el turno exista y se pueda reservar
      const turno = await buscarTurno(fecha, cancha_id, CLUB_ID, hora, client);
      if (!turno) {
        throw new ErrorTurno('Ese turno no existe', 400);
      }
      if (turno.inicio < new Date()) {
        throw new ErrorTurno('Ese turno ya pasó', 400);
      }
      if (turno.esFijo) {
        throw new ErrorTurno('Ese turno ya está tomado', 409);
      }

      // Los montos salen del precio de la cancha y el porcentaje de
      // seña del club tal como están en la base ahora mismo, nunca del
      // body del pedido. Quedan guardados en la fila: si el dueño
      // cambia el precio mañana, esta reserva conserva lo que costaba
      // cuando se hizo.
      const montoTotal = turno.precio;
      const montoSenia = calcularSenia(turno.precio, turno.seniaPorcentaje);
      const montoAPagar = tipo_pago === 'senia' ? montoSenia : montoTotal;

      // 3. Crear la reserva retenida por 10 minutos
      const insert = await client.query(
        `INSERT INTO reservas
           (cancha_id, horario, estado, origen, cliente_nombre, cliente_tel, vence_en,
            monto_total, monto_senia, tipo_pago)
         VALUES ($1, tstzrange($2, $3), 'retenida', 'online', $4, $5, now() + interval '10 minutes',
                 $6, $7, $8)
         RETURNING id, vence_en`,
        [cancha_id, turno.inicio, turno.fin, nombre, tel, montoTotal, montoSenia, tipo_pago]
      );
      return { ...insert.rows[0], monto_total: montoTotal, monto_senia: montoSenia, monto_a_pagar: montoAPagar };
    });

    res.status(201).json({
      id: resultado.id,
      vence_en: resultado.vence_en,
      monto_total: resultado.monto_total,
      monto_senia: resultado.monto_senia,
      tipo_pago,
      monto_a_pagar: resultado.monto_a_pagar,
    });
  } catch (err) {
    if (err instanceof ErrorTurno) {
      return res.status(err.status).json({ error: err.message, ...(err.detalle || {}) });
    }
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