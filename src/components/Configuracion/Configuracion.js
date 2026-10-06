import React, { useState, useEffect, useCallback } from 'react';
import PersonajeSelector from '../Lobby/PersonajeSelector';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/auth`;
const API_BASE = `${BASE_URL}/api`;

const C = {
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', cremaSutil: '#FFFCF6', chocolate: '#4A2C2A'
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
  const [enviandoEliminacion, setEnviandoEliminacion] = useState(false);

  // Pase 312: "Eliminar mi cuenta" manda directo el mail de confirmación a la
  // casilla registrada (POST /api/auth/solicitar-eliminacion-propia) en vez de
  // abrir otra página. La cuenta recién se desactiva al hacer clic en el link.
  const pedirEliminacionCuenta = async () => {
    if (enviandoEliminacion) return;
    if (!window.confirm('Te vamos a enviar un mail para confirmar la eliminación de tu cuenta. Recién cuando abras el enlace del mail se desactiva, y tenés 30 días para arrepentirte volviendo a iniciar sesión. ¿Enviar el mail?')) return;
    setEnviandoEliminacion(true);
    try {
      const res = await fetch(`${API_URL}/solicitar-eliminacion-propia`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        window.alert(`Te enviamos un mail a ${data.email || 'tu casilla registrada'} para confirmar la eliminación. Abrilo y entrá al enlace dentro de la próxima hora. Si no lo ves, revisá la carpeta de spam.`);
      } else {
        window.alert(data.error || 'No pudimos enviar el mail. Probá de nuevo en un rato.');
      }
    } catch (err) {
      console.error('Error pidiendo eliminación de cuenta:', err);
      window.alert('No pudimos comunicarnos con el servidor. Probá de nuevo en un rato.');
    } finally {
      setEnviandoEliminacion(false);
    }
  };
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

      {/* Ducentésimo trigésimo noveno pase: rediseño estético pedido por el
          usuario — todas las secciones pasan a vivir dentro de un
          contenedor con `gap` en vez de que cada panel maneje su propio
          `marginTop`/`marginBottom` suelto (antes 16px sueltos por panel,
          más los propios de PersonajeSelector) — mismo criterio que ya usa
          la Tienda (`estilos.filas`) para una pantalla "más compacta" sin
          perder aire entre secciones. */}
      <div style={estilos.contenedor}>

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
        {/* Ducentésimo cuadragésimo pase: el usuario pasó iconos ilustrados
            propios (luna/espadas/nota, estilo madera+dorado) para reemplazar
            los emojis de estos 3 títulos — "faltan algunos" (el resto de
            las secciones se queda con emoji hasta que lleguen). */}
        <div style={estilos.panelTitulo}>
          <img src="/assets/images/icono-modo-oscuro.png" alt="" style={estilos.panelTituloIcono} />
          Modo oscuro
        </div>
        <label style={estilos.filaSwitch}>
          <span style={estilos.switchTexto}>Mesa nocturna en el juego</span>
          {/* Ducentésimo cuadragésimo pase: el switch CSS (pista+perilla
              dibujados) se reemplaza por el control ilustrado que pasó el
              usuario (madera+dorado, coherente con el resto del rediseño)
              — un solo <img> que cambia de fuente según el estado, mismo
              criterio que ya usan los botones de precio de la Tienda. */}
          <img
            src={modoOscuro ? '/assets/images/switch-on.png' : '/assets/images/switch-off.png'}
            alt=""
            onClick={() => alternarModoOscuro({ target: { checked: !modoOscuro } })}
            style={estilos.switchImagen}
          />
        </label>
      </div>

      {/* Pase siguiente: preferencia de "Desafiar" — dos switches
          independientes, uno para amigos y otro para desconocidos. */}
      <div style={estilos.panel}>
        <div style={estilos.panelTitulo}>
          <img src="/assets/images/icono-desafios.png" alt="" style={estilos.panelTituloIcono} />
          Desafíos
        </div>
        <label style={estilos.filaSwitch}>
          <span style={estilos.switchTexto}>Recibir desafíos de amigos</span>
          <img
            src={aceptaDesafiosAmigos ? '/assets/images/switch-on.png' : '/assets/images/switch-off.png'}
            alt=""
            onClick={alternarAceptaDesafiosAmigos}
            style={estilos.switchImagen}
          />
        </label>
        {/* Ducentésimo trigésimo noveno pase: "mejorar el espaciado interno
            para que no se vea apretado" — más separación con la fila de
            arriba (10→16) y un separador fino propio, en vez de solo un
            margen, para que las 2 filas se lean como opciones distintas. */}
        <label style={{ ...estilos.filaSwitch, marginTop: 16, paddingTop: 14, borderTop: `1.5px solid ${C.chocolate}18` }}>
          <span style={estilos.switchTexto}>Recibir desafíos de desconocidos</span>
          <img
            src={aceptaDesafiosDesconocidos ? '/assets/images/switch-on.png' : '/assets/images/switch-off.png'}
            alt=""
            onClick={alternarAceptaDesafiosDesconocidos}
            style={estilos.switchImagen}
          />
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
        <div style={estilos.panelTitulo}>
          <img src="/assets/images/icono-musica.png" alt="" style={estilos.panelTituloIcono} />
          Música de fondo
        </div>
        {/* Ducentésimo trigésimo noveno pase: "rediseñar el slider... más
            grueso, con mejor control visual... iconos de volumen bajo/alto
            si es posible" — se agrega `tc-slider-grande` (ver el `<style>`
            inyectado al final del archivo) ADEMÁS de `tc-slider`, en vez de
            engrosar la clase base: `.tc-slider` es compartida con el mismo
            control dentro de la partida (ConfiguracionMesaModal.js) y no
            hace falta tocar esa pantalla para este pedido puntual. Los
            iconos de parlante van a los costados, no arriba, para no sumar
            otra fila de alto. */}
        <div style={estilos.filaSlider}>
          {/* Ducentésimo cuadragésimo quinto pase: se saca también el 🔊 de
              la derecha — el usuario lo pidió afuera, quedaba de más al
              lado del tronco de madera ilustrado.
              Ducentésimo cuadragésimo octavo pase: el usuario reportó que
              el círculo (thumb) se corre por fuera de la barra (llega a
              taparse con las puntas del tronco) y queda un poco por debajo
              del centro real de la imagen. Antes el <input> mismo llevaba
              la imagen de fondo Y controlaba el recorrido del thumb con su
              ancho completo (250px) — pero el recorrido nativo de un
              range input lleva el CENTRO del thumb de 0 a 250 (o sea, el
              BORDE del thumb llega a tocar 0 y 250 justo), lo que lo hace
              pisar las puntas ilustradas del tronco en vez de quedarse en
              el tramo recto de en medio. Se separa en dos capas: este
              `<div>` de afuera (`sliderPistaContenedor`) lleva la imagen de
              fondo a tamaño fijo, y el `<input>` de adentro se acorta
              (`sliderInput`, ver el `<style>` inyectado) para que su
              recorrido real quede contenido en el tramo recto del tronco,
              no en las puntas. */}
          <div style={estilos.sliderPistaContenedor}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={musicaVolumen}
              onChange={(e) => onCambiarMusicaVolumen(Number(e.target.value))}
              className="tc-slider tc-slider-grande"
            />
          </div>
        </div>
      </div>

      <div style={estilos.panel}>
        <div style={estilos.panelTitulo}>
          {/* Ducentésimo cuadragésimo tercer pase: el ícono de las 3 cartas
              reemplaza el 🃏 acá también, no solo en el preview del botón
              "Diseño nuevo" de más abajo. */}
          <img src="/assets/images/icono-cartas-nueva.png" alt="" style={estilos.panelTituloIcono} />
          Diseño de cartas
        </div>
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
            {/* Ducentésimo cuadragésimo segundo pase: preview ilustrado del
                mazo "Diseño nuevo" (asset del usuario) — todavía falta el
                equivalente para "Clásica", que se suma cuando llegue. */}
            <img src="/assets/images/icono-cartas-nueva.png" alt="" style={estilos.previewCartas} />
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
        <div style={estilos.panelTitulo}>
          <img src="/assets/images/icono-bloqueados.png" alt="" style={estilos.panelTituloIcono} />
          Usuarios bloqueados
        </div>
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

      {/* Pase 311/312: "Mi cuenta" — acceso a eliminar la cuenta. Manda un mail
          de confirmación al email registrado; 30 días de arrepentimiento. */}
      <div style={estilos.panel}>
        <div style={estilos.panelTitulo}>👤 Mi cuenta</div>
        <p style={{ ...estilos.hintBaraja, marginTop: 0 }}>
          Si querés eliminar tu cuenta, te mandamos un mail a tu casilla registrada para confirmarlo. Tenés 30 días para arrepentirte volviendo a iniciar sesión.
        </p>
        <button
          style={estilos.btnEliminarCuenta}
          disabled={enviandoEliminacion}
          onClick={pedirEliminacionCuenta}
        >
          {enviandoEliminacion ? 'Enviando…' : 'Eliminar mi cuenta'}
        </button>
      </div>

      {/* Links legales abajo de todo (Política de Privacidad y, desde el pase
          312, Términos de Servicio — se enlazan entre sí). */}
      <div style={estilos.footerLegal}>
        <button style={estilos.linkLegal} onClick={() => onNavegar && onNavegar('privacidad')}>
          Política de Privacidad
        </button>
        <span style={estilos.separadorLegal}>·</span>
        <button style={estilos.linkLegal} onClick={() => onNavegar && onNavegar('terminos')}>
          Términos de Servicio
        </button>
      </div>
      </div>
    </>
  );
}

const estilos = {
  sectionTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16, color: C.crema, margin: '4px 0 10px 4px' },
  // Ducentésimo trigésimo noveno pase: `contenedor` reemplaza los
  // márgenes sueltos de cada panel — ver el comentario junto al JSX. Gap
  // más chico que el que tenía cada panel antes (16→12) a pedido explícito
  // del usuario ("reducir un poco el espacio vacío entre secciones").
  contenedor: { display: 'flex', flexDirection: 'column', gap: 12 },
  // Ducentésimo trigésimo noveno pase: rediseño "premium" pedido por el
  // usuario — mismo fondo/radio de antes, pero con un borde superior
  // dorado más grueso (remate tipo placa/bisagra de bronce, coherente con
  // los acentos amarillos/naranjas del resto del juego) en vez de un marco
  // chocolate uniforme en las 4 caras, más un degradé sutil de fondo y una
  // sombra en dos capas (la de "relieve" de siempre + una difusa para dar
  // más profundidad) — el `marginTop` que tenía se saca, ahora lo pone el
  // `gap` de `contenedor`.
  panel: {
    background: `linear-gradient(180deg, ${C.cremaSutil} 0%, ${C.crema} 100%)`,
    borderTop: `5px solid ${C.doradoOscuro}`,
    borderRight: `3px solid ${C.chocolate}`,
    borderBottom: `3px solid ${C.chocolate}`,
    borderLeft: `3px solid ${C.chocolate}`,
    borderRadius: 18,
    boxShadow: `0 6px 0 ${C.chocolate}, 0 10px 18px rgba(0,0,0,0.28), inset 0 1px 0 rgba(255,255,255,0.5)`,
    padding: '16px 18px 18px',
  },
  // Ducentésimo trigésimo noveno pase: "títulos de sección más claros y
  // con mejor peso" — 600→700, 19→20px, y un separador fino debajo (mismo
  // criterio que un `<hr/>` sutil) para marcar mejor la jerarquía título/
  // contenido sin agregar otro elemento visual pesado.
  // Ducentésimo cuadragésimo pase: `panelTitulo` pasa a fila flex (antes
  // solo texto) para poder meterle un `<img>` de ícono adelante en los 3
  // títulos que ya tienen asset nuevo (Modo oscuro/Desafíos/Música) — los
  // títulos que siguen con emoji (texto suelto, sin `<img>`) se ven igual
  // que antes, `align-items:center` los centra igual en la fila.
  panelTitulo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 20, color: C.chocolate,
    letterSpacing: 0.2, marginBottom: 14, paddingBottom: 10,
    borderBottom: `2px solid ${C.chocolate}1a`,
    display: 'flex', alignItems: 'center', gap: 8,
  },
  panelTituloIcono: { width: 26, height: 26, objectFit: 'contain', flexShrink: 0 },
  opcionesAvatar: { display: 'flex', gap: 12 },
  opcionAvatar: {
    flex: 1, background: '#fff',
    borderStyle: 'solid', borderColor: C.chocolate, borderWidth: 2.5,
    borderRadius: 14, padding: '12px 8px', display: 'flex', flexDirection: 'column',
    alignItems: 'center', gap: 8, cursor: 'pointer'
  },
  // Ducentésimo trigésimo noveno pase: "el botón activo debe destacar
  // más" (pedido explícito para Diseño de cartas, mismo estilo que ya
  // comparte Foto de perfil) — de un fondo plano clarito a un degradé
  // dorado + borde más grueso y oscuro + sombra de relieve, mismo criterio
  // que ya usa la tarjeta activa de "Tu personaje" (ver PersonajeSelector.js).
  opcionAvatarActiva: {
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`,
    borderColor: C.doradoOscuro, borderWidth: 3.5,
    boxShadow: `0 3px 0 ${C.doradoOscuro}`,
  },
  previewFoto: { width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${C.chocolate}` },
  // Ducentésimo cuadragésimo segundo pase: preview de "Diseño de cartas" —
  // a diferencia de `previewFoto` (foto de perfil circular con borde) esto
  // es una ilustración de mazo, sin recorte circular ni borde propio.
  previewCartas: { width: 46, height: 46, objectFit: 'contain' },
  opcionAvatarLabel: { fontWeight: 700, fontSize: 12.5, color: C.chocolate },
  filaSwitch: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '3px 0' },
  // Ducentésimo trigésimo noveno pase: "el texto secundario puede ser un
  // poco más visible" (Modo oscuro) — 700→800, 14→14.5px.
  switchTexto: { fontWeight: 800, fontSize: 14.5, color: C.chocolate },
  // Ducentésimo cuadragésimo pase: el switch dibujado en CSS (pista+perilla)
  // se reemplaza por el control ilustrado que pasó el usuario — un solo
  // `<img>` con dos fuentes (`switch-off.png`/`switch-on.png`) en vez de 4
  // estilos combinados a mano.
  switchImagen: { width: 50, height: 26, objectFit: 'contain', cursor: 'pointer', flexShrink: 0 },
  hintBaraja: { fontSize: 12, color: '#7a6660', fontWeight: 700, marginTop: 10, marginBottom: 0 },

  // Ducentésimo cuadragésimo quinto pase: ya no quedan iconos de volumen
  // a los costados (el asset de la pista trae el suyo propio dibujado y
  // el usuario pidió sacar el que quedaba afuera) — se saca también
  // `iconoVolumen`, que ya no se usa en ningún lado.
  filaSlider: { display: 'flex', alignItems: 'center', gap: 10 },
  // Ducentésimo cuadragésimo octavo pase: contenedor que lleva la imagen
  // del tronco de madera a tamaño fijo (ver el comentario grande en el
  // JSX) — el <input> real vive adentro, ya sin imagen de fondo propia,
  // acortado y centrado para que su recorrido de thumb no pise las
  // puntas ilustradas del tronco.
  sliderPistaContenedor: {
    position: 'relative',
    width: 250, maxWidth: '100%', height: 54,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backgroundImage: 'url(/assets/images/slider-fondo.png)',
    backgroundSize: '100% 100%',
    backgroundRepeat: 'no-repeat',
    flexShrink: 0,
  },

  // Centésimo quinto pase: usuarios bloqueados + denuncias (administración).
  listaBloqueados: { display: 'flex', flexDirection: 'column', gap: 10 },
  // Ducentésimo trigésimo noveno pase: "mejorar la fila del usuario
  // bloqueado" — borde/padding más presentes (antes un borde casi
  // invisible `chocolate22`) y avatar más grande (32→40) para que se lea
  // como una fila de contacto real, no un renglón de lista suelto.
  filaBloqueado: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: '#fff', border: `2px solid ${C.chocolate}33`, borderRadius: 14, padding: '10px 14px',
    boxShadow: '0 2px 0 rgba(0,0,0,0.08)',
  },
  avatarBloqueado: { width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${C.chocolate}44`, flexShrink: 0 },
  nombreBloqueado: { flex: 1, fontWeight: 800, fontSize: 14.5, color: C.chocolate },
  // Ducentésimo trigésimo noveno pase: "hacer el botón Desbloquear más
  // visible" — de un outline chocolate sobre blanco (se perdía al lado del
  // resto de la fila) a la misma píldora dorada de relieve que ya usan los
  // botones activos de esta pantalla, para que se lea como una acción real
  // y no como un detalle secundario.
  btnDesbloquear: {
    fontSize: 12.5, fontWeight: 800, color: C.chocolate,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`,
    border: `2px solid ${C.doradoOscuro}`, borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
    boxShadow: `0 2px 0 ${C.doradoOscuro}`, whiteSpace: 'nowrap', flexShrink: 0,
  },
  btnEliminarCuenta: {
    marginTop: 12, fontSize: 13, fontWeight: 800, color: '#fff', background: '#E8483A',
    border: '2px solid #9c2418', borderRadius: 10, padding: '9px 16px', cursor: 'pointer',
    boxShadow: '0 2px 0 #9c2418',
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
  separadorLegal: { margin: '0 10px', color: C.crema, opacity: 0.65 },
  // Pase siguiente: el usuario reportó que el link se veía "muy oscuro"
  // (antes #7a6660, gris apagado sobre el mismo fondo crema del panel) —
  // pasa a dorado oscuro, mismo color de acento que ya usa el resto de la
  // app para elementos interactivos.
  // Ducentésimo trigésimo noveno pase: "puede ser un poco más discreto pero
  // legible" — el dorado sólido competía de más al ser el único elemento
  // brillante fuera de las tarjetas; se cambia al mismo criterio que ya usa
  // el texto legal de la Tienda (`notaPie`: crema con opacidad reducida en
  // vez de un acento de color), más chico y sin negrita.
  linkLegal: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, color: C.crema, opacity: 0.65, textDecoration: 'underline'
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

// Ducentésimo trigésimo noveno pase: engrosa el slider de música SOLO en
// esta pantalla — .tc-slider (definido en app-shell.css) es compartido
// con el mismo control dentro de la partida (ConfiguracionMesaModal.js),
// así que en vez de tocar esa clase base se agrega este modificador
// (mismo patrón de estilo inyectado una sola vez que ya usa Tienda.js
// para su hover de botones).
//
// Ducentésimo cuadragésimo tercer pase: el usuario pasó 2 assets de
// tronco de madera (pista + nudo/thumb con anillos) para reemplazar el
// look plano dorado por uno ilustrado.
//
// Ducentésimo cuadragésimo cuarto pase: la primera version de esto usaba
// border-image con la pista estirando el tramo central para llenar el
// 100% del ancho del panel — el usuario reportó que al agrandar la
// ventana (panel más ancho) esa parte central se notaba estirada/
// deformada. Se saca el estiramiento por completo: la pista ahora tiene
// un ancho fijo, igual al tamaño real de la imagen (250x54), así nunca
// se re-escala en ningún eje y no hay forma de que se deforme sin
// importar cuán ancha esté la ventana. max-width: 100% es sólo un
// resguardo para pantallas angostas (mobile) donde el panel mismo mide
// menos de 250px de ancho.
//
// Ducentésimo cuadragésimo octavo pase: la imagen de fondo se saca de
// acá y pasa al `<div>` contenedor (`sliderPistaContenedor`, ver el JSX)
// — este `<input>` ahora es más angosto que el contenedor (15px de
// margen a cada lado, `calc(100% - 30px)`) para que el recorrido del
// thumb quede contenido en el tramo recto del tronco, sin tocar las
// puntas ilustradas. También se define `::-webkit-slider-runnable-
// track`/`-moz-range-track` de forma explícita (54px, igual que el
// contenedor): sin esto el navegador arma una pista invisible con su
// propio alto por default, y el `margin-top` del thumb (pensado para
// centrarlo contra una pista de 54px) terminaba centrado contra ESE
// alto default en cambio — la causa real de que el círculo quedara un
// poco por debajo del centro visual del tronco.
if (typeof document !== 'undefined' && !document.getElementById('config-slider-grande')) {
  const style = document.createElement('style');
  style.id = 'config-slider-grande';
  style.textContent = `
    .tc-slider.tc-slider-grande {
      width: calc(100% - 30px);
      height: 54px;
      background: transparent;
      border: none;
      border-radius: 0;
    }
    .tc-slider.tc-slider-grande::-webkit-slider-runnable-track {
      width: 100%;
      height: 54px;
      background: transparent;
      border: none;
    }
    .tc-slider.tc-slider-grande::-moz-range-track {
      width: 100%;
      height: 54px;
      background: transparent;
      border: none;
    }
    .tc-slider.tc-slider-grande::-webkit-slider-thumb {
      width: 40px; height: 40px;
      margin-top: 7px;
      background-image: url(/assets/images/slider-thumb.png);
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-color: transparent;
      border: none;
      box-shadow: none;
      border-radius: 0;
    }
    .tc-slider.tc-slider-grande::-moz-range-thumb {
      width: 40px; height: 40px;
      background-image: url(/assets/images/slider-thumb.png);
      background-size: 100% 100%;
      background-repeat: no-repeat;
      background-color: transparent;
      border: none;
      box-shadow: none;
      border-radius: 0;
    }
  `;
  document.head.appendChild(style);
}