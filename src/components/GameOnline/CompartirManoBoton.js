import React, { useState, useEffect } from 'react';
import { getSocket } from '../../services/socket';

export default function CompartirManoBoton({ codigoSala, esEquipos }) {
  const [activo, setActivo] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    const handler = (data) => setActivo(!!data.compartiendoMiMano);
    socket.on('estado-juego', handler);
    return () => socket.off('estado-juego', handler);
  }, []);

  if (!esEquipos) return null;

  const alternar = () => {
    getSocket().emit('alternar-compartir-mano', { codigoSala });
  };

  return (
    <button onClick={alternar} style={{ ...estilos.boton, ...(activo ? estilos.activo : {}) }}>
      {activo ? '👁️' : '🙈'}
    </button>
  );
}

const estilos = {
  // Mismo lenguaje visual que el panel de resultado rediseñado: fondo en
  // degradé pergamino, borde interno chocolate y un anillo dorado exterior
  // (vía boxShadow, así no hay que tocar el tamaño real del botón).
  boton: {
    position: 'absolute', top: 12, left: 12,  // ← antes era right: 12
    width: 40, height: 40, borderRadius: 10,
    border: '2.5px solid #4A2C2A',
    background: 'linear-gradient(160deg, #FFFCF5, #FAEBD2)',
    fontSize: 18, cursor: 'pointer', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 0 2px #FFB627, 0 3px 6px rgba(0,0,0,0.35)'
  },
  activo: { background: 'linear-gradient(160deg, #FFC94D, #FFB627)' }
};