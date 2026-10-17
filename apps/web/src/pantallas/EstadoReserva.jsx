import { useCallback, useEffect, useState } from 'react';
import { getEstadoReserva } from '../api.js';
import { formatearMonto } from '../precios.js';
import { tituloCorto, horaArgentina } from '../fechas.js';
import { IconoCalendario, IconoCompartir, IconoTilde, IconoReloj, IconoCruz } from '../componentes/Iconos.jsx';

// Pantalla 3 (/reserva/<token>): estado de la reserva y del pago.
// Nunca se leen los parámetros de la URL de vuelta (?status=...).

// Qué cabecera mostrar según cómo esté la reserva.
function cabecera(r) {
  const monto = formatearMonto(r.monto_a_pagar);

  if (r.pago_estado === 'aprobado' && r.estado === 'confirmada') {
    return {
      tono: 'ok',
      titulo: '¡Turno confirmado!',
      bajada: 'Te mandamos el comprobante por mail. Guardá este link: acá podés ver tu reserva cuando quieras.',
      pastilla: r.tipo_pago === 'senia' ? 'Seña pagada' : 'Pago total',
    };
  }
  if (r.pago_estado === 'reembolsado') {
    return {
      tono: 'error',
      titulo: 'El turno ya no estaba disponible',
      bajada: `Tu pago llegó cuando el turno ya lo había tomado otra persona. Te devolvimos ${monto} al mismo medio de pago.`,
      pastilla: 'Pago devuelto',
      otroTurno: true,
    };
  }
  if (r.pago_estado === 'reembolso_pendiente') {
    return {
      tono: 'error',
      titulo: 'El turno ya no estaba disponible',
      bajada: `Tu pago llegó cuando el turno ya lo había tomado otra persona. Vamos a devolverte ${monto} al mismo medio de pago; el club ya está avisado.`,
      pastilla: 'Devolución en curso',
      otroTurno: true,
    };
  }
  if (r.pago_estado === 'rechazado') {
    return {
      tono: 'error',
      titulo: 'El pago no se aprobó',
      bajada: 'No se te cobró nada. Podés volver a elegir un turno y probar con otro medio de pago.',
      pastilla: 'Pago rechazado',
      otroTurno: true,
    };
  }
  // Pendiente
  if (r.estado === 'retenida') {
    return {
      tono: 'espera',
      titulo: 'Estamos esperando tu pago',
      bajada: `Te guardamos el turno hasta las ${horaArgentina(r.vence_en)}. Si ya pagaste, puede tardar unos minutos en acreditarse.`,
      pastilla: 'Pendiente de pago',
      actualizar: true,
    };
  }
  return {
    tono: 'espera',
    titulo: 'Tu reserva venció',
    bajada: 'No recibimos el pago a tiempo y el turno se liberó. Si pagaste recién, tocá "Actualizar" en unos minutos.',
    pastilla: 'Sin pago',
    actualizar: true,
    otroTurno: true,
  };
}

const ICONOS = { ok: IconoTilde, espera: IconoReloj, error: IconoCruz };

export default function EstadoReserva({ token }) {
  const [reserva, setReserva] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(() => {
    setCargando(true);
    setError(null);
    getEstadoReserva(token)
      .then(setReserva)
      .catch((err) =>
        setError(err.estado === 404 ? 'No encontramos esa reserva. Revisá que el link esté completo.' : err.message)
      )
      .finally(() => setCargando(false));
  }, [token]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  function irAElegirTurno() {
    window.location.assign('/');
  }

  if (!reserva) {
    return (
      <div className="pantalla-scroll">
        <div className="contenido contenido-exito">
          {cargando && (
            <div className="estado" role="status" aria-live="polite">
              <div className="estado-spinner" aria-hidden="true" />
              <p className="estado-texto">Buscando tu reserva…</p>
            </div>
          )}
          {!cargando && error && (
            <div className="estado" role="alert">
              <p className="estado-titulo">No pudimos mostrar tu reserva</p>
              <p className="estado-texto">{error}</p>
              <button type="button" className="boton boton-verde" onClick={cargar}>
                Reintentar
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const info = cabecera(reserva);
  const Icono = ICONOS[info.tono];
  const confirmada = info.tono === 'ok';

  return (
    <div className="pantalla-scroll">
      <div className={`exito-cabecera exito-cabecera--${info.tono}`}>
        <div className="exito-circulo" aria-hidden="true">
          <Icono tamanio={34} />
        </div>
        <h1 className="exito-titulo">{info.titulo}</h1>
        <p className="exito-bajada">{info.bajada}</p>
      </div>

      <div className="contenido contenido-exito">
        <section className="tarjeta">
          <div className="reserva-cabecera">
            <p className="reserva-numero">RESERVA #{reserva.numero}</p>
            <span className={`pastilla pastilla--${info.tono}`}>{info.pastilla}</span>
          </div>

          <p className="reserva-fecha">
            {tituloCorto(reserva.fecha)} · {reserva.hora}
          </p>

          <dl className="filas">
            <div className="fila">
              <dt>Cancha</dt>
              <dd>
                {reserva.cancha.nombre}
                {reserva.cancha.descripcion ? ` · ${reserva.cancha.descripcion}` : ''}
              </dd>
            </div>
            <div className="fila">
              <dt>Duración</dt>
              <dd>{reserva.duracion_min} min</dd>
            </div>
            {confirmada ? (
              <>
                <div className="fila">
                  <dt>Pagaste</dt>
                  <dd>{formatearMonto(reserva.monto_pagado)}</dd>
                </div>
                <div className="fila">
                  <dt>A pagar en el club</dt>
                  <dd>{formatearMonto(reserva.monto_total - reserva.monto_pagado)}</dd>
                </div>
              </>
            ) : (
              <div className="fila">
                <dt>{reserva.tipo_pago === 'senia' ? 'Seña' : 'Total'}</dt>
                <dd>{formatearMonto(reserva.monto_a_pagar)}</dd>
              </div>
            )}
          </dl>
        </section>

        {error && (
          <p className="aviso-error" role="alert">
            {error}
          </p>
        )}

        {info.actualizar && (
          <button type="button" className="boton boton-azul" onClick={cargar} disabled={cargando}>
            {cargando ? 'Actualizando…' : 'Actualizar'}
          </button>
        )}

        {confirmada && (
          <>
            {/* TODO: estas tres acciones todavía no están implementadas */}
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
          </>
        )}

        {info.otroTurno && (
          <button type="button" className="boton boton-verde boton-ancho" onClick={irAElegirTurno}>
            Volver a elegir turno
          </button>
        )}

        {confirmada && (
          <button type="button" className="boton boton-verde boton-ancho" onClick={irAElegirTurno}>
            Hacer otra reserva
          </button>
        )}

        <p className="pie">
          Reservas por <strong>fixcomap</strong>
        </p>
      </div>
    </div>
  );
}
