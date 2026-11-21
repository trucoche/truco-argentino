// constants/packsMesa.js
// Pase 747: packs de la tienda conectados en la WEB (misma idea que constants/packs.ts de la app, Pase 745): paño de la mesa, marcador y adorno
// interactivo. Los archivos viven en public/assets/images/packs/<pack>/ (webp ya recortados a las medidas de las mesas de siempre):
//   mesa-vertical.webp  800x1000  → 2v2 y 3v3 en el celular   (reemplaza mesa-equipos-app.webp)
//   mesa-redonda.webp   840x919   → 1v1 en el celular          (reemplaza mesa-1v1-app.webp)
//   mesa-oval.webp      1169x895  → 1v1 y 2v2 en escritorio    (reemplaza mesa-truco-nueva.webp)
//   mesa-3v3.webp       1200x2160 → 3v3 en escritorio          (reemplaza mesa-truco-3v3.webp, misma zona de recorte)
//   marcador-1..5.webp  256x256   → cuadritos del marcador de fósforos (reemplazan los fósforos de siempre)
//   adorno-N.webp       256x256   → estados del adorno interactivo (+ sonido opcional)
// Todavía NO se compran ni se equipan desde la tienda: por ahora el pack se elige en la Galería de la web (solo admin) y se guarda en el navegador.
// Con 'ninguno' (o sin ser admin) el juego se ve exactamente como siempre.

export const IDS_PACK = ['ninguno', 'la-pulperia', 'noche-camperal', 'pampa-y-patria'];
export const CLAVE_PACK_MESA = 'tc_pack_mesa';

// Adorno interactivo: 'ciclo' = cada toque pasa al estado siguiente (y del último vuelve al primero); 'alternar' = cambia entre dos estados.
export const PACKS = {
  'la-pulperia': {
    id: 'la-pulperia', nombre: 'La Pulpería',
    adorno: { nombre: 'Picada', tipo: 'ciclo', estados: 4, brillo: false, sonido: null },
  },
  'noche-camperal': {
    id: 'noche-camperal', nombre: 'Noche Camperal',
    adorno: { nombre: 'Farol', tipo: 'alternar', estados: 2, brillo: true, sonido: null },
  },
  'pampa-y-patria': {
    id: 'pampa-y-patria', nombre: 'Pampa y Patria',
    adorno: { nombre: 'Mate', tipo: 'ciclo', estados: 3, brillo: false, sonido: 'sorbo-mate.mp3' },
  },
};

// Posición del adorno en cada tipo de mesa: x e y = CENTRO del adorno como fracción de la mesa visible; tam = lado como fracción del ancho de la mesa.
// vertical = 2v2/3v3 en el celular, redonda = 1v1 en el celular, oval = 1v1/2v2 en escritorio, tresVsTres = 3v3 en escritorio. Se afinan mirando la galería.
export const POS_ADORNO = {
  vertical:   { x: 0.22, y: 0.57, tam: 0.17 },   // mismos valores que la app (ADORNO_PACK_POS)
  redonda:    { x: 0.17, y: 0.44, tam: 0.17 },
  oval:       { x: 0.17, y: 0.30, tam: 0.12 },
  tresVsTres: { x: 0.16, y: 0.62, tam: 0.12 },
};

export const rutaPack = (id, archivo) => `assets/images/packs/${id}/${archivo}`;

export const packPorId = (id) => (id && id !== 'ninguno' && PACKS[id]) || null;

export function leerPackMesa() {
  try { const v = window.localStorage.getItem(CLAVE_PACK_MESA); return IDS_PACK.includes(v) ? v : 'ninguno'; } catch (e) { return 'ninguno'; }
}

export function guardarPackMesa(id) {
  try { window.localStorage.setItem(CLAVE_PACK_MESA, IDS_PACK.includes(id) ? id : 'ninguno'); } catch (e) { /* sin almacenamiento */ }
}

// Pack que se dibuja en la mesa de este usuario. Por ahora solo los admins (prueba); más adelante: el pack equipado desde la tienda.
export function packParaUsuario(usuario) {
  if (!usuario || usuario.rol !== 'admin') return null;
  return packPorId(leerPackMesa());
}
