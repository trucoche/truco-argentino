import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../../services/socket';
import PerfilRivalModal from '../PerfilRival/PerfilRivalModal';
import { API_URL as BASE_URL } from '../../config';

const API_BASE = `${BASE_URL}/api`;

// Nonagésimo octavo pase: token/usuarioActual nuevos — hacen falta para
// abrir el popup de perfil al tocar el nombre de quien escribió un
// mensaje (no el propio, para no abrir el popup sobre uno mismo).
export default function ChatMesa({ codigoSala, esEquipos, personaje = 'gaucho', token, usuarioActual }) {
  const [mensajes, setMensajes] = useState([]);
  // Centésimo quinto pase: usuarios bloqueados, para ocultar sus mensajes
  // (y stickers) del chat de la mesa sin tocar nada del socket — el
  // servidor sigue enviando los mensajes igual, el filtro es solo visual,
  // del lado de quien bloqueó.
  const [bloqueados, setBloqueados] = useState(new Set());

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/usuarios/bloqueados`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) setBloqueados(new Set((data.bloqueados || []).map(b => b.username)));
      } catch (err) {
        console.error('Error cargando bloqueados:', err);
      }
    })();
  }, [token]);
  const [texto, setTexto] = useState('');
  const [abierto, setAbierto] = useState(true);
  const [tab, setTab] = useState('todos'); // 'todos' | 'equipo'
  const [hayNuevoTodos, setHayNuevoTodos] = useState(false);
  const [hayNuevoEquipo, setHayNuevoEquipo] = useState(false);
  // Pase siguiente: bug reportado — en la web, si el panel entero está
  // minimizado (abierto === false), un mensaje nuevo no prendía ninguna
  // notificación en el botón "💬 Chat" (el nativo sí muestra un punto rojo
  // en ese caso). La causa: el handler solo marcaba hayNuevoTodos/
  // hayNuevoEquipo cuando el mensaje era de una pestaña distinta a la
  // ACTIVA (tabRef), sin importar si el panel estaba abierto o cerrado —
  // con una sola pestaña (sin equipos) o con el mismo tab activo, nunca se
  // prendía nada mientras estaba colapsado. Se agrega este flag aparte,
  // que se prende con CUALQUIER mensaje nuevo mientras el panel está
  // cerrado, y se apaga al reabrirlo.
  const [hayNuevoMientrasCerrado, setHayNuevoMientrasCerrado] = useState(false);
  const finRef = useRef(null);
  const [stickersAbiertos, setStickersAbiertos] = useState(false);
  const STICKERS = ['derrotado', 'nervioso', 'pensando', 'picaro', 'victorioso'];
  const [perfilAbierto, setPerfilAbierto] = useState(null);

  const abrirPerfilDe = (nombreUsuario) => {
    if (!nombreUsuario || nombreUsuario === usuarioActual) return;
    setPerfilAbierto(nombreUsuario);
  };

  const enviarSticker = (expresion) => {
    const clave = `${personaje}_${expresion}`;
    const evento = tab === 'equipo' ? 'sticker-chat-equipo' : 'sticker-chat';
    getSocket().emit(evento, { codigoSala, sticker: clave });
    setStickersAbiertos(false);
  };

  const tabRef = useRef(tab);
  useEffect(() => { tabRef.current = tab; }, [tab]);

  // Mismo motivo que tabRef: el handler del socket se registra una sola
  // vez (deps []), así que necesita este ref para ver el valor actual de
  // `abierto` sin tener que re-suscribirse cada vez que cambia.
  const abiertoRef = useRef(abierto);
  useEffect(() => { abiertoRef.current = abierto; }, [abierto]);

  // Centésimo quinto pase: ref del set de bloqueados, para que el
  // handler del socket (que se registra una sola vez, ver abajo) siempre
  // vea el valor actualizado sin tener que re-suscribirse.
  const bloqueadosRef = useRef(bloqueados);
  useEffect(() => { bloqueadosRef.current = bloqueados; }, [bloqueados]);

  useEffect(() => {
    const socket = getSocket();

    const handler = (msg) => {
      setMensajes((prev) => [...prev, msg]);

      // Un mensaje de alguien bloqueado no debe marcar "nuevo mensaje" en
      // la pestaña que no está activa, ya que nunca se va a mostrar.
      if (!msg.sistema && bloqueadosRef.current.has(msg.usuario)) return;

      if (!abiertoRef.current) {
        setHayNuevoMientrasCerrado(true);
      }

      const esDeEquipo = !!msg.equipo;
      const tabDelMensaje = esDeEquipo ? 'equipo' : 'todos';

      if (tabRef.current !== tabDelMensaje) {
        if (esDeEquipo) setHayNuevoEquipo(true);
        else setHayNuevoTodos(true);
      }
    };
    socket.on('nuevo-mensaje-chat', handler);

    return () => socket.off('nuevo-mensaje-chat', handler);
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  const enviarMensaje = (e) => {
    e.preventDefault();
    const textoLimpio = texto.trim();
    if (!textoLimpio) return;

    const evento = tab === 'equipo' ? 'mensaje-chat-equipo' : 'mensaje-chat';
    getSocket().emit(evento, { codigoSala, texto: textoLimpio });
    setTexto('');
  };

  const cambiarTab = (nuevoTab) => {
    setTab(nuevoTab);
    if (nuevoTab === 'todos') setHayNuevoTodos(false);
    else setHayNuevoEquipo(false);
  };

  const mensajesVisibles = mensajes
    .filter(m => tab === 'equipo' ? m.equipo : !m.equipo)
    .filter(m => m.sistema || !bloqueados.has(m.usuario));


  if (!abierto) {
    return (
      <>
        <button
          onClick={() => { setAbierto(true); setHayNuevoMientrasCerrado(false); }}
          style={estilos.botonAbrir}
        >
          {/* Pase siguiente: el emoji 💬 (glyph de sistema, se ve distinto
              según plataforma) se reemplaza por el mismo ícono que ya usa
              el lobby para "Chat" en el nav (`icono-chat.png`, ver
              AppShell.js), para que sea el mismo dibujo en los dos lados. */}
          <img src="/assets/images/icono-chat.png" alt="" style={estilos.iconoBotonAbrir} /> Chat
          {hayNuevoMientrasCerrado && <span style={estilos.puntoNuevoColapsado} />}
        </button>
        {perfilAbierto && token && (
          <PerfilRivalModal username={perfilAbierto} token={token} onClose={() => setPerfilAbierto(null)} />
        )}
      </>
    );
  }

  return (
    <>
    <div style={estilos.contenedor}>
      <div style={estilos.header}>
        <span>Chat de la mesa</span>
        <button onClick={() => setAbierto(false)} style={estilos.botonCerrar}>✕</button>
      </div>

      {esEquipos && (
        <div style={estilos.tabs}>
          <button
            onClick={() => cambiarTab('todos')}
            style={{ ...estilos.tab, ...(tab === 'todos' ? estilos.tabActivo : {}) }}
          >
            Todos
            {hayNuevoTodos && tab !== 'todos' && <span style={estilos.puntoNuevo} />}
          </button>
          <button
            onClick={() => cambiarTab('equipo')}
            style={{ ...estilos.tab, ...(tab === 'equipo' ? estilos.tabActivo : {}) }}
          >
            Equipo
            {hayNuevoEquipo && tab !== 'equipo' && <span style={estilos.puntoNuevo} />}
          </button>
        </div>
      )}

      <div style={estilos.mensajes}>
        {mensajesVisibles.length === 0 && (
          <div style={estilos.vacio}>Sin mensajes todavía</div>
        )}
        {mensajesVisibles.map((m, i) => (
          m.sistema ? (
            <div key={i} style={estilos.mensajeSistema}>⚡ {m.texto}</div>
          ) : m.sticker ? (
            <div key={i} style={estilos.mensajeSticker}>
              <span
                style={{ ...estilos.nombre, cursor: m.usuario !== usuarioActual ? 'pointer' : 'default' }}
                onClick={() => abrirPerfilDe(m.usuario)}
              >{m.usuario}</span>
              <img
                src={`/assets/expresionesGaucho/${m.sticker}.png`}
                alt={m.sticker}
                style={{ width: 56, height: 56 }}
              />
            </div>
          ) : (
            <div key={i} style={estilos.mensaje}>
              <span
                style={{ ...estilos.nombre, cursor: m.usuario !== usuarioActual ? 'pointer' : 'default' }}
                onClick={() => abrirPerfilDe(m.usuario)}
              >{m.usuario}:</span> {m.texto}
            </div>
          )
        ))}
        <div ref={finRef} />
      </div>

      {stickersAbiertos && (
      <div style={estilos.panelStickers}>
        {STICKERS.map((exp) => (
          <button key={exp} onClick={() => enviarSticker(exp)} style={estilos.stickerBoton}>
            <img
              src={`/assets/expresionesGaucho/${personaje}_${exp}.png`}
              alt={exp}
              style={{ width: 36, height: 36 }}
            />
          </button>
        ))}
      </div>
    )}

    <form onSubmit={enviarMensaje} style={estilos.form}>
      {/* Pase siguiente: antes este botón mostraba el retrato de cuerpo
          completo del personaje (`${personaje}-avatar.png`), pensado para
          otras pantallas (perfil, etc.) — a este tamaño chico (28x28) se
          veía irreconocible. Se reemplaza por la misma expresión "cara
          feliz" que ya existe para los stickers (mismo set de
          `expresionesGaucho` usado en el panel de abajo), eligiendo
          'victorioso' — la única expresión sonriente del set — en vez de
          agregar un asset nuevo. */}
      <button type="button" onClick={() => setStickersAbiertos(v => !v)} style={estilos.botonStickerToggle}>
        <img src={`/assets/expresionesGaucho/${personaje}_victorioso.png`} alt="Stickers" style={estilos.iconoStickerToggle} />
      </button>
      <input
        type="text"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={tab === 'equipo' ? 'Mensaje para tu equipo...' : 'Escribí un mensaje...'}
        maxLength={200}
        style={estilos.input}
      />
      {/* Pase siguiente: el avión de papel se agranda mucho más (18→30) —
          seguía quedando chico para el botón. Como este botón no lleva
          texto (solo el ícono), el fondo dorado plano hacía que el avión
          (papel claro, contorno oscuro) se notara poco — se cambia a
          fondo chocolate con anillo dorado, mismo criterio de contraste
          "ícono claro sobre fondo oscuro" que ya resolvió el bug del
          botón "vacío" original (pases 166-167). */}
      <button type="submit" style={estilos.botonEnviar} aria-label="Enviar mensaje">
        <img src="/assets/images/icono-enviar.png" alt="" style={{ width: 30, height: 30, display: 'block' }} />
      </button>
    </form>
        </div>

    {perfilAbierto && token && (
      <PerfilRivalModal
        username={perfilAbierto}
        token={token}
        onClose={() => setPerfilAbierto(null)}
      />
    )}
    </>
  );
}

// Decimonoveno/vigésimo pase ("espaciado y respiración"): el recuadro del
// chat se sentía "genérico" al lado del resto de la UI — un rectángulo
// plano con bordes blancos limpios. Se lo pasó a la MISMA familia visual
// que ya usan los botones flotantes (compartir mano, config, audio):
// degradé pergamino en vez de color plano, y el doble anillo dorado +
// sombra marcada en vez de una sombra simple. El layout interno (tabs,
// mensajes, input) no se tocó — solo el "marco".
// Punto 3 de la lista de crítica de la mesa de juego (pase 61): el
// anillo exterior dorado sólido (#FFB627) competía demasiado con la
// mesa y se sentía "flotando"/genérico — se suaviza a un halo crema
// translúcido, más cálido y menos protagónico, sin sacar el marco de
// doble anillo en sí (chocolate + halo). El botoncito flotante de
// "abrir chat" (`botonAbrirChat`, más abajo) recibe el mismo trato para
// que el estado colapsado y el abierto se vean consistentes.
const estilos = {
  contenedor: {
    position: 'absolute', top: 12, right: 12, width: 250, maxHeight: 320,
    background: 'linear-gradient(160deg, #FFFCF5, #FAEBD2)',
    border: '2.5px solid #4A2C2A', borderRadius: 16,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: "'Nunito', Arial, sans-serif", color: '#4A2C2A',
    boxShadow: '0 0 0 2px rgba(255,248,237,0.6), 0 4px 10px rgba(0,0,0,0.35)', zIndex: 1000
  },
  // Pase siguiente (Fase 4 — dirección "pergamino con marco de madera"):
  // el fondo dorado fuerte del header quedaba como el último resabio del
  // "borde amarillo muy fuerte" que señalaba el punto 3 de la crítica de
  // la mesa (pase 61) — el anillo exterior ya se había suavizado en su
  // momento (ver nota junto a `contenedor`), pero el header seguía con un
  // degradé ámbar bien saturado. Pasa a la misma paleta pergamino que el
  // resto del panel — el dorado queda como acento (tab activo, botón
  // enviar), no como superficie completa.
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 12px', background: 'linear-gradient(160deg, #FFFCF5, #FAEBD2)',
    borderBottom: '2.5px solid #4A2C2A',
    fontSize: 13, fontWeight: '700', fontFamily: "'Fredoka', sans-serif"
  },
  botonCerrar: {
    background: 'linear-gradient(160deg, #FFFCF5, #FAEBD2)', border: '2px solid #4A2C2A', borderRadius: 6,
    width: 22, height: 22, color: '#4A2C2A', cursor: 'pointer', fontSize: 12,
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  mensajes: {
    flex: 1, overflowY: 'auto', padding: '8px 10px', fontSize: 13,
    display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200
  },
  vacio: { color: '#8a7267', fontStyle: 'italic' },
  mensaje: { wordBreak: 'break-word' },
  mensajeSistema: {
    color: '#7a5c1e', fontStyle: 'italic', fontSize: 12,
    textAlign: 'center', padding: '2px 4px', wordBreak: 'break-word'
  },
  nombre: { color: '#C9860E', fontWeight: '800' },
  form: {
    display: 'flex', borderTop: '2px solid rgba(74,44,42,0.2)', padding: 6, gap: 6
  },
  input: {
    // Pase siguiente: el botón de enviar seguía sin verse — la causa real
    // no era el ícono (ya arreglado), sino que este input, con `flex: 1`
    // pero SIN `minWidth: 0`, no se achicaba lo suficiente: el ancho
    // mínimo por default de un <input> en flexbox es el de su contenido
    // (bastante ancho), no 0 — así que el input se negaba a ceder espacio
    // y empujaba el botón de enviar fuera del panel de 250px, donde
    // `overflow: hidden` del contenedor lo recortaba por completo. Con
    // `minWidth: 0` el input SÍ se achica lo necesario y todo entra.
    flex: 1, minWidth: 0, background: '#fff', border: '2px solid #4A2C2A', borderRadius: 8,
    padding: '6px 8px', color: '#4A2C2A', fontSize: 13, outline: 'none'
  },
  botonEnviar: {
    // Pase siguiente: fondo chocolate + anillo dorado (era dorado plano)
    // para que el avión de papel (claro, contorno oscuro) resalte bien —
    // ver comentario junto al <img>.
    background: '#4A2C2A', border: '2px solid #FFB627', borderRadius: 8, color: '#4A2C2A',
    padding: '0 8px', cursor: 'pointer', fontWeight: '700',
    display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  tabs: { display: 'flex', gap: 4, padding: '6px 10px 0' },
  tab: {
    flex: 1, background: 'rgba(74,44,42,0.08)', border: '2px solid transparent',
    borderRadius: '6px 6px 0 0', color: '#4A2C2A', fontSize: 12, padding: '6px 0',
    cursor: 'pointer', position: 'relative', fontWeight: '700'
  },
  puntoNuevo: {
    position: 'absolute', top: 3, right: '28%', width: 7, height: 7, borderRadius: '50%',
    background: '#E8483A', border: '1.5px solid #4A2C2A'
  },
  // Punto rojo sobre el botón "💬 Chat" colapsado, mismo criterio visual
  // que puntoNuevo (los de las pestañas) pero posicionado sobre la
  // esquina del botón entero, no de una pestaña interna.
  puntoNuevoColapsado: {
    position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: '50%',
    background: '#E8483A', border: '1.5px solid #4A2C2A'
  },
  tabActivo: { background: '#FFB627', color: '#4A2C2A' },
  // Misma familia de botones flotantes: degradé pergamino + anillo,
  // conservando la forma píldora propia de este botón. Anillo suavizado
  // a halo crema (punto 3 de la crítica de la mesa, pase 61) para que el
  // chat colapsado y el abierto (`contenedor`, más arriba) se vean
  // consistentes entre sí.
  botonAbrir: {
    position: 'absolute', top: 12, right: 12,
    background: 'linear-gradient(160deg, #FFFCF5, #FAEBD2)', color: '#4A2C2A',
    border: '2.5px solid #4A2C2A', borderRadius: 20, padding: '8px 14px',
    cursor: 'pointer', fontSize: 13, fontWeight: '700', zIndex: 1000,
    display: 'flex', alignItems: 'center', gap: 6,
    boxShadow: '0 0 0 2px rgba(255,248,237,0.6), 0 3px 6px rgba(0,0,0,0.35)'
  },
  // Ícono del botón "Chat" colapsado (reemplaza al emoji 💬, ver comentario
  // junto al <img> más arriba).
  iconoBotonAbrir: { width: 18, height: 18, objectFit: 'contain' },
  mensajeSticker: { display: 'flex', flexDirection: 'column', gap: 2 },
panelStickers: {
  display: 'flex', gap: 6, padding: '8px 10px',
  borderTop: '2px solid rgba(74,44,42,0.2)', flexWrap: 'wrap'
},
stickerBoton: {
  background: '#fff', border: '2px solid #4A2C2A', borderRadius: 8,
  padding: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
},
botonStickerToggle: {
  // Pase siguiente: todavía quedaba espacio para agrandar más la cara —
  // padding a 0 (pegado al borde) e imagen a 36 (era 34). Con el borde de
  // 2px el botón queda en 40x40, mismo tamaño que el botón equivalente en
  // ChatGlobal.js (botonAuxiliar) para que ambos luzcan iguales.
  background: '#fff', border: '2px solid #4A2C2A', borderRadius: 8,
  cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center'
},
iconoStickerToggle: { width: 36, height: 36, borderRadius: 6, objectFit: 'cover' },
};