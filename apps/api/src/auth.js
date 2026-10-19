const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('./db');
const config = require('./config');

const COSTO_BCRYPT = 12;

const DURACION_SESION_MS = 8 * 60 * 60 * 1000; // 8 horas
const NOMBRE_COOKIE = 'sesion';

function hashPassword(password) {
  return bcrypt.hash(password, COSTO_BCRYPT);
}

function verificarPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// Hash para comparar cuando el email no existe (mismo tiempo de respuesta)
let hashFalsoCache = null;
function hashFalso() {
  if (!hashFalsoCache) {
    hashFalsoCache = bcrypt.hash(crypto.randomBytes(32).toString('hex'), COSTO_BCRYPT);
  }
  return hashFalsoCache;
}

// Token de sesión: va en la cookie; en la base se guarda solo su hash
function generarToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function opcionesCookie() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    path: '/',
    secure: config.esProduccion, // HTTPS solo en producción
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
  res.clearCookie(NOMBRE_COOKIE, opcionesCookie());
}

// Middleware de /admin/*: valida la sesión y deja el admin en req.admin
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
      res.clearCookie(NOMBRE_COOKIE, opcionesCookie());
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
