import PopupMadera from '../Popup/PopupMadera';
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

export default function AvisosGlobales({ usuario, token, onAceptarDesafio, onCambioSolicitudesPendientes, onIrASolicitudesAmistad, onIrAInscripcionTorneo }) {
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
  // Pase 377: invitaciones pendientes a un equipo de torneo (2v2/3v3). Se muestra la primera
  // como popup con Aceptar/Rechazar; el invitado paga su entrada recién al aceptar.
  const [invitacionesTorneo, setInvitacionesTorneo] = useState([]);
  const [respondiendoInvitacion, setRespondiendoInvitacion] = useState(false);

  const cargarInvitacionesTorneo = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/torneos/invitaciones/pendientes`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data?.invitaciones)) setInvitacionesTorneo(data.invitaciones);
    } catch (err) {
      console.error('Error cargando invitaciones de torneo:', err);
    }
  };

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

    // Pase 377: invitaciones de equipo de torneo (el listado en sí viene del backend, así que ante
    // cualquier novedad simplemente se vuelve a pedir).
    const alInvitacionTorneo = () => cargarInvitacionesTorneo();
    const alInvitacionCancelada = ({ invitacionId }) =>
      setInvitacionesTorneo((lista) => lista.filter((i) => !(i.tipo !== 'cupo' && i.id === invitacionId)));
    // Pase 382: respuesta a una invitación a un cupo libre de mi torneo.
    const alCupoRespondido = ({ aceptada, username, titulo, requiereEquipo }) => {
      window.dispatchEvent(new Event('torneos-actualizados'));
      mostrarToast(
        aceptada
          ? (requiereEquipo
              ? `${username} aceptó tu invitación a "${titulo}" y va a armar su equipo.`
              : `${username} aceptó tu invitación y se anotó a "${titulo}".`)
          : `${username} rechazó tu invitación a "${titulo}".`,
        aceptada ? 'exito' : 'info',
        4000
      );
    };
    // Pase 382: anti-spam — el servidor frenó un mensaje por escribir muy rápido o repetido.
    const alLimite = ({ mensaje }) => mostrarToast(mensaje, 'info', 3000);
    const alEquipoCancelado = ({ titulo, motivo, por }) => {
      const texto = motivo === 'torneo_eliminado'
        ? `El creador eliminó el torneo "${titulo}": se te devolvió la entrada.`
        : motivo === 'rechazada'
        ? `${por} rechazó la invitación: se canceló tu equipo en "${titulo}" y se te devolvió la entrada.`
        : motivo === 'sin_respuesta'
          ? `Tus amigos no respondieron a tiempo: se canceló tu equipo en "${titulo}" y se te devolvió la entrada.`
          : `${por} canceló el equipo en "${titulo}" y se te devolvió la entrada.`;
      mostrarToast(texto, 'info', 5000);
      window.dispatchEvent(new Event('torneos-actualizados'));
    };
    const alInvitacionRespondida = ({ aceptada, username, titulo, equipoCompleto }) => {
      window.dispatchEvent(new Event('torneos-actualizados'));
      if (!aceptada) return;
      mostrarToast(
        equipoCompleto
          ? `${username} aceptó: tu equipo para "${titulo}" está completo.`
          : `${username} aceptó la invitación a "${titulo}".`,
        'exito',
        4000
      );
    };
    socket.on('torneo:invitacion', alInvitacionTorneo);
    socket.on('torneo:invitacion-cancelada', alInvitacionCancelada);
    socket.on('torneo:equipo-cancelado', alEquipoCancelado);
    socket.on('torneo:invitacion-respondida', alInvitacionRespondida);
    socket.on('torneo:invitacion-cupo-respondida', alCupoRespondido);
    socket.on('aviso:limite', alLimite);

    socket.on('desafio:recibido', alRecibirDesafio);
    socket.on('desafio:rechazado', alRechazarse);
    socket.on('desafio:expirado', alExpirarse);
    socket.on('desafio:error', alErrorDesafio);
    socket.on('desafio:enviado', alEnviarse);
    socket.on('desafio:aceptado', alAceptarse);
    socket.on('privado:mensaje-nuevo', alMensajePrivado);

    return () => {
      socket.off('torneo:invitacion', alInvitacionTorneo);
      socket.off('torneo:invitacion-cancelada', alInvitacionCancelada);
      socket.off('torneo:equipo-cancelado', alEquipoCancelado);
      socket.off('torneo:invitacion-respondida', alInvitacionRespondida);
      socket.off('torneo:invitacion-cupo-respondida', alCupoRespondido);
      socket.off('aviso:limite', alLimite);
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
                // Pase 205: bug real reportado por el usuario — tocar este
                // toast no llevaba a ningún lado (no tenía `alPresionar`,
                // así que tocarlo solo lo cerraba, igual que cualquier
                // otro toast sin acción propia). Ahora navega a Chat
                // Global y le avisa a esa pantalla que abra el panel de
                // "Solicitudes de amistad" (ver `onIrASolicitudesAmistad`
                // en App.js y `abrirSolicitudesSenial` en ChatGlobal.js),
                // en vez de dejar al usuario a encontrarlo por su cuenta.
                mostrarToast(`🤝 ${username} te envió una solicitud de amistad.`, 'info', 3200, onIrASolicitudesAmistad);
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
  }, [token, usuario?.id, mostrarToast, onCambioSolicitudesPendientes, onIrASolicitudesAmistad]);

  // Pase 377: polling de invitaciones de torneo (cubre al amigo que estaba desconectado cuando
  // llegó el aviso en vivo, y refresca si una invitación venció).
  useEffect(() => {
    if (!token || !usuario?.id) return;
    cargarInvitacionesTorneo();
    const intervalo = setInterval(cargarInvitacionesTorneo, 15000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, usuario?.id]);

  const invitacionTorneo = invitacionesTorneo[0] || null;
  const esInvitacionCupo = invitacionTorneo?.tipo === 'cupo';
  const cupoEs1v1 = invitacionTorneo?.modo === '1v1';

  const responderInvitacionTorneo = async (aceptar) => {
    if (!invitacionTorneo || respondiendoInvitacion) return;
    setRespondiendoInvitacion(true);
    try {
      const base = invitacionTorneo.tipo === 'cupo' ? 'invitaciones-cupo' : 'invitaciones';
      const res = await fetch(
        `${API_URL}/api/torneos/${base}/${invitacionTorneo.id}/${aceptar ? 'aceptar' : 'rechazar'}`,
        { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } }
      );
      const data = await res.json();
      if (!res.ok) {
        mostrarToast(data.error || 'No se pudo responder la invitación', 'error');
      } else if (aceptar && data.requiereEquipo) {
        // Invitación a un cupo de un torneo 2v2/3v3: lo lleva a anotarse eligiendo a su compañero.
        mostrarToast('Elegí a tu compañero para anotarte al torneo.', 'exito', 4500);
        onIrAInscripcionTorneo?.(data.torneo);
      } else if (aceptar && invitacionTorneo.tipo === 'cupo') {
        mostrarToast(`¡Listo! Te anotaste a "${invitacionTorneo.titulo}".`, 'exito', 4500);
      } else if (aceptar) {
        mostrarToast(
          data.equipoCompleto
            ? `¡Listo! Te anotaste a "${invitacionTorneo.titulo}" y el equipo está completo.`
            : `Te anotaste a "${invitacionTorneo.titulo}". Faltan tus otros compañeros.`,
          'exito',
          4500
        );
      } else {
        mostrarToast('Invitación rechazada.', 'info');
      }
    } catch (err) {
      console.error('Error respondiendo invitación de torneo:', err);
      mostrarToast('No se pudo conectar con el servidor', 'error');
    } finally {
      setRespondiendoInvitacion(false);
      cargarInvitacionesTorneo();
    }
  };

  const responder = (aceptar) => {
    if (!desafioRecibido) return;
    getSocket().emit('desafio:responder', { idDesafio: desafioRecibido.idDesafio, aceptar });
    setDesafioRecibido(null);
  };

  return (
    <>
      {/* Pase 325: el desafío es un pop-up de madera (cinta roja, espadas con resplandor, botones píldora 3D). */}
      <PopupMadera
        visible={!!desafioRecibido}
        titulo="¡Desafío!"
        cinta="roja"
        icono="/assets/images/vs-escudo.png"
        tamIcono={92}
        onCerrar={() => responder(false)}
        botones={[
          { texto: '✔ Aceptar', tipo: 'verde', onClick: () => responder(true) },
          { texto: '✖ Rechazar', tipo: 'carmesi', onClick: () => responder(false) },
        ]}
      >
        <p style={{ margin: '0 0 14px', fontWeight: 800, fontSize: 15, color: '#2C160E', textAlign: 'center' }}>
          <strong>{desafioRecibido?.de?.username}</strong> te desafió a jugar.
        </p>
      </PopupMadera>
      {/* Pase 377: invitación a un equipo de torneo (el invitado paga su entrada al aceptar). */}
      <PopupMadera
        visible={!!invitacionTorneo && !desafioRecibido}
        titulo="¡Invitación a torneo!"
        cinta="verde"
        icono="/assets/images/trofeo.png"
        tamIcono={64}
        onCerrar={() => responderInvitacionTorneo(false)}
        botones={[
          { texto: esInvitacionCupo && cupoEs1v1 ? '✔ Anotarme' : '✔ Aceptar', tipo: 'verde', disabled: respondiendoInvitacion, onClick: () => responderInvitacionTorneo(true) },
          { texto: '✖ Rechazar', tipo: 'carmesi', disabled: respondiendoInvitacion, onClick: () => responderInvitacionTorneo(false) },
        ]}
      >
        <p style={{ margin: '0 0 8px', fontWeight: 800, fontSize: 15, color: '#2C160E', textAlign: 'center' }}>
          {esInvitacionCupo ? (
            <><strong>{invitacionTorneo?.invitador_nombre}</strong> te invitó a sumarte al torneo <strong>{invitacionTorneo?.titulo}</strong>.</>
          ) : (
            <><strong>{invitacionTorneo?.invitador_nombre}</strong> te invitó a su equipo en <strong>{invitacionTorneo?.titulo}</strong>.</>
          )}
        </p>
        <p style={{ margin: '0 0 14px', fontWeight: 700, fontSize: 13, color: '#7a6660', textAlign: 'center' }}>
          {invitacionTorneo?.modo} · {invitacionTorneo?.puntos_para_ganar} pts · Entrada {Math.round(Number(invitacionTorneo?.apuesta || 0))} monedas{' '}
          {esInvitacionCupo && !cupoEs1v1
            ? '(al aceptar elegís a tu compañero y pagás recién al anotarte)'
            : '(se descuenta al aceptar)'}
        </p>
      </PopupMadera>
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