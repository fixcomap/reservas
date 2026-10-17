import { useState } from 'react';
import { DURACION_MIN } from '../config.js';
import { formatearPrecio, formatearMonto } from '../precios.js';
import { tituloLargo, sumarMinutos } from '../fechas.js';
import { IconoCalendario, IconoFlechaAtras } from '../componentes/Iconos.jsx';

// Mismas reglas que valida la API, repetidas acá para avisar al toque
// sin esperar el viaje de ida y vuelta.
const TELEFONO_OK = /^\+?[\d\s-]{8,20}$/;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Pantalla 2: forma de pago, datos del jugador y confirmación.
export default function ConfirmarReserva({ club, fecha, hora, cancha, seniaPorcentaje, enviando, error, onVolver, onReservar }) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [email, setEmail] = useState('');
  const [tipoPago, setTipoPago] = useState('senia');
  const [errores, setErrores] = useState({});

  function enviar(evento) {
    evento.preventDefault();

    const nuevos = {};
    if (nombre.trim().length < 2) nuevos.nombre = 'Escribí tu nombre y apellido.';
    if (!TELEFONO_OK.test(telefono.trim())) nuevos.telefono = 'Escribí un WhatsApp válido, ej: 11 1234 5678.';
    if (!EMAIL_OK.test(email.trim())) nuevos.email = 'Escribí un email válido, ej: juan@gmail.com.';
    setErrores(nuevos);

    if (Object.keys(nuevos).length === 0) {
      onReservar({
        cliente_nombre: nombre.trim(),
        cliente_tel: telefono.trim(),
        cliente_email: email.trim(),
        tipo_pago: tipoPago,
      });
    }
  }

  // Esto es solo para mostrar algo antes de reservar: el monto que
  // vale de verdad es el que devuelve la API al confirmar (ver
  // EstadoReserva), calculado del lado del servidor con el precio y
  // el porcentaje que estén guardados en ese momento.
  const total = Number(cancha.precio) || 0;
  const senia = Math.round((total * seniaPorcentaje) / 100);
  const resto = total - senia;
  const aPagarAhora = tipoPago === 'senia' ? senia : total;
  const textoBoton = enviando
    ? 'Yendo a Mercado Pago…'
    : tipoPago === 'senia'
      ? 'Pagar seña con Mercado Pago'
      : 'Pagar total con Mercado Pago';

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
          {/* TODO: aviso naranja "Te guardamos el turno 15:00 min
              mientras pagás". Hoy no se muestra porque el turno recién
              se retiene al tocar el botón de pagar, justo antes de ir a
              Mercado Pago. */}

          {/* .p2-layout/.p2-principal/.p2-lateral: en celular y tablet
              son transparentes (display: contents, ver estilos.css),
              así que las dos section.tarjeta quedan en el mismo orden
              de siempre. Desde 1024px arman dos columnas. */}
          <div className="p2-layout">
            <div className="p2-principal">
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
                    <dd>{club?.nombre}</dd>
                  </div>
                  <div className="fila">
                    <dt>Cancha</dt>
                    <dd>
                      {cancha.nombre} · {cancha.descripcion}
                    </dd>
                  </div>
                </dl>

                <div className="pago-opciones" role="radiogroup" aria-label="Forma de pago">
                  <label className={`pago-opcion${tipoPago === 'senia' ? ' es-elegido' : ''}`}>
                    <input
                      type="radio"
                      name="tipo-pago"
                      value="senia"
                      checked={tipoPago === 'senia'}
                      onChange={() => setTipoPago('senia')}
                    />
                    <span className="pago-opcion-texto">
                      <span className="pago-opcion-titulo">Seña · {formatearPrecio(senia)}</span>
                      <span className="pago-opcion-sub">Pagás {formatearMonto(resto)} en el club</span>
                    </span>
                  </label>
                  <label className={`pago-opcion${tipoPago === 'total' ? ' es-elegido' : ''}`}>
                    <input
                      type="radio"
                      name="tipo-pago"
                      value="total"
                      checked={tipoPago === 'total'}
                      onChange={() => setTipoPago('total')}
                    />
                    <span className="pago-opcion-texto">
                      <span className="pago-opcion-titulo">Pago total · {formatearPrecio(total)}</span>
                      <span className="pago-opcion-sub">No pagás nada en el club</span>
                    </span>
                  </label>
                </div>

                <dl className="filas">
                  <div className="fila">
                    <dt>Total del turno</dt>
                    <dd>{formatearPrecio(total)}</dd>
                  </div>
                  <div className="fila">
                    <dt>{tipoPago === 'senia' ? 'Seña' : 'A pagar ahora'}</dt>
                    <dd>{formatearPrecio(aPagarAhora)}</dd>
                  </div>
                  <div className="fila">
                    <dt>Resto a pagar en el club</dt>
                    <dd>{formatearMonto(total - aPagarAhora)}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <div className="p2-lateral">
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

                  <div className="campo">
                    <label htmlFor="email">Email</label>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="juan@gmail.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      aria-invalid={Boolean(errores.email)}
                      aria-describedby={errores.email ? 'error-email' : 'ayuda-email'}
                    />
                    {errores.email ? (
                      <p className="campo-error" id="error-email">
                        {errores.email}
                      </p>
                    ) : (
                      <p className="letra-chica" id="ayuda-email">
                        Te mandamos el comprobante cuando se confirme el pago.
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

              {/* Mismo form, mismo envío: en celular y tablet este botón
                  no se ve (la barra fija de abajo hace lo mismo). */}
              <button
                type="submit"
                form="form-datos"
                className="boton boton-azul p2-boton-escritorio"
                disabled={enviando}
              >
                {textoBoton}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="barra-fija">
        <div className="barra-fija-interior">
          <div className="barra-senia">
            <span>{tipoPago === 'senia' ? 'Seña a pagar ahora' : 'Total a pagar ahora'}</span>
            <strong>{formatearPrecio(aPagarAhora)}</strong>
          </div>
          {/* Retiene el turno 15 minutos y lleva al checkout de Mercado Pago. */}
          <button type="submit" form="form-datos" className="boton boton-azul" disabled={enviando}>
            {textoBoton}
          </button>
        </div>
      </div>
    </>
  );
}
