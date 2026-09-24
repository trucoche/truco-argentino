import React from 'react';

const C = {
  chocolate: '#4A2C2A',
  crema: '#FFF8ED',
  dorado: '#FFB627',
};

// Panel de configuración de la partida en curso — arranca con los dos
// sliders de volumen (música de fondo y voces de los cantos), pensado
// como el lugar donde vamos a ir agregando más opciones de partida más
// adelante (no solo de audio). Vive como modal simple encima del canvas
// de Phaser, sin tocar nada del juego en sí.
//
// Trigésimo tercer pase: se sacó el look "dialog genérico" (recuadro
// crema plano, borde único, ⚙️ emoji, slider azul de navegador) y se
// pasó a la misma familia visual que ya usa ChatMesa — degradé pergamino
// + anillo dorado + header con su propia franja de color — más el ícono
// de engranaje ilustrado (sin fondo de botón, lo manda el usuario para
// este uso puntual) en vez del emoji. Los sliders ahora usan la clase
// .tc-slider (ver app-shell.css) para reemplazar el thumb/track azul por
// default por uno dorado, mismo criterio de color que la ficha "mano".
export default function ConfiguracionMesaModal({
  visible, onCerrar, musicaVolumen, onCambiarMusicaVolumen, vocesVolumen, onCambiarVocesVolumen,
}) {
  if (!visible) return null;

  return (
    <div style={estilos.fondo} onClick={onCerrar}>
      <div style={estilos.panel} onClick={(e) => e.stopPropagation()}>
        <div style={estilos.header}>
          <img src="/assets/images/icono-engranaje.png" alt="" style={estilos.iconoTitulo} />
          <span>Configuración de la partida</span>
        </div>

        <div style={estilos.cuerpo}>
          <div style={estilos.fila}>
            <label style={estilos.label}>🎵 Música de fondo</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={musicaVolumen}
              onChange={(e) => onCambiarMusicaVolumen(Number(e.target.value))}
              className="tc-slider"
            />
          </div>

          <div style={estilos.fila}>
            <label style={estilos.label}>🗣️ Voces de los cantos</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={vocesVolumen}
              onChange={(e) => onCambiarVocesVolumen(Number(e.target.value))}
              className="tc-slider"
            />
          </div>

          <p style={estilos.notaFutura}>Más opciones de partida, próximamente.</p>

          <button style={estilos.botonCerrar} onClick={onCerrar}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

const estilos = {
  fondo: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.55)', zIndex: 2000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  panel: {
    background: 'linear-gradient(160deg, #FFFCF5, #FAEBD2)',
    border: `3px solid ${C.chocolate}`, borderRadius: 16,
    width: 300, maxWidth: '85%', overflow: 'hidden',
    fontFamily: "'Nunito', Arial, sans-serif",
    boxShadow: `0 0 0 2px ${C.dorado}, 0 6px 20px rgba(0,0,0,0.45)`,
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'linear-gradient(160deg, #FFC94D, #E8A317)',
    borderBottom: `3px solid ${C.chocolate}`,
    padding: '10px 16px',
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 15,
    color: C.chocolate,
  },
  iconoTitulo: { width: 22, height: 22, objectFit: 'contain', flexShrink: 0 },
  cuerpo: { padding: '18px 22px 22px' },
  fila: { marginBottom: 16 },
  label: { display: 'block', marginBottom: 8, color: C.chocolate, fontWeight: 700, fontSize: 13 },
  notaFutura: { color: '#8c7a6b', fontSize: 11, fontStyle: 'italic', margin: '4px 0 18px' },
  botonCerrar: {
    width: '100%', padding: '10px 0', borderRadius: 10, border: `2.5px solid ${C.chocolate}`,
    background: 'linear-gradient(160deg, #FFD668, #FFB627)',
    color: C.chocolate, fontWeight: 700, cursor: 'pointer', fontSize: 14,
    fontFamily: "'Fredoka', sans-serif",
  },
};
