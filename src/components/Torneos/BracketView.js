import React, { useState, useEffect, useCallback } from 'react';
import PantallaCarga from '../PantallaCarga/PantallaCarga';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/torneos`;

const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8',
  crema: '#FFF8ED', chocolate: '#4A2C2A', apagado: '#a89a90'
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

  // Pase siguiente: barra de progreso ("X de Y partidos jugados") — antes
  // la única señal de avance del torneo era leer cada tarjeta una por
  // una; esto le da a la pantalla un resumen de un vistazo, igual que
  // tienen Torneos.js/Perfil con sus contadores.
  const totalPartidos = partidos.length;
  const partidosFinalizados = partidos.filter(p => p.estado === 'finalizado').length;
  const progreso = totalPartidos > 0 ? Math.round((partidosFinalizados / totalPartidos) * 100) : 0;

  const nombreDeLado = (nombreEquipo, jugadores) => {
    if (!jugadores) return 'Por definir';
    return nombreEquipo || jugadores.join(' / ');
  };

  const yoJuegoEste = (partido) => {
    const enA = partido.jugadores_a && partido.jugadores_a.includes(usuario.username);
    const enB = partido.jugadores_b && partido.jugadores_b.includes(usuario.username);
    return enA || enB;
  };

  // Iniciales para el "avatar" chip de cada lado del cruce — no tenemos
  // foto de perfil de equipos/rivales acá (el bracket no las pide al
  // backend), así que un chip con iniciales rompe la monotonía de puro
  // texto sin inventar datos que no tenemos.
  const iniciales = (nombre) => {
    if (!nombre || nombre === 'Por definir') return '?';
    const partes = nombre.trim().split(/\s+/);
    return partes.length > 1
      ? (partes[0][0] + partes[1][0]).toUpperCase()
      : nombre.slice(0, 2).toUpperCase();
  };

  return (
    <div style={estilos.pagina}>
      <div style={estilos.contenedor}>

        <div style={estilos.headerCard}>
          <button onClick={onVolver} style={estilos.btnVolver}>← Volver</button>
          <div style={estilos.headerCentro}>
            <div style={estilos.pageTitle}>🏆 {torneo.titulo}</div>
            <div style={estilos.subInfo}>{torneo.modo}</div>
          </div>
          <div style={{ ...estilos.estadoPill, ...(torneo.estado === 'finalizada' ? estilos.estadoPillFinalizado : estilos.estadoPillEnCurso) }}>
            {torneo.estado === 'finalizada' ? 'Finalizado' : 'En curso'}
          </div>
        </div>

        {totalPartidos > 0 && (
          <div style={estilos.progresoBox}>
            <div style={estilos.progresoTexto}>{partidosFinalizados} de {totalPartidos} partidos jugados</div>
            <div style={estilos.progresoBarraFondo}>
              <div style={{ ...estilos.progresoBarraRelleno, width: `${progreso}%` }} />
            </div>
          </div>
        )}

        {torneo.estado === 'finalizada' && torneo.ganador_entrada_id && (
          <div style={estilos.finalizadoBanner}>
            <span style={estilos.finalizadoBannerCorona}>👑</span>
            Torneo finalizado — ¡felicitaciones al campeón!
          </div>
        )}

        {totalPartidos === 0 ? (
          <div style={estilos.vacioBox}>
            <div style={estilos.vacioIcono}>🃏</div>
            <div style={estilos.vacioTitulo}>El bracket todavía se está armando</div>
            <div style={estilos.vacioTexto}>En cuanto se completen los cupos vas a ver acá los cruces de cada ronda.</div>
          </div>
        ) : (
          <div style={estilos.bracketCard}>
            <div style={estilos.bracket}>
              {numerosRonda.map((numRonda, idxRonda) => {
                const esRondaFinal = numRonda === ultimaRonda;
                return (
                  <React.Fragment key={numRonda}>
                    <div style={estilos.ronda}>
                      <div style={{ ...estilos.rondaTitulo, ...(esRondaFinal ? estilos.rondaTituloFinal : {}) }}>
                        {esRondaFinal ? '🏆 Final' : `Ronda ${numRonda}`}
                      </div>
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

                          const nombreA = nombreDeLado(p.nombre_entrada_a, p.jugadores_a);
                          const nombreB = nombreDeLado(p.nombre_entrada_b, p.jugadores_b);

                          return (
                            <div
                              key={p.id}
                              style={{
                                ...estilos.match,
                                ...(esRondaFinal ? estilos.matchFinal : {}),
                                ...(esMio && p.estado === 'jugando' ? estilos.matchMio : {})
                              }}
                            >
                              <div style={estilos.filaLado}>
                                <div style={{ ...estilos.avatarChip, ...(gananA ? estilos.avatarChipGanador : {}) }}>{iniciales(nombreA)}</div>
                                <div style={esElCampeonA ? estilos.campeonLinea : (gananA ? estilos.ganadorTexto : estilos.textoNormal)}>
                                  {esElCampeonA && <span style={estilos.corona}>👑</span>}
                                  {nombreA}
                                </div>
                              </div>

                              <div style={estilos.vsWrap}><span style={estilos.vsBadge}>VS</span></div>

                              <div style={estilos.filaLado}>
                                <div style={{ ...estilos.avatarChip, ...(gananB ? estilos.avatarChipGanador : {}) }}>{iniciales(nombreB)}</div>
                                <div style={esElCampeonB ? estilos.campeonLinea : (gananB ? estilos.ganadorTexto : estilos.textoNormal)}>
                                  {esElCampeonB && <span style={estilos.corona}>👑</span>}
                                  {nombreB}
                                </div>
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

                    {idxRonda < numerosRonda.length - 1 && (
                      <div style={estilos.conector}>
                        <div style={estilos.conectorLinea} />
                        <span style={estilos.conectorFlecha}>›</span>
                        <div style={estilos.conectorLinea} />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

const estilos = {
  // Pase siguiente: el gradiente verde plano de acá se reemplaza por el
  // mismo fondo-imagen (fondo-lobby.jpeg + velo oscuro) que usa
  // AppShell.js/.ts-shell y PantallaCarga(completa) en el resto de la
  // app — antes esta era la única pantalla con un fondo distinto al de
  // Ranking/Torneos/Lobby, por vivir fuera del AppShell.
  pagina: {
    minHeight: '100vh',
    backgroundImage: 'linear-gradient(rgba(20,20,15,0.38), rgba(20,20,15,0.38)), url(/assets/images/fondo-lobby.jpeg)',
    backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundAttachment: 'fixed',
    fontFamily: "'Nunito', sans-serif",
    padding: '24px 16px 60px'
  },
  contenedor: { maxWidth: 900, margin: '0 auto' },

  headerCard: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: C.crema, border: `3px solid ${C.chocolate}`, borderRadius: 18,
    padding: '12px 16px', marginBottom: 14, boxShadow: '0 4px 0 rgba(0,0,0,0.25)'
  },
  btnVolver: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: C.crema, color: C.chocolate, border: `2.5px solid ${C.chocolate}`,
    borderRadius: 12, padding: '8px 14px', boxShadow: '0 3px 0 rgba(0,0,0,0.3)', cursor: 'pointer', flexShrink: 0
  },
  headerCentro: { flex: 1, minWidth: 0 },
  pageTitle: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 18, color: C.chocolate,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
  },
  subInfo: { color: C.apagado, fontWeight: 700, fontSize: 12, marginTop: 2 },
  estadoPill: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 12,
    borderRadius: 20, padding: '6px 12px', flexShrink: 0, border: `2px solid ${C.chocolate}`
  },
  estadoPillEnCurso: { background: C.celeste, color: C.chocolate },
  estadoPillFinalizado: { background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate },

  progresoBox: {
    background: 'rgba(255,248,237,0.92)', border: `2.5px solid ${C.chocolate}`, borderRadius: 14,
    padding: '10px 14px', marginBottom: 14
  },
  progresoTexto: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 12.5, color: C.chocolate, marginBottom: 6 },
  progresoBarraFondo: { height: 10, borderRadius: 6, background: 'rgba(74,44,42,0.12)', overflow: 'hidden' },
  progresoBarraRelleno: { height: '100%', borderRadius: 6, background: `linear-gradient(90deg, ${C.doradoClaro}, ${C.dorado})`, transition: 'width 0.4s ease' },

  errorBox: {
    background: '#ffe0dd', border: '2px solid #E8483A', color: '#c2352a',
    borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: 14
  },
  finalizadoBanner: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`,
    border: `3px solid ${C.chocolate}`, borderRadius: 16, padding: '12px 18px',
    textAlign: 'center', fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 15,
    color: C.chocolate, boxShadow: `0 4px 0 ${C.doradoOscuro}, 0 0 0 3px rgba(255,214,104,0.4)`, marginBottom: 18
  },
  finalizadoBannerCorona: { fontSize: 20 },

  vacioBox: {
    background: 'rgba(255,248,237,0.92)', border: `3px dashed ${C.chocolate}`, borderRadius: 20,
    padding: '48px 24px', textAlign: 'center', maxWidth: 480, margin: '20px auto'
  },
  vacioIcono: { fontSize: 42, marginBottom: 10 },
  vacioTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: C.chocolate, marginBottom: 6 },
  vacioTexto: { fontSize: 13, color: C.apagado, fontWeight: 700, lineHeight: 1.4 },

  bracketCard: {
    background: 'rgba(255,248,237,0.85)', border: `3px solid ${C.chocolate}`, borderRadius: 20,
    padding: '20px 18px 16px', boxShadow: '0 5px 0 rgba(0,0,0,0.25)'
  },
  bracket: { display: 'flex', overflowX: 'auto', paddingBottom: 6, alignItems: 'center' },
  ronda: { display: 'flex', flexDirection: 'column', gap: 14, minWidth: 210, padding: '0 6px' },
  rondaTitulo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 12, color: C.chocolate,
    textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5,
    background: 'rgba(74,44,42,0.08)', borderRadius: 20, padding: '4px 10px', marginBottom: 2
  },
  rondaTituloFinal: {
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate
  },

  conector: { display: 'flex', alignItems: 'center', gap: 2, padding: '0 6px', alignSelf: 'stretch' },
  conectorLinea: { width: 14, height: 2, background: 'rgba(74,44,42,0.25)' },
  conectorFlecha: { fontSize: 20, color: C.doradoOscuro, fontWeight: 900, lineHeight: 1 },

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
  filaLado: { display: 'flex', alignItems: 'center', gap: 8 },
  avatarChip: {
    width: 24, height: 24, borderRadius: '50%', background: C.verdeOscuro, color: C.crema,
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800,
    flexShrink: 0, border: `1.5px solid ${C.chocolate}`
  },
  avatarChipGanador: { background: C.dorado, color: C.chocolate },
  textoNormal: { color: C.chocolate },
  ganadorTexto: { color: C.verdeOscuro, fontWeight: 800 },
  campeonLinea: { display: 'flex', alignItems: 'center', gap: 6, color: C.doradoOscuro, fontWeight: 800 },
  corona: { fontSize: 15 },
  vsWrap: { display: 'flex', justifyContent: 'center', margin: '4px 0' },
  vsBadge: {
    fontFamily: "'Fredoka', sans-serif", fontSize: 9, fontWeight: 900, color: '#fff', background: C.apagado,
    borderRadius: 8, padding: '2px 8px', letterSpacing: 0.5
  },
  btnEntrar: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13,
    background: C.celeste, color: C.chocolate, border: `2px solid ${C.chocolate}`,
    borderRadius: 10, padding: '7px 10px', boxShadow: '0 3px 0 #3a91c2',
    cursor: 'pointer', width: '100%', marginTop: 8
  },
  estadoEsperando: { fontSize: 11, color: C.apagado, fontWeight: 700, marginTop: 6 },
  estadoFinalizado: { fontSize: 11, color: C.verdeOscuro, fontWeight: 800, marginTop: 6 }
};
