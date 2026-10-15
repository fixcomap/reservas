import { useState } from 'react';
import { crearReservaManual, crearBloqueo, cancelarReserva, desactivarTurnoFijo } from '../apiAdmin.js';
import { linkWhatsApp } from '../util.js';
import { IconoX, IconoChat } from './IconosAdmin.jsx';

const RE_TEL = /^\+?[\d\s-]{8,20}$/;

// Panel que sube desde abajo al tocar un turno de la grilla. Si está
// libre, deja cargar una reserva o bloquearlo. Si está ocupado, muestra
// los datos del cliente y deja cancelar (o desactivar, si es un fijo).
export default function HojaTurno({ turno, cancha, fecha, onCerrar, onCambio }) {
  const esLibre = turno.estado === 'libre';
  const esFijo = turno.estado === 'fijo';

  // 'elegir' | 'cargar' | 'bloquear' — solo se usa cuando el turno está libre
  const [modo, setModo] = useState('elegir');
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [confirmando, setConfirmando] = useState(false);

  async function cargarReserva(evento) {
    evento.preventDefault();
    if (nombre.trim().length < 2) {
      setError('Escribí el nombre del cliente.');
      return;
    }
    if (tel.trim() && !RE_TEL.test(tel.trim())) {
      setError('Ese teléfono no parece válido.');
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      await crearReservaManual({
        cancha_id: cancha.id,
        fecha,
        hora: turno.hora,
        cliente_nombre: nombre.trim(),
        cliente_tel: tel.trim() || undefined,
      });
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function bloquear(evento) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await crearBloqueo({
        cancha_id: cancha.id,
        fecha,
        hora: turno.hora,
        motivo: motivo.trim() || undefined,
      });
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarCancelacion() {
    setError(null);
    setEnviando(true);
    try {
      if (esFijo) {
        await desactivarTurnoFijo(turno.turno_fijo_id);
      } else {
        await cancelarReserva(turno.reserva_id);
      }
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  const wa = linkWhatsApp(turno.cliente_tel);

  return (
    <div className="adm-hoja-fondo" onClick={onCerrar}>
      <div
        className="adm-hoja"
        role="dialog"
        aria-modal="true"
        aria-label={`Turno de ${turno.hora} en ${cancha.nombre}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="adm-hoja-cabecera">
          <div>
            <p className="adm-hoja-hora">{turno.hora}</p>
            <p className="adm-hoja-cancha">{cancha.nombre}</p>
          </div>
          <button type="button" className="adm-hoja-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <IconoX />
          </button>
        </div>

        {esLibre && modo === 'elegir' && (
          <div className="adm-hoja-opciones">
            <button type="button" className="boton boton-verde boton-ancho" onClick={() => setModo('cargar')}>
              Cargar reserva
            </button>
            <button type="button" className="adm-boton-secundario" onClick={() => setModo('bloquear')}>
              Bloquear
            </button>
          </div>
        )}

        {esLibre && modo === 'cargar' && (
          <form onSubmit={cargarReserva} noValidate>
            <div className="campo">
              <label htmlFor="adm-cliente-nombre">Nombre y apellido</label>
              <input
                id="adm-cliente-nombre"
                type="text"
                placeholder="Ej: Juan Pérez"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="adm-cliente-tel">WhatsApp (opcional)</label>
              <input
                id="adm-cliente-tel"
                type="tel"
                inputMode="tel"
                placeholder="11 1234 5678"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
              />
            </div>
            {error && (
              <p className="aviso-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="boton boton-verde boton-ancho" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar reserva'}
            </button>
          </form>
        )}

        {esLibre && modo === 'bloquear' && (
          <form onSubmit={bloquear} noValidate>
            <div className="campo">
              <label htmlFor="adm-motivo">Motivo (opcional)</label>
              <input
                id="adm-motivo"
                type="text"
                placeholder="Ej: Mantenimiento"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>
            {error && (
              <p className="aviso-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="boton boton-verde boton-ancho" disabled={enviando}>
              {enviando ? 'Bloqueando…' : 'Bloquear turno'}
            </button>
          </form>
        )}

        {!esLibre && (
          <div className="adm-hoja-detalle">
            <dl className="filas">
              <div className="fila">
                <dt>Cliente</dt>
                <dd>{turno.cliente_nombre || '—'}</dd>
              </div>
              {turno.cliente_tel && (
                <div className="fila">
                  <dt>Teléfono</dt>
                  <dd>{turno.cliente_tel}</dd>
                </div>
              )}
              <div className="fila">
                <dt>Origen</dt>
                <dd>
                  {esFijo && 'Turno fijo'}
                  {turno.estado === 'online' &&
                    (turno.reserva_estado === 'confirmada' ? 'Online · seña pagada' : 'Online · pendiente de pago')}
                  {turno.estado === 'manual' && 'Cargada a mano'}
                  {turno.estado === 'bloqueo' && 'Turno bloqueado'}
                </dd>
              </div>
            </dl>

            {wa && (
              <a className="adm-boton-whatsapp" href={wa} target="_blank" rel="noreferrer">
                <IconoChat />
                Escribir por WhatsApp
              </a>
            )}

            {error && (
              <p className="aviso-error" role="alert">
                {error}
              </p>
            )}

            {!confirmando && (
              <button type="button" className="boton-texto-rojo" onClick={() => setConfirmando(true)}>
                {esFijo ? 'Desactivar turno fijo' : 'Cancelar reserva'}
              </button>
            )}

            {confirmando && (
              <div className="adm-confirmar">
                <p>{esFijo ? '¿Desactivar este turno fijo?' : '¿Cancelar esta reserva?'}</p>
                <div className="adm-confirmar-botones">
                  <button type="button" className="adm-boton-secundario" onClick={() => setConfirmando(false)} disabled={enviando}>
                    No
                  </button>
                  <button type="button" className="boton boton-rojo" onClick={confirmarCancelacion} disabled={enviando}>
                    {enviando ? 'Confirmando…' : 'Sí, confirmar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
