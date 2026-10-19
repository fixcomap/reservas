-- Datos de demostración: un club con dos canchas, abierto todos los días de 09:00 a 24:00.
-- Todo es ficticio (sin direcciones, teléfonos ni cuentas reales). Se carga con npm run demo.

WITH club AS (
  INSERT INTO clubes (nombre, direccion, direccion_completa, localidad, servicios)
  VALUES (
    'Club Demo',
    'Ciudad Demo',
    'Calle Ficticia 123',
    'Ciudad Demo',
    ARRAY['Wi-Fi', 'Vestuario', 'Estacionamiento', 'Bar / Restaurante', 'Alquiler de paletas']
  )
  RETURNING id
),
canchas_demo AS (
  INSERT INTO canchas (club_id, nombre, descripcion, precio)
  SELECT club.id, c.nombre, c.descripcion, 20000
  FROM club, (VALUES ('Cancha 1', 'Blindex · Techada'), ('Cancha 2', 'Muro · Descubierta')) AS c(nombre, descripcion)
)
INSERT INTO horarios_apertura (club_id, dia_semana, abre, cierra)
SELECT club.id, d, '09:00', '24:00' FROM club, generate_series(0, 6) AS d;
