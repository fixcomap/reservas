import { useState } from 'react';
import { CLUB, DURACION_MIN, SENIA_TEXTO } from '../config.js';
import { formatearPrecio } from '../precios.js';
import { tituloLargo, sumarMinutos } from '../fechas.js';
import { IconoCalendario, IconoFlechaAtras } from '../componentes/Iconos.jsx';

// Mismas reglas que valida la API, repetidas acá para avisar al toque
// sin esperar el viaje de ida y vuelta.
const TELEFONO_OK = /^\+?[\d\s-]{8,20}$/;

// Pantalla 2: datos del jugador y confirmación.
export default function ConfirmarReserva({ fecha, hora, cancha, enviando, error, onVolver, onReservar }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [errores, setErrores] = useState({});

  function enviar(evento) {
    evento.preventDefault();

    const nuevos = {};
    if (nombre.trim().length < 2) nuevos.nombre = 'Escribí tu nombre y apellido.';
    if (!TELEFONO_OK.test(telefono.trim())) nuevos.telefono = 'Escribí un WhatsApp válido, ej: 11 1234 5678.';
    setErrores(nuevos);

    if (Object.keys(nuevos).length === 0) {
      onReservar({ cliente_nombre: nombre.trim(), cliente_tel: telefono.trim() });
    }
  }

  const precio = formatearPrecio(cancha.precio);

  return (
    <>
      <div className="pantalla-scroll con-barra">
        <div className="barra-superior">
          <button type="button" className="boton-volver" onClick={onVolver} aria-label="Volver a elegir el turno">
            <IconoFlechaAtras />
          </button>
          <h1 className="barra-superior-titulo">Confirmá tu reserva</h1>
        </div>

        <div className="contenido">
          {/* TODO: cuando entre Mercado Pago, acá va el aviso naranja
              "Te guardamos el turno 10:00 min mientras pagás la seña".
              Hoy no se muestra porque el turno recién se retiene al reservar. */}

          <section className="tarjeta">
            <div className="resumen-cabecera">
              <span className="resumen-icono" aria-hidden="true">
                <IconoCalendario />
              </span>
              <div>
                <p className="resumen-fecha">{tituloLargo(fecha)}</p>
                <p className="resumen-horario">
                  {hora} a {sumarMinutos(hora, DURACION_MIN)} · {DURACION_MIN} min
                </p>
              </div>
            </div>

            <dl className="filas">
              <div className="fila">
                <dt>Club</dt>
                <dd>{CLUB.nombre}</dd>
              </div>
              <div className="fila">
                <dt>Cancha</dt>
                <dd>
                  {cancha.nombre} · {cancha.descripcion}
                </dd>
              </div>
              <div className="fila">
                <dt>Total del turno</dt>
                <dd>{precio}</dd>
              </div>
              <div className="fila">
                <dt>Resto a pagar en el club</dt>
                <dd>{precio}</dd>
              </div>
            </dl>
          </section>

          <section className="tarjeta">
            <h2 className="tarjeta-titulo">Tus datos</h2>
            <form id="form-datos" onSubmit={enviar} noValidate>
              <div className="campo">
                <label htmlFor="nombre">Nombre y apellido</label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  autoComplete="name"
                  placeholder="Ej: Juan Pérez"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  aria-invalid={Boolean(errores.nombre)}
                  aria-describedby={errores.nombre ? 'error-nombre' : undefined}
                />
                {errores.nombre && (
                  <p className="campo-error" id="error-nombre">
                    {errores.nombre}
                  </p>
                )}
              </div>

              <div className="campo">
                <label htmlFor="telefono">WhatsApp</label>
                <input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="11 1234 5678"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  aria-invalid={Boolean(errores.telefono)}
                  aria-describedby={errores.telefono ? 'error-telefono' : undefined}
                />
                {errores.telefono && (
                  <p className="campo-error" id="error-telefono">
                    {errores.telefono}
                  </p>
                )}
              </div>
            </form>
          </section>

          {error && (
            <p className="aviso-error" role="alert">
              {error}
            </p>
          )}

          <p className="letra-chica">
            Cancelando con más de [X] horas de anticipación te devolvemos la seña.
          </p>
        </div>
      </div>

      <div className="barra-fija">
        <div className="barra-fija-interior">
          <div className="barra-senia">
            <span>Seña a pagar ahora</span>
            <strong>{SENIA_TEXTO}</strong>
          </div>
          {/* Más adelante este botón abre el checkout de Mercado Pago.
              Por ahora hace el POST y retiene el turno 10 minutos. */}
          <button type="submit" form="form-datos" className="boton boton-azul" disabled={enviando}>
            {enviando ? 'Reservando…' : 'Reservar turno'}
          </button>
        </div>
      </div>
    </>
  );
}
