import React, { useState, useEffect, useCallback } from 'react';
import PersonajeSelector from '../Lobby/PersonajeSelector';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/auth`;
const API_BASE = `${BASE_URL}/api`;

const C = {
  dorado: '#FFB627', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', chocolate: '#4A2C2A'
};

const CLAVE_MODO_OSCURO = 'truco_modo_oscuro';
const CLAVE_BARAJA = 'truco_baraja';

// Mismo criterio de avatar que ya usan Perfil/Ranking/el header.
function avatarSrcDe(u) {
  return u?.avatar_tipo === 'foto' && u?.foto_perfil_url
    ? u.foto_perfil_url
    : `/assets/${u?.personaje || 'gaucho'}-avatar.png`;
}

export default function Configuracion({ token, usuario, onPersonajeCambiado, musicaVolumen, onCambiarMusicaVolumen, onNavegar }) {
  const [modoOscuro, setModoOscuro] = useState(false);
  const [guardandoAvatar, setGuardandoAvatar] = useState(false);
  const [baraja, setBaraja] = useState('clasica');

  useEffect(() => {
    setModoOscuro(localStorage.getItem(CLAVE_MODO_OSCURO) === 'true');
    const barajaGuardada = localStorage.getItem(CLAVE_BARAJA);
    setBaraja(barajaGuardada === 'nueva' ? 'nueva' : 'clasica');
  }, []);

  // Pase siguiente: a pedido del usuario, poder elegir si recibir
  // desafíos de amigos y/o de desconocidos — dos preferencias
  // independientes (no un solo interruptor). Se inicializan desde
  // GET /api/auth/perfil (ver App.js) y se guardan al toque en cada
  // cambio, mismo criterio "optimista" que el resto de los switches.
  const [aceptaDesafiosAmigos, setAceptaDesafiosAmigos] = useState(true);
  const [aceptaDesafiosDesconocidos, setAceptaDesafiosDesconocidos] = useState(true);

  useEffect(() => {
    if (!usuario) return;
    setAceptaDesafiosAmigos(usuario.acepta_desafios_amigos !== false);
    setAceptaDesafiosDesconocidos(usuario.acepta_desafios_desconocidos !== false);
  }, [usuario]);

  const guardarPreferenciasDesafio = async (siguienteAmigos, siguienteDesconocidos) => {
    try {
      await fetch(`${API_BASE}/usuarios/preferencias-desafio`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ aceptaAmigos: siguienteAmigos, aceptaDesconocidos: siguienteDesconocidos }),
      });
    } catch (err) {
      console.error('Error guardando preferencias de desafío:', err);
    }
  };

  const alternarAceptaDesafiosAmigos = () => {
    const siguiente = !aceptaDesafiosAmigos;
    setAceptaDesafiosAmigos(siguiente);
    guardarPreferenciasDesafio(siguiente, aceptaDesafiosDesconocidos);
  };

  const alternarAceptaDesafiosDesconocidos = () => {
    const siguiente = !aceptaDesafiosDesconocidos;
    setAceptaDesafiosDesconocidos(siguiente);
    guardarPreferenciasDesafio(aceptaDesafiosAmigos, siguiente);
  };

  // ---------- Centésimo quinto pase: usuarios bloqueados ----------
  const [bloqueados, setBloqueados] = useState([]);
  const [cargandoBloqueados, setCargandoBloqueados] = useState(true);
  const [desbloqueando, setDesbloqueando] = useState(null);

  const cargarBloqueados = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/usuarios/bloqueados`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setBloqueados(data.bloqueados || []);
    } catch (err) {
      console.error('Error cargando bloqueados:', err);
    } finally {
      setCargandoBloqueados(false);
    }
  }, [token]);

  useEffect(() => { cargarBloqueados(); }, [cargarBloqueados]);

  const desbloquear = async (username) => {
    setDesbloqueando(username);
    try {
      const res = await fetch(`${API_BASE}/usuarios/${username}/bloquear`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setBloqueados(prev => prev.filter(b => b.username !== username));
    } catch (err) {
      console.error('Error desbloqueando usuario:', err);
    } finally {
      setDesbloqueando(null);
    }
  };

  // ---------- Panel de administración: denuncias (solo rol 'admin') ----------
  const esAdmin = usuario?.rol === 'admin';
  const [denuncias, setDenuncias] = useState([]);
  const [cargandoDenuncias, setCargandoDenuncias] = useState(true);
  const [revisando, setRevisando] = useState(null);

  const cargarDenuncias = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/denuncias`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setDenuncias(data.denuncias || []);
    } catch (err) {
      console.error('Error cargando denuncias:', err);
    } finally {
      setCargandoDenuncias(false);
    }
  }, [token]);

  useEffect(() => {
    if (esAdmin) cargarDenuncias();
    else setCargandoDenuncias(false);
  }, [esAdmin, cargarDenuncias]);

  const marcarRevisada = async (id) => {
    setRevisando(id);
    try {
      const res = await fetch(`${API_BASE}/admin/denuncias/${id}/revisar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDenuncias(prev => prev.map(d => d.id === id ? { ...d, revisado: true, revisado_en: new Date().toISOString() } : d));
      }
    } catch (err) {
      console.error('Error marcando denuncia como revisada:', err);
    } finally {
      setRevisando(null);
    }
  };

  const alternarModoOscuro = (e) => {
    const valor = e.target.checked;
    setModoOscuro(valor);
    localStorage.setItem(CLAVE_MODO_OSCURO, valor ? 'true' : 'false');
  };

  const elegirBaraja = (valor) => {
    setBaraja(valor);
    localStorage.setItem(CLAVE_BARAJA, valor);
  };

  const elegirTipoAvatar = async (tipo) => {
    if (guardandoAvatar || usuario?.avatar_tipo === tipo) return;
    setGuardandoAvatar(true);
    try {
      const res = await fetch(`${API_URL}/avatar-tipo`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tipo })
      });
      if (res.ok && onPersonajeCambiado) {
        await onPersonajeCambiado();
      }
    } catch (err) {
      console.error('Error cambiando tipo de avatar:', err);
    } finally {
      setGuardandoAvatar(false);
    }
  };

  return (
    <>
      <div style={estilos.sectionTitle}>Configuración</div>

      {usuario?.foto_perfil_url && (
        <div style={estilos.panel}>
          <div style={estilos.panelTitulo}>🖼️ Foto de perfil</div>
          <div style={estilos.opcionesAvatar}>
            <button
              onClick={() => elegirTipoAvatar('foto')}
              disabled={guardandoAvatar}
              style={{
                ...estilos.opcionAvatar,
                ...(usuario.avatar_tipo === 'foto' ? estilos.opcionAvatarActiva : {})
              }}
            >
              <img src={usuario.foto_perfil_url} alt="" style={estilos.previewFoto} />
              <span style={estilos.opcionAvatarLabel}>Mi foto</span>
            </button>
            <button
              onClick={() => elegirTipoAvatar('personaje')}
              disabled={guardandoAvatar}
              style={{
                ...estilos.opcionAvatar,
                ...(usuario.avatar_tipo === 'personaje' ? estilos.opcionAvatarActiva : {})
              }}
            >
              <img src={`/assets/${usuario?.personaje || 'gaucho'}-avatar.png`} alt="" style={estilos.previewFoto} />
              <span style={estilos.opcionAvatarLabel}>Personaje</span>
            </button>
          </div>
        </div>
      )}

      <PersonajeSelector
        token={token}
        personajeActual={usuario?.personaje || 'gaucho'}
        onPersonajeCambiado={onPersonajeCambiado}
      />

      <div style={estilos.panel}>
        <div style={estilos.panelTitulo}>🌙 Modo oscuro</div>
        <label style={estilos.filaSwitch}>
          <span style={estilos.switchTexto}>Mesa nocturna en el juego</span>
          <span
            onClick={() => alternarModoOscuro({ target: { checked: !modoOscuro } })}
            style={{ ...estilos.switchPista, ...(modoOscuro ? estilos.switchPistaActiva : {}) }}
          >
            <span style={{ ...estilos.switchPerilla, ...(modoOscuro ? estilos.switchPerillaActiva : {}) }} />
          </span>
        </label>
      </div>

      {/* Pase siguiente: preferencia de "Desafiar" — dos switches
          independientes, uno para amigos y otro para desconocidos. */}
      <div style={estilos.panel}>
        <div style={estilos.panelTitulo}>⚔️ Desafíos</div>
        <label style={estilos.filaSwitch}>
          <span style={estilos.switchTexto}>Recibir desafíos de amigos</span>
          <span
            onClick={alternarAceptaDesafiosAmigos}
            style={{ ...estilos.switchPista, ...(aceptaDesafiosAmigos ? estilos.switchPistaActiva : {}) }}
          >
            <span style={{ ...estilos.switchPerilla, ...(aceptaDesafiosAmigos ? estilos.switchPerillaActiva : {}) }} />
          </span>
        </label>
        <label style={{ ...estilos.filaSwitch, marginTop: 10 }}>
          <span style={estilos.switchTexto}>Recibir desafíos de desconocidos</span>
          <span
            onClick={alternarAceptaDesafiosDesconocidos}
            style={{ ...estilos.switchPista, ...(aceptaDesafiosDesconocidos ? estilos.switchPistaActiva : {}) }}
          >
            <span style={{ ...estilos.switchPerilla, ...(aceptaDesafiosDesconocidos ? estilos.switchPerillaActiva : {}) }} />
          </span>
        </label>
      </div>

      {/* Octogésimo tercer pase: el botón de mutear música que vivía arriba
          de AppShell (en todas las pantallas con nav) se saca de ahí y se
          reemplaza por este slider — mismo `.tc-slider` y el mismo
          `musicaVolumen`/`onCambiarMusicaVolumen` (levantados en App.js)
          que ya usa el panel de configuración dentro de la partida
          (ConfiguracionMesaModal.js) — es la misma música de fondo global,
          no una pista nueva. */}
      <div style={estilos.panel}>
        <div style={estilos.panelTitulo}>🎵 Música de fondo</div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={musicaVolumen}
          onChange={(e) => onCambiarMusicaVolumen(Number(e.target.value))}
          className="tc-slider"
        />
      </div>

      <div style={estilos.panel}>
        <div style={estilos.panelTitulo}>🃏 Diseño de cartas</div>
        <div style={estilos.opcionesAvatar}>
          <button
            onClick={() => elegirBaraja('clasica')}
            style={{
              ...estilos.opcionAvatar,
              ...(baraja === 'clasica' ? estilos.opcionAvatarActiva : {})
            }}
          >
            <span style={estilos.opcionAvatarLabel}>Clásica</span>
          </button>
          <button
            onClick={() => elegirBaraja('nueva')}
            style={{
              ...estilos.opcionAvatar,
              ...(baraja === 'nueva' ? estilos.opcionAvatarActiva : {})
            }}
          >
            <span style={estilos.opcionAvatarLabel}>Diseño nuevo</span>
          </button>
        </div>
        <p style={estilos.hintBaraja}>
          El cambio se aplica la próxima vez que entres a una partida.
        </p>
      </div>

      {/* Centésimo quinto pase: lista de usuarios bloqueados + desbloquear.
          El backend ya existía (GET/DELETE en routes/usuarios.js) desde el
          nonagésimo octavo pase, no había ninguna pantalla que lo usara. */}
      <div style={estilos.panel}>
        <div style={estilos.panelTitulo}>🚫 Usuarios bloqueados</div>
        {cargandoBloqueados ? (
          <p style={estilos.hintBaraja}>Cargando...</p>
        ) : bloqueados.length === 0 ? (
          <p style={estilos.hintBaraja}>No tenés a nadie bloqueado.</p>
        ) : (
          <div style={estilos.listaBloqueados}>
            {bloqueados.map((b) => (
              <div key={b.username} style={estilos.filaBloqueado}>
                <img src={avatarSrcDe(b)} alt="" style={estilos.avatarBloqueado} />
                <span style={estilos.nombreBloqueado}>{b.username}</span>
                <button
                  style={estilos.btnDesbloquear}
                  disabled={desbloqueando === b.username}
                  onClick={() => desbloquear(b.username)}
                >
                  {desbloqueando === b.username ? 'Desbloqueando...' : 'Desbloquear'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Centésimo quinto pase: panel de administración de denuncias —
          solo visible con rol 'admin' (viaja en el JWT desde el login,
          ver routes/auth.js). Para que tu cuenta lo vea hace falta correr
          a mano `UPDATE usuarios SET rol='admin' WHERE username='...';`
          y volver a loguearte (el token viejo no tiene el rol nuevo). */}
      {esAdmin && (
        <div style={estilos.panel}>
          <div style={estilos.panelTitulo}>🚩 Denuncias (administración)</div>
          {cargandoDenuncias ? (
            <p style={estilos.hintBaraja}>Cargando...</p>
          ) : denuncias.length === 0 ? (
            <p style={estilos.hintBaraja}>No hay denuncias.</p>
          ) : (
            <div style={estilos.listaDenuncias}>
              {denuncias.map((d) => (
                <div key={d.id} style={{ ...estilos.filaDenuncia, ...(d.revisado ? estilos.filaDenunciaRevisada : {}) }}>
                  <div style={estilos.denunciaTexto}>
                    <strong>{d.denunciante}</strong> denunció a <strong>{d.denunciado}</strong>
                    <div style={estilos.denunciaMotivo}>"{d.motivo}"</div>
                    <div style={estilos.denunciaFecha}>{new Date(d.creado_en).toLocaleString()}</div>
                  </div>
                  {d.revisado ? (
                    <span style={estilos.badgeRevisada}>✓ Revisada</span>
                  ) : (
                    <button
                      style={estilos.btnRevisar}
                      disabled={revisando === d.id}
                      onClick={() => marcarRevisada(d.id)}
                    >
                      {revisando === d.id ? 'Marcando...' : 'Marcar revisada'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pase siguiente: link a la Política de Privacidad, pedido explícito
          del usuario, abajo de todo. El texto real todavía no existe (lo
          va a mandar el usuario después) — PoliticaPrivacidad.js muestra un
          placeholder mientras tanto. */}
      <div style={estilos.footerLegal}>
        <button style={estilos.linkLegal} onClick={() => onNavegar && onNavegar('privacidad')}>
          Política de Privacidad
        </button>
      </div>
    </>
  );
}

const estilos = {
  sectionTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16, color: C.crema, margin: '4px 0 10px 4px' },
  panel: {
    background: C.crema, border: `4px solid ${C.chocolate}`, borderRadius: 20,
    boxShadow: '0 6px 0 rgba(0,0,0,0.25)', padding: '18px 18px 20px', marginTop: 16
  },
  panelTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 19, color: C.chocolate, marginBottom: 14 },
  opcionesAvatar: { display: 'flex', gap: 12 },
  opcionAvatar: {
    flex: 1, background: '#fff',
    borderStyle: 'solid', borderColor: C.chocolate, borderWidth: 2.5,
    borderRadius: 14, padding: '12px 8px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 8, cursor: 'pointer'
  },
  opcionAvatarActiva: { background: '#fff5da', borderColor: C.dorado, borderWidth: 3 },
  previewFoto: { width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${C.chocolate}` },
  opcionAvatarLabel: { fontWeight: 700, fontSize: 12.5, color: C.chocolate },
  filaSwitch: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' },
  switchTexto: { fontWeight: 700, fontSize: 14, color: C.chocolate },
  switchPista: {
    width: 46, height: 26, borderRadius: 20,
    background: '#ccc', position: 'relative',
    cursor: 'pointer', transition: 'background 0.2s',
    flexShrink: 0
  },
  switchPistaActiva: { background: C.dorado },
  switchPerilla: {
    position: 'absolute', top: 3, left: 3,
    width: 20, height: 20, borderRadius: '50%',
    background: C.crema, transition: 'left 0.2s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
  },
  switchPerillaActiva: { left: 23 },
  hintBaraja: { fontSize: 12, color: '#7a6660', fontWeight: 700, marginTop: 10, marginBottom: 0 },

  // Centésimo quinto pase: usuarios bloqueados + denuncias (administración).
  listaBloqueados: { display: 'flex', flexDirection: 'column', gap: 10 },
  filaBloqueado: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: '#fff', border: `2px solid ${C.chocolate}22`, borderRadius: 12, padding: '8px 12px'
  },
  avatarBloqueado: { width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${C.chocolate}33`, flexShrink: 0 },
  nombreBloqueado: { flex: 1, fontWeight: 700, fontSize: 13.5, color: C.chocolate },
  btnDesbloquear: {
    fontSize: 12, fontWeight: 700, color: C.chocolate, background: '#fff',
    border: `2px solid ${C.chocolate}44`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer'
  },
  listaDenuncias: { display: 'flex', flexDirection: 'column', gap: 10 },
  filaDenuncia: {
    display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between',
    background: '#fff', border: '2px solid #E8483A44', borderRadius: 12, padding: '10px 12px'
  },
  filaDenunciaRevisada: { borderColor: `${C.chocolate}22`, opacity: 0.7 },
  denunciaTexto: { fontSize: 13, color: C.chocolate, flex: 1 },
  denunciaMotivo: { fontStyle: 'italic', color: '#7a6660', marginTop: 3, fontSize: 12.5 },
  denunciaFecha: { fontSize: 11, color: '#a09085', marginTop: 3 },

  footerLegal: { textAlign: 'center', padding: '18px 0 8px' },
  // Pase siguiente: el usuario reportó que el link se veía "muy oscuro"
  // (antes #7a6660, gris apagado sobre el mismo fondo crema del panel) —
  // pasa a dorado oscuro, mismo color de acento que ya usa el resto de la
  // app para elementos interactivos.
  linkLegal: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: 700, color: C.doradoOscuro, textDecoration: 'underline'
  },
  btnRevisar: {
    fontSize: 11.5, fontWeight: 700, color: C.chocolate, background: C.dorado,
    border: `2px solid ${C.chocolate}`, borderRadius: 8, padding: '6px 10px', cursor: 'pointer',
    whiteSpace: 'nowrap', flexShrink: 0
  },
  badgeRevisada: {
    fontSize: 11.5, fontWeight: 700, color: '#1f7a3c', background: '#d8f0da',
    borderRadius: 8, padding: '5px 8px', whiteSpace: 'nowrap', flexShrink: 0
  },
};