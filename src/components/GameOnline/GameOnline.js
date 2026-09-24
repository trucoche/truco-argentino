import React, { useState, useEffect, useCallback } from 'react';
import { getSocket } from '../../services/socket';

export default function GameOnline({ usuario, codigoSala, onVolverLobby }) {
  const [estado, setEstado]     = useState(null);
  const [mensaje, setMensaje]   = useState('Conectando...');
  const [error, setError]       = useState('');
  const [terminado, setTerminado] = useState(null); // { ganador, motivo }

  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    socket.emit('unirse-sala', { codigoSala, usuario });

    const onEstado = (data) => {
      setEstado(data);
      setMensaje('');
    };
    const onJugadorUnido = (data) => setMensaje(data.mensaje);
    const onPartidaIniciada = (data) => setMensaje(data.mensaje);
    const onErrorSala = (data) => setError(data.mensaje);
    const onErrorJugada = (data) => setError(data.mensaje);
    const onJuegoTerminado = (data) => setTerminado(data);
    const onJugadorDesconectado = (data) => setMensaje(data.mensaje);
    const onSalaCancelada = (data) => {
      setError(data.mensaje);
      setTimeout(onVolverLobby, 3000);
    };

    socket.on('estado-juego', onEstado);
    socket.on('jugador-unido', onJugadorUnido);
    socket.on('partida-iniciada', onPartidaIniciada);
    socket.on('error-sala', onErrorSala);
    socket.on('error-jugada', onErrorJugada);
    socket.on('juego-terminado', onJuegoTerminado);
    socket.on('jugador-desconectado', onJugadorDesconectado);

    return () => {
    socket.on('estado-juego', onEstado);
    socket.on('jugador-unido', onJugadorUnido);
    socket.on('partida-iniciada', onPartidaIniciada);
    socket.on('error-sala', onErrorSala);
    socket.on('error-jugada', onErrorJugada);
    socket.on('juego-terminado', onJuegoTerminado);
    socket.on('jugador-desconectado', onJugadorDesconectado);
    socket.on('sala-cancelada', onSalaCancelada);
      // No desconectamos el socket acá por si el usuario solo cambia de pantalla brevemente;
      // se desconecta al cerrar sesión o cerrar la pestaña.
    };
  }, [codigoSala, usuario]);

  const jugarCarta = useCallback((cartaId) => {
    setError('');
    getSocket().emit('jugar-carta', { codigoSala, cartaId });
  }, [codigoSala]);

  const cantarTruco = useCallback(() => {
    setError('');
    getSocket().emit('cantar-truco', { codigoSala });
  }, [codigoSala]);

  const responderTruco = useCallback((respuesta) => {
    setError('');
    getSocket().emit('responder-truco', { codigoSala, respuesta });
  }, [codigoSala]);

  const cantarEnvido = useCallback((tipoEnvido) => {
    setError('');
    getSocket().emit('cantar-envido', { codigoSala, tipoEnvido });
  }, [codigoSala]);

  const responderEnvido = useCallback((respuesta) => {
    setError('');
    getSocket().emit('responder-envido', { codigoSala, respuesta });
  }, [codigoSala]);

  if (terminado) {
    const gano = terminado.ganador === 'yo';
    const porAbandono = terminado.motivo === 'abandono';
    return (
      <div style={estilos.contenedor}>
        <h2>{gano ? '¡Ganaste! 🎉' : 'Perdiste 😞'}</h2>
        {porAbandono && (
          <p style={{ color: '#888' }}>
            {gano ? 'El rival abandonó la partida.' : 'Perdiste por desconexión.'}
          </p>
        )}
        <button onClick={onVolverLobby}>Volver al Lobby</button>
      </div>
    );
  }

if (!estado) {
  const handleSalir = () => {
    getSocket().emit('cancelar-espera', { codigoSala });
    onVolverLobby();
  };

  return (
    <div style={estilos.contenedor}>
      <p>{mensaje || 'Cargando partida...'}</p>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <button onClick={handleSalir} style={{ marginTop: 20 }}>
        Volver al Lobby
      </button>
    </div>
  );
}

  const esMiTurno = estado.turno === 'mio';

  return (
    <div style={estilos.contenedor}>
      <div style={estilos.marcador}>
        <span>Vos: {estado.scores.yo}</span>
        <span>Rival: {estado.scores.rival}</span>
      </div>

      {mensaje && <p style={estilos.mensaje}>{mensaje}</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      <div style={estilos.zonaRival}>
        <p>Rival ({estado.cartasRivalEnMano} en mano)</p>
        <div style={estilos.filaCartas}>
          {estado.jugadasRival.map((c) => (
            <CartaVisual key={c.id} carta={c} />
          ))}
        </div>
      </div>

      <div style={estilos.centro}>
        <p style={estilos.turno}>{esMiTurno ? '● Tu turno' : 'Turno del rival'}</p>
      </div>

      <div style={estilos.zonaMia}>
        <div style={estilos.filaCartas}>
          {estado.misJugadas.map((c) => (
            <CartaVisual key={c.id} carta={c} />
          ))}
        </div>
        <p>Tu mano</p>
        <div style={estilos.filaCartas}>
          {estado.misCartas.map((c) => (
            <CartaVisual
              key={c.id}
              carta={c}
              jugable={esMiTurno}
              onClick={() => jugarCarta(c.id)}
            />
          ))}
        </div>
      </div>

      {/* Respuesta a truco pendiente */}
      {estado.truco.pendienteDeRespuesta && (
        <div style={estilos.panelCanto}>
          <p>El rival cantó {estado.truco.nivel}</p>
          <button onClick={() => responderTruco('quiero')}>Quiero</button>
          <button onClick={() => responderTruco('no-quiero')}>No quiero</button>
        </div>
      )}

      {/* Respuesta a envido pendiente */}
      {estado.envido.pendienteDeRespuesta && (
        <div style={estilos.panelCanto}>
          <p>El rival cantó {estado.envido.tipo}</p>
          <button onClick={() => responderEnvido('quiero')}>Quiero</button>
          <button onClick={() => responderEnvido('no-quiero')}>No quiero</button>
        </div>
      )}

      {/* Botones para cantar (solo si no hay nada pendiente) */}
      {!estado.truco.pendienteDeRespuesta && !estado.envido.pendienteDeRespuesta && (
        <div style={estilos.botonesCanto}>
          {estado.etapa === 'envido' && !estado.envido.tipo && (
            <>
              <button onClick={() => cantarEnvido('envido')}>Envido</button>
              <button onClick={() => cantarEnvido('real-envido')}>Real Envido</button>
              <button onClick={() => cantarEnvido('falta-envido')}>Falta Envido</button>
            </>
          )}
          {estado.truco.nivel !== 'vale-cuatro' && (
            <button onClick={cantarTruco}>
              {estado.truco.nivel ? 'Subir apuesta' : 'Truco'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function CartaVisual({ carta, jugable, onClick }) {
  return (
    <div
      onClick={jugable ? onClick : undefined}
      style={{
        ...estilos.carta,
        cursor: jugable ? 'pointer' : 'default',
        opacity: jugable ? 1 : 0.85,
        transform: jugable ? 'translateY(0)' : 'none'
      }}
    >
      {carta.valor} {carta.palo}
    </div>
  );
}

const estilos = {
  contenedor: {
    maxWidth: 700, margin: '20px auto', fontFamily: 'sans-serif',
    textAlign: 'center'
  },
  marcador: {
    display: 'flex', justifyContent: 'space-around', fontWeight: 'bold',
    fontSize: 18, marginBottom: 10
  },
  mensaje: { color: '#555', fontStyle: 'italic' },
  zonaRival: {
    background: '#f0f0f0', padding: 10, borderRadius: 8, marginBottom: 10
  },
  zonaMia: {
    background: '#e8f4ff', padding: 10, borderRadius: 8, marginTop: 10
  },
  centro: { margin: '10px 0' },
  turno: { fontWeight: 'bold', color: '#c77700' },
  filaCartas: {
    display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap'
  },
  carta: {
    border: '1px solid #333', borderRadius: 6, padding: '10px 14px',
    background: 'white', minWidth: 60
  },
  panelCanto: {
    background: '#fff3cd', border: '1px solid #ffc107', borderRadius: 8,
    padding: 12, margin: '10px 0'
  },
  botonesCanto: {
    display: 'flex', justifyContent: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap'
  }
};

