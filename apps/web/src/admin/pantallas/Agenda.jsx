import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAgenda } from '../apiAdmin.js';
import { hoyEnArgentina, sumarDias, tituloAgenda, diaDeLaSemana, nombreDiaCorto } from '../../fechas.js';
import { Cargando, ErrorRed } from '../../componentes/Estados.jsx';
import HojaTurno from '../componentes/HojaTurno.jsx';
import { IconoFlechaIzquierda, IconoFlechaDerecha, IconoCampana, IconoSalir } from '../componentes/IconosAdmin.jsx';

// Arma, para un turno de la grilla, qué clase de color y qué textos le
// corresponden. Centralizado acá porque la celda y (en el futuro)
// cualquier otro resumen necesitan la misma traducción.
function datosCelda(turno, fecha) {
  switch (turno.estado) {
    case 'libre':
      return { clase: 'adm-turno--libre', titulo: 'Libre', subtitulo: 'Tocá para cargar' };
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

  function alCambiarTurno() {
    setSeleccion(null);
    cargar(fecha);
  }

  const resumen = datos?.resumen;

  return (
    <div className="pantalla-scroll con-barra">
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
            <div className="adm-grilla" style={{ '--adm-columnas': canchas.length }}>
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
                    return (
                      <button
                        key={c.id}
                        type="button"
                        className={`adm-turno ${clase}`}
                        onClick={() => setSeleccion({ cancha: c, turno })}
                      >
                        <span className="adm-turno-titulo">{titulo}</span>
                        <span className="adm-turno-subtitulo">{subtitulo}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
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
