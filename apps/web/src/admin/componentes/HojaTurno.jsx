import { useEffect, useRef, useState } from 'react';
import {
  crearReservaManual,
  crearBloqueo,
  cancelarReserva,
  desactivarTurnoFijo,
  crearExcepcion,
  deshacerExcepcion,
} from '../apiAdmin.js';
import { linkWhatsApp, formatearPesos, TEXTO_PAGO } from '../util.js';
import { IconoX, IconoChat } from './IconosAdmin.jsx';

const RE_TEL = /^\+?[\d\s-]{8,20}$/;

// Panel que sube desde abajo al tocar un turno de la grilla.
// - Libre (y no liberado de un fijo): "Cargar reserva" o "Bloquear".
// - Libre por una excepción de un fijo: lo mismo, más "Volver a ocupar
//   con el turno fijo" (deshace la excepción).
// - Fijo: datos del cliente, "Liberar solo esta fecha" (si no pasó) y
//   "Desactivar turno fijo" (todas las semanas).
// - Online / manual / bloqueo: datos del cliente y "Cancelar reserva"
//   si todavía no pasó; si ya pasó, se puede ver pero no cancelar.
export default function HojaTurno({ turno, cancha, fecha, onCerrar, onCambio }) {
  const esLibre = turno.estado === 'libre';
  const esFijo = turno.estado === 'fijo';

  // 'elegir' | 'cargar' | 'bloquear' | 'liberar'
  const [modo, setModo] = useState('elegir');
  const [nombre, setNombre] = useState('');
  const [tel, setTel] = useState('');
  const [motivo, setMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  // null | 'cancelar' | 'desactivar' | 'deshacer'
  const [confirmando, setConfirmando] = useState(null);

  const hojaRef = useRef(null);
  const cerrarRef = useRef(null);

  // Al abrir: guardamos qué tenía el foco (el turno que tocaron) para
  // devolvérselo cuando se cierre, y movemos el foco al botón de
  // cerrar. Esto corre en cualquier ancho: es comportamiento de
  // teclado, no apariencia, así que celular también lo tiene.
  useEffect(() => {
    const disparador = document.activeElement;
    cerrarRef.current?.focus();
    return () => {
      disparador?.focus?.();
    };
  }, []);

  // Escape cierra. Tab no deja que el foco se escape del panel
  // (si estás en el último elemento tocable y tocás Tab, volvés al
  // primero; con Shift+Tab, al revés).
  useEffect(() => {
    function alTecla(evento) {
      if (evento.key === 'Escape') {
        evento.preventDefault();
        onCerrar();
        return;
      }
      if (evento.key !== 'Tab' || !hojaRef.current) return;

      const tocables = hojaRef.current.querySelectorAll(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
      );
      if (tocables.length === 0) return;
      const primero = tocables[0];
      const ultimo = tocables[tocables.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }

    document.addEventListener('keydown', alTecla);
    return () => document.removeEventListener('keydown', alTecla);
  }, [onCerrar]);

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

  async function liberarFecha(evento) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      await crearExcepcion(turno.turno_fijo_id, { fecha, motivo: motivo.trim() || undefined });
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarDesactivar() {
    setError(null);
    setEnviando(true);
    try {
      await desactivarTurnoFijo(turno.turno_fijo_id);
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarCancelar() {
    setError(null);
    setEnviando(true);
    try {
      await cancelarReserva(turno.reserva_id);
      onCambio();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarDeshacer() {
    setError(null);
    setEnviando(true);
    try {
      await deshacerExcepcion(turno.turno_fijo_id, fecha);
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
        ref={hojaRef}
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
          <button ref={cerrarRef} type="button" className="adm-hoja-cerrar" onClick={onCerrar} aria-label="Cerrar">
            <IconoX />
          </button>
        </div>

        {esLibre && modo === 'elegir' && (
          <div className="adm-hoja-opciones">
            {turno.liberado && (
              <p className="letra-chica adm-nota-liberado">
                Este turno es de un fijo, pero esta fecha está liberada.
              </p>
            )}
            <button type="button" className="boton boton-verde boton-ancho" onClick={() => setModo('cargar')}>
              Cargar reserva
            </button>
            <button type="button" className="adm-boton-secundario" onClick={() => setModo('bloquear')}>
              Bloquear
            </button>
            {turno.liberado && !confirmando && (
              <button type="button" className="adm-boton-secundario" onClick={() => setConfirmando('deshacer')}>
                Volver a ocupar con el turno fijo
              </button>
            )}
            {turno.liberado && confirmando === 'deshacer' && (
              <div className="adm-confirmar">
                <p>¿Volver a ocupar este turno con el fijo? Deja de estar liberado.</p>
                {error && (
                  <p className="aviso-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="adm-confirmar-botones">
                  <button
                    type="button"
                    className="adm-boton-secundario"
                    onClick={() => setConfirmando(null)}
                    disabled={enviando}
                  >
                    No
                  </button>
                  <button type="button" className="boton boton-verde" onClick={confirmarDeshacer} disabled={enviando}>
                    {enviando ? 'Confirmando…' : 'Sí, confirmar'}
                  </button>
                </div>
              </div>
            )}
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

        {esFijo && modo === 'liberar' && (
          <form onSubmit={liberarFecha} noValidate>
            <p className="letra-chica">
              Esta fecha queda libre para cargar una reserva o que la reserve un jugador. El fijo se sigue repitiendo
              las demás semanas.
            </p>
            <div className="campo">
              <label htmlFor="adm-motivo-liberar">Motivo (opcional)</label>
              <input
                id="adm-motivo-liberar"
                type="text"
                placeholder="Ej: Avisó que no viene"
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
              {enviando ? 'Liberando…' : 'Liberar esta fecha'}
            </button>
          </form>
        )}

        {!esLibre && modo === 'elegir' && (
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
              {turno.cliente_email && (
                <div className="fila">
                  <dt>Email</dt>
                  <dd>{turno.cliente_email}</dd>
                </div>
              )}
              <div className="fila">
                <dt>Origen</dt>
                <dd>
                  {esFijo && 'Turno fijo'}
                  {turno.estado === 'online' && 'Online'}
                  {turno.estado === 'manual' && 'Cargada a mano'}
                  {turno.estado === 'bloqueo' && 'Turno bloqueado'}
                </dd>
              </div>
              {turno.estado === 'online' && (
                <>
                  <div className="fila">
                    <dt>Total del turno</dt>
                    <dd>{formatearPesos(turno.monto_total)}</dd>
                  </div>
                  <div className="fila">
                    <dt>Forma de pago</dt>
                    <dd>{turno.tipo_pago === 'senia' ? 'Seña' : 'Total'}</dd>
                  </div>
                  <div className="fila">
                    <dt>Estado del pago</dt>
                    <dd>{TEXTO_PAGO[turno.pago_estado] || '—'}</dd>
                  </div>
                  <div className="fila">
                    <dt>Pagado por Mercado Pago</dt>
                    <dd>{formatearPesos(turno.monto_pagado)}</dd>
                  </div>
                </>
              )}
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

            {esFijo && !turno.pasado && !confirmando && (
              <button type="button" className="adm-boton-secundario" onClick={() => setModo('liberar')}>
                Liberar solo esta fecha
              </button>
            )}

            {!confirmando && (esFijo || !turno.pasado) && (
              <button
                type="button"
                className="boton-texto-rojo"
                onClick={() => setConfirmando(esFijo ? 'desactivar' : 'cancelar')}
              >
                {esFijo ? 'Desactivar turno fijo' : 'Cancelar reserva'}
              </button>
            )}

            {!esFijo && turno.pasado && (
              <p className="letra-chica">Este turno ya pasó, no se puede cancelar.</p>
            )}

            {confirmando === 'desactivar' && (
              <div className="adm-confirmar">
                <p>¿Desactivar este turno fijo? Deja de repetirse todas las semanas, no solo hoy.</p>
                <div className="adm-confirmar-botones">
                  <button
                    type="button"
                    className="adm-boton-secundario"
                    onClick={() => setConfirmando(null)}
                    disabled={enviando}
                  >
                    No
                  </button>
                  <button type="button" className="boton boton-rojo" onClick={confirmarDesactivar} disabled={enviando}>
                    {enviando ? 'Confirmando…' : 'Sí, confirmar'}
                  </button>
                </div>
              </div>
            )}

            {confirmando === 'cancelar' && (
              <div className="adm-confirmar">
                <p>¿Cancelar esta reserva?</p>
                <div className="adm-confirmar-botones">
                  <button
                    type="button"
                    className="adm-boton-secundario"
                    onClick={() => setConfirmando(null)}
                    disabled={enviando}
                  >
                    No
                  </button>
                  <button type="button" className="boton boton-rojo" onClick={confirmarCancelar} disabled={enviando}>
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
