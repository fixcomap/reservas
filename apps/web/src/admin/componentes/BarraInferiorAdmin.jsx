import { IconoCalendario } from '../../componentes/Iconos.jsx';
import { IconoTurnosFijos, IconoClientes, IconoAjustes } from './IconosAdmin.jsx';

// También la usa BarraLateralAdmin
export const PESTANIAS = [
  { clave: 'agenda', texto: 'Agenda', Icono: IconoCalendario, deshabilitada: false },
  { clave: 'turnos-fijos', texto: 'Turnos fijos', Icono: IconoTurnosFijos, deshabilitada: false },
  { clave: 'clientes', texto: 'Clientes', Icono: IconoClientes, deshabilitada: true },
  { clave: 'ajustes', texto: 'Ajustes', Icono: IconoAjustes, deshabilitada: false },
];

// Barra de abajo del panel (celular y tablet)
// TODO: pantalla de Clientes.
export default function BarraInferiorAdmin({ pestania, onCambiar }) {
  return (
    <nav className="adm-tabs" aria-label="Secciones del panel">
      <div className="adm-tabs-interior">
        {PESTANIAS.map(({ clave, texto, Icono, deshabilitada }) => {
          const activa = clave === pestania;
          return (
            <button
              key={clave}
              type="button"
              className={`adm-tab${activa ? ' es-activa' : ''}`}
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
    </nav>
  );
}
