-- Los turnos fijos ahora tienen una vigencia (desde cuándo, y hasta
-- cuándo si tienen fin) en vez de ocupar el horario para siempre.
ALTER TABLE turnos_fijos
  ADD COLUMN fecha_desde date NOT NULL DEFAULT current_date,
  ADD COLUMN fecha_hasta date NULL,
  ADD CONSTRAINT turnos_fijos_vigencia_check CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde);

-- Excepciones: un fijo puede liberar una fecha puntual sin dejar de
-- repetirse las demás semanas. UNIQUE evita cargar la misma fecha dos
-- veces para el mismo fijo.
CREATE TABLE turnos_fijos_excepciones (
  id            serial PRIMARY KEY,
  turno_fijo_id int NOT NULL REFERENCES turnos_fijos(id) ON DELETE CASCADE,
  fecha         date NOT NULL,
  motivo        text,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turno_fijo_id, fecha)
);
