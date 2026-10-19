const crypto = require('crypto');
const pool = require('./db');
const { verificarPago } = require('./pagos');

// POST /webhooks/mercadopago: valida la firma y llama a verificarPago().
// Firma: v1 = HMAC-SHA256("id:<data.id>;request-id:<x-request-id>;ts:<ts>;", MP_WEBHOOK_SECRET)

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

  res.sendStatus(200); // responder rápido; el resto sigue en segundo plano

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
