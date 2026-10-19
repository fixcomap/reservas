-- Pago con Mercado Pago (API de Órdenes).
-- token_hash: hash del link secreto /reserva/<token>
-- pago_estado: solo reservas online (NULL en el resto)

ALTER TABLE reservas
  ADD COLUMN token_hash  text UNIQUE,
  ADD COLUMN mp_order_id text UNIQUE,
  ADD COLUMN pago_estado text
    CHECK (pago_estado IN ('pendiente', 'aprobado', 'rechazado', 'reembolsado', 'reembolso_pendiente')),
  ADD COLUMN pagado_en   timestamptz;

UPDATE reservas SET pago_estado = 'pendiente' WHERE origen = 'online';

ALTER TABLE reservas
  ADD CONSTRAINT reservas_pago_estado_origen_check
  CHECK ((origen = 'online') = (pago_estado IS NOT NULL));

CREATE INDEX reservas_reembolso_pendiente_idx ON reservas (id)
  WHERE pago_estado = 'reembolso_pendiente';
