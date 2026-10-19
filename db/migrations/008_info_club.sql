-- Datos públicos del club (se editan desde Ajustes)
ALTER TABLE clubes
  ADD COLUMN direccion_completa text,
  ADD COLUMN localidad          text,
  ADD COLUMN telefono_whatsapp  text,
  ADD COLUMN instagram          text,
  ADD COLUMN mapa_consulta      text,
  ADD COLUMN servicios          text[] NOT NULL DEFAULT '{}';

