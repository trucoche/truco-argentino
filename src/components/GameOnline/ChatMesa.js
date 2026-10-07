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
  // Nonagésimo segundo pase: arranca cerrado por defecto (pedido explícito
  // del usuario) — antes abría de entrada y "contaminaba" visualmente el
  // costado del rival. El botón de abrir (ícono bocadillo/madera, estado
  // colapsado) ya existía para este caso — ver el branch de abajo donde
  // `abierto` es false.
  const [abierto, setAbierto] = useState(false);
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
          title="Chat"
          aria-label="Chat"
        >
          {/* Pase siguiente: el emoji 💬 (glyph de sistema, se ve distinto
              según plataforma) se reemplaza por el mismo ícono que ya usa
              el lobby para "Chat" en el nav (`icono-chat.png`, ver
              AppShell.js), para que sea el mismo dibujo en los dos lados. */}
          <img src="/assets/images/icono-chat.png" alt="" style={estilos.iconoBotonAbrir} />
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
    {/* Pedido del usuario: "mini-tarjeta de pergamino con marco de
        madera fina" — capa exterior de madera envolviendo el panel de
        pergamino que ya existía. Nada de esto toca los PNGs del chat
        (ícono de abrir, stickers, botón de enviar) — son los mismos de
        siempre.
        Nonagésimo primer pase: el usuario pidió explícitamente que este
        marco use "la misma textura de madera y remaches rústicos" que la
        placa nueva de la botonera — antes este marco era deliberadamente
        "sin remaches" (ver pase anterior, "widget chico y flotante,
        saturaría"); ahora se agregan los 4, mismo criterio/`estilos.remache`
        que ya usan Lobby/Torneos/Ranking, con la paleta nueva (más
        terracota, sampleada del PNG de la botonera) en vez de la madera
        casi negra vieja. */}
    <div style={estilos.marcoExterior}>
    <span style={{ ...estilos.remache, top: 4, left: 4 }} />
    <span style={{ ...estilos.remache, top: 4, right: 4 }} />
    <span style={{ ...estilos.remache, bottom: 4, left: 4 }} />
    <span style={{ ...estilos.remache, bottom: 4, right: 4 }} />
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
      {/* Ducentésimo cuadragésimo noveno pase: se saca el botón chocolate+
          anillo dorado + avioncito suelto (icono-enviar.png) — el usuario
          pidió el mismo botón ilustrado nuevo (pill verde con el avioncito
          ya dibujado adentro) en TODOS los espacios de enviar mensaje de la
          app, no solo en Chat Global. Mismo archivo que usa esa pantalla
          (`boton-enviar-chat.png`, ver estilos.botonEnviar) — un solo
          asset, reusado, en vez de uno por pantalla. */}
      <button type="submit" style={estilos.botonEnviar} aria-label="Enviar mensaje" />
    </form>
        </div>
    </div>
    {/* ← cierre de marcoExterior (madera fina) */}

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
  // Pedido del usuario: marco de madera fina alrededor de la ventana de
  // chat. `position:absolute` vive acá ahora (antes en `contenedor`);
  // `contenedor` pasa a ser la capa interior de pergamino.
  // Nonagésimo primer pase: paleta re-calibrada (con el cuentagotas)
  // sobre el PNG nuevo de la placa de la botonera, para que este marco
  // "use la misma textura" que pidió el usuario — antes era la madera
  // casi negra de Lobby/Torneos/Ranking (#6b4a34/#4a3226/#2a1c14), ahora
  // es la terracota más rojiza del asset nuevo.
  marcoExterior: {
    position: 'absolute', top: 12, right: 12, width: 250, maxHeight: 320,
    background: 'linear-gradient(160deg, #d37a4a 0%, #a84e31 55%, #431c10 100%)',
    border: '2px solid #6b271d', borderRadius: 18, padding: 3,
    // Pase siguiente (feedback del usuario: "esquina superior derecha
    // completamente recta que choca con los bordes redondeados del
    // marco") — antes solo `contenedor` (la capa de pergamino de
    // adentro) tenía `overflow:hidden`; este marco exterior de madera no
    // lo tenía, así que cualquier contenido que no calzara pixel-perfecto
    // contra el padding de 3px (o el propio scrollbar nativo de
    // `mensajes`, que el navegador dibuja recto sin respetar el
    // `border-radius` de sus ancestros) podía asomar como una esquina
    // cuadrada por fuera del borde redondeado. Con `overflow:hidden` acá
    // también, TODO lo de adentro queda recortado a esta forma, sin
    // depender de que las medidas internas coincidan exacto.
    overflow: 'hidden',
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.10)',
      'inset 0 -2px 6px rgba(0,0,0,0.45)',
      '0 4px 10px rgba(0,0,0,0.35)'
    ].join(', '),
    zIndex: 1000
  },
  // Nonagésimo primer pase: mismo criterio que `estilos.remache` de
  // Lobby/Torneos/Ranking (radial-gradient de 3 tonos + boxShadow), pero
  // más chico (9px en vez de 13px) porque este marco es fino y el widget
  // es chico y flotante — un remache del mismo tamaño que en una placa
  // grande se vería desproporcionado. Paleta: la misma terracota nueva
  // de `marcoExterior`.
  remache: {
    position: 'absolute', width: 9, height: 9, borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 30%, #f2d587 0%, #e3a94a 45%, #8a5a28 78%, #3a1a0a 100%)',
    boxShadow: '0 1px 2px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.4)',
    zIndex: 2,
  },
  contenedor: {
    width: '100%', maxHeight: '100%',
    background: 'linear-gradient(160deg, #FFFCF5, #FAEBD2)',
    border: '1.5px solid rgba(26,20,16,0.35)', borderRadius: 15,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    fontFamily: "'Nunito', Arial, sans-serif", color: '#4A2C2A',
    boxShadow: 'inset 0 1px 4px rgba(0,0,0,0.12)'
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
  // Ducentésimo cuadragésimo noveno pase: mismo botón ilustrado nuevo que
  // Chat Global (pill verde + avioncito dorado ya combinados en un solo
  // PNG) — tamaño más chico acá (panel angosto, 250px) que en Chat
  // Global (62x44), misma proporción real del asset (~1.41:1) para no
  // deformarlo.
  botonEnviar: {
    width: 48, height: 34, flexShrink: 0,
    backgroundImage: 'url(/assets/images/boton-enviar-chat.png)',
    backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundColor: 'transparent',
    border: 'none', borderRadius: 0, cursor: 'pointer',
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
  // Mismo tono de borde que el nuevo marco de madera de `marcoExterior`
  // (antes chocolate plano), para que el estado colapsado y el abierto
  // se lean como la misma familia de marco.
  // Pase 346: chip redondo rústico (mismo lenguaje que los chips del footer
  // del Lobby): disco de madera con borde negro 3px, relieve inferior duro y
  // solo el ícono (sin texto). El punto rojo de "mensaje nuevo" sigue encima.
  botonAbrir: {
    position: 'absolute', top: 12, right: 12,
    width: 52, height: 52, padding: 0, borderRadius: '50%',
    background: 'radial-gradient(circle at 35% 30%, #A9713A 0%, #8B5A2B 45%, #5C3317 100%)',
    border: '3px solid #000', boxShadow: '0 4px 0 #2C160E',
    cursor: 'pointer', zIndex: 1000,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  // Ícono del botón "Chat" colapsado (reemplaza al emoji 💬, ver comentario
  // junto al <img> más arriba).
  iconoBotonAbrir: { width: 30, height: 30, objectFit: 'contain' },
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