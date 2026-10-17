import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Front en 5173. /api/* se reenvía a la API (puerto 3000) sin el prefijo.
export default defineConfig({
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
});
