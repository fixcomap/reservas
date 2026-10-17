const nodemailer = require('nodemailer');
const pool = require('./db');

// Mails al jugador, por SMTP. En desarrollo apuntá SMTP_HOST/SMTP_PORT a
// Mailpit (docker compose up -d mailpit): los mails no salen a internet
// y se ven en http://localhost:8025. En producción se cambian solo las
// variables SMTP_* por las del proveedor (Gmail, Brevo, Resend...).
// Si SMTP_HOST está vacío no se manda nada: la reserva funciona igual.
//
// Las credenciales SMTP se leen de process.env y no se loguean nunca.

let transporte = null;
function obtenerTransporte() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      // true solo para el puerto 465 (TLS directo); en 587 y 1025 no.
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }
  return transporte;
}

// Lo que escribe el jugador (nombre) o el dueño (nombre del club,
// dirección) va adentro de un HTML: se escapa para que no pueda meter
// etiquetas ni links en el mail.
function escaparHtml(texto) {
  return String(texto ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

// "2026-10-19" -> "Lunes 19 de octubre"
function fechaLarga(iso) {
  const [anio, mes, dia] = iso.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return `${DIAS[fecha.getUTCDay()]} ${dia} de ${MESES[mes - 1]}`;
}

function pesos(monto) {
  return '$' + Number(monto || 0).toLocaleString('es-AR');
}

function armarMail(r) {
  const cuando = `${fechaLarga(r.fecha)} · ${r.hora} a ${r.hora_fin}`;
  const cancha = r.cancha_descripcion ? `${r.cancha_nombre} · ${r.cancha_descripcion}` : r.cancha_nombre;
  const resto = r.monto_total - r.monto_pagado;
  const donde = [r.club_direccion, r.club_localidad].filter(Boolean).join(', ');
  const etiquetaPago = r.tipo_pago === 'senia' ? 'Seña pagada' : 'Pagaste';

  const filas = [
    ['Cuándo', cuando],
    ['Cancha', cancha],
    ...(donde ? [['Dónde', donde]] : []),
    [etiquetaPago, pesos(r.monto_pagado)],
    ['A pagar en el club', pesos(resto)],
  ];

  const asunto = `Turno confirmado · ${r.club_nombre} · ${fechaLarga(r.fecha)} ${r.hora}`;

  const texto = [
    `¡Hola ${r.cliente_nombre}!`,
    '',
    `Tu turno en ${r.club_nombre} está confirmado.`,
    '',
    ...filas.map(([k, v]) => `${k}: ${v}`),
    '',
    `Reserva #${r.id}. Guardá este mail como comprobante.`,
    '',
    'Reservas por fixcomap',
  ].join('\n');

  const html = `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px 12px;background:#F4F6F5;font-family:Arial,Helvetica,sans-serif;color:#18232F;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:16px;overflow:hidden;">
    <tr>
      <td style="background:#0F6B52;color:#FFFFFF;text-align:center;padding:28px 20px;">
        <div style="font-size:22px;font-weight:bold;">¡Turno confirmado!</div>
        <div style="font-size:14px;margin-top:6px;opacity:0.9;">${escaparHtml(r.club_nombre)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 20px 8px;">
        <p style="margin:0 0 6px;font-size:15px;">¡Hola ${escaparHtml(r.cliente_nombre)}!</p>
        <p style="margin:0 0 16px;font-size:12px;font-weight:bold;letter-spacing:0.8px;color:#55626F;">RESERVA #${r.id}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
          ${filas
            .map(
              ([k, v]) => `<tr>
            <td style="padding:8px 0;color:#55626F;border-top:1px solid #E3E8E6;">${escaparHtml(k)}</td>
            <td style="padding:8px 0;text-align:right;font-weight:bold;border-top:1px solid #E3E8E6;">${escaparHtml(v)}</td>
          </tr>`
            )
            .join('')}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 20px 24px;font-size:12px;color:#55626F;">
        Guardá este mail como comprobante.<br>Reservas por <strong>fixcomap</strong>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { asunto, texto, html };
}

// Manda el mail de "turno confirmado" una sola vez por reserva.
//
// El UPDATE ... WHERE mail_confirmacion_enviado_en IS NULL es la
// "reserva" del envío: si dos llamadas llegan juntas (el webhook y la
// vuelta del jugador, por ejemplo), solo una consigue pasarlo de NULL a
// una fecha, y solo esa manda el mail. Si el envío falla, se vuelve a
// NULL para que la próxima llamada lo reintente.
//
// Nunca tira error: un mail que no sale no tiene que romper la
// confirmación del turno.
async function enviarConfirmacion(reservaId) {
  const smtp = obtenerTransporte();
  if (!smtp) return;

  let reserva;
  try {
    const { rows } = await pool.query(
      `UPDATE reservas r SET mail_confirmacion_enviado_en = now()
       FROM canchas c, clubes cl
       WHERE r.id = $1 AND c.id = r.cancha_id AND cl.id = c.club_id
         AND r.mail_confirmacion_enviado_en IS NULL
         AND r.estado = 'confirmada' AND r.pago_estado = 'aprobado'
         AND r.cliente_email IS NOT NULL
       RETURNING r.id, r.cliente_email, r.cliente_nombre, r.tipo_pago, r.monto_total, r.monto_pagado,
                 to_char(lower(r.horario) AT TIME ZONE cl.zona_horaria, 'YYYY-MM-DD') AS fecha,
                 to_char(lower(r.horario) AT TIME ZONE cl.zona_horaria, 'HH24:MI') AS hora,
                 to_char(upper(r.horario) AT TIME ZONE cl.zona_horaria, 'HH24:MI') AS hora_fin,
                 c.nombre AS cancha_nombre, c.descripcion AS cancha_descripcion,
                 cl.nombre AS club_nombre, cl.direccion_completa AS club_direccion, cl.localidad AS club_localidad`,
      [reservaId]
    );
    reserva = rows[0];
  } catch (err) {
    console.error(`Mail de la reserva ${reservaId}: ${err.message}`);
    return;
  }
  if (!reserva) return; // ya se mandó, o todavía no corresponde

  try {
    const { asunto, texto, html } = armarMail(reserva);
    await smtp.sendMail({
      from: process.env.MAIL_FROM || 'Reservas <no-responder@localhost>',
      to: reserva.cliente_email,
      subject: asunto,
      text: texto,
      html,
    });
  } catch (err) {
    console.error(`No se pudo mandar el mail de la reserva ${reservaId}: ${err.code || ''} ${err.message}`.trim());
    await pool
      .query('UPDATE reservas SET mail_confirmacion_enviado_en = NULL WHERE id = $1', [reservaId])
      .catch((e) => console.error(e));
  }
}

module.exports = { enviarConfirmacion, escaparHtml };
