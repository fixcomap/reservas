// Aplica en orden las migraciones pendientes de db/migrations: npm run migrar
// Se conecta a DATABASE_URL (o al Postgres local del docker-compose si no está).
// Cada migración corre en su propia transacción y queda anotada en schema_migraciones.

const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

const CARPETA = path.resolve(__dirname, '../../../db/migrations');
const ID_LOCK = 72730001; // evita que dos "migrar" corran a la vez

// Bases creadas antes de que existiera el registro (el Docker local aplicaba
// las migraciones solo). Para cada una, cómo saber si ya está aplicada.
const PREVIAS_AL_REGISTRO = {
  '001_inicial.sql': `to_regclass('public.reservas') IS NOT NULL`,
  '004_admin.sql': `to_regclass('public.administradores') IS NOT NULL`,
  '005_turnos_fijos_vigencia.sql': `to_regclass('public.turnos_fijos_excepciones') IS NOT NULL`,
  '006_precios.sql': columna('clubes', 'senia_porcentaje'),
  '007_pagos.sql': columna('reservas', 'token_hash'),
  '008_info_club.sql': columna('clubes', 'servicios'),
  '009_email.sql': columna('reservas', 'cliente_email'),
};

function columna(tabla, nombre) {
  return `EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = '${tabla}' AND column_name = '${nombre}')`;
}

async function crearRegistro(client) {
  const { rows } = await client.query(`SELECT to_regclass('public.schema_migraciones') IS NOT NULL AS existe`);
  if (rows[0].existe) return;

  await client.query(`
    CREATE TABLE schema_migraciones (
      nombre      text PRIMARY KEY,
      aplicada_en timestamptz NOT NULL DEFAULT now()
    )`);

  // Base que ya tenía tablas: anota las migraciones que ya estaban aplicadas
  for (const [nombre, condicion] of Object.entries(PREVIAS_AL_REGISTRO)) {
    const { rows: r } = await client.query(`SELECT ${condicion} AS aplicada`);
    if (r[0].aplicada) {
      await client.query('INSERT INTO schema_migraciones (nombre) VALUES ($1)', [nombre]);
      console.log(`Ya estaba aplicada (base existente): ${nombre}`);
    }
  }
}

async function main() {
  const archivos = fs
    .readdirSync(CARPETA)
    .filter((f) => /^\d+_[\w-]+\.sql$/.test(f))
    .sort();

  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [ID_LOCK]);
    await crearRegistro(client);

    const { rows } = await client.query('SELECT nombre FROM schema_migraciones');
    const aplicadas = new Set(rows.map((r) => r.nombre));
    const pendientes = archivos.filter((f) => !aplicadas.has(f));

    if (pendientes.length === 0) {
      console.log('No hay migraciones pendientes.');
      return;
    }

    for (const archivo of pendientes) {
      const sql = fs.readFileSync(path.join(CARPETA, archivo), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migraciones (nombre) VALUES ($1)', [archivo]);
        await client.query('COMMIT');
        console.log(`Aplicada: ${archivo}`);
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        throw new Error(`${archivo}: ${err.message}`);
      }
    }
    console.log(`Listo: ${pendientes.length} migración(es) aplicada(s).`);
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [ID_LOCK]).catch(() => {});
    client.release();
  }
}

main()
  .catch((err) => {
    console.error('Error aplicando migraciones:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
