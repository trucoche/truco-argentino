import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

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