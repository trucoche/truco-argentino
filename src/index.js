import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { guardarOrigenInicial } from './utils/origenRegistro';

// Pase 706: guarda utm_source / utm_medium de la primera visita (para saber qué publicación trae jugadores).
guardarOrigenInicial();

// Pase 671: sin el margen de 8 px que trae el navegador por defecto (dejaba una franja blanca arriba/izquierda y
// corría todo hacia la derecha en el celular).
try { document.documentElement.style.margin = '0'; document.body.style.margin = '0'; } catch (e) {}

// Pase 652: al salir de una partida Phaser cierra su AudioContext (game.destroy) y, si en ese instante tenía un resume() pendiente,
// el navegador rechaza esa promesa con "AudioContext closed before a pending resume() could complete". Es inofensivo (el juego ya
// se destruyó), pero ensuciaba la consola con errores sin capturar: se ignora ese caso puntual y solo ese.
window.addEventListener('unhandledrejection', (evento) => {
  const motivo = evento && evento.reason;
  if (motivo && motivo.name === 'InvalidStateError' && /AudioContext closed/i.test(String(motivo.message || ''))) {
    evento.preventDefault();
  }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);