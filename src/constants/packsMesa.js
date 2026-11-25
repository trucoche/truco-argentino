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
// `anclas` (Pase 750) = dónde se apoya el adorno, igual que en la app (constants/packs.ts). Son el CENTRO en píxeles de la imagen de la mesa:
// uno = 1v1 en el celular (imagen 840x919), dos = 2v2 y tres = 3v3 en el celular (imagen 800x1000); `der` = lado derecho e `izq` = lado izquierdo (imagen espejada).
export const PACKS = {
  'la-pulperia': {
    id: 'la-pulperia', nombre: 'La Pulpería',
    adorno: { nombre: 'Picada', tipo: 'ciclo', estados: 4, brillo: false, sonido: null },
    dorso: 'pack-la-pulperia',   // Pase 763: public/assets/personalizacion-opt/cartas/pack-la-pulperia/
    anclas: { uno: { der: [718, 514], izq: [120, 516] }, dos: { der: [670, 658], izq: [135, 658] }, tres: { der: [655, 680], izq: [150, 680] } },
    // Pase 752: escritorio por modo (uno = 1v1, dos = 2v2, tres = 3v3): fracciones de la mesa visible; lo que falte usa POS_ADORNO
    escritorio: { tres: { der: [0.85, 0.475], izq: [0.15, 0.475] } },
  },
  'noche-camperal': {
    id: 'noche-camperal', nombre: 'Noche Camperal',
    adorno: { nombre: 'Farol', tipo: 'alternar', estados: 2, brillo: true, sonido: null },
    anclas: { uno: { der: [733, 464], izq: [105, 465] }, dos: { der: [660, 648], izq: [138, 648] }, tres: { der: [606, 681], izq: [192, 681] } },
    escritorio: {
      uno: { tam: 0.18, der: [0.83, 0.35], izq: [0.17, 0.35] },
      dos: { der: [0.75, 0.425], izq: [0.25, 0.425] },
      tres: { der: [0.81, 0.44], izq: [0.19, 0.44] },
    },
    dorso: 'pack-noche-camperal',   // Pase 751: carpeta public/assets/personalizacion-opt/cartas/<dorso>/ (abanicos)
  },
  'pampa-y-patria': {
    id: 'pampa-y-patria', nombre: 'Pampa y Patria',
    adorno: { nombre: 'Mate', tipo: 'ciclo', estados: 3, brillo: false, sonido: 'sorbo-mate.mp3' },
    anclas: { uno: { der: [699, 482], izq: [141, 481] }, dos: { der: [671, 667], izq: [143, 667] }, tres: { der: [658, 675], izq: [156, 675] } },
    escritorio: { uno: { der: [0.815, 0.395], izq: [0.185, 0.395] }, dos: { der: [0.80, 0.41], izq: [0.20, 0.41] } },
    dorso: 'pack-pampa-y-patria',
  },
};

// Tamaño del adorno (lado, como fracción del ancho de la mesa visible) en cada tipo de mesa y, en escritorio, dónde se apoya
// (fracciones de la mesa visible: x e y del CENTRO, `der` / `izq`). Se afinan mirando la galería.
// vertical = 2v2/3v3 en el celular, redonda = 1v1 en el celular, oval = 1v1/2v2 en escritorio, tresVsTres = 3v3 en escritorio.
export const POS_ADORNO = {
  vertical:   { tam: 0.19 },
  redonda:    { tam: 0.22 },
  oval:       { tam: 0.15, der: [0.83, 0.452], izq: [0.17, 0.452] },
  tresVsTres: { tam: 0.13, der: [0.80, 0.45], izq: [0.20, 0.45] },
};

// Lado donde va el adorno: 'derecha' (por defecto) o 'izquierda' (la imagen se da vuelta, efecto espejo). Se guarda en el navegador.
export const CLAVE_LADO_ADORNO = 'tc_pack_lado';
export function leerLadoAdorno() {
  try { return window.localStorage.getItem(CLAVE_LADO_ADORNO) === 'izquierda' ? 'izquierda' : 'derecha'; } catch (e) { return 'derecha'; }
}
export function guardarLadoAdorno(lado) {
  try { window.localStorage.setItem(CLAVE_LADO_ADORNO, lado === 'izquierda' ? 'izquierda' : 'derecha'); } catch (e) { /* sin almacenamiento */ }
}

export const rutaPack = (id, archivo) => `assets/images/packs/${id}/${archivo}`;

export const packPorId = (id) => (id && id !== 'ninguno' && PACKS[id]) || null;

export function leerPackMesa() {
  try { const v = window.localStorage.getItem(CLAVE_PACK_MESA); return IDS_PACK.includes(v) ? v : 'ninguno'; } catch (e) { return 'ninguno'; }
}

export function guardarPackMesa(id) {
  try { window.localStorage.setItem(CLAVE_PACK_MESA, IDS_PACK.includes(id) ? id : 'ninguno'); } catch (e) { /* sin almacenamiento */ }
}

// Pack que se dibuja en la mesa de este usuario. Por ahora solo los admins (prueba); más adelante: el pack equipado desde la tienda.
// En la mesa simulada de la galería (/?preview=...) App.js no restaura la sesión y `usuario` llega vacío: ahí se lee el usuario guardado del navegador.
export function packParaUsuario(usuario) {
  let u = usuario;
  if (!u) {
    try { u = JSON.parse(window.localStorage.getItem('truco_usuario') || 'null'); } catch (e) { u = null; }
  }
  if (!u || u.rol !== 'admin') return null;
  return packPorId(leerPackMesa());
}
