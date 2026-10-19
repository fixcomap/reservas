import { agruparHorarios } from '../fechas.js';
import {
  IconoPin,
  IconoReloj,
  IconoWhatsApp,
  IconoInstagram,
  IconoWifi,
  IconoVestuario,
  IconoGimnasio,
  IconoEstacionamiento,
  IconoAyudaMedica,
  IconoTorneos,
  IconoCumpleanos,
  IconoParrilla,
  IconoEscuelita,
  IconoColegios,
  IconoBarRestaurante,
  IconoQuincho,
  IconoPaletas,
  IconoServicio,
} from './Iconos.jsx';

// Un ícono por servicio (misma lista que config.js)
const ICONO_SERVICIO = {
  'Wi-Fi': IconoWifi,
  Vestuario: IconoVestuario,
  Gimnasio: IconoGimnasio,
  Estacionamiento: IconoEstacionamiento,
  'Ayuda médica': IconoAyudaMedica,
  Torneos: IconoTorneos,
  Cumpleaños: IconoCumpleanos,
  Parrilla: IconoParrilla,
  Escuelita: IconoEscuelita,
  Colegios: IconoColegios,
  'Bar / Restaurante': IconoBarRestaurante,
  Quincho: IconoQuincho,
  'Alquiler de paletas': IconoPaletas,
};

// "Dónde estamos": mapa, horarios, servicios y contacto (datos de GET /club)
export default function InfoClub({ club, seccion }) {
  if (!club) return null;

  const direccion = [club.direccion, club.localidad].filter(Boolean).join(', ');
  const horarios = club.horarios?.length ? agruparHorarios(club.horarios) : [];
  const servicios = club.servicios || [];
  const hayMapa = Boolean(club.mapa_consulta);
  const hayAlgo = hayMapa || direccion || horarios.length > 0 || servicios.length > 0;
  const linkWhatsApp = club.whatsapp ? `https://wa.me/${club.whatsapp}` : null;
  const linkInstagram = club.instagram ? `https://instagram.com/${club.instagram}` : null;

  return (
    <>
      {hayAlgo && (
        <section
          className={`info-club${seccion !== 'detalles' ? ' oculta-movil' : ''}`}
          id="panel-detalles"
          role="tabpanel"
          aria-labelledby="tab-detalles"
        >
          <div className="info-club-interior">
            <h2 className="info-club-titulo">Dónde estamos</h2>

            <div className="info-club-grilla">
              {hayMapa && (
                <div className="info-club-mapa-wrap">
                  <iframe
                    className="info-club-mapa"
                    src={`https://www.google.com/maps?q=${encodeURIComponent(club.mapa_consulta)}&output=embed`}
                    title={`Ubicación de ${club.nombre} en el mapa`}
                    loading="lazy"
                  />
                </div>
              )}

              <div className="info-club-tarjetas">
                {direccion && (
                  <div className="info-tarjeta">
                    <h3 className="info-tarjeta-titulo">
                      <IconoPin tamanio={18} /> Ubicación
                    </h3>
                    <p className="info-tarjeta-texto">{direccion}</p>
                  </div>
                )}

                {horarios.length > 0 && (
                  <div className="info-tarjeta">
                    <h3 className="info-tarjeta-titulo">
                      <IconoReloj tamanio={18} /> Horarios del club
                    </h3>
                    <ul className="info-horarios-lista">
                      {horarios.map((h) => (
                        <li key={h.texto}>{h.texto}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {servicios.length > 0 && (
                  <div className="info-tarjeta">
                    <h3 className="info-tarjeta-titulo">
                      <IconoServicio tamanio={18} /> Servicios
                    </h3>
                    <ul className="info-servicios-lista">
                      {servicios.map((s) => {
                        const Icono = ICONO_SERVICIO[s] || IconoServicio;
                        return (
                          <li key={s}>
                            <Icono tamanio={18} />
                            {s}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {(linkWhatsApp || linkInstagram) && (
              <div className="info-club-contacto">
                {linkWhatsApp && (
                  <a className="boton-contacto boton-contacto-whatsapp" href={linkWhatsApp} target="_blank" rel="noreferrer">
                    <IconoWhatsApp tamanio={18} /> Escribir por WhatsApp
                  </a>
                )}
                {linkInstagram && (
                  <a className="boton-contacto boton-contacto-instagram" href={linkInstagram} target="_blank" rel="noreferrer">
                    <IconoInstagram tamanio={18} /> @{club.instagram}
                  </a>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <footer className="club-footer">
        <p className="club-footer-nombre">{club.nombre}</p>
        {(direccion || linkWhatsApp || linkInstagram) && (
          <p className="club-footer-linea">
            {direccion}
            {direccion && (linkWhatsApp || linkInstagram) ? ' · ' : ''}
            {linkWhatsApp && <a href={linkWhatsApp} target="_blank" rel="noreferrer">WhatsApp</a>}
            {linkWhatsApp && linkInstagram ? ' · ' : ''}
            {linkInstagram && <a href={linkInstagram} target="_blank" rel="noreferrer">Instagram</a>}
          </p>
        )}
        <p className="club-footer-fixcomap">Reservas por fixcomap</p>
      </footer>
    </>
  );
}
