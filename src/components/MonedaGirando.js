import React from 'react';

// Pase 434: moneda dorada girando sobre su eje (cara + dorso reales), versión web de
// `components/MonedaGirando.tsx` del nativo. Dos <img> apiladas con `backface-visibility: hidden`;
// el dorso arranca girado 180° para quedar derecho (no espejado) cuando pasa al frente.
// Se usa en los botones "Reclamar +N" de Misiones y como sprite del easter egg de la moneda.
const CARA = '/assets/images/moneda.png';
const DORSO = '/assets/images/moneda-dorso.png';

// Inyecta los @keyframes una sola vez (no hay @keyframes en estilos inline de React).
if (typeof document !== 'undefined' && !document.getElementById('moneda-girando-keyframes')) {
  const style = document.createElement('style');
  style.id = 'moneda-girando-keyframes';
  style.textContent = `
    @keyframes moneda-girando-cara {
      from { transform: perspective(600px) rotateY(0deg); }
      to   { transform: perspective(600px) rotateY(360deg); }
    }
    @keyframes moneda-girando-dorso {
      from { transform: perspective(600px) rotateY(180deg); }
      to   { transform: perspective(600px) rotateY(540deg); }
    }
    .moneda-girando-dorso { transform: perspective(600px) rotateY(180deg); }
    @media (prefers-reduced-motion: reduce) {
      .moneda-girando-img { animation: none !important; }
    }
  `;
  document.head.appendChild(style);
}

export default function MonedaGirando({ tam = 18, duracion = 2600, style }) {
  const base = {
    position: 'absolute', left: 0, top: 0, width: tam, height: tam, objectFit: 'contain',
    backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', pointerEvents: 'none',
  };
  return (
    <span
      aria-hidden="true"
      style={{ display: 'inline-block', position: 'relative', width: tam, height: tam, flexShrink: 0, ...style }}
    >
      <img
        src={CARA}
        alt=""
        className="moneda-girando-img"
        style={{ ...base, animation: `moneda-girando-cara ${duracion}ms linear infinite` }}
      />
      <img
        src={DORSO}
        alt=""
        className="moneda-girando-img moneda-girando-dorso"
        style={{ ...base, animation: `moneda-girando-dorso ${duracion}ms linear infinite` }}
      />
    </span>
  );
}
