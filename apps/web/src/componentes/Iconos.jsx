// Íconos dibujados a mano en SVG para no sumar una librería entera.
// Son decorativos: los marcamos aria-hidden y el texto de al lado explica
// qué hace cada botón.

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export function IconoPersona({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <circle cx="12" cy="8" r="3.4" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" />
    </svg>
  );
}

export function IconoPin({ tamanio = 14 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export function IconoCalendario({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
      <path d="M3.5 9.5h17M8 3.2v3.4M16 3.2v3.4" />
    </svg>
  );
}

export function IconoCompartir({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <circle cx="18" cy="5.5" r="2.6" />
      <circle cx="6" cy="12" r="2.6" />
      <circle cx="18" cy="18.5" r="2.6" />
      <path d="m8.4 10.7 7.2-3.9M8.4 13.3l7.2 3.9" />
    </svg>
  );
}

export function IconoReloj({ tamanio = 16 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.2l3.2 2" />
    </svg>
  );
}

export function IconoFlechaAtras({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M14.5 5 7.5 12l7 7" />
    </svg>
  );
}

export function IconoTilde({ tamanio = 34 }) {
  return (
    <svg {...base} strokeWidth={2.6} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="m5.5 12.5 4.3 4.3 8.7-9.1" />
    </svg>
  );
}
