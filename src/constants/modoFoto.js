// constants/modoFoto.js
// Pase 611: "Modo foto" (solo admin). Arma una mesa SIMULADA (sin servidor, sin cuentas, sin mates) con una escena fija
// —respuesta a Truco/Retruco/Vale cuatro, Envido, Flor— para sacar capturas limpias (Instagram, Play Store, eventos).
// El formulario de Ajustes (admin, ModoFotoAdmin.js) guarda la configuración y abre /?preview=<modo>&foto=1; GameSceneOnline (estado,
// dorso) y GameOnlinePhaser (interfaz limpia) la leen desde este módulo.
// Pase 728: GALERÍA web (/?preview=<modo>&foto=1&galeria=1): el panel de la mesa (PanelGaleriaWeb en GameOnlinePhaser) guarda la configuración y la escena
// rearma el estado simulado en vivo (`recargarEstadoFoto`). Mismas variantes que la galería de la app (Pase 727).

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
  { id: 'contra-flor-resto', nombre: 'Responder Contra flor al resto' },
  { id: 'declarar-envido', nombre: 'Declarar envido: ¿cuánto tenés?' },
  { id: 'declarar-van', nombre: 'Declarar envido: van 24, ¿tenés más?' },
  { id: 'esperando-declaracion', nombre: 'Esperando que declaren' },
  { id: 'esperando-truco', nombre: 'Mi truco, esperando respuesta' },
  { id: 'esperando-envido', nombre: 'Mi envido, esperando respuesta' },
  { id: 'esperando-flor', nombre: 'Mi flor, esperando respuesta' },
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
  // Pase 727 (galería). null = automático (como antes de la galería).
  galeria: false,
  jugadasMias: null,      // 0 a 3 cartas que jugué yo
  jugadasCompas: null,    // 0 a 3 por cada compañero
  jugadasRivales: null,   // 0 a 3 por cada rival
  turno: 'yo',            // 'yo' o el id del asiento (comp-1, riv-1...)
  mano: null,             // null (nadie marcado) | 'yo' | id del asiento
  tengoFlor: null,        // null = según la escena
  senias: false,          // mostrando mis cartas al compañero
  objetivo: null,         // null = 15 (30 si alguien pasó de 15) | 15 | 30
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
  let galeria = false;
  try {
    const q = new URLSearchParams(window.location.search);
    activo = q.get('foto') === '1';
    galeria = activo && q.get('galeria') === '1';   // Pase 728: el panel de la galería solo con ?foto=1&galeria=1
  } catch (e) { activo = false; galeria = false; }
  return { ...leerConfigGuardada(), activo, galeria };
}
// Pase 728: al salir de la mesa del Modo foto se vuelve a Ajustes → Admin → Modo foto (no al lobby) para seguir probando.
export const URL_SALIDA_FOTO = '/?ajustes=foto';

const sinCanto = () => ({ nivel: null, pendienteDeRespuesta: false, cantadoPorMi: false, cantadoPorMiEquipo: false });

function jugadorFoto(nombre, id, jugadas, cartasEnMano) {
  return { id, nombre, cartasEnMano, jugadas };
}

// Cartas de relleno (sin repetir las mías) para las jugadas de los demás.
const RELLENO = [[5, 'copa'], [4, 'espada'], [12, 'copa'], [2, 'oro'], [10, 'basto'], [6, 'copa'], [11, 'espada'], [7, 'copa'], [3, 'oro'], [1, 'basto'], [4, 'oro'], [2, 'copa'],
  [12, 'basto'], [5, 'espada'], [6, 'espada'], [10, 'copa'], [11, 'oro'], [4, 'copa'], [5, 'basto'], [12, 'espada'], [10, 'oro'], [2, 'basto'], [11, 'copa'], [6, 'basto'],
  [3, 'copa'], [7, 'basto'], [4, 'basto'], [5, 'oro'], [12, 'oro'], [10, 'espada'], [11, 'basto'], [3, 'espada'], [2, 'espada']];

const limitar = (n) => Math.max(0, Math.min(3, Number.isFinite(n) ? n : 0));

export function crearEstadoFoto(cfg) {
  const escena = cfg.escena;
  const esTruco = ['truco', 'retruco', 'vale-cuatro'].includes(escena);
  const esEnvido = ['envido', 'real-envido', 'falta-envido'].includes(escena);
  const esFlor = ['flor', 'contra-flor', 'contra-flor-resto'].includes(escena);
  const esDeclaracion = ['declarar-envido', 'declarar-van', 'esperando-declaracion'].includes(escena);
  const esperaTruco = escena === 'esperando-truco';
  const esperaEnvido = escena === 'esperando-envido';
  const esperaFlor = escena === 'esperando-flor';
  const esMesa = escena === 'mesa';
  // Sin la galería (cantidades en automático): en las escenas de Envido/Flor todavía no se jugó ninguna carta (el canto va antes de la primera);
  // en Truco y Mesa ya se jugó una por lado.
  const conJugadasAuto = esTruco || esMesa || esperaTruco;
  const cant = (v) => (v === null || v === undefined ? (conJugadasAuto ? 1 : 0) : limitar(v));
  const nMias = cant(cfg.jugadasMias);
  const nCompas = cant(cfg.jugadasCompas);
  const nRivales = cant(cfg.jugadasRivales);

  const tengoFlor = cfg.tengoFlor === null || cfg.tengoFlor === undefined ? (esFlor || esperaFlor) : !!cfg.tengoFlor;
  const misCartasTodas = tengoFlor ? [c(7, 'oro'), c(6, 'oro'), c(2, 'oro')] : [c(1, 'espada'), c(7, 'oro'), c(3, 'basto')];
  const misCartas = misCartasTodas.slice(nMias);
  const misJugadas = misCartasTodas.slice(0, nMias);
  const usadas = new Set(misCartasTodas.map((x) => x.id));
  const relleno = RELLENO.map(([v, p]) => c(v, p)).filter((x) => !usadas.has(x.id));
  let cursor = 0;
  const jugadasDe = (n) => Array.from({ length: n }, () => relleno[cursor++ % relleno.length]);

  const objetivo = cfg.objetivo || ((cfg.puntosYo > 15 || cfg.puntosRival > 15) ? 30 : 15);
  const esEquiposModo = cfg.modo !== '1v1';
  const idsCompas = Array.from({ length: cfg.modo === '2v2' ? 1 : cfg.modo === '3v3' ? 2 : 0 }, (_, i) => `comp-${i + 1}`);
  const idsRivales = Array.from({ length: cfg.modo === '1v1' ? 1 : cfg.modo === '2v2' ? 2 : 3 }, (_, i) => `riv-${i + 1}`);
  const existe = (id) => id === 'yo' || idsCompas.includes(id) || idsRivales.includes(id);
  const turnoId = existe(cfg.turno) ? cfg.turno : 'yo';
  const manoSel = cfg.mano && existe(cfg.mano) ? cfg.mano : null;

  const estado = {
    numeroRonda: 3,
    esMano: manoSel === 'yo',
    manoId: manoSel && manoSel !== 'yo' ? manoSel : null,
    scores: { yo: cfg.puntosYo, rival: cfg.puntosRival },
    puntosParaGanar: objetivo,
    handsWon: { yo: 0, rival: 0 },
    misCartas,
    misJugadas,
    rondaActiva: true,
    turno: turnoId === 'yo' ? 'mio' : 'rival',
    turnoDeId: turnoId === 'yo' || !esEquiposModo ? null : turnoId,
    compartiendoMiMano: !!cfg.senias && esEquiposModo,
    etapa: (esEnvido || esFlor || esDeclaracion || esperaEnvido || esperaFlor || nMias === 0) ? 'envido' : 'truco',
    tengoFlor,
    florYaCantada: false,
    declaracionEnvido: null,
    truco: sinCanto(),
    envido: sinCanto(),
    flor: sinCanto(),
  };

  const pendiente = (campo, valor) => ({ [campo]: valor, resuelto: false, pendienteDeRespuesta: true, cantadoPorMi: false, cantadoPorMiEquipo: false, personajeQueCanto: 'gaucho' });
  const propio = (campo, valor) => ({ [campo]: valor, resuelto: false, pendienteDeRespuesta: false, cantadoPorMi: true, cantadoPorMiEquipo: true, personajeQueCanto: 'gaucho' });
  if (esTruco) estado.truco = pendiente('nivel', escena);
  if (esEnvido) estado.envido = pendiente('tipo', escena);
  if (esFlor) estado.flor = pendiente('nivel', escena);
  if (esperaTruco) estado.truco = propio('nivel', 'truco');
  if (esperaEnvido) estado.envido = propio('tipo', 'envido');
  if (esperaFlor) { estado.flor = propio('nivel', 'flor'); estado.florYaCantada = true; }
  if (esDeclaracion) {
    estado.envido = { tipo: 'envido', resuelto: false, pendienteDeRespuesta: false, cantadoPorMi: true, cantadoPorMiEquipo: true, personajeQueCanto: 'gaucho' };
    estado.declaracionEnvido = escena === 'esperando-declaracion'
      ? { esMiTurno: false, maximoDeclarado: { puntos: -1 }, puedoMostrar: false, misPuntos: 27 }
      : { esMiTurno: true, maximoDeclarado: { puntos: escena === 'declarar-van' ? 24 : -1 }, puedoMostrar: true, misPuntos: 27 };
  }

  if (cfg.modo === '1v1') {
    return { ...estado, nombreRival: cfg.rivales[0], cartasRivalEnMano: 3 - nRivales, jugadasRival: jugadasDe(nRivales) };
  }
  return {
    ...estado,
    companeros: idsCompas.map((id, i) => jugadorFoto(cfg.compas[i] || `Compa ${i + 1}`, id, jugadasDe(nCompas), 3 - nCompas)),
    rivales: idsRivales.map((id, i) => jugadorFoto(cfg.rivales[i] || `Rival ${i + 1}`, id, jugadasDe(nRivales), 3 - nRivales)),
  };
}
