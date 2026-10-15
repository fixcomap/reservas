// Barra fija de abajo en la pantalla de elegir turno.
export default function BarraInferior({ resumen, nombreCancha, habilitado, onContinuar }) {
  return (
    <div className="barra-fija">
      <div className="barra-fija-interior barra-continuar">
        <div className="barra-resumen">
          <p className="barra-resumen-linea">{resumen}</p>
          <p className="barra-resumen-cancha">{nombreCancha}</p>
        </div>
        <button
          type="button"
          className="boton boton-verde"
          disabled={!habilitado}
          onClick={onContinuar}
        >
          Continuar
        </button>
      </div>
    </div>
  );
}
