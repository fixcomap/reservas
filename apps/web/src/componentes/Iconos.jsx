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

export function IconoCruz({ tamanio = 34 }) {
  return (
    <svg {...base} strokeWidth={2.6} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M7 7l10 10M17 7 7 17" />
    </svg>
  );
}

// ===========================================================
// Sección "Dónde estamos" (info del club): contacto y servicios
// ===========================================================

export function IconoWhatsApp({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M6.5 17.5 4.8 19l.9-3.1a7.6 7.6 0 1 1 2.7 2.4l-1.9-.8Z" />
      <path d="M9 10.3c0 3 2.7 5.5 5.7 5.5.5 0 .9-.6.7-1.1l-.5-1.1a.8.8 0 0 0-.9-.4l-1 .3a4.6 4.6 0 0 1-2.5-2.5l.3-1a.8.8 0 0 0-.4-.9l-1.1-.5c-.5-.2-1 .2-1.1.7a2 2 0 0 0-.2.9Z" />
    </svg>
  );
}

export function IconoInstagram({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.1" cy="6.9" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// Los 13 íconos de servicios de acá abajo son trazos de Tabler Icons
// (MIT), copiados en línea tal cual los pide la tarea: sin instalar la
// librería, solo el SVG de cada ícono adentro de nuestro propio
// componente, reusando el mismo `base` (trazo, grosor y tamaño) que el
// resto de los íconos de la app para que no se note la diferencia.
// Ver THIRD_PARTY_LICENSES.md para la licencia completa y el detalle de
// qué ícono de Tabler es cada uno.

export function IconoWifi({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M12 18l.01 0" />
      <path d="M9.172 15.172a4 4 0 0 1 5.656 0" />
      <path d="M6.343 12.343a8 8 0 0 1 11.314 0" />
      <path d="M3.515 9.515c4.686 -4.687 12.284 -4.687 17 0" />
    </svg>
  );
}

export function IconoVestuario({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M14 6a2 2 0 1 0 -4 0c0 1.667 .67 3 2 4h-.008l7.971 4.428a2 2 0 0 1 1.029 1.749v.823a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-.823a2 2 0 0 1 1.029 -1.749l7.971 -4.428" />
    </svg>
  );
}

export function IconoGimnasio({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M7.026 9.61l-.95 -4.18a2 2 0 0 1 1.95 -2.43h8a2 2 0 0 1 2 2.43l-1 4.2" />
      <path d="M9.026 17.001h6" />
      <path d="M18.906 20.06a7.92 7.92 0 0 0 1 -5.33a8 8 0 1 0 -14.77 5.33a2 2 0 0 0 1.71 .94h10.36a2 2 0 0 0 1.7 -.94" />
    </svg>
  );
}

export function IconoEstacionamiento({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14" />
      <path d="M10 16v-8h2.667c.736 0 1.333 .895 1.333 2s-.597 2 -1.333 2h-2.667" />
    </svg>
  );
}

export function IconoAyudaMedica({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M8 8v-2a2 2 0 0 1 2 -2h4a2 2 0 0 1 2 2v2" />
      <path d="M4 10a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2l0 -8" />
      <path d="M10 14h4" />
      <path d="M12 12v4" />
    </svg>
  );
}

export function IconoTorneos({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M8 21l8 0" />
      <path d="M12 17l0 4" />
      <path d="M7 4l10 0" />
      <path d="M17 4v8a5 5 0 0 1 -10 0v-8" />
      <path d="M3 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
      <path d="M17 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
    </svg>
  );
}

export function IconoCumpleanos({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M3 20h18v-8a3 3 0 0 0 -3 -3h-12a3 3 0 0 0 -3 3v8" />
      <path d="M3 14.803c.312 .135 .654 .204 1 .197a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1a2.4 2.4 0 0 0 2 -1a2.4 2.4 0 0 1 2 -1a2.4 2.4 0 0 1 2 1a2.4 2.4 0 0 0 2 1c.35 .007 .692 -.062 1 -.197" />
      <path d="M12 4l1.465 1.638a2 2 0 1 1 -3.015 .099l1.55 -1.737" />
    </svg>
  );
}

export function IconoParrilla({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M19 8h-14a6 6 0 0 0 6 6h2a6 6 0 0 0 6 -5.775l0 -.225" />
      <path d="M17 20a2 2 0 1 1 0 -4a2 2 0 0 1 0 4" />
      <path d="M15 14l1 2" />
      <path d="M9 14l-3 6" />
      <path d="M15 18h-8" />
      <path d="M15 5v-1" />
      <path d="M12 5v-1" />
      <path d="M9 5v-1" />
    </svg>
  );
}

export function IconoEscuelita({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M4 17a3 3 0 0 0 3 3" />
      <path d="M14.805 6.37l2.783 -2.784a2 2 0 1 1 2.829 2.828l-2.784 2.786" />
      <path d="M16.505 7.495a5.105 5.105 0 0 1 .176 7.035l-.176 .184l-1.867 1.867a3.48 3.48 0 0 0 -1.013 2.234l-.008 .23v.934c0 .327 -.13 .64 -.36 .871a.51 .51 0 0 1 -.652 .06l-.07 -.06l-9.385 -9.384a.51 .51 0 0 1 0 -.722c.198 -.198 .456 -.322 .732 -.353l.139 -.008h.933c.848 0 1.663 -.309 2.297 -.864l.168 -.157l1.867 -1.867l.16 -.153a5.105 5.105 0 0 1 7.059 .153" />
    </svg>
  );
}

export function IconoColegios({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M22 9l-10 -4l-10 4l10 4l10 -4v6" />
      <path d="M6 10.6v5.4a6 3 0 0 0 12 0v-5.4" />
    </svg>
  );
}

export function IconoBarRestaurante({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M19 3v12h-5c-.023 -3.681 .184 -7.406 5 -12m0 12v6h-1v-3m-10 -14v17m-3 -17v3a3 3 0 1 0 6 0v-3" />
    </svg>
  );
}

export function IconoQuincho({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M3 21h7v-3a2 2 0 0 1 4 0v3h7" />
      <path d="M6 21l0 -9" />
      <path d="M18 21l0 -9" />
      <path d="M6 12h12a3 3 0 0 0 3 -3a9 8 0 0 1 -9 -6a9 8 0 0 1 -9 6a3 3 0 0 0 3 3" />
    </svg>
  );
}

// Tabler no tiene un ícono de paleta de pádel: "ping-pong" (raqueta +
// pelota) es el más parecido que tiene la librería.
export function IconoPaletas({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <path d="M12.718 20.713a7.64 7.64 0 0 1 -7.48 -12.755l.72 -.72a7.643 7.643 0 0 1 9.105 -1.283l2.387 -2.345a2.08 2.08 0 0 1 3.057 2.815l-.116 .126l-2.346 2.387a7.644 7.644 0 0 1 -1.052 8.864" />
      <path d="M11 18a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
      <path d="M9.3 5.3l9.4 9.4" />
    </svg>
  );
}

export function IconoServicio({ tamanio = 20 }) {
  return (
    <svg {...base} width={tamanio} height={tamanio} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.8 12.3 2.2 2.2 4.2-4.6" />
    </svg>
  );
}
