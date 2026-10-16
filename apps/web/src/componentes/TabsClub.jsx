import { useRef } from 'react';

// Pestañas "Reservas" / "Detalles del club" para celular y tablet
// (desde 1024px, estilos.css las oculta: ahí las dos secciones van
// una debajo de la otra sin pestañas). Patrón de teclado estándar de
// WAI-ARIA para tabs con activación automática: las flechas mueven el
// foco Y cambian la pestaña activa al mismo tiempo.
const PESTANIAS = [
  { id: 'reservas', etiqueta: 'Reservas' },
  { id: 'detalles', etiqueta: 'Detalles del club' },
];

export default function TabsClub({ seccion, onCambiar }) {
  const botones = useRef({});

  function alPresionarTecla(evento, indiceActual) {
    let indiceNuevo = null;
    if (evento.key === 'ArrowRight' || evento.key === 'ArrowDown') {
      indiceNuevo = (indiceActual + 1) % PESTANIAS.length;
    } else if (evento.key === 'ArrowLeft' || evento.key === 'ArrowUp') {
      indiceNuevo = (indiceActual - 1 + PESTANIAS.length) % PESTANIAS.length;
    } else if (evento.key === 'Home') {
      indiceNuevo = 0;
    } else if (evento.key === 'End') {
      indiceNuevo = PESTANIAS.length - 1;
    } else {
      return;
    }
    evento.preventDefault();
    const siguiente = PESTANIAS[indiceNuevo].id;
    onCambiar(siguiente);
    botones.current[siguiente]?.focus();
  }

  return (
    <div className="tabs-club" role="tablist" aria-label="Secciones de la pantalla">
      {PESTANIAS.map((p, indice) => {
        const activa = seccion === p.id;
        return (
          <button
            key={p.id}
            ref={(el) => {
              botones.current[p.id] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${p.id}`}
            aria-selected={activa}
            aria-controls={`panel-${p.id}`}
            tabIndex={activa ? 0 : -1}
            className={`tab-club${activa ? ' es-activa' : ''}`}
            onClick={() => onCambiar(p.id)}
            onKeyDown={(e) => alPresionarTecla(e, indice)}
          >
            {/* Span propio para que la línea de la pestaña activa (ver
                estilos.css) mida el ancho del texto, no el de la mitad
                de pantalla que ocupa el botón. */}
            <span className="tab-club-texto">{p.etiqueta}</span>
          </button>
        );
      })}
    </div>
  );
}
