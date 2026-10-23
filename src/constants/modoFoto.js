// constants/modoFoto.js
// Pase 611: "Modo foto" (solo admin). Arma una mesa SIMULADA (sin servidor, sin cuentas, sin mates) con una escena fija
// —respuesta a Truco/Retruco/Vale cuatro, Envido, Flor— para sacar capturas limpias (Instagram, Play Store, eventos).
// El formulario de Ajustes (admin, ModoFotoAdmin.js) guarda la configuración y abre /?preview=<modo>&foto=1; GameSceneOnline (estado,
// dorso) y GameOnlinePhaser (interfaz limpia) la leen desde este módulo.

const c = (valor, palo) => ({ id: `foto-${palo}-${valor}`, palo, valor });

export const ESCENAS_FOTO = [
  { id: 'mesa', nombre: 'Mesa en juego' },
  { id: 'truco', nombre: 'Responder Truco' },
  { id: 'retruco', nombre: 'Responder Retruco' },
  { id: 'vale-cuatro', nombre: 'Responder Vale cuatro' },
  { id: 'envido', nombre: 'Responder Envido' },
  { id: 'real-envido', nombre: 'Responder Real envido' },
  { id: 'falta-envido', nombre: 'Responder Falta envido' },
  { id: 'flor', nombre: 'Responder Flor' },
  { id: 'contra-flor', nombre: 'Responder Contra flor' },
];

export const CONFIG_FOTO_INICIAL = {
  activo: false,
  modo: '1v1',            // '1v1' | '2v2' | '3v3'
  escena: 'truco',
  yo: '',                 // vacío = el usuario de la sesión
  compas: ['Chiqui', 'Tano'],
  rivales: ['Don Facundo', 'El Colo', 'Pocho'],
  puntosYo: 7,
  puntosRival: 5,
  mazo: 'base',
  ocultarUI: true,
};

const CLAVE = 'tc_foto_cfg';

// Lo guarda el formulario de Ajustes (admin) antes de abrir /?preview=<modo>&foto=1.
export function guardarConfigFoto(cfg) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ ...CONFIG_FOTO_INICIAL, ...cfg })); } catch (e) { /* sin storage: queda la configuración por defecto */ }
}
export function leerConfigGuardada() {
  try {
    const raw = localStorage.getItem(CLAVE);
    return raw ? { ...CONFIG_FOTO_INICIAL, ...JSON.parse(raw) } : { ...CONFIG_FOTO_INICIAL };
  } catch (e) { return { ...CONFIG_FOTO_INICIAL }; }
}
// Config del Modo foto SOLO si la URL trae ?foto=1 (así los botones "Simular" del lobby siguen igual).
export function getConfigFoto() {
  let activo = false;
  try { activo = new URLSearchParams(window.location.search).get('foto') === '1'; } catch (e) { activo = false; }
  return { ...leerConfigGuardada(), activo };
}

const sinCanto = () => ({ nivel: null, pendienteDeRespuesta: false, cantadoPorMi: false, cantadoPorMiEquipo: false });

function jugadorFoto(nombre, id, jugadas, cartasEnMano) {
  return { id, nombre, cartasEnMano, jugadas };
}

export function crearEstadoFoto(cfg) {
  const escena = cfg.escena;
  const esTruco = ['truco', 'retruco', 'vale-cuatro'].includes(escena);
  const esEnvido = ['envido', 'real-envido', 'falta-envido'].includes(escena);
  const esFlor = ['flor', 'contra-flor'].includes(escena);
  const esMesa = escena === 'mesa';
  // En las escenas de Envido/Flor todavía no se jugó ninguna carta (el canto va antes de la primera); en Truco y Mesa ya se jugó una por lado.
  const conJugadas = esTruco || esMesa;

  const misCartasTodas = esFlor ? [c(7, 'oro'), c(6, 'oro'), c(2, 'oro')] : [c(1, 'espada'), c(7, 'oro'), c(3, 'basto')];
  const misCartas = conJugadas ? misCartasTodas.slice(1) : misCartasTodas;
  const misJugadas = conJugadas ? [misCartasTodas[0]] : [];
  const rivalJugada = [c(5, 'copa')];
  const rivalJugadaCompa = [c(4, 'espada')];

  const estado = {
    numeroRonda: 3,
    esMano: false,
    scores: { yo: cfg.puntosYo, rival: cfg.puntosRival },
    handsWon: { yo: 0, rival: 0 },
    misCartas,
    misJugadas,
    rondaActiva: true,
    turno: 'mio',
    turnoDeId: null,
    compartiendoMiMano: false,
    etapa: conJugadas ? 'truco' : 'envido',
    tengoFlor: esFlor,
    florYaCantada: false,
    declaracionEnvido: null,
    truco: sinCanto(),
    envido: sinCanto(),
    flor: sinCanto(),
  };

  if (esTruco) estado.truco = { nivel: escena, resuelto: false, pendienteDeRespuesta: true, cantadoPorMi: false, cantadoPorMiEquipo: false, personajeQueCanto: 'gaucho' };
  if (esEnvido) estado.envido = { tipo: escena, resuelto: false, pendienteDeRespuesta: true, cantadoPorMi: false, cantadoPorMiEquipo: false, personajeQueCanto: 'gaucho' };
  if (esFlor) estado.flor = { nivel: escena, resuelto: false, pendienteDeRespuesta: true, cantadoPorMi: false, cantadoPorMiEquipo: false, personajeQueCanto: 'gaucho' };

  const nCartasRival = conJugadas ? 2 : 3;
  if (cfg.modo === '1v1') {
    return { ...estado, nombreRival: cfg.rivales[0], cartasRivalEnMano: nCartasRival, jugadasRival: conJugadas ? rivalJugada : [] };
  }
  const nCompas = cfg.modo === '2v2' ? 1 : 2;
  const nRivales = cfg.modo === '2v2' ? 2 : 3;
  const palos = ['basto', 'copa', 'oro', 'espada'];
  const valores = [4, 6, 11, 12, 2, 10];
  const jugadaDe = (i) => (conJugadas ? [c(valores[i % valores.length], palos[i % palos.length])] : []);
  return {
    ...estado,
    companeros: Array.from({ length: nCompas }, (_, i) => jugadorFoto(cfg.compas[i] || `Compa ${i + 1}`, `comp-${i + 1}`, jugadaDe(i), nCartasRival)),
    rivales: Array.from({ length: nRivales }, (_, i) => jugadorFoto(cfg.rivales[i] || `Rival ${i + 1}`, `riv-${i + 1}`, i === 0 && conJugadas ? rivalJugada : jugadaDe(i + 2), nCartasRival)),
  };
}
