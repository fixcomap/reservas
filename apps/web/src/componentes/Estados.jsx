// Cargando, error y sin turnos.

export function Cargando() {
  return (
    <div className="estado" role="status" aria-live="polite">
      <div className="estado-spinner" aria-hidden="true" />
      <p className="estado-texto">Buscando turnos…</p>
    </div>
  );
}

export function ErrorRed({ mensaje, onReintentar }) {
  return (
    <div className="estado" role="alert">
      <p className="estado-titulo">No pudimos cargar los turnos</p>
      <p className="estado-texto">{mensaje}</p>
      <button type="button" className="boton boton-verde" onClick={onReintentar}>
        Reintentar
      </button>
    </div>
  );
}

export function SinTurnos() {
  return (
    <div className="estado" role="status">
      <p className="estado-titulo">No quedan turnos libres para este día</p>
      <p className="estado-texto">Probá con otro día del selector de arriba.</p>
    </div>
  );
}
