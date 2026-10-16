// wa.me necesita el teléfono completo, sin el "+" ni espacios ni
// guiones. Acá los clientes se cargan como "11 1234 5678" (sin código
// de país), así que si no viene uno ya puesto le agregamos el 54 de
// Argentina. Si alguna vez se carga un número de otro país con su
// propio código, esto podría agregarle un 54 de más: es una
// simplificación a propósito, no una validación de números reales.
export function linkWhatsApp(telCrudo) {
  const digitos = String(telCrudo || '').replace(/\D/g, '');
  if (!digitos) return null;
  const conCodigo = digitos.startsWith('54') ? digitos : `54${digitos}`;
  return `https://wa.me/${conCodigo}`;
}

// Formato de pesos para montos reales del panel (total de una reserva,
// lo pagado hasta ahora...). A diferencia de src/precios.js (la del
// jugador), acá el 0 es un valor real — "pagado: $0" porque todavía no
// se integró Mercado Pago — y no "todavía no hay precio cargado", así
// que nunca lo cambiamos por un texto como "Consultar".
export function formatearPesos(monto) {
  const numero = Number(monto);
  if (!Number.isFinite(numero)) return '—';
  return '$' + numero.toLocaleString('es-AR');
}
