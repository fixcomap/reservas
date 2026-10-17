const crypto = require('crypto');
const pool = require('./db');
const { verificarPago } = require('./pagos');

// POST /webhooks/mercadopago
//
// Mercado Pago avisa acá cuando cambia una orden. El aviso NO se usa
// para decidir nada: solo dice "fijate la orden X". Lo que se hace con
// eso es lo mismo que cuando vuelve el jugador: verificarPago(), que le
// pregunta a Mercado Pago por la orden.
//
// La firma (header x-signature) prueba que el aviso lo mandó Mercado
// Pago y no cualquiera que conozca la URL. Formato, según la
// documentación de notificaciones de Checkout Pro (Orders):
//   x-signature: ts=<timestamp>,v1=<hmac>
//   manifest:    id:<data.id en minúsculas>;request-id:<x-request-id>;ts:<ts>;
//   v1 = HMAC-SHA256(manifest, MP_WEBHOOK_SECRET) en hexadecimal
// Si el aviso no trae data.id o x-request-id, esa parte se saca del
// manifest.

function leerFirma(header) {
  const partes = {};
  for (const parte of String(header || '').split(',')) {
    const i = parte.indexOf('=');
    if (i > 0) partes[parte.slice(0, i).trim()] = parte.slice(i + 1).trim();
  }
  return partes;
}

function firmaValida({ firma, requestId, dataId, secreto }) {
  const { ts, v1 } = leerFirma(firma);
  if (!ts || !/^[0-9a-f]{64}$/i.test(v1 || '')) return false;

  let manifest = '';
  if (dataId) manifest += `id:${dataId.toLowerCase()};`;
  if (requestId) manifest += `request-id:${requestId};`;
  manifest += `ts:${ts};`;

  const esperado = crypto.createHmac('sha256', secreto).update(manifest).digest();
  // timingSafeEqual: comparar sin que el tiempo de respuesta delate
  // cuántos caracteres coincidieron.
  return crypto.timingSafeEqual(esperado, Buffer.from(v1, 'hex'));
}

function textoSimple(valor) {
  return typeof valor === 'string' ? valor : '';
}

async function webhookMercadoPago(req, res) {
  const secreto = process.env.MP_WEBHOOK_SECRET;
  if (!secreto) {
    return res.status(503).json({ error: 'Webhook no configurado' });
  }

  // El id viaja en la query (?data.id=ORD...&type=order); es el que
  // entra en la firma.
  const dataId = textoSimple(req.query['data.id']);
  const tipo = textoSimple(req.query.type) || textoSimple(req.body?.type);

  const valida = firmaValida({
    firma: req.get('x-signature'),
    requestId: req.get('x-request-id'),
    dataId,
    secreto,
  });
  if (!valida) {
    return res.status(401).json({ error: 'Firma inválida' });
  }

  // Responder ya: Mercado Pago espera la respuesta pocos segundos y, si
  // no llega, reintenta. Lo de abajo sigue en segundo plano.
  res.sendStatus(200);

  if (tipo !== 'order' || !dataId) return;

  try {
    const { rows } = await pool.query(
      `SELECT id FROM reservas WHERE upper(mp_order_id) = upper($1) AND origen = 'online'`,
      [dataId]
    );
    if (rows[0]) await verificarPago(rows[0].id);
  } catch (err) {
    console.error(`Webhook: no se pudo verificar la orden ${dataId}: ${err.message}`);
  }
}

module.exports = { webhookMercadoPago, firmaValida };
