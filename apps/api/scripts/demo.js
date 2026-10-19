// Carga los datos de demostración de db/demo.sql: npm run demo
// Solo si la base todavía no tiene ningún club (correr antes npm run migrar).

const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

const ARCHIVO = path.resolve(__dirname, '../../../db/demo.sql');

async function main() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(`SELECT to_regclass('public.clubes') IS NOT NULL AS existe`);
    if (!rows[0].existe) {
      console.error('La base no tiene las tablas. Corré primero: npm run migrar');
      process.exitCode = 1;
      return;
    }

    await client.query('BEGIN');
    // Bloquea la tabla para que dos "demo" no carguen los datos dos veces
    await client.query('LOCK TABLE clubes IN EXCLUSIVE MODE');
    const { rows: clubes } = await client.query('SELECT count(*)::int AS n FROM clubes');
    if (clubes[0].n > 0) {
      await client.query('ROLLBACK');
      console.log('La base ya tiene un club cargado: no se cargó nada.');
      return;
    }
    await client.query(fs.readFileSync(ARCHIVO, 'utf8'));
    await client.query('COMMIT');
    console.log('Listo: datos de demostración cargados (Club Demo, 2 canchas).');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

main()
  .catch((err) => {
    console.error('Error cargando los datos de demostración:', err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
