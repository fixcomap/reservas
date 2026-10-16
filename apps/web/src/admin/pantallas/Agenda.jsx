import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAgenda } from '../apiAdmin.js';
import { hoyEnArgentina, sumarDias, tituloAgenda, diaDeLaSemana, nombreDiaCorto, horaArgentina } from '../../fechas.js';
import { formatearPesos } from '../util.js';
import { DURACION_MIN } from '../../config.js';
import { Cargando, ErrorRed } from '../../componentes/Estados.jsx';
import HojaTurno from '../componentes/HojaTurno.jsx';
import { IconoFlechaIzquierda, IconoFlechaDerecha, IconoCampana, IconoSalir } from '../componentes/IconosAdmin.jsx';

// Texto extra para el turno (desktop, .adm-turno-extra): forma o
// estado de pago, aprovechando el lugar de sobra que no hay en celular.
function textoExtra(turno) {
  if (turno.estado === 'online') {
    return `${turno.tipo_pago === 'senia' ? 'Seña' : 'Total'} · ${formatearPesos(turno.monto_total)}`;
  }
  if (turno.estado === 'manual') {
    return `A mano · ${formatearPesos(turno.monto_total)}`;
  }
  return null;
}

// Arma, para un turno de la grilla, qué clase de color y qué textos le
// corresponden. Centralizado acá porque la celda y (en el futuro)
// cualquier otro resumen necesitan la misma traducción.
function datosCelda(turno, fecha) {
  switch (turno.estado) {
    case 'libre':
      if (turno.liberado) {
        return { clase: 'adm-turno--libre', titulo: 'Libre', subtitulo: 'Fijo liberado' };
      }
      return { clase: 'adm-turno--libre', titulo: 'Libre', subtitulo: turno.pasado ? 'Ya pasó' : 'Tocá para cargar' };
    case 'online':
      return {
        clase: 'adm-turno--online',
        titulo: turno.cliente_nombre || 'Reserva online',
        subtitulo: turno.reserva_estado === 'confirmada' ? 'Seña pagada' : 'Pendiente de pago',
      };
    case 'manual':
      return { clase: 'adm-turno--manual', titulo: turno.cliente_nombre || 'Cliente', subtitulo: 'Por WhatsApp' };
    case 'fijo':
      return {
        clase: 'adm-turno--fijo',
        titulo: turno.cliente_nombre || 'Turno fijo',
        subtitulo: `Fijo · todos los ${nombreDiaCorto(diaDeLaSemana(fecha))}`,
      };
    case 'bloqueo':
      return { clase: 'adm-turno--bloqueo', titulo: 'Bloqueado', subtitulo: turno.cliente_nombre || 'Sin motivo' };
    default:
      return { clase: '', titulo: '', subtitulo: '' };
  }
}

export default function Agenda({ club, onCerrarSesion }) {
  const [fecha, setFecha] = useState(hoyEnArgentina());
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [seleccion, setSeleccion] = useState(null); // { cancha, turno } | null
  const grillaRef = useRef(null);
  const [lineaAhoraTop, setLineaAhoraTop] = useState(null);

  const cargar = useCallback((fechaAConsultar) => {
    setCargando(true);
    setError(null);
    getAgenda(fechaAConsultar)
      .then((respuesta) => setDatos(respuesta))
      .catch((err) => setError(err.message))
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargar(fecha);
  }, [fecha, cargar]);

  const canchas = datos?.canchas || [];

  // La hora de un turno es la misma para todas las canchas casi
  // siempre, pero por las dudas armamos la unión: si una cancha tiene
  // una duración distinta, su columna va a tener huecos en vez de
  // romper la tabla.
  const horas = useMemo(() => {
    const set = new Set();
    for (const c of canchas) for (const t of c.turnos) set.add(t.hora);
    return [...set].sort();
  }, [canchas]);

  const mapa = useMemo(() => {
    const m = new Map();
    for (const c of canchas) {
      const porHora = new Map();
      for (const t of c.turnos) porHora.set(t.hora, t);
      m.set(c.id, porHora);
    }
    return m;
  }, [canchas]);

  // Línea de "hora actual" en la grilla (solo visible desde escritorio,
  // ver estilosAdmin.css): solo tiene sentido si se está viendo el día
  // de hoy. Mide la posición de las filas en el DOM en vez de calcularla
  // a mano, así funciona igual sin importar la altura real de cada fila.
  useEffect(() => {
    if (fecha !== hoyEnArgentina() || horas.length === 0) {
      setLineaAhoraTop(null);
      return undefined;
    }

    function actualizar() {
      const contenedor = grillaRef.current;
      if (!contenedor) return;

      const minutosHoras = horas.map((h) => {
        const [hh, mm] = h.split(':').map(Number);
        return hh * 60 + mm;
      });
      const [hhAhora, mmAhora] = horaArgentina(new Date().toISOString()).split(':').map(Number);
      const minutosAhora = hhAhora * 60 + mmAhora;

      if (minutosAhora < minutosHoras[0] || minutosAhora > minutosHoras[minutosHoras.length - 1] + DURACION_MIN) {
        setLineaAhoraTop(null);
        return;
      }

      let i = 0;
      while (i < minutosHoras.length - 1 && minutosAhora >= minutosHoras[i + 1]) i++;

      const filas = contenedor.querySelectorAll('.adm-grilla-fila');
      const filaActual = filas[i];
      if (!filaActual) {
        setLineaAhoraTop(null);
        return;
      }
      const siguiente = filas[i + 1];
      // La distancia entre el arranque de dos filas ya incluye el alto
      // real de la fila MÁS el gap entre ellas, sea cual sea en este
      // ancho de pantalla. Para la última fila no hay una siguiente de
      // la que copiar ese paso, así que lo aproximamos con su propia
      // altura (el gap de más es un margen de error mínimo y aceptable).
      const paso = siguiente ? siguiente.offsetTop - filaActual.offsetTop : filaActual.offsetHeight;
      const fraccion = Math.min(1, (minutosAhora - minutosHoras[i]) / DURACION_MIN);
      setLineaAhoraTop(filaActual.offsetTop + fraccion * paso);
    }

    actualizar();
    const intervalo = setInterval(actualizar, 30000);
    window.addEventListener('resize', actualizar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('resize', actualizar);
    };
  }, [fecha, horas, canchas.length]);

  function alCambiarTurno() {
    setSeleccion(null);
    cargar(fecha);
  }

  const resumen = datos?.resumen;

  return (
    <div className="pantalla-scroll con-barra">
      {/* .adm-ancho agrupa la cabecera y la grilla para que en
          escritorio ancho compartan el mismo contenedor centrado (ver
          estilosAdmin.css); en celular y tablet es transparente
          (display: contents) y queda igual que siempre. */}
      <div className="adm-ancho">
      {/* .adm-agenda-cabecera agrupa estos dos hermanos para el layout
          de escritorio (fila), pero en celular y tablet es transparente
          (display: contents) y quedan como hoy, uno debajo del otro. */}
      <div className="adm-agenda-cabecera">
        <header className="adm-cabecera">
          <div className="adm-cabecera-marca">
            <div className="marca">
              <div className="marca-logo" aria-hidden="true">F</div>
              <div>
                <p className="marca-nombre">{club?.nombre || 'Panel'}</p>
                <p className="marca-bajada">Panel de administración</p>
              </div>
            </div>
            <div className="adm-cabecera-acciones">
              {/* TODO: centro de notificaciones */}
              <button type="button" className="adm-boton-icono" disabled aria-label="Notificaciones">
                <IconoCampana />
              </button>
              <button type="button" className="adm-boton-icono" onClick={onCerrarSesion} aria-label="Cerrar sesión">
                <IconoSalir />
              </button>
            </div>
          </div>

          <div className="adm-stats">
            <div className="adm-stat">
              <p className="adm-stat-valor">{resumen ? resumen.reservas : '—'}</p>
              <p className="adm-stat-etiqueta">Reservas hoy</p>
            </div>
            <div className="adm-stat">
              <p className="adm-stat-valor">{resumen?.senias_cobradas == null ? '—' : resumen.senias_cobradas}</p>
              <p className="adm-stat-etiqueta">Señas cobradas</p>
            </div>
            <div className="adm-stat">
              <p className="adm-stat-valor">{resumen ? resumen.libres : '—'}</p>
              <p className="adm-stat-etiqueta">Libres</p>
            </div>
          </div>
        </header>

        <div className="adm-dia-nav">
          <button
            type="button"
            className="adm-flecha"
            onClick={() => setFecha((f) => sumarDias(f, -1))}
            aria-label="Día anterior"
          >
            <IconoFlechaIzquierda />
          </button>
          <div className="adm-dia-nav-texto">
            <p className="adm-dia-titulo">{tituloAgenda(fecha)}</p>
            <p className="adm-dia-subtitulo">Agenda del día</p>
          </div>
          <button
            type="button"
            className="adm-flecha"
            onClick={() => setFecha((f) => sumarDias(f, 1))}
            aria-label="Día siguiente"
          >
            <IconoFlechaDerecha />
          </button>
          {/* Nuevo: solo en escritorio, ver estilosAdmin.css. En celular
              ya se llega a hoy fácil con las flechas. Si ya estás en
              hoy, el título de arriba ya lo dice ("Hoy · viernes 16
              oct"): el botón sobra y no se muestra. */}
          {fecha !== hoyEnArgentina() && (
            <button type="button" className="adm-boton-hoy" onClick={() => setFecha(hoyEnArgentina())}>
              Volver a hoy
            </button>
          )}
        </div>
      </div>

      <div className="contenido">
        {cargando && <Cargando />}
        {!cargando && error && <ErrorRed mensaje={error} onReintentar={() => cargar(fecha)} />}

        {!cargando && !error && horas.length === 0 && (
          <div className="estado">
            <p className="estado-titulo">El club no abre este día</p>
          </div>
        )}

        {!cargando && !error && horas.length > 0 && (
          <>
            {/* .adm-grilla-scroll es transparente en celular/tablet
                (display: contents): .adm-grilla queda como hijo directo
                de .contenido, igual que siempre. Desde 1024px se
                convierte en la caja con scroll propio que mantiene el
                encabezado y la columna de horas fijos. */}
            <div className="adm-grilla-scroll">
              <div className="adm-grilla" style={{ '--adm-columnas': canchas.length }} ref={grillaRef}>
                <div className="adm-grilla-encabezado">
                  <div />
                  {canchas.map((c) => (
                    <div key={c.id} className="adm-grilla-cancha">
                      {c.nombre}
                    </div>
                  ))}
                </div>

                {horas.map((hora) => (
                  <div key={hora} className="adm-grilla-fila">
                    <div className="adm-grilla-hora">{hora}</div>
                    {canchas.map((c) => {
                      const turno = mapa.get(c.id)?.get(hora);
                      if (!turno) {
                        return <div key={c.id} className="adm-turno adm-turno--vacio" aria-hidden="true" />;
                      }
                      const { clase, titulo, subtitulo } = datosCelda(turno, fecha);
                      const claseFinal = `adm-turno ${clase}${turno.pasado ? ' adm-turno--pasado' : ''}`;

                      // Un turno libre que ya pasó no se puede tocar para
                      // cargar ni bloquear: no tiene sentido y además ya
                      // no es ni siquiera un turno reservable.
                      if (turno.estado === 'libre' && turno.pasado) {
                        return (
                          <div key={c.id} className={claseFinal}>
                            <span className="adm-turno-titulo">{titulo}</span>
                            <span className="adm-turno-subtitulo">{subtitulo}</span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={c.id}
                          type="button"
                          className={claseFinal}
                          onClick={() => setSeleccion({ cancha: c, turno })}
                        >
                          <span className="adm-turno-titulo">{titulo}</span>
                          <span className="adm-turno-subtitulo">{subtitulo}</span>
                          {/* Monto y forma/estado de pago: en celular no
                              entra, en escritorio hay lugar de sobra
                              (.adm-turno-extra). */}
                          {textoExtra(turno) && <span className="adm-turno-extra">{textoExtra(turno)}</span>}
                        </button>
                      );
                    })}
                  </div>
                ))}

                {lineaAhoraTop != null && (
                  <div className="adm-linea-ahora" style={{ top: lineaAhoraTop }} aria-hidden="true">
                    <span className="adm-linea-ahora-etiqueta">{horaArgentina(new Date().toISOString())}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="adm-leyenda">
              <span className="adm-leyenda-item">
                <span className="adm-leyenda-punto adm-turno--online" /> Online con seña
              </span>
              <span className="adm-leyenda-item">
                <span className="adm-leyenda-punto adm-turno--fijo" /> Turno fijo
              </span>
              <span className="adm-leyenda-item">
                <span className="adm-leyenda-punto adm-turno--manual" /> Cargada a mano
              </span>
            </div>
          </>
        )}
      </div>
      </div>

      {seleccion && (
        <HojaTurno
          turno={seleccion.turno}
          cancha={seleccion.cancha}
          fecha={fecha}
          onCerrar={() => setSeleccion(null)}
          onCambio={alCambiarTurno}
        />
      )}
    </div>
  );
}
