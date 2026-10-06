import React from 'react';

const C = {
  chocolate: '#4A2C2A',
  crema: '#FFF8ED',
  dorado: '#FFB627',
  // Nonagésimo quinto pase: paleta de madera OSCURA + remaches de bronce
  // — valores idénticos a los que usa `Lobby.js` para sus 3 placas de
  // "Crear sala"/"Unirse con código"/"Torneo en curso" (`maderaClara`/
  // `maderaMedia`/`maderaOscura`/`negroPulido`/`remache`/`remacheClaro`/
  // `remacheOscuro`), pedido explícito del usuario: "aplicar la textura
  // de placa de madera oscura con remaches de bronce en las esquinas al
  // contenedor principal del modal".
  maderaClara: '#6b4a34', maderaMedia: '#4a3226', maderaOscura: '#2a1c14',
  remacheClaro: '#f0d9a0', remache: '#c9973e', remacheOscuro: '#7a5322',
  negroPulido: '#1a1410',
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
      {/* Nonagésimo quinto pase: contenedor exterior nuevo — mismo criterio
          de 2 capas que `accesoCardExterior`/`accesoCard` en Lobby.js. Antes
          el marco (borde + fondo + boxShadow) vivía directo en `panel`
          (la misma caja que el header/cuerpo); ahora `panelExterior` es la
          placa de madera oscura con los 4 remaches de bronce, y `panel`
          (renombrado en los hechos a "tarjeta interior") queda inset
          adentro, sin su propio borde/ancho/boxShadow de antes. */}
      <div style={estilos.panelExterior} onClick={(e) => e.stopPropagation()}>
        <span style={{ ...estilos.remache, top: 8, left: 8 }} />
        <span style={{ ...estilos.remache, top: 8, right: 8 }} />
        <span style={{ ...estilos.remache, bottom: 8, left: 8 }} />
        <span style={{ ...estilos.remache, bottom: 8, right: 8 }} />
      <div style={estilos.panel}>
        <div style={estilos.header}>
          <img src="/assets/images/icono-engranaje.png" alt="" style={estilos.iconoTitulo} />
          <span>Configuración de la partida</span>
        </div>

        <div style={estilos.cuerpo}>
          {/* Nonagésimo cuarto pase: estos 2 sliders usaban solo `.tc-slider`
              (thumb/track dorado liso de navegador) — el usuario pidió
              explícitamente el MISMO slider de madera con el nudo-círculo
              ilustrado que ya usa Configuracion.js (pantalla de ajustes
              global) para "música de fondo". Como ambos controles manejan
              el mismo volumen global (música/voces), tiene sentido que se
              vean idénticos en los dos lugares. Al ser un solo componente
              compartido por GameOnlinePhaser.js, este cambio ya cubre 1v1,
              2v2 y 3v3 sin duplicar nada por modo. Mismo patrón de 2 capas
              que Configuracion.js: el `<div>` de afuera (`sliderPistaContenedor`)
              lleva la imagen del tronco a tamaño fijo (250x54, sin estirar)
              y el `<input>` de adentro (`tc-slider-grande`) va acortado para
              que el recorrido del thumb no pise las puntas ilustradas. */}
          <div style={estilos.fila}>
            <label style={estilos.label}>🎵 Música de fondo</label>
            <div style={estilos.sliderPistaContenedor}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={musicaVolumen}
                onChange={(e) => onCambiarMusicaVolumen(Number(e.target.value))}
                className="tc-slider tc-slider-grande"
              />
            </div>
          </div>

          <div style={estilos.fila}>
            <label style={estilos.label}>🗣️ Voces de los cantos</label>
            <div style={estilos.sliderPistaContenedor}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={vocesVolumen}
                onChange={(e) => onCambiarVocesVolumen(Number(e.target.value))}
                className="tc-slider tc-slider-grande"
              />
            </div>
          </div>

          <p style={estilos.notaFutura}>Más opciones de partida, próximamente.</p>

          <button style={estilos.botonCerrar} onClick={onCerrar}>Cerrar</button>
        </div>
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
  // Nonagésimo quinto pase: placa de madera oscura exterior, mismo
  // criterio que `accesoCardExterior` en Lobby.js — gradiente madera
  // (maderaClara→maderaMedia→maderaOscura, 160deg), borde negro pulido
  // de 3px, y el "grosor" de la placa simulado con `0 8px 0 negroPulido`
  // en el boxShadow (en vez del anillo dorado plano de antes). Lleva el
  // `width`/`maxWidth` que antes tenía `panel` — ahora es este contenedor
  // el que define el tamaño total del modal.
  panelExterior: {
    position: 'relative',
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.negroPulido}`, borderRadius: 20, padding: 9,
    width: 300, maxWidth: '85%',
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -4px 10px rgba(0,0,0,0.5)',
      `0 8px 0 ${C.negroPulido}`,
      '0 16px 26px rgba(0,0,0,0.45)',
    ].join(', '),
  },
  // Remache de bronce en las 4 esquinas de `panelExterior` — mismo
  // `radial-gradient` que ya usa Lobby.js para sus placas de madera.
  remache: {
    position: 'absolute', width: 13, height: 13, borderRadius: '50%',
    background: `radial-gradient(circle at 35% 30%, ${C.remacheClaro} 0%, ${C.remache} 45%, ${C.remacheOscuro} 78%, #3a2610 100%)`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.4)',
    zIndex: 2,
  },
  // Tarjeta interior (antes esta era la caja exterior completa, con su
  // propio borde/boxShadow dorado) — ahora solo el pergamino inset
  // adentro del marco de madera, mismo criterio que `accesoCard`.
  panel: {
    background: 'linear-gradient(160deg, #FFFCF5, #FAEBD2)',
    borderRadius: 13, overflow: 'hidden',
    fontFamily: "'Nunito', Arial, sans-serif",
    boxShadow: 'inset 0 4px 14px rgba(74,44,42,0.28), inset 0 -3px 10px rgba(74,44,42,0.22)',
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
  // Nonagésimo cuarto pase: mismo contenedor de "tronco de madera" a
  // tamaño fijo que Configuracion.js (250x54, sin estirar nunca) —
  // centrado con `margin: 0 auto` porque este panel es más angosto
  // (300px, con padding de 22px a cada lado) que la pantalla de ajustes
  // global, así que el tronco de 250px no llena todo el ancho disponible.
  sliderPistaContenedor: {
    position: 'relative',
    width: 250, maxWidth: '100%', height: 54,
    margin: '0 auto',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundImage: 'url(/assets/images/slider-fondo.png)',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
  },
  notaFutura: { color: '#8c7a6b', fontSize: 11, fontStyle: 'italic', margin: '4px 0 18px' },
  botonCerrar: {
    width: '100%', padding: '10px 0', borderRadius: 10, border: `2.5px solid ${C.chocolate}`,
    background: 'linear-gradient(160deg, #FFD668, #FFB627)',
    color: C.chocolate, fontWeight: 700, cursor: 'pointer', fontSize: 14,
    fontFamily: "'Fredoka', sans-serif",
  },
};

// Nonagésimo cuarto pase: mismo CSS inyectado una sola vez que ya usa
// Configuracion.js para el slider de madera (`.tc-slider.tc-slider-grande`)
// — se reutiliza el MISMO id ('config-slider-grande') a propósito, no uno
// nuevo: la regla es idéntica en los dos lugares (mismo thumb ilustrado,
// mismo tronco), así que si el usuario ya pasó por la pantalla de ajustes
// (o entra directo a una partida sin pasar por ahí) el chequeo evita
// inyectar la hoja de estilos duplicada sin importar el orden de montaje.
if (typeof document !== 'undefined' && !document.getElementById('config-slider-grande')) {
  const style = document.createElement('style');
  style.id = 'config-slider-grande';
  style.textContent = `
    .tc-slider.tc-slider-grande {
      width: calc(100% - 30px);
      height: 54px;
      background: transparent;
      border: none;
      border-radius: 0;
    }
    .tc-slider.tc-slider-grande::-webkit-slider-runnable-track {
      width: 100%;
      height: 54px;
      background: transparent;
      border: none;
    }
    .tc-slider.tc-slider-grande::-moz-range-track {
      width: 100%;
      height: 54px;
      background: transparent;
      border: none;
    }
    .tc-slider.tc-slider-grande::-webkit-slider-thumb {
      width: 40px; height: 40px;
      margin-top: 7px;
      background-image: url(/assets/images/slider-thumb.png);
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-color: transparent;
      border: none;
      box-shadow: none;
      border-radius: 0;
    }
    .tc-slider.tc-slider-grande::-moz-range-thumb {
      width: 40px; height: 40px;
      background-image: url(/assets/images/slider-thumb.png);
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-color: transparent;
      border: none;
      box-shadow: none;
      border-radius: 0;
    }
  `;
  document.head.appendChild(style);
}
