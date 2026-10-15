import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// El front corre en 5173 y la API en 3000. Sin proxy el navegador
// bloquearía los pedidos por CORS, así que todo lo que empiece con /api
// se reenvía a la API sacándole ese prefijo: /api/disponibilidad -> /disponibilidad
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
