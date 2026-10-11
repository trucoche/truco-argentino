import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { ANCHO_MAX_CSS, esLayoutAngosto, crearConfigOnline } from '../../phaser/config/gameConfigOnline';
import GameSceneOnline from '../../phaser/scenes/GameSceneOnline';
import ChatMesa from './ChatMesa';
import CompartirManoBoton from './CompartirManoBoton';
import AudioMesaBoton from './AudioMesaBoton';
import ConfiguracionMesaBoton from './ConfiguracionMesaBoton';
import ConfiguracionMesaModal from './ConfiguracionMesaModal';
import PerfilRivalModal from '../PerfilRival/PerfilRivalModal';

export default function GameOnlinePhaser({
  token, usuario, codigoSala, onVolverLobby, onRevancha, onVerBracket,
  musicaVolumen, onCambiarMusicaVolumen,
  vocesVolumen, onCambiarVocesVolumen,
  // Pase siguiente: popup de logro desbloqueado — ver comentario en
  // GameSceneOnline.js (this.onVolverLobby ahora manda los logros de esta
  // partida como parámetro). Este componente no sabe nada del popup en sí
  // (lo arma App.js), solo reenvía el dato hacia arriba.
  onLogrosDesbloqueados,
}) {
  const gameRef = useRef(null);
  // Pase 394: layout vertical en ventanas angostas (<700px). `angosto` decide el
  // estilo del contenedor y la config del canvas; `claveLayout` fuerza a
  // recrear el juego cuando la ventana cruza el umbral (o cambia mucho de
  // proporcion, por ejemplo al girar el celular).
  const [angosto, setAngosto] = useState(() => esLayoutAngosto());
  const [claveLayout, setClaveLayout] = useState(0);
  const relacionInicialRef = useRef(typeof window !== 'undefined' ? window.innerHeight / window.innerWidth : 1);
  const codigoSalaRef = useRef(codigoSala);
  const [esEquipos, setEsEquipos] = useState(false);
  const [audioInfo, setAudioInfo] = useState({ privada: false, audioRoomUrl: null });
  const [mostrarConfiguracion, setMostrarConfiguracion] = useState(false);
  // Centésimo décimo quinto pase: nombres de rival/compañero clickeables en
  // la mesa (Phaser no puede renderizar el modal en sí, es un canvas — la
  // escena solo avisa vía `onVerPerfil`, mismo patrón que `onVolverLobby`/
  // `onRevancha`, y quien realmente abre el popup es este componente React).
  const [perfilAbierto, setPerfilAbierto] = useState(null);

  // Pase siguiente: ver comentario junto a onLogrosDesbloqueados arriba —
  // la escena ahora llama a onVolverLobby(logros) en vez de onVolverLobby()
  // a secas, así que en vez de asignar la prop directo se asigna este
  // wrapper, que separa "avisar los logros nuevos" de "cambiar de pantalla"
  // (2 cosas que en React viven en componentes distintos: App.js).
  const manejarVolverLobby = (logros) => {
    if (onLogrosDesbloqueados) onLogrosDesbloqueados(logros || []);
    if (onVolverLobby) onVolverLobby();
  };

useEffect(() => {
    if (!gameRef.current) {
      const angostoAhora = esLayoutAngosto();
      relacionInicialRef.current = window.innerHeight / window.innerWidth;
      gameRef.current = new Phaser.Game(crearConfigOnline(angostoAhora));
      gameRef.current.scene.add('GameSceneOnline', GameSceneOnline, true, { usuario, codigoSala, vocesVolumen, angosto: angostoAhora });

      gameRef.current.events.once('ready', () => {
        const escena = gameRef.current.scene.getScene('GameSceneOnline');
        if (escena) {
          escena.onVolverLobby = manejarVolverLobby;
          escena.onRevancha = onRevancha;
          escena.onEsEquipos = setEsEquipos;
          escena.onVerBracket = onVerBracket;
          escena.onInfoSala = setAudioInfo;
          escena.onVerPerfil = setPerfilAbierto;
        }
      });

      const escenaInmediata = gameRef.current.scene.getScene('GameSceneOnline');
      if (escenaInmediata) {
        escenaInmediata.onVolverLobby = manejarVolverLobby;
        escenaInmediata.onRevancha = onRevancha;
        escenaInmediata.onEsEquipos = setEsEquipos;
        escenaInmediata.onVerBracket = onVerBracket;
        escenaInmediata.onInfoSala = setAudioInfo;
        escenaInmediata.onVerPerfil = setPerfilAbierto;
      }
    }

    return () => {
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [claveLayout]);

  // Pase 394: al achicar/agrandar la ventana (o girar el celular) se vuelve a
  // decidir el layout. Solo se recrea el juego si cruza el umbral de 700px o la
  // proporcion cambia mucho; un ajuste chico (barra de direcciones del
  // navegador) lo absorbe el canvas solo.
  useEffect(() => {
    let timer = null;
    const alCambiarTamano = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const ahora = esLayoutAngosto();
        const relacion = window.innerHeight / window.innerWidth;
        const cambioMucho = ahora && Math.abs(relacion - relacionInicialRef.current) / relacionInicialRef.current > 0.2;
        if (ahora !== angosto || cambioMucho) {
          setAngosto(ahora);
          setClaveLayout(k => k + 1);
        }
      }, 300);
    };
    window.addEventListener('resize', alCambiarTamano);
    return () => { clearTimeout(timer); window.removeEventListener('resize', alCambiarTamano); };
  }, [angosto]);

useEffect(() => {
    if (codigoSalaRef.current === codigoSala) return;
    codigoSalaRef.current = codigoSala;

    if (gameRef.current) {
      const escena = gameRef.current.scene.getScene('GameSceneOnline');
      if (escena) {
        escena.scene.restart({ usuario, codigoSala, vocesVolumen, angosto: esLayoutAngosto() });
        escena.events.once('create', () => {
          escena.onVolverLobby = manejarVolverLobby;
          escena.onRevancha = onRevancha;
          escena.onEsEquipos = setEsEquipos;
          escena.onVerBracket = onVerBracket;
          escena.onInfoSala = setAudioInfo;
          escena.onVerPerfil = setPerfilAbierto;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoSala]);

  // El volumen de voces se puede cambiar en cualquier momento desde el
  // panel de configuración — no hace falta reiniciar la escena para que
  // se note, alcanza con actualizar la propiedad que ya lee
  // `_reproducirCanto` en cada canto nuevo.
  useEffect(() => {
    const escena = gameRef.current?.scene.getScene('GameSceneOnline');
    if (escena) escena.vocesVolumen = vocesVolumen;
  }, [vocesVolumen]);

  return (
    <div style={estilosPagina.fondoPagina}>
      <div style={angosto ? estilosPagina.contenedorJuegoAngosto : estilosPagina.contenedorJuego}>
        <div id="game-container" style={{ width: '100%', height: '100%' }} />
        <ChatMesa codigoSala={codigoSala} esEquipos={esEquipos} personaje={usuario?.personaje || 'gaucho'} token={token} usuarioActual={usuario?.username} />
        <CompartirManoBoton codigoSala={codigoSala} esEquipos={esEquipos} />
        {audioInfo.privada && (
          <AudioMesaBoton audioRoomUrl={audioInfo.audioRoomUrl} nombreUsuario={usuario?.username} />
        )}
        <ConfiguracionMesaBoton onAbrir={() => setMostrarConfiguracion(true)} />
        <ConfiguracionMesaModal
          visible={mostrarConfiguracion}
          onCerrar={() => setMostrarConfiguracion(false)}
          musicaVolumen={musicaVolumen}
          onCambiarMusicaVolumen={onCambiarMusicaVolumen}
          vocesVolumen={vocesVolumen}
          onCambiarVocesVolumen={onCambiarVocesVolumen}
        />
        {perfilAbierto && perfilAbierto !== usuario?.username && token && (
          <PerfilRivalModal username={perfilAbierto} token={token} onClose={() => setPerfilAbierto(null)} />
        )}
      </div>
    </div>
  );
}

const estilosPagina = {
  // Ocupa toda la pantalla, con un color de fondo acorde a la estética
  // de la cantina en vez del blanco por defecto del body.
  // Pase 208: bug real reportado por el usuario — probando desde el
  // navegador del celular, el lobby y el resto de las pantallas se sentían
  // "como la app", pero la pantalla de PARTIDA en particular se sentía "como
  // un navegador". La diferencia: esta es la única pantalla que fija su
  // alto con `100vh` y centra todo adentro sin scroll — el resto de la app
  // usa flujo normal de documento (crece/scrollea con la página), que no
  // sufre este problema. `100vh` en un navegador de celular mide la altura
  // MÁXIMA posible (con la barra de direcciones escondida), no la altura
  // real visible en cada momento — con la barra visible (el estado normal
  // al recién entrar, o al hacer cualquier gesto) el contenedor se pasa por
  // abajo del borde inferior real de la pantalla, dejando la mesa
  // parcialmente tapada o forzando un salto de layout al esconderse la
  // barra — exactamente la sensación de "esto es una página web" en vez de
  // una pantalla de juego fija. `100dvh` (dynamic viewport height, con
  // soporte amplio en navegadores mobile modernos) mide el alto VISIBLE
  // real en cada momento, así que el contenedor nunca se pasa del marco
  // visible ni salta al aparecer/ocultarse la barra.
  fondoPagina: {
    width: '100vw',
    height: '100dvh',
    background: '#2D1B14',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  // Mismo proporción que el canvas (800x600 = 4:3), con un límite de
  // tamaño razonable para pantallas grandes. Position:relative acá (no
  // en fondoPagina) es lo que hace que el chat y el botón se posicionen
  // respecto al juego, no respecto a toda la ventana.
  // Decimocuarto pase: este `maxWidth` estaba hardcodeado en 1200 —
  // una TERCERA copia suelta del mismo "tamaño máximo del juego" que
  // `ANCHO_MAX_CSS` en gameConfigOnline.js (que pasó de 1200 a 900 y ahora
  // a 1100 sin que nadie tocara este número). Mientras coincidían por
  // casualidad (ambos en 1200) no se notaba, pero al desincronizarse dejó
  // un margen entre el borde de este contenedor y el borde real del canvas
  // (que Phaser centra adentro, respetando `scale.max`) — y el chat/botón
  // de configuración, posicionados respecto a ESTE contenedor (`top/right:
  // 12`, `bottom/right: 12`), quedaban en ese margen, es decir visualmente
  // "afuera" del área real del juego en vez de pegados a su borde. Ahora
  // importa la misma constante que ya usa el canvas, así que el margen es
  // siempre cero (contenedor y canvas miden lo mismo) sin importar qué
  // tamaño se elija más adelante.
  //
  // Pase siguiente: el mismo bug del comentario de arriba podía volver a
  // aparecer en el otro eje — `width: 100%` + `aspectRatio: 4/3` calculan
  // el alto a partir del ancho, y DESPUÉS `maxHeight: 95vh` lo recortaba
  // si no entraba, pero recortar solo el alto rompe la proporción 4:3 (el
  // ancho se queda como estaba). Con una ventana baja de altura, el
  // contenedor quedaba más "ancho" que 4:3 real — Phaser sigue centrando
  // un canvas 4:3 más angosto adentro (letterbox), y el chat/botones,
  // anclados a las esquinas de ESTE contenedor (no a las del canvas),
  // quedaban flotando fuera del área visible del juego. Fix: en vez de
  // fijar el ancho y recortar el alto después, `width` ahora es el mínimo
  // entre las tres cotas (100% del padre, el máximo en px, y el máximo
  // que entra en 95vh convertido a ancho vía la proporción 4:3) — así el
  // alto que sale de `aspectRatio` nunca necesita recortarse aparte, y el
  // contenedor es SIEMPRE 4:3 real, sin importar qué eje sea el que achica.
  // Pase 208: mismo motivo que fondoPagina de arriba — 95vh calculaba
  // sobre el alto máximo teórico (barra de direcciones escondida), no el
  // visible real, así que este límite de ancho podía quedarse corto o
  // largo según el estado de esa barra en cada momento. 95dvh sigue el
  // alto visible real.
  // Pase 394: ventana angosta — el canvas llena el ancho y el alto (con tope de
  // proporcion, ver RELACION_ALTO_MAX en gameConfigOnline.js).
  contenedorJuegoAngosto: {
    position: 'relative',
    width: '100%',
    height: 'min(100dvh, calc(100vw * 4))',
  },
  contenedorJuego: {
    position: 'relative',
    width: `min(100%, ${ANCHO_MAX_CSS}px, calc(95dvh * 4 / 3))`,
    aspectRatio: '4 / 3',
  },
}