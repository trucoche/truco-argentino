// src/constants/cartelesVictoria.js
// Pase 708: carteles de la pantalla de victoria ("¡GANASTE!"). Cada cartel es una lista de cuadros PNG que se alternan para dar
// sensación de animación (las luces del panel "cambian de color"). Mismo catálogo que trucoche_app/constants/cartelesVictoria.ts.
//
// Para sumar el cartel de un pack: dejar los cuadros en public/assets/images/juego/cartel-victoria/<id>-<n>.png (400×200, panel de
// madera SIN texto: el texto lo pone el juego encima) y agregar UNA entrada abajo. `intervaloMs` = cuánto dura cada cuadro.
// `colorTitulo` / `colorDetalle` = colores del texto sobre ese panel.
const RUTA = 'assets/images/juego/cartel-victoria';

const cuadros = (id, cantidad) => Array.from({ length: cantidad }, (_, i) => ({ clave: `cartelVictoria_${id}_${i + 1}`, ruta: `${RUTA}/${id}-${i + 1}.png` }));

export const CARTELES_VICTORIA = [
  { id: 'base', nombre: 'Luces de fiesta', cuadros: cuadros('base', 2), proporcion: 2, intervaloMs: 550, colorTitulo: '#FFD98A', colorDetalle: '#F1D9A8' },
  // Pase 715: La Pulpería (3 cuadros: farol izquierdo, ambos, farol derecho). `secuencia` = orden de los cuadros (opcional): 1-2-3-2 va y vuelve.
  { id: 'pulperia', nombre: 'La Pulpería', cuadros: cuadros('pulperia', 3), secuencia: [0, 1, 2, 1], suave: true, escalaTitulo: 0.82, textoDy: 0.08, proporcion: 2, intervaloMs: 650, colorTitulo: '#FFD98A', colorDetalle: '#F1D9A8' },
  // Pase 741/742: Noche Camperal (fogata; 5 cuadros). Cuadro base (2) siempre opaco; la secuencia pasa siempre por él (inclinada → base → recta → base ...) para que la llama se funda sin saltar. `textoDy` negativo sube el texto.
  { id: 'noche-camperal', nombre: 'Noche Camperal', cuadros: cuadros('noche-camperal', 5), secuencia: [0, 1, 3, 1, 4, 1, 2, 1], suave: true, escalaTitulo: 0.88, textoDy: -0.04, proporcion: 2, intervaloMs: 450, colorTitulo: '#FFD98A', colorDetalle: '#F1D9A8' },
  // Pase 743: Pampa y Patria (sol de mayo; el brillo recorre el panel de izquierda a derecha: 1 = izquierda, 2 = sobre el sol, 3 = derecha). Cuadro 2 fijo debajo; [0,1,2] da la vuelta.
  { id: 'pampa-y-patria', nombre: 'Pampa y Patria', cuadros: cuadros('pampa-y-patria', 3), secuencia: [0, 1, 2], suave: true, escalaTitulo: 0.95, textoDy: 0.025, proporcion: 2, intervaloMs: 650, colorTitulo: '#FFD98A', colorDetalle: '#F1D9A8' },
];

export const cartelVictoriaPorId = (id) => CARTELES_VICTORIA.find((c) => c.id === id) || CARTELES_VICTORIA[0];

// Pase 712: carteles de la pantalla de derrota ("PERDISTE"). Mismo formato que los de victoria; los cuadros viven en
// public/assets/images/juego/cartel-derrota/<id>-<n>.png (400×200, panel SIN texto).
const RUTA_DERROTA = 'assets/images/juego/cartel-derrota';
const cuadrosDerrota = (id, cantidad) => Array.from({ length: cantidad }, (_, i) => ({ clave: `cartelDerrota_${id}_${i + 1}`, ruta: `${RUTA_DERROTA}/${id}-${i + 1}.png` }));

export const CARTELES_DERROTA = [
  { id: 'base', nombre: 'Luces apagadas', cuadros: cuadrosDerrota('base', 2), proporcion: 2, intervaloMs: 700, colorTitulo: '#F27A5E', colorDetalle: '#F1D9A8' },
  // Pase 717: La Pulpería (faroles apagados con humo). El panel está más abajo en el lienzo (el humo ocupa arriba): `textoDy` baja el texto.
  { id: 'pulperia', nombre: 'La Pulpería', cuadros: cuadrosDerrota('pulperia', 3), secuencia: [0, 1, 2, 1], suave: true, escalaTitulo: 0.75, textoDy: 0.15, proporcion: 2, intervaloMs: 800, colorTitulo: '#F27A5E', colorDetalle: '#F1D9A8' },
  // Pase 741: Noche Camperal (brasas que se apagan; 3 cuadros 1-2-3-2).
  { id: 'noche-camperal', nombre: 'Noche Camperal', cuadros: cuadrosDerrota('noche-camperal', 3), secuencia: [0, 1, 2, 1], suave: true, escalaTitulo: 0.88, textoDy: -0.04, proporcion: 2, intervaloMs: 800, colorTitulo: '#F27A5E', colorDetalle: '#F1D9A8' },
  // Pase 743: Pampa y Patria (panel gris; el brillo recorre de izquierda a derecha: 1 = izquierda, 2 = sin brillo, 3 = derecha).
  { id: 'pampa-y-patria', nombre: 'Pampa y Patria', cuadros: cuadrosDerrota('pampa-y-patria', 3), secuencia: [0, 1, 2, 1], suave: true, escalaTitulo: 0.95, textoDy: 0.025, proporcion: 2, intervaloMs: 800, colorTitulo: '#F27A5E', colorDetalle: '#F1D9A8' },
];

export const cartelDerrotaPorId = (id) => CARTELES_DERROTA.find((c) => c.id === id) || CARTELES_DERROTA[0];

// Pase 768: cartel de la pantalla final según lo que cada jugador equipó en "Mi mesa" (el servidor manda `cartel_id` = id del pack en cada jugador de la lista final).
// Victoria: el cartel del equipo ganador (el mío primero, después el de mis compañeros); derrota: el propio. Sin cartel equipado queda el de siempre ('base').
const CARTEL_DE_PACK = { 'la-pulperia': 'pulperia' };
export function cartelFinalDe(jugadores, miUsername, modo) {
  const lista = Array.isArray(jugadores) ? jugadores : [];
  const mio = lista.find((j) => j && j.nombre === miUsername);
  const ids = modo === 'derrota'
    ? [mio]
    : [mio, ...lista.filter((j) => j && j.gano && j !== mio)];
  const hallado = ids.find((j) => j && j.cartel_id);
  if (!hallado) return 'base';
  const id = CARTEL_DE_PACK[hallado.cartel_id] || hallado.cartel_id;
  return CARTELES_VICTORIA.some((c) => c.id === id) ? id : 'base';
}
