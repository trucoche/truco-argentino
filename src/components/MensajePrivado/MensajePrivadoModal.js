import React, { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../services/socket';
import { API_URL as BASE_URL } from '../../config';

const API_BASE = `${BASE_URL}/api`;

// Pase siguiente: mensaje privado 1 a 1 — decisiones explícitas del
// usuario: "simple, sin lista de conversaciones" (este modal se abre por
// separado desde el perfil de esa persona o desde el menú "⋮" de Chat
// Global, nunca hay una pantalla de "todas mis conversaciones") y "solo
// entre amigos" (el backend ya lo exige — ver routes/mensajesPrivados.js
// — este componente no repite esa validación, solo maneja el error 403
// si por algún motivo ya no lo son).
//
// El historial se pide una vez por REST al abrir; mandar/recibir en vivo
// va por el MISMO socket compartido que ya usa el resto de la app (ver
// services/socket.js) — no se abre una conexión propia. No hace falta
// saber el username propio para decidir qué burbuja es "propia": el
// servidor solo entrega a este socket mensajes donde el usuario logueado
// es emisor O receptor de ESTE PAR puntual (nunca de otra conversación),
// así que dentro del filtro por `username` (el otro), cualquier mensaje
// cuyo `de` no sea `username` tiene que ser mío.
const C = {
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  crema: '#FFF8ED', chocolate: '#4A2C2A', cremaSutil: '#FFFCF6',
  verde: '#2D9B4F', verdeProfundo: '#163f24',
};

function horaCorta(fecha) {
  return new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

export default function MensajePrivadoModal({ username, token, onCerrar }) {
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [mensajes, setMensajes] = useState([]);
  const [texto, setTexto] = useState('');
  const finRef = useRef(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [mensajes]);

  useEffect(() => {
    if (!username || !token) return;
    let activo = true;
    setCargando(true);
    setError('');

    fetch(`${API_BASE}/mensajes-privados/${encodeURIComponent(username)}/historial`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (!activo) return;
        if (!ok) {
          setError(data.error || 'No se pudo cargar la conversación');
          return;
        }
        setMensajes(data.mensajes || []);
      })
      .catch((err) => {
        console.error('Error cargando historial privado:', err);
        if (activo) setError('No se pudo conectar con el servidor');
      })
      .finally(() => { if (activo) setCargando(false); });

    const socket = getSocket();
    const alRecibir = (msg) => {
      if (msg.de !== username && msg.para !== username) return;
      setMensajes((prev) => [...prev, {
        id: msg.id,
        propio: msg.de !== username,
        texto: msg.texto,
        timestamp: msg.timestamp,
      }]);
    };
    socket.on('privado:mensaje-nuevo', alRecibir);

    return () => {
      activo = false;
      socket.off('privado:mensaje-nuevo', alRecibir);
    };
  }, [username, token]);

  const enviarMensaje = (e) => {
    e.preventDefault();
    const limpio = texto.trim();
    if (!limpio) return;
    getSocket().emit('privado:mensaje', { paraUsername: username, texto: limpio });
    setTexto('');
  };

  return (
    <div style={estilos.overlay} onClick={onCerrar}>
      <div style={estilos.anillo} onClick={(e) => e.stopPropagation()}>
        <div style={estilos.box}>
          <div style={estilos.header}>
            <span style={estilos.titulo}>💬 {username}</span>
            <button style={estilos.cerrar} onClick={onCerrar}>✕</button>
          </div>

          <div style={estilos.mensajesLista}>
            {cargando ? (
              <p style={estilos.aviso}>Cargando...</p>
            ) : error ? (
              <p style={{ ...estilos.aviso, color: '#ffb3ab' }}>{error}</p>
            ) : mensajes.length === 0 ? (
              <p style={estilos.aviso}>Todavía no se escribieron nada. ¡Decí hola!</p>
            ) : (
              mensajes.map((m) => (
                <div key={m.id} style={{ ...estilos.fila, ...(m.propio ? estilos.filaPropia : {}) }}>
                  <div style={{ ...estilos.burbuja, ...(m.propio ? estilos.burbujaPropia : {}) }}>
                    <div style={estilos.textoMensaje}>{m.texto}</div>
                    <div style={{ ...estilos.hora, ...(m.propio ? estilos.horaPropia : {}) }}>{horaCorta(m.timestamp)}</div>
                  </div>
                </div>
              ))
            )}
            <div ref={finRef} />
          </div>

          <form onSubmit={enviarMensaje} style={estilos.form}>
            <input
              type="text"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={`Mensaje para ${username}...`}
              maxLength={200}
              style={estilos.input}
              disabled={!!error}
            />
            <button type="submit" style={estilos.botonEnviar} disabled={!!error}>
              <img src="/assets/images/icono-enviar.png" alt="" style={{ width: 26, height: 26, objectFit: 'contain' }} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const estilos = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3100, padding: 16,
  },
  anillo: {
    padding: 3, borderRadius: 21, backgroundColor: C.dorado,
    boxShadow: '0 5px 0 rgba(0,0,0,0.2)', width: '92%', maxWidth: 380,
  },
  box: {
    backgroundColor: C.verdeProfundo, border: `2px solid ${C.chocolate}`, borderRadius: 18,
    display: 'flex', flexDirection: 'column', height: 'min(520px, 78vh)', overflow: 'hidden',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 14px', background: 'rgba(0,0,0,0.2)', borderBottom: `2px solid ${C.chocolate}44`,
  },
  titulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: C.crema },
  cerrar: {
    background: '#fff', border: `2px solid ${C.chocolate}`, borderRadius: 8,
    width: 26, height: 26, cursor: 'pointer', fontSize: 12, color: C.chocolate,
  },
  mensajesLista: { flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 },
  aviso: { color: '#cfe9d6', fontSize: 12.5, fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  fila: { display: 'flex', maxWidth: '85%' },
  filaPropia: { alignSelf: 'flex-end' },
  burbuja: {
    background: C.cremaSutil, borderRadius: 14, padding: '9px 12px',
    boxShadow: '0 2px 6px rgba(0,0,0,0.18)', minWidth: 0,
  },
  burbujaPropia: { background: `linear-gradient(160deg, ${C.doradoClaro}, ${C.dorado})` },
  textoMensaje: { fontSize: 14, color: C.chocolate, lineHeight: 1.4, wordBreak: 'break-word' },
  hora: { fontSize: 10, color: '#a09085', marginTop: 3 },
  horaPropia: { color: C.doradoOscuro, opacity: 0.75, textAlign: 'right' },
  form: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
    borderTop: `2px solid ${C.chocolate}44`, background: 'rgba(0,0,0,0.15)',
  },
  input: {
    flex: 1, background: C.cremaSutil, border: `2px solid ${C.chocolate}`, borderRadius: 12,
    padding: '9px 12px', fontSize: 14, color: C.chocolate, outline: 'none', minWidth: 0,
  },
  botonEnviar: {
    background: C.chocolate, border: `2px solid ${C.dorado}`, borderRadius: 10,
    padding: '0 10px', cursor: 'pointer', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
};