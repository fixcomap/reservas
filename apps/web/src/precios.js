// Los datos de demo tienen precio 0. Mientras no haya un precio cargado
// mostramos el mismo placeholder que el diseño, así se ve igual al boceto.
export function formatearPrecio(precio) {
  const numero = Number(precio);
  if (!Number.isFinite(numero) || numero <= 0) return '$[PRECIO]';
  return '$' + numero.toLocaleString('es-AR');
}
