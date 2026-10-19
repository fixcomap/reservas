import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Front en 5173. /api/* se reenvía a la API (puerto 3000) sin el prefijo.
// El build de producción necesita VITE_API_URL (la API está en otro dominio).
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  if (command === 'build' && mode === 'production' && !/^https:\/\/[^/]+\/?$/.test(env.VITE_API_URL || '')) {
    throw new Error('Falta VITE_API_URL (ej: https://api-reservas.fixcomap.com) para el build de producción.');
  }

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (ruta) => ruta.replace(/^\/api/, ''),
        },
      },
    },
  };
});
