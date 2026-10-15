// Tira horizontal con los próximos 7 días.
export default function SelectorDia({ dias, fechaElegida, onElegir }) {
  return (
    <section className="tarjeta selector-dia">
      <div className="selector-dia-titulo">
        <h2>Elegí el día</h2>
        <span>Hasta 7 días antes</span>
      </div>

      <div className="dias-scroll">
        {dias.map((dia) => {
          const elegido = dia.iso === fechaElegida;
          return (
            <button
              key={dia.iso}
              type="button"
              className={`dia-chip${elegido ? ' es-elegido' : ''}`}
              aria-label={dia.nombreAccesible}
              aria-pressed={elegido}
              onClick={() => onElegir(dia.iso)}
            >
              <span className="dia-etiqueta">{dia.etiqueta}</span>
              <span className="dia-numero">{dia.numero}</span>
              <span className="dia-mes">{dia.mes}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
