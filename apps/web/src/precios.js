// Precio de una cancha: "Consultar" si no tiene precio cargado
export function formatearPrecio(precio) {
  const numero = Number(precio);
  if (!Number.isFinite(numero) || numero <= 0) return 'Consultar';
  return '$' + numero.toLocaleString('es-AR');
}

// Montos calculados (seña, resto): $0 es válido
export function formatearMonto(monto) {
  const numero = Number(monto) || 0;
  return '$' + numero.toLocaleString('es-AR');
}
