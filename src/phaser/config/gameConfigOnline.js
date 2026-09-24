import Phaser from 'phaser';

// El mundo lógico del juego sigue siendo 800x600 (todas las coordenadas
// hardcodeadas de GameSceneOnline.js — mesa, cartas, botones, banners —
// siguen pensadas para ese sistema, sin tocar ninguna). Lo que cambia acá
// es la RESOLUCIÓN REAL del canvas (el "backing store" que WebGL usa para
// dibujar), que hasta ahora quedaba fija en 800x600 sin importar qué tan
// grande se mostrara en pantalla.
//
// Diagnóstico (confirmado con un harness de prueba Phaser+Playwright):
// `render.resolution`/`scale.resolution` NO tienen efecto real en este modo
// de escala (Scale.FIT + max) en esta versión de Phaser (3.88) — es una
// limitación conocida y documentada de Phaser 3, no un error de config
// nuestro (ver https://phaser.discourse.group/t/settings-for-crisp-rendering/10000
// y el issue https://github.com/phaserjs/phaser/issues/3198). El canvas
// quedaba siempre en 800x600 de resolución real, y el NAVEGADOR estiraba
// ese bitmap chico hasta el tamaño CSS que calcula FIT (hasta 1200x900) —
// ahí aparece el blur/pixelado que se ve en TODO lo que dibuja el canvas
// por igual (fondo, mesa, cartas, botones), mientras que elementos HTML
// superpuestos (el chat, por ejemplo) se ven nítidos porque no pasan por
// ese estiramiento.
//
// Fix: en vez de depender de `resolution` (que no funciona), directamente
// pedimos que el canvas RENDERICE al tamaño máximo que FIT puede llegar a
// mostrar (1200x900, multiplicado por devicePixelRatio para pantallas
// retina) — así el navegador nunca necesita agrandar el bitmap, como mucho
// lo reduce un poco en pantallas más chicas que el máximo, lo cual nunca
// da blur. La contrapartida (que las coordenadas de juego sigan siendo
// 800x600 sin cambiar nada) se resuelve en GameSceneOnline.js con un zoom
// de cámara — ver el comentario en su create().
// Undécimo pase: el usuario probó el juego real con el tope anterior
// (1200x900) y reportó que ocupaba casi toda la pantalla y se sentía
// "muy grande" — se bajó a 900x675 (misma proporción 4:3) a pedido suyo.
// Se exportan estas dos constantes (antes solo vivían acá, hardcodeadas
// de nuevo como literales en GameSceneOnline.js) para que el zoom de
// cámara y el factor de pre-escalado de texturas las importen en vez de
// repetir el número a mano — el bug del noveno/décimo pase (el zoom real
// se editó acá pero el factor de textura en el otro archivo se quedó con
// el valor viejo) fue exactamente este tipo de desincronización.
// Decimotercer pase: 900x675 resultó "muy chico" al probarlo — el usuario
// eligió un punto intermedio, más cerca del tope grande original (1200x900)
// pero no igual, para no volver al problema de "ocupa casi toda la
// pantalla". Misma proporción 4:3 de siempre.
const DPR = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
export const ANCHO_MAX_CSS = 1100;
export const ALTO_MAX_CSS = 825;

const gameConfigOnline = {
  type: Phaser.AUTO,
  width: ANCHO_MAX_CSS * DPR,
  height: ALTO_MAX_CSS * DPR,
  parent: 'game-container',
  scene: [],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    zoom: 1,
    max: {
      width: ANCHO_MAX_CSS,
      height: ALTO_MAX_CSS
    }
  },
render: {
  antialias: true,
  antialiasGL: true,
  roundPixels: true,
  mipmapFilter: 'LINEAR_MIPMAP_LINEAR'
},
  backgroundColor: '#2d2d2d'
};

export default gameConfigOnline;