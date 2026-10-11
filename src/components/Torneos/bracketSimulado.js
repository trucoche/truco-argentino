// Pase 384: simulador de bracket (solo desarrollo). Genera en memoria un torneo y sus partidos con la misma forma que
// devuelven GET /api/torneos/:id y GET /api/torneos/:id/bracket, para poder ver la sala y el bracket de los 3 modos
// (1v1 / 2v2 / 3v3) y los 3 cupos (4 / 8 / 16 equipos) sin crear nada en el backend ni cobrar monedas.
// No hace ningún fetch: ver BracketView.js (torneoId === 'simulador').

export const SIM_MODOS = ['1v1', '2v2', '3v3'];
export const SIM_CUPOS = [4, 8, 16];

const JUGADORES_POR_EQUIPO = { '1v1': 1, '2v2': 2, '3v3': 3 };

const NOMBRES = [
  'gaucho_fede', 'la_pampa', 'martin_fierro', 'truco_mate', 'el_chino', 'flor_de_ceibo', 'vale_cuatro', 'ancho_espada',
  'siete_bravo', 'cuervo_sur', 'mate_cocido', 'el_zorro', 'luna_llena', 'pibe_cordobes', 'la_cautiva', 'don_segundo',
  'rey_de_copas', 'sombra_gaucha', 'cacho_ok', 'tero_loco', 'el_malevo', 'ceibo_rojo', 'pampa_viva', 'basto_fuerte',
  'quiero_retruco', 'el_mono', 'dulce_de_leche', 'lagarto_azul', 'norte_grande', 'la_negra', 'fuego_criollo', 'puma_andino',
  'costa_atlantica', 'el_nene', 'cielo_sur', 'tango_viejo', 'zorzal_cantor', 'bombilla_de_oro', 'alma_criolla', 'trucho_pro',
  'cebador', 'el_tano', 'china_linda', 'rio_ancho', 'monte_alto', 'rancho_grande', 'chacarera', 'viento_zonda',
];

const NOMBRES_EQUIPO = [
  'Los Pampas', 'Las Cautivas', 'Truco Club', 'Los del Sur', 'Ancho y Siete', 'Mate Amargo', 'Los Criollos', 'Los Bravos',
  'Rey de Copas', 'Falta Envido', 'Los Retrucos', 'Cuervos FC', 'Flor y Truco', 'Los Gauchos', 'Real Envido', 'Vale Cuatro',
];

// Etapas disponibles para un cupo dado: 3 de sala + una por ronda + campeón.
export function etapasDisponibles(cupo) {
  const rondas = Math.round(Math.log2(cupo));
  const lista = [
    { id: 'sala-inicio', texto: 'Sala: recién creado' },
    { id: 'sala-media', texto: 'Sala: a medias' },
    { id: 'sala-casi', texto: 'Sala: falta uno' },
  ];
  for (let r = 1; r <= rondas; r += 1) {
    const esFinal = r === rondas;
    lista.push({ id: `ronda-${r}`, texto: esFinal ? 'Final en juego' : r === rondas - 1 && rondas > 2 ? `Ronda ${r} (semis)` : `Ronda ${r} en juego` });
  }
  lista.push({ id: 'campeon', texto: 'Campeón definido' });
  return lista;
}

function crearEntradas(modo, cupo, yo, cantidad) {
  const porEquipo = JUGADORES_POR_EQUIPO[modo] || 1;
  let siguiente = 0;
  const entradas = [];
  for (let i = 0; i < cantidad; i += 1) {
    const jugadores = [];
    for (let j = 0; j < porEquipo; j += 1) {
      if (i === 0 && j === 0) jugadores.push(yo);
      else { jugadores.push(NOMBRES[siguiente % NOMBRES.length]); siguiente += 1; }
    }
    entradas.push({
      id: i + 1,
      estado: 'completa',
      // En equipos, la mitad tiene nombre de equipo propio y la otra mitad muestra "a / b / c".
      nombre_equipo: porEquipo > 1 && i % 2 === 1 ? NOMBRES_EQUIPO[i % NOMBRES_EQUIPO.length] : null,
      jugadores,
      invitados_pendientes: [],
      huecos_azar: 0,
    });
  }
  return entradas;
}

function datosPartido(entrada) {
  return entrada
    ? { id: entrada.id, nombre: entrada.nombre_equipo, jugadores: entrada.jugadores }
    : { id: null, nombre: null, jugadores: null };
}

// Arma todos los partidos del bracket. `rondaActual` = ronda que se está jugando (1..R); si es R + 1 el torneo terminó.
function crearPartidos(entradas, rondaActual) {
  const total = entradas.length;
  const rondas = Math.round(Math.log2(total));
  const partidos = [];
  let anteriores = entradas.map((e) => ({ entrada: e }));
  let idPartido = 1;
  for (let r = 1; r <= rondas; r += 1) {
    const actuales = [];
    for (let m = 0; m < anteriores.length / 2; m += 1) {
      const ladoA = anteriores[m * 2];
      const ladoB = anteriores[m * 2 + 1];
      const a = ladoA.entrada;
      const b = ladoB.entrada;
      let estado = 'esperando';
      let ganador = null;
      if (a && b) {
        if (r < rondaActual) estado = 'finalizado';
        else if (r === rondaActual) estado = 'jugando';
      }
      if (estado === 'finalizado') {
        // El jugador (entrada 1) siempre gana sus cruces; en el resto gana el lado A salvo en cruces impares.
        const mioEnA = a.id === 1;
        const mioEnB = b.id === 1;
        ganador = mioEnA ? a : mioEnB ? b : (m + r) % 3 === 0 ? b : a;
      } else if (estado === 'jugando' && !(a.id === 1 || b.id === 1) && m % 2 === 0) {
        // En la ronda actual, los cruces de posición par que no son los míos ya terminaron.
        estado = 'finalizado';
        ganador = (m + r) % 3 === 0 ? b : a;
      }
      const da = datosPartido(a);
      const db = datosPartido(b);
      partidos.push({
        id: idPartido,
        ronda: r,
        posicion: m,
        entrada_a_id: da.id,
        entrada_b_id: db.id,
        nombre_entrada_a: da.nombre,
        nombre_entrada_b: db.nombre,
        jugadores_a: da.jugadores,
        jugadores_b: db.jugadores,
        ganador_entrada_id: ganador ? ganador.id : null,
        estado,
        codigo_sala: estado === 'jugando' ? `SIM${idPartido}` : null,
      });
      idPartido += 1;
      actuales.push({ entrada: ganador });
    }
    anteriores = actuales;
  }
  return partidos;
}

// Devuelve { torneo, partidos } con la misma forma que el backend.
export function generarSimulacion({ modo = '1v1', cupo = 8, etapa = 'sala-media', yo = 'vos' } = {}) {
  const porEquipo = JUGADORES_POR_EQUIPO[modo] || 1;
  const base = {
    id: 'simulador',
    titulo: `Simulacro ${modo} de ${cupo}`,
    modo,
    cupo_entradas: cupo,
    apuesta: 10,
    puntos_para_ganar: 15,
    privado: false,
    puedo_invitar: true,
    estoy_anotado: true,
    soy_creador: true,
    jugadores_en_espera: 0,
    estoy_en_espera: false,
    invitaciones_cupo: [],
    ganador_entrada_id: null,
  };

  if (etapa.startsWith('sala')) {
    let completas = 1;
    if (etapa === 'sala-media') completas = Math.max(1, Math.ceil(cupo / 2) - 1);
    if (etapa === 'sala-casi') completas = cupo - 1;
    const entradas = crearEntradas(modo, cupo, yo, completas);
    const extra = [];
    if (etapa === 'sala-media' && porEquipo > 1) {
      // Un equipo armándose: espera a un amigo invitado y busca otro jugador al azar.
      extra.push({
        id: 900, estado: 'pendiente', nombre_equipo: null, jugadores: [NOMBRES[40]],
        invitados_pendientes: porEquipo === 3 ? [NOMBRES[41]] : [], huecos_azar: porEquipo === 3 ? 1 : 1,
      });
      if (porEquipo === 2) extra[0].invitados_pendientes = [];
    } else if (etapa === 'sala-media') {
      extra.push({ id: 900, estado: 'pendiente', nombre_equipo: null, jugadores: [NOMBRES[40]], invitados_pendientes: [NOMBRES[41]], huecos_azar: 0 });
    }
    const todas = [...entradas, ...extra].slice(0, cupo);
    const huecos = Math.max(0, cupo - todas.length);
    const invitaciones = etapa === 'sala-media' && huecos > 0 ? [{ id: 1, invitado: NOMBRES[42], invitador: yo }, { id: 2, invitado: NOMBRES[43], invitador: NOMBRES[0] }].slice(0, huecos) : [];
    return {
      torneo: {
        ...base,
        estado: 'inscripcion',
        entradas: todas,
        invitaciones_cupo: invitaciones,
        jugadores_en_espera: etapa === 'sala-media' && porEquipo > 1 ? 2 : 0,
      },
      partidos: [],
    };
  }

  const entradas = crearEntradas(modo, cupo, yo, cupo);
  const rondas = Math.round(Math.log2(cupo));
  const rondaActual = etapa === 'campeon' ? rondas + 1 : Number(etapa.replace('ronda-', '')) || 1;
  const partidos = crearPartidos(entradas, rondaActual);
  const final = partidos.find((p) => p.ronda === rondas);
  const terminado = rondaActual > rondas;
  return {
    torneo: {
      ...base,
      estado: terminado ? 'finalizada' : 'en_curso',
      entradas,
      puedo_invitar: false,
      ganador_entrada_id: terminado && final ? final.ganador_entrada_id : null,
    },
    partidos,
  };
}
