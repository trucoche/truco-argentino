import React, { useState, useEffect, useCallback } from 'react';
import PantallaCarga from '../PantallaCarga/PantallaCarga';
import PopupMadera from '../Popup/PopupMadera';
import { useToast } from '../../contexts/ToastContext';
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
  // Pase 382: "Invitar a un amigo" en cada cupo libre de la sala (selector de amigos).
  const { mostrarToast } = useToast();
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [amigos, setAmigos] = useState([]);
  const [cargandoAmigos, setCargandoAmigos] = useState(false);
  const [invitandoId, setInvitandoId] = useState(null);

  const headers = { 'Authorization': `Bearer ${token}` };

  const abrirSelectorAmigos = async () => {
    setSelectorAbierto(true);
    setCargandoAmigos(true);
    try {
      const res = await fetch(`${BASE_URL}/api/usuarios/amigos`, { headers });
      const data = await res.json();
      if (res.ok) setAmigos(Array.isArray(data.amigos) ? data.amigos : []);
    } catch (err) {
      console.error('Error cargando amigos:', err);
    } finally {
      setCargandoAmigos(false);
    }
  };

  const invitarAmigo = async (amigo) => {
    if (invitandoId) return;
    setInvitandoId(amigo.id);
    try {
      const res = await fetch(`${API_URL}/${torneoId}/invitar-cupo`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amigoId: amigo.id })
      });
      const data = await res.json();
      if (!res.ok) {
        mostrarToast(data.error || 'No se pudo enviar la invitación', 'error', 5000);
      } else {
        mostrarToast(data.mensaje || 'Invitación enviada', 'exito', 3500);
        setSelectorAbierto(false);
        cargar();
      }
    } catch (err) {
      mostrarToast('No se pudo conectar con el servidor', 'error');
    } finally {
      setInvitandoId(null);
    }
  };

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

  // Pase 203: BracketView ahora vive DENTRO del AppShell (pedido del
  // usuario: "colocar acá todos los elementos que tienen las otras
  // páginas, el header con el menú y la información del usuario", ver
  // App.js) — ya no necesita pintar su propio fondo-lobby ni pasar
  // `completa`, el mismo criterio que ya usan Ranking/Historial/Torneos.
  if (cargando) return <PantallaCarga />;
  if (error) return <div style={{ ...estilos.errorBox, maxWidth: 700, margin: '60px auto' }}>{error}</div>;
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

  // Pase 204: nombre del campeón para la copa grande de arriba (pedido
  // del usuario) — no hay un endpoint separado para esto, así que se
  // busca en el partido de la ronda final cuál de los dos lados coincide
  // con `ganador_entrada_id` (el mismo dato que ya usa el bracket de
  // abajo para la coronita 👑 de cada cruce).
  let nombreCampeon = null;
  if (torneo.estado === 'finalizada' && torneo.ganador_entrada_id) {
    const partidoFinal = partidos.find(p => p.ronda === ultimaRonda);
    if (partidoFinal) {
      if (partidoFinal.entrada_a_id === torneo.ganador_entrada_id) {
        nombreCampeon = nombreDeLado(partidoFinal.nombre_entrada_a, partidoFinal.jugadores_a);
      } else if (partidoFinal.entrada_b_id === torneo.ganador_entrada_id) {
        nombreCampeon = nombreDeLado(partidoFinal.nombre_entrada_b, partidoFinal.jugadores_b);
      }
    }
  }

  // Pase 379: datos de la "sala del torneo" (mientras el torneo está en inscripción).
  const entradasSala = torneo.entradas || [];
  const cupoTotal = torneo.cupo_entradas || entradasSala.length;
  const equiposListos = entradasSala.filter((e) => e.estado !== 'pendiente').length;
  const huecosLibres = Math.max(0, cupoTotal - entradasSala.length);
  const nombreEntrada = (e) => e.nombre_equipo || (e.jugadores || []).join(' / ');
  const esMiEntrada = (e) => (e.jugadores || []).includes(usuario.username);
  // Pase 382: invitaciones a un cupo ya enviadas (cada una ocupa visualmente un hueco libre) y amigos que
  // todavía se pueden invitar (no anotados, ni con invitación pendiente).
  const invitacionesCupo = torneo.invitaciones_cupo || [];
  const invitacionesVisibles = invitacionesCupo.slice(0, huecosLibres);
  const huecosSinInvitar = Math.max(0, huecosLibres - invitacionesVisibles.length);
  const ocupados = new Set([
    ...entradasSala.flatMap((e) => [...(e.jugadores || []), ...(e.invitados_pendientes || [])]),
    ...invitacionesCupo.map((i) => i.invitado),
  ]);
  const amigosInvitables = amigos.filter((a) => !ocupados.has(a.username));

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
      <div style={estilos.contenedor}>

        <PopupMadera
          visible={selectorAbierto}
          titulo="Invitar a un amigo"
          cinta="verde"
          icono="/assets/images/trofeo.png"
          tamIcono={56}
          onCerrar={() => setSelectorAbierto(false)}
          botones={[{ texto: 'Cerrar', tipo: 'neutro', onClick: () => setSelectorAbierto(false) }]}
        >
          <p style={{ margin: '0 0 10px', fontWeight: 800, fontSize: 14, color: '#2C160E', textAlign: 'center' }}>
            Tocá a un amigo para mandarle la invitación. Paga su entrada ({Math.round(Number(torneo.apuesta || 0))} monedas) recién cuando acepta.
          </p>
          {cargandoAmigos && amigos.length === 0 ? (
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#7a6660', textAlign: 'center' }}>Cargando tus amigos…</p>
          ) : amigosInvitables.length === 0 ? (
            <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: '#7a6660', textAlign: 'center' }}>
              No tenés amigos disponibles para invitar. Agregalos desde su perfil en el Chat Global.
            </p>
          ) : (
            <div style={estilos.selectorAmigosLista}>
              {amigosInvitables.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  disabled={!!invitandoId}
                  onClick={() => invitarAmigo(a)}
                  style={{ ...estilos.amigoChip, ...(invitandoId === a.id ? { opacity: 0.6 } : null) }}
                >
                  {a.username}
                </button>
              ))}
            </div>
          )}
        </PopupMadera>

        <div style={estilos.headerCard}>
          <button onClick={onVolver} style={estilos.btnVolver}>← Volver</button>
          <div style={estilos.headerCentro}>
            <div style={estilos.pageTitle}>🏆 {torneo.titulo}</div>
            <div style={estilos.subInfo}>{torneo.modo}</div>
          </div>
          <div style={{ ...estilos.estadoPill, ...(torneo.estado === 'finalizada' ? estilos.estadoPillFinalizado : estilos.estadoPillEnCurso) }}>
            {torneo.estado === 'finalizada' ? 'Finalizado' : torneo.estado === 'inscripcion' ? 'Inscripción abierta' : 'En curso'}
          </div>
        </div>

        {/* Pase 204: copa grande con el nombre del campeón — pedido del
            usuario ("colocar la imagen de una copa grande, con el
            espacio vacío en la parte del nombre y al finalizar el
            torneo pondríamos allí el nombre del ganador"). Antes de que
            el torneo termine el espacio del nombre queda como "Por
            definir", igual que el resto de los placeholders de esta
            pantalla. */}
        <div style={estilos.trofeoCard}>
          <img src="/assets/images/trofeo.png" alt="" style={estilos.trofeoCardImg} />
          <div style={estilos.trofeoCardLabel}>Campeón</div>
          <div style={{ ...estilos.trofeoCardNombre, ...(nombreCampeon ? estilos.trofeoCardNombreListo : {}) }}>
            {nombreCampeon || 'Por definir'}
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

        {totalPartidos === 0 && torneo.estado === 'inscripcion' ? (
          <div style={estilos.salaCard}>
            <div style={estilos.salaTitulo}>Sala del torneo</div>
            <div style={estilos.salaSub}>
              {equiposListos} de {cupoTotal} equipos listos · el bracket se arma cuando se completa el cupo
            </div>
            {/* Pase 383: jugadores sin equipo esperando que se les arme uno (completar al azar). */}
            {(torneo.jugadores_en_espera > 0 || torneo.estoy_en_espera) && (
              <div style={estilos.salaSub}>
                {torneo.estoy_en_espera
                  ? 'Estás en la lista de espera: te armamos equipo con otros jugadores.'
                  : `${torneo.jugadores_en_espera} jugador${torneo.jugadores_en_espera === 1 ? '' : 'es'} esperando equipo.`}
              </div>
            )}
            <div style={estilos.progresoBarraFondo}>
              <div style={{ ...estilos.progresoBarraRelleno, width: `${cupoTotal ? Math.round((equiposListos / cupoTotal) * 100) : 0}%` }} />
            </div>
            <div style={estilos.salaLista}>
              {entradasSala.map((e) => {
                const pendiente = e.estado === 'pendiente';
                const nombre = nombreEntrada(e);
                return (
                  <div key={e.id} style={{ ...estilos.salaFila, ...(esMiEntrada(e) ? estilos.salaFilaMia : {}) }}>
                    <div style={estilos.avatarChip}>{iniciales(nombre)}</div>
                    <div style={estilos.salaFilaTexto}>
                      <div style={estilos.salaNombre}>{nombre}{esMiEntrada(e) ? ' (vos)' : ''}</div>
                      {pendiente && (
                        <div style={estilos.salaDetalle}>
                          {[
                            (e.invitados_pendientes || []).length > 0
                              ? `Esperando a que acepte${(e.invitados_pendientes || []).length === 1 ? '' : 'n'}: ${(e.invitados_pendientes || []).join(', ')}`
                              : null,
                            e.huecos_azar > 0 ? `Buscando ${e.huecos_azar} jugador${e.huecos_azar === 1 ? '' : 'es'} al azar` : null,
                          ].filter(Boolean).join(' · ') || 'Esperando a sus compañeros'}
                        </div>
                      )}
                    </div>
                    <div style={{ ...estilos.salaBadge, ...(pendiente ? estilos.salaBadgePendiente : estilos.salaBadgeListo) }}>
                      {pendiente ? '⏳ Armando equipo' : '✓ Listo'}
                    </div>
                  </div>
                );
              })}
              {invitacionesVisibles.map((inv) => (
                <div key={`inv-${inv.id}`} style={estilos.salaFilaInvitada}>
                  ⏳ Invitación enviada a <strong>{inv.invitado}</strong>
                </div>
              ))}
              {Array.from({ length: huecosSinInvitar }).map((_, i) => (
                <div key={`libre-${i}`} style={{ ...estilos.salaFilaLibre, ...(torneo.puedo_invitar ? estilos.salaFilaLibreInvitable : {}) }}>
                  <span>Cupo libre</span>
                  {torneo.puedo_invitar && (
                    <button type="button" onClick={abrirSelectorAmigos} style={estilos.btnInvitarAmigo}>
                      + Invitar amigo
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : totalPartidos === 0 ? (
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
  );
}

const estilos = {
  contenedor: { maxWidth: 900, margin: '0 auto', fontFamily: "'Nunito', sans-serif" },

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

  trofeoCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
    background: 'rgba(255,248,237,0.92)', border: `3px solid ${C.chocolate}`, borderRadius: 20,
    padding: '18px 16px 16px', marginBottom: 14, boxShadow: '0 4px 0 rgba(0,0,0,0.25)'
  },
  trofeoCardImg: { height: 96, width: 'auto', objectFit: 'contain', marginBottom: 4 },
  trofeoCardLabel: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 11, color: C.apagado,
    textTransform: 'uppercase', letterSpacing: 0.8
  },
  trofeoCardNombre: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 20, color: C.apagado },
  trofeoCardNombreListo: { color: C.doradoOscuro },

  progresoBox: {
    background: 'rgba(255,248,237,0.92)', border: `2.5px solid ${C.chocolate}`, borderRadius: 14,
    padding: '10px 14px', marginBottom: 14
  },
  progresoTexto: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 12.5, color: C.chocolate, marginBottom: 6 },
  // Pase 381: barra plana estándar (canal pergamino + borde chocolate, relleno liso con filo oscuro, sin degradé).
  progresoBarraFondo: { height: 12, boxSizing: 'border-box', borderRadius: 8, background: '#E9D9BB', border: `2px solid ${C.chocolate}`, overflow: 'hidden' },
  progresoBarraRelleno: { height: '100%', boxSizing: 'border-box', background: C.dorado, borderRight: '2px solid #B9770E', transition: 'width 0.4s ease' },

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

  // Pase 379: sala del torneo (inscripción abierta) — equipos listos, equipos armándose y cupos libres.
  salaCard: {
    background: 'rgba(255,248,237,0.92)', border: `3px solid ${C.chocolate}`, borderRadius: 20,
    padding: '16px 16px 14px', marginBottom: 14, boxShadow: '0 4px 0 rgba(0,0,0,0.25)'
  },
  salaTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 17, color: C.chocolate },
  salaSub: { fontWeight: 700, fontSize: 12.5, color: C.apagado, margin: '2px 0 10px' },
  salaLista: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 },
  salaFila: {
    display: 'flex', alignItems: 'center', gap: 10, background: '#fff',
    border: `2px solid ${C.chocolate}`, borderRadius: 12, padding: '8px 10px'
  },
  salaFilaMia: { background: '#FFF4D6', borderColor: C.doradoOscuro },
  salaFilaTexto: { flex: 1, minWidth: 0 },
  salaNombre: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 14, color: C.chocolate, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  salaDetalle: { fontWeight: 700, fontSize: 11.5, color: '#7a6660', marginTop: 1 },
  salaBadge: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 11.5, borderRadius: 999, padding: '4px 10px', flexShrink: 0, border: `2px solid ${C.chocolate}` },
  salaBadgeListo: { background: '#CFF1DA', color: '#14532D' },
  salaBadgePendiente: { background: '#FFE9B0', color: '#7A4B00' },
  salaFilaLibre: {
    border: `2px dashed ${C.apagado}`, borderRadius: 12, padding: '10px', textAlign: 'center',
    fontWeight: 700, fontSize: 12.5, color: C.apagado
  },
  // Pase 382: cupo libre con botón "Invitar amigo" a la derecha.
  salaFilaLibreInvitable: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, textAlign: 'left'
  },
  btnInvitarAmigo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 12.5, color: C.chocolate,
    background: C.dorado, border: `2px solid ${C.chocolate}`, borderRadius: 999,
    boxShadow: `0 2px 0 ${C.doradoOscuro}`, padding: '4px 12px', cursor: 'pointer', flexShrink: 0
  },
  salaFilaInvitada: {
    border: `2px dashed ${C.doradoOscuro}`, borderRadius: 12, padding: '10px', textAlign: 'center',
    fontWeight: 700, fontSize: 12.5, color: '#7A4B00', background: '#FFF3D1'
  },
  selectorAmigosLista: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '4px 0 12px' },
  amigoChip: {
    fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, color: C.chocolate,
    background: '#fff', border: `2px solid ${C.chocolate}`, borderRadius: 999, padding: '5px 12px', cursor: 'pointer'
  },

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
