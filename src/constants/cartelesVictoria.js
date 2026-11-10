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
  { id: 'pulperia', nombre: 'La Pulpería', cuadros: cuadros('pulperia', 3), secuencia: [0, 1, 2, 1], suave: true, escalaTitulo: 0.82, proporcion: 2, intervaloMs: 650, colorTitulo: '#FFD98A', colorDetalle: '#F1D9A8' },
];

export const cartelVictoriaPorId = (id) => CARTELES_VICTORIA.find((c) => c.id === id) || CARTELES_VICTORIA[0];

// Pase 712: carteles de la pantalla de derrota ("PERDISTE"). Mismo formato que los de victoria; los cuadros viven en
// public/assets/images/juego/cartel-derrota/<id>-<n>.png (400×200, panel SIN texto).
const RUTA_DERROTA = 'assets/images/juego/cartel-derrota';
const cuadrosDerrota = (id, cantidad) => Array.from({ length: cantidad }, (_, i) => ({ clave: `cartelDerrota_${id}_${i + 1}`, ruta: `${RUTA_DERROTA}/${id}-${i + 1}.png` }));

export const CARTELES_DERROTA = [
  { id: 'base', nombre: 'Luces apagadas', cuadros: cuadrosDerrota('base', 2), proporcion: 2, intervaloMs: 700, colorTitulo: '#F27A5E', colorDetalle: '#F1D9A8' },
];

export const cartelDerrotaPorId = (id) => CARTELES_DERROTA.find((c) => c.id === id) || CARTELES_DERROTA[0];
