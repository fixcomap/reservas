-- Mail de confirmación del turno.
--
-- cliente_email: lo pide el formulario de reserva online (obligatorio
--   ahí). NULL en las reservas viejas, las manuales, los bloqueos y los
--   turnos fijos: a esos no se les manda nada.
-- mail_confirmacion_enviado_en: cuándo se mandó el mail de "turno
--   confirmado". Sirve para mandarlo UNA sola vez aunque verificarPago,
--   el webhook y la vuelta del jugador lleguen todos juntos: el que
--   logra pasarlo de NULL a una fecha es el único que lo envía.

ALTER TABLE reservas
  ADD COLUMN cliente_email                text,
  ADD COLUMN mail_confirmacion_enviado_en timestamptz;
