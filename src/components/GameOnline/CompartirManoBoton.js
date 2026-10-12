import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../../services/socket';

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
      {activo ? '👁️' : '🙈'}
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
    fontSize: 19, cursor: 'pointer', zIndex: 1000, padding: 0,
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
    background: 'linear-gradient(160deg, #FFD36B, #E9A31B)',
    borderColor: '#5A3200',
    boxShadow: '0 3px 0 #9A5F0A, inset 0 2px 0 rgba(255,255,255,0.45), 0 5px 8px rgba(0,0,0,0.35)'
  }
};