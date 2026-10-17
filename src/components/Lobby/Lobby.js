import React, { useState, useEffect, useCallback, useRef } from 'react';
import MisionesCard from './MisionesCard';
import MonedaGirando from '../MonedaGirando';
import PerfilRivalModal from '../PerfilRival/PerfilRivalModal';
import PantallaCarga from '../PantallaCarga/PantallaCarga';
import PopupMadera from '../Popup/PopupMadera';
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

// Pase 515: "Mates Gratis". Los chips son siglas de color (no se dibujan logos de marca). Con `url` vacía el botón queda en "Próximamente".
// El reclamo necesita el endpoint POST /api/recompensas-sociales/reclamar, que todavía no existe: se mantiene apagado.
// Pase 517: +25 mates por red y +75 por las tres (solo lo que se muestra; el monto real lo decide el backend).
const RECOMPENSA_SOCIAL = 25;
const RECOMPENSA_SOCIAL_TOTAL = 75;
const REDES_SOCIALES = [
  { id: 'discord', nombre: 'Discord', sigla: 'DC', color: '#5865F2', url: '', icono: '/assets/images/icon_discord_wood.png' },
  { id: 'instagram', nombre: 'Instagram', sigla: 'IG', color: '#E1306C', url: '', icono: '/assets/images/icon_instagram_wood.png' },
  { id: 'facebook', nombre: 'Facebook', sigla: 'FB', color: '#1877F2', url: '', icono: '/assets/images/icon_facebook_wood.png' },
];
const RECLAMO_SOCIAL_ACTIVO = false;
// Pase 518: pegá en `REDES_SOCIALES[].url` los links oficiales; con `url` el botón dice "Seguir" y abre con window.open(_blank), sin `url` queda en "Próximamente".

// Pase 517: "+25" junto a la moneda dorada del juego (reemplaza al emoji 🧉).
function MontoMonedas({ monto, tam = 20, style }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, ...style }}>
      {`+${monto}`}
      <MonedaGirando tam={tam} />
    </span>
  );
}

// Pase 515: hoja (capa) sobre el lobby; se cierra con la X, con Escape o tocando el fondo.
// Pase 516: con `variante="redes"` la hoja usa la placa de madera oscura con ribete bronce, remaches y X roja flotante.
function Hoja({ titulo, onCerrar, children, variante }) {
  const esRedes = variante === 'redes';
  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', alTeclear);
    return () => window.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);
  return (
    <div style={{ ...estilos.hojaCapa, ...(esRedes ? estilos.redesCapa : {}) }} onClick={onCerrar} role="dialog" aria-modal="true" aria-label={titulo}>
      <div style={{ ...estilos.hojaCaja, ...(esRedes ? estilos.redesPlaca : {}) }} onClick={(e) => e.stopPropagation()}>
        {esRedes && (
          <>
            <span aria-hidden="true" style={{ ...estilos.redesRemache, top: 8, left: 8 }} />
            <span aria-hidden="true" style={{ ...estilos.redesRemache, bottom: 8, left: 8 }} />
            <span aria-hidden="true" style={{ ...estilos.redesRemache, bottom: 8, right: 8 }} />
          </>
        )}
        <div style={{ ...estilos.hojaCabecera, ...(esRedes ? estilos.redesCabecera : {}) }}>
          <span style={{ ...estilos.hojaTitulo, ...(esRedes ? estilos.redesTitulo : {}) }}>{titulo}</span>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={esRedes ? estilos.redesCerrar : estilos.hojaCerrar}>✕</button>
        </div>
        <div style={{ ...estilos.hojaCuerpo, ...(esRedes ? { padding: 20, position: 'relative' } : {}) }}>{children}</div>
      </div>
    </div>
  );
}

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
export default function Lobby({ token, usuario, onPersonajeCambiado, onEntrarAPartida, onBuscarPartidaActiva, onMisionReclamada, onIrARanked, onIrAnotador, codigoInicial, bannerTexto, onBannerClick }) {
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
  // Pase 515: hoja abierta sobre el lobby ('sala' = Crear / Unirse, 'misiones', 'redes'), resumen de misiones y estado de "Mates Gratis".
  const [hoja, setHoja] = useState(null);
  const [resumenMisiones, setResumenMisiones] = useState(null);
  const [redesAbiertas, setRedesAbiertas] = useState({});
  const [reclamandoRed, setReclamandoRed] = useState(null);
  const [avisoRedes, setAvisoRedes] = useState('');
  const irACrearSala = () => {
    setCreandoSala(true);
    setHoja('sala');
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

  // Pase 515: resumen de misiones (completadas / total) para la barra de progreso de la tarjeta; se recarga al abrir el lobby y al cerrar cualquier hoja.
  useEffect(() => {
    if (hoja || !token) return undefined;
    let activo = true;
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/misiones`, { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (activo && res.ok && Array.isArray(data?.misiones)) {
          setResumenMisiones({ completadas: data.misiones.filter((m) => m.completada).length, total: data.misiones.length });
        }
      } catch (err) {
        console.error('Error cargando el resumen de misiones:', err);
      }
    })();
    return () => { activo = false; };
  }, [hoja, token]);

  const seguirRed = (red) => {
    if (!red.url) return;
    window.open(red.url, '_blank', 'noopener,noreferrer');
    setRedesAbiertas((prev) => ({ ...prev, [red.id]: true }));
  };

  const reclamarRed = async (red) => {
    if (!RECLAMO_SOCIAL_ACTIVO) return;
    setReclamandoRed(red.id);
    setAvisoRedes('');
    try {
      const res = await fetch(`${BASE_URL}/api/recompensas-sociales/reclamar`, { method: 'POST', headers, body: JSON.stringify({ red: red.id }) });
      const data = await res.json();
      setAvisoRedes(res.ok ? `¡Listo! +${RECOMPENSA_SOCIAL}` : (data?.error || 'No se pudo reclamar el premio'));
      if (res.ok) onMisionReclamada?.();
    } catch (err) {
      setAvisoRedes('No se pudo conectar con el servidor');
    } finally {
      setReclamandoRed(null);
    }
  };

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
      setHoja(null);   // Pase 515: el pop-up del código sale encima del lobby

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

      {/* Pase 515: LOBBY COMPACTO (mismo esquema que el nativo). Arriba "Jugar ya"; abajo una grilla de tarjetas texturizadas; "Crear / Unirse",
          "Misiones" y "Mates Gratis" abren una hoja sobre la pantalla; las salas viven en un zócalo de alto fijo (130 px) con scroll interno.
          El banner "¡Hay un torneo abierto!" se quitó: el aviso pasa al subtítulo de la tarjeta Torneos. */}
      <div style={estilos.lobbyWeb}>
          <div style={{ ...estilos.panelJugarYaExterior, margin: '0 auto 20px', maxWidth: 560 }}>
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

        <div style={estilos.gridModulos}>
          {onIrARanked && (() => {
            const r = usuario?.rango;
            const ui = rangoUi(r);
            const titulo = r ? (r.esTop500 ? r.nombre : `${r.nombre} ${r.division}`) : null;
            return (
              <button type="button" onClick={onIrARanked} aria-label="Liga Criolla" style={{ ...estilos.tarjetaModulo, ...estilos.fondoLiga }}>
                <span style={estilos.tarjetaBisel} aria-hidden="true" />
                <img src={ui.logo} alt="" style={estilos.tarjetaIcono} />
                <span style={estilos.tarjetaTextos}>
                  <span style={{ ...estilos.tarjetaTitulo, color: '#FFD700' }}>Liga Criolla</span>
                  {titulo
                    ? <span style={estilos.ligaPastilla}><span style={{ color: '#FFD700', fontWeight: 800 }}>{titulo}</span>{` · ${r.puntos} pts`}</span>
                    : <span style={estilos.tarjetaSub}>Competí y subí de rango</span>}
                </span>
              </button>
            );
          })()}
          <button type="button" onClick={onBannerClick} aria-label="Torneos" style={{ ...estilos.tarjetaModulo, ...estilos.fondoTorneos }}>
            <span style={estilos.tarjetaBisel} aria-hidden="true" />
            {['top-left', 'top-right', 'bottom-left', 'bottom-right'].map((pos) => (
              <span key={pos} aria-hidden="true" style={{ ...estilos.tachuelaMini, [pos.startsWith('top') ? 'top' : 'bottom']: 5, [pos.endsWith('left') ? 'left' : 'right']: 5 }} />
            ))}
            <span style={estilos.trofeoCaja}>
              <span style={estilos.trofeoResplandor} aria-hidden="true" />
              <img src="/assets/images/trofeo.png" alt="" style={estilos.trofeoImg} />
            </span>
            <span style={estilos.tarjetaTextos}>
              <span style={estilos.tarjetaTitulo}>Torneos</span>
              <span style={{ ...estilos.tarjetaSub, color: '#E2C280' }}>{bannerTexto ? '¡Hay un torneo abierto! Anotate' : 'Campeonatos y premios'}</span>
            </span>
          </button>
          <button type="button" onClick={() => setHoja('misiones')} aria-label="Misiones semanales" style={{ ...estilos.tarjetaModulo, ...estilos.fondoMisiones }}>
            <span style={estilos.tarjetaBisel} aria-hidden="true" />
            <img src="/assets/images/icono-desafios.png" alt="" style={estilos.tarjetaIcono} />
            <span style={estilos.tarjetaTextos}>
              <span style={{ ...estilos.tarjetaTitulo, color: '#3B1F0E' }}>Misiones semanales</span>
              <span style={{ ...estilos.tarjetaSub, color: '#6B4A34' }}>Reclamá monedas</span>
              <span style={estilos.misionesBarraFila}>
                <span style={estilos.misionesBarraPista}>
                  <span style={{ ...estilos.misionesBarraRelleno, width: `${resumenMisiones && resumenMisiones.total > 0 ? Math.round((resumenMisiones.completadas / resumenMisiones.total) * 100) : 0}%` }} />
                </span>
                <span style={estilos.misionesBarraTexto}>{resumenMisiones ? `${resumenMisiones.completadas}/${resumenMisiones.total}` : '–/–'}</span>
              </span>
            </span>
          </button>
          {onIrAnotador && (
            <button type="button" onClick={onIrAnotador} aria-label="Abrir el Anotador Criollo" style={{ ...estilos.tarjetaModulo, ...estilos.fondoAnotador }}>
              <span style={estilos.tarjetaBisel} aria-hidden="true" />
              <img src="/assets/images/icono-anotador.png" alt="" style={estilos.tarjetaIconoGrande} />
              <span style={estilos.tarjetaTextos}>
                <span style={estilos.tarjetaTitulo}>Anotador Criollo</span>
                <span style={estilos.tarjetaSub}>Sin conexión</span>
              </span>
              <span style={{ ...estilos.etiquetaTarjeta, background: 'rgba(200,225,190,0.2)' }}>Modo Off-line / Mesa Real</span>
            </button>
          )}
          <button type="button" onClick={() => setHoja('sala')} aria-label="Crear o unirse a una sala" style={{ ...estilos.tarjetaModulo, ...estilos.fondoCrear }}>
            <span style={estilos.tarjetaBisel} aria-hidden="true" />
            <img src="/assets/images/icono-crear-sala.png" alt="" style={{ ...estilos.tarjetaIconoGrande, transform: 'rotate(5deg)' }} />
            <span style={estilos.tarjetaTextos}>
              <span style={estilos.tarjetaTitulo}>Crear / Unirse</span>
              <span style={estilos.tarjetaSub}>A una sala</span>
            </span>
            <span style={{ ...estilos.etiquetaTarjeta, background: 'rgba(240,217,160,0.18)' }}>Mesas con Clave</span>
          </button>
          <button type="button" onClick={() => { setAvisoRedes(''); setHoja('redes'); }} aria-label={`Mates gratis. Seguinos en redes y ganá hasta ${RECOMPENSA_SOCIAL_TOTAL} mates`} style={{ ...estilos.tarjetaModulo, ...estilos.fondoSocial, gridColumn: '1 / -1' }}>
            <span style={estilos.tarjetaBisel} aria-hidden="true" />
            <img src="/assets/images/regalo.png" alt="" style={estilos.tarjetaIcono} />
            <span style={estilos.tarjetaTextos}>
              <span style={estilos.tarjetaTitulo}>Mates Gratis</span>
              <span style={estilos.tarjetaSub}>Seguinos en redes</span>
            </span>
            <span style={estilos.socialChips} aria-hidden="true">
              {REDES_SOCIALES.map((red) => (
                <img key={red.id} src={red.icono} alt="" width={28} height={28} style={estilos.socialChipImg} />
              ))}
            </span>
            <span style={estilos.socialBadge}><MontoMonedas monto={RECOMPENSA_SOCIAL_TOTAL} tam={16} /></span>
          </button>
        </div>

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

        {/* Zócalo de salas: alto fijo de 130 px (la lista scrollea por dentro), así que crear o borrar salas no mueve nada de lo de arriba. */}
        <div style={estilos.zocaloExterior}>
          <div style={estilos.zocaloCabecera}>
            <span style={estilos.zocaloTitulo}>🎲 Salas disponibles</span>
            <span style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={onBuscarPartidaActiva} style={estilos.zocaloBoton}>Mi partida</button>
              <button type="button" onClick={irACrearSala} style={estilos.zocaloBotonOro}>+ Crear sala</button>
            </span>
          </div>
          <div style={estilos.zocaloLista}>
            {cargando ? (
              <PantallaCarga completa={false} conLogo={false} />
            ) : salas.length === 0 ? (
              <div style={estilos.zocaloVacio}>
                <img src="/assets/images/mision-gaucho.png" alt="" style={estilos.zocaloVacioImg} />
                <span>Todavía no hay salas abiertas. ¡Armá la primera mesa!</span>
              </div>
            ) : (
              salas.map((sala) => {
                const completa = sala.jugadores_count >= sala.jugadores_totales;
                const iconoModoSrc = ICONOS_MODO[sala.modo];
                return (
                  <div key={sala.id} style={estilos.salaFila}>
                    {iconoModoSrc ? <img src={iconoModoSrc} alt="" style={estilos.salaFilaIcono} /> : <span style={{ fontSize: 20 }}>🃏</span>}
                    <span style={estilos.salaFilaCodigo}>{sala.codigo}</span>
                    <span style={estilos.salaFilaChips}>
                      <span style={estilos.chip}>👥 {sala.jugadores_count}/{sala.jugadores_totales}</span>
                      <span style={estilos.chip}>🎯 {sala.puntos_para_ganar} pts</span>
                      {sala.tiempo_por_turno && <span style={estilos.chip}>⏱ {sala.tiempo_por_turno}s</span>}
                    </span>
                    <span
                      style={{ ...estilos.salaFilaCreador, cursor: sala.creador_nombre ? 'pointer' : 'default' }}
                      onClick={() => sala.creador_nombre && setPerfilAbierto(sala.creador_nombre)}
                    >
                      {sala.creador_nombre ? `de ${sala.creador_nombre}` : ''}
                    </span>
                    <button onClick={() => handleUnirse(sala.codigo)} disabled={completa} style={completa ? estilos.btnCardDisabled : { ...estilos.btnCard, width: 'auto', padding: '6px 16px' }}>
                      {completa ? 'Completa' : 'Unirse'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {hoja === 'sala' && (
        <Hoja titulo="Crear / Unirse a sala" onCerrar={() => setHoja(null)}>
          <div style={estilos.hojaGrid}>
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
                  (no aparece en el listado, cuesta 1 <MonedaGirando tam={16} style={{ verticalAlign: 'middle' }} />)
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
                {privada ? (
                  // Pase 435: el emoji 🪙 del costo pasa a ser la moneda real girando.
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    Crear por 1 <MonedaGirando tam={20} />
                  </span>
                ) : '✓ Crear sala'}
              </button>
              <button type="button" onClick={() => setCreandoSala(false)} style={{ ...estilos.btnSecondary, width: 'auto', padding: '12px 20px' }}>✕</button>
            </div>
          </form>
        )}
        </div>
      </div>

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

          </div>
        </Hoja>
      )}

      {hoja === 'misiones' && (
        <Hoja titulo="Misiones semanales" onCerrar={() => setHoja(null)}>
          <MisionesCard token={token} personaje={usuario?.personaje} onMisionReclamada={onMisionReclamada} />
        </Hoja>
      )}

      {hoja === 'redes' && (
        <Hoja titulo="Mates Gratis" variante="redes" onCerrar={() => setHoja(null)}>
          <div style={estilos.redesCaja}>
            {!!error && <p role="alert" style={estilos.redesAviso}>{error}</p>}
            <p style={estilos.redesTexto}>Seguí las 3 redes y ganá <MontoMonedas monto={RECOMPENSA_SOCIAL_TOTAL} tam={22} style={{ verticalAlign: 'middle', color: '#FFD668' }} /></p>
            {REDES_SOCIALES.map((red) => {
              const abierta = !!redesAbiertas[red.id];
              return (
                <div key={red.id} style={estilos.redesFila}>
                  <img src={red.icono} alt={red.nombre} width={48} height={48} style={estilos.redesChipImg} />
                  <span style={{ ...estilos.redesNombre, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {red.nombre}
                    <MontoMonedas monto={RECOMPENSA_SOCIAL} tam={16} style={estilos.redesMonto} />
                  </span>
                  {!red.url ? (
                    <span style={{ ...estilos.redesBoton, ...estilos.redesBotonOff }}>Próximamente</span>
                  ) : abierta && RECLAMO_SOCIAL_ACTIVO ? (
                    <button type="button" onClick={() => reclamarRed(red)} style={{ ...estilos.redesBoton, ...estilos.redesBotonOro }}>
                      {reclamandoRed === red.id ? 'Reclamando…' : (<span style={estilos.redesBotonFila}>Reclamar <MontoMonedas monto={RECOMPENSA_SOCIAL} tam={16} /></span>)}
                    </button>
                  ) : (
                    <button type="button" onClick={() => seguirRed(red)} style={{ ...estilos.redesBoton, ...estilos.redesBotonOro }}><span style={estilos.redesBotonFila}>Seguir <MontoMonedas monto={RECOMPENSA_SOCIAL} tam={16} /></span></button>
                  )}
                </div>
              );
            })}
            {!RECLAMO_SOCIAL_ACTIVO && <p style={estilos.redesNota}>{`Los +${RECOMPENSA_SOCIAL} mates se sumarán solos en la próxima actualización.`}</p>}
            {!!avisoRedes && (
              <p role="status" style={{ ...estilos.redesAviso, ...(avisoRedes.startsWith('¡Listo') ? estilos.redesAvisoOk : {}) }}>
                {avisoRedes} {avisoRedes.startsWith('¡Listo') && <MonedaGirando tam={18} style={{ verticalAlign: 'middle' }} />}
              </p>
            )}
          </div>
        </Hoja>
      )}

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
  // ===== Pase 515: lobby compacto =====
  lobbyWeb: { maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column' },
  gridModulos: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14, marginBottom: 16 },
  tarjetaModulo: {
    position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
    height: 104, boxSizing: 'border-box', padding: '10px 14px 10px', borderRadius: 16, cursor: 'pointer',
    boxShadow: '0 4px 5px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.12)', fontFamily: "'Fredoka', sans-serif",
  },
  tarjetaBisel: { position: 'absolute', inset: 2, borderRadius: 13, border: '1.2px solid rgba(212,175,55,0.5)', pointerEvents: 'none' },
  tarjetaIcono: { width: 56, height: 56, objectFit: 'contain', flex: '0 0 auto' },
  tarjetaIconoGrande: { width: 60, height: 60, objectFit: 'contain', flex: '0 0 auto', marginBottom: 14 },
  tarjetaTextos: { display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 },
  tarjetaTitulo: { fontWeight: 700, fontSize: 18, color: '#FFF8E7', textShadow: '1px 1.5px 2px rgba(0,0,0,0.5)', lineHeight: 1.15 },
  tarjetaSub: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13.5, color: '#E0D0B0', lineHeight: 1.2 },
  etiquetaTarjeta: { position: 'absolute', left: 10, right: 10, bottom: 7, height: 17, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 11, color: '#E8EFD8' },
  // Fondos texturizados (cuero borgoña, terciopelo carmesí, pergamino/corcho, paño verde, roble, azul noche)
  fondoLiga: {
    border: '2px solid #8C6239',
    background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.035) 0 2px, transparent 2px 7px), linear-gradient(160deg, #3B1A12, #250E08)',
  },
  fondoTorneos: {
    border: '2px solid #6E4B28',
    background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 6px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.12) 0 1px, transparent 1px 6px), linear-gradient(160deg, #4A0E17, #2B070D)',
  },
  fondoMisiones: {
    border: '4px solid #6E4B28',
    background: 'radial-gradient(rgba(138,90,43,0.2) 1px, transparent 1.6px) 0 0 / 11px 11px, radial-gradient(ellipse at 18% 20%, rgba(255,246,223,0.7), transparent 55%), linear-gradient(135deg, #F6ECCF, #EFE3C3 55%, #DCC79B)',
  },
  fondoAnotador: {
    border: '2px solid #5C3D21',
    background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.05) 0 1px, transparent 1px 6px), repeating-linear-gradient(-45deg, rgba(0,0,0,0.1) 0 1px, transparent 1px 6px), linear-gradient(160deg, #38593D, #2D4A32 55%, #213823)',
  },
  fondoCrear: {
    border: '2px solid #C08A3E',
    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.14) 0 1px, transparent 1px 9px), linear-gradient(160deg, #5D4037, #4E342E 55%, #3A2520)',
  },
  fondoSocial: {
    border: '2px solid #FFD700', height: 76,
    background: 'repeating-linear-gradient(45deg, rgba(255,255,255,0.04) 0 1px, transparent 1px 6px), linear-gradient(160deg, #2A1B40, #231635 55%, #1B1028)',
  },
  ligaPastilla: { alignSelf: 'flex-start', maxWidth: '100%', background: 'rgba(255,235,205,0.15)', borderRadius: 8, padding: '2px 8px', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, color: '#E0D0B0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  tachuelaMini: { position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: '#B9853F', border: '0.5px solid #6E4B28' },
  trofeoCaja: { position: 'relative', width: 44, height: 44, flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  trofeoResplandor: { position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(255,215,0,0.16)', boxShadow: '0 0 6px 2px rgba(255,215,0,0.55)' },
  trofeoImg: { position: 'relative', width: 44, height: 44, objectFit: 'contain' },
  misionesBarraFila: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 },
  misionesBarraPista: { flex: 1, height: 9, borderRadius: 5, background: 'rgba(110,75,40,0.22)', border: '1px solid #6E4B28', overflow: 'hidden', display: 'block' },
  misionesBarraRelleno: { display: 'block', height: '100%', background: '#5E8C3A' },
  misionesBarraTexto: { fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12.5, color: '#3B1F0E' },
  socialChips: { display: 'flex', gap: 6, flex: '0 0 auto', marginRight: 84 },
  socialChip: { width: 28, height: 28, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: '1.5px solid rgba(255,255,255,0.7)', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 11, color: '#fff' },
  socialChipImg: { width: 28, height: 28, display: 'block' },
  redesChipImg: { width: 48, height: 48, flexShrink: 0, display: 'block' },
  redesMonto: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 13, color: '#FFD668' },
  redesBotonFila: { display: 'inline-flex', alignItems: 'center', gap: 5 },
  socialBadge: { position: 'absolute', top: 5, right: 12, background: '#FFD700', border: '1px solid #FFF3A0', borderRadius: 9, padding: '0 9px', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14, color: '#3B1F0E', display: 'inline-flex', alignItems: 'center' },
  // Zócalo de salas (alto fijo 130 px en la lista)
  zocaloExterior: {
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.negroPulido}`, borderRadius: 18, padding: 8,
    boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.10), inset 0 -4px 10px rgba(0,0,0,0.5), 0 6px 0 #1a1410, 0 12px 20px rgba(0,0,0,0.35)',
  },
  zocaloCabecera: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', padding: '2px 6px 8px' },
  zocaloTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 18, color: '#FFD668' },
  zocaloBoton: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13.5, color: '#FFF8E7', background: 'rgba(0,0,0,0.3)', border: '1.5px solid #8C6239', borderRadius: 999, padding: '5px 14px', cursor: 'pointer' },
  zocaloBotonOro: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 13.5, color: '#3B1F0E', background: '#FFB300', border: '2px solid #A66F00', borderRadius: 999, padding: '4px 14px', cursor: 'pointer' },
  zocaloLista: { height: 130, overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 6, padding: 8, borderRadius: 12, background: `linear-gradient(180deg, ${C.verdeProfundo}, ${C.verdeOscuro})`, boxShadow: 'inset 0 3px 10px rgba(0,0,0,0.55)' },
  zocaloVacio: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#FFF8ED', fontWeight: 700, fontSize: 14.5, textAlign: 'center' },
  zocaloVacioImg: { height: 84, width: 'auto', objectFit: 'contain' },
  salaFila: { flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: C.cremaSutil, border: `2px solid ${C.negroPulido}`, borderRadius: 12, padding: '5px 10px', minHeight: 40, boxSizing: 'border-box' },
  salaFilaIcono: { width: 28, height: 28, objectFit: 'contain' },
  salaFilaCodigo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: C.chocolate, letterSpacing: 1 },
  salaFilaChips: { display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 },
  salaFilaCreador: { fontSize: 12.5, fontWeight: 700, color: '#7a6660' },
  // Hoja (capa)
  hojaCapa: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 12px', overflowY: 'auto', boxSizing: 'border-box' },
  hojaCaja: { margin: 'auto', width: '100%', maxWidth: 900, borderRadius: 18, border: `3px solid ${C.negroPulido}`, background: C.maderaMedia, overflow: 'hidden', boxShadow: '0 16px 40px rgba(0,0,0,0.6)' },
  hojaCabecera: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: C.maderaOscura },
  hojaTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 19, color: C.doradoClaro },
  hojaCerrar: { width: 34, height: 34, borderRadius: '50%', border: '2px solid #000', background: '#E74C3C', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer' },
  hojaCuerpo: { padding: 12 },
  hojaGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, alignItems: 'stretch' },
  redesCaja: { display: 'flex', flexDirection: 'column', gap: 0, maxWidth: 520, margin: '0 auto' },
  redesTexto: { margin: 0, fontWeight: 700, fontSize: 15, color: C.crema, textAlign: 'center' },
  redesFila: { display: 'flex', alignItems: 'center', gap: 12, background: '#1E100A', border: '1.5px solid #5C3D21', borderRadius: 12, padding: '8px 12px', margin: '6px 0' },
  redesChip: { width: 44, height: 44, borderRadius: '50%', fontSize: 15, boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.45), inset 0 -2px 4px rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.5)', flexShrink: 0 },
  redesNombre: { flex: 1, fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 17, color: C.crema },
  redesBoton: { minWidth: 112, textAlign: 'center', borderRadius: 10, padding: '7px 10px', border: 'none', borderBottom: '3px solid transparent', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14, cursor: 'default', boxSizing: 'border-box' },
  redesBotonOro: { background: '#D4A030', borderBottomColor: '#8A6414', color: '#3B1F0E', cursor: 'pointer' },
  redesBotonOff: { background: '#A0522D', borderBottomColor: '#5C2D16', color: '#FFF8E7' },
  redesNota: { margin: 0, fontWeight: 700, fontSize: 13, color: '#E0D0B0', textAlign: 'center' },
  // Pase 516: modal de redes (madera oscura, ribete bronce, remaches, X roja flotante, banner pergamino).
  redesCapa: { background: 'rgba(0,0,0,0.75)' },
  redesPlaca: { position: 'relative', overflow: 'visible', maxWidth: 560, borderRadius: 20, border: '3px solid #8C6239', background: 'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 1px, transparent 1px 3px), linear-gradient(160deg, #2A1B40 0%, #231635 55%, #1B1028 100%)', boxShadow: '0 16px 40px rgba(0,0,0,0.7), inset 0 0 0 2px rgba(201,162,74,0.35)' },
  redesCabecera: { background: 'transparent', justifyContent: 'center', padding: '20px 56px 0' },
  redesTitulo: { fontSize: 22, textAlign: 'center' },
  redesRemache: { position: 'absolute', width: 10, height: 10, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #F1D58A, #A9791F 60%, #5C3D0E)', boxShadow: '0 1px 2px rgba(0,0,0,0.6)', pointerEvents: 'none' },
  redesCerrar: { position: 'absolute', top: -12, right: -12, width: 36, height: 36, borderRadius: '50%', border: '2.5px solid #C9A24A', background: 'linear-gradient(180deg, #E5483F, #B02820)', color: '#fff', fontWeight: 800, fontSize: 16, cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.55)', zIndex: 5, padding: 0, lineHeight: '30px' },
  redesAviso: { margin: '8px 0', background: '#F4E8D1', border: '1.5px solid #A8523A', borderRadius: 10, padding: '8px 12px', fontWeight: 700, fontSize: 13, color: '#8B1A1A', textAlign: 'center' },
  redesAvisoOk: { borderColor: '#5E7F3A', color: '#2F4A1A' },
  // ===== fin Pase 515 =====
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
    zIndex: 2,
    // Pase 360: remache unificado en todo el juego — bola de bronce lisa con borde marrón fino y un brillo claro arriba a la izquierda.
    background: 'radial-gradient(circle at 32% 28%, rgba(255,243,210,0.92) 0, rgba(255,243,210,0.92) 1.5px, transparent 2.1px), #C9973E',
    border: '1.5px solid #5A3A14', boxSizing: 'border-box',
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
  // Pase 404: botón del Anotador Offline (placa de madera con tachas, color dorado de acento).
  anotadorBoton: {
    width: '100%', display: 'flex', alignItems: 'center', gap: 12, boxSizing: 'border-box',
    margin: '0 0 14px', padding: '10px 16px 10px 12px', cursor: 'pointer',
    border: '3px solid #1a1410', borderRadius: 16,
    background: 'linear-gradient(160deg, #6b4a34 0%, #4a3226 55%, #2a1c14 100%)',
    boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.12), inset 0 -4px 10px rgba(0,0,0,0.5), 0 5px 0 #1a1410, 0 10px 18px rgba(0,0,0,0.35)',
    textAlign: 'left',
  },
  anotadorIcono: { width: 76, height: 38, objectFit: 'contain', flex: '0 0 auto', filter: 'drop-shadow(0 2px 0 rgba(0,0,0,0.45))' },
  anotadorTextos: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 },
  anotadorTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 19, color: '#F5B041', letterSpacing: 0.4, textShadow: '0 2px 0 #1a1410' },
  anotadorSub: { fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12.5, color: '#FFF3D6' },
  anotadorFlecha: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 30, lineHeight: 1, color: '#F5B041' },
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