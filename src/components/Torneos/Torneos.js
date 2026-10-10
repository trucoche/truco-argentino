import React, { useState, useEffect, useLayoutEffect, useCallback, useRef } from 'react';
import PantallaCarga from '../PantallaCarga/PantallaCarga';
import PopupMadera from '../Popup/PopupMadera';
import { useToast } from '../../contexts/ToastContext';
import { API_URL as BASE_URL } from '../../config';

const API_URL = `${BASE_URL}/api/torneos`;
const JUGADORES_POR_EQUIPO = { '1v1': 1, '2v2': 2, '3v3': 3 };

// Pase siguiente: opciones de la tarjeta "Crear torneo", ahora como chips
// tocables en vez de <select> — mismo criterio que ya usa la tarjeta
// "Crear sala" del Lobby (ver MODOS/CUPO_OPCIONES/PUNTOS_OPCIONES/
// TIEMPO_OPCIONES ahí). Se mantienen exactamente los mismos valores que
// ya tenía el <select> de acá (no se sacó "Sin límite" ni el 60s, a
// diferencia de Lobby, que sí los sacó en su propio pase).
const MODOS = ['1v1', '2v2', '3v3'];
const CUPO_OPCIONES = [4, 8, 16];
// Pase 375: costo de CREAR un torneo según el cupo (el mismo que cobra el
// backend, ver COSTO_CREAR_TORNEO en routes/torneos.js — si se cambia allá,
// cambiarlo acá). Se reembolsa si el torneo vence sin llenarse.
const COSTO_CREAR_TORNEO = { 4: 5, 8: 10, 16: 20 };
const PUNTOS_OPCIONES = [15, 30];
const TIEMPO_OPCIONES = [
  { valor: '', label: 'Sin límite' },
  { valor: '15', label: '15s' },
  { valor: '30', label: '30s' },
  { valor: '45', label: '45s' },
  { valor: '60', label: '60s' },
];

// Pase de rediseño estructural: se suman los tonos de madera+bronce que ya
// usan Ranking/Historial/Chat Global (mismo "lenguaje visual" de placa de
// taberna en toda la app) para reemplazar los contenedores blancos planos
// de esta pantalla. Los botones ilustrados (`boton-amarillo/verde/rojo.png`)
// también son los mismos que ya usa Tienda.js — se reutilizan en vez de
// generar assets nuevos.
const C = {
  verde: '#2D9B4F', verdeOscuro: '#1f7a3c', verdeEsmeralda: '#1e8f4e', verdeProfundo: '#163f24',
  crimson: '#E8483A', crimsonOscuro: '#c2352a',
  dorado: '#FFB627', doradoClaro: '#FFD668', doradoOscuro: '#C9860E',
  celeste: '#4FB3E8',
  crema: '#FFF8ED', cremaSutil: '#FFFCF6', chocolate: '#4A2C2A',
  maderaClara: '#6b4a34', maderaMedia: '#4a3226', maderaOscura: '#2a1c14',
  remacheClaro: '#f0d9a0', remache: '#c9973e', remacheOscuro: '#7a5322',
  negroPulido: '#1a1410',
};

function Filigrana() {
  const path = (
    <>
      <path d="M2 44 C2 20 20 2 44 2" stroke={C.doradoOscuro} strokeWidth="1.5" />
      <path d="M2 34 C2 16 16 2 34 2" stroke={C.dorado} strokeWidth="1.2" />
      <circle cx="2" cy="44" r="3" fill={C.dorado} />
      <path d="M8 44 C8 24 24 8 44 8" stroke={C.dorado} strokeWidth="0.8" opacity="0.7" />
    </>
  );
  const base = { position: 'absolute', width: 44, height: 44, opacity: 0.55, pointerEvents: 'none' };
  return (
    <>
      <svg style={{ ...base, top: 6, left: 6 }} viewBox="0 0 46 46" fill="none">{path}</svg>
      <svg style={{ ...base, top: 6, right: 6, transform: 'scaleX(-1)' }} viewBox="0 0 46 46" fill="none">{path}</svg>
      <svg style={{ ...base, bottom: 6, left: 6, transform: 'scaleY(-1)' }} viewBox="0 0 46 46" fill="none">{path}</svg>
      <svg style={{ ...base, bottom: 6, right: 6, transform: 'scale(-1,-1)' }} viewBox="0 0 46 46" fill="none">{path}</svg>
    </>
  );
}

// Pase siguiente: separa la hora (si el título la trae pegada al final,
// ej. "Campeonato Rápido - 15:22") en un badge dorado aparte, para que
// resalte más que el resto del título — es un parseo del string nomás
// (no hay un campo de hora separado en la base), así que si el título no
// termina en ese patrón exacto se muestra entero, sin romper nada.
function renderTituloTorneo(titulo) {
  const match = /^(.+?)\s-\s(\d{1,2}:\d{2})$/.exec(titulo || '');
  if (!match) return titulo;
  return (
    <>
      {match[1]}
      <span style={{ color: C.doradoOscuro, fontWeight: 800 }}> · {match[2]}</span>
    </>
  );
}

// Controles "‹ Anterior / Siguiente ›" para las listas paginadas de abajo
// — se oculta solo si hay una sola página, no hace falta que cada
// llamador se acuerde de chequearlo.
function Paginador({ pagina, totalPaginas, onCambiar }) {
  if (totalPaginas <= 1) return null;
  return (
    <div style={estilos.paginador}>
      <button
        onClick={() => onCambiar(pagina - 1)}
        disabled={pagina === 0}
        style={{ ...estilos.paginadorBtn, ...(pagina === 0 ? estilos.paginadorBtnDisabled : {}) }}
      >
        ‹ Anterior
      </button>
      <span style={estilos.paginadorTexto}>Página {pagina + 1} de {totalPaginas}</span>
      <button
        onClick={() => onCambiar(pagina + 1)}
        disabled={pagina >= totalPaginas - 1}
        style={{ ...estilos.paginadorBtn, ...(pagina >= totalPaginas - 1 ? estilos.paginadorBtnDisabled : {}) }}
      >
        Siguiente ›
      </button>
    </div>
  );
}

// Pase 367: la lista de torneos (Disponibles / Finalizados) muestra solo 3 tarjetas completas y el resto
// queda en el scroll interno, así los botones de abajo (paginador) se ven sin bajar la página. Se mide la
// posición real de las tarjetas (en una grilla de varias columnas cuenta 3 filas) para que el alto
// no dependa de cuántas líneas tenga cada título.
const TARJETAS_VISIBLES = 3;
function useAltoTresTarjetas(ref, dependencia) {
  const [alto, setAlto] = useState(null);
  useLayoutEffect(() => {
    const calcular = () => {
      const el = ref.current;
      if (!el) return;
      const tops = [];
      Array.from(el.children).forEach((h) => {
        const t = Math.round(h.getBoundingClientRect().top);
        if (!tops.includes(t)) tops.push(t);
      });
      if (tops.length <= TARJETAS_VISIBLES) { setAlto(null); return; }
      const gap = parseFloat(getComputedStyle(el).rowGap) || 12;
      // Hasta el borde inferior de la 3.ª fila (+8 de sombra) menos el padding de abajo del scroll (6).
      setAlto(Math.max(120, tops[TARJETAS_VISIBLES] - tops[0] - gap + 8 - 6));
    };
    calcular();
    const t = setTimeout(calcular, 250);
    window.addEventListener('resize', calcular);
    return () => { clearTimeout(t); window.removeEventListener('resize', calcular); };
  }, [ref, dependencia]);
  return alto;
}

// Ya NO recibe onVolver — la navegación de vuelta al Lobby ahora vive en
// la barra del AppShell, no como botón propio de esta pantalla.
export default function Torneos({ token, onVerBracket }) {
  const [torneos, setTorneos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [creando, setCreando] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [modo, setModo] = useState('1v1');
  const [cupoEntradas, setCupoEntradas] = useState(4);
  const [puntosParaGanar, setPuntosParaGanar] = useState(15);
  const [tiempoPorTurno, setTiempoPorTurno] = useState('');
  // Pase 375: torneo privado (se entra con código) y unirse por código.
  const { mostrarToast } = useToast();
  const [privado, setPrivado] = useState(false);
  const [codigoCreado, setCodigoCreado] = useState(null);
  const [codigoBuscar, setCodigoBuscar] = useState('');
  const [torneoPorCodigo, setTorneoPorCodigo] = useState(null);

  const [inscribiendoId, setInscribiendoId] = useState(null);
  const [companerosTexto, setCompanerosTexto] = useState('');

  // Pestañas Activos / Finalizados (historial de torneos jugados).
  const [vista, setVista] = useState('activos'); // 'activos' | 'finalizados'
  const [torneosFinalizados, setTorneosFinalizados] = useState([]);
  const [cargandoFinalizados, setCargandoFinalizados] = useState(false);

  // Pase siguiente: paginación para "Torneos disponibles"/"Finalizados" —
  // la cantidad de torneos crece sin tope (cada reinicio del backend en
  // desarrollo genera más) y la grilla entera hacía la página cada vez
  // más larga. Cada pestaña tiene su propia página para que cambiar de
  // Activos a Finalizados no arrastre la posición de la otra lista.
  const [paginaActivos, setPaginaActivos] = useState(0);
  const [paginaFinalizados, setPaginaFinalizados] = useState(0);
  const TORNEOS_POR_PAGINA = 8;
  const scrollActivosRef = useRef(null);
  const scrollFinalizadosRef = useRef(null);

  const torneoDestacado = torneos.find(
    t => t.estado === 'inscripcion' && !t.privado && Number(t.entradas_actuales) < t.cupo_entradas
  );
  // Pase siguiente: renombrado de "campeonato" a "torneo" en los textos de
  // esta pantalla, a pedido del usuario (mismo concepto, terminología más
  // consistente con el resto de la app).
  const torneosEnJuego = torneos.filter(t => t.estado === 'en-curso').length;
  const jugadoresParticipando = torneos.reduce(
    (acc, t) => acc + Number(t.entradas_actuales) * (JUGADORES_POR_EQUIPO[t.modo] || 1),
    0
  );

  // `Math.min` contra el total real de páginas — si la lista se achica
  // (ej. se cierran/filtran torneos) y la página guardada quedó fuera de
  // rango, se acomoda sola a la última página válida sin necesitar un
  // efecto aparte.
  const totalPaginasActivos = Math.max(1, Math.ceil(torneos.length / TORNEOS_POR_PAGINA));
  const paginaActivosActual = Math.min(paginaActivos, totalPaginasActivos - 1);
  const torneosPaginados = torneos.slice(
    paginaActivosActual * TORNEOS_POR_PAGINA,
    paginaActivosActual * TORNEOS_POR_PAGINA + TORNEOS_POR_PAGINA
  );

  const totalPaginasFinalizados = Math.max(1, Math.ceil(torneosFinalizados.length / TORNEOS_POR_PAGINA));
  const paginaFinalizadosActual = Math.min(paginaFinalizados, totalPaginasFinalizados - 1);
  const torneosFinalizadosPaginados = torneosFinalizados.slice(
    paginaFinalizadosActual * TORNEOS_POR_PAGINA,
    paginaFinalizadosActual * TORNEOS_POR_PAGINA + TORNEOS_POR_PAGINA
  );
  const altoActivos = useAltoTresTarjetas(scrollActivosRef, `${vista}-${cargando}-${torneosPaginados.map((t) => t.id).join(',')}`);
  const altoFinalizados = useAltoTresTarjetas(scrollFinalizadosRef, `${vista}-${cargandoFinalizados}-${torneosFinalizadosPaginados.map((t) => t.id).join(',')}`);

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  const cargarTorneos = useCallback(async () => {
    try {
      const res = await fetch(API_URL, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al cargar torneos');
        return;
      }
      setTorneos(data);
      setError('');
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    cargarTorneos();
    const intervalo = setInterval(cargarTorneos, 5000);
    return () => clearInterval(intervalo);
  }, [cargarTorneos]);

  // Carga el historial de torneos finalizados solo cuando el usuario
  // entra a esa pestaña por primera vez (no hace falta traerlo de
  // arranque junto con los activos).
  const cargarFinalizados = useCallback(async () => {
    setCargandoFinalizados(true);
    try {
      const res = await fetch(`${API_URL}/historial/mios`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error al cargar el historial de torneos');
        return;
      }
      setTorneosFinalizados(data);
      setError('');
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    } finally {
      setCargandoFinalizados(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (vista === 'finalizados') cargarFinalizados();
  }, [vista, cargarFinalizados]);

  const handleCrearTorneo = async (e) => {
    e.preventDefault();
    setError('');

    if (!titulo.trim()) {
      setError('Ingresá un título para el torneo');
      return;
    }

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          titulo,
          modo,
          cupoEntradas: Number(cupoEntradas),
          puntosParaGanar,
          tiempoPorTurno: tiempoPorTurno || null,
          privado
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al crear torneo');
        return;
      }

      setTitulo('');
      setCreando(false);
      // Torneo privado: mostrar el código para compartirlo.
      if (data.privado && data.codigo) setCodigoCreado(data.codigo);
      setPrivado(false);
      cargarTorneos();

    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    }
  };

  const handleBuscarCodigo = async (e) => {
    e.preventDefault();
    setError('');
    const codigo = codigoBuscar.trim().toUpperCase();
    if (!codigo) return;
    try {
      const res = await fetch(`${API_URL}/codigo/${encodeURIComponent(codigo)}`, { headers });
      const data = await res.json();
      if (!res.ok) {
        setTorneoPorCodigo(null);
        setError(data.error || 'No se encontró el torneo');
        return;
      }
      setTorneoPorCodigo(data);
      setCodigoBuscar('');
      setInscribiendoId(null);
      setCompanerosTexto('');
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    }
  };

  const copiarCodigo = (codigo) => {
    try {
      navigator.clipboard.writeText(codigo);
      mostrarToast('Código copiado', 'exito');
    } catch (err) {
      mostrarToast('No se pudo copiar el código', 'error');
    }
  };

  const handleInscribirse = async (torneo) => {
    setError('');

    const jugadoresNecesarios = JUGADORES_POR_EQUIPO[torneo.modo];
    let companerosUsernames = [];

    if (jugadoresNecesarios > 1) {
      companerosUsernames = companerosTexto
        .split(',')
        .map(u => u.trim())
        .filter(u => u.length > 0);

      if (companerosUsernames.length !== jugadoresNecesarios - 1) {
        setError(`Este torneo es ${torneo.modo}, necesitás ${jugadoresNecesarios - 1} compañero(s), separados por coma`);
        return;
      }
    }

    try {
      const res = await fetch(`${API_URL}/${torneo.id}/inscribirse`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          companerosUsernames,
          // Torneo privado encontrado por código: el backend lo exige para anotarse.
          codigo: torneoPorCodigo && torneoPorCodigo.id === torneo.id ? torneoPorCodigo.codigo : undefined
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al inscribirse');
        return;
      }

      if (torneoPorCodigo && torneoPorCodigo.id === torneo.id) setTorneoPorCodigo(null);
      setInscribiendoId(null);
      setCompanerosTexto('');
      cargarTorneos();

    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    }
  };

  const handleDesinscribirse = async (torneo) => {
    setError('');
    try {
      const res = await fetch(`${API_URL}/${torneo.id}/desinscribirse`, {
        method: 'DELETE',
        headers
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Error al desinscribirse');
        return;
      }

      cargarTorneos();
    } catch (err) {
      console.error('Error de conexión:', err);
      setError('No se pudo conectar con el servidor');
    }
  };

return (
    <>
      {error && <div style={estilos.errorBox}>{error}</div>}

      {/* Pase siguiente: se probó `torneo-marco-destacado.png` como
          `border-image` para este panel, pero el usuario pidió volver
          atrás — mismo problema de fondo que ya se vivió en ChatGlobal.js
          (pases 246-254): un marco ilustrado como `border-image` termina
          con una costura de subpíxel entre la madera del PNG y el fondo
          propio de la pantalla. Se vuelve a la misma técnica 100% CSS que
          ya usan Ranking/Historial/Chat Global — degradé de madera + bisel
          simulado con `boxShadow` en capas + remaches de bronce como
          `<span>`s — sin ningún PNG de marco de por medio, con un borde
          dorado para que este panel en particular (el que más invita a la
          acción) se distinga del resto. */}
      {torneoDestacado && (
        <div style={estilos.destacadoPanelExterior}>
          <span style={{ ...estilos.remache, top: 10, left: 10 }} />
          <span style={{ ...estilos.remache, top: 10, right: 10 }} />
          <span style={{ ...estilos.remache, bottom: 10, left: 10 }} />
          <span style={{ ...estilos.remache, bottom: 10, right: 10 }} />
          {/* Pase 351: cinta de pergamino con remaches, a caballo sobre el borde
              superior del marco (fuera del card, que recorta con overflow). */}
          <div style={estilos.destacadoCinta}>
            <span style={{ ...estilos.cintaRemache, left: 9 }} />
            PRÓXIMO TORNEO
            <span style={{ ...estilos.cintaRemache, right: 9 }} />
          </div>
          <div style={estilos.destacadoCard}>
            <Filigrana />

            <div style={estilos.destacadoHeader}>
              <img src="/assets/images/trofeo.png" alt="" style={estilos.destacadoHeaderIcono} />
              <div style={estilos.destacadoTitulo}>{torneoDestacado.titulo}</div>
            </div>

            <div style={estilos.destacadoStats}>
              <div style={estilos.destacadoStatBadge}>
                <span style={estilos.iconoSiluetaJugadores} />
                <span style={estilos.destacadoStatValor}>
                  {torneoDestacado.entradas_actuales}/{torneoDestacado.cupo_entradas}
                </span>
                <span style={estilos.destacadoStatLabel}>Jugadores</span>
              </div>
              <div style={estilos.destacadoStatBadge}>
                <img src="/assets/images/icono-cartas-nueva.png" alt="" style={estilos.destacadoStatIcono} />
                <span style={estilos.destacadoStatValor}>{torneoDestacado.modo}</span>
                <span style={estilos.destacadoStatLabel}>Modo</span>
              </div>
              <div style={estilos.destacadoStatBadge}>
                <img src="/assets/images/fosforos_5_tantos.png" alt="" style={estilos.fosforosPuntos} />
                <span style={estilos.destacadoStatValor}>{torneoDestacado.puntos_para_ganar}</span>
                <span style={estilos.destacadoStatLabel}>Puntos</span>
              </div>
              {/* Pase siguiente: se restauró el costo de inscripción (10 🪙) y
                  el premio fijo al campeón (35 🪙, ver PREMIO_CAMPEON_POR_JUGADOR
                  en torneoManager.js — no viene del backend, es la misma
                  constante que ya paga el sistema) — se muestran acá para que
                  se sepa antes de anotarse, mismo criterio que "(cuesta 1 🪙)"
                  en salas privadas. */}
              <div style={estilos.destacadoStatBadge}>
                {/* Pase siguiente: Math.round() para que nunca se vean
                    decimales acá (el campo apuesta es numeric en Postgres y
                    puede volver como string tipo "10.00") — a pedido del
                    usuario, "para que sea menos confuso". */}
                <img src="/assets/images/moneda.png" alt="" style={estilos.destacadoStatIcono} />
                <span style={estilos.destacadoStatValor}>{Math.round(Number(torneoDestacado.apuesta))}</span>
                <span style={estilos.destacadoStatLabel}>Entrada</span>
              </div>
              <div style={estilos.destacadoStatBadge}>
                <img src="/assets/images/historial-trofeo.png" alt="" style={estilos.destacadoStatIcono} />
                <span style={{ ...estilos.destacadoStatValor, color: '#B9770E' }}>35</span>
                <span style={estilos.destacadoStatLabel}>Premio</span>
              </div>
            </div>

            {torneoDestacado.ya_inscripto ? (
              <div style={estilos.destacadoYaInscripto}>✓ Ya estás anotado</div>
            ) : inscribiendoId === torneoDestacado.id ? (
              <div>
                {JUGADORES_POR_EQUIPO[torneoDestacado.modo] > 1 && (
                  <input
                    type="text"
                    placeholder={`Usernames de tus ${JUGADORES_POR_EQUIPO[torneoDestacado.modo] - 1} compañero(s), separados por coma`}
                    value={companerosTexto}
                    onChange={(e) => setCompanerosTexto(e.target.value)}
                    style={{ ...estilos.input, marginBottom: 8 }}
                  />
                )}
                {/* Pase 203: antes "Cancelar" heredaba width:100% de
                    estilos.btnSecondary (pensado para usos donde va solo) y
                    quedaba mucho más grande que "Confirmar" al lado — ahora
                    los dos se anulan a su ancho natural y quedan parejos,
                    centrados en la fila (pedido del usuario). */}
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button onClick={() => handleInscribirse(torneoDestacado)} style={{ ...estilos.btnConfirmar, width: 'auto', padding: '0 26px' }}>
                    Confirmar
                  </button>
                  <button
                    onClick={() => { setInscribiendoId(null); setCompanerosTexto(''); }}
                    style={{ ...estilos.btnSecondary, width: 'auto', padding: '0 26px' }}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setInscribiendoId(torneoDestacado.id)} style={estilos.destacadoBtn}>
                Anotarme ahora
              </button>
            )}
          </div>
        </div>
      )}

      {/* Pase de rediseño estructural: de rectángulo blanco plano a mini
          placa de madera (mismo degradé maderaClara/Media/Oscura + borde
          negro que el resto de la pantalla) — el "0" pasa a dorado y bien
          grande, y los emoji de las etiquetas se cambian por los íconos
          ilustrados ya existentes (personaje/trofeo), para no mezclar
          emoji con arte ilustrado en la misma pantalla. */}
      <div style={estilos.statsRow}>
        <div style={estilos.statCard}>
          <div style={estilos.statHueco}>
            <div style={estilos.statValor}>{jugadoresParticipando}</div>
            <div style={estilos.statLabel}>
              <span style={{ ...estilos.iconoSiluetaJugadores, width: 14, height: 14, marginRight: 4 }} />
              jugadores participando
            </div>
          </div>
        </div>
        <div style={estilos.statCard}>
          <div style={estilos.statHueco}>
            <div style={estilos.statValor}>{torneosEnJuego}</div>
            <div style={estilos.statLabel}>
              <img src="/assets/images/historial-trofeo.png" alt="" style={estilos.statLabelIcono} />
              torneos en juego
            </div>
          </div>
        </div>
      </div>

      {/* Pase siguiente: la tarjeta "Crear torneo" y la lista de torneos
          disponibles vivían una debajo de la otra (a todo el ancho). A
          pedido del usuario se dividen en 2 columnas — la de crear queda
          más chica (mitad de pantalla) y al lado aparece la lista. Se usa
          CSS grid con auto-fit/minmax en vez de un 50/50 fijo para que en
          pantallas angostas (mobile) las 2 columnas se apilen solas, sin
          necesitar una media query aparte (mismo truco que ya usa
          torneosGrid más abajo). */}
      <div style={estilos.crearYListaWrap}>
      {/* Pase de rediseño estructural: mismo criterio de "placa de madera
          de taberna" que el resto de la app (exterior de madera oscura +
          remaches, interior de pergamino cálido) en vez del rectángulo
          blanco plano de antes. */}
      <div style={{ ...estilos.panelExterior, marginBottom: 0 }}>
        <span style={{ ...estilos.remache, top: 10, left: 10 }} />
        <span style={{ ...estilos.remache, top: 10, right: 10 }} />
        <span style={{ ...estilos.remache, bottom: 10, left: 10 }} />
        <span style={{ ...estilos.remache, bottom: 10, right: 10 }} />
      <div style={estilos.panelInterior}>
        <Filigrana />
        <div style={estilos.panelTitle}>
          <img src="/assets/images/icono-cartas-nueva.png" alt="" style={estilos.panelTitleIcono} />
          Crear torneo
        </div>

        {!creando ? (
          <button onClick={() => setCreando(true)} style={estilos.btnNuevoTorneo}>+ Nuevo torneo</button>
        ) : (
          <form onSubmit={handleCrearTorneo}>
            <div style={estilos.field}>
              <label style={estilos.label}>Título</label>
              <input
                type="text"
                placeholder="Copa TrucoChe"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                required
                style={estilos.input}
              />
            </div>

            {/* Pase siguiente: los 4 <select> de acá se reemplazan por chips
                tocables — mismo componente visual (opcionesRow/opcionBtn/
                opcionBtnActiva) que ya usa la tarjeta "Crear sala" del
                Lobby, a pedido del usuario para que sea más fácil de
                interactuar (menos abrir/cerrar un dropdown, más tocar
                directo la opción). */}
            <div style={estilos.fieldRow}>
              <div style={estilos.field}>
                <label style={estilos.label}>Modo</label>
                <div style={estilos.opcionesRow}>
                  {MODOS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setModo(m)}
                      style={{ ...estilos.opcionBtn, ...(modo === m ? estilos.opcionBtnActiva : {}) }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div style={estilos.field}>
                <label style={estilos.label}>Puntos</label>
                <div style={estilos.opcionesRow}>
                  {PUNTOS_OPCIONES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPuntosParaGanar(p)}
                      style={{ ...estilos.opcionBtn, ...(puntosParaGanar === p ? estilos.opcionBtnActiva : {}) }}
                    >
                      {p} pts
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={estilos.field}>
              <label style={estilos.label}>Cupo de equipos</label>
              <div style={estilos.opcionesRow}>
                {CUPO_OPCIONES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCupoEntradas(c)}
                    style={{ ...estilos.opcionBtn, ...(cupoEntradas === c ? estilos.opcionBtnActiva : {}) }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div style={estilos.field}>
              <label style={estilos.label}>Tiempo por turno</label>
              <div style={estilos.opcionesRow}>
                {TIEMPO_OPCIONES.map((t) => (
                  <button
                    key={t.valor}
                    type="button"
                    onClick={() => setTiempoPorTurno(t.valor)}
                    style={{ ...estilos.opcionBtn, ...(tiempoPorTurno === t.valor ? estilos.opcionBtnActiva : {}) }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={estilos.field}>
              <label style={estilos.label}>Visibilidad</label>
              <div style={estilos.opcionesRow}>
                <button
                  type="button"
                  onClick={() => setPrivado(false)}
                  style={{ ...estilos.opcionBtn, ...(!privado ? estilos.opcionBtnActiva : {}) }}
                >
                  Público
                </button>
                <button
                  type="button"
                  onClick={() => setPrivado(true)}
                  style={{ ...estilos.opcionBtn, ...(privado ? estilos.opcionBtnActiva : {}) }}
                >
                  Privado (con código)
                </button>
              </div>
              <div style={estilos.ayudaCosto}>
                {privado
                  ? 'No aparece en el listado: se entra con un código que vos compartís.'
                  : 'Aparece en el listado para que cualquiera se anote.'}
              </div>
            </div>

            <div style={estilos.costoCrear}>
              <img src="/assets/images/icono-moneda.png" alt="" style={estilos.iconoMonedaInline} />
              Crear este torneo cuesta <b>{COSTO_CREAR_TORNEO[cupoEntradas]}</b>. Si vence sin llenarse, te lo devolvemos.
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
              <button type="submit" style={{ ...estilos.btnPrimary, flex: 1 }}>
                ✓ Crear por {COSTO_CREAR_TORNEO[cupoEntradas]}
                <img src="/assets/images/icono-moneda.png" alt="" style={{ ...estilos.iconoMonedaInline, marginLeft: 5, marginRight: 0, verticalAlign: 'text-bottom' }} />
              </button>
              <button type="button" onClick={() => setCreando(false)} style={{ ...estilos.btnSecondary, width: 'auto', padding: '0 22px' }}>✕</button>
            </div>
          </form>
        )}

        <div style={estilos.separadorCodigo} />
        <div style={estilos.panelTitle}>
          <img src="/assets/images/icono-sala-privada.png" alt="" style={estilos.panelTitleIcono} />
          Unirme con código
        </div>
        <form onSubmit={handleBuscarCodigo} style={{ display: 'flex', gap: 10 }}>
          <input
            type="text"
            placeholder="Código de torneo"
            value={codigoBuscar}
            onChange={(e) => setCodigoBuscar(e.target.value.toUpperCase())}
            maxLength={12}
            style={{ ...estilos.input, flex: 1 }}
          />
          <button type="submit" style={{ ...estilos.btnPrimary, width: 'auto', padding: '0 20px' }}>Buscar</button>
        </form>

        {torneoPorCodigo && (
          <div style={estilos.codigoEncontrado}>
            <div style={estilos.torneoHeader}>
              <div style={estilos.torneoNombre}>{renderTituloTorneo(torneoPorCodigo.titulo)}</div>
              <div style={{ ...estilos.badge, ...estilos.badgeAbierta }}>Privado</div>
            </div>
            <div style={estilos.torneoInfo}>
              {torneoPorCodigo.modo} · Cupo {torneoPorCodigo.entradas_actuales}/{torneoPorCodigo.cupo_entradas} · {torneoPorCodigo.puntos_para_ganar} pts · {torneoPorCodigo.creador_nombre}
            </div>
            {torneoPorCodigo.ya_inscripto ? (
              <div style={estilos.torneoInfo}>Ya estás anotado en este torneo.</div>
            ) : Number(torneoPorCodigo.entradas_actuales) >= torneoPorCodigo.cupo_entradas ? (
              <div style={estilos.torneoInfo}>Este torneo ya está completo.</div>
            ) : (
              <>
                {JUGADORES_POR_EQUIPO[torneoPorCodigo.modo] > 1 && (
                  <input
                    type="text"
                    placeholder={`Usernames de tus ${JUGADORES_POR_EQUIPO[torneoPorCodigo.modo] - 1} compañero(s), separados por coma`}
                    value={companerosTexto}
                    onChange={(e) => setCompanerosTexto(e.target.value)}
                    style={{ ...estilos.input, marginBottom: 8 }}
                  />
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleInscribirse(torneoPorCodigo)} style={estilos.btnCard}>
                    Inscribirme ({Math.round(Number(torneoPorCodigo.apuesta))}
                    <img src="/assets/images/icono-moneda.png" alt="" style={{ ...estilos.iconoMonedaInline, marginLeft: 3, marginRight: 0, verticalAlign: 'text-bottom' }} />)
                  </button>
                  <button onClick={() => { setTorneoPorCodigo(null); setCompanerosTexto(''); }} style={estilos.btnCardSecondary}>
                    Cancelar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      </div>

      <PopupMadera
        visible={!!codigoCreado}
        titulo="Torneo privado creado"
        cinta="verde"
        icono="/assets/images/icono-sala-privada.png"
        tamIcono={72}
        onCerrar={() => setCodigoCreado(null)}
        botones={[
          { texto: 'Copiar código', onClick: () => copiarCodigo(codigoCreado) },
          { texto: 'Listo', tipo: 'verde', onClick: () => setCodigoCreado(null) },
        ]}
      >
        <p style={{ fontSize: 15, fontWeight: 800, color: '#2C160E', margin: '0 0 10px', textAlign: 'center' }}>
          Compartí este código con quien quieras invitar. Tampoco aparece en el listado, así que solo entra quien lo tenga:
        </p>
        <div style={estilos.codigoBox}>{codigoCreado}</div>
      </PopupMadera>

      <div style={estilos.listaColumna}>
      {/* Pase 359: Activos/Finalizados viven dentro de UNA tarjeta (marco de madera + paño verde) con la lista
          en un área de alto máximo con scroll propio, para que la página no se alargue con muchos torneos. */}
      <div style={estilos.listaPanelExterior}>
      <div style={estilos.listaPanelInterior}>
      <div style={estilos.tabs}>
        <button
          onClick={() => setVista('activos')}
          style={vista === 'activos' ? estilos.tabActiva : estilos.tabInactiva}
        >
          Activos
        </button>
        <button
          onClick={() => setVista('finalizados')}
          style={vista === 'finalizados' ? estilos.tabActiva : estilos.tabInactiva}
        >
          Finalizados
        </button>
      </div>

{vista === 'activos' && (
  <>
    <div style={estilos.sectionTitle}>Torneos disponibles</div>

    {cargando ? (
      // Centésimo cuadragésimo sexto pase: ver PantallaCarga.
      <PantallaCarga completa={false} conLogo={false} />
    ) : torneos.length === 0 ? (
      <p style={{ color: C.crema, textAlign: 'center' }}>No hay torneos activos. ¡Creá uno!</p>
    ) : (
      <div ref={scrollActivosRef} style={{ ...estilos.torneosGrid, ...estilos.torneosScroll, ...(altoActivos ? { maxHeight: altoActivos } : null) }}>
        {torneosPaginados.map((t) => {
          const jugadoresNecesarios = JUGADORES_POR_EQUIPO[t.modo];
          const completo = Number(t.entradas_actuales) >= t.cupo_entradas;
          const enCurso = t.estado === 'en-curso';

          return (
            <div key={t.id} style={estilos.torneoCardExterior}>
              <div style={estilos.torneoCard}>
              <div style={estilos.torneoHeader}>
                <div style={estilos.torneoNombre}>{renderTituloTorneo(t.titulo)}</div>
                <div style={{ ...estilos.badge, ...(enCurso ? estilos.badgeCurso : estilos.badgeAbierta) }}>
                  {enCurso ? 'En curso' : t.estado === 'inscripcion' ? (t.privado ? 'Privado' : 'Inscripción abierta') : t.estado}
                </div>
              </div>
              <div style={estilos.torneoInfo}>
                {t.modo} · Cupo {t.entradas_actuales}/{t.cupo_entradas} · {t.puntos_para_ganar} pts · {t.creador_nombre}
              </div>
              {t.privado && t.codigo && (
                <div style={estilos.codigoFila}>
                  <span>Código: <b style={estilos.codigoTexto}>{t.codigo}</b></span>
                  <button type="button" onClick={() => copiarCodigo(t.codigo)} style={estilos.btnCopiarMini}>Copiar</button>
                </div>
              )}

              {t.estado === 'inscripcion' && !completo && !t.ya_inscripto && (
                inscribiendoId === t.id ? (
                  <div>
                    {jugadoresNecesarios > 1 && (
                      <input
                        type="text"
                        placeholder={`Usernames de tus ${jugadoresNecesarios - 1} compañero(s), separados por coma`}
                        value={companerosTexto}
                        onChange={(e) => setCompanerosTexto(e.target.value)}
                        style={{ ...estilos.input, marginBottom: 8 }}
                      />
                    )}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => handleInscribirse(t)} style={estilos.btnCard}>Confirmar</button>
                      <button onClick={() => { setInscribiendoId(null); setCompanerosTexto(''); }} style={estilos.btnCardSecondary}>
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setInscribiendoId(t.id)} style={estilos.btnCard}>Inscribirse</button>
                )
              )}

              {t.estado === 'inscripcion' && t.ya_inscripto && (
                <button onClick={() => handleDesinscribirse(t)} style={estilos.btnCardCrimson}>
                  Desinscribirme
                </button>
              )}

              {enCurso && (
                <button onClick={() => onVerBracket(t.id)} style={estilos.btnCard}>Ver bracket</button>
              )}
              </div>
            </div>
          );
        })}
      </div>
    )}
    <Paginador
      pagina={paginaActivosActual}
      totalPaginas={totalPaginasActivos}
      onCambiar={setPaginaActivos}
    />
  </>
)}

{vista === 'finalizados' && (
  <>
    <div style={estilos.sectionTitle}>Torneos finalizados</div>

    {cargandoFinalizados ? (
      // Centésimo cuadragésimo sexto pase: ver PantallaCarga.
      <PantallaCarga completa={false} conLogo={false} />
    ) : torneosFinalizados.length === 0 ? (
      <p style={{ color: C.crema, textAlign: 'center' }}>Todavía no jugaste ningún torneo hasta el final.</p>
    ) : (
      <div ref={scrollFinalizadosRef} style={{ ...estilos.torneosGrid, ...estilos.torneosScroll, ...(altoFinalizados ? { maxHeight: altoFinalizados } : null) }}>
        {torneosFinalizadosPaginados.map((t) => (
          <div key={t.id} style={estilos.torneoCardExterior}>
            <div style={estilos.torneoCard}>
            <div style={estilos.torneoHeader}>
              <div style={estilos.torneoNombre}>{renderTituloTorneo(t.titulo)}</div>
              {t.soy_campeon && (
                <div style={{ ...estilos.badge, background: '#ffe8c2', color: C.doradoOscuro }}>
                  👑 Campeón
                </div>
              )}
            </div>
            <div style={estilos.torneoInfo}>
              {t.modo} · {t.puntos_para_ganar} pts · {t.creador_nombre}
            </div>
            <button onClick={() => onVerBracket(t.id)} style={estilos.btnCard}>Ver bracket</button>
            </div>
          </div>
        ))}
      </div>
    )}
    <Paginador
      pagina={paginaFinalizadosActual}
      totalPaginas={totalPaginasFinalizados}
      onCambiar={setPaginaFinalizados}
    />
  </>
)}
      </div>
      </div>
      </div>
      </div>
</>
);
}

// Pase 333: contorno negro fino alrededor del texto blanco de los botones verdes.
const CONTORNO_TEXTO = '-1.5px -1.5px 0 #000, 0 -1.5px 0 #000, 1.5px -1.5px 0 #000, -1.5px 0 0 #000, 1.5px 0 0 #000, -1.5px 1.5px 0 #000, 0 1.5px 0 #000, 1.5px 1.5px 0 #000';

const estilos = {
  errorBox: {
    background: '#ffe0dd', border: `2px solid ${C.crimson}`, color: C.crimsonOscuro,
    borderRadius: 10, padding: '8px 12px', marginBottom: 12, fontWeight: 700, fontSize: 13
  },
  // Pase de rediseño estructural: exterior de madera oscura + remaches de
  // bronce en las esquinas (mismo criterio que `podioPanelExterior` de
  // Ranking.js) envolviendo un interior de pergamino cálido — reemplaza el
  // rectángulo blanco plano de antes. `remache` es el mismo punto de bronce
  // (radial-gradient) que ya usan Ranking/Historial/Chat Global.
  remache: {
    position: 'absolute', width: 13, height: 13, borderRadius: '50%',
    zIndex: 2,
    // Pase 360: remache unificado en todo el juego — bola de bronce lisa con borde marrón fino y un brillo claro arriba a la izquierda.
    background: 'radial-gradient(circle at 32% 28%, rgba(255,243,210,0.92) 0, rgba(255,243,210,0.92) 1.5px, transparent 2.1px), #C9973E',
    border: '1.5px solid #5A3A14', boxSizing: 'border-box',
  },
  panelExterior: {
    position: 'relative',
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.negroPulido}`, borderRadius: 20, padding: 12,
    marginBottom: 18,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -4px 10px rgba(0,0,0,0.5)',
      `0 8px 0 ${C.negroPulido}`,
      '0 16px 26px rgba(0,0,0,0.4)',
    ].join(', '),
  },
  // Pase siguiente: padding reducido — en el estado "sin creando" (solo
  // título + 1 botón) quedaba mucho aire arriba y abajo del botón.
  panelInterior: {
    position: 'relative', overflow: 'hidden',
    background: [
      'radial-gradient(ellipse at 20% 25%, rgba(210,182,130,0.4) 0%, transparent 50%)',
      'radial-gradient(ellipse at 82% 75%, rgba(190,160,115,0.35) 0%, transparent 55%)',
      `linear-gradient(180deg, ${C.cremaSutil}, ${C.crema})`,
    ].join(', '),
    borderRadius: 14, padding: '16px 16px 14px',
    boxShadow: 'inset 0 4px 14px rgba(74,44,42,0.28), inset 0 -3px 10px rgba(74,44,42,0.22), inset 0 0 0 2px rgba(0,0,0,0.08)',
  },
  // Pase siguiente: vuelta a la placa de madera 100% CSS (mismo degradé +
  // bisel en capas que `panelExterior`/`pagina` de Chat Global), con borde
  // dorado en vez de negro para que este panel — el que más invita a la
  // acción — se distinga del resto de placas informativas de la pantalla.
  destacadoPanelExterior: {
    position: 'relative',
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.doradoOscuro}`, borderRadius: 22, padding: 10,
    marginBottom: 16,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -4px 10px rgba(0,0,0,0.5)',
      `0 8px 0 ${C.negroPulido}`,
      '0 16px 26px rgba(0,0,0,0.4)',
    ].join(', '),
  },
  // Pase siguiente: interior de "fieltro" verde oscuro en vez del marrón
  // liso plano (mismo criterio que `cuerpo`/`interiorFieltro` de
  // ChatGlobal.js/Historial.js) — mismo lenguaje visual de paño de mesa
  // de truco que el resto de la app, en vez de una caja lisa sin textura.
  destacadoCard: {
    position: 'relative', overflow: 'hidden', textAlign: 'center',
    background: `linear-gradient(180deg, ${C.verdeProfundo}, ${C.verdeOscuro})`,
    borderRadius: 16, padding: '26px 20px 22px',
    boxShadow: 'inset 0 4px 14px rgba(0,0,0,0.55), inset 0 -3px 10px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(0,0,0,0.25)',
  },
  // Pase 351: cinta "PRÓXIMO TORNEO" = placa sutil de pergamino con 2 remaches,
  // montada sobre el borde superior del marco (antes: cinta dorada con muescas).
  destacadoCinta: {
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
    // Pase 360: remache unificado en todo el juego — bola de bronce lisa con borde marrón fino y un brillo claro arriba a la izquierda.
    background: 'radial-gradient(circle at 32% 28%, rgba(255,243,210,0.92) 0, rgba(255,243,210,0.92) 1.1px, transparent 1.7px), #C9973E',
    border: '1.5px solid #5A3A14', boxSizing: 'border-box',
  },
  // Silueta de Jugadores tintada café oscuro (para que contraste sobre pergamino).
  iconoSiluetaJugadores: {
    display: 'inline-block', width: 36, height: 36, flexShrink: 0, backgroundColor: C.chocolate,
    WebkitMask: 'url(/assets/images/icono-personaje.png) center / contain no-repeat',
    mask: 'url(/assets/images/icono-personaje.png) center / contain no-repeat',
  },
  destacadoHeader: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 18 },
  destacadoHeaderIcono: { height: 50, width: 'auto', objectFit: 'contain', flexShrink: 0 },
  destacadoTitulo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 22,
    color: C.crema
  },
  // Pase siguiente: flexWrap agregado — con las 2 stats nuevas (Entrada/
  // Premio) ya son 5 en la fila, y sin wrap podían desbordar en mobile.
  destacadoStats: { display: 'flex', flexWrap: 'nowrap', justifyContent: 'center', gap: 8, marginBottom: 20 },
  // Cada stat pasa de texto suelto a una mini placa de madera 3D (mismo
  // degradé que los paneles grandes, a escala de badge) con su ícono
  // ilustrado arriba del valor.
  // Pase 351: fichas de pergamino ahuecado con marco de madera tostada (antes
  // casilleros de madera casi negra). 5 en UNA sola fila.
  destacadoStatBadge: {
    flex: '1 1 0', minWidth: 0, maxWidth: 96,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
    background: '#FFFBEB',
    border: '2.5px solid #8B5A2B', borderRadius: 12,
    padding: '9px 4px 8px', boxSizing: 'border-box',
    boxShadow: 'inset 0 4px 7px rgba(74,44,17,0.38), inset 0 -2px 0 rgba(255,255,255,0.7), 0 3px 0 rgba(0,0,0,0.55)',
  },
  // Pase siguiente: +4px — el usuario los vio bien pero un poco chicos.
  destacadoStatIcono: { width: 36, height: 36, objectFit: 'contain', marginBottom: 1 },
  // "Ficha de truco" — mismo degradé de remache (moneda/ficha de bronce)
  // dibujado en CSS, no hay un asset de ficha de truco individual todavía.
  // Pase 354: cuadro de fósforos (5 tantos) en la ficha PUNTOS.
  fosforosPuntos: { width: 36, height: 36, objectFit: 'contain', marginBottom: 1 },
  fichaTruco: {
    display: 'block', width: 24, height: 24, borderRadius: '50%',
    background: `radial-gradient(circle at 35% 30%, ${C.remacheClaro} 0%, ${C.remache} 45%, ${C.remacheOscuro} 78%, #3a2610 100%)`,
    boxShadow: '0 1px 2px rgba(0,0,0,0.5), inset 0 1px 1px rgba(255,255,255,0.35)',
    border: '1.5px solid rgba(0,0,0,0.4)', boxSizing: 'border-box',
  },
  destacadoStatValor: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 16,
    color: C.chocolate,
  },
  destacadoStatLabel: { fontSize: 9.5, color: '#7A5A3A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 },
  // Botón "Anotarme ahora" — pedido explícito: bajarlo a 50-60% del ancho
  // (en vez de ocupar toda la placa, que lo hacía ver desproporcionado) y
  // subirle la tipografía ~20% en negrita para que un botón más compacto y
  // grueso pese más como CTA principal. `destacadoCard` es `textAlign:
  // 'center'`, así que un botón inline-block más angosto queda centrado
  // solo, sin flex ni margin:auto.
  // Pase 332: sistema de botones plano (cel-shaded) igual al del Lobby — relleno liso, contorno negro 2px y
  // sombra inferior dura (banda de color oscuro + línea negra). Sin degradés ni brillos.
  destacadoBtn: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 19, color: '#2C160E',
    border: '2px solid #000', borderRadius: 999, cursor: 'pointer', width: '100%', maxWidth: 420,
    height: 58, boxSizing: 'border-box', padding: '0 20px', marginBottom: 6,
    background: '#F5B041', boxShadow: '0 4px 0 #B9770E, 0 6px 0 #000',
  },
  destacadoYaInscripto: {
    background: 'rgba(255,248,237,0.12)', color: C.doradoClaro,
    fontWeight: 700, fontSize: 14, padding: '10px', borderRadius: 12,
    border: `1.5px solid rgba(255,214,104,0.35)`,
  },
  iconoMonedaInline: { width: 16, height: 16, objectFit: 'contain', marginRight: 4 },
  statsRow: { display: 'flex', gap: 12, marginBottom: 16 },
  // Mini placa de madera (misma receta que los paneles grandes, a escala
  // chica) en vez del rectángulo blanco plano de antes.
  // Pase 351: contador = marco de madera biselada + hueco de pergamino (antes caja marrón casi negra).
  statCard: {
    flex: 1, textAlign: 'center', padding: 5,
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `2.5px solid ${C.negroPulido}`, borderRadius: 16,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -3px 8px rgba(0,0,0,0.4)',
      `0 5px 0 ${C.negroPulido}`,
      '0 8px 14px rgba(0,0,0,0.3)',
    ].join(', '),
  },
  statHueco: {
    background: '#FFFBEB', borderRadius: 11, padding: '10px 8px 9px',
    boxShadow: 'inset 0 4px 9px rgba(74,44,17,0.4), inset 0 -2px 0 rgba(255,255,255,0.7)',
  },
  statValor: { fontFamily: "'Fredoka', sans-serif", fontWeight: 800, fontSize: 26, color: '#B9770E' },
  statLabel: {
    fontSize: 11, color: '#7A5A3A', fontWeight: 700, marginTop: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  statLabelIcono: { width: 14, height: 14, objectFit: 'contain', marginRight: 4 },
  panelTitle: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 19, color: C.chocolate, marginBottom: 10,
    display: 'flex', alignItems: 'center',
  },
  panelTitleIcono: { width: 24, height: 'auto', objectFit: 'contain', marginRight: 9 },
  // Pase siguiente: wrapper de 2 columnas para "Crear torneo" + lista de
  // torneos disponibles (ver comentario arriba de crearYListaWrap en el
  // JSX). minmax(340px,1fr) hace que cada columna use la mitad del ancho
  // disponible cuando entran las 2, y se apilen en una sola columna si no
  // entran (pantallas angostas).
  crearYListaWrap: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 18, alignItems: 'start', marginBottom: 18,
  },
  listaColumna: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  // Pase 375: torneos privados y costo de crear.
  ayudaCosto: { fontSize: 12, color: '#7a6660', fontWeight: 700, marginTop: 6 },
  costoCrear: {
    display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 2,
    fontSize: 13, color: C.chocolate, fontWeight: 700, marginBottom: 12,
  },
  separadorCodigo: { height: 0, borderTop: '2px dashed rgba(74,44,42,0.35)', margin: '18px 0 14px' },
  codigoEncontrado: {
    marginTop: 12, padding: '10px 12px', borderRadius: 12,
    background: 'rgba(255,255,255,0.55)', border: '1.5px solid rgba(26,20,16,0.35)',
  },
  codigoFila: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
    fontSize: 12.5, color: '#7a6660', fontWeight: 700, marginBottom: 10,
  },
  codigoTexto: { fontFamily: "'Fredoka', sans-serif", letterSpacing: 2, color: '#B9770E', fontSize: 15 },
  btnCopiarMini: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 12, color: '#2C160E',
    border: '2px solid #000', borderRadius: 14, cursor: 'pointer',
    height: 28, boxSizing: 'border-box', padding: '0 12px',
    background: '#F5B041', boxShadow: '0 2px 0 #B9770E, 0 3px 0 #000',
  },
  codigoBox: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 32,
    letterSpacing: 3, color: '#B9770E', background: '#fff',
    border: '3px dashed #B9770E', borderRadius: 14, padding: '14px 10px',
    marginBottom: 6, textAlign: 'center',
  },
  field: { marginBottom: 12, flex: 1 },
  fieldRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  label: { display: 'block', fontWeight: 700, fontSize: 12, color: C.chocolate, marginBottom: 5, textTransform: 'uppercase' },
  select: {
    width: '100%', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 14,
    color: C.chocolate, background: '#fff', border: `2.5px solid ${C.chocolate}`,
    borderRadius: 12, padding: '9px 11px'
  },
  // Pase siguiente: chips tocables para "Crear torneo" — mismo estilo que
  // opcionBtn/opcionBtnActiva de Lobby.js (Crear sala), traído acá para
  // que ambas tarjetas se sientan consistentes.
  opcionesRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  opcionBtn: {
    flex: 1, minWidth: 56,
    fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 14,
    color: C.chocolate, background: '#fff', border: `2.5px solid ${C.chocolate}`,
    borderRadius: 12, padding: '9px 6px', cursor: 'pointer', textAlign: 'center',
  },
  opcionBtnActiva: {
    background: C.dorado, boxShadow: `0 3px 0 ${C.doradoOscuro}`,
  },
  input: {
    width: '100%', fontFamily: "'Nunito', sans-serif", fontWeight: 700, fontSize: 14,
    color: C.chocolate, background: '#fff', border: `2.5px solid ${C.chocolate}`,
    borderRadius: 12, padding: '9px 11px'
  },
  // Botón primario del form ("✓ Crear torneo", y "Confirmar" reutilizando
  // este mismo estilo) — mismo pill 100% CSS que "Anotarme ahora", así el
  // dorado queda consistente como "acción principal" en toda la pantalla.
  btnPrimary: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: '#2C160E',
    border: '2px solid #000', borderRadius: 999, cursor: 'pointer',
    height: 46, boxSizing: 'border-box', padding: '0 20px', marginBottom: 5,
    background: '#F5B041', boxShadow: '0 3px 0 #B9770E, 0 5px 0 #000',
  },
  btnConfirmar: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16, color: '#fff', textShadow: CONTORNO_TEXTO,
    border: '2px solid #000', borderRadius: 999, cursor: 'pointer',
    height: 46, boxSizing: 'border-box', padding: '0 20px', marginBottom: 5,
    background: '#10B981', boxShadow: '0 3px 0 #065F46, 0 5px 0 #000',
  },
  btnSecondary: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 16,
    background: '#8B5A2B', color: '#FFFBEB', border: '2px solid #000',
    borderRadius: 999, height: 46, boxSizing: 'border-box', padding: '0 20px', marginBottom: 5,
    boxShadow: 'inset 0 3px 5px rgba(74,44,17,0.55), 0 3px 0 #4A2C11, 0 5px 0 #000',
    cursor: 'pointer', width: '100%'
  },
  // "+ Nuevo torneo" — mismo pill verde 100% CSS que "Inscribirse"/
  // "Ver bracket" (ver `btnCard`), en vez de la barra blanca plana de
  // antes o del pill ilustrado que se deformaba en este ancho.
  btnNuevoTorneo: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 17, color: '#fff', textShadow: CONTORNO_TEXTO,
    border: '2px solid #000', borderRadius: 999, cursor: 'pointer', width: '100%',
    height: 50, boxSizing: 'border-box', padding: '0 20px', marginBottom: 5,
    background: '#10B981', boxShadow: '0 3px 0 #065F46, 0 5px 0 #000',
  },
  sectionTitle: { fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 16, color: C.crema, margin: '4px 0 10px 4px' },
  tabs: { display: 'flex', gap: 8, marginBottom: 14 },
  // Activa: madera clara/pergamino con borde dorado y contorno negro.
  tabActiva: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14,
    background: '#FFFBEB', color: '#2C160E', border: '2px solid #000', borderRadius: 999,
    height: 38, boxSizing: 'border-box', padding: '0 20px', marginBottom: 5,
    boxShadow: '0 3px 0 #A8977A, 0 5px 0 #000', cursor: 'pointer'
  },
  // Inactiva: cuero oscuro "hundido" (sombra interior en vez de relieve).
  tabInactiva: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14,
    background: '#8B5A2B', color: '#FFFBEB', border: '2px solid #000', borderRadius: 999,
    height: 38, boxSizing: 'border-box', padding: '0 20px', marginBottom: 5,
    boxShadow: 'inset 0 3px 5px rgba(74,44,17,0.55), 0 3px 0 #4A2C11, 0 5px 0 #000',
    cursor: 'pointer'
  },
  // Pase siguiente: "placa nameplate" de 2 tonos (mismo criterio que
  // `panelExterior`/`panelInterior` — exterior de madera, interior de
  // pergamino cálido — pero a escala chica y sin remaches, para que no se
  // sienta recargado repetido en toda una grilla de tarjetas) en vez del
  // pergamino plano de un solo tono que tenía antes. Va en 2 capas porque
  // el exterior necesita su propio padding para que se vea el filo de
  // madera alrededor del pergamino.
  torneoCardExterior: {
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `2px solid ${C.negroPulido}`, borderRadius: 16,
    padding: 6, marginBottom: 10,
    boxShadow: [
      'inset 0 1px 0 rgba(255,255,255,0.10)',
      'inset 0 -3px 7px rgba(0,0,0,0.4)',
      `0 4px 0 ${C.negroPulido}`,
      '0 6px 10px rgba(0,0,0,0.25)',
    ].join(', '),
  },
  torneoCard: {
    background: 'linear-gradient(135deg, #fffaf0 0%, #f7e8c8 100%)',
    border: `1.5px solid rgba(26,20,16,0.35)`, borderRadius: 11,
    padding: '12px 14px',
    boxShadow: 'inset 0 0 0 1px rgba(26,20,16,0.12)',
  },
  torneoHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 8 },
  torneoNombre: { fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 15, color: C.chocolate },
  badge: {
    fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 999,
    textTransform: 'uppercase', whiteSpace: 'nowrap', border: `1.5px solid ${C.negroPulido}`,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  },
  // Pase 351: insignia verde suave ahuecada con contorno fino (sin cápsula brillante).
  badgeAbierta: {
    background: '#D6F0DF', color: '#1F5C38', border: '1.5px solid #2E8B57',
    boxShadow: 'inset 0 2px 3px rgba(31,92,56,0.25)',
  },
  badgeCurso: {
    background: `linear-gradient(180deg, ${C.doradoClaro}, ${C.dorado})`, color: C.chocolate,
    boxShadow: `0 2px 0 ${C.doradoOscuro}, inset 0 1px 0 rgba(255,255,255,0.5)`,
  },
  torneoInfo: { fontSize: 12.5, color: '#7a6660', fontWeight: 700, marginBottom: 10 },
  // "Inscribirse"/"Ver bracket" — pedido explícito: rectangular con bordes
  // redondeados (no pill completo como los botones grandes) para que
  // encaje cómodo a la izquierda de la tarjeta sin tocar la franja
  // inferior — el pill ilustrado se deformaba en óvalo con un anillo en
  // el medio a este tamaño.
  btnCard: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14, color: '#fff', textShadow: CONTORNO_TEXTO,
    border: '2px solid #000', borderRadius: 20, cursor: 'pointer',
    height: 38, boxSizing: 'border-box', padding: '0 18px', marginBottom: 7,
    background: '#10B981', boxShadow: '0 3px 0 #065F46, 0 5px 0 #000',
  },
  btnCardDorado: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14, color: '#2C160E',
    border: '2px solid #000', borderRadius: 20, cursor: 'pointer',
    height: 38, boxSizing: 'border-box', padding: '0 18px', marginBottom: 7,
    background: '#F5B041', boxShadow: '0 3px 0 #B9770E, 0 5px 0 #000',
  },
  btnCardSecondary: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14,
    background: '#8B5A2B', color: '#FFFBEB', border: '2px solid #000',
    borderRadius: 20, height: 38, boxSizing: 'border-box', padding: '0 18px', marginBottom: 7,
    boxShadow: 'inset 0 3px 5px rgba(74,44,17,0.55), 0 3px 0 #4A2C11, 0 5px 0 #000', cursor: 'pointer'
  },
  // "Desinscribirme" — mismo criterio que `btnCard`: rectangular con
  // bordes redondeados en rojo/crimson, no el pill ilustrado (mismo
  // problema de deformación a este tamaño).
  btnCardCrimson: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 14, color: '#fff',
    border: '2px solid #000', borderRadius: 20, cursor: 'pointer',
    height: 38, boxSizing: 'border-box', padding: '0 18px', marginBottom: 7,
    background: '#E74C3C', boxShadow: '0 3px 0 #78281F, 0 5px 0 #000',
  },
  // Pase 359: tarjeta contenedora de la lista de torneos.
  listaPanelExterior: {
    position: 'relative',
    background: `linear-gradient(160deg, ${C.maderaClara} 0%, ${C.maderaMedia} 55%, ${C.maderaOscura} 100%)`,
    border: `3px solid ${C.negroPulido}`, borderRadius: 22, padding: 10,
    boxShadow: [
      'inset 0 2px 0 rgba(255,255,255,0.10)',
      'inset 0 -4px 10px rgba(0,0,0,0.5)',
      `0 6px 0 ${C.negroPulido}`,
      '0 14px 22px rgba(0,0,0,0.35)',
    ].join(', '),
  },
  listaPanelInterior: {
    position: 'relative',
    background: `linear-gradient(180deg, ${C.verdeProfundo}, ${C.verdeOscuro})`,
    borderRadius: 16, padding: '14px 14px 12px',
    boxShadow: 'inset 0 4px 14px rgba(0,0,0,0.55), inset 0 -3px 10px rgba(0,0,0,0.35), inset 0 0 0 2px rgba(0,0,0,0.25)',
  },
  torneosScroll: { maxHeight: 520, overflowY: 'auto', paddingRight: 6, paddingBottom: 6 },
  torneosGrid: {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 12,
},
  // Controles de paginación — mismo criterio "3D plano" que el resto de
  // botones de la pantalla, en madera oscura (neutro, no compite con el
  // verde/dorado de las acciones reales de las tarjetas).
  paginador: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 14 },
  paginadorBtn: {
    fontFamily: "'Fredoka', sans-serif", fontWeight: 700, fontSize: 13, color: '#FFFBEB',
    border: '2px solid #000', borderRadius: 999, cursor: 'pointer',
    background: '#8B5A2B', boxShadow: '0 3px 0 #4A2C11, 0 5px 0 #000',
    height: 36, boxSizing: 'border-box', padding: '0 16px', marginBottom: 5,
  },
  paginadorBtnDisabled: { opacity: 0.4, cursor: 'default' },
  paginadorTexto: { fontSize: 12.5, color: C.crema, fontWeight: 700, minWidth: 92, textAlign: 'center' },
};