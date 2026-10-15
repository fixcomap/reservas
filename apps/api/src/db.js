const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: 5432,
  user: 'reservas',
  database: 'reservas',
  password: process.env.POSTGRES_PASSWORD,
});

module.exports = pool;