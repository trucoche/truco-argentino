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

  return (
    <div style={estilos.contenedor}>
      {error ? (
        <div style={estilos.errorBox}>🎙️ {error}</div>
      ) : (
        <button onClick={alternarMute} disabled={conectando} style={{ ...estilos.boton, ...(muteado ? estilos.muteado : {}) }}>
          <span style={{ fontSize: 16 }}>{conectando ? '⏳' : muteado ? '🔇' : '🎙️'}</span>
          <span style={estilos.label}>
            {conectando ? 'Conectando...' : muteado ? 'Silenciado' : `Audio (${cantidadEnLlamada})`}
          </span>
        </button>
      )}
    </div>
  );
}

const estilos = {
  contenedor: {
    position: 'absolute', bottom: 12, left: 12, zIndex: 1000,
  },
  // Misma familia visual que los demás botones flotantes: anillo dorado
  // exterior + borde chocolate, pero conservando la forma píldora y los
  // tonos semánticos verde/rojo (ahora más "vino/bosque" que pastel puro,
  // a juego con la paleta del rediseño) para que siga leyéndose de un
  // vistazo el estado activo/silenciado.
  boton: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: 'linear-gradient(160deg, #4FAE6E, #3E8E5A)',
    border: '2.5px solid #4A2C2A', borderRadius: 20,
    padding: '8px 14px', cursor: 'pointer',
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 12,
    color: '#FFF8ED', boxShadow: '0 0 0 2px #FFB627, 0 3px 6px rgba(0,0,0,0.35)'
  },
  muteado: { background: 'linear-gradient(160deg, #C96A62, #B0454B)', color: '#FFF8ED' },
  label: { whiteSpace: 'nowrap' },
  errorBox: {
    background: '#ffe0dd', border: '2px solid #E8483A', color: '#c2352a',
    borderRadius: 12, padding: '6px 10px', fontSize: 11, fontWeight: 700,
    fontFamily: "'Nunito', sans-serif"
  },
};