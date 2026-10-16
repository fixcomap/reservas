const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { Pool } = require('pg');

// Dos formas de conectarse:
// - En Cloud Run la cadena de conexión llega como archivo (DATABASE_URL_FILE,
//   un secreto de Secret Manager montado como volumen) y DB_NAME elige la base
//   del entorno: desarrollo usa reservas_dev en el mismo servidor.
// - En local, sin DATABASE_URL_FILE, la base de docker-compose.
function configuracion() {
  const archivo = process.env.DATABASE_URL_FILE;
  if (!archivo) {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: 5432,
      user: 'reservas',
      database: 'reservas',
      password: process.env.POSTGRES_PASSWORD,
    };
  }
  const url = new URL(fs.readFileSync(archivo, 'utf8').trim());
  if (process.env.DB_NAME) {
    url.pathname = '/' + process.env.DB_NAME;
  }
  return { connectionString: url.toString() };
}

const pool = new Pool(configuracion());

module.exports = pool;
