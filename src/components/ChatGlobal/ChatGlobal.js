import React, { useState, useRef, useEffect } from 'react';
import './chat-global.css';
import PerfilRivalModal from '../PerfilRival/PerfilRivalModal';
import MensajePrivadoModal from '../MensajePrivado/MensajePrivadoModal';
import { getSocket } from '../../services/socket';
// Pase siguiente — BUG REAL reportado (nativo, pero el mismo código vive
// acá también): "Agregar amigo" desde el menú "⋮" no daba ningún aviso de
// éxito/error — si el pedido fallaba (por ejemplo por el cooldown
// anti-spam del pase 197) quedaba en silencio total. Se agrega feedback
// real con toasts, igual que ya tiene "Desafiar" (ver AvisosGlobales.js).
import { useToast } from '../../contexts/ToastContext';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/chat-global`;
// Pase siguiente: el menú "⋮" de cada jugador en línea ahora pega contra
// los endpoints reales de amistad/bloqueo de routes/usuarios.js (mismo
// backend que ya usa PerfilRivalModal.js) — antes era un tooltip fijo de
// "Muy pronto...".
const API_USUARIOS = `${BASE_URL}/api/usuarios`;

// Centésimo cuadragésimo quinto pase — primera versión de la pantalla de
// Chat Global (lobby), a pedido del usuario, con "libertad total" de
// layout dentro de la estética ya establecida. Mismo criterio de paleta
// que el resto de las pantallas (cada componente define su propio `C`,
// no hay un archivo de colores compartido en este repo).
const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c', verdeProfundo: '#163f24',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8', celesteOscuro: '#2f8dbf',
  crema: '#FFF8ED', chocolate: '#4A2C2A', cremaSutil: '#FFFCF6',
  // Ducentésimo quincuagésimo séptimo pase: paleta de madera+bronce del
  // panel exterior nuevo (mismos tonos que ya usa `estilos.panelExterior`
  // de Historial.js, para que los dos módulos compartan una sola
  // identidad visual "pulpería" en vez de dos recetas de madera distintas).
  maderaClara: '#6b4a34', maderaMedia: '#4a3226', maderaOscura: '#2a1c14',
  bronce: '#c9973e', bronceClaro: '#f0d9a0', bronceOscuro: '#7a5322',
  negroPulido: '#1a1410',
};

// Pase del backend real de Chat Global: mismo criterio de avatar que ya
// usan Ranking.js/Perfil.js/PerfilRivalModal.js/el header — foto real si
// el usuario eligió "foto" y tiene una subida, si no el ilustrado según
// personaje. Se repite acá en vez de importarlo porque ninguno de esos
// archivos lo exporta (cada uno define su propia copia chica).
function avatarSrcDe(u) {
  return u?.avatar_tipo === 'foto' && u?.foto_perfil_url
    ? u.foto_perfil_url
    : `/assets/${u?.personaje || 'gaucho'}-avatar.png`;
}

// Ducentésimo quincuagésimo tercer pase: para la tarjeta chica de
// "Jugadores en línea" (32x32) el cuerpo completo del personaje no se
// distingue — mismo criterio que ya usa el botón de stickers (ver más
// abajo, `expresionesGaucho/${personaje}_victorioso.png`): en ese tamaño
// se lee mejor la cara sola. Si el usuario eligió foto real, se sigue
// mostrando la foto (no tiene sentido reemplazar una foto real por un
// dibujo) — solo cambia la rama ilustrada.
function caraSrcDe(u) {
  return u?.avatar_tipo === 'foto' && u?.foto_perfil_url
    ? u.foto_perfil_url
    : `/assets/expresionesGaucho/${u?.personaje || 'gaucho'}_victorioso.png`;
}

// Ducentésimo quincuagésimo tercer pase: primer paso del sistema de
// "bordes de avatar según rango" (a futuro, también customizables) que
// pidió el usuario — arranca acá, en la lista de "Jugadores en línea".
// El backend (`rangos.js`, única fuente de verdad de los 10 escalones)
// manda el rango ya como texto armado ("Mancebo III", "Martín Fierro",
// sin división en el escalón tope) — no hay un campo separado con el
// nombre del escalón solo, así que se le saca la división romana del
// final acá (si tiene) para llegar al nombre del escalón, y de ahí a un
// slug de archivo (sin acentos/espacios). Todavía no existe NINGÚN
// asset de borde — el `onError` de la `<img>` (ver el JSX) hace que
// simplemente no se muestre nada hasta que el archivo real exista, en
// vez de romper con el ícono de imagen rota. Así se puede ir sumando un
// borde por escalón (o más adelante, un borde elegido por el usuario)
// sin tocar este código de nuevo, solo agregando el PNG correspondiente.
function bordeSrcDe(rangoTexto) {
  if (!rangoTexto) return null;
  const nombreEscalon = rangoTexto.replace(/\s+(III|II|I)$/, '').trim();
  const slug = nombreEscalon
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-');
  return `/assets/images/bordes/borde-${slug}.png`;
}

const FRASES_RAPIDAS = [
  '¡Vamos que se puede! 💪',
  'Buena mano 👏',
  'GG, buena partida 🤝',
  '¡Truco canta el gallo! 🐓',
  'Suerte a todos 🍀',
  '¿Alguien se anima a una privada?',
];

const EMOJIS_RAPIDOS = ['😄', '😂', '🔥', '👏', '🎉', '😅', '🤔', '😎', '🙌', '♠️', '🃏', '☕'];

function horaCorta(fecha) {
  return new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function ChatGlobal({ token, usuario, abrirSolicitudesSenial }) {
  const { mostrarToast } = useToast();
  const usuarioActual = usuario?.username;
  // Pase siguiente: hace falta para elegir la cara de expresión correcta
  // en el botón de emojis (mismo criterio que ChatMesa.js).
  const personaje = usuario?.personaje || 'gaucho';
  const [tab, setTab] = useState('global'); // 'global' | 'privado'
  const [mensajes, setMensajes] = useState([]);
  const [usuariosOnline, setUsuariosOnline] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [texto, setTexto] = useState('');
  const [sidebarAbierto, setSidebarAbierto] = useState(false);
  const [emojisAbiertos, setEmojisAbiertos] = useState(false);
  const [frasesAbiertas, setFrasesAbiertas] = useState(false);
  const [perfilAbierto, setPerfilAbierto] = useState(null);
  // Pase siguiente: mismo modal de mensaje 1 a 1 que ya usa PerfilRivalModal
  // — se abre desde el menú "⋮" de esta lista cuando ya son amigos.
  const [mensajePrivadoAbierto, setMensajePrivadoAbierto] = useState(null);
  // Pase siguiente: el botón de acción "⋮" por jugador ahora abre un menú
  // real (antes solo mostraba el aviso "Próximamente"). `accionAbierta`
  // guarda el username cuyo menú está abierto; `accionInfo` guarda el
  // estado de amistad/bloqueo de ESE usuario puntual, pedido on-demand a
  // GET /perfil-publico/:username recién al abrir el menú (no se le pide
  // ese detalle a la lista completa de en línea, que no lo necesita).
  const [accionAbierta, setAccionAbierta] = useState(null);
  const [accionInfo, setAccionInfo] = useState(null);
  // Pase siguiente: panel de solicitudes de amistad RECIBIDAS — sin esto,
  // la única forma de enterarse de una solicitud pendiente sería abrir el
  // menú de ESE jugador puntual en la lista de en línea (y ni siquiera
  // aparece ahí si no está conectado en este momento). Se carga una vez
  // al entrar al chat (GET /solicitudes-amistad) y se actualiza en el
  // momento al aceptar/rechazar, sin re-pedir la lista entera.
  const [solicitudesAmistad, setSolicitudesAmistad] = useState([]);
  const [solicitudesAbiertas, setSolicitudesAbiertas] = useState(false);
  const [procesandoSolicitud, setProcesandoSolicitud] = useState(null);

  // Pase 205: tocar el toast de "te envió una solicitud de amistad" (ver
  // AvisosGlobales.js) ahora trae hasta acá y además abre directamente
  // este panel — antes el toast no llevaba a ningún lado (bug reportado
  // por el usuario). `abrirSolicitudesSenial` es un número que App.js
  // incrementa cada vez que se toca ese toast: cualquier cambio (incluso
  // a un valor ya visto antes) dispara este efecto, así que sirve como
  // señal de "un solo disparo" sin necesitar que nadie la resetee. Se
  // ignora el valor inicial (0/undefined) para no abrir nada solo por
  // entrar a esta pantalla de la forma normal.
  useEffect(() => {
    if (!abrirSolicitudesSenial) return;
    setSidebarAbierto(true);
    setSolicitudesAbiertas(true);
  }, [abrirSolicitudesSenial]);
  // Pase 196: lista de amigos para la pestaña "Privado" rediseñada como
  // tarjetas (ver GET /api/usuarios/amigos, que ahora manda `sin_leer` por
  // cada amigo). Cubre también el pedido separado de "una lista de
  // amigos" — esta pestaña ya es esa lista, no se agrega una pantalla
  // aparte para lo mismo.
  const [amigos, setAmigos] = useState([]);
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  // Pase del backend real de Chat Global: historial por REST (una sola
  // vez al entrar) + sala de socket dedicada ('chat-global', separada de
  // las salas de partida) para mensajes y lista de en línea en vivo.
  // Mismo socket compartido que ya usan ChatMesa.js/GameSceneOnline.js
  // (ver services/socket.js) — como `autoConnect` está en false y esta
  // pantalla puede abrirse desde el Lobby sin estar en ninguna partida,
  // hay que conectarlo manualmente acá si todavía no lo está. No se
  // desconecta al desmontar: si hay una partida en curso en otra pestaña
  // de la app usando el mismo socket, cortarlo la rompería.
  useEffect(() => {
    if (!token || !usuario?.id) return;

    let activo = true;

    fetch(`${API_URL}/historial`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        if (activo && Array.isArray(data)) setMensajes(data);
      })
      .catch((err) => console.error('Error cargando historial de Chat Global:', err));

    const socket = getSocket();

    // Bug real (reportado por el usuario: la lista de "en línea" no se
    // actualiza sola, a veces queda en "0 en línea" con gente conectada,
    // hay que recargar la página). No era, como se sospechaba antes, una
    // carrera entre connect() y este emit — socket.io-client encola los
    // emits mientras el socket no está conectado y los manda apenas
    // conecta, así que ESE emit siempre llega. El problema real es que
    // este efecto emite 'chat-global:entrar' UNA sola vez (al montar), y
    // si el socket se desconecta y se reconecta solo más adelante (una
    // reconexión de red, el backend reiniciando, quedarse en background)
    // — algo que socket.io-client hace automáticamente por default — el
    // backend pierde el registro de este usuario en la sala 'chat-global'
    // (vivía como propiedad de la conexión VIEJA, `socket.usuarioChatGlobal`,
    // ver index.js) y nadie se entera hasta que alguien recarga la página
    // y vuelve a emitir 'entrar' de cero. Fix: re-emitir 'entrar' en CADA
    // conexión (la primera y cualquier reconexión), escuchando el evento
    // 'connect' en vez de emitir una sola vez al montar.
    const entrarAlChatGlobal = () => socket.emit('chat-global:entrar', { usuario });
    socket.on('connect', entrarAlChatGlobal);
    socket.connect();
    // Si el socket YA estaba conectado (ej: ChatMesa.js lo dejó abierto en
    // otra pestaña de la app), 'connect' no vuelve a disparar — hay que
    // entrar a mano en ese caso.
    if (socket.connected) entrarAlChatGlobal();

    const alRecibirMensaje = (msg) => {
      setMensajes((prev) => [...prev, msg]);
    };
    const alActualizarOnline = (lista) => {
      setUsuariosOnline(lista);
    };

    socket.on('chat-global:mensaje-nuevo', alRecibirMensaje);
    socket.on('chat-global:usuarios-online', alActualizarOnline);

    return () => {
      activo = false;
      socket.off('connect', entrarAlChatGlobal);
      socket.off('chat-global:mensaje-nuevo', alRecibirMensaje);
      socket.off('chat-global:usuarios-online', alActualizarOnline);
    };
  }, [token, usuario]);

  // Pase siguiente: carga las solicitudes de amistad pendientes recibidas
  // (no va por socket — no es tan urgente como los mensajes).
  // BUG REAL reportado: esto cargaba UNA sola vez al entrar, así que si
  // una solicitud nueva llegaba mientras el usuario ya estaba parado en
  // esta pantalla (sin recargar la página), el cartel/panel no se
  // actualizaban — hacía falta un F5 para verla aparecer, aunque el
  // puntito rojo de la pestaña y el toast de AvisosGlobales.js sí llegan
  // en vivo (esos SÍ hacen polling cada 20s). Se pasa a ese mismo
  // intervalo acá también, así queda consistente.
  useEffect(() => {
    if (!token) return;
    let activo = true;

    const cargarSolicitudesAmistad = () => {
      fetch(`${API_USUARIOS}/solicitudes-amistad`, { headers: { Authorization: `Bearer ${token}` } })
        .then((res) => res.json())
        .then((data) => {
          if (activo && Array.isArray(data?.solicitudes)) setSolicitudesAmistad(data.solicitudes);
        })
        .catch((err) => console.error('Error cargando solicitudes de amistad:', err));
    };

    cargarSolicitudesAmistad();
    const intervalo = setInterval(cargarSolicitudesAmistad, 20000);
    return () => { activo = false; clearInterval(intervalo); };
  }, [token]);

  // Pase 196: carga la lista de amigos para la pestaña "Privado" — al
  // entrar, y de nuevo cada vez que se abre esa pestaña (por si se agregó
  // un amigo nuevo, o se leyó un mensaje desde el nativo, mientras tanto).
  // No va por socket, mismo criterio que solicitudes de amistad.
  const cargarAmigos = () => {
    if (!token) return;
    fetch(`${API_USUARIOS}/amigos`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.amigos)) setAmigos(data.amigos);
      })
      .catch((err) => console.error('Error cargando amigos:', err));
  };

  useEffect(() => {
    cargarAmigos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (tab === 'privado') cargarAmigos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Al cerrar la conversación se vuelve a pedir la lista de amigos: abrir
  // el historial (GET .../historial) es lo que marca esos mensajes como
  // leídos del lado del backend (ver routes/mensajesPrivados.js), así que
  // recién ahí el puntito rojo de esa tarjeta puede apagarse.
  const cerrarConversacionPrivada = () => {
    setMensajePrivadoAbierto(null);
    cargarAmigos();
  };

  const responderSolicitud = async (nombreUsuario, aceptar) => {
    setProcesandoSolicitud(nombreUsuario);
    try {
      const res = await fetch(`${API_USUARIOS}/${encodeURIComponent(nombreUsuario)}/${aceptar ? 'aceptar-amistad' : 'amistad'}`, {
        method: aceptar ? 'POST' : 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSolicitudesAmistad((prev) => prev.filter((s) => s.username !== nombreUsuario));
        if (aceptar) mostrarToast(`Ahora son amigos con ${nombreUsuario}.`, 'exito');
      } else {
        mostrarToast(data?.error || 'No se pudo responder la solicitud.', 'error');
      }
    } catch (err) {
      console.error('Error respondiendo solicitud de amistad:', err);
      mostrarToast('No se pudo responder la solicitud.', 'error');
    } finally {
      setProcesandoSolicitud(null);
    }
  };

  const abrirPerfilDe = (nombreUsuario) => {
    if (!nombreUsuario || nombreUsuario === usuarioActual) return;
    setPerfilAbierto(nombreUsuario);
  };

  // Pase siguiente: abre/cierra el menú de un jugador puntual de la lista
  // de en línea. Al abrirlo (no al cerrarlo) pide su estado de amistad y
  // bloqueo — mismo endpoint que ya usa el popup de perfil completo.
  const abrirMenuAccion = (nombreUsuario) => {
    if (accionAbierta === nombreUsuario) {
      setAccionAbierta(null);
      return;
    }
    setAccionAbierta(nombreUsuario);
    setAccionInfo({ cargando: true, amistad: 'ninguna', bloqueado: false, procesando: false });
    fetch(`${API_USUARIOS}/perfil-publico/${encodeURIComponent(nombreUsuario)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (data && !data.error) {
          setAccionInfo({ cargando: false, amistad: data.amistad || 'ninguna', bloqueado: !!data.bloqueado, procesando: false });
        } else {
          setAccionInfo({ cargando: false, error: true });
        }
      })
      .catch((err) => {
        console.error('Error cargando estado de amistad:', err);
        setAccionInfo({ cargando: false, error: true });
      });
  };

  // Una sola función para las tres acciones de amistad — mandar
  // solicitud, aceptarla, o cortar la relación (cancelar/rechazar/
  // eliminar amigo son las tres el mismo DELETE del lado del backend).
  const ejecutarAccionAmistad = async (tipo) => {
    if (!accionAbierta) return;
    const nombreUsuario = accionAbierta;
    const ruta = tipo === 'solicitar' ? 'solicitar-amistad' : tipo === 'aceptar' ? 'aceptar-amistad' : 'amistad';
    const metodo = tipo === 'quitar' ? 'DELETE' : 'POST';
    setAccionInfo((prev) => (prev ? { ...prev, procesando: true } : prev));
    try {
      const res = await fetch(`${API_USUARIOS}/${encodeURIComponent(nombreUsuario)}/${ruta}`, {
        method: metodo,
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      setAccionInfo((prev) => (prev ? { ...prev, amistad: res.ok ? data.amistad : prev.amistad, procesando: false } : prev));
      // BUG REAL reportado (mismo código que el nativo): "Agregar amigo"
      // no daba ningún aviso — si el pedido fallaba (por ejemplo por el
      // cooldown anti-spam del pase 197) quedaba en silencio total.
      if (res.ok) {
        if (data?.mensaje) mostrarToast(data.mensaje, 'exito');
      } else {
        mostrarToast(data?.error || 'No se pudo completar la acción.', 'error');
      }
    } catch (err) {
      console.error('Error en acción de amistad:', err);
      setAccionInfo((prev) => (prev ? { ...prev, procesando: false } : prev));
      mostrarToast('No se pudo completar la acción.', 'error');
    }
  };

  const toggleBloqueoDesdeMenu = async () => {
    if (!accionAbierta || !accionInfo) return;
    const nombreUsuario = accionAbierta;
    const yaBloqueado = accionInfo.bloqueado;
    setAccionInfo((prev) => (prev ? { ...prev, procesando: true } : prev));
    try {
      const res = await fetch(`${API_USUARIOS}/${encodeURIComponent(nombreUsuario)}/bloquear`, {
        method: yaBloqueado ? 'DELETE' : 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setAccionInfo((prev) => (prev ? { ...prev, bloqueado: res.ok ? !yaBloqueado : prev.bloqueado, procesando: false } : prev));
      if (!res.ok) mostrarToast('No se pudo completar la acción.', 'error');
    } catch (err) {
      console.error('Error bloqueando/desbloqueando desde el chat:', err);
      setAccionInfo((prev) => (prev ? { ...prev, procesando: false } : prev));
      mostrarToast('No se pudo completar la acción.', 'error');
    }
  };

  // Mismo criterio que ChatMesa.js: no se agrega el mensaje localmente de
  // forma optimista — se emite y se espera a que el servidor lo devuelva
  // por 'chat-global:mensaje-nuevo' (así todos ven exactamente lo mismo,
  // con el mismo id/hora real, y no hay riesgo de que quede duplicado).
  const enviarMensaje = (e) => {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    getSocket().emit('chat-global:mensaje', { texto: limpio });
    setTexto('');
    setEmojisAbiertos(false);
    setFrasesAbiertas(false);
  };

  const agregarEmoji = (emoji) => {
    setTexto((prev) => `${prev}${emoji}`);
    setEmojisAbiertos(false);
  };

  const enviarFrase = (frase) => {
    getSocket().emit('chat-global:mensaje', { texto: frase });
    setFrasesAbiertas(false);
  };

  const usuariosFiltrados = usuariosOnline.filter((u) =>
    u.username.toLowerCase().includes(busqueda.toLowerCase())
  );

  // Pase siguiente: se saca la pestaña "Sala" — el usuario notó que no
  // tenía sentido ACÁ (Chat Global, la pantalla del lobby): el chat de
  // una partida en curso ya aparece solo, dentro de la mesa de juego
  // (ChatMesa.js), nunca en esta pantalla — esta pestaña nunca mostraba
  // nada, solo el aviso de "Disponible cuando estás jugando una partida".
  const TABS = [
    { id: 'global', label: 'Global' },
    { id: 'privado', label: 'Privado', title: 'Próximamente' },
  ];

  return (
    <div className="cg-pagina" style={estilos.pagina}>
      {/* Ducentésimo quincuagésimo séptimo pase: 4 remaches de bronce en
          las esquinas del panel — mismo recurso que ya usa Historial.js
          (`estilos.remache`), acá también sin asset nuevo (`radial-gradient`
          bronce armado en CSS). */}
      <span style={{ ...estilos.remache, top: 8, left: 8 }} />
      <span style={{ ...estilos.remache, top: 8, right: 8 }} />
      <span style={{ ...estilos.remache, bottom: 8, left: 8 }} />
      <span style={{ ...estilos.remache, bottom: 8, right: 8 }} />

      {/* A. Header */}
      <div style={estilos.header}>
        <div style={estilos.headerIzquierda}>
          {/* Pase siguiente: mismo criterio que el botón "Chat" colapsado
              de la mesa de juego — el emoji 💬 se reemplaza por el ícono
              que ya usa el lobby para "Chat" en el nav (icono-chat.png,
              ver AppShell.js), para que sea el mismo dibujo en todos
              lados. */}
          <img src="/assets/images/icono-chat.png" alt="" style={estilos.headerIcono} />
          <div>
            <div style={estilos.titulo}>Chat Global</div>
            <div style={estilos.online}>
              <span style={estilos.puntoOnline} /> {usuariosOnline.length} en línea
            </div>
          </div>
        </div>

        <div style={estilos.headerTabs}>
          {TABS.map((t) => (
            <button
              key={t.id}
              title={t.title}
              onClick={() => setTab(t.id)}
              style={{ ...estilos.headerTab, ...(tab === t.id ? estilos.headerTabActivo : {}) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button
          className="cg-boton-usuarios"
          style={estilos.botonUsuariosMobile}
          onClick={() => setSidebarAbierto(true)}
        >
          👥 {usuariosOnline.length}
        </button>
      </div>

      {/* Pase 196: antes esto era el ÚNICO indicio de que la pestaña
          "Privado" existía — un cartelito arriba de la MISMA lista de
          mensajes de Chat Global, que seguía mostrándose debajo sin
          cambiar (bug real, misma queja del usuario: la pestaña "Privado"
          no ocultaba nada, así que quedaba pareciendo "otro chat global").
          Ahora la pestaña de verdad cambia el contenido de abajo — ver el
          condicional `tab === 'global' ? ... : ...` dentro de
          columnaChat. */}
      {solicitudesAmistad.length > 0 && (
        // Pase 196 — discoverability: en mobile (ver chat-global.css,
        // clase .cg-banner-solicitudes) el panel de solicitudes de
        // amistad recibidas vive DENTRO de "Jugadores en línea", que a su
        // vez vive detrás del botón "👥" (un drawer aparte) — la única
        // forma de encontrarlo era tocar ese botón sin que nada avisara
        // que había algo ahí. Mismo bug que el usuario confirmó en el
        // nativo (misma estructura); acá no llegó a probarlo pero se
        // aplica el mismo arreglo por consistencia. En desktop no hace
        // falta: la sidebar (con el panel adentro) ya está siempre
        // visible al costado (ver la media query en chat-global.css).
        <button
          type="button"
          className="cg-banner-solicitudes"
          style={estilos.bannerSolicitudes}
          onClick={() => { setSidebarAbierto(true); setSolicitudesAbiertas(true); }}
        >
          🔔 Tenés {solicitudesAmistad.length} solicitud{solicitudesAmistad.length === 1 ? '' : 'es'} de amistad
        </button>
      )}

      {/* Ducentésimo quincuagésimo tercer pase: el usuario confirmó que
          achicar el contenido (pase anterior, `estilos.contenidoMarco`) fue
          en la dirección equivocada — ahora se veía todo más chico y
          aparecían "recuadros chicos" con verde asomando detrás. Se saca
          ese wrapper por completo y en cambio se prueba agrandar el marco
          de madera en sí (ver `estilos.pagina` más abajo: `borderWidth` y
          `borderImageSlice` subieron juntos, misma proporción, para que la
          madera se vea más gruesa/grande sin desdibujar el grabado) a ver
          si un marco más grueso alcanza a tapar el verde que se filtra. */}
      {/* B. Zona principal */}
      <div style={estilos.cuerpo}>
        <div style={estilos.columnaChat}>
        {tab === 'global' ? (
          <>
          <div style={estilos.mensajesLista}>
            {mensajes.map((m, i) => {
              // Pase del backend real: el servidor ya no manda un flag
              // "propio" (no sabe quién está mirando) — se calcula acá
              // comparando contra el usuario logueado. VIP no existe
              // todavía como dato real (ver roadmap de Chat Global), así
              // que ese badge simplemente no aparece por ahora — no es un
              // campo que el backend mande.
              const propio = !m.sistema && m.usuario === usuarioActual;
              // Ducentésimo quincuagésimo pase: "agrupar mensajes seguidos
              // del mismo usuario, achicando el margen entre ellos" — se
              // compara contra el mensaje anterior (no system, mismo
              // usuario) para decidir un marginTop más chico. `gap` del
              // contenedor (`mensajesLista`) se saca y pasa a marginTop acá
              // porque `gap` es uniforme para TODOS los pares — no hay forma
              // de variarlo por par de elementos sin tocar el margen de
              // cada uno individualmente.
              const anterior = mensajes[i - 1];
              const agrupado = i > 0 && anterior && !anterior.sistema && !m.sistema
                && anterior.usuario === m.usuario;
              const margenSuperior = i === 0 ? 0 : (agrupado ? 4 : 14);
              return m.sistema ? (
                <div key={m.id} style={{ ...estilos.mensajeSistema, marginTop: margenSuperior }}>⚡ {m.texto}</div>
              ) : (
                <div
                  key={m.id}
                  style={{
                    ...estilos.filaMensaje,
                    ...(propio ? estilos.filaMensajePropio : {}),
                    marginTop: margenSuperior,
                  }}
                >
                  {!propio && (
                    <img
                      src={avatarSrcDe(m)}
                      alt=""
                      style={estilos.avatar}
                      onClick={() => abrirPerfilDe(m.usuario)}
                    />
                  )}
                  <div style={{ ...estilos.burbuja, ...(propio ? estilos.burbujaPropia : {}) }}>
                    {!propio && (
                      <div style={estilos.filaNombre}>
                        <span
                          style={estilos.nombreUsuario}
                          onClick={() => abrirPerfilDe(m.usuario)}
                        >
                          {m.usuario}
                        </span>
                        <span style={estilos.hora}>{horaCorta(m.timestamp)}</span>
                      </div>
                    )}
                    <div style={estilos.textoMensaje}>{m.texto}</div>
                    {propio && <div style={estilos.horaPropia}>{horaCorta(m.timestamp)}</div>}
                  </div>
                </div>
              );
            })}

            <div ref={finRef} />
          </div>

          {/* C. Input */}
          <div style={estilos.inputContenedor}>
            {emojisAbiertos && (
              <div style={estilos.panelEmojis}>
                {EMOJIS_RAPIDOS.map((e) => (
                  <button key={e} type="button" style={estilos.emojiBoton} onClick={() => agregarEmoji(e)}>
                    {e}
                  </button>
                ))}
              </div>
            )}
            {frasesAbiertas && (
              <div style={estilos.panelFrases}>
                {FRASES_RAPIDAS.map((f) => (
                  <button key={f} type="button" style={estilos.fraseBoton} onClick={() => enviarFrase(f)}>
                    {f}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={enviarMensaje} style={estilos.form}>
              {/* Pase siguiente: dos cambios pedidos juntos — (1) el emoji
                  😄 (glyph de sistema) se reemplaza por la misma cara de
                  expresión "victorioso" del personaje elegido que ya usa
                  el botón de stickers de la mesa de juego (ChatMesa.js);
                  (2) el emoji 🗨️ (era el único lugar donde todavía faltaba
                  poner el ícono de chat nuevo) se reemplaza por el mismo
                  ícono que ya usa el lobby (icono-chat.png). */}
              <button
                type="button"
                title="Emojis"
                style={estilos.botonAuxiliar}
                onClick={() => { setEmojisAbiertos((v) => !v); setFrasesAbiertas(false); }}
              >
                <img src={`/assets/expresionesGaucho/${personaje}_victorioso.png`} alt="Emojis" style={estilos.iconoCaraBotonAuxiliar} />
              </button>
              <button
                type="button"
                title="Frases rápidas"
                style={estilos.botonAuxiliar}
                onClick={() => { setFrasesAbiertas((v) => !v); setEmojisAbiertos(false); }}
              >
                <img src="/assets/images/icono-chat.png" alt="Frases rápidas" style={estilos.iconoChatBotonAuxiliar} />
              </button>
              <input
                type="text"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Escribí un mensaje..."
                maxLength={200}
                style={estilos.input}
              />
              {/* Ducentésimo cuadragésimo séptimo pase: botón + avioncito
                  ilustrados nuevos (ver estilos.botonEnviar) — reemplaza el
                  botón chocolate+dorado que unificaba con ChatMesa.js/
                  juego.tsx; esta pantalla ya tiene su propio look "pulpería"
                  aparte desde el marco de madera, tiene sentido que este
                  botón también sea distinto acá.
                  Ducentésimo cuadragésimo noveno pase: el pill verde y el
                  avioncito dorado eran dos imágenes separadas superpuestas
                  (`boton-enviar-chat.png` + `icono-avioncito-chat.png`) —
                  llegó un asset nuevo con las dos cosas ya combinadas en un
                  solo dibujo, así que se saca el <img> del avioncito de
                  encima (ya viene dibujado adentro del botón). */}
              <button type="submit" style={estilos.botonEnviar} aria-label="Enviar mensaje" />
            </form>
          </div>
          </>
        ) : (
          // Pase 196: pestaña "Privado" rediseñada — antes era un cartel
          // fijo sobre la MISMA lista de Chat Global (ver comentario más
          // arriba). Ahora son tarjetas de amigos (pedido explícito del
          // usuario, que además cubre el pedido separado de "una lista de
          // amigos" — no hace falta una pantalla nueva para eso, esta
          // pestaña YA es esa lista). Tocar una tarjeta abre esa
          // conversación con MensajePrivadoModal, igual que antes se abría
          // desde el menú "⋮" de un jugador en línea.
          <div style={estilos.listaAmigosContenido}>
            {amigos.length === 0 ? (
              <div style={estilos.avisoSinAmigos}>
                Todavía no tenés amigos agregados — agregá desde el perfil de otro jugador (tocando su nombre) para poder chatear acá.
              </div>
            ) : (
              amigos.map((a) => (
                <div key={a.username} style={estilos.tarjetaAmigo}>
                  <button
                    type="button"
                    style={estilos.tarjetaAmigoBoton}
                    onClick={() => setMensajePrivadoAbierto(a.username)}
                  >
                    <div style={estilos.avatarAmigoContenedor}>
                      <img src={avatarSrcDe(a)} alt="" style={estilos.avatarAmigo} />
                      {a.sin_leer && <span style={estilos.puntoSinLeer} />}
                    </div>
                    <span style={estilos.tarjetaAmigoNombre}>{a.username}</span>
                  </button>
                  {/* Pase 197: desafío rápido — mismo emit que ya usa el
                      menú "⋮" de "Jugadores en línea" para "⚔️ Desafiar",
                      así no hay que ir a buscar al amigo en esa lista si
                      ya lo tenés a mano acá. */}
                  <button
                    type="button"
                    style={estilos.botonDesafiarAmigo}
                    onClick={() => getSocket().emit('desafio:enviar', { paraUsername: a.username })}
                  >
                    ⚔️ Desafiar
                  </button>
                </div>
              ))
            )}
          </div>
        )}
        </div>

        {/* Overlay (solo se ve en mobile, ver chat-global.css) */}
        <div
          className={`cg-overlay ${sidebarAbierto ? 'cg-overlay-visible' : ''}`}
          onClick={() => setSidebarAbierto(false)}
        />

        {/* Sidebar de usuarios en línea */}
        <div className={`cg-sidebar ${sidebarAbierto ? 'cg-sidebar-abierta' : ''}`} style={estilos.sidebar}>
          <div style={estilos.sidebarHeader}>
            <span style={estilos.sidebarTitulo}>Jugadores en línea</span>
            <button className="cg-boton-usuarios" style={estilos.botonCerrarSidebar} onClick={() => setSidebarAbierto(false)}>✕</button>
          </div>
          {solicitudesAmistad.length > 0 && (
            <div style={estilos.panelSolicitudes}>
              <button
                type="button"
                style={estilos.botonSolicitudesToggle}
                onClick={() => setSolicitudesAbiertas((v) => !v)}
              >
                🔔 Solicitudes de amistad ({solicitudesAmistad.length})
              </button>
              {solicitudesAbiertas && solicitudesAmistad.map((s) => (
                <div key={s.username} style={estilos.filaSolicitud}>
                  <img src={avatarSrcDe(s)} alt="" style={estilos.avatarChico} />
                  <div style={estilos.usuarioInfo}>
                    <div style={estilos.usuarioNombre}>{s.username}</div>
                  </div>
                  <button
                    style={estilos.botonSolicitudAceptar}
                    onClick={() => responderSolicitud(s.username, true)}
                    disabled={procesandoSolicitud === s.username}
                  >
                    ✔
                  </button>
                  <button
                    style={estilos.botonSolicitudRechazar}
                    onClick={() => responderSolicitud(s.username, false)}
                    disabled={procesandoSolicitud === s.username}
                  >
                    ✖
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Ducentésimo cuadragésimo sexto pase: "campo estilo madera
              ahuecada/cuero oscuro con ícono de lupa dorada" — la lupa se
              dibuja en SVG (stroke dorado) en vez de pedir un asset nuevo,
              no hacía falta imagen para esto. */}
          <div style={estilos.buscadorContenedor}>
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={C.dorado} strokeWidth="3" strokeLinecap="round"
              style={estilos.iconoLupa} aria-hidden="true"
            >
              <circle cx="10" cy="10" r="7" />
              <line x1="20" y1="20" x2="15.5" y2="15.5" />
            </svg>
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar jugador..."
              className="cg-buscador"
              style={estilos.buscador}
            />
          </div>
          <div style={estilos.listaUsuarios}>
            {usuariosFiltrados.map((u) => {
              // Igual que en los mensajes: "esUnoMismo"/"vip" ya no vienen
              // del backend (el primero se calcula, el segundo todavía no
              // es un dato real — ver roadmap de Chat Global).
              const esUnoMismo = u.username === usuarioActual;
              return (
              <div
                key={u.username}
                style={estilos.filaUsuario}
                onClick={() => abrirPerfilDe(u.username)}
              >
                {/* Ducentésimo quincuagésimo pase: tarjeta de "vos" — para
                    diferenciarla a simple vista, se tiñe el pergamino
                    interior de un tono manteca/dorado suave. La tarjeta en
                    sí es un `border-image` con `fill` (el PNG pinta TODO el
                    fondo, no solo el borde), así que no hay un `background`
                    plano al que cambiarle el color — se logra con un overlay
                    semitransparente encima (mismo criterio que ya usa esta
                    pantalla en otros lados: CSS puro, sin asset nuevo). */}
                {esUnoMismo && <div style={estilos.overlayTarjetaPropia} />}
                {/* Ducentésimo cuadragésimo sexto pase: "punto verde neón
                    tipo gema brillante para indicar En línea" — se dibuja
                    en CSS (radial-gradient + glow), no hacía falta asset
                    para esto. Todos en esta lista están en línea por
                    definición, pero el brief lo pide igual como marca
                    visual consistente por tarjeta. */}
                {/* Ducentésimo quincuagésimo tercer pase: (1) cara sola en
                    vez de cuerpo completo — a este tamaño (32x32) el
                    cuerpo entero no se distinguía; (2) primer borde de
                    avatar según rango (ver `bordeSrcDe` arriba) — todavía
                    no hay assets de borde, así que por ahora el `onError`
                    hace que no se vea nada hasta que existan (se van
                    sumando de a uno, sin tocar este código de nuevo). */}
                <div style={estilos.avatarChicoContenedor}>
                  <img src={caraSrcDe(u)} alt="" style={estilos.avatarChico} />
                  {/* El borde va ANTES que el puntito verde en el DOM (a
                      pesar de dibujarse "por fuera") para que el puntito
                      siempre quede por encima del marco de rango — nunca
                      tapado por él — cuando el asset real exista. */}
                  <img
                    src={bordeSrcDe(u.rango)}
                    alt=""
                    style={estilos.bordeRangoChico}
                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                  />
                  <span style={estilos.puntoOnlineChico} />
                </div>
                <div style={estilos.usuarioInfo}>
                  <div style={estilos.usuarioNombre}>
                    {u.username}{esUnoMismo && ' (vos)'}
                  </div>
                  <div style={estilos.usuarioRango}>{u.rango}</div>
                </div>
                {!esUnoMismo && (
                  <button
                    style={estilos.botonAccionUsuario}
                    onClick={(e) => {
                      e.stopPropagation();
                      abrirMenuAccion(u.username);
                    }}
                    title="Opciones"
                  >
                    ⋮
                  </button>
                )}
                {accionAbierta === u.username && (
                  <div style={estilos.tooltipAccionUsuario} onClick={(e) => e.stopPropagation()}>
                    {accionInfo?.cargando ? (
                      <div style={estilos.accionCargando}>Cargando...</div>
                    ) : accionInfo?.error ? (
                      <div style={estilos.accionCargando}>No se pudo cargar</div>
                    ) : (
                      <>
                        {/* Pase siguiente: faltaba la opción de desafiar
                            directamente desde este menú — antes solo se
                            podía desde el popup de perfil completo. Con
                            cualquier usuario, igual que "Desafiar" ahí. */}
                        <button
                          style={estilos.botonAccionMenu}
                          onClick={() => {
                            getSocket().emit('desafio:enviar', { paraUsername: u.username });
                            setAccionAbierta(null);
                          }}
                        >
                          ⚔️ Desafiar
                        </button>
                        {accionInfo.amistad === 'ninguna' && (
                          <button style={estilos.botonAccionMenu} onClick={() => ejecutarAccionAmistad('solicitar')} disabled={accionInfo.procesando}>
                            ➕ Agregar amigo
                          </button>
                        )}
                        {accionInfo.amistad === 'pendiente_enviada' && (
                          <button style={estilos.botonAccionMenu} onClick={() => ejecutarAccionAmistad('quitar')} disabled={accionInfo.procesando}>
                            ✖ Cancelar solicitud
                          </button>
                        )}
                        {accionInfo.amistad === 'pendiente_recibida' && (
                          <>
                            <button style={estilos.botonAccionMenu} onClick={() => ejecutarAccionAmistad('aceptar')} disabled={accionInfo.procesando}>
                              ✔ Aceptar solicitud
                            </button>
                            <button style={estilos.botonAccionMenu} onClick={() => ejecutarAccionAmistad('quitar')} disabled={accionInfo.procesando}>
                              ✖ Rechazar
                            </button>
                          </>
                        )}
                        {accionInfo.amistad === 'amigos' && (
                          <>
                            <button style={estilos.botonAccionMenu} onClick={() => ejecutarAccionAmistad('quitar')} disabled={accionInfo.procesando}>
                              🗑 Eliminar amigo
                            </button>
                            <button
                              style={{ ...estilos.botonAccionMenu, ...estilos.botonAccionMenuConIcono }}
                              onClick={() => { setMensajePrivadoAbierto(u.username); setAccionAbierta(null); }}
                            >
                              <img src="/assets/images/icono-chat.png" alt="" style={estilos.iconoBotonAccionMenu} /> Mensaje privado
                            </button>
                          </>
                        )}
                        <button
                          style={{ ...estilos.botonAccionMenu, ...estilos.botonAccionMenuPeligro }}
                          onClick={toggleBloqueoDesdeMenu}
                          disabled={accionInfo.procesando}
                        >
                          {accionInfo.bloqueado ? '✓ Desbloquear' : '🚫 Bloquear'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              );
            })}
            {usuariosFiltrados.length === 0 && (
              <div style={estilos.sinResultados}>Nadie coincide con "{busqueda}"</div>
            )}
          </div>
        </div>
      </div>

      {perfilAbierto && token && (
        <PerfilRivalModal username={perfilAbierto} token={token} onClose={() => setPerfilAbierto(null)} />
      )}
      {mensajePrivadoAbierto && token && (
        <MensajePrivadoModal
          username={mensajePrivadoAbierto}
          token={token}
          onCerrar={cerrarConversacionPrivada}
        />
      )}
    </div>
  );
}

// Mismo criterio visual que el resto de la app: verde oscuro de fondo,
// tarjetas/burbujas crema con bordes redondeados, acentos dorados. La
// paleta y las proporciones de "burbuja" están pensadas para que el
// mensaje se lea cómodo tanto en la columna angosta de mobile como en la
// ancha de desktop (texto 15px, buen padding, buen aire entre mensajes).
const estilos = {
  // Centésimo cuadragésimo quinto pase: `height` en vez de `height:'100%'`
  // a propósito — `.ts-content`/`.ts-content-inner` (AppShell) no fijan
  // una altura real (dejan que la página crezca y haga scroll normal), así
  // que un `100%` acá resolvería contra un ancestro sin alto definido y
  // colapsaría la columna de mensajes. `min()` deja que en mobile el chat
  // ocupe casi toda la pantalla (pedido explícito del brief) sin pasarse
  // de una altura cómoda en desktop.
  // Ducentésimo cuadragésimo sexto pase: primer paso del rediseño "pulpería"
  // de Chat Global — el usuario pasó un marco de madera+bronce con paño
  // verde (ver marco-chat.png) para envolver todo el módulo en una sola
  // placa en vez de dos cajas sueltas. Se aplicó como `border-image`
  // durante varios pases (246-254), pero el marco tenía una costura de
  // subpíxel entre la madera ilustrada y el fondo verde propio de la
  // pantalla que NUNCA se resolvió del todo pese a 5 intentos distintos
  // (radio, box-shadow, igualar colores, agrandar el marco, agrandar
  // también el recorte de la imagen) — cada intento tapaba una costura y
  // dejaba asomar otra (interior, luego exterior).
  // Ducentésimo quincuagésimo séptimo pase: el usuario pidió cambiar de
  // estrategia por completo — en vez de seguir peleando con las costuras
  // de un `border-image`, reemplazar el marco entero por la MISMA técnica
  // ya probada (y sin ningún problema de costuras) que se usó para el
  // panel de Historial.js: un panel de madera armado 100% en CSS (degradé
  // + bisel simulado con `boxShadow` en capas + remaches de bronce como
  // `<span>`s con `radial-gradient`), sin ningún PNG de por medio. Al no
  // haber una imagen con colores horneados adentro, no hay forma de que
  // aparezca una costura de un verde "equivocado" — el único verde que
  // existe es el propio degradé CSS de `cuerpo`, no hay una segunda fuente
  // de verde con la que pueda desentonar.
  pagina: {
    display: 'flex', flexDirection: 'column', height: 'min(760px, calc(100vh - 190px))', minHeight: 460,
    position: 'relative', overflow: 'hidden',
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    borderRadius: 14,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -4px 10px rgba(0,0,0,0.5)',
      `0 8px 0 ${C.negroPulido}`,
      '0 16px 26px rgba(0,0,0,0.4)',
    ].join(', '),
  },
  // El grosor del borde y el padding SÍ tienen que variar por breakpoint
  // (mobile vs. escritorio) — por eso viven en `chat-global.css` (clase
  // `.cg-pagina`) y no acá adentro: un estilo puesto inline por JS siempre
  // le gana a cualquier regla de una hoja de estilos externa, media query
  // o no, así que si se pusiera un `border`/`padding` inline acá arriba,
  // la media query de mobile de `chat-global.css` NUNCA podría pisarlo.
  remache: {
    position: 'absolute', width: 13, height: 13, borderRadius: '50%',
    zIndex: 2,
    // Pase 360: remache unificado en todo el juego — bola de bronce lisa con borde marrón fino y un brillo claro arriba a la izquierda.
    background: 'radial-gradient(circle at 32% 28%, rgba(255,243,210,0.92) 0, rgba(255,243,210,0.92) 1.5px, transparent 2.1px), #C9973E',
    border: '1.5px solid #5A3A14', boxSizing: 'border-box',
  },
  // Ducentésimo cuadragésimo sexto pase: "mini placa de madera" para el
  // encabezado — antes era una franja plana semitransparente sin
  // identidad propia, ahora un degradé de madera con filete dorado abajo,
  // mismo criterio de "panel premium" que ya usan las tarjetas de
  // Configuracion.js. El ícono de bocadillo estilizado en 3D que pide el
  // brief todavía no llegó como asset — sigue con icono-chat.png por
  // ahora.
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 12, padding: '14px 18px', flexWrap: 'wrap',
    background: 'linear-gradient(180deg, #6b4534 0%, #4a2c2a 100%)',
    borderBottom: `3px solid ${C.doradoOscuro}`,
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.14)',
  },
  headerIzquierda: { display: 'flex', alignItems: 'center', gap: 12 },
  headerIcono: { width: 32, height: 32, objectFit: 'contain' },
  titulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 19, color: C.crema },
  online: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#cfe9d6', fontWeight: 700, marginTop: 2 },
  puntoOnline: { width: 8, height: 8, borderRadius: '50%', background: '#4CE07A', boxShadow: '0 0 6px #4CE07A' },
  headerTabs: { display: 'flex', gap: 6, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 4 },
  headerTab: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13, color: '#cfe9d6',
    background: 'transparent', border: 'none', borderRadius: 9, padding: '7px 14px', cursor: 'pointer',
  },
  headerTabActivo: { background: C.dorado, color: C.chocolate, boxShadow: '0 2px 0 rgba(0,0,0,0.2)' },
  botonUsuariosMobile: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 13, color: C.chocolate,
    background: C.doradoClaro, border: `2px solid ${C.chocolate}`, borderRadius: 10,
    padding: '7px 12px', cursor: 'pointer',
  },
  // Pase 196: cartel de "solicitud de amistad pendiente" — la clase CSS
  // .cg-banner-solicitudes (ver chat-global.css) es la que decide si se
  // ve o no según el ancho de pantalla; estos son solo los estilos
  // visuales (igual que .cg-boton-usuarios + estilos.botonUsuariosMobile
  // más arriba, mismo patrón).
  // Pase 197: color de letra corregido — mismo motivo que el nativo (ver
  // ese archivo): este cartel vive sobre el header oscuro con un tinte
  // dorado translúcido encima, no sobre un panel claro — chocolate casi
  // no se leía ahí.
  bannerSolicitudes: {
    display: 'block', width: '100%', border: 'none', cursor: 'pointer',
    fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12.5, color: C.crema,
    background: `${C.dorado}55`, borderBottom: `1.5px solid ${C.doradoOscuro}`,
    padding: '9px 18px', textAlign: 'center',
  },

  // Pase 196: tarjetas de amigos de la pestaña "Privado" — mismo criterio
  // de "tarjeta" que pidió el usuario (avatar + nombre + punto rojo si hay
  // algo sin leer), en una grilla que se acomoda sola al ancho disponible.
  listaAmigosContenido: {
    flex: 1, overflowY: 'auto', display: 'flex', flexWrap: 'wrap',
    alignContent: 'flex-start', gap: 16, padding: '20px 18px',
  },
  avisoSinAmigos: {
    width: '100%', fontSize: 13, color: '#cfe9d6', textAlign: 'center',
    fontStyle: 'italic', padding: '20px 10px',
  },
  // Pase 197: `tarjetaAmigo` pasa a ser el contenedor (div, no botón —
  // ahora tiene DOS acciones adentro: abrir el chat y desafiar, no puede
  // ser un solo elemento clickeable). El botón de abrir chat es
  // `tarjetaAmigoBoton`, con los mismos estilos que antes tenía la
  // tarjeta entera.
  tarjetaAmigo: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 96 },
  tarjetaAmigoBoton: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
    width: '100%', border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
  },
  avatarAmigoContenedor: { position: 'relative' },
  avatarAmigo: {
    width: 62, height: 62, borderRadius: '50%', objectFit: 'cover',
    border: `2px solid ${C.doradoClaro}`, background: C.cremaSutil,
  },
  puntoSinLeer: {
    position: 'absolute', top: -2, right: -2, width: 15, height: 15, borderRadius: '50%',
    background: C.crimson, border: `2px solid ${C.verdeProfundo}`, display: 'block',
  },
  tarjetaAmigoNombre: {
    fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12, color: C.crema,
    textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
  },
  // Pase 197: botón de desafío rápido, debajo del nombre.
  botonDesafiarAmigo: {
    marginTop: 2, fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 10.5, color: C.doradoClaro,
    background: `${C.doradoOscuro}33`, border: `1px solid ${C.doradoOscuro}`, borderRadius: 8,
    padding: '4px 8px', cursor: 'pointer',
  },

  // Ducentésimo cuadragésimo noveno pase: el degradé verde vive acá ahora
  // (antes vivía en `.pagina`, ver el comentario grande de `pagina` más
  // arriba) — este contenedor ya está adentro del marco de madera, así
  // que el verde queda "puertas adentro" del borde en vez de por detrás.
  // Ducentésimo quincuagésimo séptimo pase: `boxShadow` interior nuevo —
  // ahora que `.pagina` es un panel de madera sin `border-image` (ver más
  // arriba), este paño verde necesita su propio bisel "hundido" para leer
  // como fieltro encajado adentro del marco, mismo criterio que
  // `estilos.interiorFieltro` de Historial.js.
  cuerpo: {
    display: 'flex', flex: 1, minHeight: 0, position: 'relative',
    background: `linear-gradient(180deg, ${C.verdeProfundo}, ${C.verdeOscuro})`,
    boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.45)',
  },
  columnaChat: { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, minHeight: 0 },

  // Ducentésimo quincuagésimo pase: el `gap: 14` de acá se saca — el
  // espaciado entre mensajes ahora lo pone cada fila con su propio
  // `marginTop` (ver el `.map()` de mensajes), que varía según si el
  // mensaje está agrupado con el anterior del mismo usuario.
  mensajesLista: {
    flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex',
    flexDirection: 'column', minHeight: 0,
  },
  mensajeSistema: {
    alignSelf: 'center', fontSize: 12.5, fontStyle: 'italic', color: C.doradoClaro,
    background: 'rgba(0,0,0,0.22)', borderRadius: 10, padding: '6px 14px', textAlign: 'center',
    maxWidth: '90%',
  },
  filaMensaje: { display: 'flex', alignItems: 'flex-start', gap: 10, maxWidth: '78%' },
  filaMensajePropio: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  // Ducentésimo cuadragésimo sexto pase: "encástralos en marcos circulares
  // con borde de madera/bronce" — borde dorado oscuro más grueso (era
  // chocolate 2px) + un anillo chocolate por afuera vía box-shadow, para
  // que se lea como un marco de dos capas (bronce adentro, madera afuera)
  // en vez de un borde plano de un solo color.
  avatar: {
    width: 38, height: 38, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
    border: `3px solid ${C.doradoOscuro}`, boxShadow: `0 0 0 2px ${C.chocolate}, 0 2px 4px rgba(0,0,0,0.35)`,
    cursor: 'pointer', marginTop: 2,
  },
  // Ducentésimo cuadragésimo sexto pase: "paneles de pergamino... sombra
  // dura y contorno negro grueso" (rival) / "tono dorado cálido con bisel
  // 3D" (propio) — antes las dos burbujas solo diferían en el fondo, sin
  // contorno ni sombra "dura" (era un blur suave). El contorno casi-negro
  // (no chocolate puro) imita la línea de tinta gruesa que ya tienen los
  // íconos ilustrados nuevos del resto del juego.
  burbuja: {
    background: C.cremaSutil, borderRadius: 16, padding: '10px 14px',
    border: '2.5px solid #2a1a14', boxShadow: '3px 3px 0 rgba(0,0,0,0.25)', minWidth: 0,
  },
  burbujaPropia: {
    background: `linear-gradient(160deg, ${C.doradoClaro}, ${C.dorado})`,
    border: `2.5px solid ${C.doradoOscuro}`,
    boxShadow: '3px 3px 0 rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.55)',
  },
  filaNombre: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 },
  nombreUsuario: { fontSize: 12.5, fontWeight: 800, color: C.doradoOscuro, cursor: 'pointer' },
  nombreVip: { color: '#B8860B', textShadow: '-1px -1px 0 #5A3E00, 1px -1px 0 #5A3E00, -1px 1px 0 #5A3E00, 1px 1px 0 #5A3E00, 0px -1px 0 #5A3E00, 0px 1px 0 #5A3E00, -1px 0px 0 #5A3E00, 1px 0px 0 #5A3E00' },
  badgeVip: {
    fontSize: 9.5, fontWeight: 800, color: '#fff', background: C.crimson,
    borderRadius: 5, padding: '1.5px 5px', letterSpacing: 0.3,
  },
  hora: { fontSize: 10.5, color: '#a09085', marginLeft: 2 },
  textoMensaje: { fontSize: 15, color: C.chocolate, lineHeight: 1.4, wordBreak: 'break-word' },
  // Ducentésimo quincuagésimo primer pase: casi invisible antes
  // (`C.doradoOscuro` sobre el degradé dorado claro de `burbujaPropia` —
  // dos tonos cálidos muy cercanos entre sí, sin contraste real). Pasa a
  // chocolate (mismo color que ya usa `textoMensaje`, con buen contraste
  // comprobado sobre este mismo fondo dorado).
  horaPropia: { fontSize: 10, color: C.chocolate, textAlign: 'right', marginTop: 3, opacity: 0.65 },

  escribiendo: {
    display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontStyle: 'italic',
    color: '#cfe9d6', opacity: 0.85, paddingLeft: 4,
  },
  puntosEscribiendo: { display: 'inline-flex', gap: 3 },

  // Ducentésimo cuadragésimo noveno pase: el usuario pidió cambiar el
  // fondo verdoso de esta franja (el que envolvía los botones auxiliares +
  // el campo de texto + el botón de enviar) por un crema, igual al tono
  // que ya usan esos mismos controles (`C.cremaSutil`) — mismo criterio de
  // "una sola franja clara" que muestra la imagen de referencia que pasó.
  inputContenedor: { position: 'relative', borderTop: `2px solid ${C.chocolate}44`, background: C.cremaSutil },
  form: { display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px' },
  botonAuxiliar: {
    // Pase siguiente: padding a 0 (antes no tenía, pero con el ícono nuevo
    // se deja explícito) — mismo criterio de "pegado al borde" que se usó
    // en botonStickerToggle de ChatMesa.js, ancho/alto fijos (40x40) igual
    // que ahí para que los dos boones luzcan iguales entre pantallas.
    fontSize: 18, background: C.cremaSutil, border: `2px solid ${C.chocolate}`,
    borderRadius: 10, width: 40, height: 40, padding: 0, flexShrink: 0, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  iconoCaraBotonAuxiliar: { width: 36, height: 36, borderRadius: 8, objectFit: 'cover' },
  iconoChatBotonAuxiliar: { width: 30, height: 30, objectFit: 'contain' },
  // Ducentésimo cuadragésimo sexto pase: "panel de pergamino biselado hacia
  // adentro" — se suma un inset shadow (antes no tenía ninguna sombra).
  input: {
    flex: 1, background: C.cremaSutil, border: `2px solid ${C.chocolate}`, borderRadius: 12,
    padding: '11px 14px', fontSize: 15, color: C.chocolate, outline: 'none', minWidth: 0,
    boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.18)',
  },
  // Pase siguiente: fondo chocolate + anillo dorado (era dorado plano con
  // texto "Enviar") — mismo criterio de contraste "ícono claro sobre fondo
  // oscuro" que ya usa el botón de enviar de ChatMesa.js/juego.tsx.
  //
  // Ducentésimo cuadragésimo séptimo pase: llegó el asset ilustrado del
  // botón (pill verde brillante) + el avioncito de papel por separado —
  // se arma igual que el switch/slider de Configuración: el botón como
  // imagen de fondo a tamaño fijo (no es un elemento que necesite estirarse
  // a un ancho arbitrario, así que no hace falta 9-slice acá) y el
  // avioncito como <img> propio encima, centrado. Nombres de archivo
  // propios (no `icono-enviar.png`) para no tocar el botón de enviar de
  // ChatMesa.js/juego.tsx, que sigue con su convención chocolate+dorado.
  //
  // Ducentésimo cuadragésimo noveno pase: nuevo asset combinado (pill +
  // avioncito dorado en un solo dibujo, proporción real ~1.41:1) — ya no
  // hace falta el <img> del avioncito por separado (ver el JSX). Tamaño
  // ajustado a esa proporción para no deformar el dibujo (antes era
  // 106x44, ratio ~2.4:1, muy distinto al del asset nuevo).
  botonEnviar: {
    width: 62, height: 44,
    backgroundImage: 'url(/assets/images/boton-enviar-chat.png)',
    backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundColor: 'transparent',
    border: 'none', borderRadius: 0, cursor: 'pointer', flexShrink: 0,
  },
  panelEmojis: {
    position: 'absolute', bottom: '100%', left: 16, marginBottom: 6,
    display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 260,
    background: C.cremaSutil, border: `2px solid ${C.chocolate}`, borderRadius: 12, padding: 10,
    boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
  },
  emojiBoton: { fontSize: 20, background: 'transparent', border: 'none', cursor: 'pointer', padding: 3 },
  panelFrases: {
    position: 'absolute', bottom: '100%', left: 16, marginBottom: 6,
    display: 'flex', flexDirection: 'column', gap: 6, width: 260,
    background: C.cremaSutil, border: `2px solid ${C.chocolate}`, borderRadius: 12, padding: 8,
    boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
  },
  fraseBoton: {
    textAlign: 'left', fontSize: 13, color: C.chocolate, background: 'rgba(74,44,42,0.06)',
    border: 'none', borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
  },

  // Ducentésimo cuadragésimo sexto pase: "reemplaza el contenedor blanco
  // puro por un tablero de cuero curtido... más oscuro que la zona de chat"
  // — de cremaSutil (casi blanco) a un degradé de cuero oscuro, con un
  // filete dorado en vez del borde chocolate translúcido que casi no se
  // notaba contra el blanco anterior.
  sidebar: {
    display: 'flex', flexDirection: 'column',
    background: 'linear-gradient(180deg, #3b2a20, #2a1c15)',
    borderLeft: `3px solid ${C.doradoOscuro}`,
  },
  sidebarHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 16px 8px',
  },
  // Ducentésimo cuadragésimo sexto pase: texto claro (era chocolate) — el
  // fondo de la columna pasó de casi-blanco a cuero oscuro.
  sidebarTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14.5, color: C.crema },
  botonCerrarSidebar: {
    background: C.crema, border: `2px solid ${C.chocolate}`, borderRadius: 8,
    width: 26, height: 26, cursor: 'pointer', fontSize: 12, color: C.chocolate,
  },
  // Ducentésimo cuadragésimo sexto pase: "campo estilo madera ahuecada/
  // cuero oscuro con ícono de lupa dorada" — de un input blanco plano a un
  // hueco oscuro con sombra hacia adentro; el padding-left le hace lugar a
  // la lupa dibujada en SVG (ver JSX), posicionada con `buscadorContenedor`.
  buscadorContenedor: { position: 'relative', margin: '0 16px 10px' },
  iconoLupa: { position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' },
  buscador: {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(0,0,0,0.35)', border: `1.5px solid ${C.doradoOscuro}66`,
    borderRadius: 10, padding: '8px 10px 8px 30px', fontSize: 13, color: C.crema, outline: 'none',
    boxShadow: 'inset 0 2px 5px rgba(0,0,0,0.4)',
  },
  panelSolicitudes: { margin: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: 4 },
  botonSolicitudesToggle: {
    fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12, textAlign: 'left',
    background: `${C.dorado}33`, color: C.chocolate, border: `1.5px solid ${C.doradoOscuro}`,
    borderRadius: 10, padding: '8px 10px', cursor: 'pointer',
  },
  filaSolicitud: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 2px' },
  botonSolicitudAceptar: {
    flexShrink: 0, width: 24, height: 24, borderRadius: 7, border: 'none',
    background: C.verde, color: '#fff', fontSize: 12, fontWeight: 800, cursor: 'pointer',
  },
  botonSolicitudRechazar: {
    flexShrink: 0, width: 24, height: 24, borderRadius: 7, border: 'none',
    background: `${C.crimson}22`, color: C.crimsonOscuro, fontSize: 12, fontWeight: 800, cursor: 'pointer',
  },
  listaUsuarios: { flex: 1, overflowY: 'auto', padding: '0 10px 12px', display: 'flex', flexDirection: 'column', gap: 6 },
  // Ducentésimo cuadragésimo séptimo pase: llegó el asset real de la
  // "mini tarjeta de madera/pergamino" (tarjeta-jugador.png) — reemplaza
  // el parche de CSS del pase anterior (fondo cremaSutil + borde). Se
  // mide igual en los 4 lados (~22 de sus 250x132px), así que se aplica
  // con `border-image` + `fill` (a diferencia del marco grande, acá SÍ
  // hace falta que se dibuje el centro — es toda la tarjeta, no un marco
  // alrededor de otro fondo) — mismo motivo que el slider de música: la
  // columna tiene un ancho que varía un poco (260px en desktop, hasta
  // 320px en el drawer mobile), y separando bordes de centro esa
  // variación no deforma el grabado de madera de los bordes.
  // Ducentésimo cuadragésimo octavo pase: había un aro de brillo dorado
  // (`boxShadow`) para destacar la fila de "vos" en la lista — el usuario
  // pidió sacarlo ("el detalle que agregaste de la línea dorada que rodea
  // la tarjeta del usuario saquemosla"). Se elimina `filaUsuarioPropia` por
  // completo: la fila propia queda visualmente igual al resto de las filas
  // de jugadores.
  // Ducentésimo quincuagésimo primer pase: BUG REAL encontrado — el menú
  // de opciones (⋮) dejó de abrirse (el click SÍ disparaba `abrirMenuAccion`,
  // pero el popup quedaba invisible). Causa: `estilos.tooltipAccionUsuario`
  // se posiciona `absolute, top:'100%'` respecto de esta fila (su ancestro
  // posicionado más cercano) — es decir, se dibuja JUSTO DEBAJO del borde
  // inferior de la fila, totalmente por FUERA de su propia caja. El pase
  // anterior le agregó `overflow:'hidden'` a esta fila (para contener el
  // overlay de tinte de "vos") sin necesitarlo de verdad — ese overlay ya
  // queda perfectamente contenido solo con su propio `inset:12`, no hace
  // falta recortar nada acá — y ese `overflow:hidden` de más terminaba
  // recortando el popup entero. Se saca.
  filaUsuario: {
    display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px',
    cursor: 'pointer', position: 'relative',
    borderStyle: 'solid', borderColor: 'transparent', borderWidth: 12,
    borderImageSource: 'url(/assets/images/tarjeta-jugador.png)',
    borderImageSlice: '22 fill',
    borderImageRepeat: 'stretch',
  },
  // Ducentésimo quincuagésimo pase: overlay de tinte para la tarjeta de
  // "vos" (ver el comentario grande en el JSX). `inset` coincide con el
  // borderWidth de `filaUsuario` (12) para teñir solo el pergamino
  // interior, no el marco de madera. `pointerEvents:none` para no tapar
  // el click de la fila.
  overlayTarjetaPropia: {
    position: 'absolute', inset: 12,
    background: 'linear-gradient(160deg, rgba(255,214,104,0.38), rgba(255,182,39,0.22))',
    pointerEvents: 'none', zIndex: 0,
  },
  // Ducentésimo quincuagésimo pase: "marco circular de madera/bronce con
  // contorno negro limpio" — antes era un borde finito de 1.5px casi
  // invisible. Mismo criterio de anillo de dos capas que ya usa el avatar
  // grande de los mensajes (`estilos.avatar`, más arriba): borde dorado
  // oscuro (bronce) + un aro chocolate por afuera vía box-shadow.
  avatarChicoContenedor: { position: 'relative', flexShrink: 0, zIndex: 1 },
  avatarChico: {
    width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', display: 'block',
    border: `2px solid ${C.doradoOscuro}`, boxShadow: `0 0 0 1.5px ${C.chocolate}, 0 1px 3px rgba(0,0,0,0.35)`,
  },
  // Ducentésimo quincuagésimo tercer pase: marco de rango — se dibuja
  // ENCIMA del aro dorado/chocolate de `avatarChico` (mismo criterio de
  // "anillo de dos capas" que ya usa el resto de la pantalla), un poco
  // más grande que el avatar para que lo enmarque en vez de taparlo.
  // `pointerEvents:'none'` para no robarle el click al avatar/fila.
  bordeRangoChico: {
    position: 'absolute', top: -6, left: -6, width: 44, height: 44,
    pointerEvents: 'none', objectFit: 'contain',
  },
  // Ducentésimo cuadragésimo sexto pase: "punto verde neón tipo gema
  // brillante" — mismo criterio que `puntoSinLeer` (tarjetas de amigos),
  // posicionado sobre la esquina del avatar chico.
  // Ducentésimo quincuagésimo pase: el usuario reportó que se veía como un
  // "resplandor blanquecino difuminado" en vez de una gema — el aro color
  // crema + el glow difuso (`0 0 5px`) eran la causa. Se cambia a un aro
  // OSCURO fino (imita un engaste/contorno negro) y una sombra dura y
  // chica (no blur) en vez del glow, para que lea como una gema 3D
  // engastada, no como un halo de luz.
  puntoOnlineChico: {
    position: 'absolute', bottom: -1, right: -1, width: 10, height: 10, borderRadius: '50%',
    background: 'radial-gradient(circle at 32% 28%, #eafff0 0%, #4CE07A 32%, #1f9a55 65%, #0c4a28 100%)',
    border: '1.5px solid rgba(0,0,0,0.55)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.55), inset 0 -1px 1px rgba(0,0,0,0.35)',
  },
  usuarioInfo: { flex: 1, minWidth: 0, position: 'relative', zIndex: 1 },
  usuarioNombre: { fontSize: 13, fontWeight: 800, color: C.chocolate, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  // Ducentésimo quincuagésimo pase: contraste muy bajo antes (#8a7267,
  // beige/naranja claro sobre el pergamino claro de la tarjeta) — pasa a
  // un marrón madera medio bien legible, con una mini-cinta de fondo
  // (mismo criterio de "badge" que ya usa `badgeVip` en los mensajes) en
  // vez de texto suelto.
  usuarioRango: {
    fontSize: 10, fontWeight: 700, color: '#5c3a26',
    background: 'rgba(74,44,42,0.12)', borderRadius: 5,
    padding: '1px 6px', display: 'inline-block', marginTop: 2,
  },
  // Ducentésimo quincuagésimo pase: "botón cuadrado/circular de madera
  // oscura/bronce con relieve 3D" — antes era una píldora beige casi
  // transparente (se notaba lavada contra el pergamino). Se cambia a un
  // botón de madera oscura con bisel (mismo criterio "3D" que ya usan los
  // botones circulares del header, `.ts-icon-btn`: fondo sólido + un
  // box-shadow duro hacia abajo que simula el relieve) y los puntos pasan
  // a dorado claro para leerse sobre el fondo oscuro nuevo.
  botonAccionUsuario: {
    flexShrink: 0, width: 26, height: 26, borderRadius: 7, border: `1.5px solid ${C.doradoOscuro}`,
    background: `linear-gradient(180deg, #5a3a30, ${C.chocolate})`,
    boxShadow: '0 2px 0 rgba(0,0,0,0.4)',
    color: C.doradoClaro, fontSize: 15,
    fontWeight: 800, cursor: 'pointer', lineHeight: 1, position: 'relative', zIndex: 1,
  },
  // Pase siguiente: era un tooltip de texto fijo ("Muy pronto..."), ahora
  // es un menú real de botones — se cambia a columna con gap y se le saca
  // el `cursor:'default'` (los botones de adentro ya tienen su propio
  // cursor de pointer).
  tooltipAccionUsuario: {
    position: 'absolute', top: '100%', right: 6, marginTop: 4, zIndex: 5,
    width: 190, background: C.chocolate, display: 'flex', flexDirection: 'column', gap: 5,
    padding: 7, borderRadius: 10,
    boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
  },
  accionCargando: {
    color: C.crema, fontSize: 11.5, fontStyle: 'italic', padding: '4px 6px', opacity: 0.8,
  },
  botonAccionMenu: {
    fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12, textAlign: 'left',
    background: 'rgba(255,255,255,0.08)', color: C.crema, border: 'none',
    borderRadius: 7, padding: '7px 8px', cursor: 'pointer',
  },
  botonAccionMenuPeligro: { background: 'rgba(232,72,58,0.25)', color: '#ffd9d5' },
  botonAccionMenuConIcono: { display: 'flex', alignItems: 'center', gap: 5 },
  iconoBotonAccionMenu: { width: 13, height: 13, objectFit: 'contain' },
  sinResultados: { fontSize: 12.5, color: '#a09085', fontStyle: 'italic', textAlign: 'center', padding: '14px 8px' },
};

// ---------------------------------------------------------------------
// Pase del backend real de Chat Global — ya CUBIERTO por este pase:
// - Sala de socket dedicada ('chat-global', separada de las salas de
//   partida por código) para mensajes en vivo, ver truco-backend/
//   src/index.js (eventos 'chat-global:entrar'/'chat-global:mensaje').
// - Tracking real de "usuarios en línea" (join/leave de esa sala).
// - Persistencia de mensajes en Postgres (tabla chat_global_mensajes,
//   ver migrar-chat-global.js) — el historial sobrevive a un refresh.
//
// PENDIENTE (backend/infra, todavía no cubierto):
// - "Usuario escribiendo..." — se sacó el de muestra (era siempre
//   "ElTaita", fijo) porque ya no hay datos simulados; un indicador real
//   necesitaría un evento de socket nuevo con debounce, no está armado.
// - VIP: no existe como dato real en la base todavía (el badge/estilo se
//   deja preparado en los estilos, pero no se le pasa a nadie).
// - El "en línea" de acá es "conectado al socket compartido de la app en
//   general", no estrictamente "con esta pantalla de Chat Global abierta
//   en este momento" — no se implementó un evento de salida explícito al
//   desmontar (el socket es compartido con el juego, ver services/
//   socket.js, así que no conviene desconectarlo solo porque se cierra
//   este chat). Si se quiere más precisión, es un evento nuevo
//   ('chat-global:salir') + un emit en el cleanup de este mismo useEffect.
// - Chat Privado (tab ya armado en el header, deshabilitado a propósito).
// - Filtros "Amigos"/"Solo VIP" y "Limpiar chat" quedaron afuera de este
//   pase — son los "elementos opcionales" del brief original, se agregan
//   fácil sobre esta misma estructura si el usuario los pide después.
// ---------------------------------------------------------------------