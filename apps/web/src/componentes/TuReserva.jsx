import { tituloCorto } from '../fechas.js';
import { formatearPrecio } from '../precios.js';

// Columna derecha de la pantalla 1 en escritorio (1024px o más): el
// mismo resumen que ya muestra la barra fija de celular, pero como
// tarjeta sticky con el botón "Continuar" adentro. En celular y
// tablet no se muestra — ver .p1-lateral en estilos.css — ahí sigue
// mandando la barra fija de siempre (BarraInferior.jsx).
export default function TuReserva({ fecha, hora, canchaElegida, habilitado, onContinuar }) {
  return (
    <aside className="p1-lateral" aria-label="Tu reserva">
      <div className="tarjeta p1-resumen">
        <h2 className="tarjeta-titulo">Tu reserva</h2>
        <dl className="filas">
          <div className="fila">
            <dt>Día</dt>
            <dd>{tituloCorto(fecha)}</dd>
          </div>
          <div className="fila">
            <dt>Hora</dt>
            <dd>{hora || '—'}</dd>
          </div>
          <div className="fila">
            <dt>Cancha</dt>
            <dd>{canchaElegida ? canchaElegida.nombre : 'Elegí una cancha'}</dd>
          </div>
          {canchaElegida && (
            <div className="fila">
              <dt>Precio</dt>
              <dd>{formatearPrecio(canchaElegida.precio)}</dd>
            </div>
          )}
        </dl>
        <button type="button" className="boton boton-verde boton-ancho" disabled={!habilitado} onClick={onContinuar}>
          Continuar
        </button>
      </div>
    </aside>
  );
}
