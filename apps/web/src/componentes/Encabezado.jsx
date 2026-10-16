import { IconoPersona, IconoPin } from './Iconos.jsx';

// Arriba la marca, debajo la foto de portada del club y, superpuesta
// sobre el borde inferior de la foto, la tarjeta con nombre y dirección.
// `club` llega de GET /club (App.jsx): mientras no cargó, se muestra
// la tarjeta vacía nomás, no se inventa un nombre de relleno.
export default function Encabezado({ club }) {
  const direccion = [club?.direccion, club?.localidad].filter(Boolean).join(', ');

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

      <div className="encabezado-foto-wrap">
        <img className="encabezado-foto" src="/club.jpg" alt="Cancha de pádel del club" />
      </div>

      <div className="encabezado-info">
        <h1 className="club-nombre">{club?.nombre}</h1>
        {direccion && (
          <p className="club-direccion">
            <IconoPin />
            {direccion}
          </p>
        )}
        {/* Nueva en escritorio: en celular/tablet no se muestra (el
            mapa queda a un scroll de distancia nomás). */}
        {club?.mapa_consulta && (
          <a className="club-link-mapa" href="#panel-detalles">
            Ver en mapa
          </a>
        )}
      </div>
    </header>
  );
}
