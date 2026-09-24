import React, { useEffect, useRef, useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { getSocket } from '../../services/socket';
import MensajePrivadoModal from '../MensajePrivado/MensajePrivadoModal';
import { API_URL } from '../../config';

// Pase siguiente: puente entre los eventos de socket de "Desafiar" y
// mensaje privado, y el resto de la app. Vive DENTRO de <ToastProvider>
// (a diferencia de App() mismo, que es quien CREA el Provider — por eso
// no puede usar useToast() directamente, ver App.js) para poder mostrar
// toasts/el popup de desafío recibido desde cualquier pantalla, sin
// duplicar la conexión de socket (usa el mismo singleton compartido, ver
// services/socket.js — la conexión y el 'chat-global:entrar' ya los hace
// el useEffect de App.js).
//
// El popup de "te desafiaron" se muestra encima de TODO (position:fixed,
// z-index alto) porque puede llegar estando en cualquier pantalla, no
// solo en el lobby o en el perfil de esa persona.
const C = {
  dorado: '#FFB627', doradoClaro: '#FFD668', chocolate: '#4A2C2A', crema: '#FFF8ED',
};

export default function AvisosGlobales({ usuario, token, onAceptarDesafio, onCambioSolicitudesPendientes }) {
  const { mostrarToast } = useToast();
  const [desafioRecibido, setDesafioRecibido] = useState(null); // { idDesafio, de }
  // Pase siguiente: tocar el toast de "mensaje privado nuevo" ahora abre
  // la conversación (antes solo lo cerraba, sin ninguna forma de leer el
  // mensaje desde el aviso).
  const [conversacionAbierta, setConversacionAbierta] = useState(null);
  // Pase 196: qué usernames ya tenían una solicitud de amistad pendiente en
  // el último polling — para avisar con un toast solo la que apareció
  // NUEVA entre un polling y el siguiente. `null` marca "todavía no se
  // hizo la primera carga de la sesión", así el primer polling (que puede
  // traer solicitudes viejas, de antes de abrir la app) solo establece la
  // base sin disparar un toast por cada una.
  const solicitudesConocidasRef = useRef(null);

  useEffect(() => {
    if (!usuario?.id) return;
    const socket = getSocket();

    const alRecibirDesafio = (payload) => setDesafioRecibido(payload);

    const alRechazarse = ({ username, motivo }) => {
      setDesafioRecibido((actual) => (actual ? null : actual));
      mostrarToast(
        motivo === 'sin_respuesta'
          ? `${username} no respondió a tiempo.`
          : `${username} rechazó tu desafío.`,
        'info'
      );
    };

    // Pase siguiente: el receptor de un desafío también tiene que
    // enterarse de que expiró — antes solo se avisaba a quien desafió, y
    // este popup se quedaba en pantalla para siempre si no se lo tocaba a
    // mano.
    const alExpirarse = ({ idDesafio }) => {
      setDesafioRecibido((actual) => (actual?.idDesafio === idDesafio ? null : actual));
    };

    const alErrorDesafio = ({ mensaje }) => mostrarToast(mensaje, 'error');

    // Pase siguiente: confirmación de que el desafío salió — hace falta
    // para la opción nueva de "Desafiar" desde el menú "⋮" de Chat
    // Global, que no tiene su propio botón con feedback como el popup de
    // perfil.
    const alEnviarse = ({ username }) => mostrarToast(`Desafío enviado a ${username}.`, 'exito');

    const alAceptarse = ({ codigo }) => {
      setDesafioRecibido(null);
      onAceptarDesafio(codigo);
    };

    const alMensajePrivado = (msg) => {
      if (msg.de === usuario.username) return; // eco de mi propio mensaje
      mostrarToast(`💬 ${msg.de}: ${msg.texto}`, 'info', 3200, () => setConversacionAbierta(msg.de));
    };

    socket.on('desafio:recibido', alRecibirDesafio);
    socket.on('desafio:rechazado', alRechazarse);
    socket.on('desafio:expirado', alExpirarse);
    socket.on('desafio:error', alErrorDesafio);
    socket.on('desafio:enviado', alEnviarse);
    socket.on('desafio:aceptado', alAceptarse);
    socket.on('privado:mensaje-nuevo', alMensajePrivado);

    return () => {
      socket.off('desafio:recibido', alRecibirDesafio);
      socket.off('desafio:rechazado', alRechazarse);
      socket.off('desafio:expirado', alExpirarse);
      socket.off('desafio:error', alErrorDesafio);
      socket.off('desafio:enviado', alEnviarse);
      socket.off('desafio:aceptado', alAceptarse);
      socket.off('privado:mensaje-nuevo', alMensajePrivado);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usuario?.id]);

  // Pase 196: mudado de App.js (ver comentario junto a la declaración de
  // `solicitudesAmistadPendientes` ahí) — el polling propio (cada 20s,
  // mientras haya sesión) del conteo de solicitudes de amistad pendientes
  // vive ACÁ ahora porque también hace falta poder avisar con un toast
  // ("alguien te envió una solicitud de amistad") la solicitud NUEVA que
  // apareció, y este es el componente que tiene acceso a useToast (ver
  // comentario grande arriba del archivo). El conteo se sigue mandando
  // hacia arriba con onCambioSolicitudesPendientes, para que App.js siga
  // encendiendo el punto rojo de la pestaña "Chat" con el mismo criterio
  // de antes. A diferencia del de mensajes, no se apaga al entrar a la
  // pantalla de Chat — solo baja cuando el conteo real bajó (el usuario
  // respondió las solicitudes).
  useEffect(() => {
    if (!token || !usuario?.id) return;
    let activo = true;

    const cargarSolicitudesAmistad = async () => {
      try {
        const res = await fetch(`${API_URL}/api/usuarios/solicitudes-amistad`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        if (activo && Array.isArray(data?.solicitudes)) {
          const usernamesActuales = new Set(data.solicitudes.map((s) => s.username));
          if (solicitudesConocidasRef.current) {
            usernamesActuales.forEach((username) => {
              if (!solicitudesConocidasRef.current.has(username)) {
                mostrarToast(`🤝 ${username} te envió una solicitud de amistad.`, 'info');
              }
            });
          }
          solicitudesConocidasRef.current = usernamesActuales;
          onCambioSolicitudesPendientes?.(data.solicitudes.length);
        }
      } catch (err) {
        console.error('Error cargando solicitudes de amistad:', err);
      }
    };

    cargarSolicitudesAmistad();
    const intervalo = setInterval(cargarSolicitudesAmistad, 20000);
    return () => { activo = false; clearInterval(intervalo); };
  }, [token, usuario?.id, mostrarToast, onCambioSolicitudesPendientes]);

  const responder = (aceptar) => {
    if (!desafioRecibido) return;
    getSocket().emit('desafio:responder', { idDesafio: desafioRecibido.idDesafio, aceptar });
    setDesafioRecibido(null);
  };

  return (
    <>
      {!!desafioRecibido && (
        <div style={estilos.overlay}>
          <div style={estilos.box}>
            <div style={estilos.icono}>⚔️</div>
            <div style={estilos.texto}>
              <strong>{desafioRecibido.de?.username}</strong> te desafió a jugar.
            </div>
            <div style={estilos.fila}>
              <button style={estilos.btnAceptar} onClick={() => responder(true)}>✔ Aceptar</button>
              <button style={estilos.btnRechazar} onClick={() => responder(false)}>✖ Rechazar</button>
            </div>
          </div>
        </div>
      )}
      {conversacionAbierta && token && (
        <MensajePrivadoModal
          username={conversacionAbierta}
          token={token}
          onCerrar={() => setConversacionAbierta(null)}
        />
      )}
    </>
  );
}

const estilos = {
  overlay: {
    position: 'fixed', top: 16, left: 0, right: 0, zIndex: 4500,
    display: 'flex', justifyContent: 'center', pointerEvents: 'none',
  },
  box: {
    pointerEvents: 'auto',
    background: C.crema, border: `2.5px solid ${C.chocolate}`, borderRadius: 16,
    padding: '14px 18px', boxShadow: '0 6px 16px rgba(0,0,0,0.35)',
    display: 'flex', alignItems: 'center', gap: 12, maxWidth: '92%',
  },
  icono: { fontSize: 26 },
  texto: { fontFamily: "'Nunito', sans-serif", fontSize: 14, color: C.chocolate },
  fila: { display: 'flex', gap: 8, flexShrink: 0 },
  btnAceptar: {
    fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12.5,
    background: '#2D9B4F', color: '#fff', border: 'none', borderRadius: 9,
    padding: '7px 12px', cursor: 'pointer',
  },
  btnRechazar: {
    fontFamily: "'Nunito', sans-serif", fontWeight: 800, fontSize: 12.5,
    background: '#fff', color: '#c2352a', border: '2px solid #E8483A', borderRadius: 9,
    padding: '7px 12px', cursor: 'pointer',
  },
};