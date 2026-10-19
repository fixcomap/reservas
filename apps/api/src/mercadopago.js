const crypto = require('crypto');

// Cliente de la API de Órdenes de Mercado Pago (Checkout Pro).
// El access token nunca se loguea ni se manda al front.

const BASE = 'https://api.mercadopago.com';
const TIMEOUT_MS = 15000;

class ErrorMP extends Error {
  constructor(mensaje, status, codigo) {
    super(mensaje);
    this.name = 'ErrorMP';
    this.status = status; // status HTTP de Mercado Pago, o 0 si no hubo respuesta
    this.codigo = codigo; // código de error de Mercado Pago (ej: 'order_already_refunded')
  }
}

function accessToken() {
  const token = process.env.MP_ACCESS_TOKEN;
  if (!token) throw new ErrorMP('Falta MP_ACCESS_TOKEN', 0, 'sin_credenciales');
  return token;
}

async function pedir(metodo, ruta, { cuerpo, idempotencia } = {}) {
  const headers = {
    Authorization: `Bearer ${accessToken()}`,
    'Content-Type': 'application/json',
  };
  if (idempotencia) headers['X-Idempotency-Key'] = idempotencia;

  let respuesta;
  try {
    respuesta = await fetch(BASE + ruta, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ErrorMP(`Sin respuesta de Mercado Pago (${err.name})`, 0, 'sin_respuesta');
  }

  const datos = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const primero = datos?.errors?.[0];
    const codigo = primero?.code || datos?.error || 'desconocido';
    throw new ErrorMP(
      `Mercado Pago respondió ${respuesta.status} (${codigo}${primero?.message ? `: ${primero.message}` : ''})`,
      respuesta.status,
      codigo
    );
  }
  return datos;
}

// 20000 -> "20000.00"
function aTextoMP(pesos) {
  return Number(pesos).toFixed(2);
}

// "20000.00" -> 2000000 (centavos)
function aCentavos(valor) {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

// Crea la orden y devuelve { id, checkout_url }
async function crearOrden({ reservaId, monto, titulo, urlRetorno, venceEnMinutos, idempotencia }) {
  const precio = aTextoMP(monto);
  const cuerpo = {
    type: 'online',
    processing_mode: 'manual',
    total_amount: precio,
    external_reference: String(reservaId),
    expiration_time: `PT${venceEnMinutos}M`,
    description: titulo,
    items: [{ title: titulo, unit_price: precio, quantity: 1 }],
    config: {
      online: {
        success_url: urlRetorno,
        failure_url: urlRetorno,
        pending_url: urlRetorno,
        auto_return: 'approved',
      },
    },
  };

  let orden;
  try {
    orden = await pedir('POST', '/v1/orders', { cuerpo, idempotencia });
  } catch (err) {
    // Un reintento con la misma clave de idempotencia
    if (err instanceof ErrorMP && (err.status === 0 || err.status >= 500)) {
      orden = await pedir('POST', '/v1/orders', { cuerpo, idempotencia });
    } else {
      throw err;
    }
  }

  if (!orden?.id || !orden?.checkout_url) {
    throw new ErrorMP('Mercado Pago no devolvió el id o la URL de pago', 0, 'respuesta_incompleta');
  }
  return { id: orden.id, checkout_url: orden.checkout_url };
}

function obtenerOrden(ordenId) {
  return pedir('GET', `/v1/orders/${encodeURIComponent(ordenId)}`);
}

// Reembolso total
function reembolsarOrden(ordenId) {
  return pedir('POST', `/v1/orders/${encodeURIComponent(ordenId)}/refund`, {
    idempotencia: crypto.randomUUID(),
  });
}

module.exports = { ErrorMP, crearOrden, obtenerOrden, reembolsarOrden, aCentavos };
