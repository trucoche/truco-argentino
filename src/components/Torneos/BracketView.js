import React, { useState, useEffect, useCallback } from 'react';
import PantallaCarga from '../PantallaCarga/PantallaCarga';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/torneos`;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8',
  crema: '#FFF8ED', chocolate: '#4A2C2A'
};

export default function BracketView({ torneoId, usuario, token, onVolver, onEntrarAPartida }) {
  const [torneo, setTorneo] = useState(null);
  const [partidos, setPartidos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  const headers = { 'Authorization': `Bearer ${token}` };

  const cargar = useCallback(async () => {
    try {
      const [resTorneo, resBracket] = await Promise.all([
        fetch(`${API_URL}/${torneoId}`, { headers }),
        fetch(`${API_URL}/${torneoId}/bracket`, { headers })
      ]);
      const dataTorneo = await resTorneo.json();
      const dataBracket = await resBracket.json();

      if (!resTorneo.ok || !resBracket.ok) {
        setError(dataTorneo.error || dataBracket.error || 'Error al cargar el bracket');
        return;
      }

      setTorneo(dataTorneo);
      setPartidos(dataBracket);
      setError('');
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [torneoId, token]);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, 4000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  // Centésimo cuadragésimo sexto pase: BracketView vive fuera del
  // AppShell (se monta directo en App.js), así que es la única pantalla
  // de esta lista que necesita su propio fondo-lobby detrás — de ahí
  // `completa`, igual que hace `estilos.pagina` para el resto de esta vista.
  if (cargando) return <PantallaCarga completa />;
  if (error) return <div style={estilos.pagina}><div style={{ ...estilos.errorBox, maxWidth: 700, margin: '60px auto' }}>{error}</div></div>;
  if (!torneo) return null;

  const rondas = {};
  partidos.forEach(p => {
    if (!rondas[p.ronda]) rondas[p.ronda] = [];
    rondas[p.ronda].push(p);
  });
  const numerosRonda = Object.keys(rondas).map(Number).sort((a, b) => a - b);
  const ultimaRonda = Math.max(...numerosRonda);

  const nombreDeLado = (nombreEquipo, jugadores) => {
    if (!jugadores) return 'Por definir';
    return nombreEquipo || jugadores.join(' / ');
  };

  const yoJuegoEste = (partido) => {
    const enA = partido.jugadores_a && partido.jugadores_a.includes(usuario.username);
    const enB = partido.jugadores_b && partido.jugadores_b.includes(usuario.username);
    return enA || enB;
  };

  return (
    <div style={estilos.pagina}>
      <div style={estilos.contenedor}>

        <div style={estilos.topBar}>
          <div style={estilos.pageTitle}>{torneo.titulo}</div>
          <button onClick={onVolver} style={estilos.btnVolver}>← Volver</button>
        </div>

        <div style={estilos.subInfo}>
          {torneo.modo} · {torneo.estado === 'finalizada' ? 'Finalizado 🏆' : 'En curso'}
        </div>

        {torneo.estado === 'finalizada' && torneo.ganador_entrada_id && (
          <div style={estilos.finalizadoBanner}>🏆 Torneo finalizado — ¡felicitaciones al campeón!</div>
        )}

        <div style={estilos.bracket}>
          {numerosRonda.map(numRonda => {
            const esRondaFinal = numRonda === ultimaRonda;
            return (
              <div key={numRonda} style={estilos.ronda}>
                <div style={estilos.rondaTitulo}>{esRondaFinal ? 'Final' : `Ronda ${numRonda}`}</div>
                {rondas[numRonda]
                  .sort((a, b) => a.posicion - b.posicion)
                  .map(p => {
                    const gananA = p.ganador_entrada_id && p.ganador_entrada_id === p.entrada_a_id;
                    const gananB = p.ganador_entrada_id && p.ganador_entrada_id === p.entrada_b_id;
                    const esMio = yoJuegoEste(p);

                    // Campeón real = ganador de ESTA ronda (la final) Y coincide
                    // con el ganador oficial del torneo entero — así lo distinguimos
                    // de un simple "ganó su partido de ronda intermedia".
                    const esElCampeonA = esRondaFinal && gananA && p.entrada_a_id === torneo.ganador_entrada_id;
                    const esElCampeonB = esRondaFinal && gananB && p.entrada_b_id === torneo.ganador_entrada_id;

                    return (
                      <div
                        key={p.id}
                        style={{
                          ...estilos.match,
                          ...(esRondaFinal ? estilos.matchFinal : {}),
                          ...(esMio && p.estado === 'jugando' ? estilos.matchMio : {})
                        }}
                      >
                        <div style={esElCampeonA ? estilos.campeonLinea : (gananA ? estilos.ganadorTexto : estilos.textoNormal)}>
                          {esElCampeonA && <span style={estilos.corona}>👑</span>}
                          {nombreDeLado(p.nombre_entrada_a, p.jugadores_a)}
                        </div>
                        <div style={estilos.vs}>vs</div>
                        <div style={esElCampeonB ? estilos.campeonLinea : (gananB ? estilos.ganadorTexto : estilos.textoNormal)}>
                          {esElCampeonB && <span style={estilos.corona}>👑</span>}
                          {nombreDeLado(p.nombre_entrada_b, p.jugadores_b)}
                        </div>

                        {p.estado === 'jugando' && esMio && (
                          <button onClick={() => onEntrarAPartida(p.codigo_sala)} style={estilos.btnEntrar}>
                            Entrar a mi partida
                          </button>
                        )}
                        {p.estado === 'esperando' && (
                          <div style={estilos.estadoEsperando}>Esperando rivales...</div>
                        )}
                        {p.estado === 'finalizado' && (
                          <div style={estilos.estadoFinalizado}>✓ Finalizado</div>
                        )}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}

const estilos = {
  pagina: {
    minHeight: '100vh',
    background: 'radial-gradient(circle at 50% 0%, #379a54 0%, #2D9B4F 45%, #1f7a3c 100%)',
    fontFamily: "'Nunito', sans-serif",
    padding: '24px 16px 60px'
  },
  contenedor: { maxWidth: 900, margin: '0 auto' },
  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  pageTitle: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 22,
    color: C.crema, WebkitTextStroke: `1.5px ${C.chocolate}`, paintOrder: 'stroke fill'
  },
  btnVolver: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: C.crema, color: C.chocolate, border: `2.5px solid ${C.chocolate}`,
    borderRadius: 12, padding: '8px 14px', boxShadow: '0 3px 0 rgba(0,0,0,0.3)', cursor: 'pointer'
  },
  subInfo: { color: 'rgba(255,248,237,0.85)', fontWeight: 700, fontSize: 13, marginBottom: 14 },
  errorBox: {
    background: '#ffe0dd', border: '2px solid #E8483A', color: '#c2352a',
    borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: 14
  },
  finalizadoBanner: {
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`,
    border: `3px solid ${C.chocolate}`, borderRadius: 16, padding: '12px 18px',
    textAlign: 'center', fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 15,
    color: C.chocolate, boxShadow: `0 4px 0 ${C.doradoOscuro}`, marginBottom: 22
  },
  bracket: { display: 'flex', gap: 32, overflowX: 'auto', paddingBottom: 20 },
  ronda: { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 200 },
  rondaTitulo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13, color: C.crema,
    textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5, opacity: 0.85, marginBottom: 2
  },
  match: {
    background: C.crema, border: `2.5px solid ${C.chocolate}`, borderRadius: 14,
    padding: '12px 14px', fontSize: 13, fontWeight: 700, color: C.chocolate,
    boxShadow: '0 3px 0 rgba(0,0,0,0.2)'
  },
  matchFinal: {
    background: `linear-gradient(180deg, #fffdf5, ${C.crema})`,
    border: `3px solid ${C.doradoOscuro}`,
    boxShadow: `0 0 0 3px ${C.doradoClaro}, 0 4px 0 ${C.doradoOscuro}`
  },
  matchMio: { background: '#e3f2fd' },
  textoNormal: { color: C.chocolate },
  ganadorTexto: { color: C.verdeOscuro, fontWeight: 800 },
  campeonLinea: { display: 'flex', alignItems: 'center', gap: 6, color: C.doradoOscuro, fontWeight: 800 },
  corona: { fontSize: 15 },
  vs: { color: '#a89a90', fontSize: 10, fontWeight: 800, margin: '2px 0' },
  btnEntrar: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: C.celeste, color: C.chocolate, border: `2px solid ${C.chocolate}`,
    borderRadius: 10, padding: '7px 10px', boxShadow: '0 3px 0 #3a91c2',
    cursor: 'pointer', width: '100%', marginTop: 8
  },
  estadoEsperando: { fontSize: 11, color: '#a89a90', fontWeight: 700, marginTop: 6 },
  estadoFinalizado: { fontSize: 11, color: C.verdeOscuro, fontWeight: 800, marginTop: 6 }
};