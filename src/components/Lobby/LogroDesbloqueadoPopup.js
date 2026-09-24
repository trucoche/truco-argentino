import React, { useEffect, useState } from 'react';
import { ICONOS_LOGRO, nombreLogroSinEmoji } from '../Perfil/perfil';

// Pase siguiente: popup de "logro desbloqueado" — a pedido del usuario,
// aparece cuando vuelve al Lobby después de una partida en la que se
// desbloqueó (quedó completado) alguno de sus logros. `logros` es la lista
// completa que llegó de esa partida (puede ser más de uno a la vez, p.ej.
// si terminaste un torneo Y llegaste a las 50 partidas ganadas juntos);
// se muestran de a uno, con click/tap en cualquier parte del popup para
// pasar al siguiente (o cerrar del todo si era el último). `onCerrarTodos`
// avisa al padre (App.js) que ya se mostraron todos, para que vacíe el
// estado y este componente vuelva a no renderizar nada.
export default function LogroDesbloqueadoPopup({ logros, onCerrarTodos }) {
  const [indice, setIndice] = useState(0);

  // Si llega una lista nueva (otra partida), arrancamos de nuevo desde el
  // primero — evita mostrar un índice viejo fuera de rango.
  useEffect(() => {
    setIndice(0);
  }, [logros]);

  if (!logros || logros.length === 0) return null;

  const logro = logros[indice];
  if (!logro) return null;

  const avanzar = () => {
    if (indice + 1 < logros.length) {
      setIndice(indice + 1);
    } else {
      onCerrarTodos?.();
    }
  };

  return (
    <div style={estilos.fondo} onClick={avanzar}>
      <div style={estilos.tarjeta} onClick={avanzar}>
        <div style={estilos.eyebrow}>¡Logro desbloqueado!</div>

        <div style={estilos.marcoImagen}>
          {/* Efecto lumínico: un resplandor dorado detrás de la medalla,
              con una animación de pulso suave (ver @keyframes acá abajo,
              inyectado una sola vez por instancia). */}
          <div style={estilos.resplandor} />
          {ICONOS_LOGRO[logro.tipo] ? (
            <img src={ICONOS_LOGRO[logro.tipo]} alt="" style={estilos.imagen} />
          ) : (
            <div style={estilos.imagenFallback}>🏅</div>
          )}
        </div>

        {/* Sin el emoji (ver nombreLogroSinEmoji) — mismo criterio que la
            tarjeta de logros de Perfil, la medalla ya lo reemplaza. */}
        <div style={estilos.titulo}>{nombreLogroSinEmoji(logro.titulo)}</div>
        <div style={estilos.descripcion}>{logro.descripcion}</div>

        {logros.length > 1 && (
          <div style={estilos.contador}>
            {indice + 1} / {logros.length}
          </div>
        )}

        <div style={estilos.hint}>Tocá para continuar</div>
      </div>
      <style>{`
        @keyframes logroResplandorPulso {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.15); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

const C = {
  chocolate: '#4A2C2A',
  crema: '#FFF8ED',
  dorado: '#FFB627',
  doradoClaro: '#FFD668',
  doradoOscuro: '#C9860E',
};

const estilos = {
  fondo: {
    position: 'fixed', inset: 0, background: 'rgba(20,14,10,0.72)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 3000, cursor: 'pointer', padding: 20,
  },
  tarjeta: {
    background: `linear-gradient(180deg, ${C.chocolate}, #2e1c15)`,
    border: `4px solid ${C.doradoOscuro}`, borderRadius: 22,
    boxShadow: '0 10px 0 rgba(0,0,0,0.4), 0 0 60px rgba(255,182,39,0.25)',
    padding: '28px 26px 24px', maxWidth: 340, width: '100%',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    textAlign: 'center', cursor: 'default',
  },
  eyebrow: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 13,
    color: C.doradoClaro, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14,
  },
  marcoImagen: {
    position: 'relative', width: 140, height: 140,
    display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  // Pase siguiente: agrandado a pedido del usuario ("que sea más grande la
  // luz que sale de atrás del logro") — 160→210px, mismos porcentajes de
  // paradas del degradé (0%/45%/72%), así que la luz se ve más grande sin
  // cambiar de forma ni de intensidad relativa.
  resplandor: {
    position: 'absolute', width: 210, height: 210, borderRadius: '50%',
    background: `radial-gradient(circle, rgba(255,214,104,0.9) 0%, rgba(255,182,39,0.45) 45%, rgba(255,182,39,0) 72%)`,
    filter: 'blur(2px)',
    animation: 'logroResplandorPulso 1.8s ease-in-out infinite',
  },
  imagen: { position: 'relative', width: 116, height: 116, objectFit: 'contain', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.5))' },
  imagenFallback: { position: 'relative', fontSize: 72 },
  titulo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 20,
    color: C.crema, marginBottom: 8,
  },
  descripcion: {
    fontSize: 14, color: 'rgba(255,248,237,0.85)', fontWeight: 600,
    lineHeight: 1.4, marginBottom: 14,
  },
  contador: {
    fontSize: 12, color: 'rgba(255,248,237,0.55)', fontWeight: 700, marginBottom: 6,
  },
  hint: {
    fontSize: 11.5, color: 'rgba(255,214,104,0.75)', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
};