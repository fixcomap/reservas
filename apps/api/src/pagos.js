const crypto = require('crypto');
const pool = require('./db');
const { conLockDeCancha, condicionTurnoFijo } = require('./turnos');
const { obtenerOrden, reembolsarOrden, aCentavos, ErrorMP } = require('./mercadopago');
const { enviarConfirmacion } = require('./mail');

// Link secreto de la reserva: en la base se guarda solo el hash
function generarToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const RE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

// Monto que se cobra: seña o total
const SQL_MONTO_A_PAGAR = `CASE WHEN r.tipo_pago = 'senia' THEN r.monto_senia ELSE r.monto_total END`;

// Estados de la orden: created, processing, processed, action_required,
// failed, canceled, refunded. Pagada = processed + accredited.
function esReembolsada(orden) {
  return orden.status === 'refunded' || ['refunded', 'partially_refunded'].includes(orden.status_detail);
}

function leerOrden(orden) {
  if (esReembolsada(orden)) return 'reembolsada';
  if (orden.status === 'processed' && orden.status_detail === 'accredited') return 'pagada';
  if (['failed', 'canceled', 'expired'].includes(orden.status)) return 'rechazada';
  return 'pendiente'; // created, processing, action_required...
}

// Lo cobrado, en centavos
function montoCobrado(orden) {
  const total = aCentavos(orden.total_paid_amount);
  if (total != null) return total;
  const pagos = orden.transactions?.payments || [];
  return pagos
    .filter((p) => p.status === 'processed')
    .reduce((suma, p) => suma + (aCentavos(p.paid_amount ?? p.amount) || 0), 0);
}

// Misma reserva, monto exacto y en ARS
function ordenCoincide(orden, reserva) {
  const esperado = Number(reserva.monto_a_pagar) * 100;
  return (
    orden.currency === 'ARS' &&
    orden.external_reference === String(reserva.id) &&
    aCentavos(orden.total_amount) === esperado &&
    montoCobrado(orden) === esperado
  );
}

// ¿El turno sigue libre para esta reserva? (con el lock de la cancha tomado)
async function turnoDisponiblePara(client, reserva) {
  if (new Date(reserva.inicio) < new Date()) return false; // ya empezó
  if (reserva.estado === 'retenida' && new Date(reserva.vence_en) > new Date()) return true;

  const { rows } = await client.query(
    `SELECT EXISTS (
              SELECT 1 FROM reservas o
              WHERE o.cancha_id = r.cancha_id AND o.id <> r.id
                AND o.horario && r.horario
                AND (o.estado = 'confirmada' OR (o.estado = 'retenida' AND o.vence_en > now()))
            ) AS ocupado,
            to_char(lower(r.horario) AT TIME ZONE cl.zona_horaria, 'YYYY-MM-DD') AS fecha_local
     FROM reservas r
     JOIN canchas c ON c.id = r.cancha_id
     JOIN clubes cl ON cl.id = c.club_id
     WHERE r.id = $1`,
    [reserva.id]
  );
  if (rows[0].ocupado) return false;

  const { rows: fijo } = await client.query(
    `SELECT EXISTS (SELECT 1 FROM turnos_fijos tf WHERE ${condicionTurnoFijo()}) AS es_fijo
     FROM reservas r
     JOIN canchas c ON c.id = r.cancha_id
     JOIN clubes cl ON cl.id = c.club_id
     CROSS JOIN LATERAL (SELECT lower(r.horario) AS inicio) s
     WHERE r.id = $2`,
    [rows[0].fecha_local, reserva.id]
  );
  return !fijo[0].es_fijo;
}

// Reembolso total. Si falla, la reserva queda en 'reembolso_pendiente'.
async function intentarReembolso(reservaId, ordenId) {
  try {
    const orden = await obtenerOrden(ordenId);
    if (!esReembolsada(orden)) {
      try {
        await reembolsarOrden(ordenId);
      } catch (err) {
        if (!(err instanceof ErrorMP && err.codigo === 'order_already_refunded')) throw err;
      }
    }
    await pool.query(
      `UPDATE reservas SET pago_estado = 'reembolsado'
       WHERE id = $1 AND pago_estado = 'reembolso_pendiente'`,
      [reservaId]
    );
  } catch (err) {
    console.error(`Reembolso de la reserva ${reservaId} falló: ${err.message}`);
  }
}

// Decide el estado del pago consultando la orden a Mercado Pago.
// La usan la vuelta del jugador, el webhook y el panel. Es idempotente.
async function verificarPago(reservaId) {
  const { rows } = await pool.query(
    `SELECT id, cancha_id, mp_order_id, pago_estado FROM reservas WHERE id = $1 AND origen = 'online'`,
    [reservaId]
  );
  const inicial = rows[0];
  if (!inicial || !inicial.mp_order_id) return;
  if (inicial.pago_estado === 'aprobado' || inicial.pago_estado === 'reembolsado') return;
  if (inicial.pago_estado === 'reembolso_pendiente') {
    await intentarReembolso(inicial.id, inicial.mp_order_id);
    return;
  }

  const orden = await obtenerOrden(inicial.mp_order_id);
  const resultado = leerOrden(orden);

  if (resultado === 'pendiente') return;

  if (resultado === 'rechazada') {
    await pool.query(`UPDATE reservas SET pago_estado = 'rechazado' WHERE id = $1 AND pago_estado = 'pendiente'`, [
      inicial.id,
    ]);
    return;
  }

  if (resultado === 'reembolsada') {
    await pool.query(
      `UPDATE reservas
       SET pago_estado = 'reembolsado',
           estado = CASE WHEN estado = 'retenida' THEN 'cancelada' ELSE estado END
       WHERE id = $1 AND pago_estado IN ('pendiente', 'rechazado')`,
      [inicial.id]
    );
    return;
  }

  // resultado === 'pagada'
  const pagoId = orden.transactions?.payments?.[0]?.id || null;

  const decision = await conLockDeCancha(inicial.cancha_id, async (client) => {
    const { rows: filas } = await client.query(
      `SELECT r.id, r.estado, r.pago_estado, r.vence_en, lower(r.horario) AS inicio,
              ${SQL_MONTO_A_PAGAR} AS monto_a_pagar
       FROM reservas r WHERE r.id = $1 FOR UPDATE`,
      [inicial.id]
    );
    const reserva = filas[0];

    if (reserva.pago_estado === 'aprobado' || reserva.pago_estado === 'reembolsado') return 'nada';
    if (reserva.pago_estado === 'reembolso_pendiente') return 'reembolsar';

    const pedirReembolso = async () => {
      await client.query(
        `UPDATE reservas
         SET estado = 'cancelada', pago_estado = 'reembolso_pendiente', mp_pago_id = $2
         WHERE id = $1`,
        [reserva.id, pagoId]
      );
      return 'reembolsar';
    };

    if (!ordenCoincide(orden, reserva)) {
      console.error(`La orden de la reserva ${reserva.id} no coincide en monto, moneda o referencia`);
      return pedirReembolso();
    }

    if (!(await turnoDisponiblePara(client, reserva))) {
      return pedirReembolso();
    }

    await client.query('SAVEPOINT confirmar');
    try {
      await client.query(
        `UPDATE reservas
         SET estado = 'confirmada', pago_estado = 'aprobado',
             monto_pagado = $2, pagado_en = now(), mp_pago_id = $3
         WHERE id = $1`,
        [reserva.id, reserva.monto_a_pagar, pagoId]
      );
    } catch (err) {
      if (err.code !== '23P01') throw err;
      await client.query('ROLLBACK TO SAVEPOINT confirmar');
      return pedirReembolso();
    }
    return 'confirmada';
  });

  if (decision === 'reembolsar') {
    await intentarReembolso(inicial.id, inicial.mp_order_id);
  }
  if (decision === 'confirmada') {
    enviarConfirmacion(inicial.id);
  }
}

module.exports = { generarToken, hashToken, RE_TOKEN, SQL_MONTO_A_PAGAR, verificarPago };
