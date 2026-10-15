import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AdminApp from './admin/AdminApp.jsx';
import './estilos.css';

// Sin router: alcanza con mirar la URL una vez al cargar la página.
// /admin (y cualquier ruta debajo) muestra el panel del dueño; el resto
// es la app del jugador.
const esPanel = window.location.pathname.startsWith('/admin');

createRoot(document.getElementById('root')).render(
  <StrictMode>{esPanel ? <AdminApp /> : <App />}</StrictMode>
);
