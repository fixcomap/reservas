-- Precios y forma de pago (seña o total). Mercado Pago todavía no está
-- integrado: estas columnas dejan la plata calculada y guardada, listas
-- para cuando se conecte el cobro de verdad.

ALTER TABLE clubes
  ADD COLUMN senia_porcentaje int NOT NULL DEFAULT 50,
  ADD CONSTRAINT clubes_senia_porcentaje_check CHECK (senia_porcentaje BETWEEN 1 AND 100);

ALTER TABLE canchas
  ADD CONSTRAINT canchas_precio_check CHECK (precio >= 0);

UPDATE canchas SET precio = 20000 WHERE club_id = 1;

ALTER TABLE reservas
  ADD COLUMN monto_total  int,
  ADD COLUMN monto_senia  int,
  -- NULL para reservas manuales, bloqueos y turnos fijos: ninguno de
  -- esos pasa por la elección de seña/total del jugador. El CHECK no
  -- necesita "OR tipo_pago IS NULL" aparte: en SQL, NULL IN (...) da
  -- NULL, y un CHECK solo rechaza cuando da false, así que un NULL ya
  -- pasa solo.
  ADD COLUMN tipo_pago    text CHECK (tipo_pago IN ('senia', 'total')),
  ADD COLUMN monto_pagado int NOT NULL DEFAULT 0;
