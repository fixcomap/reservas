// Configuración desde variables de entorno.
// En desarrollo se lee el .env de la raíz y hay valores por defecto para local.
// En producción (NODE_ENV=production) no hay valores por defecto: si falta una
// variable obligatoria, la API no arranca y dice cuál falta (nunca el valor).
const path = require('path');
const { leerRango } = require('./proxy');

// En Cloud Run NODE_ENV=production ya viene del entorno y no hay .env que leer
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
}

const ES_PRODUCCION = process.env.NODE_ENV === 'production';

const OBLIGATORIAS_EN_PRODUCCION = ['DATABASE_URL', 'FRONT_URL', 'API_URL', 'MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET'];

class ErrorConfig extends Error {}

function leer(nombre) {
  const valor = process.env[nombre];
  return valor && valor.trim() ? valor.trim() : '';
}

// "https://reservas.fixcomap.com/" -> "https://reservas.fixcomap.com"
function origenHttps(nombre) {
  let url;
  try {
    url = new URL(leer(nombre));
  } catch {
    throw new ErrorConfig(`${nombre} no es una URL válida`);
  }
  if (url.protocol !== 'https:') throw new ErrorConfig(`${nombre} tiene que empezar con https://`);
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new ErrorConfig(`${nombre} tiene que ser solo el origen, sin ruta (ej: https://dominio.com)`);
  }
  return url.origin;
}

// En producción siempre con SSL y verificando el certificado,
// diga lo que diga sslmode en la URL
function conexionProduccion() {
  let url;
  try {
    url = new URL(leer('DATABASE_URL'));
  } catch {
    throw new ErrorConfig('DATABASE_URL no es una URL válida');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new ErrorConfig('DATABASE_URL tiene que empezar con postgresql://');
  }
  for (const p of ['sslmode', 'uselibpqcompat', 'sslrootcert', 'sslcert', 'sslkey']) {
    url.searchParams.delete(p);
  }
  return { connectionString: url.toString(), ssl: { rejectUnauthorized: true } };
}

// En local: DATABASE_URL si está; si no, el Postgres del docker-compose
function conexionDesarrollo() {
  if (leer('DATABASE_URL')) return { connectionString: leer('DATABASE_URL') };
  return {
    host: process.env.DB_HOST || 'localhost',
    port: 5432,
    user: 'reservas',
    database: 'reservas',
    password: process.env.POSTGRES_PASSWORD,
  };
}

// Lista de IPs o rangos separados por coma (ej: la IP de un balanceador externo)
function listaDeRangos(nombre) {
  const rangos = leer(nombre)
    .split(',')
    .map((r) => r.trim())
    .filter(Boolean);
  if (rangos.some((r) => !leerRango(r))) {
    throw new ErrorConfig(`${nombre} tiene un valor que no es una IP o rango válido (ej: 34.1.2.3 o 34.1.2.0/24)`);
  }
  return rangos;
}

function cargar() {
  if (ES_PRODUCCION) {
    const faltan = OBLIGATORIAS_EN_PRODUCCION.filter((n) => !leer(n));
    if (faltan.length > 0) {
      throw new ErrorConfig(`Faltan variables de entorno obligatorias: ${faltan.join(', ')}`);
    }
  }

  const puerto = Number(process.env.PORT || process.env.API_PORT || 3000);
  if (!Number.isInteger(puerto) || puerto <= 0 || puerto > 65535) {
    throw new ErrorConfig('PORT tiene que ser un número de puerto válido');
  }

  return {
    esProduccion: ES_PRODUCCION,
    puerto,
    clubId: Number(process.env.CLUB_ID || 1),
    db: ES_PRODUCCION ? conexionProduccion() : conexionDesarrollo(),
    // Adónde vuelve el jugador después de pagar, y único origen aceptado por CORS
    frontUrl: ES_PRODUCCION ? origenHttps('FRONT_URL') : (leer('FRONT_URL') || 'http://localhost:5173').replace(/\/$/, ''),
    // URL pública de la API (para armar la del webhook)
    apiUrl: ES_PRODUCCION ? origenHttps('API_URL') : (leer('API_URL') || 'http://localhost:3000').replace(/\/$/, ''),
    proxiesConfiables: listaDeRangos('PROXIES_CONFIABLES'),
  };
}

let config;
try {
  config = cargar();
} catch (err) {
  if (!(err instanceof ErrorConfig)) throw err;
  console.error(`Configuración inválida: ${err.message}`);
  process.exit(1);
}

config.urlWebhookMercadoPago = `${config.apiUrl}/webhooks/mercadopago`;

module.exports = config;
