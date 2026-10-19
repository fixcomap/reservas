const net = require('net');

// IP real del cliente detrás de Cloudflare + Google (Cloud Run).
//
// Cada proxy agrega a X-Forwarded-For la IP desde la que le llegó el pedido.
// Express la recorre de derecha a izquierda y se queda con la primera IP en la
// que NO confía. Confiamos solo en:
//   - el salto 0: quien abre la conexión con el contenedor (la infraestructura
//     de Google; el contenedor no es accesible de otra forma),
//   - las IPs publicadas de Cloudflare (https://www.cloudflare.com/ips/),
//   - los rangos de PROXIES_CONFIABLES (por ejemplo, un balanceador externo).
// Lo que mande el cliente en X-Forwarded-For queda a la izquierda y nunca se usa.
// Si alguien entra directo a la URL *.run.app sin pasar por Cloudflare, la IP
// que agrega Google es la suya (no es de Cloudflare) y se usa esa.

// Actualizado de https://www.cloudflare.com/ips-v4 y /ips-v6 (octubre 2026)
const RANGOS_CLOUDFLARE = [
  '173.245.48.0/20',
  '103.21.244.0/22',
  '103.22.200.0/22',
  '103.31.4.0/22',
  '141.101.64.0/18',
  '108.162.192.0/18',
  '190.93.240.0/20',
  '188.114.96.0/20',
  '197.234.240.0/22',
  '198.41.128.0/17',
  '162.158.0.0/15',
  '104.16.0.0/13',
  '104.24.0.0/14',
  '172.64.0.0/13',
  '131.0.72.0/22',
  '2400:cb00::/32',
  '2606:4700::/32',
  '2803:f800::/32',
  '2405:b500::/32',
  '2405:8100::/32',
  '2a06:98c0::/29',
  '2c0f:f248::/32',
];

function tipoDeIp(ip) {
  if (net.isIPv4(ip)) return 'ipv4';
  if (net.isIPv6(ip)) return 'ipv6';
  return null;
}

// "1.2.3.0/24" o "1.2.3.4"; null si no es válido
function leerRango(texto) {
  const [ip, bits, ...resto] = texto.split('/');
  const tipo = tipoDeIp(ip);
  if (!tipo || resto.length > 0) return null;
  if (bits === undefined) return { ip, tipo };
  const n = Number(bits);
  if (!/^\d+$/.test(bits) || n > (tipo === 'ipv4' ? 32 : 128)) return null;
  return { ip, tipo, bits: n };
}

// Función para app.set('trust proxy', ...)
function crearConfianzaProxy(extras = []) {
  const confiables = new net.BlockList();
  for (const texto of [...RANGOS_CLOUDFLARE, ...extras]) {
    const rango = leerRango(texto);
    if (!rango) throw new Error(`Rango de IP inválido: ${texto}`);
    if (rango.bits === undefined) confiables.addAddress(rango.ip, rango.tipo);
    else confiables.addSubnet(rango.ip, rango.bits, rango.tipo);
  }

  return (ip, salto) => {
    if (salto === 0) return true;
    const limpia = ip.startsWith('::ffff:') && net.isIPv4(ip.slice(7)) ? ip.slice(7) : ip;
    const tipo = tipoDeIp(limpia);
    return tipo !== null && confiables.check(limpia, tipo);
  };
}

module.exports = { crearConfianzaProxy, leerRango };
