// Íconos propios del panel, dibujados a mano en SVG (mismo criterio que
// src/componentes/Iconos.jsx: nada de librerías de íconos).

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
};

export function IconoCampana({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M6 10a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14 6 10Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconoSalir({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M15 7.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1.5" />
      <path d="M9 12h11m0 0-3-3m3 3-3 3" />
    </svg>
  );
}

export function IconoFlechaIzquierda({ tamanio = 18 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M15 5.5 8.5 12l6.5 6.5" />
    </svg>
  );
}

export function IconoFlechaDerecha({ tamanio = 18 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M9 5.5 15.5 12 9 18.5" />
    </svg>
  );
}

export function IconoTurnosFijos({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M4 7h13.5L15 4.5M20 17H6.5L9 19.5" />
    </svg>
  );
}

export function IconoClientes({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
      <circle cx="17" cy="9.5" r="2.4" />
      <path d="M15.5 13a4.5 4.5 0 0 1 5 4.4" />
    </svg>
  );
}

export function IconoAjustes({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.9-1.3-2-3.4-2.2.7a7.7 7.7 0 0 0-2.6-1.5L14 2.5h-4l-.5 2.5a7.7 7.7 0 0 0-2.6 1.5l-2.2-.7-2 3.4L4.6 10.5a7.7 7.7 0 0 0 0 3L2.7 14.8l2 3.4 2.2-.7a7.7 7.7 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.7 7.7 0 0 0 2.6-1.5l2.2.7 2-3.4-1.9-1.3Z" />
    </svg>
  );
}

export function IconoCandado({ tamanio = 18 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <rect x="5" y="10.5" width="14" height="9.5" rx="2.2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function IconoChat({ tamanio = 18 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M4 12a8 8 0 1 1 3.3 6.4L4 19.5l1.2-3.1A7.9 7.9 0 0 1 4 12Z" />
      <path d="M9 11h6M9 14h4" />
    </svg>
  );
}

export function IconoX({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}
