import { useState } from 'react';
import { login } from '../apiAdmin.js';
import { IconoCandado } from '../componentes/IconosAdmin.jsx';

// Pantalla de login del panel. Sin sesión, es lo único que se ve en /admin.
export default function Login({ onIngresar }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const [bloqueado, setBloqueado] = useState(false);

  async function enviar(evento) {
    evento.preventDefault();
    setError(null);
    setBloqueado(false);
    setEnviando(true);

    try {
      await login(email.trim(), password);
      onIngresar();
    } catch (err) {
      if (err.estado === 429) {
        setBloqueado(true);
      } else {
        setError(err.message || 'Email o contraseña incorrectos');
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="adm-login-fondo">
      <div className="adm-login-tarjeta tarjeta">
        <div className="adm-login-icono" aria-hidden="true">
          <IconoCandado />
        </div>
        <h1 className="adm-login-titulo">Panel del club</h1>
        <p className="letra-chica adm-login-bajada">Entrá con tu usuario de administrador.</p>

        <form onSubmit={enviar} noValidate>
          <div className="campo">
            <label htmlFor="adm-email">Email</label>
            <input
              id="adm-email"
              name="email"
              type="email"
              autoComplete="username"
              placeholder="dueno@tuclub.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="campo">
            <label htmlFor="adm-password">Contraseña</label>
            <input
              id="adm-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {bloqueado && (
            <p className="aviso-error" role="alert">
              Demasiados intentos. Esperá unos minutos y probá de nuevo.
            </p>
          )}
          {error && !bloqueado && (
            <p className="aviso-error" role="alert">
              {error}
            </p>
          )}

          <button type="submit" className="boton boton-verde boton-ancho" disabled={enviando || bloqueado}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
