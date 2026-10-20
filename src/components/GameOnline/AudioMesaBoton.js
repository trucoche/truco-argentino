import React, { useEffect, useRef, useState } from 'react';
import DailyIframe from '@daily-co/daily-js';

// Solo se muestra en salas privadas (audioRoomUrl viene null en el resto).
// El micrófono arranca SIEMPRE ABIERTO al entrar (mismo criterio que
// definimos: "mic siempre abierto + botón de mute"), el usuario decide
// silenciarse si quiere.
export default function AudioMesaBoton({ audioRoomUrl, nombreUsuario }) {
  const callRef = useRef(null);
  const [conectando, setConectando] = useState(true);
  const [muteado, setMuteado] = useState(false);
  const [error, setError] = useState('');
  const [cantidadEnLlamada, setCantidadEnLlamada] = useState(0);

useEffect(() => {
    if (!audioRoomUrl) return;

    let activo = true;
    let call = null;

    const iniciar = async () => {
      // Si ya hay una instancia viva (StrictMode en desarrollo monta y
      // desmonta el efecto dos veces seguidas, o quedó una colgada de un
      // hot-reload previo), esperamos a que termine de destruirse del
      // todo ANTES de crear la nueva — Daily no permite dos instancias
      // vivas al mismo tiempo, y destroy() es asíncrono.
      const instanciaPrevia = DailyIframe.getCallInstance();
      if (instanciaPrevia) {
        await instanciaPrevia.destroy();
      }

      if (!activo) return;

      call = DailyIframe.createCallObject({
        audioSource: true,
        videoSource: false, // audio-only, nunca pedimos cámara
      });
      callRef.current = call;

      const actualizarCantidad = () => {
        if (!activo) return;
        const participantes = call.participants();
        setCantidadEnLlamada(Object.keys(participantes).length);
      };

      call.on('joined-meeting', () => {
        if (activo) setConectando(false);
        actualizarCantidad();
      });
      call.on('participant-joined', actualizarCantidad);
      call.on('participant-left', actualizarCantidad);
      call.on('error', (e) => {
        console.error('Error de audio (Daily):', e);
        if (activo) setError('No se pudo conectar el audio');
      });

      // createCallObject() (modo sin interfaz) no reproduce el audio
      // remoto automáticamente — a diferencia del SDK nativo de Android,
      // acá hay que conectar el track a un elemento <audio> a mano.
      call.on('track-started', (evento) => {
        if (evento.participant?.local) return; // no reproducir mi propio audio
        if (evento.track.kind !== 'audio') return;

        const elementoAudio = document.createElement('audio');
        elementoAudio.autoplay = true;
        elementoAudio.srcObject = new MediaStream([evento.track]);
        elementoAudio.dataset.trackId = evento.track.id;
        document.body.appendChild(elementoAudio);
      });

      call.on('track-stopped', (evento) => {
        if (evento.track.kind !== 'audio') return;
        const elementoViejo = document.querySelector(`audio[data-track-id="${evento.track.id}"]`);
        if (elementoViejo) elementoViejo.remove();
      });

      try {
        await call.join({ url: audioRoomUrl, userName: nombreUsuario || 'Jugador' });
      } catch (err) {
        console.error('Error uniéndose a la sala de audio:', err);
        if (activo) setError('No se pudo conectar el audio');
      }
    };

    iniciar();

    return () => {
          activo = false;
          if (call) {
            call.leave().catch(() => {});
            call.destroy().catch(() => {});
          }
          document.querySelectorAll('audio[data-track-id]').forEach(el => el.remove());
          callRef.current = null;
        };
      }, [audioRoomUrl, nombreUsuario]);

  const alternarMute = () => {
    if (!callRef.current) return;
    const nuevoValor = !muteado;
    // Pase siguiente: el usuario reportó que al mutearse, el audio de OTRAS
    // apps del celular (ej. Spotify sonando de fondo) empezaba a sonar
    // "como pasado por un micrófono" / con la calidad más baja — según la
    // documentación oficial de Daily, `setLocalAudio(false)` sin opciones
    // "mutea sin descartar el track, para que el hardware quede caliente":
    // el micrófono sigue abierto a nivel de sistema operativo AUNQUE esté
    // muteado, y en Android/iOS eso empuja el audio de TODO el dispositivo
    // al modo de audio de llamada de voz — exactamente el síntoma
    // reportado. `forceDiscardTrack: true` descarta el track del mic de
    // verdad al mutear (libera el hardware/la sesión de audio), y Daily lo
    // vuelve a pedir solo al desmutear — a cambio de un pequeño delay al
    // desmutear, aceptable frente al problema que soluciona.
    callRef.current.setLocalAudio(!nuevoValor, { forceDiscardTrack: true }); // setLocalAudio(true) = mic activo
    setMuteado(nuevoValor);
  };

  if (!audioRoomUrl) return null;

  // Pase 580 (paridad con la app, Pase 574): botón redondo con imagen (micrófono encendido / apagado). La cantidad de
  // personas en la llamada va en una chapita arriba a la derecha del botón. En la web el chat vive arriba a la derecha,
  // así que el botón se queda abajo a la izquierda y no se tapan.
  return (
    <div style={estilos.contenedor}>
      {error ? (
        <div style={estilos.errorBox}>🎙️ {error}</div>
      ) : (
        <button
          onClick={alternarMute}
          disabled={conectando}
          style={estilos.boton}
          aria-label={muteado ? 'Activar micrófono' : 'Silenciar micrófono'}
          title={muteado ? 'Activar micrófono' : 'Silenciar micrófono'}
        >
          <img
            src={muteado ? '/assets/images/boton-mic-off.png' : '/assets/images/boton-mic-on.png'}
            alt=""
            draggable={false}
            style={{ ...estilos.imagen, ...(conectando ? { opacity: 0.45 } : null) }}
          />
          {conectando && <span style={estilos.spinner} aria-hidden="true" />}
          {!conectando && (
            <span style={{ ...estilos.chapita, ...(muteado ? estilos.chapitaMuteado : null) }}>{cantidadEnLlamada}</span>
          )}
        </button>
      )}
    </div>
  );
}

const estilos = {
  contenedor: {
    position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
  },
  boton: {
    position: 'relative', width: 54, height: 54, padding: 0, border: 'none', background: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent',
  },
  imagen: { width: 54, height: 54, objectFit: 'contain', display: 'block', userSelect: 'none' },
  spinner: {
    position: 'absolute', top: '50%', left: '50%', width: 20, height: 20, marginTop: -10, marginLeft: -10, boxSizing: 'border-box',
    borderRadius: '50%', border: '3px solid rgba(74,44,42,0.25)', borderTopColor: '#4A2C2A', animation: 'audio-mesa-giro 0.8s linear infinite',
  },
  chapita: {
    position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, boxSizing: 'border-box', padding: '0 4px', borderRadius: 9,
    background: '#7dd88a', border: '1.5px solid #4A2C2A', color: '#4A2C2A', fontWeight: 800, fontSize: 10,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Nunito', sans-serif",
  },
  chapitaMuteado: { background: '#f0d8d8' },
  errorBox: {
    background: '#ffe0dd', border: '2px solid #E8483A', color: '#c2352a',
    borderRadius: 12, padding: '6px 10px', fontSize: 11, fontWeight: 700,
    fontFamily: "'Nunito', sans-serif"
  },
};

// Pase 580: giro del spinner mientras conecta (estilo inyectado una sola vez).
if (typeof document !== 'undefined' && !document.getElementById('audio-mesa-giro-estilo')) {
  const style = document.createElement('style');
  style.id = 'audio-mesa-giro-estilo';
  style.textContent = '@keyframes audio-mesa-giro { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}
