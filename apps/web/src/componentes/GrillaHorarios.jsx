// Horarios que tienen al menos una cancha libre ese día.
export default function GrillaHorarios({ horarios, horaElegida, onElegir }) {
  return (
    <section className="bloque">
      <h2 className="titulo-seccion">Horarios disponibles</h2>
      <div className="horarios-grilla">
        {horarios.map((hora) => {
          const elegida = hora === horaElegida;
          return (
            <button
              key={hora}
              type="button"
              className={`hora-chip${elegida ? ' es-elegido' : ''}`}
              aria-pressed={elegida}
              onClick={() => onElegir(hora)}
            >
              {hora}
            </button>
          );
        })}
      </div>
    </section>
  );
}
