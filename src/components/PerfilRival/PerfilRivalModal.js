import React, { useState, useEffect, useCallback } from 'react';
import { ICONOS_LOGRO, nombreLogroSinEmoji } from '../Perfil/perfil';
import { getSocket } from '../../services/socket';
import { useToast } from '../../contexts/ToastContext';
import MensajePrivadoModal from '../MensajePrivado/MensajePrivadoModal';
import { API_URL as BASE_URL } from '../../config';

const API_BASE = `${BASE_URL}/api`;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8',
  crema: '#FFF8ED', chocolate: '#4A2C2A', cremaSutil: '#FFFCF6'
};

// Mismo criterio de avatar que ya usan Perfil/Ranking/el header.
function avatarSrcDe(u) {
  return u?.avatar_tipo === 'foto' && u?.foto_perfil_url
    ? u.foto_perfil_url
    : `/assets/${u?.personaje || 'gaucho'}-avatar.png`;
}

// Nonagésimo octavo pase: popup de perfil de OTRO usuario — se abre al
// tocar su foto/nombre en cualquier pantalla (ranking, lobby, chat de la
// mesa, top de jugadores en Perfil). Trae los datos de
// GET /api/usuarios/perfil-publico/:username (ver routes/usuarios.js,
// backend). El usuario pidió esto a partir de una app de referencia —
// se sigue la MECÁNICA que pidió (popup compacto + Desafiar/Bloquear/
// Denunciar + "ver perfil completo" con más detalle), no el diseño
// visual literal de la referencia, para no romper la identidad gráfica
// ya establecida acá (dorado/chocolate/crema).
//
// "Insignias" acá son los mismos 4 logros que ya existen en la pantalla
// de Perfil propia (ver routes/logros.js) — decisión tomada con el
// usuario vía AskUserQuestion en este mismo pase, en vez de diseñar un
// sistema nuevo de insignias con niveles como el de la referencia.
//
// "Desafiar" queda como placeholder (igual que "Comprar" en la Tienda
// antes de Mercado Pago): no hay todavía ningún sistema de invitación
// directa entre usuarios (habría que trackear quién está online y armar
// un flujo de aceptar/rechazar por socket) — es una feature aparte.
//
// Bloquear/Denunciar SÍ quedan funcionales de punta a punta contra el
// backend nuevo, pero el bloqueo hoy solo queda GUARDADO — todavía no
// oculta mensajes de chat de esa persona ni la excluye del matchmaking
// de "Jugar ya" (son cambios en otros archivos, quedan anotados como
// pendiente).
export default function PerfilRivalModal({ username, token, onClose }) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const { mostrarToast } = useToast();
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [datos, setDatos] = useState(null);
  const [expandido, setExpandido] = useState(false);
  const [bloqueando, setBloqueando] = useState(false);
  const [mostrarDenuncia, setMostrarDenuncia] = useState(false);
  const [motivoDenuncia, setMotivoDenuncia] = useState('');
  const [enviandoDenuncia, setEnviandoDenuncia] = useState(false);
  const [mensajeDenuncia, setMensajeDenuncia] = useState('');
  // Centésimo cuadragésimo sexto pase: al tocar una medalla se muestra
  // acá abajo un texto chico con la descripción de ese logro (el usuario
  // pidió esto explícitamente para este popup) — se guarda el tipo del
  // logro tocado, no un booleano, para poder mostrar cuál es.
  const [insigniaAbierta, setInsigniaAbierta] = useState(null);
  // Pase siguiente: sistema de amigos real — `datos.amistad` ya viene del
  // backend ('ninguna' | 'pendiente_enviada' | 'pendiente_recibida' |
  // 'amigos', ver GET /perfil-publico/:username). Un solo booleano de
  // "procesando" alcanza porque solo puede haber una acción de amistad en
  // vuelo por vez desde este popup.
  const [procesandoAmistad, setProcesandoAmistad] = useState(false);
  // Pase siguiente: "Desafiar" pasa de placeholder a invitación real en
  // vivo (por socket, ver getSocket().emit('desafio:enviar', ...) más
  // abajo) — con cualquier usuario, no hace falta ser amigos (mismo
  // alcance que ya tenía este botón). `desafioEnviado` es solo feedback
  // visual local y optimista (el popup no escucha la respuesta del
  // servidor — eso lo maneja un componente de nivel más alto, ver
  // AvisosGlobales.js en App.js, que sí puede mostrar un popup/toast
  // aunque este modal ya se haya cerrado para entonces).
  const [desafioEnviado, setDesafioEnviado] = useState(false);
  // "Mensaje" — solo aparece si ya son amigos (decisión explícita del
  // usuario: mensaje privado "solo entre amigos"). Abre el mismo modal
  // de conversación 1 a 1 que también usa el menú "⋮" de Chat Global.
  const [mensajeAbierto, setMensajeAbierto] = useState(false);

  const cargarPerfil = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/usuarios/perfil-publico/${encodeURIComponent(username)}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'No se pudo cargar el perfil');
        return;
      }
      setDatos(data);
    } catch (err) {
      console.error('Error cargando perfil público:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, token]);

  useEffect(() => { cargarPerfil(); }, [cargarPerfil]);

  const toggleBloqueo = async () => {
    if (!datos) return;
    setBloqueando(true);
    try {
      const res = await fetch(`${API_BASE}/usuarios/${encodeURIComponent(username)}/bloquear`, {
        method: datos.bloqueado ? 'DELETE' : 'POST',
        headers
      });
      if (res.ok) {
        setDatos({ ...datos, bloqueado: !datos.bloqueado });
      }
    } catch (err) {
      console.error('Error bloqueando/desbloqueando:', err);
    } finally {
      setBloqueando(false);
    }
  };

  // Pase siguiente: las tres acciones de amistad (mandar solicitud,
  // aceptar una recibida, o cortar la relación — sirve tanto para
  // cancelar una enviada como para rechazar una recibida o eliminar una
  // amistad ya aceptada) pisan `datos.amistad` con lo que devuelve el
  // backend en cada caso, mismo criterio optimista que ya usa
  // toggleBloqueo() acá arriba.
  const solicitarAmistad = async () => {
    if (!datos) return;
    setProcesandoAmistad(true);
    try {
      const res = await fetch(`${API_BASE}/usuarios/${encodeURIComponent(username)}/solicitar-amistad`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (res.ok) setDatos({ ...datos, amistad: data.amistad });
    } catch (err) {
      console.error('Error enviando solicitud de amistad:', err);
    } finally {
      setProcesandoAmistad(false);
    }
  };

  const aceptarAmistad = async () => {
    if (!datos) return;
    setProcesandoAmistad(true);
    try {
      const res = await fetch(`${API_BASE}/usuarios/${encodeURIComponent(username)}/aceptar-amistad`, {
        method: 'POST',
        headers
      });
      const data = await res.json();
      if (res.ok) setDatos({ ...datos, amistad: data.amistad });
    } catch (err) {
      console.error('Error aceptando solicitud de amistad:', err);
    } finally {
      setProcesandoAmistad(false);
    }
  };

  const quitarAmistad = async () => {
    if (!datos) return;
    setProcesandoAmistad(true);
    try {
      const res = await fetch(`${API_BASE}/usuarios/${encodeURIComponent(username)}/amistad`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();
      if (res.ok) setDatos({ ...datos, amistad: data.amistad });
    } catch (err) {
      console.error('Error quitando relación de amistad:', err);
    } finally {
      setProcesandoAmistad(false);
    }
  };

  const enviarDenuncia = async () => {
    if (!motivoDenuncia.trim()) return;
    setEnviandoDenuncia(true);
    setMensajeDenuncia('');
    try {
      const res = await fetch(`${API_BASE}/usuarios/${encodeURIComponent(username)}/denunciar`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ motivo: motivoDenuncia.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        setMensajeDenuncia(data.error || 'No se pudo enviar la denuncia');
        return;
      }
      setMensajeDenuncia('Gracias, ya la recibimos.');
      setMotivoDenuncia('');
      setTimeout(() => { setMostrarDenuncia(false); setMensajeDenuncia(''); }, 1800);
    } catch (err) {
      console.error('Error enviando denuncia:', err);
      setMensajeDenuncia('No se pudo conectar con el servidor');
    } finally {
      setEnviandoDenuncia(false);
    }
  };

  return (
    <div style={estilos.overlay} onClick={onClose}>
      {/* Centésimo décimo tercer pase: anillo dorado alrededor de toda la
          tarjeta — mismo criterio que ya tenía la versión nativa
          (`anilloPanel`/`panel`, ver PerfilRivalModal.tsx), acá replicado
          con un div envolvente en vez de un componente propio de RN. */}
      <div style={estilos.anillo} onClick={(e) => e.stopPropagation()}>
      <div style={estilos.box}>
        <button style={estilos.cerrar} onClick={onClose}>✕</button>

        {cargando ? (
          <p style={{ color: '#7a6660', textAlign: 'center', padding: '30px 0' }}>Cargando...</p>
        ) : error ? (
          <p style={{ color: C.crimsonOscuro, textAlign: 'center', padding: '30px 0', fontWeight: 700 }}>{error}</p>
        ) : datos && (
          <>
            {/* Centésimo octavo pase: corrección de diseño — el usuario
                aclaró que el fondo comprado no va detrás del PERSONAJE
                (dentro del círculo, que igual queda tapado por la imagen
                del avatar), sino como una imagen de fondo de la zona
                blanca de la tarjeta que rodea al avatar y al nombre —
                mismo espíritu que ya usa la pantalla propia de Perfil
                (`encabezadoFilaContenedor`), acá adaptado al layout
                vertical y centrado de este popup. */}
            {datos.usuario.fondo_perfil_url ? (
              <div
                style={{
                  ...estilos.encabezadoConFondo,
                  backgroundImage: `linear-gradient(rgba(20,20,15,0.05), rgba(20,20,15,0.32)), url(${datos.usuario.fondo_perfil_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                <div style={estilos.avatarWrap}>
                  <img src={avatarSrcDe(datos.usuario)} alt="" style={estilos.avatar} />
                </div>
                <div style={{ ...estilos.username, ...estilos.usernameConFondo }}>{datos.usuario.username}</div>
              </div>
            ) : (
              <>
                <div style={estilos.avatarWrap}>
                  <img src={avatarSrcDe(datos.usuario)} alt="" style={estilos.avatar} />
                </div>
                <div style={estilos.username}>{datos.usuario.username}</div>
              </>
            )}

            {!datos.esUnoMismo && (
              <div style={estilos.enfrentamientos}>
                {datos.enfrentamientos > 0
                  ? `Se enfrentaron ${datos.enfrentamientos} ${datos.enfrentamientos === 1 ? 'vez' : 'veces'}`
                  : '¡Nunca se enfrentaron!'}
              </div>
            )}

            <div style={estilos.rangoBox}>
              <span style={estilos.rangoIcono}>🎖️</span>
              <span style={estilos.rangoNombre}>
                {datos.usuario.rango.esTop500
                  ? `${datos.usuario.rango.nombre} · #${datos.usuario.rango.posicion ?? '—'}`
                  : `${datos.usuario.rango.nombre} ${datos.usuario.rango.division}`}
              </span>
            </div>

            {/* Centésimo tercer pase: "Puntos" (rango) se reemplaza por
                "Jugadas" — mismo criterio que ya usa el panel de
                Rendimiento del perfil propio, que tampoco repite Puntos
                acá porque ya se ve arriba en `rangoBox`. */}
            <div style={estilos.statsGrid}>
              <div style={estilos.statTile}>
                <div style={estilos.statValor}>{datos.usuario.partidas_jugadas}</div>
                <div style={estilos.statLabel}>Jugadas</div>
              </div>
              <div style={estilos.statTile}>
                <div style={{ ...estilos.statValor, color: C.verdeOscuro }}>{datos.usuario.partidas_ganadas}</div>
                <div style={estilos.statLabel}>Ganadas</div>
              </div>
              <div style={estilos.statTile}>
                <div style={{ ...estilos.statValor, color: C.crimsonOscuro }}>{datos.usuario.partidas_perdidas}</div>
                <div style={estilos.statLabel}>Perdidas</div>
              </div>
              <div style={estilos.statTile}>
                <div style={estilos.statValor}>{datos.usuario.porcentajeAbandonos}%</div>
                <div style={estilos.statLabel}>Abandonos</div>
              </div>
            </div>

            {expandido && datos.usuario.bio && (
              <div style={estilos.bio}>“{datos.usuario.bio}”</div>
            )}

            <div style={estilos.insigniasHeader}>Insignias</div>
            <div style={estilos.insigniasFila}>
              {datos.insignias.map(i => (
                <div
                  key={i.tipo}
                  title={nombreLogroSinEmoji(i.titulo)}
                  onClick={() => setInsigniaAbierta(v => (v === i.tipo ? null : i.tipo))}
                  style={{
                    ...estilos.insigniaChip,
                    ...(i.completado ? {} : estilos.insigniaChipBloqueada),
                    ...(insigniaAbierta === i.tipo ? estilos.insigniaChipActiva : {}),
                  }}
                >
                  {ICONOS_LOGRO[i.tipo] && (
                    <img src={ICONOS_LOGRO[i.tipo]} alt="" style={estilos.insigniaIcono} />
                  )}
                  {expandido && <span style={estilos.insigniaTitulo}>{nombreLogroSinEmoji(i.titulo)}</span>}
                </div>
              ))}
            </div>

            {/* Centésimo cuadragésimo sexto pase: al tocar una medalla de
                arriba, se muestra acá su descripción (texto real del
                logro, ver routes/logros.js) — pedido explícito del
                usuario ("al hacer click ahí... muestre un texto que diga
                de qué trata el logro"). */}
            {insigniaAbierta && (() => {
              const sel = datos.insignias.find(i => i.tipo === insigniaAbierta);
              if (!sel) return null;
              return (
                <div style={estilos.insigniaDescripcion}>
                  <strong>{nombreLogroSinEmoji(sel.titulo)}:</strong> {sel.descripcion || 'Sin descripción todavía.'}
                </div>
              );
            })()}

            {!datos.esUnoMismo && (
              <>
                <div style={estilos.botonera}>
                  <button
                    style={estilos.btnDesafiar}
                    onClick={() => {
                      // Pase siguiente: si ya hay un desafío esperando
                      // respuesta, NO se manda otro (bug real: mandar dos
                      // desafíos al mismo usuario hacía que el segundo
                      // pisara al primero del lado del receptor) — se
                      // avisa con un toast en vez de reintentar.
                      if (desafioEnviado) {
                        mostrarToast('Esperando respuesta de tu desafío anterior...', 'info');
                        return;
                      }
                      getSocket().emit('desafio:enviar', { paraUsername: username });
                      setDesafioEnviado(true);
                      // 30s — mismo tiempo que tiene el otro para responder
                      // en el servidor (antes eran 4s, mucho menos que los
                      // 30 reales).
                      setTimeout(() => setDesafioEnviado(false), 30000);
                    }}
                  >
                    {desafioEnviado ? '✓ Desafío enviado...' : '⚔️ Desafiar'}
                  </button>
                </div>

                {/* Pase siguiente: fila de amistad — un solo botón (o dos,
                    si hay una solicitud recibida esperando respuesta) según
                    `datos.amistad`. Va antes de Bloquear/Denunciar porque es
                    la acción "positiva" del popup. */}
                <div style={estilos.filaAmistad}>
                  {datos.amistad === 'ninguna' && (
                    <button style={estilos.btnAgregarAmigo} onClick={solicitarAmistad} disabled={procesandoAmistad}>
                      ➕ Agregar amigo
                    </button>
                  )}
                  {datos.amistad === 'pendiente_enviada' && (
                    <button style={estilos.btnAccionChica} onClick={quitarAmistad} disabled={procesandoAmistad}>
                      ✖ Cancelar solicitud
                    </button>
                  )}
                  {datos.amistad === 'pendiente_recibida' && (
                    <>
                      <button style={estilos.btnAgregarAmigo} onClick={aceptarAmistad} disabled={procesandoAmistad}>
                        ✔ Aceptar amistad
                      </button>
                      <button style={estilos.btnAccionChica} onClick={quitarAmistad} disabled={procesandoAmistad}>
                        ✖ Rechazar
                      </button>
                    </>
                  )}
                  {datos.amistad === 'amigos' && (
                    <>
                      <button
                        style={{ ...estilos.btnAccionChica, ...estilos.btnAccionActivaAmigos }}
                        onClick={quitarAmistad}
                        disabled={procesandoAmistad}
                      >
                        ✓ Amigos (quitar)
                      </button>
                      <button style={estilos.btnMensaje} onClick={() => setMensajeAbierto(true)}>
                        <img src="/assets/images/icono-chat.png" alt="" style={estilos.iconoBotonMensaje} /> Mensaje
                      </button>
                    </>
                  )}
                </div>

                <div style={estilos.filaAcciones}>
                  <button
                    style={{ ...estilos.btnAccionChica, ...(datos.bloqueado ? estilos.btnAccionActiva : {}) }}
                    onClick={toggleBloqueo}
                    disabled={bloqueando}
                  >
                    {datos.bloqueado ? '✓ Bloqueado' : '🚫 Bloquear'}
                  </button>
                  <button style={estilos.btnAccionChica} onClick={() => setMostrarDenuncia(v => !v)}>
                    🚩 Denunciar
                  </button>
                </div>

                {mostrarDenuncia && (
                  <div style={estilos.panelDenuncia}>
                    <textarea
                      value={motivoDenuncia}
                      onChange={(e) => setMotivoDenuncia(e.target.value)}
                      placeholder="Contanos qué pasó..."
                      maxLength={500}
                      rows={3}
                      style={estilos.textareaDenuncia}
                    />
                    {mensajeDenuncia && <div style={estilos.mensajeDenuncia}>{mensajeDenuncia}</div>}
                    <button
                      style={estilos.btnEnviarDenuncia}
                      onClick={enviarDenuncia}
                      disabled={enviandoDenuncia || !motivoDenuncia.trim()}
                    >
                      {enviandoDenuncia ? 'Enviando...' : 'Enviar denuncia'}
                    </button>
                  </div>
                )}
              </>
            )}

            <button style={estilos.btnVerCompleto} onClick={() => setExpandido(v => !v)}>
              {expandido ? '▲ Ver menos' : '▼ Ver perfil completo'}
            </button>
          </>
        )}
      </div>
      </div>
      {mensajeAbierto && (
        <MensajePrivadoModal username={username} token={token} onCerrar={() => setMensajeAbierto(false)} />
      )}
    </div>
  );
}

const estilos = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000, padding: 16
  },
  // Centésimo décimo tercer pase: anillo dorado exterior (mismo criterio
  // que `anilloPanel` en la versión nativa) — envuelve a `box` con un
  // margen fino de 3px, mismos números que usa nativo (padding3, radio21
  // vs. el radio18 de `box`, así el hueco queda parejo en todo el borde).
  anillo: {
    padding: 3, borderRadius: 21, backgroundColor: C.dorado,
    boxShadow: '0 5px 0 rgba(0,0,0,0.2)', width: '90%', maxWidth: 340,
  },
  box: {
    position: 'relative',
    backgroundColor: C.cremaSutil,
    backgroundImage: 'url(/assets/images/textura-tarjeta.png)', backgroundRepeat: 'repeat',
    border: `2px solid ${C.chocolate}`, borderRadius: 18,
    padding: '22px 20px 18px',
    textAlign: 'center', maxHeight: '85vh', overflowY: 'auto'
  },
  cerrar: {
    position: 'absolute', top: 10, right: 10,
    background: '#fff', border: `2px solid ${C.chocolate}`, borderRadius: 8,
    width: 26, height: 26, cursor: 'pointer', fontSize: 13, color: C.chocolate
  },
  avatarWrap: {
    width: 76, height: 76, borderRadius: '50%', margin: '0 auto 8px',
    border: `3px solid ${C.dorado}`, overflow: 'hidden', boxShadow: '0 3px 0 rgba(0,0,0,0.15)'
  },
  avatar: { width: '100%', height: '100%', objectFit: 'cover' },
  username: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 19, color: C.chocolate },
  // Centésimo octavo pase: banda con el fondo de perfil comprado, envuelve
  // avatar+nombre. `avatarWrap`/`username` de arriba quedan intactos para
  // cuando no hay fondo (sin esta banda, tal cual estaba siempre).
  // Centésimo noveno pase: se le agrega marco (mismo borde chocolate del
  // resto de la tarjeta) y se achica/baja un poco — tapaba el botón de
  // cerrar (✕), que está en la esquina superior derecha del popup.
  encabezadoConFondo: {
    position: 'relative', borderRadius: 14, padding: '12px 10px 10px',
    margin: '16px 6px 10px', minHeight: 112,
    border: `2.5px solid ${C.chocolate}`, boxShadow: '0 3px 0 rgba(0,0,0,0.15)'
  },
  usernameConFondo: {
    background: 'rgba(255,248,237,0.88)', borderRadius: 12,
    padding: '2px 10px', display: 'inline-block'
  },
  enfrentamientos: { fontSize: 12.5, color: '#8a7267', fontStyle: 'italic', marginTop: 2, marginBottom: 10 },
  rangoBox: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#fff', border: `1.5px solid ${C.chocolate}33`, borderRadius: 20,
    padding: '4px 12px', margin: '2px 0 12px'
  },
  rangoIcono: { fontSize: 14 },
  rangoNombre: { fontSize: 13, fontWeight: 800, color: C.chocolate },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 },
  statTile: {
    background: '#fff', border: `1.5px solid ${C.chocolate}22`, borderRadius: 10, padding: '6px 2px'
  },
  statValor: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: C.chocolate },
  statLabel: { fontSize: 9.5, color: '#8a7267', fontWeight: 700, textTransform: 'uppercase' },
  bio: {
    fontSize: 12.5, color: '#6d5850', fontStyle: 'italic', background: '#fff',
    border: `1px solid ${C.chocolate}22`, borderRadius: 10, padding: '8px 10px', marginBottom: 10
  },
  insigniasHeader: { fontSize: 11, fontWeight: 800, color: '#8a7267', textTransform: 'uppercase', marginBottom: 6, textAlign: 'left' },
  insigniasFila: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8, justifyContent: 'flex-start' },
  insigniaChip: {
    fontSize: 18, background: '#fff', border: `1.5px solid ${C.doradoOscuro}`,
    borderRadius: 10, padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4,
    cursor: 'pointer',
  },
  insigniaChipBloqueada: { border: `1.5px solid ${C.chocolate}22`, opacity: 0.35, filter: 'grayscale(1)' },
  // Centésimo cuadragésimo sexto pase: resaltado del chip tocado, para que
  // quede claro cuál de las medallas corresponde a la descripción de abajo.
  insigniaChipActiva: { border: `2px solid ${C.doradoOscuro}`, boxShadow: `0 0 0 2px ${C.doradoClaro}66` },
  // Centésimo cuadragésimo segundo pase — reemplaza el emoji (que antes
  // hacía de ícono acá, ver `i.titulo.split(' ')[0]`) por la medalla
  // ilustrada. Centésimo cuadragésimo sexto pase: 20→32px, pedido
  // explícito del usuario ("donde sea [las medallas] tienen que ser un
  // poco más grandes").
  insigniaIcono: { width: 32, height: 32, objectFit: 'contain' },
  insigniaTitulo: { fontSize: 10.5, fontWeight: 700, color: C.chocolate },
  // Centésimo cuadragésimo sexto pase: texto de la medalla tocada.
  insigniaDescripcion: {
    fontSize: 12, color: '#6d5850', textAlign: 'left', background: '#fff',
    border: `1px solid ${C.chocolate}22`, borderRadius: 10, padding: '8px 10px', marginBottom: 12,
    lineHeight: 1.4,
  },
  botonera: { marginBottom: 8 },
  btnDesafiar: {
    width: '100%', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 15,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    border: `2.5px solid ${C.chocolate}`, borderRadius: 12, padding: '9px 14px',
    boxShadow: `0 4px 0 ${C.doradoOscuro}`, cursor: 'pointer'
  },
  filaAmistad: { display: 'flex', gap: 6, marginBottom: 6 },
  btnAgregarAmigo: {
    flex: 1, fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12.5,
    background: C.verde, color: '#fff', border: `2px solid ${C.verdeOscuro}`,
    borderRadius: 10, padding: '7px 4px', cursor: 'pointer'
  },
  btnAccionActivaAmigos: { background: '#e3f5e7', borderColor: C.verdeOscuro, color: C.verdeOscuro },
  btnMensaje: {
    flex: 1, fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12.5,
    background: C.celeste, color: '#fff', border: `2px solid #2f8dbf`,
    borderRadius: 10, padding: '7px 4px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  // Pase siguiente: reemplaza el emoji 💬 básico por el ícono ilustrado
  // que ya usa el resto de la app para "chat" (icono-chat.png).
  iconoBotonMensaje: { width: 15, height: 15, objectFit: 'contain' },
  filaAcciones: { display: 'flex', gap: 6, marginBottom: 6 },
  btnAccionChica: {
    flex: 1, fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12.5,
    background: '#fff', color: C.chocolate, border: `2px solid ${C.chocolate}33`,
    borderRadius: 10, padding: '7px 4px', cursor: 'pointer'
  },
  btnAccionActiva: { background: '#ffe0dd', borderColor: C.crimson, color: C.crimsonOscuro },
  panelDenuncia: {
    background: '#fff', border: `1.5px solid ${C.chocolate}33`, borderRadius: 10,
    padding: 8, marginBottom: 6, textAlign: 'left'
  },
  textareaDenuncia: {
    width: '100%', border: `1.5px solid ${C.chocolate}33`, borderRadius: 8,
    padding: 6, fontSize: 12.5, fontFamily: "'Nunito', sans-serif", resize: 'none', boxSizing: 'border-box'
  },
  mensajeDenuncia: { fontSize: 11.5, color: C.verdeOscuro, fontWeight: 700, margin: '4px 0' },
  btnEnviarDenuncia: {
    marginTop: 6, width: '100%', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 12.5,
    background: C.crimson, color: '#fff', border: 'none', borderRadius: 8, padding: '7px 0', cursor: 'pointer'
  },
  btnVerCompleto: {
    marginTop: 4, background: 'none', border: 'none', color: C.doradoOscuro,
    fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: "'Nunito', sans-serif"
  },
};