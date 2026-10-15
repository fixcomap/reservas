import Encabezado from '../componentes/Encabezado.jsx';
import SelectorDia from '../componentes/SelectorDia.jsx';
import GrillaHorarios from '../componentes/GrillaHorarios.jsx';
import ListaCanchas from '../componentes/ListaCanchas.jsx';
import BarraInferior from '../componentes/BarraInferior.jsx';
import { Cargando, ErrorRed, SinTurnos } from '../componentes/Estados.jsx';
import { tituloCorto } from '../fechas.js';

// Pantalla 1: elegir día, horario y cancha.
export default function ElegirTurno({
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
  return (
    <>
      <div className="pantalla-scroll con-barra">
        <Encabezado />

        <div className="contenido">
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
      </div>

      <BarraInferior
        resumen={hora ? `${tituloCorto(fecha)} · ${hora}` : tituloCorto(fecha)}
        nombreCancha={canchaElegida ? canchaElegida.nombre : 'Elegí una cancha'}
        habilitado={Boolean(canchaElegida)}
        onContinuar={onContinuar}
      />
    </>
  );
}
