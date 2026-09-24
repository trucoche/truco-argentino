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

const ICONO = {
  exito: '✓',
  error: '⚠',
  info: 'ℹ',
};

export default function Toast({ mensaje, tipo = 'info', onCerrar, onPresionar }) {
  const acento = ACENTO[tipo] || ACENTO.info;
  const icono = ICONO[tipo] || ICONO.info;

  return (
    <div style={{ ...estilos.tarjeta, borderLeftColor: acento }} onClick={onPresionar || onCerrar}>
      <span style={{ ...estilos.icono, color: acento }}>{icono}</span>
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
  icono: { fontSize: 16, fontWeight: 800, flexShrink: 0 },
  texto: {
    fontFamily: "'Nunito', Arial, sans-serif", fontSize: 13.5,
    color: '#4A2C2A', fontWeight: '600', lineHeight: 1.3,
  },
};