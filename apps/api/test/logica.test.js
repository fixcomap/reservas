const test = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { firmaValida } = require('../src/webhookMercadoPago');
const { escaparHtml } = require('../src/mail');
const { aCentavos } = require('../src/mercadopago');
const { generarToken, hashToken, RE_TOKEN } = require('../src/pagos');
const { calcularSenia, diaSemanaDe } = require('../src/turnos');
const { leerRango } = require('../src/proxy');

const SECRETO = 'secreto-de-prueba';
const firmar = (manifest) => crypto.createHmac('sha256', SECRETO).update(manifest).digest('hex');

test('webhook de Mercado Pago: solo vale la firma correcta del mismo pago', () => {
  const v1 = firmar('id:abc123;request-id:req-1;ts:1700000000;');
  const ok = { firma: `ts=1700000000,v1=${v1}`, requestId: 'req-1', dataId: 'ABC123', secreto: SECRETO };
  assert.strictEqual(firmaValida(ok), true);
  assert.strictEqual(firmaValida({ ...ok, dataId: 'otro' }), false);
  assert.strictEqual(firmaValida({ ...ok, requestId: 'req-2' }), false);
  assert.strictEqual(firmaValida({ ...ok, secreto: 'otro' }), false);
  assert.strictEqual(firmaValida({ ...ok, firma: 'ts=1700000000,v1=zzz' }), false);
  assert.strictEqual(firmaValida({ ...ok, firma: '' }), false);
});

test('emails: el HTML de los datos del usuario se escapa', () => {
  assert.strictEqual(escaparHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  assert.strictEqual(escaparHtml("O'Brien & Cía"), 'O&#39;Brien &amp; Cía');
  assert.strictEqual(escaparHtml(null), '');
});

test('importes en centavos', () => {
  assert.strictEqual(aCentavos('1500.5'), 150050);
  assert.strictEqual(aCentavos(0.1 + 0.2), 30);
  assert.strictEqual(aCentavos(''), null);
  assert.strictEqual(aCentavos('abc'), null);
});

test('token de pago: al azar, con formato fijo, y en la base solo su hash', () => {
  const t = generarToken();
  assert.match(t, RE_TOKEN);
  assert.notStrictEqual(t, generarToken());
  assert.match(hashToken(t), /^[0-9a-f]{64}$/);
  assert.strictEqual(hashToken(t), hashToken(t));
});

test('seña y día de la semana', () => {
  assert.strictEqual(calcularSenia(25000, 30), 7500);
  assert.strictEqual(calcularSenia(999, 50), 500);
  assert.strictEqual(diaSemanaDe('2026-10-27'), 2); // martes
  assert.strictEqual(diaSemanaDe('2026-11-01'), 0); // domingo
});

test('rangos de proxies de confianza', () => {
  assert.deepStrictEqual(leerRango('10.0.0.0/8'), { ip: '10.0.0.0', tipo: 'ipv4', bits: 8 });
  assert.deepStrictEqual(leerRango('2001:db8::1'), { ip: '2001:db8::1', tipo: 'ipv6' });
  assert.strictEqual(leerRango('10.0.0.0/33'), null);
  assert.strictEqual(leerRango('no-es-ip'), null);
  assert.strictEqual(leerRango('10.0.0.0/8/1'), null);
});
