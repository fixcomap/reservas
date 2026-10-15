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
