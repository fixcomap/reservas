-- Precios, porcentaje de seña y montos de cada reserva

ALTER TABLE clubes
  ADD COLUMN senia_porcentaje int NOT NULL DEFAULT 50,
  ADD CONSTRAINT clubes_senia_porcentaje_check CHECK (senia_porcentaje BETWEEN 1 AND 100);

ALTER TABLE canchas
  ADD CONSTRAINT canchas_precio_check CHECK (precio >= 0);

UPDATE canchas SET precio = 20000 WHERE club_id = 1;

ALTER TABLE reservas
  ADD COLUMN monto_total  int,
  ADD COLUMN monto_senia  int,
  -- NULL en reservas que no son online
  ADD COLUMN tipo_pago    text CHECK (tipo_pago IN ('senia', 'total')),
  ADD COLUMN monto_pagado int NOT NULL DEFAULT 0;
