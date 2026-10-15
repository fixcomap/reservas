-- Login del dueño del club y sus sesiones activas.

CREATE TABLE administradores (
  id            serial PRIMARY KEY,
  club_id       int NOT NULL REFERENCES clubes(id),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  -- El email siempre se guarda en minúsculas: la app ya lo normaliza antes
  -- de insertar, y este CHECK es una segunda barrera por si algún día se
  -- inserta desde otro lado.
  CONSTRAINT administradores_email_minusculas CHECK (email = lower(email))
);

-- Cada fila es una sesión de navegador. No guardamos el token que recibe
-- el admin en la cookie, solo su hash: si alguien lee la base no puede
-- usar esos valores para autenticarse, porque no tiene el token original.
CREATE TABLE sesiones (
  id         serial PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  admin_id   int NOT NULL REFERENCES administradores(id) ON DELETE CASCADE,
  expira_en  timestamptz NOT NULL,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

-- Para buscar/borrar rápido las sesiones de un admin (por ejemplo al
-- cambiarle la contraseña, en el futuro, habría que invalidarlas todas).
CREATE INDEX sesiones_admin_id_idx ON sesiones (admin_id);
