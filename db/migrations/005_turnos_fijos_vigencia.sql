-- Vigencia de los turnos fijos (fecha_hasta NULL = sin fin)
ALTER TABLE turnos_fijos
  ADD COLUMN fecha_desde date NOT NULL DEFAULT current_date,
  ADD COLUMN fecha_hasta date NULL,
  ADD CONSTRAINT turnos_fijos_vigencia_check CHECK (fecha_hasta IS NULL OR fecha_hasta >= fecha_desde);

-- Fechas puntuales liberadas de un turno fijo
CREATE TABLE turnos_fijos_excepciones (
  id            serial PRIMARY KEY,
  turno_fijo_id int NOT NULL REFERENCES turnos_fijos(id) ON DELETE CASCADE,
  fecha         date NOT NULL,
  motivo        text,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (turno_fijo_id, fecha)
);
