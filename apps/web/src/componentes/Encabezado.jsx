import { CLUB } from '../config.js';
import { IconoPersona, IconoPin } from './Iconos.jsx';

// Franja verde de arriba con la marca y el nombre del club.
export default function Encabezado() {
  return (
    <header className="encabezado">
      <div className="encabezado-marca">
        <div className="marca">
          {/* Logo provisorio hasta que haya uno de verdad */}
          <div className="marca-logo" aria-hidden="true">F</div>
          <div>
            <p className="marca-nombre">fixcomap</p>
            <p className="marca-bajada">Reservas</p>
          </div>
        </div>
        <button type="button" className="boton-cuenta" disabled aria-label="Mi cuenta">
          {/* TODO: cuentas de usuario, todavía no hay login */}
          <IconoPersona />
        </button>
      </div>

      <h1 className="club-nombre">{CLUB.nombre}</h1>
      <p className="club-direccion">
        <IconoPin />
        {CLUB.direccion}
      </p>
    </header>
  );
}
