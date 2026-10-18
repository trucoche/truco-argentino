import React, { useEffect, useRef, useState } from 'react';
import { getSocket } from '../../services/socket';
import { API_URL as BASE_URL } from '../../config';
import PopupMadera from '../Popup/PopupMadera';

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

  // Pase 429: el chat privado pasa a la familia "madera y pergamino" (mismo
  // PopupMadera que el resto): cinta con el nombre, X de la placa, lista de
  // mensajes sobre un pergamino hundido y el mismo botón de enviar.
  return (
    <PopupMadera titulo={username} cinta="madera" onCerrar={onCerrar} anchoMax={400} centrado={false}>
      <div style={estilos.panel}>
        <div style={estilos.mensajesLista}>
          {cargando ? (
            <p style={estilos.aviso}>Cargando...</p>
          ) : error ? (
            <p style={{ ...estilos.aviso, color: '#B4402A', fontStyle: 'normal', fontWeight: 700 }}>{error}</p>
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
          {/* Ducentésimo cuadragésimo noveno pase: mismo botón ilustrado
              que Chat Global/ChatMesa (pill verde con el avioncito). */}
          <button type="submit" aria-label="Enviar" style={estilos.botonEnviar} disabled={!!error} />
        </form>
      </div>
    </PopupMadera>
  );
}

const estilos = {
  panel: { display: 'flex', flexDirection: 'column', gap: 10, height: 'min(400px, 56vh)' },
  mensajesLista: {
    flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 12px',
    display: 'flex', flexDirection: 'column', gap: 9,
    background: '#F3E6C6', border: '2px solid #6b4a34', borderRadius: 12,
    boxShadow: 'inset 0 3px 8px rgba(74,44,17,0.22)',
  },
  aviso: { color: '#7a5a3e', fontSize: 13, fontStyle: 'italic', textAlign: 'center', marginTop: 20 },
  fila: { display: 'flex', maxWidth: '85%' },
  filaPropia: { alignSelf: 'flex-end' },
  burbuja: {
    background: '#FAF5E8', border: '1.5px solid #6b4a3466', borderRadius: 12, padding: '7px 11px',
    boxShadow: '0 2px 0 rgba(74,44,17,0.18)', minWidth: 0,
  },
  burbujaPropia: { background: '#FFE3A0', borderColor: '#C9860Eaa' },
  textoMensaje: { fontSize: 14, color: '#2D1A0E', lineHeight: 1.4, wordBreak: 'break-word', fontWeight: 600 },
  hora: { fontSize: 10, color: '#8a7360', marginTop: 3 },
  horaPropia: { color: '#8a5a0a', textAlign: 'right' },
  form: { display: 'flex', alignItems: 'center', gap: 8 },
  input: {
    flex: 1, background: '#FAF5E8', border: '2px solid #6b4a34', borderRadius: 12,
    padding: '9px 12px', fontSize: 14, color: '#2D1A0E', outline: 'none', minWidth: 0,
    boxSizing: 'border-box', fontFamily: "'Nunito', Arial, sans-serif",
  },
  botonEnviar: {
    width: 52, height: 37, flexShrink: 0,
    backgroundImage: 'url(/assets/images/boton-enviar-chat.png)',
    backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundColor: 'transparent',
    border: 'none', borderRadius: 0, cursor: 'pointer', padding: 0,
  },
};
