import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AdminApp from './admin/AdminApp.jsx';
import EstadoReserva from './pantallas/EstadoReserva.jsx';
import './estilos.css';

// /admin -> panel, /reserva/<token> -> estado de la reserva, resto -> app del jugador
const ruta = window.location.pathname;
const esPanel = ruta.startsWith('/admin');
const tokenReserva = ruta.match(/^\/reserva\/([A-Za-z0-9_-]+)\/?$/)?.[1];

let pagina = <App />;
if (esPanel) pagina = <AdminApp />;
else if (tokenReserva) pagina = <EstadoReserva token={tokenReserva} />;

createRoot(document.getElementById('root')).render(<StrictMode>{pagina}</StrictMode>);
