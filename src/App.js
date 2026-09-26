import './components/AppShell/app-shell.css';
import React, { useState, useEffect, useCallback } from 'react';
import { API_URL } from './config';
import AuthScreen from './components/Auth/AuthScreen';
import Lobby from './components/Lobby/Lobby';
import GameOnlinePhaser from './components/GameOnline/GameOnlinePhaser';
import Ranking from './components/Ranking/Ranking';
import Torneos from './components/Torneos/Torneos';
import BracketView from './components/Torneos/BracketView';
import AppShell from './components/AppShell/AppShell';
import Historial from './components/Historial/Historial';
import Configuracion from './components/Configuracion/Configuracion';
import PoliticaPrivacidad from './components/Configuracion/PoliticaPrivacidad';
import OlvidePassword from './components/Auth/OlvidePassword';
import ResetPassword from './components/Auth/ResetPassword';
import Perfil from './components/Perfil/perfil';
import Tienda from './components/Tienda/Tienda';
import ChatGlobal from './components/ChatGlobal/ChatGlobal';
import MonedaEasterEgg from './components/MonedaEasterEgg';
import LogroDesbloqueadoPopup from './components/Lobby/LogroDesbloqueadoPopup';
import { ToastProvider } from './contexts/ToastContext';
import { getSocket } from './services/socket';
import AvisosGlobales from './components/Desafio/AvisosGlobales';

function App() {
  const CLAVE_MUSICA_MUTEADA = 'truco_musica_muteada';
  const CLAVE_MUSICA_VOLUMEN = 'truco_musica_volumen';
  const CLAVE_VOCES_VOLUMEN = 'truco_voces_volumen';
  const [pantalla, setPantalla] = useState('auth');
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);
  const [codigoSalaActual, setCodigoSalaActual] = useState(null);
  const [torneoIdActual, setTorneoIdActual] = useState(null);
  const [torneoDestacado, setTorneoDestacado] = useState(null);
  const [resetToken, setResetToken] = useState(null);
  const [codigoParaUnirse, setCodigoParaUnirse] = useState('');
  // Pase siguiente: logros recién desbloqueados en la última partida (ver
  // LogroDesbloqueadoPopup.js) — se llena desde GameOnlinePhaser justo
  // cuando el jugador aprieta "Volver al Lobby", y se vacía solo cuando el
  // popup terminó de mostrarlos todos.
  const [logrosParaPopup, setLogrosParaPopup] = useState([]);
  // Punto rojo en el ícono de "Chat" — ver el useEffect de más abajo que
  // escucha 'chat-global:mensaje-nuevo' a nivel de App.
  const [chatGlobalSinLeer, setChatGlobalSinLeer] = useState(false);
  // Pase siguiente: el mismo punto rojo de "Chat" ahora también se
  // enciende si hay solicitudes de amistad pendientes RECIBIDAS — no hay
  // evento de socket para amistad (fue una decisión explícita del pase
  // del sistema de amigos, para no sumarle más eventos al socket
  // compartido), así que este número se refresca por polling en vez de
  // en vivo.
  // Pase 196: el polling en sí (fetch + setInterval) se mudó a
  // AvisosGlobales.js — ahí también hace falta la lista completa (no solo
  // el conteo) para poder avisar con un toast la solicitud NUEVA que
  // apareció, y AvisosGlobales es quien tiene acceso a useToast (ver
  // comentario grande en ese archivo). Acá solo queda el estado del
  // conteo, que AvisosGlobales actualiza vía onCambioSolicitudesPendientes
  // para seguir encendiendo este mismo punto rojo.
  const [solicitudesAmistadPendientes, setSolicitudesAmistadPendientes] = useState(0);
  // Octogésimo tercer pase (web, mismo criterio que nativo): el botón de
  // mutear música que vivía en AppShell (arriba de TODAS las pantallas con
  // nav) se sacó de ahí y se reemplazó por el slider de volumen que ya usa
  // ConfiguracionMesaModal, ahora también en Configuracion.js (Ajustes) —
  // ver más abajo. `musicaMuteada`/`handleToggleMusica` se dejan tal cual,
  // siguen usándose en AuthScreen (el botón de música de la pantalla de
  // login, que no tiene Ajustes disponible).
  const [musicaMuteada, setMusicaMuteada] = useState(
    localStorage.getItem(CLAVE_MUSICA_MUTEADA) === 'true'
  );
  // Volumen de la música de fondo y de las voces de los cantos, elegidos
  // por el usuario desde el panel de configuración de la partida (ver
  // ConfiguracionMesaModal.js). 0.25 y 0.85 son los mismos valores fijos
  // que ya usaba el juego antes de que esto fuera configurable.
  const [musicaVolumen, setMusicaVolumen] = useState(() => {
    const guardado = localStorage.getItem(CLAVE_MUSICA_VOLUMEN);
    return guardado !== null ? Number(guardado) : 0.25;
  });
  const [vocesVolumen, setVocesVolumen] = useState(() => {
    const guardado = localStorage.getItem(CLAVE_VOCES_VOLUMEN);
    return guardado !== null ? Number(guardado) : 0.85;
  });
  const audioRef = React.useRef(null);

  const buscarTorneoDestacado = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/torneos`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) return;

      const candidato = data.find(t =>
        t.estado === 'inscripcion' &&
        !t.ya_inscripto &&
        Number(t.entradas_actuales) < Number(t.cupo_entradas)
      );
      setTorneoDestacado(candidato || null);
    } catch (err) {
      console.error('Error buscando torneo destacado:', err);
    }
  }, [token]);

  // Música de fondo persistente — vive en el nivel más alto de la app
  // para que no se corte al cambiar de pantalla. Los navegadores bloquean
  // el autoplay con sonido hasta que el usuario interactúa una vez con la
  // página, así que intentamos reproducir al montar y, si falla, quedamos
  // esperando el primer clic en cualquier lugar para reintentar.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = musicaVolumen;
    audio.muted = musicaMuteada;

    const intentarReproducir = () => {
      audio.play().catch(() => {});
    };
    intentarReproducir();

    document.addEventListener('click', intentarReproducir, { once: true });
    return () => document.removeEventListener('click', intentarReproducir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = musicaMuteada;
    localStorage.setItem(CLAVE_MUSICA_MUTEADA, musicaMuteada ? 'true' : 'false');
  }, [musicaMuteada]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = musicaVolumen;
    localStorage.setItem(CLAVE_MUSICA_VOLUMEN, String(musicaVolumen));
  }, [musicaVolumen]);

  useEffect(() => {
    localStorage.setItem(CLAVE_VOCES_VOLUMEN, String(vocesVolumen));
  }, [vocesVolumen]);

  const handleToggleMusica = () => {
    setMusicaMuteada(prev => !prev);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const path = window.location.pathname;

    if (path === '/reset-password' && params.get('token')) {
      setResetToken(params.get('token'));
      setPantalla('reset-password');
      return;
    }
    if (path === '/olvidar-password') {
      setPantalla('olvide-password');
      return;
    }
    // Ruta pública (sin login) para la Política de Privacidad — la pide
    // Facebook Login para poder pasar la app a modo Live (antes solo se
    // podía ver logueado, dentro de Ajustes).
    if (path === '/privacidad') {
      setPantalla('privacidad-publica');
      return;
    }

    const preview = params.get('preview');
    if (preview) {
      setCodigoSalaActual(`PREVIEW_${preview.toUpperCase()}`);
      setPantalla('juego');
      return;
    }

    const restaurarSesion = async () => {
      const tokenGuardado = localStorage.getItem('truco_token');
      const usuarioGuardado = localStorage.getItem('truco_usuario');

      if (tokenGuardado && usuarioGuardado) {
        setToken(tokenGuardado);
        setUsuario(JSON.parse(usuarioGuardado));

        const habiaPartida = await verificarPartidaActiva(tokenGuardado);
        if (!habiaPartida) {
          const codigoDesdeUrl = params.get('codigo');
          if (codigoDesdeUrl) {
            setCodigoSalaActual(codigoDesdeUrl);
          }
          setPantalla('lobby');
        }
      }
    };

    const codigoDesdeUrl = params.get('codigo');
    if (codigoDesdeUrl) {
      setCodigoParaUnirse(codigoDesdeUrl.toUpperCase());
    }

    restaurarSesion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLoginExitoso = async (usuarioData, tokenData) => {
    setUsuario(usuarioData);
    setToken(tokenData);

    const habiaPartida = await verificarPartidaActiva(tokenData);
    if (!habiaPartida) {
      setPantalla('lobby');
    }
  };

  const verificarPartidaActiva = async (tokenActual) => {
    try {
      const res = await fetch(`${API_URL}/api/salas/mi-partida-activa`, {
        headers: { 'Authorization': `Bearer ${tokenActual}` }
      });
      const data = await res.json();

      if (res.ok && data.enPartida) {
        setCodigoSalaActual(data.codigoSala);
        setPantalla('juego');
        return true;
      }
    } catch (err) {
      console.error('Error verificando partida activa:', err);
    }
    return false;
  };

  const buscarPartidaActiva = async () => {
    const habiaPartida = await verificarPartidaActiva(token);
    if (!habiaPartida) {
      alert('No tenés ninguna partida activa en este momento.');
    }
  };

  const handleUsuarioActualizado = (usuarioActualizado) => {
    setUsuario(usuarioActualizado);
    localStorage.setItem('truco_usuario', JSON.stringify(usuarioActualizado));
  };

  const actualizarPerfil = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/auth/perfil`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        handleUsuarioActualizado(data.usuario);
      }
    } catch (err) {
      console.error('Error actualizando perfil:', err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const bonusDisponible = (() => {
    if (!usuario?.ultimo_bonus_diario) return true;
    const hoy = new Date().toDateString();
    const ultimo = new Date(usuario.ultimo_bonus_diario).toDateString();
    return hoy !== ultimo;
  })();

  const handleReclamarBonus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/reclamar-bonus-diario`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        alert(data.error || 'No se pudo reclamar el bono');
        return;
      }

      alert(data.mensaje);
      actualizarPerfil();
    } catch (err) {
      console.error('Error reclamando bono diario:', err);
      alert('No se pudo conectar con el servidor');
    }
  };

  useEffect(() => {
    if (['lobby', 'torneos', 'ranking', 'historial', 'perfil', 'config', 'tienda', 'chat'].includes(pantalla)) {
      actualizarPerfil();
      buscarTorneoDestacado();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pantalla]);

  // Pase siguiente: punto rojo en el ícono de "Chat" cuando llega un
  // mensaje al Chat Global mientras NO estás en esa pantalla — antes,
  // si no tenías la pestaña de Chat Global abierta, no te enterabas de
  // nada (ni de mensajes ni de quién está en línea), sin ningún aviso.
  // Este listener vive a nivel de App (no dentro de ChatGlobal.js, que
  // solo existe mientras esa pantalla está montada) y usa el MISMO
  // socket compartido (getSocket) — se conecta y hace 'entrar' apenas
  // hay usuario logueado, igual que ChatGlobal.js, así que de paso
  // cualquier usuario logueado cuenta como "en línea" en Chat Global aun
  // sin haber abierto esa pantalla nunca.
  const pantallaRef = React.useRef(pantalla);
  useEffect(() => { pantallaRef.current = pantalla; }, [pantalla]);

  useEffect(() => {
    if (!token || !usuario?.id) return;

    const socket = getSocket();
    const entrarAlChatGlobal = () => socket.emit('chat-global:entrar', { usuario });
    socket.on('connect', entrarAlChatGlobal);
    socket.connect();
    if (socket.connected) entrarAlChatGlobal();

    const alRecibirMensaje = (msg) => {
      if (pantallaRef.current === 'chat') return;
      if (msg?.usuario === usuario.username) return;
      setChatGlobalSinLeer(true);
    };
    socket.on('chat-global:mensaje-nuevo', alRecibirMensaje);

    // Pase siguiente: BUG REAL — el punto rojo de "Chat" solo se
    // encendía con mensajes de Chat Global, nunca con mensajes privados
    // nuevos. Se enciende con cualquiera de los dos (mismo criterio que
    // ya usa "entrar a la pantalla de Chat lo apaga", más abajo).
    const alMensajePrivado = (msg) => {
      if (pantallaRef.current === 'chat') return;
      if (msg?.de === usuario.username) return;
      setChatGlobalSinLeer(true);
    };
    socket.on('privado:mensaje-nuevo', alMensajePrivado);

    return () => {
      socket.off('connect', entrarAlChatGlobal);
      socket.off('chat-global:mensaje-nuevo', alRecibirMensaje);
      socket.off('privado:mensaje-nuevo', alMensajePrivado);
    };
  }, [token, usuario]);

  // Al entrar a la pantalla de Chat Global se apaga el punto rojo — ya
  // se dio cuenta.
  useEffect(() => {
    if (pantalla === 'chat') setChatGlobalSinLeer(false);
  }, [pantalla]);

  // Pase 196: el polling de solicitudes de amistad (antes acá) se mudó a
  // AvisosGlobales.js — ver el comentario junto a la declaración del
  // estado más arriba y el comentario grande en ese archivo.

  const handleLogout = () => {
    localStorage.removeItem('truco_token');
    localStorage.removeItem('truco_usuario');
    setUsuario(null);
    setToken(null);
    setPantalla('auth');
  };

  // Único elemento de audio de toda la app. Se renderiza siempre, fuera
  // de los `if` de pantalla, para que nunca se desmonte al navegar.
  const elementoAudio = (
    <audio ref={audioRef} src="/assets/sounds/musica-fondo.mp3" loop />
  );

  let contenido = null;

  if (pantalla === 'auth') {
    contenido = (
      <AuthScreen
        onLoginExitoso={handleLoginExitoso}
        onOlvidoPassword={() => setPantalla('olvide-password')}
        musicaMuteada={musicaMuteada}
        onToggleMusica={handleToggleMusica}
      />
    );
  } else if (pantalla === 'olvide-password') {
    contenido = <OlvidePassword onVolverLogin={() => setPantalla('auth')} />;
  } else if (pantalla === 'privacidad-publica') {
    contenido = (
      <PoliticaPrivacidad
        textoVolver="← Volver al inicio"
        onVolver={() => {
          setPantalla('auth');
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  } else if (pantalla === 'reset-password') {
    contenido = (
      <ResetPassword
        token={resetToken}
        onExito={() => {
          setResetToken(null);
          setPantalla('auth');
          window.history.replaceState({}, '', '/');
        }}
      />
    );
  } else if (['lobby', 'torneos', 'ranking', 'historial', 'perfil', 'config', 'tienda', 'chat', 'privacidad'].includes(pantalla)) {
    contenido = (
      <>
        {/* Pase de la plaqueta de trofeo: se saca el emoji 🏆 del texto de
            bannerTexto (prop de acá abajo) — la nueva imagen de fondo del
            banner (ver app-shell.css, .ts-banner) ya trae un trofeo
            ilustrado a la izquierda.
            Pase siguiente: se saca también el TÍTULO del torneo del texto
            — el usuario pidió achicarlo porque un título largo obligaba a
            usar letra chica para que entrara en la plaqueta. No hay ningún
            horario de inicio guardado en la base para mostrar en su lugar
            (los torneos arrancan cuando se llena el cupo, no a una hora
            fija) — confirmado con el usuario vía pregunta directa: texto
            genérico, sin título ni horario. */}
        <AppShell
          usuario={usuario}
          pantallaActiva={pantalla}
          onNavegar={setPantalla}
          onLogout={handleLogout}
          bannerTexto={torneoDestacado ? '¡Hay un torneo abierto! Anotate ahora' : null}
          onBannerClick={() => setPantalla('torneos')}
          bonusDisponible={bonusDisponible}
          onReclamarBonus={handleReclamarBonus}
          badges={{ chat: chatGlobalSinLeer || solicitudesAmistadPendientes > 0 }}
        >
          {pantalla === 'lobby' && (
            <Lobby
              token={token}
              usuario={usuario}
              onBuscarPartidaActiva={buscarPartidaActiva}
              onEntrarAPartida={(codigoSala) => {
                setCodigoSalaActual(codigoSala);
                setPantalla('juego');
              }}
              onMisionReclamada={actualizarPerfil}
              codigoInicial={codigoParaUnirse}
              // Pase siguiente: el banner de torneo ahora lo dibuja el
              // propio Lobby (comparte fila con "Jugar ya") — mismos
              // valores que ya se le pasaban a AppShell más abajo.
              bannerTexto={torneoDestacado ? '¡Hay un torneo abierto! Anotate ahora' : null}
              onBannerClick={() => setPantalla('torneos')}
            />
          )}

          {pantalla === 'torneos' && (
            <Torneos
              token={token}
              onVolver={() => setPantalla('lobby')}
              onVerBracket={(torneoId) => {
                if (!torneoId) {
                  console.warn('juego-terminado llegó sin torneoId válido, volviendo al Lobby en su lugar');
                  setPantalla('lobby');
                  return;
                }
                setTorneoIdActual(torneoId);
                setPantalla('bracket');
              }}
            />
          )}

          {pantalla === 'ranking' && (
            <Ranking token={token} usuarioActual={usuario.username} />
          )}

          {pantalla === 'historial' && (
            <Historial token={token} />
          )}
          {pantalla === 'perfil' && (
            <Perfil
              token={token}
              usuario={usuario}
              onNavegar={setPantalla}
              onPerfilActualizado={actualizarPerfil}
            />
          )}
          {pantalla === 'tienda' && (
            <Tienda usuario={usuario} />
          )}
          {pantalla === 'chat' && (
            <ChatGlobal token={token} usuario={usuario} />
          )}
          {pantalla === 'config' && (
            <Configuracion
              token={token}
              usuario={usuario}
              onPersonajeCambiado={actualizarPerfil}
              musicaVolumen={musicaVolumen}
              onCambiarMusicaVolumen={setMusicaVolumen}
              onNavegar={setPantalla}
            />
          )}
          {pantalla === 'privacidad' && (
            <PoliticaPrivacidad onVolver={() => setPantalla('config')} />
          )}
        </AppShell>
        <MonedaEasterEgg token={token} pantalla={pantalla} onEncontrada={actualizarPerfil} />
      </>
    );
  } else if (pantalla === 'bracket') {
    contenido = (
      <BracketView
        torneoId={torneoIdActual}
        usuario={usuario}
        token={token}
        onVolver={() => setPantalla('torneos')}
        onEntrarAPartida={(codigoSala) => {
          setCodigoSalaActual(codigoSala);
          setPantalla('juego');
        }}
      />
    );
  } else if (pantalla === 'juego') {
    contenido = (
      <GameOnlinePhaser
        token={token}
        usuario={usuario}
        codigoSala={codigoSalaActual}
        onVolverLobby={() => setPantalla('lobby')}
        onRevancha={(nuevoCodigo) => setCodigoSalaActual(nuevoCodigo)}
        onVerBracket={(torneoId) => {
          setTorneoIdActual(torneoId);
          setPantalla('bracket');
        }}
        musicaVolumen={musicaVolumen}
        onCambiarMusicaVolumen={setMusicaVolumen}
        vocesVolumen={vocesVolumen}
        onCambiarVocesVolumen={setVocesVolumen}
        onLogrosDesbloqueados={setLogrosParaPopup}
      />
    );
  }

  return (
    <ToastProvider>
      {elementoAudio}
      {contenido}
      <LogroDesbloqueadoPopup logros={logrosParaPopup} onCerrarTodos={() => setLogrosParaPopup([])} />
      {/* Pase siguiente: puente de "Desafiar"/mensaje privado — ver el
          comentario grande en AvisosGlobales.js sobre por qué vive ACÁ
          adentro (dentro de ToastProvider) y no arriba en App() mismo. */}
      <AvisosGlobales
        usuario={usuario}
        token={token}
        onAceptarDesafio={(codigo) => {
          setCodigoSalaActual(codigo);
          setPantalla('juego');
        }}
        onCambioSolicitudesPendientes={setSolicitudesAmistadPendientes}
      />
    </ToastProvider>
  );
}

export default App;