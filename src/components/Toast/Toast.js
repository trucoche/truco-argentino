import React from 'react';

// Un solo toast individual — el stack/temporizador vive en ToastContext.js.
// Estética "pergamino con marco de madera" (misma familia que las tarjetas
// del resto del juego): fondo degradé crema, borde chocolate, con un
// filete de color a la izquierda + un ícono que identifican el tipo de
// aviso de un vistazo, sin que el dorado domine toda la superficie.
const ACENTO = {
  exito: '#3D8B4E',
  error: '#B4402A',
  info: '#C9860E',
};

// Pase 429: sin glifos de texto (✓ ⚠ ℹ ni emojis). Cada aviso lleva un
// medallón con un ícono ilustrado de los assets del juego; si no hay ícono
// para ese caso, un punto del color del aviso. `icono` (opcional) lo pide
// quien llama a mostrarToast: 'chat' | 'desafio'.
const IMG = '/assets/images/';
const ICONO_IMG = {
  exito: 'icono-check.png',
  error: 'historial-cruz.png',
  chat: 'icono-chat.png',
  desafio: 'icono-desafios.png',
};

export default function Toast({ mensaje, tipo = 'info', icono, onCerrar, onPresionar }) {
  const acento = ACENTO[tipo] || ACENTO.info;
  const clave = icono || (tipo === 'exito' || tipo === 'error' ? tipo : null);
  const archivo = clave ? ICONO_IMG[clave] : null;

  return (
    <div style={{ ...estilos.tarjeta, borderLeftColor: acento }} onClick={onPresionar || onCerrar}>
      <span style={{ ...estilos.medallon, borderColor: acento }}>
        {archivo
          ? <img src={IMG + archivo} alt="" draggable={false} style={estilos.img} />
          : <span style={{ ...estilos.punto, background: acento }} />}
      </span>
      <span style={estilos.texto}>{mensaje}</span>
    </div>
  );
}

const estilos = {
  tarjeta: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'linear-gradient(160deg, #FFFCF5, #FAEBD2)',
    border: '2px solid #4A2C2A', borderLeftWidth: 6,
    borderRadius: 12, padding: '10px 16px', minWidth: 220, maxWidth: 340,
    boxShadow: '0 4px 12px rgba(0,0,0,0.35)', cursor: 'pointer',
    pointerEvents: 'auto', animation: 'toastEntrada 0.25s ease-out',
  },
  medallon: {
    width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
    background: '#FFF6E0', border: '2px solid', boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  img: { width: 18, height: 18, objectFit: 'contain', pointerEvents: 'none' },
  punto: { width: 10, height: 10, borderRadius: '50%' },
  texto: {
    fontFamily: "'Nunito', Arial, sans-serif", fontSize: 13.5,
    color: '#4A2C2A', fontWeight: '600', lineHeight: 1.3,
  },
};