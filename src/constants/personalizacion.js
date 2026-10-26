// src/constants/personalizacion.js
// Pase 521: catálogo de personalización cosmética de la cuenta (versión web, mismo criterio que
// trucoche_app/constants/personalizacion.ts). Los PNG optimizados están en
// public/assets/personalizacion-opt/ (la carpeta public/assets/personalizacion/ son los originales pesados).
//   anillos/anillo_<id>.png 480×480 · banners/banner_<id>.png 480×230 · cartas/<id>/back.png 400 px de ancho.
// `hueco` = diámetro de la abertura del aro / ancho del PNG. Precio / rangoMin / soloSponsor: listos para la Tienda.

const BASE = (process.env.PUBLIC_URL || '') + '/assets/personalizacion-opt';
const LIBRE = { precio: 0, rangoMin: null, soloSponsor: false };
const KIT = { ...LIBRE, soloKit: true };   // Pase 523: exclusivo del Kit de Fundador/Beta Tester
const SPONSOR = { ...LIBRE, soloSponsor: true };   // Pase 563: solo quien donó en Cafecito (usuario.es_sponsor)
// Pase 628: set "Sol de Mayo": se desbloquea por el mayor rango alcanzado en la Liga (usuario.rango_max): dorso Gaucho (4), banner Caudillo (8), anillo Martín Fierro (10).

// Pase 630: `escalaHeader` = cuánto se agranda el anillo cuando se dibuja ENCIMA del panel del rango en el header (el aro de madera del Sol de Mayo
// es más chico que el lienzo por los laureles y dejaba ver el aro dorado de atrás). Solo lo usa el header; en el resto de las pantallas el anillo va solo.
export const ANILLOS = [
  { id: 'rango', nombre: 'Anillo de rango', imagen: null, hueco: null, ...LIBRE },
  { id: 'cafecito', nombre: 'Sponsor Criollo', imagen: BASE + '/anillos/anillo_cafecito.png', hueco: 0.677, ...SPONSOR },
  { id: 'tester', nombre: 'Beta Tester', imagen: BASE + '/anillos/anillo_tester.png', hueco: 0.635, ...KIT },
  { id: 'pionero', nombre: 'Sol de Mayo', imagen: BASE + '/anillos/anillo_pionero.webp', hueco: 0.547, escalaHeader: 1.25, ...LIBRE, rangoMin: 10 },
];

export const BANNERS = [
  { id: 'base', nombre: 'Madera clásica', imagen: BASE + '/banners/banner_base.png', proporcion: 480 / 230, margenInterior: { x: 0.075, y: 0.13 }, ...LIBRE },
  { id: 'cafecito', nombre: 'Sponsor Criollo', imagen: BASE + '/banners/banner_cafecito.png', proporcion: 480 / 230, margenInterior: { x: 0.075, y: 0.13 }, ...SPONSOR },
  { id: 'tester', nombre: 'Beta Tester', imagen: BASE + '/banners/banner_tester.png', proporcion: 480 / 230, margenInterior: { x: 0.075, y: 0.13 }, ...KIT },
  { id: 'pionero', nombre: 'Sol de Mayo', imagen: BASE + '/banners/banner_pionero.webp', proporcion: 840 / 400, margenInterior: { x: 0.075, y: 0.13 }, ...LIBRE, rangoMin: 8 },
];

export const MAZOS = [
  { id: 'base', nombre: 'Mazo TrucoChe', dorso: BASE + '/cartas/base/back.png', proporcionDorso: 400 / 552, ...LIBRE },
  { id: 'cafecito', nombre: 'Sponsor Criollo', dorso: BASE + '/cartas/cafecito/back.png', proporcionDorso: 400 / 552, ...SPONSOR },
  { id: 'tester', nombre: 'Beta Tester', dorso: BASE + '/cartas/tester/back.png', proporcionDorso: 400 / 552, ...KIT },
  { id: 'pionero', nombre: 'Sol de Mayo', dorso: BASE + '/cartas/pionero/back.png', proporcionDorso: 400 / 552, ...LIBRE, rangoMin: 4 },
];

// Pase 578: marco de madera SIN el tablón del medio (Pase 533 de la app). Con una foto de fondo propia, la foto va atrás de este marco.
export const BANNER_MARCO_SIN_TABLON = BASE + '/banners/banner_marco.png';

export const PERSONALIZACION_POR_DEFECTO = { anillo_id: 'rango', banner_id: 'base', mazo_id: 'base' };

export const anilloPorId = (id) => ANILLOS.find(a => a.id === id) || ANILLOS[0];
export const bannerPorId = (id) => BANNERS.find(b => b.id === id) || BANNERS[0];
export const mazoPorId = (id) => MAZOS.find(m => m.id === id) || MAZOS[0];

// Disponible = no es del kit (o la cuenta lo tiene) y no es de sponsors (o la cuenta donó). El backend vuelve a validar.
export const estaDisponible = (item, ctx) =>
  !(item.soloKit && !(ctx && ctx.kitFundador)) && !(item.soloSponsor && !(ctx && ctx.esSponsor)) && !(item.rangoMin && !((ctx && ctx.rangoId) >= item.rangoMin));

// Anillo a dibujar alrededor de un avatar: el elegido o el de su rango (`rangoAssets` = { anillo, hueco }).
export const resolverAnillo = (anilloId, rangoAssets) => {
  const a = anilloPorId(anilloId);
  return a.imagen && a.hueco ? { imagen: a.imagen, hueco: a.hueco, escala: a.escalaHeader || 1 } : { imagen: rangoAssets.anillo, hueco: rangoAssets.hueco, escala: 1 };
};
