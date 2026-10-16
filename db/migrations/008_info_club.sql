-- Datos del club para la página de información (pantalla 1 del jugador)
-- y su edición en el panel. Todo nullable: un club puede no tener
-- todavía cargado el WhatsApp o el Instagram, por ejemplo, y la página
-- simplemente no muestra esa parte.
ALTER TABLE clubes
  ADD COLUMN direccion_completa text,
  ADD COLUMN localidad          text,
  ADD COLUMN telefono_whatsapp  text,
  ADD COLUMN instagram          text,
  ADD COLUMN mapa_consulta      text,
  ADD COLUMN servicios          text[] NOT NULL DEFAULT '{}';

-- Datos de ejemplo para el club 1, marcados a propósito como demo
-- (la dirección entre corchetes) para que no se confundan con datos
-- reales cuando el dueño todavía no cargó los suyos desde Ajustes.
UPDATE clubes
SET direccion_completa = '[Dirección del club]',
    localidad = 'Lomas de Zamora',
    mapa_consulta = '[Dirección del club], Lomas de Zamora',
    servicios = ARRAY['Wi-Fi', 'Vestuarios', 'Estacionamiento', 'Bar', 'Alquiler de paletas']
WHERE id = 1;
