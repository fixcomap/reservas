const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config');
const pool = require('./db');
const { crearConfianzaProxy } = require('./proxy');
const {
  buscarTurno,
  liberarVencidas,
  conLockDeCancha,
  ErrorTurno,
  condicionTurnoFijo,
  calcularSenia,
} = require('./turnos');
const rutasAdmin = require('./rutasAdmin');
const rateLimit = require('express-rate-limit');
const { crearOrden } = require('./mercadopago');
const { generarToken, hashToken, RE_TOKEN, SQL_MONTO_A_PAGAR, verificarPago } = require('./pagos');
const { webhookMercadoPago } = require('./webhookMercadoPago');
const { enviarConfirmacion } = require('./mail');

const app = express();
app.disable('x-powered-by');

// En producción: IP real del cliente detrás de Cloudflare + Google (ver proxy.js).
// En local no hay proxies delante, así que no se confía en X-Forwarded-For.
if (config.esProduccion) {
  app.set('trust proxy', crearConfianzaProxy(config.proxiesConfiables));
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
// Pedidos con cookie solo desde el front
app.use(cors({ origin: [config.frontUrl], credentials: true }));
// Límite por IP para todo (lecturas incluidas); las rutas sensibles tienen además el suyo.
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 900,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones seguidas. Esperá unos minutos.' },
}));
// CSRF: una escritura desde un navegador trae Origin; si no es el front, se rechaza.
// Sin Origin (servidor a servidor, como un webhook) no aplica: no lleva cookies de nadie.
app.use((req, res, next) => {
  const origen = req.get('Origin');
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (origen && origen !== config.frontUrl) return res.status(403).json({ error: 'Origen no permitido' });
  // Segunda capa: un formulario de otro sitio no puede mandar JSON sin pasar por CORS.
  if (req.headers['content-length'] > 0 && !req.is('application/json')) return res.status(415).json({ error: 'Solo se acepta JSON' });
  next();
});
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
const PORT = config.puerto;
const CLUB_ID = config.clubId;

// Adónde vuelve el jugador después de pagar
const FRONT_URL = config.frontUrl;

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MINUTOS_RETENCION = 15;

// "Seña turno Cancha 1 · Vie 16 oct 10:30"
function tituloOrden(tipoPago, canchaNombre, inicio, zonaHoraria) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('es-AR', {
      timeZone: zonaHoraria,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(inicio)
      .map((p) => [p.type, p.value.replace('.', '')])
  );
  const dia = partes.weekday.charAt(0).toUpperCase() + partes.weekday.slice(1);
  const prefijo = tipoPago === 'senia' ? 'Seña turno' : 'Pago total turno';
  return `${prefijo} ${canchaNombre} · ${dia} ${partes.day} ${partes.month} ${partes.hour}:${partes.minute}`;
}

// Chequeo de que la API ve la base
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
    const [{ rows }, { rows: clubRows }] = await Promise.all([
      pool.query(SQL_DISPONIBILIDAD, [fecha, CLUB_ID]),
      pool.query('SELECT senia_porcentaje FROM clubes WHERE id = $1', [CLUB_ID]),
    ]);

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

// Datos públicos del club
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
  // Los montos nunca vienen del body: los calcula el servidor
  const { cancha_id, fecha, hora, cliente_nombre, cliente_tel, cliente_email, tipo_pago } = req.body || {};

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
  const email = String(cliente_email || '').trim().toLowerCase();
  if (email.length > 254 || !RE_EMAIL.test(email)) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  if (tipo_pago !== 'senia' && tipo_pago !== 'total') {
    return res.status(400).json({ error: "Usá tipo_pago='senia' o tipo_pago='total'" });
  }

  const token = generarToken();
  const tokenHash = hashToken(token);

  try {
    await liberarVencidas();

    const resultado = await conLockDeCancha(cancha_id, async (client) => {
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

      const montoTotal = turno.precio;
      const montoSenia = calcularSenia(turno.precio, turno.seniaPorcentaje);
      const montoAPagar = tipo_pago === 'senia' ? montoSenia : montoTotal;

      const insert = await client.query(
        `INSERT INTO reservas
           (cancha_id, horario, estado, origen, cliente_nombre, cliente_tel, vence_en,
            monto_total, monto_senia, tipo_pago, token_hash, pago_estado, cliente_email)
         VALUES ($1, tstzrange($2, $3), 'retenida', 'online', $4, $5, now() + make_interval(mins => $6),
                 $7, $8, $9, $10, 'pendiente', $11)
         RETURNING id, vence_en,
           (SELECT c.nombre FROM canchas c WHERE c.id = $1) AS cancha_nombre,
           (SELECT cl.zona_horaria FROM canchas c JOIN clubes cl ON cl.id = c.club_id WHERE c.id = $1) AS zona_horaria`,
        [cancha_id, turno.inicio, turno.fin, nombre, tel, MINUTOS_RETENCION, montoTotal, montoSenia, tipo_pago, tokenHash, email]
      );
      return {
        ...insert.rows[0],
        inicio: turno.inicio,
        monto_total: montoTotal,
        monto_senia: montoSenia,
        monto_a_pagar: montoAPagar,
      };
    });

    // Orden de Mercado Pago (fuera de la transacción)
    let orden;
    try {
      orden = await crearOrden({
        reservaId: resultado.id,
        monto: resultado.monto_a_pagar,
        titulo: tituloOrden(tipo_pago, resultado.cancha_nombre, resultado.inicio, resultado.zona_horaria),
        urlRetorno: `${FRONT_URL}/reserva/${token}`,
        venceEnMinutos: MINUTOS_RETENCION,
        idempotencia: `reserva-${resultado.id}-${tokenHash.slice(0, 16)}`,
      });
      await pool.query('UPDATE reservas SET mp_order_id = $2 WHERE id = $1', [resultado.id, orden.id]);
    } catch (err) {
      console.error(`No se pudo crear la orden de Mercado Pago para la reserva ${resultado.id}: ${err.message}`);
      await pool
        .query(`UPDATE reservas SET estado = 'cancelada' WHERE id = $1 AND estado = 'retenida'`, [resultado.id])
        .catch((e) => console.error(e));
      return res.status(502).json({
        error: 'No pudimos iniciar el pago con Mercado Pago. Probá de nuevo en unos minutos.',
      });
    }

    // El token se devuelve solo esta vez
    res.status(201).json({
      token,
      checkout_url: orden.checkout_url,
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
    // 23P01 = turno superpuesto (exclusion constraint)
    if (err.code === '23P01') {
      return res.status(409).json({ error: 'Ese turno ya está tomado' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Cada consulta va a Mercado Pago: 30 por minuto por IP
const limitadorEstado = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas consultas. Esperá un minuto y actualizá.' },
});

const SQL_ESTADO_RESERVA = `
  SELECT r.id, r.mp_order_id, r.pago_estado, r.tipo_pago, r.monto_total, r.monto_pagado,
         ${SQL_MONTO_A_PAGAR} AS monto_a_pagar,
         CASE WHEN r.estado = 'retenida' AND r.vence_en <= now() THEN 'vencida' ELSE r.estado END AS estado,
         r.vence_en, r.pagado_en,
         to_char(lower(r.horario) AT TIME ZONE cl.zona_horaria, 'YYYY-MM-DD') AS fecha,
         to_char(lower(r.horario) AT TIME ZONE cl.zona_horaria, 'HH24:MI') AS hora,
         c.nombre AS cancha_nombre, c.descripcion AS cancha_descripcion, c.duracion_min
  FROM reservas r
  JOIN canchas c ON c.id = r.cancha_id
  JOIN clubes cl ON cl.id = c.club_id
  WHERE r.token_hash = $1 AND r.origen = 'online'
`;

// Estado de una reserva por su token (vuelta del pago). Sin datos personales.
app.get('/reservas/estado/:token', limitadorEstado, async (req, res) => {
  const { token } = req.params;
  if (!RE_TOKEN.test(token)) {
    return res.status(404).json({ error: 'No encontramos esa reserva' });
  }
  const tokenHash = hashToken(token);

  try {
    let { rows } = await pool.query(SQL_ESTADO_RESERVA, [tokenHash]);
    if (!rows[0]) {
      return res.status(404).json({ error: 'No encontramos esa reserva' });
    }

    // Nunca se usa ?status= de la URL: se le pregunta a Mercado Pago
    if (rows[0].mp_order_id && ['pendiente', 'rechazado', 'reembolso_pendiente'].includes(rows[0].pago_estado)) {
      try {
        await verificarPago(rows[0].id);
        ({ rows } = await pool.query(SQL_ESTADO_RESERVA, [tokenHash]));
      } catch (err) {
        console.error(`No se pudo verificar el pago de la reserva ${rows[0].id}: ${err.message}`);
      }
    }

    const r = rows[0];
    // Reintenta el mail si no salió (si ya salió, no hace nada)
    if (r.estado === 'confirmada' && r.pago_estado === 'aprobado') {
      enviarConfirmacion(r.id);
    }
    res.json({
      numero: r.id,
      fecha: r.fecha,
      hora: r.hora,
      cancha: { nombre: r.cancha_nombre, descripcion: r.cancha_descripcion },
      duracion_min: r.duracion_min,
      estado: r.estado, // retenida | vencida | confirmada | cancelada
      pago_estado: r.pago_estado,
      tipo_pago: r.tipo_pago,
      monto_total: r.monto_total,
      monto_a_pagar: r.monto_a_pagar,
      monto_pagado: r.monto_pagado,
      vence_en: r.vence_en,
      pagado_en: r.pagado_en,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
});

app.post('/webhooks/mercadopago', webhookMercadoPago);

app.use('/admin', rutasAdmin);

// Ejecutada directamente (Cloud Run, npm run dev) escucha; requerida (tests), solo exporta la app.
if (require.main === module) {
  const servidor = app.listen(PORT, () => {
    console.log(`API escuchando en el puerto ${PORT} (${config.esProduccion ? 'producción' : 'desarrollo'})`);
    console.log(`URL del webhook para cargar en Mercado Pago: ${config.urlWebhookMercadoPago}`);
  });

  // Cloud Run manda SIGTERM antes de apagar la instancia: termina lo que está en curso y cierra la base
  process.on('SIGTERM', () => {
    servidor.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  });
}

module.exports = app;
