const fs = require('fs');
const path = require('path');
const pool = require('./db');

// Aplica db/migrations/*.sql en orden, cada una una sola vez, y anota cuáles
// ya corrió en la tabla schema_migrations. Corre al arrancar la API, así una
// base nueva (Neon en producción y desarrollo) queda lista sin pasos a mano.
const DIR = process.env.MIGRATIONS_DIR || path.resolve(__dirname, '../../../db/migrations');

// Número cualquiera pero fijo: si arrancan dos instancias a la vez, la
// segunda espera a que la primera termine en vez de migrar en paralelo.
const LOCK_MIGRACIONES = 727274;

async function migrar() {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [LOCK_MIGRACIONES]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        nombre text PRIMARY KEY,
        aplicada_en timestamptz NOT NULL DEFAULT now()
      )`);

    const archivos = fs.readdirSync(DIR).filter((f) => f.endsWith('.sql')).sort();

    // Base creada por docker-compose (docker-entrypoint-initdb.d corre todas
    // las migraciones al crear el volumen) antes de que existiera esta tabla:
    // se dan por aplicadas en vez de volver a correrlas.
    const { rows: [{ anotadas }] } = await client.query('SELECT count(*)::int AS anotadas FROM schema_migrations');
    const { rows: [{ hayEsquema }] } = await client.query(
      "SELECT to_regclass('public.clubes') IS NOT NULL AS \"hayEsquema\""
    );
    if (anotadas === 0 && hayEsquema) {
      for (const nombre of archivos) {
        await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [nombre]);
      }
      console.log(`migraciones: base existente, ${archivos.length} anotadas como aplicadas`);
      return;
    }

    for (const nombre of archivos) {
      const { rowCount } = await client.query('SELECT 1 FROM schema_migrations WHERE nombre = $1', [nombre]);
      if (rowCount > 0) continue;
      const sql = fs.readFileSync(path.join(DIR, nombre), 'utf8');
      // Cada migración en su transacción: si falla, no queda a medias ni anotada.
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (nombre) VALUES ($1)', [nombre]);
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`migración ${nombre}: ${err.message}`);
      }
      console.log(`migraciones: ${nombre} aplicada`);
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [LOCK_MIGRACIONES]).catch(() => {});
    client.release();
  }
}

module.exports = migrar;
