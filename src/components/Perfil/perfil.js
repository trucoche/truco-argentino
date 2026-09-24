import React, { useState, useEffect, useCallback } from 'react';
import CambiarFondoModal from './CambiarFondoModal';
import PantallaCarga from '../PantallaCarga/PantallaCarga';
import { useToast } from '../../contexts/ToastContext';
import { API_URL as BASE_URL } from '../../config';

const API_BASE = `${BASE_URL}/api`;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8', celesteOscuro: '#2f8dbf',
  crema: '#FFF8ED', chocolate: '#4A2C2A',
  cremaSutil: '#FFFCF6'
};

const GENEROS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'neutro', label: 'Neutro' },
  { value: 'prefiero_no_decir', label: 'Prefiero no decirlo' },
];

// Deriva la imagen de avatar de un usuario (mismo criterio que ya usa el
// Centésimo cuadragésimo segundo pase — reemplazo del emoji de cada logro
// (primer "token" de `titulo`, ej. "🔥 Imparable") por la medalla
// ilustrada que pasó el usuario. Todavía no hay medalla para TODOS los
// logros — los que no están en este mapa se muestran solo con el nombre,
// sin ícono (nunca con el emoji viejo, que el usuario pidió sacar del
// todo). Mismo criterio en PerfilRivalModal.js y en los dos native.
export const ICONOS_LOGRO = {
  rey_del_envido: '/assets/images/logros/logro-rey_del_envido.png',
  fiel_a_la_pulperia: '/assets/images/logros/logro-fiel_a_la_pulperia.png',
  ganar_torneo: '/assets/images/logros/logro-ganar_torneo.png',
  mano_dura: '/assets/images/logros/logro-mano_dura.png',
  pared_de_piedra: '/assets/images/logros/logro-pared_de_piedra.png',
  primera_victoria: '/assets/images/logros/logro-primera_victoria.png',
  remontada_epica: '/assets/images/logros/logro-remontada_epica.png',
  leyenda_del_torneo: '/assets/images/logros/logro-leyenda_del_torneo.png',
  garganta_de_lata: '/assets/images/logros/logro-garganta_de_lata.png',
  zapatero_remendon: '/assets/images/logros/logro-zapatero_remendon.png',
  diez_victorias: '/assets/images/logros/logro-diez_victorias.png',
  cincuenta_partidas: '/assets/images/logros/logro-cincuenta_partidas.png',
  bolsillo_lleno: '/assets/images/logros/logro-bolsillo_lleno.png',
  centenario: '/assets/images/logros/logro-centenario.png',
  chamuyero_profesional: '/assets/images/logros/logro-chamuyero_profesional.png',
  // Centésimo cuadragésimo tercer pase: las 2 que faltaban del batch de 16
  // — el usuario mandó de nuevo el As de Espada suelto (as_en_la_manga) y
  // aclaró que el "libro" que había quedado sin identificar en realidad
  // es un mazo de cartas envuelto en un cinturón (dignidad_criolla).
  as_en_la_manga: '/assets/images/logros/logro-as_en_la_manga.png',
  dignidad_criolla: '/assets/images/logros/logro-dignidad_criolla.png',
  // Centésimo cuadragésimo sexto pase: 4 medallas más, confirmadas por el
  // usuario vía AskUserQuestion (la de las 3 cartas de copa NO era Rey de
  // Copas como se propuso — el usuario corrigió que es Elegancia Gaucha,
  // por las 3 cartas del mismo palo que arma la Flor). Quedan 21/25 con
  // ícono — sin medalla: Invencible, Rey de Copas, Sin Piedad, Gastar Suela.
  imparable: '/assets/images/logros/logro-imparable.png',
  jugada_maestra: '/assets/images/logros/logro-jugada_maestra.png',
  gran_campion: '/assets/images/logros/logro-gran_campion.png',
  elegancia_gaucha: '/assets/images/logros/logro-elegancia_gaucha.png',
  // Pase siguiente: 22/25 — medalla de "Invencible" (racha de 10
  // victorias seguidas, ver logros.js del backend), la moneda dorada con
  // laureles y el "10" que mandó el usuario.
  invencible: '/assets/images/logros/logro-invencible.png',
  // Pase siguiente: últimas 3 medallas — quedan las 25/25 con ícono. Rey de
  // Copas (los 5 trofeos dorados), Sin Piedad (el cometa/bola de fuego
  // dorada) y Gastar Suela (las alpargatas azules), las 3 mandadas por el
  // usuario.
  rey_de_copas: '/assets/images/logros/logro-rey_de_copas.png',
  sin_piedad: '/assets/images/logros/logro-sin_piedad.png',
  gastar_suela: '/assets/images/logros/logro-gastar_suela.png',
};

// `titulo` siempre viene del backend como "EMOJI Nombre" (ver
// routes/logros.js) — se sigue guardando así en la base (lo usan otros
// textos, como el de la transacción al reclamar), pero ya no se muestra
// crudo en ningún lado. Se le saca el primer "token" (el emoji) acá.
export function nombreLogroSinEmoji(titulo) {
  return (titulo || '').split(' ').slice(1).join(' ');
}

// header, AppShell.js): foto real si la eligió y la tiene subida, si no
// el personaje ilustrado que tenga elegido (gaucho por default).
function avatarSrcDe(u) {
  return u?.avatar_tipo === 'foto' && u?.foto_perfil_url
    ? u.foto_perfil_url
    : `/assets/${u?.personaje || 'gaucho'}-avatar.png`;
}

function StatTile({ label, valor, color }) {
  return (
    <div style={estilos.statTile}>
      <div style={{ ...estilos.statValor, ...(color ? { color } : {}) }}>{valor}</div>
      <div style={estilos.statLabel}>{label}</div>
    </div>
  );
}

// Nonagésimo segundo pase: rediseño completo de la página de Perfil,
// usando como guía visual una captura que pasó el usuario de la pantalla
// equivalente de otro juego similar. Hasta acá esta pantalla solo tenía
// Logros — ahora suma encabezado (foto/nombre/saldo + acceso a la
// Tienda), bio y género editables, un espacio reservado para el sistema
// de rangos (que el usuario está armando aparte, todavía sin lógica real
// — ver Pendiente en estado-proyecto.md), estadísticas de partidas, y una
// columna lateral con el top de jugadores + otro acceso a la Tienda. La
// columna lateral se apila abajo en pantallas angostas vía flex-wrap, sin
// necesidad de un media query (ver `estilos.layout`).
export default function Perfil({ token, usuario, onNavegar, onPerfilActualizado }) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  const { mostrarToast } = useToast();

  // Centésimo pase: fondo de perfil personalizable (foto propia, cuesta
  // monedas). El modal hace todo el trabajo (recorte + POST) y solo avisa
  // acá para refrescar `usuario` — mismo patrón que bio/género.
  const [fondoModalAbierto, setFondoModalAbierto] = useState(false);

  // ---------- Logros (sin cambios de lógica respecto de antes) ----------
  const [logros, setLogros] = useState([]);
  const [cargandoLogros, setCargandoLogros] = useState(true);
  const [errorLogros, setErrorLogros] = useState('');
  const [reclamando, setReclamando] = useState(null);

  const cargarLogros = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/logros`, { headers });
      const data = await res.json();
      if (res.ok) setLogros(data.logros);
    } catch (err) {
      console.error('Error cargando logros:', err);
    } finally {
      setCargandoLogros(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    cargarLogros();
  }, [cargarLogros]);

  // Pase siguiente (Fase 4 — toasts): primer call-site conectado al sistema
  // de avisos nuevo (ver ToastContext.js) — reclamar un logro no daba
  // NINGÚN feedback antes de esto (el botón simplemente desaparecía de la
  // lista al refrescar). El texto de éxito busca el logro reclamado en
  // `logros` (ya cargado) para mostrar su nombre + la recompensa real.
  const reclamarLogro = async (tipo) => {
    setErrorLogros('');
    setReclamando(tipo);
    try {
      const res = await fetch(`${API_BASE}/logros/reclamar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ tipo })
      });
      const data = await res.json();

      if (!res.ok) {
        const mensaje = data.error || 'No se pudo reclamar el logro';
        setErrorLogros(mensaje);
        mostrarToast(mensaje, 'error');
        return;
      }

      const logroReclamado = logros.find(l => l.tipo === tipo);
      mostrarToast(
        logroReclamado
          ? `¡${nombreLogroSinEmoji(logroReclamado.titulo)}! +${logroReclamado.recompensa} monedas`
          : 'Logro reclamado',
        'exito'
      );

      await cargarLogros();
      if (onPerfilActualizado) onPerfilActualizado();
    } catch (err) {
      console.error('Error reclamando logro:', err);
      setErrorLogros('No se pudo conectar con el servidor');
      mostrarToast('No se pudo conectar con el servidor', 'error');
    } finally {
      setReclamando(null);
    }
  };

  // ---------- Sobre mí (bio) ----------
  const [bio, setBio] = useState(usuario?.bio || '');
  const [editandoBio, setEditandoBio] = useState(false);
  const [guardandoBio, setGuardandoBio] = useState(false);
  const [errorBio, setErrorBio] = useState('');

  useEffect(() => {
    if (!editandoBio) setBio(usuario?.bio || '');
  }, [usuario?.bio, editandoBio]);

  const guardarBio = async () => {
    setGuardandoBio(true);
    setErrorBio('');
    try {
      const res = await fetch(`${API_BASE}/auth/bio`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ bio })
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorBio(data.error || 'No se pudo guardar');
        return;
      }

      setEditandoBio(false);
      if (onPerfilActualizado) onPerfilActualizado();
    } catch (err) {
      console.error('Error guardando bio:', err);
      setErrorBio('No se pudo conectar con el servidor');
    } finally {
      setGuardandoBio(false);
    }
  };

  // ---------- Género ----------
  const [guardandoGenero, setGuardandoGenero] = useState(false);

  const cambiarGenero = async (nuevoGenero) => {
    if (guardandoGenero || usuario?.genero === nuevoGenero) return;

    setGuardandoGenero(true);
    try {
      const res = await fetch(`${API_BASE}/auth/genero`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ genero: nuevoGenero })
      });
      if (res.ok && onPerfilActualizado) onPerfilActualizado();
    } catch (err) {
      console.error('Error guardando género:', err);
    } finally {
      setGuardandoGenero(false);
    }
  };

  const completados = logros.filter(l => l.completado).length;

  const partidasJugadas = Number(usuario?.partidas_jugadas || 0);
  const partidasGanadas = Number(usuario?.partidas_ganadas || 0);
  const partidasPerdidas = Number(usuario?.partidas_perdidas || 0);
  const abandonos = Number(usuario?.abandonos || 0);
  const porcentajeAbandonos = partidasJugadas > 0 ? Math.round((abandonos / partidasJugadas) * 100) : 0;

  return (
    <>
      <div style={estilos.sectionTitle}>Perfil</div>

      <div style={estilos.layout}>
        <div style={estilos.columnaPrincipal}>

          {/* Encabezado: foto, nombre, saldo + acceso a la Tienda, bio y género */}
          <div style={estilos.panel}>
            {/* Centésimo pase: fondo de perfil personalizable (foto propia,
                20 monedas) — va DETRÁS de esta fila (no del panel entero,
                para no pisar la legibilidad de bio/género más abajo).
                Avatar+nombre+saldo/botón se agruparon en un "chip"
                translúcido que ya no estira `saldoBloque` al borde derecho
                (antes usaba `marginLeft:auto`) — eso libera el resto de la
                fila para que se vea la foto de fondo. */}
            <div
              style={{
                ...estilos.encabezadoFilaContenedor,
                ...(usuario?.fondo_perfil_url ? {
                  backgroundImage: `linear-gradient(rgba(20,20,15,0.1), rgba(20,20,15,0.35)), url(${usuario.fondo_perfil_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                } : {}),
              }}
            >
              <button
                style={estilos.btnCambiarFondo}
                onClick={() => setFondoModalAbierto(true)}
                title="Cambiar fondo de perfil"
              >
                🖼️ {usuario?.fondo_perfil_url ? 'Cambiar fondo' : 'Elegir fondo'}
              </button>

              <div
                style={{
                  ...estilos.encabezadoFila,
                  ...(usuario?.fondo_perfil_url ? estilos.encabezadoFilaConFondo : {}),
                }}
              >
                <div style={estilos.avatarWrap}>
                  {/* Centésimo cuarto pase: si el usuario tiene un fondo de
                      perfil comprado, se ve también detrás del avatar (los
                      personajes ilustrados tienen fondo transparente en el
                      PNG, así que hasta ahora ahí se veía blanco liso). */}
                  <div
                    style={{
                      ...estilos.avatarCirculo,
                      ...(usuario?.fondo_perfil_url ? {
                        backgroundImage: `url(${usuario.fondo_perfil_url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      } : {}),
                    }}
                  >
                    <img src={avatarSrcDe(usuario)} alt="Avatar" style={estilos.avatarImg} />
                  </div>
                  {/* Centésimo cuadragésimo séptimo pase: el emoji 📷 se
                      reemplaza por el ícono de cámara ilustrado. */}
                  <button
                    style={estilos.avatarBadge}
                    onClick={() => onNavegar && onNavegar('config')}
                    title="Cambiar foto o personaje"
                  ><img src="/assets/images/icono-cambiar-foto.png" alt="" style={estilos.avatarBadgeIcono} /></button>
                </div>

                <div style={estilos.identidad}>
                  <div style={estilos.username}>{usuario?.username}</div>
                  {/* Centésimo tercer pase: se saca el email de acá (no
                      aportaba nada de valor en esta fila, y ocupaba lugar) y
                      en su lugar van las monedas — así el chip translúcido
                      necesita ocupar menos espacio, dejando ver más de la
                      foto de fondo. El botón "Comprá monedas" se muda con
                      el saldo (antes vivía en `saldoBloque`, un bloque
                      aparte a la derecha) pero más chico. */}
                  <div style={estilos.saldoInlineFila}>
                    <div style={estilos.saldoValor}>
                      <img src="/assets/images/moneda.png" alt="" style={estilos.saldoIcono} />
                      {Math.round(Number(usuario?.saldo) || 0)}
                    </div>
                    <button style={estilos.btnComprarMonedas} onClick={() => onNavegar && onNavegar('tienda')}>
                      Comprá monedas
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div style={estilos.campo}>
              <div style={estilos.campoEtiqueta}>💭 Sobre mí</div>
              {editandoBio ? (
                <>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value.slice(0, 280))}
                    style={estilos.bioTextarea}
                    placeholder="Contá quién sos, qué te gusta, y usá emojis si querés."
                    maxLength={280}
                    autoFocus
                  />
                  <div style={estilos.bioFooter}>
                    <span style={estilos.bioContador}>{bio.length}/280</span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        style={estilos.btnCancelar}
                        onClick={() => { setEditandoBio(false); setErrorBio(''); setBio(usuario?.bio || ''); }}
                      >
                        Cancelar
                      </button>
                      <button style={estilos.btnGuardar} disabled={guardandoBio} onClick={guardarBio}>
                        {guardandoBio ? 'Guardando...' : 'Guardar'}
                      </button>
                    </div>
                  </div>
                  {errorBio && <div style={estilos.errorTexto}>{errorBio}</div>}
                </>
              ) : (
                <div style={estilos.bioTexto} onClick={() => setEditandoBio(true)}>
                  <span>
                    {usuario?.bio || (
                      <span style={estilos.bioPlaceholder}>Describí quién sos, qué te gusta, y usá emojis si querés.</span>
                    )}
                  </span>
                  <span style={estilos.lapiz}>✏️</span>
                </div>
              )}
            </div>

            <div style={estilos.campo}>
              <div style={estilos.campoEtiqueta}>ℹ️ Género</div>
              {/* Mismo criterio ya establecido en el proyecto (cuadragésimo
                  séptimo pase): nada de <select> nativo del navegador,
                  botones simples tipo chip — acá con 4 opciones en vez de
                  un desplegable. */}
              <div style={estilos.chipsFila}>
                {GENEROS.map(g => (
                  <button
                    key={g.value}
                    style={{ ...estilos.chip, ...(usuario?.genero === g.value ? estilos.chipActivo : {}) }}
                    disabled={guardandoGenero}
                    onClick={() => cambiarGenero(g.value)}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Logros — misma lógica y contenido que ya existía */}
          <div style={estilos.panel}>
            <div style={estilos.panelHeader}>
              <div style={estilos.panelTitle}>🏅 Logros</div>
              {logros.length > 0 && (
                <div style={estilos.resumen}>{completados}/{logros.length} desbloqueados</div>
              )}
            </div>

            {errorLogros && <div style={estilos.errorBox}>{errorLogros}</div>}

            {cargandoLogros ? (
              // Centésimo cuadragésimo sexto pase: ver PantallaCarga —
              // `tema="claro"` porque este panel es crema/blanco, no el
              // verde oscuro del resto de la app.
              <PantallaCarga completa={false} conLogo={false} tema="claro" />
            ) : (
              // Centésimo undécimo pase: con 21 logros la grilla entera hacía
              // que la página fuera muy larga — se limita la altura visible
              // a ~3 filas y el resto se ve con scroll acá adentro, en vez de
              // estirar toda la pantalla de Perfil.
              <div style={estilos.gridScroll}>
              <div style={estilos.grid}>
                {logros.map((l) => {
                  const porcentaje = Math.round((l.progreso / l.objetivo) * 100);
                  return (
                    <div key={l.tipo} style={{ ...estilos.logroCard, ...(l.completado ? estilos.logroCardCompletado : {}) }}>
                      {/* Centésimo cuadragésimo cuarto pase — rediseño pedido
                          por el usuario: la medalla pasa a ser el elemento
                          más protagónico de la tarjeta (30px→68px, más del
                          doble), a la izquierda, con título+descripción
                          apilados al lado en vez de arriba. Los logros que
                          todavía no tienen medalla (ver ICONOS_LOGRO) se ven
                          sin el hueco del ícono, no con un espacio vacío. */}
                      <div style={estilos.logroCardTop}>
                        {ICONOS_LOGRO[l.tipo] && (
                          <img src={ICONOS_LOGRO[l.tipo]} alt="" style={estilos.logroIcono} />
                        )}
                        <div style={estilos.logroInfo}>
                          <div style={estilos.logroTitulo}>{nombreLogroSinEmoji(l.titulo)}</div>
                          {l.descripcion && <div style={estilos.logroDescripcion}>{l.descripcion}</div>}
                        </div>
                      </div>
                      <div style={estilos.barraFondo}>
                        <div style={{ ...estilos.barraRelleno, width: `${porcentaje}%` }} />
                      </div>
                      <div style={estilos.filaAbajo}>
                        <span style={estilos.progresoTexto}>{l.progreso}/{l.objetivo}</span>
                        <span style={estilos.recompensaTexto}>🪙 {l.recompensa}</span>
                      </div>

                      {l.reclamado ? (
                        <div style={estilos.badgeReclamado}>✓ Reclamado</div>
                      ) : l.completado ? (
                        <button
                          onClick={() => reclamarLogro(l.tipo)}
                          disabled={reclamando === l.tipo}
                          style={estilos.btnReclamar}
                        >
                          {reclamando === l.tipo ? 'Reclamando...' : `Reclamar +${l.recompensa}`}
                        </button>
                      ) : (
                        <div style={estilos.pendienteTexto}>En progreso</div>
                      )}
                    </div>
                  );
                })}
              </div>
              </div>
            )}
          </div>
        </div>

        {/* Pase siguiente: se quitó la tarjeta "Top jugadores" (poco
            relevante acá, ya existe la pantalla de Ranking completo para
            eso) y "Rendimiento" pasó a ocupar ese lugar en la columna
            lateral — antes vivía debajo de Logros, en la columna
            principal, lo que la dejaba muy abajo en pantallas con muchos
            logros. Ahora queda a la altura de la parte de arriba de
            Logros en vez de debajo de toda la grilla. */}
        <div style={estilos.columnaLateral}>
          <div style={estilos.panel}>
            <div style={estilos.panelTitle}>📊 Rendimiento</div>
            <div style={estilos.statsGrid}>
              <StatTile label="Partidas jugadas" valor={partidasJugadas} />
              <StatTile label="Ganadas" valor={partidasGanadas} color={C.verdeOscuro} />
              <StatTile label="Perdidas" valor={partidasPerdidas} color={C.crimsonOscuro} />
              <StatTile label="Abandonos" valor={`${porcentajeAbandonos}%`} />
            </div>
          </div>

          {/* Sistema de rangos — nonagésimo sexto pase: reemplaza el
              placeholder por la tarjeta real, con las 10 categorías que
              pasó el usuario. El backend (`rangos.js`) es la única fuente
              de la verdad de los umbrales de puntos — acá solo se
              RENDERIZA lo que ya viene calculado en `usuario.rango`
              (nombre/concepto/división/progreso), no se duplica ningún
              número. Nonagésimo séptimo pase: ya existe el motor que suma/
              resta `puntos_rango` jugando partidas (ver `calcularCambioPuntos`
              en rangos.js, conectado en `finalizarPartida()`) — un usuario
              recién registrado sigue arrancando en "Mancebo III" hasta
              jugar su primera partida, ya no porque falte el mecanismo.
              Pase siguiente: se mueve de una franja horizontal ancha
              arriba de Logros a esta tarjeta acá en la columna lateral,
              debajo de Rendimiento — mismo motivo que el de Rendimiento
              (bajar la altura total de la página) y a pedido del usuario,
              que además va a ir reemplazando el emoji 🎖️ por logos
              propios de cada rango a futuro. */}
          <div style={estilos.panelRango}>
            <div style={estilos.rangoIcono}>🎖️</div>
            <div style={estilos.rangoTitulo}>
              {usuario?.rango?.esTop500
                ? `${usuario.rango.nombre} · #${usuario.rango.posicion ?? '—'}`
                : `${usuario?.rango?.nombre || 'Mancebo'} ${usuario?.rango?.division || 'III'}`}
            </div>
            <div style={estilos.rangoSubtitulo}>{usuario?.rango?.concepto}</div>
            {usuario?.rango && !usuario.rango.esTop500 && (
              <div style={estilos.rangoProgresoBloque}>
                <div style={estilos.rangoBarraFondo}>
                  <div style={{ ...estilos.rangoBarraRelleno, width: `${Math.round((usuario.rango.progreso || 0) * 100)}%` }} />
                </div>
                <div style={estilos.rangoPuntosTexto}>
                  {usuario.rango.puntos} / {usuario.rango.rangoMax + 1} pts
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {fondoModalAbierto && (
        <CambiarFondoModal
          token={token}
          saldoActual={usuario?.saldo}
          onCerrar={() => setFondoModalAbierto(false)}
          onFondoActualizado={() => { if (onPerfilActualizado) onPerfilActualizado(); }}
        />
      )}
    </>
  );
}

const estilos = {
  sectionTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16, color: C.crema, margin: '4px 0 10px 4px' },

  // Layout de dos columnas que se apila solo (sin media query): la
  // columna principal pide un mínimo de 320px y la lateral 240px — en
  // cuanto no entran las dos una al lado de la otra, flex-wrap las cae a
  // una debajo de la otra.
  layout: { display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' },
  // Pase siguiente: la columna lateral ahora solo tiene "Rendimiento"
  // (se quitó "Top jugadores", ver más abajo) y la principal solo tiene
  // "Logros" — la proporción pasa de 5:2 a 7:2, dándole más ancho a
  // Logros para que la grilla entre en 3 columnas (antes 2) y la página
  // quede menos larga.
  columnaPrincipal: { flex: '7 1 420px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 },
  columnaLateral: { flex: '2 1 220px', display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 },

  panel: {
    background: C.crema, border: `4px solid ${C.chocolate}`, borderRadius: 20,
    boxShadow: '0 6px 0 rgba(0,0,0,0.25)', padding: '18px 18px 20px'
  },

  // Centésimo pase: contenedor nuevo que envuelve la fila de encabezado —
  // acá va el fondo de perfil personalizable (cuando el usuario eligió
  // uno) y el botón para cambiarlo. `encabezadoFila` en sí pasó de
  // `marginBottom` propio a vivir adentro de este contenedor, y de
  // `width` implícito 100% a `fit-content` — ya no necesita estirarse
  // porque `identidad`/`saldoBloque` dejaron de forzarlo (ver abajo).
  encabezadoFilaContenedor: {
    position: 'relative', borderRadius: 16, marginBottom: 16,
    padding: 12, overflow: 'hidden', minHeight: 150
  },
  btnCambiarFondo: {
    position: 'absolute', top: 8, right: 8, zIndex: 2,
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 11.5,
    background: 'rgba(255,255,255,0.92)', color: C.chocolate,
    border: `2px solid ${C.chocolate}`, borderRadius: 10, padding: '6px 10px',
    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
  },
  encabezadoFila: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 14, width: 'fit-content' },
  // Chip translúcido que agrupa avatar+nombre+saldo cuando hay un fondo de
  // foto detrás — sin esto el texto oscuro quedaría ilegible encima de
  // una foto cualquiera. Sin fondo (caso de siempre hasta ahora) no se
  // aplica, la fila se ve igual que antes salvo por el padding del
  // contenedor nuevo.
  encabezadoFilaConFondo: {
    background: 'rgba(255,248,237,0.85)', borderRadius: 14, padding: '10px 14px'
  },
  // Centésimo segundo pase: la tarjeta de encabezado (fondo de perfil +
  // avatar/nombre/saldo) se agranda a pedido del usuario, ahora que la
  // columna lateral le cedió espacio (ver `columnaPrincipal`/
  // `columnaLateral` más abajo) — avatar, tipografía y botón escalados
  // ~25-30% respecto del pase anterior.
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatarCirculo: {
    width: 108, height: 108, borderRadius: '50%', overflow: 'hidden',
    border: `3px solid ${C.chocolate}`, background: '#fff'
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  // Pase siguiente: badge + ícono agrandados a pedido del usuario ("hay
  // que agrandarlas para que se noten un poco más los detalles").
  avatarBadge: {
    position: 'absolute', right: -6, bottom: -6, width: 42, height: 42, borderRadius: '50%',
    background: C.celeste, border: `2px solid ${C.chocolate}`, cursor: 'pointer',
    fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center'
  },
  avatarBadgeIcono: { width: 26, height: 26, objectFit: 'contain' },
  // Centésimo pase: antes `identidad` crecía (`flex:'1 1 160px'`) para
  // empujar `saldoBloque` con `marginLeft:auto` hasta el borde derecho del
  // panel — a pedido del usuario, ahora los tres (avatar/identidad/saldo)
  // se agrupan juntos a la izquierda para dejar libre el resto de la fila
  // (donde se ve el fondo de perfil, si hay uno elegido).
  // Centésimo tercer pase: `identidad` creció un poco de ancho (260→300)
  // para darle lugar a la fila de saldo+botón debajo del nombre.
  identidad: { flex: '0 1 auto', minWidth: 0, maxWidth: 300 },
  username: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 27, color: C.chocolate, wordBreak: 'break-word' },
  // Centésimo tercer pase: reemplaza a `email`/`saldoEtiqueta`/`saldoBloque`
  // (ver comentario en el JSX de arriba) — monedas + botón de compra en
  // una sola fila compacta, debajo del nombre. `flexWrap` para que en
  // pantallas angostas el botón pueda caer a una segunda línea en vez de
  // desbordar.
  saldoInlineFila: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 4 },
  saldoValor: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 18, color: C.chocolate
  },
  saldoIcono: { width: 20, height: 20, objectFit: 'contain' },
  // Más chico que antes (fontSize 14.5→12.5, padding 9/16→6/12) — ahora
  // vive junto al monto de moneda, no en un bloque propio más grande.
  btnComprarMonedas: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 12.5,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    border: `2px solid ${C.chocolate}`, borderRadius: 9, padding: '6px 12px',
    boxShadow: `0 3px 0 ${C.doradoOscuro}`, cursor: 'pointer', whiteSpace: 'nowrap'
  },

  campo: { marginTop: 14 },
  campoEtiqueta: { fontSize: 13, fontWeight: 800, color: C.chocolate, marginBottom: 6 },
  bioTexto: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10,
    background: '#fff', border: `2px solid ${C.chocolate}22`, borderRadius: 12,
    padding: '10px 12px', fontSize: 13.5, color: C.chocolate, cursor: 'pointer', lineHeight: 1.4
  },
  bioPlaceholder: { color: '#a09085', fontStyle: 'italic' },
  lapiz: { flexShrink: 0, fontSize: 13, opacity: 0.6 },
  bioTextarea: {
    width: '100%', minHeight: 70, resize: 'vertical',
    background: '#fff', border: `2px solid ${C.chocolate}`, borderRadius: 12,
    padding: '10px 12px', fontSize: 13.5, color: C.chocolate, fontFamily: 'inherit',
    boxSizing: 'border-box'
  },
  bioFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  bioContador: { fontSize: 11, color: '#a09085', fontWeight: 700 },
  btnCancelar: {
    fontSize: 12, fontWeight: 700, color: C.chocolate, background: 'none',
    border: `2px solid ${C.chocolate}44`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer'
  },
  btnGuardar: {
    fontSize: 12, fontWeight: 700, color: C.chocolate, background: C.doradoClaro,
    border: `2px solid ${C.chocolate}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer'
  },
  errorTexto: { fontSize: 11.5, color: C.crimsonOscuro, fontWeight: 700, marginTop: 4 },
  chipsFila: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip: {
    fontSize: 12.5, fontWeight: 700, color: C.chocolate,
    background: '#fff', border: `2px solid ${C.chocolate}33`, borderRadius: 20,
    padding: '8px 14px', cursor: 'pointer'
  },
  chipActivo: {
    color: '#fff', background: C.celeste, borderColor: C.celesteOscuro
  },

  // Pase siguiente: de fila (ícono a la izquierda + texto al lado) a
  // columna centrada — ícono arriba (con más presencia, pensado para
  // cuando el usuario reemplace el emoji por un logo propio de cada
  // rango), título y concepto debajo, y la línea de puntaje al final de
  // todo. Mismo criterio de tarjeta-insignia que ya usa el popup de logro
  // desbloqueado (ícono grande arriba, texto centrado debajo).
  panelRango: {
    background: `linear-gradient(135deg, ${C.doradoClaro}, ${C.dorado})`,
    border: `3px solid ${C.chocolate}`, borderRadius: 18,
    padding: '18px 18px 16px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', textAlign: 'center', gap: 6,
    boxShadow: '0 4px 0 rgba(0,0,0,0.18)'
  },
  rangoIcono: { fontSize: 46, lineHeight: 1 },
  rangoTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 15.5, color: C.chocolate, marginTop: 4 },
  rangoSubtitulo: { fontSize: 12.5, color: C.chocolate, opacity: 0.85, lineHeight: 1.4 },
  rangoProgresoBloque: { width: '100%', marginTop: 6 },
  rangoBarraFondo: { height: 8, background: 'rgba(74,44,42,0.18)', borderRadius: 6, overflow: 'hidden' },
  rangoBarraRelleno: { height: '100%', background: C.chocolate, borderRadius: 6, transition: 'width 0.3s ease' },
  rangoPuntosTexto: { fontSize: 11.5, fontWeight: 800, color: C.chocolate, marginTop: 4, opacity: 0.85 },

  panelHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  panelTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 19, color: C.chocolate, marginBottom: 14 },
  resumen: { fontSize: 12.5, color: '#7a6660', fontWeight: 700 },
  errorBox: {
    background: '#ffe0dd', border: `2px solid ${C.crimson}`, color: C.crimsonOscuro,
    borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontWeight: 700, fontSize: 13
  },
  // Centésimo undécimo pase: altura fija para mostrar ~3 filas de la
  // grilla (deja ver varias tarjetas según cuántas columnas entren) y
  // deslizar el resto acá adentro.
  // Centésimo cuadragésimo cuarto pase — rediseño de la sección Logros
  // pedido por el usuario: la medalla pasa a ser el elemento más
  // protagónico ("mucho más grande que en el diseño actual, aprox. el
  // doble o más"), la tarjeta gana padding/aire y la grilla usa
  // auto-fit para no necesitar media queries.
  // Pase siguiente: se quitó "Top jugadores" y "Logros" pasó a ser la
  // única tarjeta de la columna principal (que además se ensanchó, ver
  // `columnaPrincipal`) para que entren 3 columnas en vez de 2 en
  // pantallas de escritorio (sigue cayendo a 2 o 1 sola en pantallas
  // angostas, el auto-fit se ajusta solo). Primer intento con
  // minmax(230px) se quedó corto — con el padding del panel y el ancho
  // real de la columna, 3 tarjetas de 230px+gap no llegaban a entrar y
  // se veía como si hubiera espacio vacío de más. Se baja a 195px de
  // mínimo y el gap de 16 a 12 para que 3 entren con margen.
  gridScroll: { maxHeight: 560, overflowY: 'auto', paddingRight: 4 },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: 12
  },
  logroCard: {
    background: '#fff', border: `2px solid ${C.chocolate}22`, borderRadius: 18,
    padding: 14, display: 'flex', flexDirection: 'column', gap: 10,
    boxShadow: '0 3px 10px rgba(74,44,42,0.08)'
  },
  logroCardCompletado: {
    borderColor: C.dorado, background: '#fffaf0',
    boxShadow: '0 4px 14px rgba(255,182,39,0.25)'
  },
  // Fila superior de la tarjeta: medalla grande a la izquierda + bloque
  // título/descripción al lado (antes la medalla iba arriba, chica).
  logroCardTop: { display: 'flex', alignItems: 'center', gap: 14 },
  logroInfo: { flex: 1, minWidth: 0 },
  // Centésimo cuadragésimo sexto pase: 68→78px — el usuario pidió que
  // las medallas sean "un poco más grandes" en todos lados donde aparecen.
  logroIcono: { width: 78, height: 78, objectFit: 'contain', flexShrink: 0 },
  logroTitulo: { fontSize: 15, fontWeight: 700, color: C.chocolate },
  // Centésimo décimo tercer pase: cómo se obtiene cada logro — el usuario
  // pidió que la tarjeta deje de ser solo título+barra.
  logroDescripcion: { fontSize: 11.5, color: '#8a7267', marginTop: 4, lineHeight: 1.35 },
  barraFondo: { height: 9, background: '#eee2d0', borderRadius: 6, overflow: 'hidden' },
  barraRelleno: {
    height: '100%', background: `linear-gradient(90deg, ${C.doradoClaro}, ${C.dorado})`,
    borderRadius: 6, transition: 'width 0.3s ease'
  },
  filaAbajo: { display: 'flex', justifyContent: 'space-between' },
  progresoTexto: { fontSize: 12, fontWeight: 800, color: C.doradoOscuro },
  recompensaTexto: { fontSize: 12, fontWeight: 800, color: C.chocolate },
  btnReclamar: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 12.5,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    border: `2px solid ${C.chocolate}`, borderRadius: 10, padding: '7px 12px',
    boxShadow: `0 3px 0 ${C.doradoOscuro}`, cursor: 'pointer', width: '100%'
  },
  badgeReclamado: {
    fontSize: 11.5, fontWeight: 700, color: C.verdeOscuro,
    background: '#d8f0da', borderRadius: 8, padding: '5px 8px', textAlign: 'center'
  },
  pendienteTexto: {
    fontSize: 11.5, fontWeight: 700, color: '#a09085',
    textAlign: 'center', fontStyle: 'italic'
  },

  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 },
  statTile: {
    background: C.cremaSutil, border: `2px solid ${C.chocolate}22`, borderRadius: 14,
    padding: '14px 10px', textAlign: 'center'
  },
  statValor: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 24, color: C.chocolate },
  statLabel: { fontSize: 11.5, fontWeight: 700, color: '#8c8078', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.3 },

};