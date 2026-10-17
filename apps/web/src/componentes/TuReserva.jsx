import { tituloCorto } from '../fechas.js';
import { formatearPrecio } from '../precios.js';

// Resumen de la reserva en escritorio (en celular está BarraInferior)
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
