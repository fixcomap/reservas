const crypto = require('crypto');

// Único lugar de la API que habla con Mercado Pago (Checkout Pro vía la
// API de Órdenes: https://api.mercadopago.com/v1/orders).
//
// El access token se lee de process.env y solo viaja en el header
// Authorization hacia Mercado Pago: nunca se loguea, nunca se devuelve
// al front. Si algo falla, los errores que se loguean llevan el status
// HTTP y el código de error de Mercado Pago, nada más.

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
  if (!token) throw new ErrorMP('Falta MP_ACCESS_TOKEN en el .env', 0, 'sin_credenciales');
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
    // La API de Órdenes devuelve { errors: [{ code, message }] }.
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

// Montos: en la base son pesos enteros; Mercado Pago los quiere como
// texto con dos decimales ("20000.00") y los devuelve igual.
function aTextoMP(pesos) {
  return Number(pesos).toFixed(2);
}

// "20000.00" -> 2000000 (centavos), para comparar sin errores de coma
// flotante. null si no es un número.
function aCentavos(valor) {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

// Crea la orden de Checkout Pro y devuelve { id, checkout_url }.
// `idempotencia` tiene que ser la misma si se reintenta el mismo pedido:
// así Mercado Pago no crea dos órdenes para una misma reserva.
async function crearOrden({ reservaId, monto, titulo, urlRetorno, venceEnMinutos, idempotencia }) {
  const precio = aTextoMP(monto);
  const cuerpo = {
    type: 'online',
    processing_mode: 'manual',
    total_amount: precio,
    external_reference: String(reservaId),
    // Duración ISO 8601, igual a la retención del turno.
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
    // Un solo reintento, con la MISMA clave, si no hubo respuesta o fue
    // un error de su lado: si la primera sí llegó a crear la orden,
    // Mercado Pago no crea otra.
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

// Reembolso total (cuerpo vacío = devolver todo lo cobrado).
function reembolsarOrden(ordenId) {
  return pedir('POST', `/v1/orders/${encodeURIComponent(ordenId)}/refund`, {
    idempotencia: crypto.randomUUID(),
  });
}

module.exports = { ErrorMP, crearOrden, obtenerOrden, reembolsarOrden, aCentavos };
