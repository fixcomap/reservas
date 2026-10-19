#!/bin/sh
# Primer arranque del Postgres local (volumen vacío): aplica las migraciones,
# las anota en schema_migraciones (igual que npm run migrar) y carga los datos de demo.
set -e

psql_reservas() {
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" "$@"
}

psql_reservas -c "CREATE TABLE schema_migraciones (nombre text PRIMARY KEY, aplicada_en timestamptz NOT NULL DEFAULT now());"

for archivo in /reservas-db/migrations/*.sql; do
  nombre=$(basename "$archivo")
  echo "Migración: $nombre"
  psql_reservas --single-transaction -f "$archivo" -c "INSERT INTO schema_migraciones (nombre) VALUES ('$nombre');"
done

echo "Datos de demostración"
psql_reservas --single-transaction -f /reservas-db/demo.sql
