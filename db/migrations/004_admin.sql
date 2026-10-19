-- Login del dueño del club y sus sesiones activas.

CREATE TABLE administradores (
  id            serial PRIMARY KEY,
  club_id       int NOT NULL REFERENCES clubes(id),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  creado_en     timestamptz NOT NULL DEFAULT now(),
  -- Email siempre en minúsculas
  CONSTRAINT administradores_email_minusculas CHECK (email = lower(email))
);

-- Se guarda el hash del token de la cookie, nunca el token
CREATE TABLE sesiones (
  id         serial PRIMARY KEY,
  token_hash text NOT NULL UNIQUE,
  admin_id   int NOT NULL REFERENCES administradores(id) ON DELETE CASCADE,
  expira_en  timestamptz NOT NULL,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX sesiones_admin_id_idx ON sesiones (admin_id);
