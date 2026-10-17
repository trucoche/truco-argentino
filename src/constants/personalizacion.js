// src/constants/personalizacion.js
// Pase 521: catálogo de personalización cosmética de la cuenta (versión web, mismo criterio que
// trucoche_app/constants/personalizacion.ts). Los PNG optimizados están en
// public/assets/personalizacion-opt/ (la carpeta public/assets/personalizacion/ son los originales pesados).
//   anillos/anillo_<id>.png 480×480 · banners/banner_<id>.png 480×230 · cartas/<id>/back.png 400 px de ancho.
// `hueco` = diámetro de la abertura del aro / ancho del PNG. Precio / rangoMin / soloSponsor: listos para la Tienda.

const BASE = (process.env.PUBLIC_URL || '') + '/assets/personalizacion-opt';
const LIBRE = { precio: 0, rangoMin: null, soloSponsor: false };

export const ANILLOS = [
  { id: 'rango', nombre: 'Anillo de rango', imagen: null, hueco: null, ...LIBRE },
  { id: 'cafecito', nombre: 'Sponsor Criollo', imagen: BASE + '/anillos/anillo_cafecito.png', hueco: 0.677, ...LIBRE },
  { id: 'tester', nombre: 'Beta Tester', imagen: BASE + '/anillos/anillo_tester.png', hueco: 0.635, ...LIBRE },
];

export const BANNERS = [
  { id: 'base', nombre: 'Madera clásica', imagen: BASE + '/banners/banner_base.png', proporcion: 480 / 230, margenInterior: { x: 0.075, y: 0.13 }, ...LIBRE },
  { id: 'cafecito', nombre: 'Sponsor Criollo', imagen: BASE + '/banners/banner_cafecito.png', proporcion: 480 / 230, margenInterior: { x: 0.075, y: 0.13 }, ...LIBRE },
  { id: 'tester', nombre: 'Beta Tester', imagen: BASE + '/banners/banner_tester.png', proporcion: 480 / 230, margenInterior: { x: 0.075, y: 0.13 }, ...LIBRE },
];

export const MAZOS = [
  { id: 'base', nombre: 'Mazo TrucoChe', dorso: BASE + '/cartas/base/back.png', proporcionDorso: 400 / 552, ...LIBRE },
  { id: 'cafecito', nombre: 'Sponsor Criollo', dorso: BASE + '/cartas/cafecito/back.png', proporcionDorso: 400 / 552, ...LIBRE },
  { id: 'tester', nombre: 'Beta Tester', dorso: BASE + '/cartas/tester/back.png', proporcionDorso: 400 / 552, ...LIBRE },
];

export const PERSONALIZACION_POR_DEFECTO = { anillo_id: 'rango', banner_id: 'base', mazo_id: 'base' };

export const anilloPorId = (id) => ANILLOS.find(a => a.id === id) || ANILLOS[0];
export const bannerPorId = (id) => BANNERS.find(b => b.id === id) || BANNERS[0];
export const mazoPorId = (id) => MAZOS.find(m => m.id === id) || MAZOS[0];

// Hoy todo está disponible; la Tienda futura completará la lógica (precio / rango / sponsor) acá.
export const estaDisponible = () => true;
