CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE clubes (
  id           serial PRIMARY KEY,
  nombre       text NOT NULL,
  direccion    text,
  zona_horaria text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
  creado_en    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE canchas (
  id           serial PRIMARY KEY,
  club_id      int NOT NULL REFERENCES clubes(id),
  nombre       text NOT NULL,
  descripcion  text,
  duracion_min int NOT NULL DEFAULT 90,
  precio       int NOT NULL,
  activa       boolean NOT NULL DEFAULT true
);

CREATE TABLE horarios_apertura (
  id         serial PRIMARY KEY,
  club_id    int NOT NULL REFERENCES clubes(id),
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6), -- 0 = domingo
  abre       time NOT NULL,
  cierra     time NOT NULL
);

CREATE TABLE turnos_fijos (
  id             serial PRIMARY KEY,
  cancha_id      int NOT NULL REFERENCES canchas(id),
  dia_semana     smallint NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio    time NOT NULL,
  cliente_nombre text NOT NULL,
  cliente_tel    text,
  activo         boolean NOT NULL DEFAULT true
);

CREATE TABLE reservas (
  id             serial PRIMARY KEY,
  cancha_id      int NOT NULL REFERENCES canchas(id),
  horario        tstzrange NOT NULL,
  estado         text NOT NULL CHECK (estado IN ('retenida', 'confirmada', 'cancelada')),
  origen         text NOT NULL CHECK (origen IN ('online', 'manual', 'fijo', 'bloqueo')),
  cliente_nombre text,
  cliente_tel    text,
  vence_en       timestamptz,
  mp_pago_id     text,
  creado_en      timestamptz NOT NULL DEFAULT now(),
  EXCLUDE USING gist (cancha_id WITH =, horario WITH &&)
    WHERE (estado IN ('retenida', 'confirmada'))
);