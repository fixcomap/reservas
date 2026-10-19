// Crea un administrador para el club 1: npm run crear-admin
// (pide email y contraseña por consola, no por argumentos)

const readline = require('readline');
const pool = require('../src/db');
const { hashPassword } = require('../src/auth');

const CLUB_ID = 1;
const LARGO_MINIMO = 12;
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function preguntar(texto) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(texto, (respuesta) => {
      rl.close();
      resolve(respuesta.trim());
    });
  });
}

// Lee una línea sin mostrar lo que se tipea
function preguntarOculto(texto) {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    if (!stdin.isTTY) {
      reject(new Error('Este script necesita correrse en una terminal interactiva.'));
      return;
    }

    process.stdout.write(texto);
    let buffer = '';

    const alTerminar = () => {
      stdin.removeListener('data', onData);
      stdin.setRawMode(false);
      stdin.pause();
    };

    const onData = (chunk) => {
      const texto = chunk.toString('utf8');
      for (const char of texto) {
        if (char === '\n' || char === '\r') {
          alTerminar();
          process.stdout.write('\n');
          resolve(buffer);
          return;
        }
        if (char === '\u0003') {
          // Ctrl+C
          alTerminar();
          process.stdout.write('\n');
          process.exit(1);
        }
        if (char === '\u007f' || char === '\b') {
          buffer = buffer.slice(0, -1);
          continue;
        }
        buffer += char;
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
  });
}

async function main() {
  const { rows: clubRows } = await pool.query('SELECT nombre FROM clubes WHERE id = $1', [CLUB_ID]);
  if (clubRows.length === 0) {
    console.error(`No existe el club ${CLUB_ID}. Corré npm run migrar y después npm run demo (o cargá el club) antes de crear un admin.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Creando administrador para "${clubRows[0].nombre}" (club ${CLUB_ID}).\n`);

  const emailCrudo = await preguntar('Email: ');
  const email = emailCrudo.toLowerCase();
  if (!RE_EMAIL.test(email)) {
    console.error('Ese email no parece válido.');
    process.exitCode = 1;
    return;
  }

  const { rows: existeRows } = await pool.query('SELECT id FROM administradores WHERE email = $1', [email]);
  if (existeRows.length > 0) {
    console.error('Ya existe un administrador con ese email.');
    process.exitCode = 1;
    return;
  }

  const password = await preguntarOculto('Contraseña (mínimo 12 caracteres, no se muestra): ');
  if (password.length < LARGO_MINIMO) {
    console.error(`La contraseña tiene que tener al menos ${LARGO_MINIMO} caracteres.`);
    process.exitCode = 1;
    return;
  }

  const confirmacion = await preguntarOculto('Repetila: ');
  if (confirmacion !== password) {
    console.error('Las dos contraseñas no coinciden.');
    process.exitCode = 1;
    return;
  }

  const hash = await hashPassword(password);
  const { rows } = await pool.query(
    'INSERT INTO administradores (club_id, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
    [CLUB_ID, email, hash]
  );

  console.log(`\nListo: administrador #${rows[0].id} (${email}) creado para el club ${CLUB_ID}.`);
}

main()
  .catch((err) => {
    console.error('Error creando el administrador:', err.message);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end();
  });
