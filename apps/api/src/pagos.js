const crypto = require('crypto');
const pool = require('./db');
const { conLockDeCancha, condicionTurnoFijo } = require('./turnos');
const { obtenerOrden, reembolsarOrden, aCentavos, ErrorMP } = require('./mercadopago');
const { enviarConfirmacion } = require('./mail');

// ---------------------------------------------------------------------
// Link secreto de la reserva
// ---------------------------------------------------------------------
// El jugador recibe un token aleatorio (32 bytes en base64url, 43
// caracteres) una sola vez, al reservar. En la base queda solo su hash:
// el token es la "llave" para ver la reserva desde rutas públicas, en
// vez del id numérico, que cualquiera podría ir probando (1, 2, 3...).
function generarToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

const RE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

// Lo que se cobra por Mercado Pago: la seña o el total, según lo que
// eligió el jugador. Los dos montos los calculó el servidor al reservar
// y quedaron guardados en la fila.
const SQL_MONTO_A_PAGAR = `CASE WHEN r.tipo_pago = 'senia' THEN r.monto_senia ELSE r.monto_total END`;

// ---------------------------------------------------------------------
// Qué dice la orden de Mercado Pago
// ---------------------------------------------------------------------
// Estados de una orden de Checkout Pro (ver "Order status" en la
// documentación): created, processing, processed, action_required,
// failed, canceled, refunded. "processed" + "accredited" es la única
// combinación que significa "la plata está acreditada".
function esReembolsada(orden) {
  return orden.status === 'refunded' || ['refunded', 'partially_refunded'].includes(orden.status_detail);
}

function leerOrden(orden) {
  if (esReembolsada(orden)) return 'reembolsada';
  if (orden.status === 'processed' && orden.status_detail === 'accredited') return 'pagada';
  if (['failed', 'canceled', 'expired'].includes(orden.status)) return 'rechazada';
  return 'pendiente'; // created, processing, action_required...
}

// Lo cobrado según la orden: total_paid_amount si viene; si no, la suma
// de los pagos procesados.
function montoCobrado(orden) {
  const total = aCentavos(orden.total_paid_amount);
  if (total != null) return total;
  const pagos = orden.transactions?.payments || [];
  return pagos
    .filter((p) => p.status === 'processed')
    .reduce((suma, p) => suma + (aCentavos(p.paid_amount ?? p.amount) || 0), 0);
}

// La orden corresponde a ESTA reserva y cobró exactamente lo que había
// que cobrar, en pesos. Si algo no coincide, no se confirma nada.
function ordenCoincide(orden, reserva) {
  const esperado = Number(reserva.monto_a_pagar) * 100;
  return (
    orden.currency === 'ARS' &&
    orden.external_reference === String(reserva.id) &&
    aCentavos(orden.total_amount) === esperado &&
    montoCobrado(orden) === esperado
  );
}

// ---------------------------------------------------------------------
// ¿Se puede confirmar este turno ahora?
// ---------------------------------------------------------------------
// Se llama con el lock de la cancha tomado. Si la retención sigue
// vigente, el turno es de esta reserva (la exclusion constraint no deja
// que otra se superponga). Si venció, otro pudo haberlo tomado mientras
// tanto: otra reserva activa, o un turno fijo creado después.
async function turnoDisponiblePara(client, reserva) {
  if (new Date(reserva.inicio) < new Date()) return false; // ya empezó: no tiene sentido confirmarlo
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

// ---------------------------------------------------------------------
// Reembolso
// ---------------------------------------------------------------------
// La reserva ya quedó marcada 'reembolso_pendiente' ANTES de llamar acá
// (adentro de la transacción): si la API se cae a mitad de camino, el
// dueño la ve igual en el panel. Primero se mira la orden por si ya
// estaba reembolsada (un intento anterior, o el dueño lo hizo a mano
// desde Mercado Pago) para no pedir dos veces lo mismo.
async function intentarReembolso(reservaId, ordenId) {
  try {
    const orden = await obtenerOrden(ordenId);
    if (!esReembolsada(orden)) {
      try {
        await reembolsarOrden(ordenId);
      } catch (err) {
        // Otra llamada en paralelo ya lo devolvió: está bien igual.
        if (!(err instanceof ErrorMP && err.codigo === 'order_already_refunded')) throw err;
      }
    }
    await pool.query(
      `UPDATE reservas SET pago_estado = 'reembolsado'
       WHERE id = $1 AND pago_estado = 'reembolso_pendiente'`,
      [reservaId]
    );
  } catch (err) {
    // Queda 'reembolso_pendiente' para que el dueño lo vea en el panel.
    console.error(`Reembolso de la reserva ${reservaId} falló: ${err.message}`);
  }
}

// ---------------------------------------------------------------------
// verificarPago: la única función que decide si una reserva está paga
// ---------------------------------------------------------------------
// La llaman la vuelta del jugador (GET /reservas/estado/:token), el
// webhook y el panel. Nunca recibe "cómo salió el pago" de afuera:
// siempre le pregunta a Mercado Pago por la orden guardada en la
// reserva. Es idempotente: si ya está aprobada o reembolsada, no hace
// nada; si dos llamadas llegan juntas, el lock por cancha las pone en
// fila y la segunda ve lo que dejó la primera.
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

  // Afuera del lock: es un pedido HTTP y no queremos frenar otras
  // reservas de la cancha mientras esperamos a Mercado Pago.
  const orden = await obtenerOrden(inicial.mp_order_id);
  const resultado = leerOrden(orden);

  if (resultado === 'pendiente') return;

  if (resultado === 'rechazada') {
    // No se cancela la reserva: con Checkout Pro el jugador puede
    // reintentar con otro medio, y si al final paga, la próxima
    // verificación la confirma. Si no, vence sola como cualquier retenida.
    await pool.query(`UPDATE reservas SET pago_estado = 'rechazado' WHERE id = $1 AND pago_estado = 'pendiente'`, [
      inicial.id,
    ]);
    return;
  }

  if (resultado === 'reembolsada') {
    // Alguien la reembolsó desde Mercado Pago antes de que la viéramos.
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

    // Otra llamada ya lo resolvió mientras esperábamos el lock.
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
      // No debería pasar nunca (la orden la armó el servidor con este
      // monto), pero si pasa no se confirma: se devuelve la plata.
      console.error(`La orden de la reserva ${reserva.id} no coincide en monto, moneda o referencia`);
      return pedirReembolso();
    }

    if (!(await turnoDisponiblePara(client, reserva))) {
      return pedirReembolso();
    }

    // La exclusion constraint es la red de seguridad: si igual chocara
    // con otra reserva, se trata como turno ocupado.
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
    // Sin await: el mail no tiene por qué demorar la respuesta, y
    // enviarConfirmacion nunca tira error (ver mail.js).
    enviarConfirmacion(inicial.id);
  }
}

module.exports = { generarToken, hashToken, RE_TOKEN, SQL_MONTO_A_PAGAR, verificarPago };
