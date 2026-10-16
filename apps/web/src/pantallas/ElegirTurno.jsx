import { useState } from 'react';
import Encabezado from '../componentes/Encabezado.jsx';
import SelectorDia from '../componentes/SelectorDia.jsx';
import GrillaHorarios from '../componentes/GrillaHorarios.jsx';
import ListaCanchas from '../componentes/ListaCanchas.jsx';
import BarraInferior from '../componentes/BarraInferior.jsx';
import TuReserva from '../componentes/TuReserva.jsx';
import InfoClub from '../componentes/InfoClub.jsx';
import TabsClub from '../componentes/TabsClub.jsx';
import { Cargando, ErrorRed, SinTurnos } from '../componentes/Estados.jsx';
import { tituloCorto } from '../fechas.js';

// En celular y tablet (menos de 1024px) la pantalla 1 tiene dos
// pestañas: "Reservas" (lo de siempre) y "Detalles del club" (mapa,
// horarios, servicios, contacto). Arranca en "reservas", salvo que la
// URL traiga ?seccion=detalles (para que el club comparta un link
// directo a sus detalles, por ejemplo en Instagram). Desde 1024px las
// pestañas se ocultan (estilos.css) y las dos secciones se ven siempre,
// una debajo de la otra.
function seccionInicial() {
  const parametros = new URLSearchParams(window.location.search);
  return parametros.get('seccion') === 'detalles' ? 'detalles' : 'reservas';
}

// Pantalla 1: elegir día, horario y cancha.
//
// .p1-layout / .p1-principal son contenedores nuevos para el layout de
// escritorio (ver estilos.css): en celular y tablet no generan caja
// propia (display: contents), así que SelectorDia/GrillaHorarios/
// ListaCanchas quedan como hijos directos de .panel-reservas, igual
// que antes quedaban como hijos de .contenido. Recién desde 1024px se
// arma la grilla de dos columnas y aparece <TuReserva>, que ahí
// reemplaza a la barra fija de abajo.
export default function ElegirTurno({
  club,
  dias,
  fecha,
  hora,
  canchaId,
  horarios,
  canchasLibres,
  canchaElegida,
  cargando,
  error,
  aviso,
  onElegirFecha,
  onElegirHora,
  onElegirCancha,
  onReintentar,
  onContinuar,
}) {
  // Vive acá (no en App.jsx) porque es puramente de esta pantalla: lo
  // que el jugador ya eligió (día/hora/cancha) sigue en el estado de
  // App.jsx sin tocarse, así que cambiar de pestaña nunca lo pierde.
  const [seccion, setSeccion] = useState(seccionInicial);

  return (
    <>
      <div className={`pantalla-scroll${seccion === 'reservas' ? ' con-barra' : ''}`}>
        <Encabezado club={club} />

        <TabsClub seccion={seccion} onCambiar={setSeccion} />

        <div className={`contenido${seccion !== 'reservas' ? ' contenido-vacio' : ''}`}>
          <div
            className={`panel-reservas${seccion !== 'reservas' ? ' oculta-movil' : ''}`}
            id="panel-reservas"
            role="tabpanel"
            aria-labelledby="tab-reservas"
          >
            <div className="p1-layout">
              <div className="p1-principal">
                <SelectorDia dias={dias} fechaElegida={fecha} onElegir={onElegirFecha} />

                {/* Si alguien nos ganó el turno volvemos acá con este aviso */}
                {aviso && (
                  <p className="aviso-error" role="alert">
                    {aviso}
                  </p>
                )}

                {cargando && <Cargando />}
                {!cargando && error && <ErrorRed mensaje={error} onReintentar={onReintentar} />}
                {!cargando && !error && horarios.length === 0 && <SinTurnos />}

                {!cargando && !error && horarios.length > 0 && (
                  <>
                    <GrillaHorarios horarios={horarios} horaElegida={hora} onElegir={onElegirHora} />
                    {hora && (
                      <ListaCanchas
                        hora={hora}
                        canchas={canchasLibres}
                        canchaElegidaId={canchaId}
                        onElegir={onElegirCancha}
                      />
                    )}
                  </>
                )}
              </div>

              <TuReserva
                fecha={fecha}
                hora={hora}
                canchaElegida={canchaElegida}
                habilitado={Boolean(canchaElegida)}
                onContinuar={onContinuar}
              />
            </div>
          </div>
        </div>

        <InfoClub club={club} seccion={seccion} />
      </div>

      {/* La barra fija con "Continuar" es parte del flujo de reserva:
          en celular/tablet solo tiene sentido en la pestaña Reservas. */}
      {seccion === 'reservas' && (
        <BarraInferior
          resumen={hora ? `${tituloCorto(fecha)} · ${hora}` : tituloCorto(fecha)}
          nombreCancha={canchaElegida ? canchaElegida.nombre : 'Elegí una cancha'}
          habilitado={Boolean(canchaElegida)}
          onContinuar={onContinuar}
        />
      )}
    </>
  );
}
