import React, { useState, useEffect, useCallback } from 'react';
import PantallaCarga from '../PantallaCarga/PantallaCarga';
import PopupMadera from '../Popup/PopupMadera';
import { useToast } from '../../contexts/ToastContext';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/torneos`;

// Pase 384: rediseño de la sala del torneo y del bracket con el estilo del resto de la app (marcos de madera con
// remaches, cinta de pergamino, fichas ahuecadas, botones planos, PNG en lugar de emojis).
// Pase 395: se quitó el simulador de bracket (torneoId === 'simulador'), ya no hace falta.
const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c', verdeProfundo: '#163f24',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8',
  crema: '#FFF8ED', cremaSutil: '#FFFCF6', chocolate: '#4A2C2A', apagado: '#a89a90',
  maderaClara: '#6b4a34', maderaMedia: '#4a3226', maderaOscura: '#2a1c14', negroPulido: '#1a1410',
  pergamino: '#FFFBEB',
};

const JUGADORES_POR_EQUIPO = { '1v1': 1, '2v2': 2, '3v3': 3 };
// Premio fijo al campeón por jugador (misma constante que PREMIO_CAMPEON_POR_JUGADOR en torneoManager.js y Torneos.js).
const PREMIO_CAMPEON = 35;

// Medidas del bracket (px). Cada partido tiene alto fijo para que las líneas de conexión queden alineadas.
const ALTO_PARTIDO = 108;
const SEPARACION = 16;
const ANCHO_PARTIDO = 210;
const MARGEN_LINEA = 18;

// ---------- Piezas visuales reutilizables ----------

function Remaches({ inset = 9 }) {
  const pos = [{ top: inset, left: inset }, { top: inset, right: inset }, { bottom: inset, left: inset }, { bottom: inset, right: inset }];
  return pos.map((p, i) => <span key={i} style={{ ...estilos.remache, ...p }} />);
}

// Marco de madera con remaches y cinta opcional (cartel de pergamino a caballo sobre el borde superior).
function Marco({ cinta, interior = 'pergamino', children, style, innerStyle }) {
  return (
    <div style={{ ...estilos.marco, ...(cinta ? { marginTop: 22 } : null), ...style }}>
      <Remaches />
      {cinta && (
        <div style={estilos.cinta}>
          <span style={{ ...estilos.cintaRemache, left: 9 }} />
          {cinta}
          <span style={{ ...estilos.cintaRemache, right: 9 }} />
        </div>
      )}
      <div style={{ ...(interior === 'fieltro' ? estilos.interiorFieltro : estilos.interiorPergamino), ...innerStyle }}>
        {children}
      </div>
    </div>
  );
}

function BarraPlana({ porcentaje, claro = false }) {
  return (
    <div style={{ ...estilos.barraFondo, ...(claro ? estilos.barraFondoClaro : null) }}>
      <div style={{ ...estilos.barraRelleno, width: `${Math.max(0, Math.min(100, porcentaje))}%` }} />
    </div>
  );
}

function Ficha({ icono, mascara = false, valor, label, dorado = false }) {
  return (
    <div style={estilos.ficha}>
      {mascara ? (
        <span style={{ ...estilos.fichaMascara, WebkitMask: `url(${icono}) center / contain no-repeat`, mask: `url(${icono}) center / contain no-repeat` }} />
      ) : (
        <img src={icono} alt="" style={estilos.fichaIcono} />
      )}
      <span style={{ ...estilos.fichaValor, ...(dorado ? { color: '#B9770E' } : null) }}>{valor}</span>
      <span style={estilos.fichaLabel}>{label}</span>
    </div>
  );
}

const iniciales = (nombre) => {
  if (!nombre || nombre === 'Por definir') return '?';
  const partes = nombre.trim().split(/[\s_]+/).filter(Boolean);
  return partes.length > 1 ? (partes[0][0] + partes[1][0]).toUpperCase() : nombre.slice(0, 2).toUpperCase();
};

const nombreDeLado = (nombreEquipo, jugadores) => {
  if (!jugadores) return 'Por definir';
  return nombreEquipo || jugadores.join(' / ');
};

function nombreDeRonda(cruces, numRonda) {
  if (cruces === 1) return 'Final';
  if (cruces === 2) return 'Semifinal';
  if (cruces === 4) return 'Cuartos';
  if (cruces === 8) return 'Octavos';
  return `Ronda ${numRonda}`;
}

// ---------- Pantalla ----------

export default function BracketView({ torneoId, usuario, token, onVolver, onEntrarAPartida, onAnotarme }) {
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

  // Pase 387: el torneo se pasa a Torneos con la forma de la tarjeta "Unirme con código" para anotarse.
  const anotarmeEnCupo = () => {
    if (!torneo || !onAnotarme) return;
    onAnotarme({
      ...torneo,
      entradas_actuales: Array.isArray(torneo.entradas) ? torneo.entradas.length : 0,
      creador_nombre: torneo.creador_nombre || (torneo.soy_creador ? 'vos' : ''),
      ya_inscripto: false,
      companero_sugerido: null,
      desde_sala: true,
    });
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

  // Pase 203: BracketView vive DENTRO del AppShell (header con menú e info del usuario, ver App.js).
  if (cargando) return <PantallaCarga />;
  if (error) return <div style={{ ...estilos.errorBox, maxWidth: 700, margin: '60px auto' }}>{error}</div>;
  if (!torneo) return null;

  const rondas = {};
  partidos.forEach((p) => {
    if (!rondas[p.ronda]) rondas[p.ronda] = [];
    rondas[p.ronda].push(p);
  });
  const numerosRonda = Object.keys(rondas).map(Number).sort((a, b) => a - b);
  const ultimaRonda = numerosRonda.length ? Math.max(...numerosRonda) : 0;

  const totalPartidos = partidos.length;
  const partidosFinalizados = partidos.filter((p) => p.estado === 'finalizado').length;
  const progreso = totalPartidos > 0 ? Math.round((partidosFinalizados / totalPartidos) * 100) : 0;

  // Pase 204: nombre del campeón para la copa grande de arriba: se busca en el partido de la ronda final cuál de los
  // dos lados coincide con `ganador_entrada_id`.
  let nombreCampeon = null;
  if (torneo.estado === 'finalizada' && torneo.ganador_entrada_id) {
    const partidoFinal = partidos.find((p) => p.ronda === ultimaRonda);
    if (partidoFinal) {
      if (partidoFinal.entrada_a_id === torneo.ganador_entrada_id) {
        nombreCampeon = nombreDeLado(partidoFinal.nombre_entrada_a, partidoFinal.jugadores_a);
      } else if (partidoFinal.entrada_b_id === torneo.ganador_entrada_id) {
        nombreCampeon = nombreDeLado(partidoFinal.nombre_entrada_b, partidoFinal.jugadores_b);
      }
    }
  }

  // Pase 379: datos de la "sala del torneo" (mientras el torneo está en inscripción).
  const porEquipo = JUGADORES_POR_EQUIPO[torneo.modo] || 1;
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

  const enSala = totalPartidos === 0 && torneo.estado === 'inscripcion';
  const estadoTexto = torneo.estado === 'finalizada' ? 'Finalizado' : torneo.estado === 'inscripcion' ? 'Inscripción abierta' : 'En curso';
  const estadoEstilo = torneo.estado === 'finalizada' ? estilos.pillFinalizado : torneo.estado === 'inscripcion' ? estilos.pillInscripcion : estilos.pillEnCurso;

  // Avatares de un equipo en la sala: jugadores confirmados, invitados que todavía no aceptaron y huecos al azar / vacíos.
  const avataresEquipo = (e) => {
    const confirmados = e.jugadores || [];
    const invitados = e.invitados_pendientes || [];
    const chips = confirmados.map((n) => ({ tipo: 'listo', texto: iniciales(n) }));
    invitados.forEach((n) => chips.push({ tipo: 'invitado', texto: iniciales(n) }));
    while (chips.length < porEquipo) chips.push({ tipo: 'vacio', texto: '?' });
    return chips.slice(0, porEquipo);
  };

  // Disposición del bracket: cada cruce vive en un bloque de alto proporcional a su ronda para quedar centrado entre
  // los dos cruces que lo alimentan. Las líneas solo se dibujan si el cuadro es una llave completa (cada ronda tiene
  // la mitad de cruces que la anterior).
  const cantidadPorRonda = numerosRonda.map((n) => rondas[n].length);
  const llaveCompleta = cantidadPorRonda.every((c, i) => i === 0 || c * 2 === cantidadPorRonda[i - 1]);
  const cantidadRonda1 = cantidadPorRonda[0] || 1;
  const unidad = ALTO_PARTIDO + SEPARACION;

  const colorLinea = (activa) => (activa ? C.doradoClaro : 'rgba(255,248,237,0.45)');

  const renderLado = ({ nombre, jugadores, gana, esCampeon, mio }) => (
    <div style={{ ...estilos.ladoFila, ...(mio ? estilos.ladoFilaMia : null) }} title={nombre}>
      <div style={{ ...estilos.avatarChip, ...(gana ? estilos.avatarChipGanador : null), ...(!jugadores ? estilos.avatarChipVacio : null) }}>
        {iniciales(nombre)}
      </div>
      <div style={{ ...estilos.ladoNombre, ...(!jugadores ? estilos.ladoNombreVacio : null), ...(gana ? estilos.ladoNombreGanador : null) }}>
        {nombre}
      </div>
      {esCampeon ? (
        <img src="/assets/images/historial-trofeo.png" alt="Campeón" style={estilos.ladoTrofeo} />
      ) : gana ? (
        <span style={estilos.ladoCheck}>✓</span>
      ) : null}
    </div>
  );

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
          Tocá a un amigo para mandarle la invitación. Paga su entrada ({Math.round(Number(torneo.apuesta || 0))} mates) recién cuando acepta.
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

      {/* ---- Encabezado ---- */}
      <Marco style={{ marginBottom: 16 }} innerStyle={estilos.headerInterior}>
        <button onClick={onVolver} style={estilos.btnVolver}>← Volver</button>
        <img src="/assets/images/trofeo.png" alt="" style={estilos.headerTrofeo} />
        <div style={estilos.headerCentro}>
          <div style={estilos.pageTitle}>{torneo.titulo}</div>
          <div style={estilos.headerChips}>
            <span style={estilos.chipInfo}>{torneo.modo}</span>
            <span style={estilos.chipInfo}>{cupoTotal} equipos</span>
            {torneo.privado && <span style={estilos.chipInfo}>Privado</span>}
          </div>
        </div>
        <div style={{ ...estilos.pill, ...estadoEstilo }}>{estadoTexto}</div>
      </Marco>

      {/* ---- Copa, campeón y datos del torneo ---- */}
      <Marco cinta="CAMPEÓN" interior="fieltro" innerStyle={{ padding: '26px 14px 16px', textAlign: 'center' }}>
        <img src="/assets/images/trofeo.png" alt="" style={estilos.copaImg} />
        <div style={{ ...estilos.placaCampeon, ...(nombreCampeon ? estilos.placaCampeonListo : null) }}>
          {nombreCampeon || 'Por definir'}
        </div>
        {nombreCampeon && <div style={estilos.felicitaciones}>¡Felicitaciones al campeón!</div>}

        <div style={estilos.fichas}>
          <Ficha icono="/assets/images/icono-personaje.png" mascara valor={`${enSala ? equiposListos : cupoTotal}/${cupoTotal}`} label="Equipos" />
          <Ficha icono="/assets/images/icono-cartas-nueva.png" valor={torneo.modo} label="Modo" />
          {torneo.puntos_para_ganar != null && (
            <Ficha icono="/assets/images/fosforos_5_tantos.png" valor={`A ${torneo.puntos_para_ganar}`} label="Partido" />
          )}
          <Ficha icono="/assets/images/moneda.png" valor={Math.round(Number(torneo.apuesta || 0))} label="Entrada" />
          <Ficha icono="/assets/images/historial-trofeo.png" valor={PREMIO_CAMPEON} label="Premio c/u" dorado />
        </div>

        {totalPartidos > 0 && (
          <div style={estilos.progresoBox}>
            <div style={estilos.progresoTexto}>{partidosFinalizados} de {totalPartidos} partidos jugados</div>
            <BarraPlana porcentaje={progreso} claro />
          </div>
        )}
      </Marco>

      {/* ---- Sala del torneo (inscripción) ---- */}
      {enSala ? (
        <Marco cinta="SALA DEL TORNEO" innerStyle={{ padding: '24px 14px 14px' }}>
          <div style={estilos.salaSub}>
            {equiposListos} de {cupoTotal} equipos listos · el bracket se arma cuando se completa el cupo
          </div>
          <BarraPlana porcentaje={cupoTotal ? Math.round((equiposListos / cupoTotal) * 100) : 0} />
          {/* Pase 386: solo invita quien ya está anotado (aparece en la sala); el creador sin anotarse ve este aviso. */}
          {torneo.soy_creador && !torneo.estoy_anotado && (
            <div style={estilos.notaEspera}>Todavía no te anotaste en tu torneo: tocá "Anotarme" en un cupo libre para entrar y poder invitar amigos.</div>
          )}
          {/* Pase 383: jugadores sin equipo esperando que se les arme uno (completar al azar). */}
          {(torneo.jugadores_en_espera > 0 || torneo.estoy_en_espera) && (
            <div style={estilos.notaEspera}>
              {torneo.estoy_en_espera
                ? 'Estás en la lista de espera: te armamos equipo con otros jugadores.'
                : `${torneo.jugadores_en_espera} jugador${torneo.jugadores_en_espera === 1 ? '' : 'es'} esperando equipo.`}
            </div>
          )}
          <div style={estilos.salaLista}>
            {entradasSala.map((e, idx) => {
              const pendiente = e.estado === 'pendiente';
              const nombre = nombreEntrada(e);
              const mia = esMiEntrada(e);
              return (
                <div key={e.id} style={{ ...estilos.salaFila, ...(mia ? estilos.salaFilaMia : null) }}>
                  <span style={estilos.salaNumero}>{idx + 1}</span>
                  <div style={estilos.avataresEquipo}>
                    {avataresEquipo(e).map((c, i) => (
                      <span key={i} style={{ ...estilos.avatarSala, ...(i > 0 ? { marginLeft: -4 } : null), ...(c.tipo === 'invitado' ? estilos.avatarSalaInvitado : c.tipo === 'vacio' ? estilos.avatarSalaVacio : null) }}>
                        {c.texto}
                      </span>
                    ))}
                  </div>
                  <div style={estilos.salaFilaTexto}>
                    <div style={estilos.salaNombre}>{nombre}{mia ? ' (vos)' : ''}</div>
                    {porEquipo > 1 && e.nombre_equipo && (
                      <div style={estilos.salaDetalle}>{(e.jugadores || []).join(' · ')}</div>
                    )}
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
                    {pendiente ? 'Armando equipo' : '✓ Listo'}
                  </div>
                </div>
              );
            })}
            {invitacionesVisibles.map((inv) => (
              <div key={`inv-${inv.id}`} style={estilos.salaFilaInvitada}>
                <span style={estilos.salaNumeroInvitada}>·</span>
                {/* Pase 386: se aclara quién invitó a quién (antes solo decía "Invitación enviada a X"). */}
                <span style={estilos.salaInvitadaTexto}>
                  {inv.invitador === usuario.username
                    ? <>Vos invitaste a <strong>{inv.invitado}</strong></>
                    : <><strong>{inv.invitador}</strong> invitó a <strong>{inv.invitado}</strong></>}
                </span>
                <div style={{ ...estilos.salaBadge, ...estilos.salaBadgePendiente }}>Esperando</div>
              </div>
            ))}
            {Array.from({ length: huecosSinInvitar }).map((_, i) => (
              <div key={`libre-${i}`} style={estilos.salaFilaLibre}>
                <span style={estilos.salaLibreTexto}>Cupo libre</span>
                {torneo.puedo_invitar && (
                  <button type="button" onClick={abrirSelectorAmigos} style={estilos.btnInvitarAmigo}>
                    + Invitar amigo
                  </button>
                )}
                {/* Pase 387: ocupar el cupo libre uno mismo (lleva a la tarjeta de anotarse de Torneos). */}
                {torneo.puedo_anotarme && onAnotarme && (
                  <button type="button" onClick={anotarmeEnCupo} style={estilos.btnAnotarmeCupo}>
                    Anotarme
                  </button>
                )}
              </div>
            ))}
          </div>
        </Marco>
      ) : totalPartidos === 0 ? (
        <Marco cinta="BRACKET" innerStyle={{ padding: '30px 18px 22px', textAlign: 'center' }}>
          <img src="/assets/images/trofeo.png" alt="" style={{ height: 52, width: 'auto', objectFit: 'contain', marginBottom: 6 }} />
          <div style={estilos.vacioTitulo}>El bracket todavía se está armando</div>
          <div style={estilos.vacioTexto}>En cuanto se completen los cupos vas a ver acá los cruces de cada ronda.</div>
        </Marco>
      ) : (
        <Marco cinta="LLAVES DEL TORNEO" interior="fieltro" innerStyle={{ padding: '24px 8px 12px' }}>
          <div style={estilos.bracketScroll}>
            <div style={estilos.bracket}>
              {numerosRonda.map((numRonda, idxRonda) => {
                const esRondaFinal = numRonda === ultimaRonda;
                const cruces = rondas[numRonda].slice().sort((a, b) => a.posicion - b.posicion);
                const altoBloque = llaveCompleta ? unidad * (cantidadRonda1 / cruces.length) : unidad;
                const dibujarSalida = llaveCompleta && !esRondaFinal;
                const dibujarEntrada = llaveCompleta && idxRonda > 0;
                return (
                  <div key={numRonda} style={{ ...estilos.ronda, width: ANCHO_PARTIDO + MARGEN_LINEA * 2 }}>
                    <div style={{ ...estilos.rondaTitulo, ...(esRondaFinal ? estilos.rondaTituloFinal : null) }}>
                      {nombreDeRonda(cruces.length, numRonda)}
                    </div>
                    {cruces.map((p, idx) => {
                      const gananA = p.ganador_entrada_id && p.ganador_entrada_id === p.entrada_a_id;
                      const gananB = p.ganador_entrada_id && p.ganador_entrada_id === p.entrada_b_id;
                      const mio = yoJuegoEste(p);
                      // Campeón real = ganador de la final Y ganador oficial del torneo entero.
                      const esElCampeonA = esRondaFinal && gananA && p.entrada_a_id === torneo.ganador_entrada_id;
                      const esElCampeonB = esRondaFinal && gananB && p.entrada_b_id === torneo.ganador_entrada_id;
                      const nombreA = nombreDeLado(p.nombre_entrada_a, p.jugadores_a);
                      const nombreB = nombreDeLado(p.nombre_entrada_b, p.jugadores_b);
                      const terminado = p.estado === 'finalizado';
                      const ambosListos = !!(p.jugadores_a && p.jugadores_b);
                      return (
                        <div key={p.id} style={{ ...estilos.bloque, height: altoBloque }}>
                          {dibujarEntrada && <span style={{ ...estilos.lineaEntrada, background: colorLinea(ambosListos) }} />}
                          {dibujarSalida && (
                            <>
                              <span style={{ ...estilos.lineaSalida, background: colorLinea(terminado) }} />
                              <span style={{ ...estilos.lineaVertical, background: colorLinea(terminado), ...(idx % 2 === 0 ? { top: '50%', bottom: 0 } : { top: 0, bottom: '50%' }) }} />
                            </>
                          )}
                          <div style={{ ...estilos.match, ...(esRondaFinal ? estilos.matchFinal : null), ...(mio && p.estado === 'jugando' ? estilos.matchMio : null) }}>
                            {renderLado({ nombre: nombreA, jugadores: p.jugadores_a, gana: gananA, esCampeon: esElCampeonA, mio: p.jugadores_a && p.jugadores_a.includes(usuario.username) })}
                            <div style={estilos.matchSeparador} />
                            {renderLado({ nombre: nombreB, jugadores: p.jugadores_b, gana: gananB, esCampeon: esElCampeonB, mio: p.jugadores_b && p.jugadores_b.includes(usuario.username) })}
                            <div style={estilos.matchPie}>
                              {p.estado === 'jugando' && mio ? (
                                <button onClick={() => onEntrarAPartida(p.codigo_sala)} style={estilos.btnEntrar}>
                                  Entrar a mi partida
                                </button>
                              ) : p.estado === 'jugando' ? (
                                <span style={{ ...estilos.estadoTexto, color: '#1B6E9C' }}>Jugando ahora</span>
                              ) : p.estado === 'finalizado' ? (
                                <span style={{ ...estilos.estadoTexto, color: C.verdeOscuro }}>Finalizado</span>
                              ) : (
                                <span style={estilos.estadoTexto}>Esperando rivales…</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </Marco>
      )}

    </div>
  );
}

const SOMBRA_MARCO = [
  'inset 0 2px 0 rgba(255,255,255,0.10)',
  'inset 0 -4px 10px rgba(0,0,0,0.5)',
  `0 8px 0 ${C.negroPulido}`,
  '0 16px 26px rgba(0,0,0,0.4)',
].join(', ');

const BTN_PLANO = { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, border: '2px solid #000', cursor: 'pointer' };

const estilos = {
  contenedor: { maxWidth: 900, margin: '0 auto', fontFamily: "'Nunito', sans-serif", paddingBottom: 24 },

  // Marco de madera (mismo degradé + bisel + remaches de bronce que el resto de la app).
  marco: {
    position: 'relative', marginBottom: 20,
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.negroPulido}`, borderRadius: 20, padding: 10, boxSizing: 'border-box',
    boxShadow: SOMBRA_MARCO,
  },
  remache: {
    position: 'absolute', width: 13, height: 13, borderRadius: '50%', zIndex: 2,
    background: 'radial-gradient(circle at 32% 28%, rgba(255,243,210,0.92) 0, rgba(255,243,210,0.92) 1.5px, transparent 2.1px), #C9973E',
    border: '1.5px solid #5A3A14', boxSizing: 'border-box',
  },
  interiorPergamino: {
    position: 'relative', overflow: 'hidden', borderRadius: 14, padding: '14px 14px 12px',
    background: [
      'radial-gradient(ellipse at 20% 25%, rgba(210,182,130,0.4) 0%, transparent 50%)',
      'radial-gradient(ellipse at 82% 75%, rgba(190,160,115,0.35) 0%, transparent 55%)',
      `linear-gradient(180deg, ${C.cremaSutil}, ${C.crema})`,
    ].join(', '),
    boxShadow: 'inset 0 4px 14px rgba(74,44,42,0.28), inset 0 -3px 10px rgba(74,44,42,0.22), inset 0 0 0 2px rgba(0,0,0,0.08)',
  },
  interiorFieltro: {
    position: 'relative', overflow: 'hidden', borderRadius: 14, padding: '16px 14px',
    background: `linear-gradient(180deg, ${C.verdeProfundo}, ${C.verdeOscuro})`,
    boxShadow: 'inset 0 4px 14px rgba(0,0,0,0.55), inset 0 -3px 10px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(0,0,0,0.25)',
  },
  cinta: {
    position: 'absolute', top: -17, left: '50%', transform: 'translateX(-50%)', zIndex: 4,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap',
    background: 'linear-gradient(180deg, #F3E6C2, #E4D1A0)',
    color: '#3A1E0A', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 13,
    height: 32, padding: '0 34px', letterSpacing: 0.7, boxSizing: 'border-box',
    border: `2px solid ${C.negroPulido}`, borderRadius: 9,
    boxShadow: `0 3px 0 ${C.negroPulido}, inset 0 1px 0 rgba(255,255,255,0.6)`,
  },
  cintaRemache: {
    position: 'absolute', top: '50%', marginTop: -4, width: 8, height: 8, borderRadius: '50%',
    background: 'radial-gradient(circle at 32% 28%, rgba(255,243,210,0.92) 0, rgba(255,243,210,0.92) 1.1px, transparent 1.7px), #C9973E',
    border: '1.5px solid #5A3A14', boxSizing: 'border-box',
  },

  errorBox: {
    background: '#ffe0dd', border: '2px solid #E8483A', color: '#c2352a',
    borderRadius: 10, padding: '10px 14px', fontWeight: 700, fontSize: 14
  },

  // Encabezado
  headerInterior: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' },
  btnVolver: {
    ...BTN_PLANO, fontSize: 13, background: C.crema, color: C.chocolate, borderRadius: 999,
    padding: '7px 14px', boxShadow: '0 3px 0 #D9C9A5, 0 5px 0 #000', flexShrink: 0, marginBottom: 4,
  },
  headerTrofeo: { height: 38, width: 'auto', objectFit: 'contain', flexShrink: 0 },
  headerCentro: { flex: 1, minWidth: 0 },
  pageTitle: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 19, color: C.chocolate,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  headerChips: { display: 'flex', gap: 6, marginTop: 3, flexWrap: 'wrap' },
  chipInfo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 11, color: '#5A3A14',
    background: '#EBDDB8', border: '1.5px solid #8B5A2B', borderRadius: 999, padding: '1px 8px',
  },
  pill: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 12, color: C.chocolate,
    borderRadius: 999, padding: '5px 12px', flexShrink: 0, border: '2px solid #000', boxShadow: '0 2px 0 rgba(0,0,0,0.35)',
  },
  pillInscripcion: { background: C.celeste },
  pillEnCurso: { background: '#8FD99E' },
  pillFinalizado: { background: '#F5B041' },

  // Copa + campeón
  copaImg: { height: 92, width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto 8px' },
  placaCampeon: {
    display: 'inline-block', maxWidth: '100%', boxSizing: 'border-box',
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 19, color: '#9b8a7d',
    background: C.pergamino, border: '2.5px solid #8B5A2B', borderRadius: 12, padding: '7px 26px',
    boxShadow: 'inset 0 4px 7px rgba(74,44,17,0.3), inset 0 -2px 0 rgba(255,255,255,0.7), 0 3px 0 rgba(0,0,0,0.55)',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  placaCampeonListo: { color: '#B9770E', background: '#FFF1C9', borderColor: C.doradoOscuro },
  felicitaciones: { color: C.doradoClaro, fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 13, marginTop: 8 },

  // Fichas de datos (pergamino ahuecado, como en Torneos)
  fichas: { display: 'flex', gap: 8, justifyContent: 'center', marginTop: 16 },
  ficha: {
    flex: '1 1 0', minWidth: 0, maxWidth: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    background: C.pergamino, border: '2.5px solid #8B5A2B', borderRadius: 12, padding: '9px 4px 8px', boxSizing: 'border-box',
    boxShadow: 'inset 0 4px 7px rgba(74,44,17,0.38), inset 0 -2px 0 rgba(255,255,255,0.7), 0 3px 0 rgba(0,0,0,0.55)',
  },
  fichaIcono: { width: 32, height: 32, objectFit: 'contain' },
  fichaMascara: { display: 'inline-block', width: 32, height: 32, flexShrink: 0, backgroundColor: C.chocolate },
  fichaValor: { fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 15, color: C.chocolate, whiteSpace: 'nowrap' },
  fichaLabel: { fontSize: 9.5, color: '#7A5A3A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 },

  // Barra de progreso plana (estándar Pase 381)
  progresoBox: { marginTop: 16, textAlign: 'left' },
  progresoTexto: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 12.5, color: C.crema, marginBottom: 6 },
  barraFondo: { height: 12, boxSizing: 'border-box', borderRadius: 8, background: '#E9D9BB', border: `2px solid ${C.chocolate}`, overflow: 'hidden' },
  barraFondoClaro: { borderColor: C.negroPulido },
  barraRelleno: { height: '100%', boxSizing: 'border-box', background: '#F5B041', borderRight: '2px solid #B9770E', transition: 'width 0.4s ease' },

  // Sala
  salaSub: { fontWeight: 700, fontSize: 12.5, color: '#7a6660', marginBottom: 8, textAlign: 'center' },
  notaEspera: {
    marginTop: 10, background: '#FFF3D1', border: `2px dashed ${C.doradoOscuro}`, borderRadius: 10,
    padding: '7px 10px', fontWeight: 700, fontSize: 12, color: '#7A4B00', textAlign: 'center',
  },
  salaLista: { display: 'flex', flexDirection: 'column', gap: 9, marginTop: 14 },
  salaFila: {
    display: 'flex', alignItems: 'center', gap: 10, background: C.pergamino,
    border: '2.5px solid #8B5A2B', borderRadius: 12, padding: '8px 10px',
    boxShadow: 'inset 0 4px 7px rgba(74,44,17,0.22), inset 0 -2px 0 rgba(255,255,255,0.7), 0 3px 0 rgba(0,0,0,0.35)',
  },
  salaFilaMia: { background: '#FFF1C9', borderColor: C.doradoOscuro },
  salaNumero: {
    width: 20, flexShrink: 0, textAlign: 'center', fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 13, color: '#9b8a7d',
  },
  avataresEquipo: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  avatarSala: {
    width: 28, height: 28, borderRadius: '50%', background: C.verdeOscuro, color: C.crema, boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 800,
    border: `2px solid ${C.chocolate}`, fontFamily: "'Nunito', sans-serif",
  },
  avatarSalaInvitado: { background: '#FFE9B0', color: '#7A4B00', border: `2px dashed ${C.doradoOscuro}` },
  avatarSalaVacio: { background: '#EFE6D2', color: '#a89a90', border: `2px dashed ${C.apagado}` },
  salaFilaTexto: { flex: 1, minWidth: 0 },
  salaNombre: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 14, color: C.chocolate, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  salaDetalle: { fontWeight: 700, fontSize: 11.5, color: '#7a6660', marginTop: 1 },
  salaBadge: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 11.5, borderRadius: 999, padding: '3px 10px', flexShrink: 0, border: `2px solid ${C.chocolate}`, whiteSpace: 'nowrap' },
  salaBadgeListo: { background: '#CFF1DA', color: '#14532D' },
  salaBadgePendiente: { background: '#FFE9B0', color: '#7A4B00' },
  salaFilaLibre: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
    border: `2px dashed ${C.apagado}`, borderRadius: 12, padding: '9px 12px 9px 40px', minHeight: 48, boxSizing: 'border-box',
  },
  salaLibreTexto: { fontWeight: 700, fontSize: 12.5, color: C.apagado },
  btnAnotarmeCupo: {
    ...BTN_PLANO, fontSize: 12.5, color: '#fff', background: '#10B981', borderRadius: 999,
    boxShadow: '0 2px 0 #065F46, 0 3px 0 #000', padding: '4px 15px', flexShrink: 0, marginBottom: 3,
  },
  btnInvitarAmigo: {
    ...BTN_PLANO, fontSize: 12.5, color: '#2C160E', background: '#F5B041', borderRadius: 999,
    boxShadow: '0 2px 0 #B9770E, 0 3px 0 #000', padding: '4px 13px', flexShrink: 0, marginBottom: 3,
  },
  salaFilaInvitada: {
    display: 'flex', alignItems: 'center', gap: 10, border: `2px dashed ${C.doradoOscuro}`, borderRadius: 12,
    padding: '8px 10px', background: '#FFF3D1', minHeight: 48, boxSizing: 'border-box',
  },
  salaNumeroInvitada: { width: 20, textAlign: 'center', color: C.doradoOscuro, fontWeight: 800 },
  salaInvitadaTexto: { flex: 1, minWidth: 0, fontWeight: 700, fontSize: 12.5, color: '#7A4B00' },
  selectorAmigosLista: { display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', margin: '4px 0 12px' },
  amigoChip: {
    fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 13, color: C.chocolate,
    background: '#fff', border: `2px solid ${C.chocolate}`, borderRadius: 999, padding: '5px 12px', cursor: 'pointer'
  },

  vacioTitulo: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: C.chocolate, marginBottom: 6 },
  vacioTexto: { fontSize: 13, color: '#7a6660', fontWeight: 700, lineHeight: 1.4 },

  // Bracket
  bracketScroll: { overflowX: 'auto', paddingBottom: 6 },
  bracket: { display: 'flex', alignItems: 'flex-start', width: 'max-content', margin: '0 auto' },
  ronda: { display: 'flex', flexDirection: 'column', flexShrink: 0 },
  rondaTitulo: {
    alignSelf: 'center', height: 26, boxSizing: 'border-box', marginBottom: 6,
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 12, color: '#3A1E0A',
    textTransform: 'uppercase', letterSpacing: 0.6, padding: '0 16px', display: 'flex', alignItems: 'center',
    background: 'linear-gradient(180deg, #F3E6C2, #E4D1A0)', border: `2px solid ${C.negroPulido}`, borderRadius: 9,
    boxShadow: `0 2px 0 ${C.negroPulido}`,
  },
  rondaTituloFinal: { background: '#F5B041' },
  bloque: { position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `0 ${MARGEN_LINEA}px`, boxSizing: 'border-box' },
  lineaEntrada: { position: 'absolute', left: 0, top: '50%', marginTop: -1, width: MARGEN_LINEA, height: 2 },
  lineaSalida: { position: 'absolute', right: 0, top: '50%', marginTop: -1, width: MARGEN_LINEA, height: 2 },
  lineaVertical: { position: 'absolute', right: 0, width: 2 },

  match: {
    width: ANCHO_PARTIDO, height: ALTO_PARTIDO, boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
    background: C.pergamino, border: `2.5px solid ${C.chocolate}`, borderRadius: 12, overflow: 'hidden',
    boxShadow: '0 3px 0 rgba(0,0,0,0.55)',
  },
  matchFinal: { borderColor: C.doradoOscuro, borderWidth: 3 },
  matchMio: { borderColor: '#2E86C1' },
  matchSeparador: { height: 2, background: 'rgba(74,44,42,0.18)', flexShrink: 0 },
  ladoFila: { flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', gap: 7, padding: '0 8px' },
  ladoFilaMia: { background: '#FFF1C9' },
  ladoNombre: { flex: 1, minWidth: 0, fontWeight: 700, fontSize: 12.5, color: C.chocolate, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  ladoNombreGanador: { color: C.verdeOscuro, fontWeight: 800 },
  ladoNombreVacio: { color: C.apagado, fontStyle: 'italic' },
  avatarChip: {
    width: 22, height: 22, borderRadius: '50%', background: C.verdeOscuro, color: C.crema, boxSizing: 'border-box',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, flexShrink: 0, border: `1.5px solid ${C.chocolate}`,
  },
  avatarChipGanador: { background: '#F5B041', color: C.chocolate },
  avatarChipVacio: { background: '#EFE6D2', color: C.apagado, borderStyle: 'dashed' },
  ladoTrofeo: { width: 20, height: 20, objectFit: 'contain', flexShrink: 0 },
  ladoCheck: { color: C.verdeOscuro, fontWeight: 900, fontSize: 13, flexShrink: 0 },
  matchPie: {
    height: 28, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '2px solid rgba(74,44,42,0.18)',
    background: 'rgba(233,217,187,0.55)',
  },
  estadoTexto: { fontSize: 11, color: '#7a6660', fontWeight: 800 },
  btnEntrar: {
    ...BTN_PLANO, fontSize: 11.5, color: '#2C160E', background: C.celeste, borderRadius: 999, height: 20, padding: '0 12px',
    boxShadow: '0 2px 0 #2E86C1, 0 3px 0 #000', lineHeight: '16px', marginBottom: 2,
  },

};
