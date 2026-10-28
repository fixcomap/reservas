// Integración: la API de verdad contra Postgres (el pipeline levanta uno y aplica las
// migraciones). Mercado Pago se simula interceptando fetch: nunca sale a la red.
// Sin DATABASE_URL (en local, normalmente) se salta.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');

const conBase = Boolean(process.env.DATABASE_URL);
const CLUB = 9001; // fuera de los serial: no choca con datos de demo
const SECRETO = 'secreto-webhook-prueba';
Object.assign(process.env, { CLUB_ID: String(CLUB), MP_ACCESS_TOKEN: 'prueba', MP_WEBHOOK_SECRET: SECRETO });
const FRONT = 'http://localhost:5173';
// Pasado mañana en la hora del club: el turno está en el futuro aunque el CI corra de noche.
const FECHA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
  .format(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
const DIA = new Date(`${FECHA}T12:00:00Z`).getUTCDay();

// Órdenes de Mercado Pago simuladas: id -> { cuerpo, pago, reembolsada }.
const ordenes = new Map();
function mercadoPago(url, opciones) {
  const { pathname } = new URL(url);
  const [, id, accion] = pathname.match(/^\/v1\/orders(?:\/([^/]+))?(?:\/(refund))?$/) || [];
  const responder = (datos) => new Response(JSON.stringify(datos), { status: 200 });
  if (opciones.method === 'POST' && !id) {
    const nueva = `ORD01PRUEBA${ordenes.size + 1}`;
    ordenes.set(nueva, { cuerpo: JSON.parse(opciones.body), pago: null, reembolsada: false });
    return responder({ id: nueva, checkout_url: `https://mp.example/${nueva}` });
  }
  const o = ordenes.get(id);
  if (!o) return new Response('{}', { status: 404 });
  if (accion === 'refund') {
    o.reembolsada = true;
    return responder({ id, status: 'refunded' });
  }
  return responder({
    id,
    currency: 'ARS',
    external_reference: o.cuerpo.external_reference,
    total_amount: o.cuerpo.total_amount,
    status: o.reembolsada ? 'refunded' : o.pago ? 'processed' : 'created',
    status_detail: o.reembolsada ? 'refunded' : o.pago ? 'accredited' : 'created',
    total_paid_amount: o.pago,
    transactions: { payments: o.pago ? [{ id: `PAY-${id}`, status: 'processed' }] : [] },
  });
}

test('API contra Postgres', { skip: !conBase && 'sin DATABASE_URL' }, async (t) => {
  const fetchReal = globalThis.fetch;
  globalThis.fetch = async (url, opciones = {}) =>
    String(url).startsWith('https://api.mercadopago.com/') ? mercadoPago(String(url), opciones) : fetchReal(url, opciones);

  const pool = require('../src/db');
  const borrarClub = async () => {
    await pool.query('DELETE FROM reservas WHERE cancha_id IN (SELECT id FROM canchas WHERE club_id = $1)', [CLUB]);
    await pool.query('DELETE FROM turnos_fijos WHERE cancha_id IN (SELECT id FROM canchas WHERE club_id = $1)', [CLUB]);
    for (const tabla of ['canchas', 'horarios_apertura']) await pool.query(`DELETE FROM ${tabla} WHERE club_id = $1`, [CLUB]);
    await pool.query('DELETE FROM clubes WHERE id = $1', [CLUB]);
  };
  await borrarClub();
  await pool.query(`INSERT INTO clubes (id, nombre, senia_porcentaje) VALUES ($1, 'Club de prueba', 50)`, [CLUB]);
  await pool.query(`INSERT INTO horarios_apertura (club_id, dia_semana, abre, cierra) VALUES ($1, $2, '10:00', '13:00')`, [CLUB, DIA]);
  const { rows: [cancha] } = await pool.query(
    `INSERT INTO canchas (club_id, nombre, duracion_min, precio) VALUES ($1, 'Cancha 1', 60, 20000) RETURNING id`, [CLUB]
  );
  await pool.query(
    `INSERT INTO turnos_fijos (cancha_id, dia_semana, hora_inicio, cliente_nombre, fecha_desde) VALUES ($1, $2, '12:00', 'Fijo', $3)`,
    [cancha.id, DIA, FECHA]
  );

  const app = require('../src/index');
  const servidor = app.listen(0);
  const base = `http://localhost:${servidor.address().port}`;
  t.after(async () => {
    servidor.close();
    globalThis.fetch = fetchReal;
    await borrarClub();
    await pool.end();
  });

  // `origen: null`: servidor a servidor (el webhook de Mercado Pago no manda Origin).
  const pedir = async (ruta, { method = 'GET', body, headers = {}, origen = FRONT } = {}) => {
    const r = await fetchReal(`${base}${ruta}`, {
      method,
      headers: { ...(origen && { Origin: origen }), ...(body !== undefined && { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    });
    return { status: r.status, json: await r.json().catch(() => null) };
  };
  const reservar = (hora, extra = {}) => pedir('/reservas', {
    method: 'POST',
    body: { cancha_id: cancha.id, fecha: FECHA, hora, cliente_nombre: 'Jugador', cliente_tel: '+54 11 5555-0000', cliente_email: 'jugador@ejemplo.com', tipo_pago: 'senia', ...extra },
  });
  const webhook = (ordenId, { firma } = {}) => {
    const ts = String(Date.now());
    const requestId = crypto.randomUUID();
    const v1 = firma ?? crypto.createHmac('sha256', SECRETO).update(`id:${ordenId.toLowerCase()};request-id:${requestId};ts:${ts};`).digest('hex');
    return pedir(`/webhooks/mercadopago?data.id=${ordenId}&type=order`, {
      method: 'POST', body: { type: 'order' }, origen: null, headers: { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': requestId },
    });
  };
  // El webhook responde 200 y verifica en segundo plano: se espera a que la base cambie.
  const esperarPago = async (token, pagoEstado) => {
    for (let i = 0; i < 50; i++) {
      const { rows } = await pool.query('SELECT estado, pago_estado FROM reservas WHERE token_hash = $1', [crypto.createHash('sha256').update(token).digest('hex')]);
      if (rows[0]?.pago_estado === pagoEstado) return rows[0];
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.fail(`la reserva no llegó a pago_estado=${pagoEstado}`);
  };

  await t.test('salud y disponibilidad: el turno fijo no se ofrece', async () => {
    assert.strictEqual((await pedir('/salud')).status, 200);
    const r = await pedir(`/disponibilidad?fecha=${FECHA}`);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.json.senia_porcentaje, 50);
    assert.deepStrictEqual(r.json.canchas[0].turnos, [{ hora: '10:00', libre: true }, { hora: '11:00', libre: true }, { hora: '12:00', libre: false }]);
    assert.strictEqual((await pedir('/disponibilidad?fecha=mañana')).status, 400);
  });

  let pagada;
  await t.test('reservar: la seña la calcula el servidor; turno tomado o fijo 409', async () => {
    assert.strictEqual((await reservar('10:00', { cliente_email: 'no-es-email' })).status, 400);
    const r = await reservar('10:00', { monto_a_pagar: 1 });
    assert.strictEqual(r.status, 201);
    assert.strictEqual(r.json.monto_a_pagar, 10000);
    assert.match(r.json.checkout_url, /^https:\/\/mp\.example\//);
    pagada = { token: r.json.token, orden: [...ordenes.keys()].at(-1) };
    assert.strictEqual(ordenes.get(pagada.orden).cuerpo.total_amount, '10000.00');
    assert.strictEqual((await reservar('10:00')).status, 409);
    assert.strictEqual((await reservar('12:00')).status, 409);
    const libres = (await pedir(`/disponibilidad?fecha=${FECHA}`)).json.canchas[0].turnos.filter((x) => x.libre);
    assert.deepStrictEqual(libres.map((x) => x.hora), ['11:00']);
  });

  await t.test('estado: sin pagar sigue retenida y pendiente', async () => {
    const r = await pedir(`/reservas/estado/${pagada.token}`);
    assert.strictEqual(r.status, 200);
    assert.deepStrictEqual([r.json.estado, r.json.pago_estado], ['retenida', 'pendiente']);
    assert.strictEqual((await pedir(`/reservas/estado/${'x'.repeat(43)}`)).status, 404);
  });

  await t.test('webhook: firma inválida 401; válida y pagada confirma la reserva', async () => {
    ordenes.get(pagada.orden).pago = '10000.00';
    assert.strictEqual((await webhook(pagada.orden, { firma: 'f'.repeat(64) })).status, 401);
    assert.strictEqual((await pedir(`/reservas/estado/${pagada.token}`)).json.pago_estado, 'aprobado',
      'la vuelta del jugador también verifica con Mercado Pago');
    // Idempotente: el webhook después de confirmar no cambia nada.
    assert.strictEqual((await webhook(pagada.orden)).status, 200);
    assert.deepStrictEqual(await esperarPago(pagada.token, 'aprobado'), { estado: 'confirmada', pago_estado: 'aprobado' });
    const r = await pedir(`/reservas/estado/${pagada.token}`);
    assert.strictEqual(r.json.monto_pagado, 10000);
  });

  await t.test('webhook: un pago que no coincide con la reserva se reembolsa', async () => {
    const r = await reservar('11:00', { tipo_pago: 'total' });
    assert.strictEqual(r.json.monto_a_pagar, 20000);
    const orden = [...ordenes.keys()].at(-1);
    ordenes.get(orden).pago = '1.00';
    assert.strictEqual((await webhook(orden)).status, 200);
    assert.deepStrictEqual(await esperarPago(r.json.token, 'reembolsado'), { estado: 'cancelada', pago_estado: 'reembolsado' });
    assert.strictEqual(ordenes.get(orden).reembolsada, true);
  });

  await t.test('CSRF: otro origen 403, cuerpo que no es JSON 415', async () => {
    assert.strictEqual((await pedir('/reservas', { method: 'POST', body: {}, origen: 'https://evil.example' })).status, 403);
    assert.strictEqual((await pedir('/reservas', { method: 'POST', body: 'a=1', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })).status, 415);
  });
});
