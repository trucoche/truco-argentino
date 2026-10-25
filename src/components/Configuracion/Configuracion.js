import PopupMadera, { confirmarPopup, mostrarAviso, PlacaMadera } from '../Popup/PopupMadera';
import React, { useState, useEffect, useCallback } from 'react';
import PersonajeSelector from '../Lobby/PersonajeSelector';
import ReportarModal from '../Reportar/ReportarModal';
import SelectorPersonalizacion from '../Personalizacion/SelectorPersonalizacion';
import ModoFotoAdmin from './ModoFotoAdmin';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/auth`;
const API_BASE = `${BASE_URL}/api`;

const C = {
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', cremaSutil: '#FFFCF6', chocolate: '#4A2C2A'
};

// Pase 324: opciones de género (movidas desde el Perfil).
const GENEROS = [
  { value: 'masculino', label: 'Masculino' },
  { value: 'femenino', label: 'Femenino' },
  { value: 'neutro', label: 'Neutro' },
  { value: 'prefiero_no_decir', label: 'Prefiero no decirlo' },
];

const CLAVE_MODO_OSCURO = 'truco_modo_oscuro';
const CLAVE_BARAJA = 'truco_baraja';

// Mismo criterio de avatar que ya usan Perfil/Ranking/el header.
function avatarSrcDe(u) {
  return u?.avatar_tipo === 'foto' && u?.foto_perfil_url
    ? u.foto_perfil_url
    : `/assets/${u?.personaje || 'gaucho'}-avatar.png`;
}

// Pase 495: enlace del Cafecito. En la app envuelta con Capacitor se usa el plugin Browser (navegador del sistema, sin bloqueo de pop-ups);
// en la web, pestaña nueva con noopener/noreferrer.
const URL_CAFECITO = 'https://cafecito.app/trucoche';
function abrirCafecito() {
  const navegadorCapacitor = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser;
  if (navegadorCapacitor && typeof navegadorCapacitor.open === 'function') {
    navegadorCapacitor.open({ url: URL_CAFECITO });
  } else {
    window.open(URL_CAFECITO, '_blank', 'noopener,noreferrer');
  }
}

// Pase 539: pestañas de Ajustes.
const PESTANAS_AJUSTES = [
  { id: 'perfil', texto: 'Perfil' },
  { id: 'juego', texto: 'Juego' },
  { id: 'sonido', texto: 'Sonido' },
  { id: 'cuenta', texto: 'Cuenta' },
];

export default function Configuracion({ token, usuario, onPersonajeCambiado, musicaVolumen, onCambiarMusicaVolumen, efectosVolumen = 1, onCambiarEfectosVolumen, onNavegar }) {
  const [modoOscuro, setModoOscuro] = useState(false);
  // Pase 519: modal intermedio antes de salir a Cafecito.
  const [cafecitoAbierto, setCafecitoAbierto] = useState(false);
  const [guardandoAvatar, setGuardandoAvatar] = useState(false);
  const [enviandoEliminacion, setEnviandoEliminacion] = useState(false);
  const [guardandoGenero, setGuardandoGenero] = useState(false);
  const [pestana, setPestana] = useState('perfil');   // Pase 539: Ajustes por pestañas
  const [reportarAbierto, setReportarAbierto] = useState(false);   // Pase 577: Reportar bug / sugerencia

  // Pase 324: el selector de Género se mudó del Perfil a Ajustes (misma lógica).
  const cambiarGenero = async (nuevoGenero) => {
    if (guardandoGenero || usuario?.genero === nuevoGenero) return;
    setGuardandoGenero(true);
    try {
      const res = await fetch(`${API_BASE}/auth/genero`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ genero: nuevoGenero })
      });
      if (res.ok && onPersonajeCambiado) onPersonajeCambiado();
    } catch (err) {
      console.error('Error guardando género:', err);
    } finally {
      setGuardandoGenero(false);
    }
  };

  // Pase 312: "Eliminar mi cuenta" manda directo el mail de confirmación a la
  // casilla registrada (POST /api/auth/solicitar-eliminacion-propia) en vez de
  // abrir otra página. La cuenta recién se desactiva al hacer clic en el link.
  const pedirEliminacionCuenta = async () => {
    if (enviandoEliminacion) return;
    const confirmado = await confirmarPopup({
      titulo: 'Eliminar mi cuenta',
      cinta: 'roja',
      mensaje: 'Te vamos a enviar un mail para confirmar la eliminación de tu cuenta. Recién cuando abras el enlace del mail se desactiva, y tenés 30 días para arrepentirte volviendo a iniciar sesión. ¿Enviar el mail?',
      textoSi: 'Enviar el mail',
      tipoSi: 'carmesi',
    });
    if (!confirmado) return;
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

  // Pase 427: privacidad de estado — "Mostrar estado en línea" (por defecto sí). Apagado: el usuario deja de
  // aparecer en "Jugadores en línea" y sin punto verde en las tarjetas de amigos de los demás (para el resto
  // figura como desconectado). Se aplica en vivo desde el servidor, sin recargar nada.
  const [mostrarEstadoEnLinea, setMostrarEstadoEnLinea] = useState(true);

  useEffect(() => {
    if (!usuario) return;
    setMostrarEstadoEnLinea(usuario.mostrar_estado_en_linea !== false);
  }, [usuario]);

  const alternarMostrarEstadoEnLinea = async () => {
    const siguiente = !mostrarEstadoEnLinea;
    setMostrarEstadoEnLinea(siguiente);
    try {
      const res = await fetch(`${API_BASE}/usuarios/privacidad-estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ mostrarEstadoEnLinea: siguiente }),
      });
      if (!res.ok) throw new Error('No se pudo guardar');
    } catch (err) {
      console.error('Error guardando privacidad de estado:', err);
      setMostrarEstadoEnLinea(!siguiente); // se revierte: el servidor no lo guardó
    }
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

  // ---------- Pase 595: lo que censuró (o vigiló) el filtro de insultos (solo rol 'admin'; se carga al apretar el botón) ----------
  const [censura, setCensura] = useState(null);   // null = todavía no se cargó
  const [cargandoCensura, setCargandoCensura] = useState(false);
  const [filtroCensura, setFiltroCensura] = useState('todo');   // 'todo' | 'enmascarar' | 'vigilar'
  const cargarCensura = async () => {
    setCargandoCensura(true);
    try {
      const res = await fetch(`${API_BASE}/admin/moderacion?limite=150`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setCensura(data);
    } catch (err) {
      console.error('Error cargando la censura:', err);
    } finally {
      setCargandoCensura(false);
    }
  };

  // ---------- Pase 577: reportes de bug / sugerencia (solo rol 'admin') ----------
  const [reportesApp, setReportesApp] = useState([]);
  const [cargandoReportes, setCargandoReportes] = useState(true);
  const [revisandoReporte, setRevisandoReporte] = useState(null);
  const [maxPremios, setMaxPremios] = useState(5);   // Pase 584: tope de reportes premiados por jugador (lo manda el backend)

  const cargarReportesApp = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/reportes-app`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        setReportesApp(data.reportes || []);
        if (data.max_premios) setMaxPremios(data.max_premios);
      }
    } catch (err) {
      console.error('Error cargando reportes de la app:', err);
    } finally {
      setCargandoReportes(false);
    }
  }, [token]);

  useEffect(() => {
    if (esAdmin) cargarReportesApp();
    else setCargandoReportes(false);
  }, [esAdmin, cargarReportesApp]);

  // Pase 582: `mates` > 0 = además de marcarlo como revisado, se le regalan esos mates a quien reportó (una sola vez por reporte).
  const marcarReporteRevisado = async (id, mates = 0) => {
    setRevisandoReporte(id);
    try {
      const res = await fetch(`${API_BASE}/admin/reportes-app/${id}/revisar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ recompensa: mates })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setReportesApp(prev => {
          const usuarioId = (prev.find(r => r.id === id) || {}).usuario_id;
          return prev.map(r => {
            if (r.id === id) return { ...r, revisado: true, revisado_en: r.revisado_en || new Date().toISOString(), recompensa: data.recompensa != null ? data.recompensa : r.recompensa, premios_usuario: data.premiado ? (r.premios_usuario || 0) + 1 : r.premios_usuario };
            if (data.premiado && usuarioId != null && r.usuario_id === usuarioId) return { ...r, premios_usuario: (r.premios_usuario || 0) + 1 };
            return r;
          });
        });
      } else if (data && data.error) {
        mostrarAviso({ titulo: 'No se pudo premiar', cinta: 'roja', mensaje: data.error, botones: [{ texto: 'Aceptar', tipo: 'dorado' }] });
      }
    } catch (err) {
      console.error('Error marcando reporte como revisado:', err);
    } finally {
      setRevisandoReporte(null);
    }
  };

  // ---------- Pase 589: suspensión de cuentas (solo rol 'admin') ----------
  // Temporal (1/7/30 días) o permanente, con motivo. El jugador no puede entrar (ve el motivo) y si estaba conectado se
  // lo saca al instante. Conserva sus mates. Las temporales se levantan solas.
  const DURACIONES_SUSP = [
    { value: '1', label: '1 día' }, { value: '7', label: '7 días' }, { value: '30', label: '30 días' }, { value: 'perm', label: 'Permanente' },
  ];
  const [suspendidos, setSuspendidos] = useState([]);
  const [formSusp, setFormSusp] = useState(null); // { id, username } | null
  const [suspDuracion, setSuspDuracion] = useState('7');
  const [suspMotivo, setSuspMotivo] = useState('');
  const [suspOcupado, setSuspOcupado] = useState(false);
  const [suspAviso, setSuspAviso] = useState('');
  const [suspBusqueda, setSuspBusqueda] = useState('');
  const [suspResultado, setSuspResultado] = useState(null); // { usuario, sugerencias } | null

  const cargarSuspendidos = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/suspendidos`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setSuspendidos(data.suspendidos || []);
    } catch (err) {
      console.error('Error cargando suspendidos:', err);
    }
  }, [token]);

  useEffect(() => {
    if (esAdmin) cargarSuspendidos();
  }, [esAdmin, cargarSuspendidos]);

  const abrirFormSusp = (u) => {
    setFormSusp({ id: u.id, username: u.username });
    setSuspDuracion('7');
    setSuspMotivo('');
    setSuspAviso('');
  };

  const suspenderUsuario = async () => {
    if (!formSusp || suspOcupado) return;
    const motivo = suspMotivo.trim();
    if (motivo.length < 3) { setSuspAviso('Escribí el motivo de la suspensión.'); return; }
    const permanente = suspDuracion === 'perm';
    const confirmado = await confirmarPopup({
      titulo: 'Suspender cuenta',
      cinta: 'roja',
      mensaje: `¿Suspender a ${formSusp.username} ${permanente ? 'de forma PERMANENTE' : `por ${suspDuracion} día${suspDuracion === '1' ? '' : 's'}`}? No va a poder entrar y si está jugando se lo saca de la partida. Conserva sus mates.`,
      textoSi: 'Suspender',
      tipoSi: 'carmesi',
    });
    if (!confirmado) return;
    setSuspOcupado(true);
    setSuspAviso('');
    try {
      const res = await fetch(`${API_BASE}/admin/usuarios/${formSusp.id}/suspender`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(permanente ? { permanente: true, motivo } : { dias: parseInt(suspDuracion, 10), motivo })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuspAviso(`Listo: ${formSusp.username} quedó suspendido.`);
        setFormSusp(null);
        setSuspResultado(null);
        setSuspBusqueda('');
        cargarSuspendidos();
      } else {
        setSuspAviso(data.error || 'No se pudo suspender');
      }
    } catch (err) {
      setSuspAviso('No se pudo suspender. Revisá la conexión.');
    } finally {
      setSuspOcupado(false);
    }
  };

  const levantarSuspension = async (u) => {
    const confirmado = await confirmarPopup({
      titulo: 'Levantar suspensión',
      mensaje: `¿Dejar entrar de nuevo a ${u.username}?`,
      textoSi: 'Levantar',
    });
    if (!confirmado) return;
    try {
      const res = await fetch(`${API_BASE}/admin/usuarios/${u.id}/reactivar`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSuspAviso(`Se levantó la suspensión de ${u.username}.`);
        cargarSuspendidos();
      } else {
        setSuspAviso('No se pudo levantar la suspensión.');
      }
    } catch (err) {
      setSuspAviso('No se pudo levantar. Revisá la conexión.');
    }
  };

  const buscarParaSuspender = async (texto) => {
    const q = (texto ?? suspBusqueda).trim();
    if (!q || suspOcupado) return;
    setSuspOcupado(true);
    setSuspAviso('');
    try {
      const res = await fetch(`${API_BASE}/admin/sponsors/buscar?q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setSuspResultado({ usuario: data.usuario || null, sugerencias: data.sugerencias || [] });
      else setSuspAviso(data.error || 'No se pudo buscar');
    } catch (err) {
      setSuspAviso('No se pudo buscar. Revisá la conexión.');
    } finally {
      setSuspOcupado(false);
    }
  };

  // Historial de suspensiones de un jugador (se pide al tocar "Historial"; tocar de nuevo lo oculta).
  const [historialDe, setHistorialDe] = useState(null); // { id, items: array | null } | null
  const verHistorial = async (id) => {
    if (historialDe && historialDe.id === id) { setHistorialDe(null); return; }
    setHistorialDe({ id, items: null });
    try {
      const res = await fetch(`${API_BASE}/admin/usuarios/${id}/suspensiones`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json().catch(() => ({}));
      setHistorialDe({ id, items: res.ok ? (data.historial || []) : [] });
    } catch (err) {
      setHistorialDe({ id, items: [] });
    }
  };
  const bloqueHistorial = (id) => {
    if (!historialDe || historialDe.id !== id) return null;
    if (historialDe.items === null) return <p style={estilos.hintBaraja}>Cargando historial...</p>;
    if (historialDe.items.length === 0) return <p style={estilos.hintBaraja}>Sin suspensiones anteriores.</p>;
    return (
      <div style={estilos.listaDenuncias}>
        {historialDe.items.map(h => (
          <div key={h.id} style={estilos.denunciaFecha}>
            {new Date(h.creado_en).toLocaleString()} · {h.accion === 'reactivar' ? '✅ Levantada' : (h.permanente ? '⛔ Permanente' : `⏳ ${h.dias} día${h.dias === 1 ? '' : 's'}`)}
            {h.admin ? ` · por ${h.admin}` : ''}{h.motivo ? ` · "${h.motivo}"` : ''}
          </div>
        ))}
      </div>
    );
  };

  const estaSuspendido = (id) => suspendidos.some(x => x.id === id);

  // Formulario compartido (duración + motivo) — se muestra debajo de la denuncia o del resultado de búsqueda.
  const formularioSuspension = formSusp && (
    <div style={estilos.formSuspension}>
      <div style={estilos.denunciaTexto}>Suspender a <strong>{formSusp.username}</strong></div>
      <select
        id="susp-duracion"
        style={estilos.inputSponsor}
        value={suspDuracion}
        onChange={(e) => setSuspDuracion(e.target.value)}
      >
        {DURACIONES_SUSP.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
      </select>
      <textarea
        id="susp-motivo"
        style={{ ...estilos.inputSponsor, minHeight: 60, resize: 'vertical', fontFamily: 'inherit' }}
        placeholder="Motivo (lo va a ver el jugador)"
        value={suspMotivo}
        maxLength={300}
        onChange={(e) => setSuspMotivo(e.target.value)}
      />
      <div style={estilos.filaBusquedaSponsor}>
        <button style={estilos.btnRevisar} disabled={suspOcupado} onClick={() => setFormSusp(null)}>Cancelar</button>
        <button style={estilos.btnRevisar} disabled={suspOcupado || suspMotivo.trim().length < 3} onClick={suspenderUsuario}>
          {suspOcupado ? 'Suspendiendo...' : 'Suspender'}
        </button>
      </div>
    </div>
  );

  // ---------- Pase 623: regalos de mates con mensaje (solo rol 'admin') ----------
  // Se busca al jugador (mismo buscador que Sponsors), se escribe cuántos mates y el mensaje de agradecimiento; al jugador
  // le sale el cartel "Regalo de TrucoChe" la próxima vez que entra al lobby.
  const [regalos, setRegalos] = useState([]);
  const [regaloBusqueda, setRegaloBusqueda] = useState('');
  const [regaloResultado, setRegaloResultado] = useState(null); // { usuario, sugerencias } | null
  const [regaloMates, setRegaloMates] = useState('100');
  const [regaloMensaje, setRegaloMensaje] = useState('');
  const [regaloOcupado, setRegaloOcupado] = useState(false);
  const [regaloAviso, setRegaloAviso] = useState('');

  const cargarRegalos = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/regalos`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setRegalos(data.regalos || []);
    } catch (err) {
      console.error('Error cargando regalos:', err);
    }
  }, [token]);

  useEffect(() => {
    if (esAdmin) cargarRegalos();
  }, [esAdmin, cargarRegalos]);

  const buscarParaRegalo = async (texto) => {
    const q = (texto ?? regaloBusqueda).trim();
    if (!q || regaloOcupado) return;
    setRegaloOcupado(true);
    setRegaloAviso('');
    try {
      const res = await fetch(`${API_BASE}/admin/sponsors/buscar?q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setRegaloResultado({ usuario: data.usuario || null, sugerencias: data.sugerencias || [] });
      else setRegaloAviso(data.error || 'No se pudo buscar');
    } catch (err) {
      setRegaloAviso('No se pudo buscar. Revisá la conexión.');
    } finally {
      setRegaloOcupado(false);
    }
  };

  const enviarRegalo = async (u) => {
    if (!u || regaloOcupado) return;
    const mates = parseInt(regaloMates, 10);
    if (!Number.isInteger(mates) || mates < 1) { setRegaloAviso('Escribí cuántos mates querés regalar.'); return; }
    if (!regaloMensaje.trim()) { setRegaloAviso('Escribí el mensaje de agradecimiento.'); return; }
    const confirmado = await confirmarPopup({
      titulo: 'Enviar regalo',
      mensaje: `¿Regalarle ${mates} mates a ${u.username}? Le va a salir un cartel con tu mensaje.`,
      textoSi: 'Enviar',
    });
    if (!confirmado) return;
    setRegaloOcupado(true);
    setRegaloAviso('');
    try {
      const res = await fetch(`${API_BASE}/admin/regalos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ usuario_id: u.id, mates, mensaje: regaloMensaje.trim() })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRegaloAviso(`Listo: le regalaste ${mates} mates a ${u.username}.`);
        setRegaloResultado(null);
        setRegaloBusqueda('');
        setRegaloMensaje('');
        cargarRegalos();
      } else {
        setRegaloAviso(data.error || 'No se pudo enviar el regalo');
      }
    } catch (err) {
      setRegaloAviso('No se pudo enviar. Revisá la conexión.');
    } finally {
      setRegaloOcupado(false);
    }
  };

  // ---------- Pase 563: sponsors de Cafecito (solo rol 'admin') ----------
  // Cuando llega una donación, el donante escribió en el mensaje su ID o su usuario: se busca acá, se ve a
  // quién encontró y recién entonces se otorga (anillo + banner + dorso 'Sponsor Criollo').
  const PLANES_SPONSOR = [
    { value: 'criollo', label: 'Sponsor Criollo ($500)' },
    { value: 'codigo', label: 'Día de Código ($2000)' },
  ];
  const [sponsors, setSponsors] = useState([]);
  const [sponsorBusqueda, setSponsorBusqueda] = useState('');
  const [sponsorResultado, setSponsorResultado] = useState(null); // { usuario, sugerencias } | null
  const [sponsorPlan, setSponsorPlan] = useState('criollo');
  const [sponsorOcupado, setSponsorOcupado] = useState(false);
  const [sponsorAviso, setSponsorAviso] = useState('');

  const cargarSponsors = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/sponsors`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) setSponsors(data.sponsors || []);
    } catch (err) {
      console.error('Error cargando sponsors:', err);
    }
  }, [token]);

  useEffect(() => {
    if (esAdmin) cargarSponsors();
  }, [esAdmin, cargarSponsors]);

  const buscarSponsor = async (texto) => {
    const q = (texto ?? sponsorBusqueda).trim();
    if (!q || sponsorOcupado) return;
    setSponsorOcupado(true);
    setSponsorAviso('');
    try {
      const res = await fetch(`${API_BASE}/admin/sponsors/buscar?q=${encodeURIComponent(q)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setSponsorResultado({ usuario: data.usuario || null, sugerencias: data.sugerencias || [] });
      else setSponsorAviso(data.error || 'No se pudo buscar');
    } catch (err) {
      setSponsorAviso('No se pudo buscar. Revisá la conexión.');
    } finally {
      setSponsorOcupado(false);
    }
  };

  const otorgarSponsor = async (u) => {
    if (!u || sponsorOcupado) return;
    setSponsorOcupado(true);
    setSponsorAviso('');
    try {
      const res = await fetch(`${API_BASE}/admin/sponsors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ usuario_id: u.id, plan: sponsorPlan })
      });
      const data = await res.json();
      if (res.ok) {
        setSponsorAviso(`Listo: ${u.username} ya es sponsor.`);
        setSponsorResultado(null);
        setSponsorBusqueda('');
        cargarSponsors();
      } else {
        setSponsorAviso(data.error || 'No se pudo otorgar');
      }
    } catch (err) {
      setSponsorAviso('No se pudo otorgar. Revisá la conexión.');
    } finally {
      setSponsorOcupado(false);
    }
  };

  const quitarSponsor = async (u) => {
    const confirmado = await confirmarPopup({
      titulo: 'Quitar sponsor',
      cinta: 'roja',
      mensaje: `¿Quitarle el sponsor a ${u.username}? Si tenía puesto el anillo, el banner o el dorso de Cafecito, vuelven a los de siempre.`,
      textoSi: 'Quitar',
      tipoSi: 'carmesi',
    });
    if (!confirmado) return;
    try {
      const res = await fetch(`${API_BASE}/admin/sponsors/${u.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setSponsorAviso(`Se le quitó el sponsor a ${u.username}.`);
        cargarSponsors();
      } else {
        setSponsorAviso('No se pudo quitar el sponsor.');
      }
    } catch (err) {
      setSponsorAviso('No se pudo quitar. Revisá la conexión.');
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

      {/* Pase 539: pestañas — cada una agrupa un tipo de opciones. */}
      <div style={estilos.pestanas} role="tablist">
        {PESTANAS_AJUSTES.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={pestana === t.id}
            onClick={() => setPestana(t.id)}
            style={{ ...estilos.pestana, ...(pestana === t.id ? estilos.pestanaActiva : {}) }}
          >
            {t.texto}
          </button>
        ))}
      </div>

      {/* Ducentésimo trigésimo noveno pase: rediseño estético pedido por el
          usuario — todas las secciones pasan a vivir dentro de un
          contenedor con `gap` en vez de que cada panel maneje su propio
          `marginTop`/`marginBottom` suelto (antes 16px sueltos por panel,
          más los propios de PersonajeSelector) — mismo criterio que ya usa
          la Tienda (`estilos.filas`) para una pantalla "más compacta" sin
          perder aire entre secciones. */}
      <div style={estilos.contenedor}>

      {pestana === 'perfil' && (
        <>
      {usuario?.foto_perfil_url && (
        <PlacaMadera>
          <div style={estilos.panelTitulo}>
            <img src="/assets/images/icono-foto-perfil.png" alt="" style={estilos.panelTituloIcono} />
            Foto de perfil
          </div>
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
        </PlacaMadera>
      )}

      <PersonajeSelector
        token={token}
        personajeActual={usuario?.personaje || 'gaucho'}
        onPersonajeCambiado={onPersonajeCambiado}
      />

      {/* Pase 324: Género (antes vivía en el Perfil). */}
      <PlacaMadera>
        <div style={estilos.panelTitulo}>
          <img src="/assets/images/icono-genero.png" alt="" style={estilos.panelTituloIcono} />
          Género
        </div>
        <div style={estilos.chipsFila}>
          {GENEROS.map(g => (
            <button
              key={g.value}
              style={{ ...estilos.chipGenero, ...(usuario?.genero === g.value ? estilos.chipGeneroActivo : {}) }}
              disabled={guardandoGenero}
              onClick={() => cambiarGenero(g.value)}
            >
              {g.label}
            </button>
          ))}
        </div>
      </PlacaMadera>

      {/* Pase 578: anillo, banner y dorso de cartas (paridad con la app, Pase 524). */}
      <PlacaMadera>
        <div style={estilos.panelTitulo}>
          <span aria-hidden="true">🎨</span>
          Personalización
        </div>
        <SelectorPersonalizacion
          usuario={usuario}
          token={token}
          recargarPerfil={onPersonajeCambiado}
          onApoyar={() => setCafecitoAbierto(true)}
        />
      </PlacaMadera>

        </>
      )}

      {pestana === 'juego' && (
        <>
      <PlacaMadera>
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
      </PlacaMadera>

      <PlacaMadera>
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
            {/* Pase 366: preview ilustrado del mazo clásico (cartas españolas). */}
            <img src="/assets/images/icono-cartas-clasica.png" alt="" style={estilos.previewCartas} />
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
      </PlacaMadera>

        </>
      )}

      {pestana === 'sonido' && (
        <>
      {/* Octogésimo tercer pase: el botón de mutear música que vivía arriba
          de AppShell (en todas las pantallas con nav) se saca de ahí y se
          reemplaza por este slider — mismo `.tc-slider` y el mismo
          `musicaVolumen`/`onCambiarMusicaVolumen` (levantados en App.js)
          que ya usa el panel de configuración dentro de la partida
          (ConfiguracionMesaModal.js) — es la misma música de fondo global,
          no una pista nueva. */}
      <PlacaMadera>
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
      </PlacaMadera>

      {/* Pase 580 (paridad con la app, Pase 529): volumen de los efectos de la mesa (repartir, carta jugada, ganar). */}
      {onCambiarEfectosVolumen && (
        <PlacaMadera>
          <div style={estilos.panelTitulo}>
            <span aria-hidden="true">🔊</span>
            Efectos de sonido
          </div>
          <div style={estilos.filaSlider}>
            <div style={estilos.sliderPistaContenedor}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={efectosVolumen}
                onChange={(e) => onCambiarEfectosVolumen(Number(e.target.value))}
                className="tc-slider tc-slider-grande"
                aria-label="Volumen de efectos de sonido"
              />
            </div>
          </div>
        </PlacaMadera>
      )}

        </>
      )}

      {pestana === 'cuenta' && (
        <>
      {/* Pase 427: Privacidad — mostrar (o no) el estado en línea. */}
      <PlacaMadera>
        <div style={estilos.panelTitulo}>
          <img src="/assets/images/icono-bloqueados.png" alt="" style={estilos.panelTituloIcono} />
          Privacidad
        </div>
        <label style={estilos.filaSwitch}>
          <span style={estilos.switchTexto}>Mostrar estado en línea</span>
          <img
            src={mostrarEstadoEnLinea ? '/assets/images/switch-on.png' : '/assets/images/switch-off.png'}
            alt=""
            onClick={alternarMostrarEstadoEnLinea}
            style={estilos.switchImagen}
          />
        </label>
        <div style={estilos.switchAyuda}>
          Si lo apagás, no aparecés en "Jugadores en línea" y los demás te ven desconectado (no podrán desafiarte). Seguís pudiendo chatear y recibir mensajes.
        </div>
      </PlacaMadera>

      {/* Pase siguiente: preferencia de "Desafiar" — dos switches
          independientes, uno para amigos y otro para desconocidos. */}
      <PlacaMadera>
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
      </PlacaMadera>

      {/* Centésimo quinto pase: lista de usuarios bloqueados + desbloquear.
          El backend ya existía (GET/DELETE en routes/usuarios.js) desde el
          nonagésimo octavo pase, no había ninguna pantalla que lo usara. */}
      <PlacaMadera>
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
      </PlacaMadera>

      {/* Centésimo quinto pase: panel de administración de denuncias —
          solo visible con rol 'admin' (viaja en el JWT desde el login,
          ver routes/auth.js). Para que tu cuenta lo vea hace falta correr
          a mano `UPDATE usuarios SET rol='admin' WHERE username='...';`
          y volver a loguearte (el token viejo no tiene el rol nuevo). */}
      {esAdmin && (
        <PlacaMadera>
          <div style={estilos.panelTitulo}>🚩 Denuncias (administración)</div>
          {cargandoDenuncias ? (
            <p style={estilos.hintBaraja}>Cargando...</p>
          ) : denuncias.length === 0 ? (
            <p style={estilos.hintBaraja}>No hay denuncias.</p>
          ) : (
            <div style={estilos.listaDenuncias}>
              {denuncias.map((d) => (
                <React.Fragment key={d.id}>
                <div style={{ ...estilos.filaDenuncia, ...(d.revisado ? estilos.filaDenunciaRevisada : {}) }}>
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
                  {d.denunciado_id != null && !estaSuspendido(d.denunciado_id) && (!formSusp || formSusp.id !== d.denunciado_id) && (
                    <button style={estilos.btnRevisar} onClick={() => abrirFormSusp({ id: d.denunciado_id, username: d.denunciado })}>
                      Suspender
                    </button>
                  )}
                  {d.denunciado_id != null && estaSuspendido(d.denunciado_id) && <span style={estilos.badgeRevisada}>⛔ Suspendido</span>}
                  {d.denunciado_id != null && (
                    <button style={estilos.btnRevisar} onClick={() => verHistorial(d.denunciado_id)}>
                      {historialDe?.id === d.denunciado_id ? 'Ocultar historial' : 'Historial'}
                    </button>
                  )}
                </div>
                {d.denunciado_id != null && bloqueHistorial(d.denunciado_id)}
                {formSusp && d.denunciado_id === formSusp.id && formularioSuspension}
                </React.Fragment>
              ))}
            </div>
          )}
        </PlacaMadera>
      )}

      {/* Pase 577: reportes de bug / sugerencia enviados desde la app y la web — solo rol 'admin'. */}
      {esAdmin && (
        <PlacaMadera>
          <div style={estilos.panelTitulo}>🐞 Reportes de la app (administración)</div>
          {cargandoReportes ? (
            <p style={estilos.hintBaraja}>Cargando...</p>
          ) : reportesApp.length === 0 ? (
            <p style={estilos.hintBaraja}>No hay reportes.</p>
          ) : (
            <div style={estilos.listaDenuncias}>
              {reportesApp.map((r) => (
                <div key={r.id} style={{ ...estilos.filaDenuncia, ...(r.revisado ? estilos.filaDenunciaRevisada : {}) }}>
                  <div style={estilos.denunciaTexto}>
                    <strong>{r.username || 'cuenta eliminada'}</strong> · {r.tipo === 'sugerencia' ? '💡 Sugerencia' : '🐞 Error'}
                    <div style={estilos.denunciaMotivo}>"{r.mensaje}"</div>
                    <div style={estilos.denunciaFecha}>
                      {new Date(r.creado_en).toLocaleString()}
                      {[r.plataforma, r.version, r.pantalla].filter(Boolean).length > 0 && ` · ${[r.plataforma, r.version, r.pantalla].filter(Boolean).join(' · ')}`}
                    </div>
                    {r.dispositivo && <div style={estilos.denunciaFecha}>{r.dispositivo}</div>}
                  </div>
                  <div style={estilos.accionesReporte}>
                    {r.revisado && (
                      <span style={estilos.badgeRevisada}>✓ Revisado{r.recompensa > 0 ? ` · +${r.recompensa} mates` : ''}</span>
                    )}
                    {!r.revisado && (
                      <button
                        style={estilos.btnRevisar}
                        disabled={revisandoReporte === r.id}
                        onClick={() => marcarReporteRevisado(r.id)}
                      >
                        {revisandoReporte === r.id ? 'Marcando...' : 'Marcar revisado'}
                      </button>
                    )}
                    {r.username && (r.premios_usuario || 0) > 0 && (
                      <span style={estilos.premiosLabel}>Premios a {r.username}: {r.premios_usuario}/{maxPremios}{(r.premios_usuario || 0) >= maxPremios ? ' (máximo)' : ''}</span>
                    )}
                    {/* Pase 582: premio por reportar. Solo si la cuenta existe, todavía no se la premió y no llegó al tope. */}
                    {r.username && !(r.recompensa > 0) && (r.premios_usuario || 0) < maxPremios && (
                      <div style={estilos.premiosReporte}>
                        <span style={estilos.premiosLabel}>{r.revisado ? 'Premiar:' : 'Revisar y premiar:'}</span>
                        {[10, 25, 50].map((m) => (
                          <button
                            key={m}
                            style={estilos.btnPremio}
                            disabled={revisandoReporte === r.id}
                            onClick={async () => {
                              const ok = await confirmarPopup({
                                titulo: 'Premiar reporte',
                                mensaje: `¿Regalarle ${m} mates a ${r.username} por este reporte? Se le va a avisar en el lobby.`,
                                textoSi: `Regalar ${m} mates`,
                                textoNo: 'Cancelar',
                                tipoSi: 'dorado',
                              });
                              if (ok) marcarReporteRevisado(r.id, m);
                            }}
                          >
                            +{m}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </PlacaMadera>
      )}

      {/* Pase 589: suspensión de cuentas — solo rol 'admin'. Suspender por nombre/ID y ver/levantar las vigentes. */}
      {esAdmin && (
        <PlacaMadera>
          <div style={estilos.panelTitulo}>⛔ Suspensiones (administración)</div>
          <p style={estilos.hintBaraja}>Para suspender a alguien que no está en las denuncias, buscalo por ID o nombre de usuario exacto.</p>
          <div style={estilos.filaBusquedaSponsor}>
            <input
              id="susp-busqueda"
              style={estilos.inputSponsor}
              type="text"
              placeholder="ID o nombre de usuario"
              value={suspBusqueda}
              maxLength={50}
              onChange={(e) => { setSuspBusqueda(e.target.value); setSuspResultado(null); setFormSusp(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') buscarParaSuspender(); }}
            />
            <button style={estilos.btnRevisar} disabled={suspOcupado || !suspBusqueda.trim()} onClick={() => buscarParaSuspender()}>
              Buscar
            </button>
          </div>

          {suspResultado && suspResultado.usuario && (
            <>
              <div style={estilos.filaDenuncia}>
                <div style={estilos.denunciaTexto}>
                  Encontrado: <strong>{suspResultado.usuario.username}</strong> (ID {suspResultado.usuario.id})
                  {estaSuspendido(suspResultado.usuario.id) && <div style={estilos.denunciaFecha}>⛔ Ya está suspendido.</div>}
                </div>
                {!estaSuspendido(suspResultado.usuario.id) && (!formSusp || formSusp.id !== suspResultado.usuario.id) && (
                  <button style={estilos.btnRevisar} onClick={() => abrirFormSusp(suspResultado.usuario)}>Suspender</button>
                )}
              </div>
              {formSusp && formSusp.id === suspResultado.usuario.id && formularioSuspension}
            </>
          )}
          {suspResultado && !suspResultado.usuario && (
            <div>
              <p style={estilos.hintBaraja}>No hay ningún usuario con ese ID o nombre exacto.</p>
              {suspResultado.sugerencias.length > 0 && (
                <div style={estilos.listaDenuncias}>
                  {suspResultado.sugerencias.map(u => (
                    <div key={u.id} style={estilos.filaDenuncia}>
                      <div style={estilos.denunciaTexto}>¿Será <strong>{u.username}</strong>? (ID {u.id})</div>
                      <button style={estilos.btnRevisar} onClick={() => { setSuspBusqueda(u.username); buscarParaSuspender(u.username); }}>
                        Elegir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {suspAviso && <p style={estilos.hintBaraja}>{suspAviso}</p>}

          <div style={{ ...estilos.panelTitulo, marginTop: 14 }}>Cuentas suspendidas ({suspendidos.length})</div>
          {suspendidos.length === 0 ? (
            <p style={estilos.hintBaraja}>No hay cuentas suspendidas.</p>
          ) : (
            <div style={estilos.listaDenuncias}>
              {suspendidos.map(u => (
                <React.Fragment key={u.id}>
                <div style={estilos.filaDenuncia}>
                  <div style={estilos.denunciaTexto}>
                    <strong>{u.username}</strong> (ID {u.id}) · {u.suspension_permanente ? '⛔ Permanente' : `⏳ Hasta ${u.suspendido_hasta ? new Date(u.suspendido_hasta).toLocaleString() : '—'}`}
                    {u.suspension_motivo && <div style={estilos.denunciaMotivo}>"{u.suspension_motivo}"</div>}
                  </div>
                  <button style={estilos.btnRevisar} onClick={() => levantarSuspension(u)}>Levantar</button>
                  <button style={estilos.btnRevisar} onClick={() => verHistorial(u.id)}>
                    {historialDe?.id === u.id ? 'Ocultar historial' : 'Historial'}
                  </button>
                </div>
                {bloqueHistorial(u.id)}
                </React.Fragment>
              ))}
            </div>
          )}
        </PlacaMadera>
      )}

      {/* Pase 595: censura de insultos — solo rol 'admin'. Qué palabra saltó, quién, dónde y el mensaje original. */}
      {esAdmin && (
        <PlacaMadera>
          <div style={estilos.panelTitulo}>🛡️ Censura de insultos (administración)</div>
          <p style={estilos.hintBaraja}>
            Se tapan con *** los insultos muy fuertes, la discriminación y las amenazas. "Vigilado" = no se tapa, solo se anota para que veas el contexto
            (por ahora: "puto/s", "trola/s" y "te mato"). Se guarda 90 días.
          </p>
          <div style={estilos.filaBusquedaSponsor}>
            <button style={estilos.btnRevisar} onClick={cargarCensura} disabled={cargandoCensura}>
              {cargandoCensura ? 'Cargando…' : (censura ? 'Actualizar' : 'Ver registro')}
            </button>
            {censura && ['todo', 'enmascarar', 'vigilar'].map(f => (
              <button key={f} style={{ ...estilos.btnRevisar, opacity: filtroCensura === f ? 1 : 0.6 }} onClick={() => setFiltroCensura(f)}>
                {f === 'todo' ? 'Todo' : f === 'enmascarar' ? 'Tapados' : 'Vigilados'}
              </button>
            ))}
          </div>
          {censura && censura.resumen && censura.resumen.length > 0 && (
            <p style={estilos.hintBaraja}>
              <strong>Últimos 30 días:</strong> {censura.resumen.slice(0, 12).map(r => `${r.coincidencia} (${r.cantidad}${r.accion === 'vigilar' ? ', vigilada' : ''})`).join(' · ')}
            </p>
          )}
          {censura && (
            (censura.registros || []).filter(c => filtroCensura === 'todo' || c.accion === filtroCensura).length === 0 ? (
              <p style={estilos.hintBaraja}>Todavía no hay registros.</p>
            ) : (
              <div style={estilos.listaDenuncias}>
                {(censura.registros || []).filter(c => filtroCensura === 'todo' || c.accion === filtroCensura).map(c => (
                  <div key={c.id} style={estilos.filaDenuncia}>
                    <div style={estilos.denunciaTexto}>
                      <strong>{c.usuario || 'alguien'}</strong> · {c.canal} · {c.categoria} · {c.accion === 'enmascarar' ? 'TAPADO' : 'vigilado'}
                      <div style={estilos.denunciaMotivo}>Palabra: "{c.coincidencia}"</div>
                      <div style={estilos.denunciaMotivo}>Mensaje original: "{c.texto_original}"</div>
                      <div style={estilos.denunciaFecha}>{new Date(c.creado_en).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </PlacaMadera>
      )}

      {/* Pase 611: Modo foto — mesa simulada para capturas (solo rol 'admin'). */}
      {esAdmin && <ModoFotoAdmin />}

      {/* Pase 623: regalos de mates con mensaje — solo rol 'admin'. */}
      {esAdmin && (
        <PlacaMadera>
          <div style={estilos.panelTitulo}>🎁 Regalar mates con mensaje (administración)</div>
          <p style={estilos.hintBaraja}>Buscá al jugador por ID o nombre de usuario, escribí cuántos mates y el mensaje de agradecimiento. Le sale un cartel la próxima vez que entra al lobby.</p>
          <div style={estilos.filaBusquedaSponsor}>
            <input
              id="regalo-busqueda"
              style={estilos.inputSponsor}
              type="text"
              placeholder="ID o nombre de usuario"
              value={regaloBusqueda}
              maxLength={50}
              onChange={(e) => { setRegaloBusqueda(e.target.value); setRegaloResultado(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') buscarParaRegalo(); }}
            />
            <button style={estilos.btnRevisar} disabled={regaloOcupado || !regaloBusqueda.trim()} onClick={() => buscarParaRegalo()}>
              Buscar
            </button>
          </div>
          <div style={estilos.filaBusquedaSponsor}>
            <input
              id="regalo-mates"
              style={{ ...estilos.inputSponsor, flex: '0 0 110px' }}
              type="number"
              min="1"
              max="1000"
              placeholder="Mates"
              value={regaloMates}
              onChange={(e) => setRegaloMates(e.target.value)}
            />
            <input
              id="regalo-mensaje"
              style={estilos.inputSponsor}
              type="text"
              placeholder="Mensaje (ej.: Gracias por la idea de los rangos)"
              value={regaloMensaje}
              maxLength={200}
              onChange={(e) => setRegaloMensaje(e.target.value)}
            />
          </div>

          {regaloResultado && regaloResultado.usuario && (
            <div style={estilos.filaDenuncia}>
              <div style={estilos.denunciaTexto}>
                Encontrado: <strong>{regaloResultado.usuario.username}</strong> (ID {regaloResultado.usuario.id})
              </div>
              <button style={estilos.btnRevisar} disabled={regaloOcupado} onClick={() => enviarRegalo(regaloResultado.usuario)}>
                {regaloOcupado ? 'Enviando...' : 'Enviar regalo'}
              </button>
            </div>
          )}
          {regaloResultado && !regaloResultado.usuario && (
            <div>
              <p style={estilos.hintBaraja}>No hay ningún usuario con ese ID o nombre exacto.</p>
              {regaloResultado.sugerencias.length > 0 && (
                <div style={estilos.listaDenuncias}>
                  {regaloResultado.sugerencias.map(u => (
                    <div key={u.id} style={estilos.filaDenuncia}>
                      <div style={estilos.denunciaTexto}>¿Será <strong>{u.username}</strong>? (ID {u.id})</div>
                      <button style={estilos.btnRevisar} onClick={() => { setRegaloBusqueda(u.username); buscarParaRegalo(u.username); }}>
                        Elegir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {regaloAviso && <p style={estilos.hintBaraja}>{regaloAviso}</p>}

          <div style={{ ...estilos.panelTitulo, marginTop: 14 }}>Últimos regalos ({regalos.length})</div>
          {regalos.length === 0 ? (
            <p style={estilos.hintBaraja}>Todavía no enviaste regalos desde el panel.</p>
          ) : (
            <div style={estilos.listaDenuncias}>
              {regalos.slice(0, 10).map(g => (
                <div key={g.id} style={estilos.filaDenuncia}>
                  <div style={estilos.denunciaTexto}>
                    <strong>{g.username}</strong> · +{g.mates} mates · {g.visto ? 'ya lo vio' : 'todavía no lo vio'}
                    <div style={estilos.denunciaFecha}>{`“${g.mensaje}” · ${new Date(g.creado_en).toLocaleDateString()}`}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </PlacaMadera>
      )}

      {/* Pase 563: sponsors de Cafecito — solo rol 'admin'. Buscar al donante, ver a quién encontró y otorgar. */}
      {esAdmin && (
        <PlacaMadera>
          <div style={estilos.panelTitulo}>☕ Sponsors de Cafecito (administración)</div>
          <p style={estilos.hintBaraja}>Buscá por ID o por nombre de usuario, como lo escribió el donante en el mensaje de Cafecito.</p>
          <div style={estilos.filaBusquedaSponsor}>
            <input
              id="sponsor-busqueda"
              style={estilos.inputSponsor}
              type="text"
              placeholder="ID o nombre de usuario"
              value={sponsorBusqueda}
              maxLength={50}
              onChange={(e) => { setSponsorBusqueda(e.target.value); setSponsorResultado(null); }}
              onKeyDown={(e) => { if (e.key === 'Enter') buscarSponsor(); }}
            />
            <button style={estilos.btnRevisar} disabled={sponsorOcupado || !sponsorBusqueda.trim()} onClick={() => buscarSponsor()}>
              Buscar
            </button>
          </div>
          <select
            id="sponsor-plan"
            style={estilos.inputSponsor}
            value={sponsorPlan}
            onChange={(e) => setSponsorPlan(e.target.value)}
          >
            {PLANES_SPONSOR.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>

          {sponsorResultado && sponsorResultado.usuario && (
            <div style={estilos.filaDenuncia}>
              <div style={estilos.denunciaTexto}>
                Encontrado: <strong>{sponsorResultado.usuario.username}</strong> (ID {sponsorResultado.usuario.id})
                {sponsorResultado.usuario.sponsor_plan && (
                  <div style={estilos.denunciaFecha}>Ya es sponsor ({sponsorResultado.usuario.sponsor_plan}); otorgar cambia su plan.</div>
                )}
              </div>
              <button style={estilos.btnRevisar} disabled={sponsorOcupado} onClick={() => otorgarSponsor(sponsorResultado.usuario)}>
                {sponsorOcupado ? 'Otorgando...' : 'Otorgar'}
              </button>
            </div>
          )}
          {sponsorResultado && !sponsorResultado.usuario && (
            <div>
              <p style={estilos.hintBaraja}>No hay ningún usuario con ese ID o nombre exacto.</p>
              {sponsorResultado.sugerencias.length > 0 && (
                <div style={estilos.listaDenuncias}>
                  {sponsorResultado.sugerencias.map(u => (
                    <div key={u.id} style={estilos.filaDenuncia}>
                      <div style={estilos.denunciaTexto}>¿Será <strong>{u.username}</strong>? (ID {u.id})</div>
                      <button style={estilos.btnRevisar} onClick={() => { setSponsorBusqueda(u.username); buscarSponsor(u.username); }}>
                        Elegir
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {sponsorAviso && <p style={estilos.hintBaraja}>{sponsorAviso}</p>}

          <div style={{ ...estilos.panelTitulo, marginTop: 14 }}>Sponsors actuales ({sponsors.length})</div>
          {sponsors.length === 0 ? (
            <p style={estilos.hintBaraja}>Todavía no hay sponsors.</p>
          ) : (
            <div style={estilos.listaDenuncias}>
              {sponsors.map(u => (
                <div key={u.id} style={estilos.filaDenuncia}>
                  <div style={estilos.denunciaTexto}>
                    <strong>{u.username}</strong> (ID {u.id}) · {u.sponsor_plan === 'codigo' ? 'Día de Código' : 'Sponsor Criollo'}
                    {u.sponsor_desde && <div style={estilos.denunciaFecha}>Desde {new Date(u.sponsor_desde).toLocaleDateString()}</div>}
                  </div>
                  <button style={estilos.btnRevisar} onClick={() => quitarSponsor(u)}>Quitar</button>
                </div>
              ))}
            </div>
          )}
        </PlacaMadera>
      )}

      {/* Pase 495: "Sobre el proyecto" — apoyar a TrucoChe con un cafecito; va justo arriba de "Mi cuenta". */}
      <PlacaMadera>
        <div style={estilos.panelTitulo}>
          <span aria-hidden="true">☕</span>
          Sobre el proyecto
        </div>
        <div style={estilos.cafecitoCuerpo}>
          <img src="/assets/images/cafecito-avatar.png" alt="Dev TrucoChe" style={estilos.cafecitoAvatar} />
          <p style={estilos.cafecitoTexto}>
            TrucoChe es desarrollado a pulmón. Si disfrutás las partidas y querés dar una mano para seguir sumando mejoras y nuevos juegos, ¡un cafecito ayuda un montón!
          </p>
        </div>
        <button style={estilos.btnCafecito} onClick={() => setCafecitoAbierto(true)}>
          ☕ Invitar un Cafecito
        </button>
      </PlacaMadera>

      {/* Pase 577: "Ayudanos a mejorar" — mismo panel que la app (Pase 523), entre "Sobre el proyecto" y "Mi cuenta". */}
      <PlacaMadera>
        <div style={estilos.panelTitulo}>
          <span aria-hidden="true">🐞</span>
          Ayudanos a mejorar
        </div>
        <p style={{ ...estilos.hintBaraja, marginTop: 0 }}>
          ¿Encontraste un error o se te ocurrió una idea? Contanoslo: cada reporte nos ayuda a pulir TrucoChe.
        </p>
        <button style={estilos.btnReportar} onClick={() => setReportarAbierto(true)}>
          Reportar bug / sugerencia
        </button>
      </PlacaMadera>

      {/* Pase 311/312: "Mi cuenta" — acceso a eliminar la cuenta. Manda un mail
          de confirmación al email registrado; 30 días de arrepentimiento. */}
      <PlacaMadera>
        <div style={estilos.panelTitulo}>
          <img src="/assets/images/icono-eliminar-cuenta.png" alt="" style={estilos.panelTituloIcono} />
          Mi cuenta
        </div>
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
      </PlacaMadera>

        </>
      )}

      <ReportarModal visible={reportarAbierto} onCerrar={() => setReportarAbierto(false)} token={token} pantalla="ajustes" />

      {/* Pase 519: modal de agradecimiento; "Continuar" cierra y abre Cafecito (Capacitor Browser o pestaña nueva), "Volver" solo cierra. */}
      <PopupMadera
        visible={cafecitoAbierto}
        titulo="☕ Apoyar a TrucoChe"
        icono="/assets/images/cafecito-avatar.png"
        tamIcono={80}
        mensaje={<span style={{ whiteSpace: 'pre-line' }}>{'Vas a ser redirigido a Cafecito.app para realizar tu aporte de forma segura.\n\n¡Muchas gracias por valorar el juego y bancar el desarrollo independiente!'}</span>}
        onCerrar={() => setCafecitoAbierto(false)}
        botones={[
          { texto: 'Continuar a Cafecito ☕', tipo: 'celeste', onClick: () => { setCafecitoAbierto(false); abrirCafecito(); } },
          { texto: 'Volver', tipo: 'neutro', onClick: () => setCafecitoAbierto(false) },
        ]}
      />


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
  pestanas: { display: 'flex', gap: 8, margin: '0 0 16px' },
  pestana: {
    flex: 1, height: 40, padding: '0 8px', borderRadius: 999, border: '2.5px solid #5C3D21', borderBottom: '4px solid #1a100a',
    background: '#3E2723', color: 'rgba(255,248,237,0.8)', fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 15, cursor: 'pointer',
  },
  pestanaActiva: { background: '#F5B041', border: '2.5px solid #1a1410', borderBottom: '4px solid #B9770E', color: '#3B1F0E' },
  sectionTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16, color: C.crema, margin: '4px 0 10px 4px' },
  // Ducentésimo trigésimo noveno pase: `contenedor` reemplaza los
  // márgenes sueltos de cada panel — ver el comentario junto al JSX. Gap
  // más chico que el que tenía cada panel antes (16→12) a pedido explícito
  // del usuario ("reducir un poco el espacio vacío entre secciones").
  contenedor: { display: 'flex', flexDirection: 'column', gap: 18 },
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
  chipsFila: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chipGenero: {
    fontSize: 12.5, fontWeight: 700, color: C.chocolate,
    background: '#fff', border: `2px solid ${C.chocolate}33`, borderRadius: 20,
    padding: '8px 14px', cursor: 'pointer'
  },
  chipGeneroActivo: { color: '#fff', background: '#4FB3E8', borderColor: '#2f8dbf' },
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
  switchAyuda: { fontSize: 12, lineHeight: 1.35, color: '#7a5a3a', marginTop: 8 },
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
  // Pase 495: tarjeta de Cafecito — avatar circular de 72 px a la izquierda, texto en cursiva a la derecha y botón celeste de ancho completo.
  cafecitoCuerpo: { display: 'flex', alignItems: 'center', gap: 12, margin: '10px 0' },
  cafecitoAvatar: { width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', flexShrink: 0, border: `2px solid ${C.chocolate}59`, background: '#6AA790' },
  cafecitoTexto: { flex: 1, margin: 0, fontSize: 14, fontStyle: 'italic', fontWeight: 700, lineHeight: 1.4, color: C.chocolate },
  btnCafecito: {
    width: '100%', fontSize: 15, fontWeight: 800, color: '#FFFFFF', textShadow: '0 1px 1px rgba(30,41,59,0.6)',
    background: '#32CDC8', border: '2px solid #1E293B', borderRadius: 12, padding: '11px 16px', cursor: 'pointer',
    boxShadow: '0 2px 0 #1E293B', fontFamily: "'Fredoka', sans-serif",
  },
  // Pase 577: botón verde del panel "Ayudanos a mejorar", igual que en la app (Pase 523).
  btnReportar: {
    width: '100%', marginTop: 12, fontSize: 15, fontWeight: 800, color: '#FFFFFF', textShadow: '0 1px 1px rgba(0,0,0,0.5)',
    background: '#3FA34D', border: '2px solid #1E293B', borderRadius: 12, padding: '11px 16px', cursor: 'pointer',
    boxShadow: '0 2px 0 #1E293B', fontFamily: "'Fredoka', sans-serif",
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
  formSuspension: { display: 'flex', flexDirection: 'column', gap: 8, margin: '6px 0 4px', padding: 10, borderRadius: 10, border: '2px solid #B9770E', background: 'rgba(255,255,255,0.35)' },
  filaBusquedaSponsor: { display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0 8px' },
  inputSponsor: {
    flex: 1, width: '100%', boxSizing: 'border-box', fontSize: 14, fontWeight: 600, color: C.chocolate,
    background: '#fff', border: `2px solid ${C.chocolate}55`, borderRadius: 10, padding: '8px 10px', marginBottom: 8
  },
  accionesReporte: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 },
  premiosReporte: { display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', justifyContent: 'flex-end' },
  premiosLabel: { fontWeight: 800, fontSize: 11, color: '#6B4A2E' },
  btnPremio: { fontFamily: 'inherit', fontWeight: 800, fontSize: 12, color: '#4A2C2A', background: '#FFE9B0', border: '2px solid #C9860E', borderRadius: 999, padding: '3px 10px', cursor: 'pointer' },
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
