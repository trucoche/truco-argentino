import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../../services/socket';

// Pase 440: señas rústicas dibujadas en trazo grueso (sin texto ni emojis). Heredan el color del botón.
// Cartas escondidas: ojo guiñado (párpado cerrado con pestañas).
function IconoGuinio() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12 Q14 20 24 12" />
      <path d="M7 16.2 L5.2 19" />
      <path d="M14 18 L14 21.2" />
      <path d="M21 16.2 L22.8 19" />
      <path d="M5 7.5 Q14 3 23 7.5" strokeWidth="2" />
    </svg>
  );
}

// Cartas a la vista: ojo bien abierto con la ceja levantada y un destello dorado.
function IconoOjoBrillante() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 15 Q14 5 25 15 Q14 25 3 15 Z" />
      <circle cx="14" cy="15" r="4.2" fill="currentColor" stroke="none" />
      <circle cx="15.6" cy="13.4" r="1.5" fill="#FFF8E1" stroke="none" />
      <path d="M6 7.6 Q13 1.6 22 5.4" strokeWidth="2" />
      <path d="M24.5 3 L24.5 6.5 M22.8 4.8 L26.2 4.8" strokeWidth="1.6" />
    </svg>
  );
}

export default function CompartirManoBoton({ codigoSala, esEquipos }) {
  const [activo, setActivo] = useState(false);
  // Pase 432: enfriamiento de 3 s tras cada clic (antispam) — el botón queda oscurecido y sin respuesta.
  const [enfriando, setEnfriando] = useState(false);
  const timerEnfriamiento = useRef(null);
  useEffect(() => () => clearTimeout(timerEnfriamiento.current), []);

  useEffect(() => {
    const socket = getSocket();
    const handler = (data) => setActivo(!!data.compartiendoMiMano);
    socket.on('estado-juego', handler);
    return () => socket.off('estado-juego', handler);
  }, []);

  if (!esEquipos) return null;

  const alternar = () => {
    if (enfriando) return;
    getSocket().emit('alternar-compartir-mano', { codigoSala });
    setEnfriando(true);
    timerEnfriamiento.current = setTimeout(() => setEnfriando(false), 3000);
  };

  return (
    <button onClick={alternar} disabled={enfriando} title={activo ? 'Dejar de mostrar mis cartas' : 'Mostrar mis cartas al equipo'} aria-label="Compartir mis cartas con el equipo" style={{ ...estilos.boton, ...(activo ? estilos.activo : {}), ...(enfriando ? estilos.enfriando : {}) }}>
      {activo ? <IconoOjoBrillante /> : <IconoGuinio />}
      {enfriando && <span key="velo" style={estilos.velo} />}
      <style>{'@keyframes veloEnfriamientoMano { from { opacity: 0.62; } to { opacity: 0; } }'}</style>
    </button>
  );
}

const estilos = {
  // Pase 430: botón rústico de madera (mismo lenguaje que la botonera de la mesa): tablita de
  // caoba con borde oscuro y relieve inferior sólido; al activarse (mano compartida) se pinta
  // dorado.
  boton: {
    position: 'absolute', top: 12, left: 12,
    width: 42, height: 42, borderRadius: 12,
    border: '3px solid #2A1507',
    background: 'linear-gradient(160deg, #A9713A, #7A4A22)',
    color: '#FFF3D2', fontSize: 19, cursor: 'pointer', zIndex: 1000, padding: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 3px 0 #4A2C11, inset 0 2px 0 rgba(255,255,255,0.28), 0 5px 8px rgba(0,0,0,0.35)'
  },
  enfriando: { cursor: 'default' },
  // Velo oscuro que se va aclarando durante los 3 s de espera.
  velo: {
    position: 'absolute', inset: 0, borderRadius: 9, background: '#000', pointerEvents: 'none',
    animation: 'veloEnfriamientoMano 3s linear forwards'
  },
  activo: {
    color: '#3B1F08',
    background: 'linear-gradient(160deg, #FFD36B, #E9A31B)',
    borderColor: '#5A3200',
    boxShadow: '0 3px 0 #9A5F0A, inset 0 2px 0 rgba(255,255,255,0.45), 0 5px 8px rgba(0,0,0,0.35)'
  }
};