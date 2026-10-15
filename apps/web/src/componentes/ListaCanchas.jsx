import { DURACION_MIN } from '../config.js';
import { formatearPrecio } from '../precios.js';

// Canchas que están libres en el horario elegido.
export default function ListaCanchas({ hora, canchas, canchaElegidaId, onElegir }) {
  return (
    <section className="bloque">
      <h2 className="titulo-seccion">Canchas libres · {hora}</h2>
      <ul className="lista-canchas">
        {canchas.map((cancha) => {
          const elegida = cancha.id === canchaElegidaId;
          return (
            <li key={cancha.id}>
              <button
                type="button"
                className={`cancha-card${elegida ? ' es-elegido' : ''}`}
                aria-pressed={elegida}
                onClick={() => onElegir(cancha.id)}
              >
                <span className="cancha-datos">
                  <span className="cancha-nombre">{cancha.nombre}</span>
                  <span className="cancha-descripcion">{cancha.descripcion}</span>
                </span>
                <span className="cancha-precio">
                  <span className="cancha-precio-monto">{formatearPrecio(cancha.precio)}</span>
                  <span className="cancha-precio-duracion">{DURACION_MIN} min</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
