import React, { useState, useEffect, useCallback, useRef } from 'react';
import MisionesCard from './MisionesCard';
import PerfilRivalModal from '../PerfilRival/PerfilRivalModal';
import PantallaCarga from '../PantallaCarga/PantallaCarga';
import PopupMadera, { PlacaMadera } from '../Popup/PopupMadera';
import { rangoUi } from '../Perfil/rangosUi';
import { useToast } from '../../contexts/ToastContext';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/salas`;

// Mismas opciones (y mismos valores) que usa la pantalla equivalente en
// nativo (lobby.tsx) — ahí ya se eligen con botones simples en vez de
// desplegables, así que acá se copia el mismo patrón.
const MODOS = ['1v1', '2v2', '3v3'];
// Cuadragésimo séptimo pase: hoisteado para reusarlo tanto en el ícono de
// cada tarjeta de sala como en el selector compacto de "Jugar ya".
// Quincuagésimo cuarto pase — los emojis se reemplazaron por las
// ilustraciones de gaucho-con-sombrero que pasó el usuario (un gaucho para
// 1v1, dos para 2v2, tres para 3v3), recortadas con el mismo marco
// compartido para conservar la escala relativa entre las tres variantes.
const ICONOS_MODO = {
  '1v1': '/assets/images/icono-modo-1v1.png',
  '2v2': '/assets/images/icono-modo-2v2.png',
  '3v3': '/assets/images/icono-modo-3v3.png',
};
// Sexagésimo pase — pedido de estilo "premium" para el selector de modo
// de "Jugar ya": el ícono cambia de color según el estado del botón (no
// solo el fondo), así que hacen falta DOS variantes por modo en vez de
// una — blanco puro para el botón activo (fondo dorado), verde oscuro
// para el inactivo (fondo actual). El usuario pasó las 6 ilustraciones ya
// coloreadas así; se recortaron con el mismo marco compartido POR MODO
// (activo+inactivo del mismo modo comparten bbox) para que el ícono no
// salte de tamaño al alternar entre los dos estados. Solo se usa en el
// selector compacto de "Jugar ya" — el ícono de la tarjeta de sala
// (ICONOS_MODO de arriba, sin estado) no cambia.
const ICONOS_MODO_SELECTOR = {
  '1v1': { activo: '/assets/images/icono-modo-1v1-activo.png', inactivo: '/assets/images/icono-modo-1v1-inactivo.png' },
  '2v2': { activo: '/assets/images/icono-modo-2v2-activo.png', inactivo: '/assets/images/icono-modo-2v2-inactivo.png' },
  '3v3': { activo: '/assets/images/icono-modo-3v3-activo.png', inactivo: '/assets/images/icono-modo-3v3-inactivo.png' },
};
const PUNTOS_OPCIONES = [15, 30];
// Solo 15/30/45 — se sacaron "Sin límite" y "60s" para evitar mesas
// colgadas; 15s queda marcado como recomendado (ver estilos.opcionBtnRecomendada).
const TIEMPO_OPCIONES = [
  { valor: '15', label: '15s', recomendada: true },
  { valor: '30', label: '30s' },
  { valor: '45', label: '45s' },
];

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c', verdeProfundo: '#163f24',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8',
  crema: '#FFF8ED', chocolate: '#4A2C2A',
  // Cuadragésimo octavo pase — punto 2 del feedback de diseño ("sistema de
  // tarjetas más limpio"): fondo de tarjeta más sutil que el crema
  // saturado de antes, para que las tarjetas no compitan tanto entre sí.
  cremaSutil: '#FFFCF6',
  // Pase de rediseño estructural (siguiendo el mismo criterio ya aplicado
  // en Torneos/Ranking/Historial/Chat Global): tonos de madera+bronce
  // "de taberna" para reemplazar las cajas blancas/crema planas de esta
  // pantalla, que es la pantalla central del juego.
  maderaClara: '#6b4a34', maderaMedia: '#4a3226', maderaOscura: '#2a1c14',
  remacheClaro: '#f0d9a0', remache: '#c9973e', remacheOscuro: '#7a5322',
  negroPulido: '#1a1410',
};

function Filigrana() {
  const path = (
    <>
      <path d="M2 44 C2 20 20 2 44 2" stroke={C.doradoOscuro} strokeWidth="1.5" />
      <path d="M2 34 C2 16 16 2 34 2" stroke={C.dorado} strokeWidth="1.2" />
      <circle cx="2" cy="44" r="3" fill={C.dorado} />
      <path d="M8 44 C8 24 24 8 44 8" stroke={C.dorado} strokeWidth="0.8" opacity="0.7" />
    </>
  );
  const base = { position: 'absolute', width: 44, height: 44, opacity: 0.55, pointerEvents: 'none' };
  return (
    <>
      <svg style={{ ...base, top: 6, left: 6 }} viewBox="0 0 46 46" fill="none">{path}</svg>
      <svg style={{ ...base, top: 6, right: 6, transform: 'scaleX(-1)' }} viewBox="0 0 46 46" fill="none">{path}</svg>
      <svg style={{ ...base, bottom: 6, left: 6, transform: 'scaleY(-1)' }} viewBox="0 0 46 46" fill="none">{path}</svg>
      <svg style={{ ...base, bottom: 6, right: 6, transform: 'scale(-1,-1)' }} viewBox="0 0 46 46" fill="none">{path}</svg>
    </>
  );
}

// Ya NO recibe onLogout/onVerRanking/onVerTorneos — esa navegación ahora
// vive en el AppShell (header + nav), no dentro del contenido del Lobby.
export default function Lobby({ token, usuario, onPersonajeCambiado, onEntrarAPartida, onBuscarPartidaActiva, onMisionReclamada, onIrARanked, codigoInicial, bannerTexto, onBannerClick }) {
  const { mostrarToast } = useToast();
  const [salas, setSalas]           = useState([]);
  const [cargando, setCargando]     = useState(true);
  const [error, setError]           = useState('');
  const [creandoSala, setCreandoSala] = useState(false);
  const [modo, setModo]             = useState('1v1');
  const [puntosParaGanar, setPuntosParaGanar] = useState(15);
  const [codigoUnirse, setCodigoUnirse] = useState('');
  const [privada, setPrivada]       = useState(false);
  // Default 15s — es la única opción "recomendada" y ya no existe "Sin límite".
  const [tiempoPorTurno, setTiempoPorTurno] = useState('15');
  const [codigoPrivadoCreado, setCodigoPrivadoCreado] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [copiadoUrl, setCopiadoUrl] = useState(false);
  const [conFlor, setConFlor] = useState(false);
  const [modoRapido, setModoRapido] = useState('1v1');
  // Nonagésimo octavo pase: click en "Creada por X" abre el popup de
  // perfil público de ese jugador.
  const [perfilAbierto, setPerfilAbierto] = useState(null);
  // Quincuagésimo séptimo pase — punto 5 del feedback de diseño: el botón
  // "+ Crear sala" del estado vacío de "Salas disponibles" abre el panel
  // de arriba (setCreandoSala) pero ese panel puede quedar fuera de
  // pantalla, así que además se lo hace scrollear a la vista.
  const panelCrearSalaRef = useRef(null);
  const irACrearSala = () => {
    setCreandoSala(true);
    panelCrearSalaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

useEffect(() => {
    console.log('DEBUG codigoInicial recibido:', codigoInicial);
    if (codigoInicial) setCodigoUnirse(codigoInicial);
  }, [codigoInicial]);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const cargarSalas = useCallback(async () => {
    try {
      const res = await fetch(API_URL, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al cargar salas');
        return;
      }
      setSalas(data);
      setError('');
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    cargarSalas();
    const intervalo = setInterval(cargarSalas, 5000);
    return () => clearInterval(intervalo);
  }, [cargarSalas]);
  

  // Nota: el fetch de perfil (actualizarPerfil) que antes vivía acá se
  // movió a App.js, ya que ahora el saldo/usuario lo muestra el AppShell
  // en TODAS las pantallas, no solo en Lobby.

  const handleCrearSala = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
            modo,
            puntosParaGanar,
            privada,
            tiempoPorTurno: tiempoPorTurno || null,
            conFlor
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al crear sala');
        return;
      }

      // Pase siguiente: crear la sala ya NO te sienta automáticamente como
      // jugador (pedido explícito del usuario, ver salas.js) — antes esto
      // solo mostraba el modal de código para salas privadas y entraba
      // directo a las públicas; ahora se muestra siempre, para que el
      // creador elija: "Entrar a jugar" (se une recién ahí) o cerrar el
      // modal y compartir el código sin ocupar un lugar.
      setCodigoPrivadoCreado(data.codigo);

      // Pase siguiente: el backend SÍ descuenta la moneda al crear una sala
      // privada (ver COSTO_SALA_PRIVADA en salas.js) — el bug reportado
      // ("no se descuenta la moneda") en realidad era que el saldo del
      // header (AppShell) no se refrescaba después de crear la sala, así
      // que el usuario seguía viendo el número viejo hasta que algo más
      // disparaba `onMisionReclamada` (reclamar una misión, cambiar de
      // personaje, etc). Reusamos ese mismo callback acá para refrescar el
      // perfil apenas se crea la sala.
      if (privada) onMisionReclamada?.();

    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    }
  };

  const [buscandoPartida, setBuscandoPartida] = useState(false);

  const handleJugarYa = async () => {
    setError('');
    setBuscandoPartida(true);
    try {
      const res = await fetch(`${API_URL}/jugar-ya`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ modo: modoRapido })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al buscar partida');
        return;
      }

      onEntrarAPartida(data.codigo);
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setBuscandoPartida(false);
    }
  };

  const handleUnirse = async (codigo) => {
    setError('');
    try {
      const res = await fetch(`${API_URL}/${codigo}/unirse`, {
        method: 'POST',
        headers
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al unirse a la sala');
        return;
      }

      onEntrarAPartida(codigo);

    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    }
  };

  return (
    <div style={estilos.fondoLobby}>
      <div style={estilos.overlayLobby}>
      {error && <div style={estilos.errorBox}>{error}</div>}

          {/* Pase siguiente: el banner de torneo (que antes vivía SOLO en
              AppShell.js, arriba de cada pantalla) se mueve a compartir
              fila con "Jugar ya" acá en el Lobby, a pedido del usuario
              (quería la página más corta) — AppShell ya no lo dibuja
              cuando `pantallaActiva === 'lobby'` (ver AppShell.js). En el
              resto de las pantallas (Torneos, Ranking, etc.) sigue
              apareciendo como antes, arriba de todo. `flexWrap: 'wrap'`
              para que en celulares angostos, donde no entran los dos uno
              al lado del otro, se apilen en vez de aplastarse. */}
          {/* Bug real (reportado por el usuario): esta fila tenía
              `alignItems: 'stretch'` (el default), que fuerza al banner a
              ESTIRARSE hasta la altura del panel "Jugar ya" (mucho más
              alto) — como el banner además tiene `aspect-ratio: 3/1`
              (app-shell.css, `.ts-banner`), esa altura forzada entraba en
              conflicto con la proporción real de la imagen, y el
              resultado era la plaqueta aplastada/estirada que se veía en
              las capturas. `flex-start` (pase 182) ya evitaba el
              estiramiento, pero dejaba el banner pegado ARRIBA de la fila
              — el usuario después pidió que quede centrado en el espacio
              libre que deja el panel "Jugar ya" (más alto). `center` logra
              las dos cosas: cada uno mide su propia altura (sin heredar la
              del hermano) Y el más chico queda centrado verticalmente en
              el alto de la fila. */}
          {/* Pase siguiente — bug real encontrado: en pantallas angostas el
              banner queda SOLO en su propia línea (el panel "Jugar ya" se
              apila abajo, por el `flexWrap`), y como el banner tiene un
              `max-width` (320px vía inline style más abajo) que en varios
              anchos de celular es más chico que el ancho real disponible
              en esa línea, sobra espacio libre en esa línea — sin
              `justify-content` (default `flex-start`), ese sobrante queda
              siempre a la DERECHA del banner, empujándolo visualmente hacia
              la izquierda (justo lo que reportó el usuario). `center`
              soluciona ese caso sin afectar el caso de pantalla ancha: ahí
              el panel "Jugar ya" (sin `max-width`, absorbe todo el resto)
              ya ocupa el sobrante de la línea, así que `justify-content`
              nunca llega a entrar en juego. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ flex: '1 1 300px', maxWidth: 340, display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
          {bannerTexto && (
            <button
              className="ts-banner"
              onClick={onBannerClick}
              style={{ margin: 0 }}
            >
              {/* Bug real encontrado (pase siguiente): el texto vivía
                  directo como contenido del botón, posicionado con
                  `padding: 0 6% 0 39%` (app-shell.css, `.ts-banner`) — un
                  padding en PORCENTAJE. Por spec de CSS, el porcentaje de
                  padding-left/right de un elemento se calcula contra el
                  ancho del bloque contenedor (su PADRE), no contra el
                  ancho propio del elemento. Mientras el banner vivía solo
                  (ancho de sí mismo = ancho de su padre), eso daba la
                  cuenta correcta por pura coincidencia — pero desde que
                  (pase 181) el banner comparte fila con el panel "Jugar
                  ya", su padre real es esa FILA completa (banner + panel),
                  mucho más ancha que el banner en sí — el mismo 39%
                  calculado contra ese ancho más grande da muchos más
                  píxeles de la cuenta, empujando el texto casi al borde
                  derecho y dejando la mitad de la madera vacía en el
                  medio (justo lo que se ve en las capturas). Fix: en vez
                  de padding-porcentaje en el botón, un `<span>` interno
                  posicionado en `absolute` (`.ts-banner-texto`, ver
                  app-shell.css) — un elemento absoluto SÍ resuelve sus
                  porcentajes de left/right contra el contenedor
                  posicionado más cercano (`.ts-banner` ahora con
                  `position: relative`), que es el propio banner, no la
                  fila entera. */}
              {/* Bug real encontrado (pase siguiente): la imagen de fondo
                  vivía directo en `.ts-banner` (el <button>), junto con un
                  `box-shadow` para la sombra/glow. `box-shadow` sigue la
                  forma de la CAJA del elemento (un simple rectángulo
                  redondeado) — pero `banner-torneo.png` es una plaqueta
                  con esquinas CONCAVAS/recortadas (no un rectángulo
                  redondeado normal), con bastante margen transparente en
                  cada esquina. Contra el verde del lobby, esa sombra
                  rectangular asomaba por los recortes de la plaqueta como
                  un rectángulo que no coincide con el dibujo real (lo que
                  se reportó como "el rectángulo con sombra verde"). Fix:
                  la imagen de fondo pasa a un `<div className="ts-banner-
                  bg">` aparte (ver app-shell.css) que usa `filter: drop-
                  shadow(...)` en vez de `box-shadow` — a diferencia de
                  box-shadow, drop-shadow sigue el canal alfa real del
                  contenido (el contorno recortado de la plaqueta, no la
                  caja rectangular), así que la sombra/glow ahora abraza la
                  forma real de la imagen. Al vivir en un div APARTE del
                  texto (en vez de todo junto en el botón), el filtro no
                  duplica su propio efecto sobre las letras. */}
              <div
                className="ts-banner-bg"
                style={{
                  backgroundImage: "url('/assets/images/banner-torneo.png')",
                  backgroundSize: '100% 100%',
                  backgroundRepeat: 'no-repeat',
                }}
              />
              <span className="ts-banner-texto">{bannerTexto}</span>
            </button>
          )}
          {onIrARanked && (() => {
            const r = usuario?.rango;
            const ui = rangoUi(r);
            const titulo = r ? (r.esTop500 ? r.nombre : `${r.nombre} ${r.division}`) : 'Sin rango';
            return (
              <PlacaMadera colorInterior="#4A3226" interiorStyle={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={ui.logo} alt="" style={{ width: 56, height: 56, objectFit: 'contain', flex: '0 0 auto' }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 18, color: '#F5B041', letterSpacing: 0.5 }}>LIGA CRIOLLA</div>
                    <div style={{ fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12.5, color: '#FFF3D6' }}>
                      {r ? `${titulo} · ${r.puntos} pts` : titulo}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onIrARanked}
                  style={{
                    fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 16, color: '#4A2C2A',
                    background: '#F5B041', border: '2px solid #000', borderRadius: 999, padding: '10px 20px',
                    boxShadow: '0 3px 0 #B9770E, 0 5px 0 #000', cursor: 'pointer', width: '100%',
                  }}
                >
                  JUGAR LIGA
                </button>
              </PlacaMadera>
            );
          })()}
          </div>
          {/* Pase de rediseño estructural: "Jugar ya" — el CTA principal de
              la pantalla central del juego — pasa a vivir dentro de una
              gran placa de madera de caoba con marco biselado oscuro y
              remaches de bronce en las esquinas (mismo criterio que
              `destacadoPanelExterior` de Torneos.js), envolviendo el fondo
              de paño/cuero que ya tenía. Antes era una sola caja con borde
              chocolate fino — ahora tiene la misma "unidad estructural" de
              placa de taberna que el resto de la app. */}
          <div style={{ ...estilos.panelJugarYaExterior, margin: 0, flex: '1 1 320px', maxWidth: 500 }}>
            <span style={{ ...estilos.remache, top: 10, left: 10 }} />
            <span style={{ ...estilos.remache, top: 10, right: 10 }} />
            <span style={{ ...estilos.remache, bottom: 10, left: 10 }} />
            <span style={{ ...estilos.remache, bottom: 10, right: 10 }} />
            <div style={estilos.panelJugarYa}>
            <div style={{ ...estilos.panelTitleClaro, display: 'flex', alignItems: 'center', gap: 8 }}>
              <img src="/assets/images/icono-rayo.png" alt="" style={estilos.iconoRayo} />
              Jugar ya
            </div>
            <div style={estilos.hintClaro}>Te emparejamos al instante en {modoRapido}, sin Flor.</div>
            <div style={estilos.field}>
              <label style={estilos.labelClaro}>Modo</label>
              <div style={estilos.opcionesRow}>
                {MODOS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setModoRapido(m)}
                    disabled={buscandoPartida}
                    style={{
                      ...estilos.opcionBtnCompacta,
                      ...(modoRapido === m ? estilos.opcionBtnCompactaActiva : {}),
                      ...(buscandoPartida ? estilos.opcionBtnDisabled : {})
                    }}
                  >
                    <img
                      src={modoRapido === m ? ICONOS_MODO_SELECTOR[m].activo : ICONOS_MODO_SELECTOR[m].inactivo}
                      alt=""
                      style={{
                        ...estilos.iconoModoCompacto,
                        // Pase 322: los PNG inactivos ya vienen pintados en beige (#FFFBEB), sin filtro.
                      }}
                    />
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={handleJugarYa} disabled={buscandoPartida} style={estilos.btnJugarYa}>
              {buscandoPartida ? 'Buscando...' : (
                <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <img src="/assets/images/icono-rayo.png" alt="" style={estilos.iconoRayoBoton} />
                  Jugar ya
                </span>
              )}
            </button>
            </div>
          </div>
          </div>

      {/* Pase de rediseño estructural: "Crear sala"/"Unirse con
          código"/"Torneo en curso" pasan a ser 3 placas de madera+
          pergamino de idéntica proporción (mismo marco, mismo padding,
          remaches en las 4 esquinas) en vez de 3 cajas blancas/crema
          desalineadas de distinto tamaño — antes "Torneo en curso" era
          notablemente más chica (variante "compacta") que las otras 2. */}
      <div style={estilos.filaAccesosRapidos}>
      <div ref={panelCrearSalaRef} style={estilos.accesoCardExterior}>
        <span style={{ ...estilos.remache, top: 8, left: 8 }} />
        <span style={{ ...estilos.remache, top: 8, right: 8 }} />
        <span style={{ ...estilos.remache, bottom: 8, left: 8 }} />
        <span style={{ ...estilos.remache, bottom: 8, right: 8 }} />
        <div style={estilos.accesoCard}>
        <Filigrana />
        {/* Centésimo cuadragésimo séptimo pase: el emoji 🃏 (joker) que
            acompañaba "Crear sala" se reemplaza por el ícono ilustrado
            (libro TC) que pasó el usuario. */}
        <div style={estilos.panelTitle}>
          <img src="/assets/images/icono-crear-sala.png" alt="" style={estilos.iconoPanelTitle} /> Crear sala
        </div>

        {!creandoSala ? (
          <button onClick={() => setCreandoSala(true)} style={estilos.btnNuevaSala}>+ Nueva sala</button>
        ) : (
          <form onSubmit={handleCrearSala}>
            <div style={estilos.fieldRow}>
              <div style={estilos.field}>
                <label style={estilos.label}>Modo</label>
                <div style={estilos.opcionesRow}>
                  {MODOS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModo(m)}
                      style={{ ...estilos.opcionBtn, ...(modo === m ? estilos.opcionBtnActiva : {}) }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div style={estilos.field}>
                <label style={estilos.label}>Puntos</label>
                <div style={estilos.opcionesRow}>
                  {PUNTOS_OPCIONES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPuntosParaGanar(p)}
                      style={{ ...estilos.opcionBtn, ...(puntosParaGanar === p ? estilos.opcionBtnActiva : {}) }}
                    >
                      {p} pts
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={estilos.field}>
              <label style={estilos.label}>Tiempo por turno</label>
              <div style={estilos.opcionesRow}>
                {TIEMPO_OPCIONES.map((t) => (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => setTiempoPorTurno(t.valor)}
                    style={{
                      ...estilos.opcionBtn,
                      ...(t.recomendada ? estilos.opcionBtnRecomendada : {}),
                      ...(tiempoPorTurno === t.valor ? estilos.opcionBtnActiva : {})
                    }}
                  >
                    {t.label}
                    {t.recomendada && <span style={estilos.badgeRecomendada}>Recomendado</span>}
                  </button>
                ))}
              </div>
            </div>

            <div style={estilos.checkboxRow}>
              <input
                type="checkbox"
                id="privada"
                checked={privada}
                onChange={(e) => setPrivada(e.target.checked)}
                style={estilos.checkbox}
              />
              <label htmlFor="privada" style={{ margin: 0, fontWeight: 700, fontSize: 16, color: C.chocolate }}>
                Sala privada <span style={{ fontWeight: 400, fontSize: 14, color: '#7a6660' }}>
                  {/* Pase siguiente #3: se restaura la mención del costo — ver
                      COSTO_SALA_PRIVADA en salas.js. */}
                  (no aparece en el listado, cuesta 1 🪙)
                </span>
              </label>
            </div>

            <div style={estilos.checkboxRow}>
              <input
                type="checkbox"
                id="conFlor"
                checked={conFlor}
                onChange={(e) => setConFlor(e.target.checked)}
                style={estilos.checkbox}
              />
              <label htmlFor="conFlor" style={{ margin: 0, fontWeight: 700, fontSize: 16, color: C.chocolate }}>
                Jugar con Flor
              </label>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button type="submit" style={{ ...estilos.btnPrimary, flex: 1 }}>
                {privada ? 'Crear por 1 🪙' : '✓ Crear sala'}
              </button>
              <button type="button" onClick={() => setCreandoSala(false)} style={{ ...estilos.btnSecondary, width: 'auto', padding: '12px 20px' }}>✕</button>
            </div>
          </form>
        )}
        </div>
      </div>

      {/* Cuadragésimo octavo pase — punto 2: "Unirse con código" se movió
          para quedar justo al lado de "Crear sala" (antes estaba después
          de Torneo/Preview) — agrupa las dos formas de entrar a una
          partida en la misma zona lógica de la grilla. */}
      <div style={estilos.accesoCardExterior}>
        <span style={{ ...estilos.remache, top: 8, left: 8 }} />
        <span style={{ ...estilos.remache, top: 8, right: 8 }} />
        <span style={{ ...estilos.remache, bottom: 8, left: 8 }} />
        <span style={{ ...estilos.remache, bottom: 8, right: 8 }} />
        <div style={estilos.accesoCard}>
      {/* Centésimo cuadragésimo séptimo pase: el emoji 🔑 se reemplaza por
          la llave ilustrada — mismo criterio en "Sala privada creada" más
          abajo. */}
      <div style={estilos.panelTitle}>
        <img src="/assets/images/icono-sala-privada.png" alt="" style={estilos.iconoPanelTitle} /> Unirse con código
      </div>
        {/* Pase de rediseño estructural: campo "ahuecado" estilo cuero
            oscuro (antes blanco liso, igual que cualquier <input> de la
            app) — mismo criterio "hundido" que `tabInactiva` de
            Torneos.js (sombra interior en vez de relieve). */}
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            placeholder="Código de sala"
            value={codigoUnirse}
            onChange={(e) => setCodigoUnirse(e.target.value.toUpperCase())}
            className="ts-input-codigo"
            style={{ ...estilos.inputCuero, flex: 1 }}
          />
          <button
            onClick={() => codigoUnirse && handleUnirse(codigoUnirse)}
            style={{ ...estilos.btnPrimary, width: 'auto', padding: '12px 22px' }}
          >
            Unirse
          </button>
        </div>
        </div>
      </div>

      {/* Cuadragésimo octavo pase — punto 2 (superado por el pase de
          rediseño estructural siguiente): "Torneo en curso" pasa a usar la
          misma placa de idéntica proporción que "Crear sala"/"Unirse con
          código" — antes era la variante "compacta", notablemente más
          chica. Se agrega un indicador "Partida esperando" (reloj de
          arena) para que se entienda de un vistazo qué hace este botón
          antes de leer el texto de ayuda. */}
      <div style={estilos.accesoCardExterior}>
        <span style={{ ...estilos.remache, top: 8, left: 8 }} />
        <span style={{ ...estilos.remache, top: 8, right: 8 }} />
        <span style={{ ...estilos.remache, bottom: 8, left: 8 }} />
        <span style={{ ...estilos.remache, bottom: 8, right: 8 }} />
        <div style={estilos.accesoCard}>
      <div style={estilos.panelTitle}>
        <img src="/assets/images/trofeo.png" alt="" style={estilos.iconoPanelTitle} /> Torneo en curso
      </div>
        <div style={estilos.indicadorEsperando}>
          <img src="/assets/images/reloj-arena.png" alt="" style={estilos.iconoIndicadorEsperando} />
          Partida esperando
        </div>
        <div style={estilos.hint}>¿Tenés una partida de torneo esperando? Buscala acá.</div>
        {/* Pase siguiente: el emoji 🔍 se reemplaza por la lupa ilustrada
            que pasó el usuario — mismo criterio que iconoRayoBoton (alto
            fijo, ancho auto, contain).
            Pase siguiente (#2): lupa agrandada (20→30) porque el botón es
            grande y quedaba chica, y el texto ahora lleva un delineado
            (textShadow multidireccional, no WebkitTextStroke, para que
            funcione en cualquier browser) color chocolate para que resalte
            más sobre el fondo crimson. */}
        <button onClick={onBuscarPartidaActiva} style={estilos.btnCrimson}>
          <img src="/assets/images/icono-lupa.png" alt="" style={estilos.iconoLupaBoton} />
          <span style={estilos.textoBtnCrimson}>Buscar mi partida activa</span>
        </button>
        </div>
      </div>
      </div>

      <div style={estilos.filaSecundaria}>
      {/* Nonagésimo noveno pase: achicada más todavía que el resto de los
          paneles "compactos" — esto es solo dev, nunca lo ve un usuario
          real, así que se deja con su propio estilo neutro de siempre en
          vez del rediseño de arriba. */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ ...estilos.panelSecundario, ...estilos.panelCompacto, ...estilos.panelPreviewDev, marginBottom: 0 }}>
          <div style={estilos.panelTitlePreviewDev}>🛠️ Preview de mesa (dev)</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { window.history.replaceState(null, '', '?preview=1v1'); onEntrarAPartida('PREVIEW_1V1'); }} style={estilos.btnCardChico}>1v1</button>
            <button onClick={() => { window.history.replaceState(null, '', '?preview=2v2'); onEntrarAPartida('PREVIEW_2V2'); }} style={estilos.btnCardChico}>2v2</button>
            <button onClick={() => { window.history.replaceState(null, '', '?preview=3v3'); onEntrarAPartida('PREVIEW_3V3'); }} style={estilos.btnCardChico}>3v3</button>
          </div>
        </div>
      )}

          <MisionesCard token={token} personaje={usuario?.personaje} onMisionReclamada={onMisionReclamada} />
</div>

      {/* Pase de rediseño estructural: "Salas disponibles" pasa a vivir
          dentro de una placa de madera alargada tipo "tablero de anuncios
          de pulpería" (mismo criterio que `panelExterior` de Torneos.js)
          en vez de vivir suelta sobre el fondo verde — mismo marco que ya
          envuelve el resto de los módulos de esta pantalla. */}
      <div style={estilos.tableroExterior}>
        <span style={{ ...estilos.remache, top: 10, left: 10 }} />
        <span style={{ ...estilos.remache, top: 10, right: 10 }} />
        <span style={{ ...estilos.remache, bottom: 10, left: 10 }} />
        <span style={{ ...estilos.remache, bottom: 10, right: 10 }} />
      <div style={estilos.tableroInterior}>
      <div style={estilos.sectionTitle}>🎲 Salas disponibles</div>
      {cargando ? (
  // Centésimo cuadragésimo sexto pase: ver PantallaCarga.
  <PantallaCarga completa={false} conLogo={false} />
) : salas.length === 0 ? (
  // Pase de rediseño estructural: se saca el marco punteado plano y se
  // pone al personaje chibi (mismo estilo ilustrado que ya usa la tarjeta
  // de Misiones — no hay todavía un dibujo de personaje saludando/en pose
  // amigable dedicado, así que se reusa el más parecido que existe) en
  // vez del ícono del libro, que ya se usa como ícono de "Crear sala" más
  // arriba.
  <div style={estilos.emptyState}>
    <img src="/assets/images/mision-gaucho.png" alt="" style={estilos.emptyStatePersonaje} />
    <div style={estilos.emptyStateTitulo}>Todavía no hay salas abiertas</div>
    <div style={estilos.emptyStateTexto}>Sé el primero en armar una mesa — elegí el modo y esperá rivales.</div>
    <button onClick={irACrearSala} style={estilos.btnPrimary}>+ Crear sala</button>
  </div>
) : (
  <div style={estilos.salasGrid}>
    {salas.map((sala) => {
          const completa = sala.jugadores_count >= sala.jugadores_totales;
          const iconoModoSrc = ICONOS_MODO[sala.modo];
          return (
            <div key={sala.id} style={estilos.salaCardExterior}>
              <div style={estilos.salaCard}>
              <div style={estilos.salaHeader}>
                <div style={estilos.salaTitulo}>
                  {iconoModoSrc
                    ? <img src={iconoModoSrc} alt="" style={estilos.iconoModoSala} />
                    : <span style={{ fontSize: 20.5 }}>🃏</span>}
                  <span style={estilos.salaNombre}>{sala.codigo}</span>
                </div>
                <div style={{ ...estilos.badge, ...(completa ? estilos.badgeCompleta : estilos.badgeAbierta) }}>
                  {completa ? 'Completa' : 'Disponible'}
                </div>
              </div>

              <div style={estilos.chipsFila}>
                <span style={estilos.chip}>👥 {sala.jugadores_count}/{sala.jugadores_totales}</span>
                <span style={estilos.chip}>🎯 {sala.puntos_para_ganar} pts</span>
                {sala.tiempo_por_turno && <span style={estilos.chip}>⏱ {sala.tiempo_por_turno}s</span>}
              </div>

              <div
                style={{ ...estilos.salaCreador, cursor: sala.creador_nombre ? 'pointer' : 'default' }}
                onClick={() => sala.creador_nombre && setPerfilAbierto(sala.creador_nombre)}
              >
                Creada por {sala.creador_nombre}
              </div>

              <button
                onClick={() => handleUnirse(sala.codigo)}
                disabled={completa}
                style={completa ? estilos.btnCardDisabled : estilos.btnCard}
              >
                {completa ? 'Completa' : 'Unirse'}
              </button>
              </div>
            </div>
          );
              })}
        </div>
      )}
      </div>
      </div>

      {/* Pase 325: pop-up de madera (cinta verde, icono de sala con resplandor, botones píldora 3D). */}
      <PopupMadera
        visible={!!codigoPrivadoCreado}
        titulo={privada ? 'Sala privada creada' : '¡Sala creada!'}
        cinta="verde"
        icono="/assets/images/icono-sala-privada.png"
        tamIcono={72}
        onCerrar={() => setCodigoPrivadoCreado(null)}
        botones={[
          {
            texto: copiado ? '✓ ¡Copiado!' : 'Copiar código',
            onClick: () => {
              navigator.clipboard.writeText(codigoPrivadoCreado);
              setCopiado(true);
              mostrarToast('Código copiado', 'exito');
              setTimeout(() => setCopiado(false), 2000);
            },
          },
          {
            texto: copiadoUrl ? '✓ ¡Enlace copiado!' : 'Copiar enlace',
            onClick: () => {
              const url = `${window.location.origin}/?codigo=${codigoPrivadoCreado}`;
              navigator.clipboard.writeText(url);
              setCopiadoUrl(true);
              mostrarToast('Enlace copiado', 'exito');
              setTimeout(() => setCopiadoUrl(false), 2000);
            },
          },
          // Pase siguiente (se mantiene): crear la sala no ocupa lugar; este botón hace el join real.
          {
            texto: '✓ Entrar a jugar',
            tipo: 'verde',
            onClick: async () => {
              await handleUnirse(codigoPrivadoCreado);
              setCodigoPrivadoCreado(null);
            },
          },
        ]}
      >
        <p style={{ fontSize: 15, fontWeight: 800, color: '#2C160E', margin: '0 0 10px', textAlign: 'center' }}>
          {privada
            ? 'Compartí este código con quien quieras invitar:'
            : 'Ya aparece en el listado de salas disponibles. También podés compartir el código directamente:'}
        </p>
        <div style={estilos.codigoBox}>{codigoPrivadoCreado}</div>
        <div style={estilos.featuresRow}>
          <div style={estilos.featureCard}>
            <span style={estilos.featureIcon}>🔗</span>
            <span style={estilos.featureLabel}>Enlace para compartir</span>
          </div>
          <div style={estilos.featureCard}>
            <span style={estilos.featureIcon}>🎧</span>
            <span style={estilos.featureLabel}>Audio en la mesa</span>
          </div>
        </div>
      </PopupMadera>

      {perfilAbierto && (
        <PerfilRivalModal
          username={perfilAbierto}
          token={token}
          onClose={() => setPerfilAbierto(null)}
        />
      )}
      </div>
    </div>
  );
}

// Pase 333: contorno negro fino alrededor del texto blanco de los botones verdes.
const CONTORNO_TEXTO = '-1.5px -1.5px 0 #000, 0 -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 0 0 #000, 1.5px 0 0 #000, -1.5px 1.5px 0 #000, 0 1.5px 0 #000, 1.5px 1.5px 0 #000';

const estilos = {
  // Quincuagésimo pase — la imagen de fondo (antes acá, con el truco de
  // margin negativo para que "sangrara" hasta el borde de .ts-content) se
  // subió a .ts-shell (app-shell.css), que sí cubre toda la pantalla
  // siempre — ver el comentario ahí. Esto queda solo como wrapper, sin
  // fondo propio, para no duplicar la imagen ni la sombra oscura.
  fondoLobby: {
    minHeight: '100%',
  },
  overlayLobby: {
    position: 'relative',
  },
  errorBox: {
    background: '#ffe0dd', border: `2px solid ${C.crimson}`, color: C.crimsonOscuro,
    borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontWeight: 700, fontSize: 15
  },
  // Pase de rediseño estructural: remache de bronce (mismo `radial-gradient`
  // que ya usan Torneos/Ranking/Historial/Chat Global) — un solo punto de
  // luz reusado en las esquinas de todos los marcos de madera nuevos de
  // esta pantalla.
  remache: {
    position: 'absolute', width: 13, height: 13, borderRadius: '50%',
    background: `radial-gradient(circle at 35% 30%, ${C.remacheClaro} 0%, ${C.remache} 45%, ${C.remacheOscuro} 78%, #3a2610 100%)`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.4)',
    zIndex: 2,
  },
  // Placa de madera exterior (mismo criterio que `panelExterior`/
  // `destacadoPanelExterior` de Torneos.js) para "Crear sala"/"Unirse con
  // código"/"Torneo en curso" — las 3 comparten exactamente el mismo
  // marco/padding para que se vean como 3 placas de idéntica proporción,
  // a diferencia de antes (Torneo en curso usaba una variante "compacta"
  // visiblemente más chica que las otras 2).
  accesoCardExterior: {
    position: 'relative',
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.negroPulido}`, borderRadius: 20, padding: 9,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -4px 10px rgba(0,0,0,0.5)',
      `0 8px 0 ${C.negroPulido}`,
      '0 16px 26px rgba(0,0,0,0.4)',
    ].join(', '),
  },
  accesoCard: {
    position: 'relative', overflow: 'hidden',
    background: [
      'radial-gradient(ellipse at 20% 25%, rgba(210,182,130,0.4) 0%, transparent 50%)',
      'radial-gradient(ellipse at 82% 75%, rgba(190,160,115,0.35) 0%, transparent 55%)',
      `linear-gradient(180deg, ${C.cremaSutil}, ${C.crema})`,
    ].join(', '),
    borderRadius: 13, padding: '16px 16px 18px', height: '100%', boxSizing: 'border-box',
    boxShadow: 'inset 0 4px 14px rgba(74,44,42,0.28), inset 0 -3px 10px rgba(74,44,42,0.22), inset 0 0 0 2px rgba(0,0,0,0.08)',
  },
  filaAccesosRapidos: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16, marginBottom: 16, alignItems: 'stretch',
  },
  filaSecundaria: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
    gap: 16, marginBottom: 16, alignItems: 'start',
  },
  // "Campo ahuecado estilo cuero oscuro" para el código de sala — mismo
  // criterio "hundido" (sombra interior en vez de relieve) que
  // `tabInactiva` de Torneos.js, en vez del input blanco liso genérico.
  inputCuero: {
    width: '100%', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16,
    letterSpacing: 1, color: '#2C160E', background: '#F3EFE0',
    // Pase 322: pergamino claro ahuecado (antes caja negra), marco fino café oscuro con sombra interna.
    border: '1.5px solid #4A2C11', borderRadius: 12, padding: '9px 11px',
    boxShadow: 'inset 0 3px 5px rgba(74,44,17,0.35), inset 2px 0 3px rgba(74,44,17,0.15)',
  },
  // Indicador "Partida esperando" — mismo criterio visual que los chips
  // de las tarjetas de sala más abajo, para anticipar de un vistazo qué
  // hace el botón de "Torneo en curso" sin tener que leer el texto.
  indicadorEsperando: {
    display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 10,
    fontSize: 12.5, fontWeight: 800, color: C.doradoOscuro, textTransform: 'uppercase',
    background: '#f5ead9', border: `1.5px solid ${C.doradoOscuro}55`, borderRadius: 8,
    padding: '4px 10px',
  },
  iconoIndicadorEsperando: { width: 15, height: 15, objectFit: 'contain' },
  // Cuadragésimo octavo pase — punto 2: bordes más finos (4→2px), radio
  // unificado (20→18, mismo valor que salaCard/modalBox más abajo), fondo
  // más sutil (crema→cremaSutil) y sombra menos marcada (6px/0.25 alpha →
  // 3px/0.15) — antes estos paneles "competían" visualmente con la mesa
  // de puntaje/mesa de juego que usan un tratamiento igual de marcado.
  // Quincuagésimo tercer pase — punto 2, continuación: textura de papel
  // sutil tileada en vez del cremaSutil llano — `backgroundColor` queda
  // como respaldo (se ve un instante mientras carga la imagen).
  // Pase de rediseño estructural: `panel` (usado antes solo por "Crear
  // sala") quedó sin uso — "Crear sala"/"Unirse con código"/"Torneo en
  // curso" ahora comparten `accesoCardExterior`/`accesoCard`. Se deja
  // `panelSecundario`/`panelCompacto`/`panelPreviewDev` porque "Preview de
  // mesa (dev)" todavía los usa.
  panelSecundario: {
    backgroundColor: C.cremaSutil,
    backgroundImage: 'url(/assets/images/textura-tarjeta.png)', backgroundRepeat: 'repeat',
    border: `2px solid ${C.chocolate}`, borderRadius: 18,
    boxShadow: '0 3px 0 rgba(0,0,0,0.15)', padding: '18px 18px 20px',
    marginBottom: 16, position: 'relative', overflow: 'hidden',
    borderTop: `4px solid ${C.dorado}`
  },
  // Variante compacta de panelSecundario, solo para "Torneo en curso" y
  // "Preview de mesa (dev)" — el punto 2 pide que estos dos se sientan
  // más secundarios/chicos frente a "Crear sala"/"Unirse con código".
  panelCompacto: {
    padding: '12px 14px 14px'
  },
  // Centésimo cuadragésimo séptimo pase: íconos ilustrados que reemplazan
  // los emojis 🃏/🔑/🔒 en los títulos de "Crear sala"/"Unirse con
  // código"/"Sala privada creada".
  // Pase siguiente: agrandados otra vez a pedido del usuario ("hay que
  // agrandarlas para que se noten un poco más los detalles").
  // Pase de rediseño estructural: "Torneo en curso" pasa a usar el mismo
  // `panelTitle`/`iconoPanelTitle` que "Crear sala"/"Unirse con código"
  // (antes la variante compacta) — las 3 tarjetas ya comparten el mismo
  // marco/proporción, así que comparten también el mismo tamaño de título.
  iconoPanelTitle: { width: 34, height: 34, objectFit: 'contain', verticalAlign: 'middle', marginRight: 5, marginBottom: 5 },
  // Nonagésimo noveno pase — "Preview de mesa (dev)" se achica más todavía
  // que panelCompacto (nunca lo ve un usuario real, así que gana espacio
  // sin afectar a "Torneo en curso", que sigue usando panelCompacto solo).
  panelPreviewDev: {
    padding: '8px 10px 10px'
  },
  panelTitlePreviewDev: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13, color: C.chocolate, marginBottom: 6 },
  panelTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 22, color: C.chocolate, marginBottom: 14 },
  hint: { fontSize: 16, color: '#7a6660', marginBottom: 12, lineHeight: 1.4 },
  // Cuadragésimo séptimo pase — punto 1 del feedback de diseño ("Jerarquía
  // y foco principal"): variantes claras de título/hint/label para usar
  // sobre el fondo verde oscuro del panel de "Jugar ya" (panelTitle/hint/
  // label normales asumen fondo crema y quedarían ilegibles ahí).
  panelTitleClaro: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 22, color: C.crema, marginBottom: 14 },
  hintClaro: { fontSize: 16, color: 'rgba(255,248,237,0.8)', marginBottom: 12, lineHeight: 1.4 },
  labelClaro: { display: 'block', fontWeight: 700, fontSize: 14, color: C.crema, marginBottom: 5, textTransform: 'uppercase' },
  field: { marginBottom: 12, flex: 1 },
  fieldRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  label: { display: 'block', fontWeight: 700, fontSize: 14, color: C.chocolate, marginBottom: 5, textTransform: 'uppercase' },
  select: {
    width: '100%', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 16,
    color: C.chocolate, background: '#fff', border: `2.5px solid ${C.chocolate}`,
    borderRadius: 12, padding: '9px 11px'
  },
  // Botones simples para elegir una opción entre varias (Modo, Puntos,
  // Tiempo por turno) — reemplaza los <select> que había antes, copiando
  // el patrón que ya usa la pantalla equivalente en nativo (chips).
  opcionesRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  opcionBtn: {
    flex: 1, minWidth: 56,
    fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 15,
    color: C.chocolate, background: '#fff', border: `2.5px solid ${C.chocolate}`,
    borderRadius: 12, padding: '9px 6px', cursor: 'pointer', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2
  },
  opcionBtnActiva: {
    background: C.dorado, boxShadow: `0 3px 0 ${C.doradoOscuro}`
  },
  opcionBtnDisabled: {
    opacity: 0.6, cursor: 'not-allowed'
  },
  // Resalta la opción de tiempo recomendada (15s) incluso cuando no está
  // seleccionada, con un borde dorado y una etiqueta chiquita abajo.
  opcionBtnRecomendada: {
    borderColor: C.doradoOscuro
  },
  // Pase de rediseño estructural: selector de modo de "Jugar ya" con
  // relieve 3D real — el inactivo pasa de un semitransparente plano a
  // "cuero oscuro hundido" (sombra interior, mismo criterio que
  // `tabInactiva` de Torneos.js) y el activo pasa a madera clara/dorado
  // con borde negro grueso y escalón duro, en vez del dorado plano con
  // solo un aro de brillo — pedido explícito: que los 3 botones "transmitan
  // la sensación de botones de juego en relieve", no una caja con bordes
  // grises simples.
  opcionBtnCompacta: {
    flex: 1, minWidth: 44,
    fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13,
    // Pase 322: madera cálida media (#8B5A2B) con relieve ahuecado suave y texto hueso (#FFFBEB).
    color: '#FFFBEB', background: '#8B5A2B',
    border: `2px solid ${C.negroPulido}`, borderRadius: 10, padding: '6px 4px', cursor: 'pointer', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
    boxShadow: 'inset 0 3px 5px rgba(74,44,17,0.55), inset 0 -1px 0 rgba(255,255,255,0.12)',
  },
  opcionBtnCompactaActiva: {
    background: `linear-gradient(160deg, ${C.doradoClaro} 0%, ${C.dorado} 100%)`, color: C.chocolate,
    border: '2px solid #000',
    boxShadow: `0 3px 0 #000, inset 0 1px 0 rgba(255,255,255,0.5)`,
  },
  badgeRecomendada: {
    fontSize: 10, fontWeight: 800, color: C.doradoOscuro, textTransform: 'uppercase',
    letterSpacing: 0.3, lineHeight: 1
  },
  // Quincuagésimo cuarto pase — reemplazan los <span>{emoji}</span> de
  // ICONOS_MODO. Alto fijo + ancho automático (así el navegador escala
  // cada ilustración a ese alto preservando su propia proporción, sea
  // cual sea).
  // Quincuagésimo quinto pase — se agrandó (18→30) a pedido del usuario,
  // que los vio muy chicos arriba del label del modo.
  // Quincuagésimo sexto pase — el usuario reportó que 2v2 y 3v3 seguían
  // viéndose chicos incluso después de agrandar: la causa era que las tres
  // ilustraciones compartían un mismo recorte/marco, y la composición de
  // 2v2/3v3 (varias figuras más chicas para entrar en el mismo lienzo
  // original) ocupaba menos alto que la de 1v1 dentro de ese marco — con
  // el alto del <img> fijo, ese margen transparente de sobra se comía
  // parte del espacio y el personaje se veía más chico. Se recortó cada
  // ilustración a su propio contenido (ver los 3 PNG) — con ancho
  // automático esto ya alcanza para que las tres llenen el alto fijo por
  // igual, sin tocar código acá.
  iconoModoCompacto: { height: 30, width: 'auto', objectFit: 'contain' },
  iconoModoSala: { height: 24, width: 'auto', objectFit: 'contain' },
  // Octogésimo pase — reemplazo del emoji ⚡ de "Jugar ya" (título y botón)
  // por el ícono de rayo dorado que pasó el usuario, mismo patrón que
  // iconoModoCompacto/iconoModoSala (altura fija, ancho auto, contain).
  iconoRayo: { height: 24, width: 'auto', objectFit: 'contain' },
  iconoRayoBoton: { height: 22, width: 'auto', objectFit: 'contain' },
  // Pase siguiente (#3): se saca el `filter: drop-shadow` del pase
  // anterior — el usuario aclaró que el ícono de la lupa ya trae su
  // propio delineado dibujado en el PNG, así que el drop-shadow extra
  // sobraba (delineado doble). El texto sí sigue con su textShadow.
  iconoLupaBoton: {
    height: 30, width: 'auto', objectFit: 'contain', verticalAlign: 'middle', marginRight: 4,
  },
  textoBtnCrimson: {
    fontSize: 19,
    textShadow: `-1.5px -1.5px 0 ${C.chocolate}, 1.5px -1.5px 0 ${C.chocolate}, -1.5px 1.5px 0 ${C.chocolate}, 1.5px 1.5px 0 ${C.chocolate}, -1.5px 0 0 ${C.chocolate}, 1.5px 0 0 ${C.chocolate}, 0 -1.5px 0 ${C.chocolate}, 0 1.5px 0 ${C.chocolate}`,
  },
  input: {
    width: '100%', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 16,
    color: C.chocolate, background: '#fff', border: `2.5px solid ${C.chocolate}`,
    borderRadius: 12, padding: '9px 11px'
  },
  checkboxRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 },
  checkbox: { width: 20, height: 20, accentColor: C.crimson },
  // Pase de rediseño estructural: pill 3D plano en vez de la caja
  // redondeada con borde chocolate de antes — mismo criterio ya aplicado
  // en Torneos.js (degradé vertical simple + contorno negro grueso +
  // sombra dura inferior). Se usa para "Unirse" (Unirse con código),
  // "✓ Crear sala"/"Crear por 1 🪙" (Crear sala), "+ Crear sala" (estado
  // vacío) y los botones del modal de sala creada.
  btnPrimary: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 17,
    background: 'linear-gradient(180deg, #FFD147 0%, #E69D00 100%)', color: C.chocolate,
    border: '2.5px solid #000', borderRadius: 999, padding: '12px 20px',
    boxShadow: '0 5px 0 #000', cursor: 'pointer'
  },
  btnSecondary: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 17,
    background: C.crema, color: C.chocolate, border: `3px solid ${C.chocolate}`,
    borderRadius: 14, padding: '12px 20px', boxShadow: '0 5px 0 rgba(74,44,42,0.35)',
    cursor: 'pointer', width: '100%'
  },
  // "+ Nueva sala" — verde esmeralda, mismo criterio que `btnNuevoTorneo`
  // de Torneos.js (antes reusaba `btnSecondary`, neutro/crema — el pedido
  // explícito es que sea un botón 3D de acción, no una caja neutra).
  btnNuevaSala: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 17, color: '#fff', textShadow: CONTORNO_TEXTO,
    background: 'linear-gradient(180deg, #2ECC71 0%, #179B4A 100%)',
    border: '2.5px solid #000', borderRadius: 999, padding: '12px 20px',
    boxShadow: '0 5px 0 #000', cursor: 'pointer', width: '100%',
    textAlign: 'center', display: 'block', marginLeft: 'auto', marginRight: 'auto'
  },
  btnCrimson: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 17,
    background: 'linear-gradient(180deg, #F0584A 0%, #c2352a 100%)', color: '#fff',
    border: '2.5px solid #000', borderRadius: 999, padding: '12px 20px',
    boxShadow: '0 5px 0 #000', cursor: 'pointer', width: '100%'
  },
  // Pase de rediseño estructural: "Jugar ya" — el CTA principal de la
  // pantalla — pasa a vivir dentro de una placa de madera de caoba (marco
  // biselado oscuro + remaches de bronce, mismo criterio que
  // `destacadoPanelExterior` de Torneos.js) en vez de flotar suelta con
  // un simple borde chocolate fino.
  panelJugarYaExterior: {
    position: 'relative',
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.negroPulido}`, borderRadius: 22, padding: 10,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -4px 10px rgba(0,0,0,0.5)',
      `0 8px 0 ${C.negroPulido}`,
      '0 16px 26px rgba(0,0,0,0.4)',
    ].join(', '),
  },
  // Cuadragésimo séptimo pase — punto 1 del feedback de diseño: fondo
  // verde oscuro→medio (en vez del mismo crema que todos los otros
  // paneles) para que "Jugar ya" se distinga como la acción principal de
  // la pantalla a simple vista, no solo por un filete de color arriba.
  // Quincuagésimo cuarto pase — el gradiente liso se reemplazó por la
  // placa verde con brillo radial que pasó el usuario, recortada para
  // usarse como imagen de fondo (cover). El velo oscuro encima asegura
  // contraste para panelTitleClaro/hintClaro sea cual sea la zona más
  // clara de la imagen (mismo criterio que el overlay del fondo general
  // del lobby, ver .ts-shell en AppShell.js).
  panelJugarYa: {
  backgroundImage: 'linear-gradient(rgba(20,20,15,0.3), rgba(20,20,15,0.3)), url(/assets/images/jugar-ya-fondo.jpg)',
  backgroundSize: 'cover', backgroundPosition: 'center',
  backgroundColor: C.verdeOscuro,
  // Pase de rediseño estructural: ahora es el interior DENTRO del marco
  // de madera de arriba, con su propio bisel "hundido" (mismo criterio
  // que `interiorFieltro` de Historial.js) en vez de un borde/sombra
  // propios que competían con el marco nuevo.
  borderRadius: 14,
  boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.45)', padding: '18px 18px 20px',
  position: 'relative', overflow: 'hidden'
},
// Pasa de celeste a dorado (mismo color que "Crear sala"/"Unirse con
// código") para que el rol de color quede consistente: dorado = CTA
// principal, celeste queda libre para acciones neutras (ver "Unirse"
// dentro de cada tarjeta de sala). Pase de rediseño estructural: pill
// completo (antes `borderRadius:14`, una caja redondeada no una píldora)
// con contorno negro (antes chocolate) — mismo criterio 3D que el resto
// de los botones grandes de la app — manteniendo el brillo/glow dorado
// que ya tenía.
btnJugarYa: {
  fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 20,
  background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
  border: '3px solid #000', borderRadius: 999, padding: '16px 20px',
  boxShadow: '0 6px 0 #000, 0 0 22px rgba(255,182,39,0.55)',
  cursor: 'pointer', width: '100%'
},
  // Quincuagésimo séptimo pase — punto 5: título reforzado (18.5→19.5 +
  // ícono propio, antes era el único título de sección sin emoji) y con
  // un separador tenue debajo para que corte mejor contra la grilla de
  // paneles de arriba.
  sectionTitle: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 19.5, color: C.crema,
    margin: '4px 0 12px 4px', paddingBottom: 8, borderBottom: '2px solid rgba(255,248,237,0.22)'
  },
  // Pase de rediseño estructural: "Salas disponibles" pasa a vivir dentro
  // de una placa de madera alargada tipo "tablero de anuncios de
  // pulpería" — exterior de madera con remaches (mismo criterio que
  // `panelExterior` de Torneos.js) envolviendo un interior de fieltro
  // verde (mismo criterio que `cuerpo`/`interiorFieltro` de ChatGlobal.js/
  // Historial.js), para que las tarjetas de sala se lean como avisos
  // clavados en el tablero en vez de flotar sueltas sobre el fondo verde
  // general de toda la pantalla.
  tableroExterior: {
    position: 'relative',
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.negroPulido}`, borderRadius: 22, padding: 10,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -4px 10px rgba(0,0,0,0.5)',
      `0 8px 0 ${C.negroPulido}`,
      '0 16px 26px rgba(0,0,0,0.4)',
    ].join(', '),
  },
  tableroInterior: {
    background: `linear-gradient(180deg, ${C.verdeProfundo}, ${C.verdeOscuro})`,
    borderRadius: 14, padding: '16px 16px 18px',
    boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(0,0,0,0.22)',
  },
  // Quincuagésimo séptimo pase — punto 5 (superado por el pase de
  // rediseño estructural siguiente): estado vacío de "Salas disponibles"
  // — pasa de un marco punteado plano a una placa de pergamino sólida
  // (ya no hace falta el punteado para diferenciarla de las tarjetas de
  // sala reales: ahora vive sobre el fieltro del tablero, que ya la
  // distingue por sí solo) con el personaje chibi en vez del ícono del
  // libro (que además ya se usa como ícono de "Crear sala" arriba).
  emptyState: {
    backgroundColor: C.cremaSutil,
    backgroundImage: 'url(/assets/images/textura-tarjeta.png)', backgroundRepeat: 'repeat',
    border: `2px solid ${C.negroPulido}`, borderRadius: 18,
    boxShadow: 'inset 0 0 0 1px rgba(26,20,16,0.12), 0 4px 0 rgba(0,0,0,0.25)',
    padding: '28px 20px 22px', textAlign: 'center',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6
  },
  emptyStateIcono: { fontSize: 42, lineHeight: 1 },
  emptyStatePersonaje: { width: 110, height: 'auto', objectFit: 'contain', marginBottom: 2 },
  emptyStateTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 19, color: C.chocolate },
  emptyStateTexto: { fontSize: 14.5, color: '#7a6660', fontWeight: 700, maxWidth: 380, lineHeight: 1.4, marginBottom: 8 },
  // Pase de rediseño estructural: "placa nameplate" de 2 tonos (mismo
  // criterio que `torneoCardExterior`/`torneoCard` de Torneos.js —
  // exterior de madera, interior de pergamino — a escala chica y sin
  // remaches, para que no se sienta recargado repetido en toda una
  // grilla) en vez del pergamino de un solo tono que tenía antes.
  salaCardExterior: {
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `2px solid ${C.negroPulido}`, borderRadius: 16,
    padding: 6, marginBottom: 10,
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.10)',
      'inset 0 -3px 7px rgba(0,0,0,0.4)',
      `0 4px 0 ${C.negroPulido}`,
      '0 6px 10px rgba(0,0,0,0.25)',
    ].join(', '),
  },
  salaCard: {
    backgroundColor: C.cremaSutil,
    backgroundImage: 'url(/assets/images/textura-tarjeta.png)', backgroundRepeat: 'repeat',
    border: `1.5px solid rgba(26,20,16,0.35)`, borderRadius: 11,
    padding: '12px 14px',
    boxShadow: 'inset 0 0 0 1px rgba(26,20,16,0.12)',
  },
  salaHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  salaNombre: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 17, color: C.chocolate },
  // Pase de rediseño estructural: badges 3D con contorno negro y
  // degradé (mismo criterio que `badgeAbierta`/`badgeCurso` de
  // Torneos.js) en vez del pill pastel plano de antes.
  badge: {
    fontSize: 12.5, fontWeight: 800, padding: '3px 10px', borderRadius: 12,
    textTransform: 'uppercase', border: `1.5px solid ${C.negroPulido}`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  badgeAbierta: {
    background: 'linear-gradient(180deg, #5EE87A, #2FBD52)', color: '#fff',
    boxShadow: '0 2px 0 #1a6b2e, inset 0 1px 0 rgba(255,255,255,0.5)', textShadow: '-1px -1px 0 #2C160E, 1px -1px 0 #2C160E, -1px 1px 0 #2C160E, 1px 1px 0 #2C160E, 0px -1px 0 #2C160E, 0px 1px 0 #2C160E, -1px 0px 0 #2C160E, 1px 0px 0 #2C160E',
  },
  badgeCompleta: {
    background: 'linear-gradient(180deg, #f0584a, #c2352a)', color: '#fff',
    boxShadow: '0 2px 0 #7a1f17, inset 0 1px 0 rgba(255,255,255,0.35)', textShadow: '-1px -1px 0 #2C160E, 1px -1px 0 #2C160E, -1px 1px 0 #2C160E, 1px 1px 0 #2C160E, 0px -1px 0 #2C160E, 0px 1px 0 #2C160E, -1px 0px 0 #2C160E, 1px 0px 0 #2C160E',
  },
  salaInfo: { fontSize: 14.5, color: '#7a6660', fontWeight: 700, marginBottom: 10 },
  // "Unirse" — verde esmeralda 3D, mismo criterio "verde = avanzar/unirse"
  // que ya usa Torneos.js (antes celeste, color que queda libre para
  // futuras acciones neutras).
  btnCard: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 15, color: '#fff', textShadow: CONTORNO_TEXTO,
    background: 'linear-gradient(180deg, #2ECC71 0%, #179B4A 100%)', border: '2px solid #000',
    borderRadius: 12, padding: '7px 14px', boxShadow: '0 3px 0 #000', cursor: 'pointer'
  },
  btnCardDisabled: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 15,
    background: '#ccc', color: '#888', border: '2px solid #999',
    borderRadius: 12, padding: '7px 14px', cursor: 'not-allowed'
  },
  // Nonagésimo noveno pase — versión chica de btnCard, solo para los
  // botones 1v1/2v2/3v3 de "Preview de mesa (dev)".
  btnCardChico: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 12,
    background: C.celeste, color: C.chocolate, border: `2px solid ${C.chocolate}`,
    borderRadius: 8, padding: '4px 10px', boxShadow: '0 2px 0 #3a91c2', cursor: 'pointer'
  },
  modalOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000
  },
  modalBox: {
    position: 'relative',
    backgroundColor: C.cremaSutil,
    backgroundImage: 'url(/assets/images/textura-tarjeta.png)', backgroundRepeat: 'repeat',
    border: `2px solid ${C.chocolate}`, borderRadius: 18,
    boxShadow: '0 5px 0 rgba(0,0,0,0.2)', padding: 22, width: '85%', maxWidth: 360,
    textAlign: 'center'
  },
  // Pase siguiente: botón de cerrar en X, esquina superior derecha del
  // modal de "Sala creada" — reemplaza el link de texto "Cerrar (no
  // entrar todavía)" que estaba al pie, pedido explícito del usuario.
  btnCerrarX: {
    position: 'absolute', top: 10, right: 10,
    width: 30, height: 30, borderRadius: '50%',
    border: `2px solid ${C.chocolate}`, background: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 700, color: C.chocolate,
    cursor: 'pointer', lineHeight: 1, padding: 0,
  },
  codigoBox: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 32,
    letterSpacing: 3, color: C.doradoOscuro, background: '#fff',
    border: `3px dashed ${C.doradoOscuro}`, borderRadius: 14, padding: '14px 10px',
    marginBottom: 14
  },
  featuresRow: { display: 'flex', gap: 8, marginBottom: 14 },
  featureCard: {
    flex: 1, background: '#fff', border: `2px solid ${C.chocolate}`,
    borderRadius: 12, padding: '10px 6px', textAlign: 'center'
  },
  featureCardDisabled: {
    flex: 1, background: '#f5ead9', border: `2px solid ${C.chocolate}55`,
    borderRadius: 12, padding: '10px 6px', textAlign: 'center', opacity: 0.7
  },
  featureIcon: { fontSize: 23, display: 'block', marginBottom: 4 },
  featureLabel: { fontSize: 11.5, fontWeight: 700, color: C.chocolate, lineHeight: 1.2, display: 'block' },
  featureBadge: {
    fontSize: 9, fontWeight: 800, color: '#fff', background: C.crimson,
    borderRadius: 20, padding: '1px 7px', marginTop: 4, display: 'inline-block',
    textTransform: 'uppercase', letterSpacing: 0.3
  },
  salaTitulo: { display: 'flex', alignItems: 'center', gap: 6 },
  chipsFila: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  chip: {
    fontSize: 13, fontWeight: 700, color: C.chocolate,
    background: '#f5ead9', border: `1.5px solid ${C.chocolate}33`,
    borderRadius: 8, padding: '3px 8px'
  },
  salaCreador: { fontSize: 13, color: '#7a6660', fontWeight: 700, marginBottom: 10 },
  salasGrid: {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 12,
},
};