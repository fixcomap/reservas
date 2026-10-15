const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('./db');

// Costo de bcrypt: cuántas vueltas de hash le da a cada contraseña.
// Más alto = más lento de calcular = más caro de atacar por fuerza
// bruta si se filtra la base. 12 es el mínimo recomendado hoy en día.
const COSTO_BCRYPT = 12;

const DURACION_SESION_MS = 8 * 60 * 60 * 1000; // 8 horas
const NOMBRE_COOKIE = 'sesion';

function hashPassword(password) {
  return bcrypt.hash(password, COSTO_BCRYPT);
}

function verificarPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Un hash válido (de una contraseña que nadie va a tipear nunca) para
// comparar cuando el email no existe. Si no hiciéramos esto, un login
// con email inexistente respondería más rápido que uno con email real
// y contraseña incorrecta, y esa diferencia de tiempo le dice a un
// atacante qué emails están registrados sin que haga falta otra cosa.
// Se calcula una sola vez y se reusa.
let hashFalsoCache = null;
function hashFalso() {
  if (!hashFalsoCache) {
    hashFalsoCache = bcrypt.hash(crypto.randomBytes(32).toString('hex'), COSTO_BCRYPT);
  }
  return hashFalsoCache;
}

// Token de sesión: 32 bytes al azar, suficiente para que adivinarlo por
// fuerza bruta sea inviable. Se lo mandamos al navegador en la cookie,
// pero en la base guardamos solo su hash (sha256 alcanza acá: no es una
// contraseña de humano, ya es al azar y de 256 bits, no hace falta
// bcrypt). Si alguien lee la tabla "sesiones" no puede armar la cookie
// a partir de lo que ve.
function generarToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function opcionesCookie() {
  return {
    httpOnly: true, // JavaScript del navegador no puede leer la cookie (protege contra XSS)
    sameSite: 'strict', // el navegador no la manda en pedidos que vienen de otros sitios (protege contra CSRF)
    path: '/',
    // secure exige HTTPS. En desarrollo local (http://localhost) lo
    // dejamos apagado o el navegador directamente descarta la cookie.
    secure: process.env.NODE_ENV === 'production',
    maxAge: DURACION_SESION_MS,
  };
}

async function crearSesion(res, adminId) {
  const token = generarToken();
  const expiraEn = new Date(Date.now() + DURACION_SESION_MS);
  await pool.query('INSERT INTO sesiones (token_hash, admin_id, expira_en) VALUES ($1, $2, $3)', [
    hashToken(token),
    adminId,
    expiraEn,
  ]);
  res.cookie(NOMBRE_COOKIE, token, opcionesCookie());
}

async function destruirSesion(req, res) {
  const token = req.cookies?.[NOMBRE_COOKIE];
  if (token) {
    await pool.query('DELETE FROM sesiones WHERE token_hash = $1', [hashToken(token)]);
  }
  res.clearCookie(NOMBRE_COOKIE, { path: '/' });
}

// Protege todas las rutas /admin/* salvo /admin/login. Valida la cookie
// contra la base (tiene que existir y no estar vencida) y deja el admin
// y su club en req.admin para que cada ruta filtre por ese club_id.
async function requireAdmin(req, res, next) {
  const token = req.cookies?.[NOMBRE_COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT a.id, a.email, a.club_id, s.expira_en
       FROM sesiones s
       JOIN administradores a ON a.id = s.admin_id
       WHERE s.token_hash = $1`,
      [hashToken(token)]
    );

    const sesion = rows[0];
    if (!sesion || new Date(sesion.expira_en) < new Date()) {
      // La cookie que mandó el navegador ya no sirve (vencida o no
      // existe en la base): se la sacamos para que no siga insistiendo.
      res.clearCookie(NOMBRE_COOKIE, { path: '/' });
      return res.status(401).json({ error: 'Sesión inválida o vencida' });
    }

    req.admin = { id: sesion.id, email: sesion.email, clubId: sesion.club_id };
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error interno' });
  }
}

module.exports = {
  COSTO_BCRYPT,
  NOMBRE_COOKIE,
  hashPassword,
  verificarPassword,
  hashFalso,
  crearSesion,
  destruirSesion,
  requireAdmin,
};
