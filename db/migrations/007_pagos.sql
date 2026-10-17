-- Cobro con Mercado Pago (Checkout Pro vía la API de Órdenes).
--
-- token_hash: SHA-256 (en hex) del link secreto que recibe el jugador
--   al reservar (/reserva/<token>). El token en sí nunca se guarda:
--   si alguien lee la base, no puede armar los links de los jugadores.
-- mp_order_id: id de la orden de Mercado Pago ("ORD..."). Con este id
--   la API consulta la orden directo a Mercado Pago para saber si se
--   pagó; nunca se decide nada por lo que diga la URL de retorno.
-- pago_estado: solo para reservas online. Las manuales, los bloqueos y
--   los turnos fijos no pasan por Mercado Pago y lo tienen en NULL.
--   No hay DEFAULT de columna porque depende del origen: lo pone el
--   INSERT de POST /reservas, y el CHECK de abajo obliga a que sea así.
-- pagado_en: cuándo se confirmó el pago (lo que aprobó Mercado Pago).
-- mp_pago_id (ya existía en 001): id del pago dentro de la orden.

ALTER TABLE reservas
  ADD COLUMN token_hash  text UNIQUE,
  ADD COLUMN mp_order_id text UNIQUE,
  ADD COLUMN pago_estado text
    CHECK (pago_estado IN ('pendiente', 'aprobado', 'rechazado', 'reembolsado', 'reembolso_pendiente')),
  ADD COLUMN pagado_en   timestamptz;

-- Las reservas online que ya existían (de antes de integrar el cobro)
-- nunca se pagaron.
UPDATE reservas SET pago_estado = 'pendiente' WHERE origen = 'online';

ALTER TABLE reservas
  ADD CONSTRAINT reservas_pago_estado_origen_check
  CHECK ((origen = 'online') = (pago_estado IS NOT NULL));

-- El panel busca seguido las que esperan un reembolso; son pocas.
CREATE INDEX reservas_reembolso_pendiente_idx ON reservas (id)
  WHERE pago_estado = 'reembolso_pendiente';
