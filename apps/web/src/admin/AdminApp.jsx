import { useEffect, useState } from 'react';
import Login from './pantallas/Login.jsx';
import Agenda from './pantallas/Agenda.jsx';
import TurnosFijos from './pantallas/TurnosFijos.jsx';
import Ajustes from './pantallas/Ajustes.jsx';
import BarraInferiorAdmin from './componentes/BarraInferiorAdmin.jsx';
import BarraLateralAdmin from './componentes/BarraLateralAdmin.jsx';
import { getYo, logout, escucharPerdidaDeSesion } from './apiAdmin.js';
import './estilosAdmin.css';

// Punto de entrada del panel. Decide entre login y agenda según si hay
// una sesión válida, y maneja el cambio de pestaña de la barra de abajo.
export default function AdminApp() {
  // null = todavía no sabemos, false = no hay sesión, objeto = logueado
  const [sesion, setSesion] = useState(null);
  const [pestania, setPestania] = useState('agenda');

  // Cualquier pedido al panel que vuelva con 401 nos manda de nuevo al
  // login (la sesión venció o la cookie ya no sirve).
  useEffect(() => {
    escucharPerdidaDeSesion(() => setSesion(false));
  }, []);

  useEffect(() => {
    getYo()
      .then((datos) => setSesion(datos))
      .catch(() => setSesion(false));
  }, []);

  function alIngresar() {
    getYo()
      .then((datos) => setSesion(datos))
      .catch(() => setSesion(false));
  }

  async function cerrarSesion() {
    try {
      await logout();
    } catch {
      // Si el pedido falla igual sacamos al admin de la pantalla: la
      // cookie ya puede haber quedado inválida de cualquier forma.
    }
    setSesion(false);
    setPestania('agenda');
  }

  if (sesion === null) {
    return (
      <div className="adm-cargando-pantalla">
        <div className="estado-spinner" aria-hidden="true" />
      </div>
    );
  }

  if (!sesion) {
    return <Login onIngresar={alIngresar} />;
  }

  // .adm-shell y .adm-main no generan caja en celular/tablet (display:
  // contents, ver estilosAdmin.css), así que ahí la pantalla activa y
  // la barra de pestañas quedan exactamente como antes. Desde 1024px
  // se convierten en la barra lateral fija + el área de contenido.
  return (
    <div className="adm-shell">
      <BarraLateralAdmin
        pestania={pestania}
        onCambiar={setPestania}
        club={sesion.club}
        onCerrarSesion={cerrarSesion}
      />
      <div className="adm-main">
        {pestania === 'agenda' && <Agenda club={sesion.club} onCerrarSesion={cerrarSesion} />}
        {pestania === 'turnos-fijos' && <TurnosFijos />}
        {pestania === 'ajustes' && <Ajustes onCerrarSesion={cerrarSesion} />}
        <BarraInferiorAdmin pestania={pestania} onCambiar={setPestania} />
      </div>
    </div>
  );
}
