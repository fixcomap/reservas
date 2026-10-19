-- Mail de confirmación del turno (se manda una sola vez)

ALTER TABLE reservas
  ADD COLUMN cliente_email                text,
  ADD COLUMN mail_confirmacion_enviado_en timestamptz;
