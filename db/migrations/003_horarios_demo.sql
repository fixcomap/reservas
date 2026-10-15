-- Club Demo abre todos los dias de 09:00 a 24:00
INSERT INTO horarios_apertura (club_id, dia_semana, abre, cierra)
SELECT 1, d, '09:00', '24:00' FROM generate_series(0, 6) AS d;