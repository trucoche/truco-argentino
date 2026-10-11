import React, { useState, useEffect, useCallback } from 'react';
import { ICONOS_LOGRO, nombreLogroSinEmoji } from '../Perfil/Perfil';
import { getSocket } from '../../services/socket';
import { useToast } from '../../contexts/ToastContext';
import MensajePrivadoModal from '../MensajePrivado/MensajePrivadoModal';
import { API_URL as BASE_URL } from '../../config';
import PopupMadera from '../Popup/PopupMadera';
import { rangoUi } from '../Perfil/rangosUi';
import './perfil-rival.css';

const API_BASE = `${BASE_URL}/api`;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8',
  crema: '#FFF8ED', chocolate: '#4A2C2A', cremaSutil: '#FFFCF6'
};

// Mismo criterio de avatar que ya usan Perfil/Ranking/el header.
// Pase 421: dentro del aro de madera se usa el recorte de la CARA (más zoom, más presencia).
function avatarSrcDe(u) {
  return u?.avatar_tipo === 'foto' && u?.foto_perfil_url
    ? u.foto_perfil_url
    : `/assets/${u?.personaje || 'gaucho'}-avatar-cara.png`;
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

  const u = datos ? datos.usuario : null;
  // Pase 422: el aro que rodea al personaje es el de SU rango y el logo del rango va en la píldora.
  const rUi = rangoUi(u && u.rango);
  const TAM_ARO = 120;
  const TAM_FOTO = Math.round(TAM_ARO * rUi.hueco) + 2;
  const encabezado = datos && (
    <>
      <div style={estilos.avatarAro}>
        <div style={{ ...estilos.avatarHueco, width: TAM_FOTO, height: TAM_FOTO }}>
          <img src={avatarSrcDe(u)} alt="" style={estilos.avatarImg} />
        </div>
        <img src={rUi.anillo} alt="" style={estilos.aroImg} />
      </div>
      <div style={estilos.placaNombre}>{u.username}</div>
    </>
  );

  const lanzarDesafio = () => {
    // Pase siguiente: si ya hay un desafío esperando respuesta, NO se manda otro (bug real: mandar dos desafíos
    // al mismo usuario hacía que el segundo pisara al primero del lado del receptor) — se avisa con un toast.
    if (desafioEnviado) {
      mostrarToast('Esperando respuesta de tu desafío anterior...', 'info');
      return;
    }
    getSocket().emit('desafio:enviar', { paraUsername: username });
    setDesafioEnviado(true);
    // 30s — mismo tiempo que tiene el otro para responder en el servidor.
    setTimeout(() => setDesafioEnviado(false), 30000);
  };

  return (
    <div className="pr-popup">
      <PopupMadera visible onCerrar={onClose} scroll anchoMax={340}>
        {cargando ? (
          <p style={{ color: '#7a6660', textAlign: 'center', padding: '30px 0' }}>Cargando...</p>
        ) : error ? (
          <p style={{ color: C.crimsonOscuro, textAlign: 'center', padding: '30px 0', fontWeight: 700 }}>{error}</p>
        ) : datos && (
          <>
            {/* Centésimo octavo pase: el fondo comprado va como imagen de fondo de la zona que rodea al avatar y
                al nombre (no detrás del personaje). */}
            {u.fondo_perfil_url ? (
              <div
                style={{
                  ...estilos.encabezadoConFondo,
                  backgroundImage: `linear-gradient(rgba(20,20,15,0.05), rgba(20,20,15,0.32)), url(${u.fondo_perfil_url})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              >
                {encabezado}
              </div>
            ) : (
              <div style={estilos.encabezadoSinFondo}>{encabezado}</div>
            )}

            {!datos.esUnoMismo && (
              <div style={estilos.enfrentamientos}>
                {datos.enfrentamientos > 0
                  ? `Se enfrentaron ${datos.enfrentamientos} ${datos.enfrentamientos === 1 ? 'vez' : 'veces'}`
                  : '¡Nunca se enfrentaron!'}
              </div>
            )}

            <div style={estilos.rangoBox}>
              <img src={rangoUi(u.rango).logo} alt="" style={estilos.rangoIcono} />
              <span style={estilos.rangoNombre}>
                {u.rango.esTop500
                  ? `${u.rango.nombre} · #${u.rango.posicion ?? '—'}`
                  : `${u.rango.nombre} ${u.rango.division}`}
              </span>
            </div>

            {/* Centésimo tercer pase: "Puntos" (rango) se reemplaza por "Jugadas". Pase 421: placas de papel viejo. */}
            <div style={estilos.statsGrid}>
              {[
                { valor: u.partidas_jugadas, etiqueta: 'Jugadas', color: C.chocolate },
                { valor: u.partidas_ganadas, etiqueta: 'Ganadas', color: C.verdeOscuro },
                { valor: u.partidas_perdidas, etiqueta: 'Perdidas', color: C.crimsonOscuro },
                { valor: `${u.porcentajeAbandonos}%`, etiqueta: 'Abandonos', color: C.chocolate },
              ].map((t) => (
                <div key={t.etiqueta} style={estilos.statTile}>
                  <div style={estilos.statTileBrillo} />
                  <div style={{ ...estilos.statValor, color: t.color }}>{t.valor}</div>
                  <div style={estilos.statLabel}>{t.etiqueta}</div>
                </div>
              ))}
            </div>

            <div style={estilos.insigniasEncabezado}>
              <span style={estilos.insigniasLinea} />
              <span style={estilos.insigniasHeader}>Insignias</span>
              <span style={estilos.insigniasLinea} />
            </div>
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

            {/* Centésimo cuadragésimo sexto pase: al tocar una medalla se muestra acá su descripción. */}
            {insigniaAbierta && (() => {
              const sel = datos.insignias.find(i => i.tipo === insigniaAbierta);
              if (!sel) return null;
              return (
                <div style={estilos.insigniaDescripcion}>
                  <strong style={{ color: '#5C3317' }}>{nombreLogroSinEmoji(sel.titulo)}:</strong> {sel.descripcion || 'Sin descripción todavía.'}
                </div>
              );
            })()}

            {!datos.esUnoMismo && (
              <>
                <button type="button" className="pm-boton pr-boton" style={estilos.btnDesafiar} onClick={lanzarDesafio}>
                  <img src={desafioEnviado ? '/assets/images/icono-check.png' : '/assets/images/icono-desafios.png'} alt="" style={estilos.iconoGrande} />
                  {desafioEnviado ? 'Desafío enviado...' : 'Desafiar'}
                </button>

                {/* Pase siguiente: fila de amistad — un solo botón (o dos, si hay una solicitud recibida esperando
                    respuesta) según `datos.amistad`. */}
                <div style={estilos.filaPills}>
                  {datos.amistad === 'ninguna' && (
                    <button type="button" className="pm-boton verde pr-boton" style={estilos.pill} onClick={solicitarAmistad} disabled={procesandoAmistad}>
                      <IconoMas /> Agregar amigo
                    </button>
                  )}
                  {datos.amistad === 'pendiente_enviada' && (
                    <button type="button" className="pm-boton neutro pr-boton" style={estilos.pill} onClick={quitarAmistad} disabled={procesandoAmistad}>
                      <img src="/assets/images/historial-cruz.png" alt="" style={estilos.iconoPill} /> Cancelar solicitud
                    </button>
                  )}
                  {datos.amistad === 'pendiente_recibida' && (
                    <>
                      <button type="button" className="pm-boton verde pr-boton" style={estilos.pill} onClick={aceptarAmistad} disabled={procesandoAmistad}>
                        <img src="/assets/images/icono-check.png" alt="" style={estilos.iconoPill} /> Aceptar
                      </button>
                      <button type="button" className="pm-boton neutro pr-boton" style={estilos.pill} onClick={quitarAmistad} disabled={procesandoAmistad}>
                        <img src="/assets/images/historial-cruz.png" alt="" style={estilos.iconoPill} /> Rechazar
                      </button>
                    </>
                  )}
                  {datos.amistad === 'amigos' && (
                    <>
                      <button type="button" className="pm-boton neutro pr-boton" style={{ ...estilos.pill, color: C.verdeOscuro }} onClick={quitarAmistad} disabled={procesandoAmistad}>
                        <img src="/assets/images/icono-check.png" alt="" style={estilos.iconoPill} /> Amigos (quitar)
                      </button>
                      <button type="button" className="pm-boton pr-boton" style={{ ...estilos.pill, '--pm-fondo': '#3FA6D6', '--pm-relieve': '#1F6F96' }} onClick={() => setMensajeAbierto(true)}>
                        <img src="/assets/images/icono-avioncito-chat.png" alt="" style={estilos.iconoPill} /> Mensaje
                      </button>
                    </>
                  )}
                </div>

                <div style={estilos.filaPills}>
                  <button
                    type="button"
                    className="pm-boton neutro pr-boton"
                    style={{ ...estilos.pill, ...(datos.bloqueado ? { '--pm-fondo': '#FFE0DD', '--pm-relieve': '#C98A84', color: C.crimsonOscuro } : {}) }}
                    onClick={toggleBloqueo}
                    disabled={bloqueando}
                  >
                    <img src={datos.bloqueado ? '/assets/images/icono-check.png' : '/assets/images/icono-bloqueados.png'} alt="" style={estilos.iconoPill} />
                    {datos.bloqueado ? ' Bloqueado' : ' Bloquear'}
                  </button>
                  <button type="button" className="pm-boton neutro pr-boton" style={estilos.pill} onClick={() => setMostrarDenuncia(v => !v)}>
                    <IconoBandera /> Denunciar
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
                      type="button"
                      className="pm-boton carmesi pr-boton"
                      style={{ ...estilos.pill, marginTop: 8 }}
                      onClick={enviarDenuncia}
                      disabled={enviandoDenuncia || !motivoDenuncia.trim()}
                    >
                      {enviandoDenuncia ? 'Enviando...' : 'Enviar denuncia'}
                    </button>
                  </div>
                )}
              </>
            )}

            <button type="button" style={estilos.btnVerCompleto} onClick={() => setExpandido(v => !v)}>
              {expandido ? 'Ver menos' : 'Ver perfil completo'}
              <img src="/assets/images/historial-flecha.png" alt="" style={{ ...estilos.flechaVerMas, transform: expandido ? 'rotate(180deg)' : 'none' }} />
            </button>
          </>
        )}
      </PopupMadera>
      {mensajeAbierto && (
        // Por encima del pop-up de madera (z-index 3500): contexto de apilamiento propio.
        <div style={{ position: 'relative', zIndex: 3700 }}>
          <MensajePrivadoModal username={username} token={token} onCerrar={() => setMensajeAbierto(false)} />
        </div>
      )}
    </div>
  );
}

// Pase 421: íconos vectoriales para lo que no tiene PNG en el juego (el "+" y la bandera de denuncia).
function IconoMas() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style={{ verticalAlign: '-3px', margin: '0 4px' }}>
      <rect x="6.5" y="2" width="3" height="12" rx="1.5" fill="#fff" stroke="#000" strokeWidth="0.8" />
      <rect x="2" y="6.5" width="12" height="3" rx="1.5" fill="#fff" stroke="#000" strokeWidth="0.8" />
    </svg>
  );
}
function IconoBandera() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" style={{ verticalAlign: '-4px', margin: '0 4px' }}>
      <rect x="3" y="1.5" width="2" height="15" rx="1" fill="#6b4a34" stroke="#2C160E" strokeWidth="0.8" />
      <path d="M5 2.5 L15.5 2.5 L13 6.3 L15.5 10.1 L5 10.1 Z" fill="#E74C3C" stroke="#2C160E" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

const estilos = {
  encabezadoSinFondo: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 6 },
  encabezadoConFondo: {
    position: 'relative', borderRadius: 14, padding: '8px 10px 10px', margin: '2px 0 8px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    border: '2.5px solid #1a0f08', boxShadow: '0 3px 0 rgba(0,0,0,0.25)',
  },
  avatarAro: { position: 'relative', width: 120, height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatarHueco: { borderRadius: '50%', overflow: 'hidden', background: '#EAD9B5', flexShrink: 0 },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  aroImg: { position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' },
  placaNombre: {
    marginTop: 2, height: 34, padding: '0 18px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    background: '#5C3317', border: '2px solid #1a0f08', borderRadius: 8, boxShadow: '0 2px 0 rgba(0,0,0,0.5)',
    fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 16, color: '#FFF8ED', maxWidth: '100%',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', boxSizing: 'border-box',
  },
  enfrentamientos: { fontSize: 12.5, color: '#7a5a3a', fontStyle: 'italic', marginBottom: 10 },
  rangoBox: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    background: '#EAD9B5', border: '2px solid #6b4a34', borderRadius: 20,
    padding: '3px 16px 3px 6px', margin: '0 0 12px',
  },
  rangoIcono: { width: 34, height: 34, objectFit: 'contain', flexShrink: 0 },
  rangoNombre: { fontSize: 13, fontWeight: 800, color: '#3B2312' },
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 12 },
  statTile: {
    position: 'relative', overflow: 'hidden', background: '#EAD9B5', border: '2px solid #6b4a34', borderRadius: 10,
    padding: '9px 2px 6px',
  },
  statTileBrillo: { position: 'absolute', top: 0, left: 0, right: 0, height: 5, background: 'rgba(137,104,60,0.40)' },
  statValor: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: C.chocolate, lineHeight: 1.2 },
  statLabel: { fontSize: 8.5, letterSpacing: 0, color: '#7a5a3a', fontWeight: 800, textTransform: 'uppercase' },
  insigniasEncabezado: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  insigniasLinea: { flex: 1, height: 2, borderRadius: 1, background: 'rgba(107,74,52,0.35)' },
  insigniasHeader: { fontSize: 11, fontWeight: 800, color: '#6b4a34', textTransform: 'uppercase', letterSpacing: 1 },
  insigniasFila: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12, justifyContent: 'center' },
  insigniaChip: {
    fontSize: 18, background: '#F6EBD0', border: `2px solid ${C.doradoOscuro}`,
    borderRadius: 10, padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 4,
    cursor: 'pointer',
  },
  insigniaChipBloqueada: { border: '2px solid rgba(107,74,52,0.35)', background: '#EAD9B5', opacity: 0.5 },
  insigniaChipActiva: { border: '2px solid #5C3317', background: '#FFF3CC' },
  insigniaIcono: { width: 32, height: 32, objectFit: 'contain' },
  insigniaTitulo: { fontSize: 10.5, fontWeight: 700, color: '#3B2312' },
  insigniaDescripcion: {
    fontSize: 12, color: '#3B2312', textAlign: 'left', background: '#F6EBD0',
    border: '2px solid #6b4a34', borderRadius: 10, padding: '8px 10px', marginBottom: 12,
    lineHeight: 1.4,
  },
  // Botones: cápsulas 3D del pop-up de madera (.pm-boton), en tamaño chico
  btnDesafiar: { fontSize: 16, padding: '9px 16px 10px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  iconoGrande: { width: 28, height: 28, objectFit: 'contain', margin: 0 },
  filaPills: { display: 'flex', gap: 8, marginBottom: 12 },
  pill: {
    flex: 1, width: 'auto', minWidth: 0, fontSize: 12.5, padding: '7px 6px 8px', margin: 0, letterSpacing: 0,
    WebkitTextStroke: '0px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, whiteSpace: 'nowrap',
  },
  iconoPill: { width: 18, height: 18, objectFit: 'contain', margin: '0 2px 0 0' },
  panelDenuncia: {
    background: '#F6EBD0', border: '2px solid #6b4a34', borderRadius: 10,
    padding: 8, marginBottom: 12, textAlign: 'left'
  },
  textareaDenuncia: {
    width: '100%', border: '1.5px solid rgba(107,74,52,0.5)', borderRadius: 8, background: '#FFFBEB', color: '#3B2312',
    padding: 6, fontSize: 12.5, fontFamily: "'Nunito', sans-serif", resize: 'none', boxSizing: 'border-box'
  },
  mensajeDenuncia: { fontSize: 11.5, color: C.verdeOscuro, fontWeight: 700, margin: '4px 0' },
  btnVerCompleto: {
    marginTop: 2, background: 'none', border: 'none', color: '#6b4a34',
    fontWeight: 800, fontSize: 12.5, cursor: 'pointer', fontFamily: "'Nunito', sans-serif",
    display: 'inline-flex', alignItems: 'center', gap: 6,
  },
  flechaVerMas: { width: 18, height: 18, objectFit: 'contain' },
};
