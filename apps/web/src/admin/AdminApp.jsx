import { useEffect, useState } from 'react';
import Login from './pantallas/Login.jsx';
import Agenda from './pantallas/Agenda.jsx';
import TurnosFijos from './pantallas/TurnosFijos.jsx';
import Ajustes from './pantallas/Ajustes.jsx';
import BarraInferiorAdmin from './componentes/BarraInferiorAdmin.jsx';
import BarraLateralAdmin from './componentes/BarraLateralAdmin.jsx';
import { getYo, logout, escucharPerdidaDeSesion } from './apiAdmin.js';
import './estilosAdmin.css';

// Panel del dueño: login o pantallas según la sesión.
export default function AdminApp() {
  // null = todavía no sabemos, false = no hay sesión, objeto = logueado
  const [sesion, setSesion] = useState(null);
  const [pestania, setPestania] = useState('agenda');

  // Cualquier 401 vuelve al login
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

  // Desde 1024px: barra lateral + contenido
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
