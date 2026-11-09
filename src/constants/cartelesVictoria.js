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
];

export const cartelVictoriaPorId = (id) => CARTELES_VICTORIA.find((c) => c.id === id) || CARTELES_VICTORIA[0];
