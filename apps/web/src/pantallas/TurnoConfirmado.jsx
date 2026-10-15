import { DURACION_MIN } from '../config.js';
import { formatearPrecio } from '../precios.js';
import { tituloCorto, horaArgentina } from '../fechas.js';
import { IconoCalendario, IconoCompartir, IconoTilde } from '../componentes/Iconos.jsx';

// Pantalla 3: el turno quedó retenido 10 minutos.
export default function TurnoConfirmado({ reserva, fecha, hora, cancha, onOtraReserva }) {
  return (
    <div className="pantalla-scroll">
      <div className="exito-cabecera">
        <div className="exito-circulo" aria-hidden="true">
          <IconoTilde />
        </div>
        <h1 className="exito-titulo">¡Turno retenido!</h1>
        <p className="exito-bajada">
          Te lo guardamos hasta las {horaArgentina(reserva.vence_en)}.
        </p>
      </div>

      <div className="contenido contenido-exito">
        <section className="tarjeta">
          <div className="reserva-cabecera">
            <p className="reserva-numero">RESERVA #{reserva.id}</p>
            <span className="pastilla">Pendiente de pago</span>
          </div>

          <p className="reserva-fecha">
            {tituloCorto(fecha)} · {hora}
          </p>

          <dl className="filas">
            <div className="fila">
              <dt>Cancha</dt>
              <dd>
                {cancha.nombre} · {cancha.descripcion}
              </dd>
            </div>
            <div className="fila">
              <dt>Duración</dt>
              <dd>{DURACION_MIN} min</dd>
            </div>
            <div className="fila">
              <dt>A pagar en el club</dt>
              <dd>{formatearPrecio(cancha.precio)}</dd>
            </div>
          </dl>
        </section>

        {/* TODO: estas tres acciones todavía no están implementadas.
            Quedan visibles y deshabilitadas para mostrar a dónde va el flujo. */}
        <button type="button" className="boton-accion" disabled>
          <IconoCalendario />
          Agregar al calendario
        </button>

        <button type="button" className="boton-accion" disabled>
          <IconoCompartir />
          Compartir con los que juegan
        </button>

        <button type="button" className="boton-texto-rojo" disabled>
          Cancelar reserva
        </button>

        <button type="button" className="boton boton-verde boton-ancho" onClick={onOtraReserva}>
          Hacer otra reserva
        </button>

        <p className="pie">
          Reservas por <strong>fixcomap</strong>
        </p>
      </div>
    </div>
  );
}
