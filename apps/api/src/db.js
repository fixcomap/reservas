const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool(config.db);

// Una conexión inactiva que se corta (Neon las cierra al suspenderse)
// no tiene que tirar abajo la API
pool.on('error', (err) => {
  console.error(`Conexión a la base cerrada: ${err.message}`);
});

module.exports = pool;
