import { PESTANIAS } from './BarraInferiorAdmin.jsx';
import { IconoSalir } from './IconosAdmin.jsx';

// Barra lateral del panel (solo escritorio)
export default function BarraLateralAdmin({ pestania, onCambiar, club, onCerrarSesion }) {
  return (
    <nav className="adm-sidebar" aria-label="Secciones del panel">
      <div className="adm-sidebar-marca">
        <div className="marca-logo" aria-hidden="true">F</div>
        <div>
          <p className="adm-sidebar-nombre">{club?.nombre || 'Panel'}</p>
          <p className="adm-sidebar-bajada">Panel de administración</p>
        </div>
      </div>

      <div className="adm-sidebar-tabs">
        {PESTANIAS.map(({ clave, texto, Icono, deshabilitada }) => {
          const activa = clave === pestania;
          return (
            <button
              key={clave}
              type="button"
              className={`adm-sidebar-tab${activa ? ' es-activa' : ''}`}
              aria-current={activa ? 'page' : undefined}
              disabled={deshabilitada}
              onClick={() => onCambiar(clave)}
            >
              <Icono />
              <span>{texto}</span>
            </button>
          );
        })}
      </div>

      <button type="button" className="adm-sidebar-salir" onClick={onCerrarSesion}>
        <IconoSalir />
        Cerrar sesión
      </button>
    </nav>
  );
}
