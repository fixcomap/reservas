// Si una cancha todavía no tiene precio cargado (0, o algo raro), no
// mostramos "$0": invitamos a preguntar en vez de prometer algo gratis.
// Para el precio de la cancha nomás: nunca para un monto ya calculado
// (seña, resto...), donde $0 puede ser una respuesta real y válida.
export function formatearPrecio(precio) {
  const numero = Number(precio);
  if (!Number.isFinite(numero) || numero <= 0) return 'Consultar';
  return '$' + numero.toLocaleString('es-AR');
}

// Para montos ya calculados (resto a pagar, seña...), donde $0 es una
// respuesta válida (ej: elegiste pagar el total, no queda resto) y no
// una señal de "todavía no hay precio cargado".
export function formatearMonto(monto) {
  const numero = Number(monto) || 0;
  return '$' + numero.toLocaleString('es-AR');
}
