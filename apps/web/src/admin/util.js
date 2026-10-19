// Link de wa.me; agrega el 54 de Argentina si falta
export function linkWhatsApp(telCrudo) {
  const digitos = String(telCrudo || '').replace(/\D/g, '');
  if (!digitos) return null;
  const conCodigo = digitos.startsWith('54') ? digitos : `54${digitos}`;
  return `https://wa.me/${conCodigo}`;
}

// 20000 -> "$20.000" (el 0 se muestra como $0)
export function formatearPesos(monto) {
  const numero = Number(monto);
  if (!Number.isFinite(numero)) return '—';
  return '$' + numero.toLocaleString('es-AR');
}

export const TEXTO_PAGO = {
  pendiente: 'Pendiente',
  aprobado: 'Aprobado',
  rechazado: 'Rechazado',
  reembolsado: 'Reembolsado',
  reembolso_pendiente: 'Reembolso pendiente',
};
