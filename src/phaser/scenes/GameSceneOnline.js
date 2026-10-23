import Phaser from 'phaser';
import { getSocket } from '../../services/socket';
import { ANCHO_MAX_CSS } from '../config/gameConfigOnline';
import { CARD_RANKS } from '../utils/constants';
import { RANGOS_UI } from '../../components/Perfil/rangosUi';
import { MAZOS } from '../../constants/personalizacion';
import { crearEstadoFoto, getConfigFoto } from '../../constants/modoFoto';

// Decimotercer pase: bug de fondo detrás de "el dorso del rival sigue
// borroso aunque Ctrl+Shift+R en Edge" — el navegador cachea las imágenes
// que carga `this.load.image()` por su URL exacta (misma carpeta pública,
// nombre de archivo fijo: `assets/images/juego/.../back.png`), y ese cache
// puede sobrevivir incluso a un "hard reload" en algunos casos (proxies,
// service workers de otras extensiones, configuraciones de Edge). Como
// `back.png` se reemplazó varias veces esta sesión (dorso viejo → nuevo
// diseño → fix de color) bajo el MISMO nombre de archivo, el navegador de
// algunos usuarios puede haber quedado mostrando una versión vieja — mientras
// que las cartas de frente, que no cambiaron de contenido esta sesión, se
// ven bien aunque estén cacheadas, porque lo cacheado ya coincide con lo
// actual. Fix estructural (no un parche puntual): un parámetro `?v=` en la
// URL de cada imagen, con un valor que cambia en cada carga de página — así
// el navegador nunca puede reusar una respuesta vieja para una URL "nueva",
// sin necesidad de que el usuario sepa limpiar cachés a mano nunca más.
// Pase 547: en producción (Vercel) la versión es el commit del deploy (estable entre visitas: el navegador
// reutiliza las imágenes y sonidos ya descargados en vez de bajar ~25 MB en cada carga de página — era
// lo que hacía lentísimo crear la sala en el celular). En desarrollo / build local sigue siendo Date.now().
const ASSET_VERSION = process.env.REACT_APP_VERCEL_GIT_COMMIT_SHA || Date.now();
const conVersion = (ruta) => `${ruta}?v=${ASSET_VERSION}`;

// Pase 457: margen interno mínimo (px) entre el borde de la placa de fósforos y los cuadritos, para no chocar con los remaches dorados.
const MARGEN_INTERNO_FOS = 12;

function proximoNivelTruco(nivelActual) {
  const niveles = ['truco', 'retruco', 'vale-cuatro'];
  const idx = niveles.indexOf(nivelActual);
  return idx === -1 ? 'truco' : (idx < niveles.length - 1 ? niveles[idx + 1] : null);
}

// Rediseño de botonera (Fase 2, Canva): cada canto/respuesta ahora es una
// sola imagen con el texto ya "horneado" adentro por el diseñador — ver
// CLAVE_IMAGEN_BOTON más abajo y _dibujarBotonesCanto. "Tengo [puntos]"
// es un caso aparte: el número cambia en cada mano, así que no puede ser
// una imagen fija con el texto horneado — pero SÍ usa el mismo fondo
// ilustrado que el resto (una versión en blanco de la tablita de "Quiero",
// ver assets/images/juego/ui-botones-canva-final/Tengo.png), con el
// número dibujado encima en tiempo real (ver el branch `imagen && texto`
// de `_crearBoton`). Octogésimo sexto pase: hasta acá, "Tengo" era el
// único sobreviviente del pipeline viejo (3 slices de `boton_verde` +
// `MATERIAL_TEXTO`) — el usuario pidió específicamente sacarlo también,
// así que ese pipeline entero (material/boton_verde) se dio de baja, ver
// el comentario en preload() y en `_crearBoton`.

// Mapea cada identificador interno de canto/nivel/respuesta a la clave de
// archivo del botón-imagen correspondiente (ver
// assets/images/juego/ui-botones-canva-final/<clave>.png). "con-flor-me-achico"
// reusa a propósito el mismo archivo que "no-quiero" — decisión del
// usuario para no generar un botón extra con el mismo significado.
// Nonagésimo primer pase: el usuario completó el set — ya llegaron
// Truco/Retruco/ValeCuatro/Envido/RealEnvido/FaltaEnvido/Quiero/NoQuiero/
// SonBuenas/IrAlMazo/ContraFlor/ContraFlorResto con su texto ya horneado
// en el mismo estilo píldora/sticker que las 3 píldoras genéricas del
// pase anterior — así que se vuelve al criterio original (una imagen
// propia por acción, sin texto dibujado por código encima) y se da de
// baja el mapa TEXTO_BOTON_PILDORA/el ensanchado-por-texto de
// `specImagen` que existían solo para tapar la falta de esas imágenes.
// Las píldoras genéricas (PillVerde/PillRoja/PillAmarilla) quedan sin
// uso pero no se borraron del repo (mismo criterio de no eliminar
// assets superados que ya se usa con panel-puntaje-cuero.png). 'flor'
// sigue con su tablita vieja — no llegó un asset nuevo para esa.
const CLAVE_IMAGEN_BOTON = {
  'truco': 'Truco',
  'retruco': 'Retruco',
  'vale-cuatro': 'ValeCuatro',
  'envido': 'Envido',
  'real-envido': 'RealEnvido',
  'falta-envido': 'FaltaEnvido',
  'flor': 'Flor',
  'contra-flor': 'ContraFlor',
  'contra-flor-resto': 'ContraFlorResto',
  'quiero': 'Quiero',
  'no-quiero': 'NoQuiero',
  'con-flor-me-achico': 'NoQuiero',
  'son-buenas': 'SonBuenas',
  'ir-al-mazo': 'IrAlMazo',
};

// Pase 406: botonera de cantos "RusticWoodButtons" — reemplaza las píldoras
// (PNG con texto horneado) por tablitas de madera dibujadas por código:
// 'claro' = pergamino/madera clara con marco de roble (Envido/Real/Falta y
// familia de Flor), 'oro' = placa dorada/caoba (Truco/Retruco/Vale Cuatro),
// 'caoba' = bronce oscuro (Quiero), 'carmesi' = madera rojiza (Ir al Mazo,
// No quiero). La clave es la MISMA de CLAVE_IMAGEN_BOTON (así la lógica de
// qué botón se muestra no cambia). "Tengo [N]" sigue con su imagen.
const BOTON_RUSTICO = {
  Truco: { txt: 'TRUCO', v: 'oro' },
  Retruco: { txt: 'RETRUCO', v: 'oro' },
  ValeCuatro: { txt: 'VALE CUATRO', v: 'oro' },
  Envido: { txt: 'ENVIDO', v: 'claro' },
  RealEnvido: { txt: 'REAL ENVIDO', v: 'claro' },
  FaltaEnvido: { txt: 'FALTA ENVIDO', v: 'claro' },
  Flor: { txt: 'FLOR', v: 'claro' },
  ContraFlor: { txt: 'CONTRAFLOR', v: 'claro' },
  ContraFlorResto: { txt: 'CONTRAFLOR AL RESTO', v: 'claro' },
  SonBuenas: { txt: 'SON BUENAS', v: 'claro' },
  Quiero: { txt: 'QUIERO', v: 'caoba' },
  NoQuiero: { txt: 'NO QUIERO', v: 'carmesi' },
  IrAlMazo: { txt: 'IR AL MAZO', v: 'carmesi' },
};
const VARIANTES_RUSTICAS = {
  claro:   { marco: 0x7a4a24, marcoLuz: 0xb98350, campo: 0xf0dcae, campoLuz: 0xfcefcf, campoSombra: 0xc79f62, texto: '#3a1b0c', grabado: true,  prof: 0.10 },
  oro:     { marco: 0x4a2412, marcoLuz: 0x9a5e2c, campo: 0xe3a92e, campoLuz: 0xfad46c, campoSombra: 0xa56a16, texto: '#fff3c4', grabado: false, prof: 0.14 },
  caoba:   { marco: 0x3a1c10, marcoLuz: 0x7e4e2c, campo: 0x8a4b2a, campoLuz: 0xb77041, campoSombra: 0x5a2c16, texto: '#ffe9c2', grabado: false, prof: 0.10 },
  esmeralda: { marco: 0x0d3b2c, marcoLuz: 0x2f8f6b, campo: 0x10b981, campoLuz: 0x5fe0b5, campoSombra: 0x065f46, texto: '#f0fff8', grabado: false, prof: 0.12 },
  apagado: { marco: 0x3a3a38, marcoLuz: 0x6a6a66, campo: 0x8a9488, campoLuz: 0xa9b3a7, campoSombra: 0x5f6b66, texto: '#dfe6dc', grabado: false, prof: 0.12 },
  oliva:   { marco: 0x26331a, marcoLuz: 0x5a7438, campo: 0x4f8a3a, campoLuz: 0x82bd5e, campoSombra: 0x2f5a22, texto: '#f4ffdc', grabado: false, prof: 0.10 },
  carmesi: { marco: 0x3a1010, marcoLuz: 0x7e2c24, campo: 0xb02a24, campoLuz: 0xdc564d, campoSombra: 0x7a1411, texto: '#ffe6d6', grabado: false, prof: 0.12 },
};
const RATIO_FUENTE_RUSTICO = 0.43;

export default class GameSceneOnline extends Phaser.Scene {

  constructor() {
    super('GameSceneOnline');
  }

  init(data) {
    this.usuario    = data.usuario;
    // Pase 394: layout vertical para ventanas angostas (<700px, ver GameOnlinePhaser.js).
    // `_L` (null en escritorio) concentra toda la geometria; cada cambio del
    // layout angosto esta condicionado a `this._L`, asi que en escritorio
    // nada cambia.
    this._angosto   = !!data.angosto;
    // Pase 404: estilo del marcador de las placas VOS/RIVAL ('numeros' | 'fosforos').
    this._marcadorEstilo = data.marcadorEstilo === 'fosforos' ? 'fosforos' : 'numeros';
    this._fosObjs = null;
    this._puntosPrevios = null;
    this._eqMap     = null;
    this._L         = null;
    this._modoCamara = null;
    this.codigoSala = data.codigoSala;
    this.estado     = null;
    this._sprites   = [];
    this._numeroRondaAnterior = undefined;
    this._mesaModoActual = null;
    // Pase 208 — pantalla de espera con avatares reales por jugador (pedido
    // del usuario, con una imagen de referencia armada con IA): se llenan
    // desde el evento 'jugador-unido' (ver _conectarSocket), que ahora manda
    // personaje/avatar_tipo/foto_perfil_url/modo/capacidadTotal además de
    // username/equipo (ver truco-backend/src/index.js).
    this._jugadoresSala = [];
    this._modoSala = null;
    this._capacidadSala = null;
    // Pase 374: datos de la mesa para la línea de modo del cartel de espera.
    this._puntosSala = null;
    this._rankedSala = false;
    this._privadaSala = false;
    this._torneoSala = false;
    this._avataresEsperaSprites = [];
    this._avataresEsperaTimers = [];
    this._filaEsperaGeneracion = 0;
    // Referencia del banner-título de la sala de espera (ver
    // _actualizarBannerEsperaTitulo) — reseteada acá por la misma razón que
    // _avataresEsperaSprites arriba: en un restart de escena (cambio de
    // codigoSala) el container viejo ya fue destruido por Phaser junto con
    // el resto de la escena anterior, no queremos arrastrar esa referencia.
    this._bannerEsperaTitulo = null;
    this._centroEspera = null;
    // Pase 210 — bug real reportado: para el ÚLTIMO jugador que entra, la
    // carga de imagen de un avatar de la sala de espera (async, ver
    // _redibujarFilaEspera) podía terminar DESPUÉS de que la partida ya
    // arrancó ('partida-iniciada' llega primero), y su callback de
    // "completó la carga" dibujaba un tile nuevo sobre la mesa ya visible
    // del juego real — el contador `_filaEsperaGeneracion` solo protege
    // contra OTRO _redibujarFilaEspera más nuevo, no contra el inicio de la
    // partida. Esta bandera es la protección real: se pone en `true` en el
    // handler de 'partida-iniciada' y en el modo preview (ver
    // _conectarSocket), y toda carga/dibujo de la fila de espera la chequea
    // antes de tocar la escena.
    this._salaEnJuego = false;
    // Volumen de las voces de los cantos, elegido por el usuario en el
    // panel de configuración de la partida (React lo sigue actualizando
    // directo sobre la instancia de la escena mientras juega, sin
    // reiniciarla — ver GameOnlinePhaser.js). 0.85 es el valor que ya
    // usaba el juego antes de que esto fuera configurable.
    this.vocesVolumen = data.vocesVolumen ?? 0.85;
    // Pase 580: volumen de efectos (multiplica el volumen de repartir / carta jugada / ganar). 1 = como antes.
    this.efectosVolumen = data.efectosVolumen ?? 1;
}

preload() {
    // La carpeta y extensión dependen de la preferencia de mazo guardada
    // en Configuración (mismo criterio y misma clave que PreloadScene.js).
    const barajaElegida = localStorage.getItem('truco_baraja') === 'nueva' ? 'nueva' : 'clasica';
    const carpetaCartas = barajaElegida === 'nueva' ? 'cartas-nuevas' : 'cartas-clasicas';
    // Pase siguiente — bug real encontrado (era justo lo que preguntó el
    // usuario): esta línea seguía pidiendo `.jpg` para el mazo clásico,
    // pero el usuario ya había convertido las 40 cartas clásicas a PNG con
    // bordes redondeados (y las puso en su lugar correcto,
    // `public/assets/images/juego/cartas-clasicas/`) — `PreloadScene.js`
    // ya se había arreglado para esto (ver su comentario, `extension =
    // 'png'` fijo), pero ESTA otra copia de la misma lógica, la que usa el
    // tablero real (`GameSceneOnline.js`, esta clase), se pasó por alto y
    // se quedó pidiendo `.jpg` para 'clasica' — el archivo que pedía no
    // existe más (404 silencioso de Phaser), así que esas cartas nunca se
    // veían en el tablero, aunque los PNG estuvieran bien puestos.
    // Pase 547: el mazo clásico se sirve en WebP (40 cartas: 22 MB de PNG -> ~1.7 MB, sin diferencia visible);
    // Pase 548: el mazo nuevo también se sirve en WebP (13 MB de PNG -> ~1.4 MB).
    const extensionCartas = 'webp';

    const palos   = ['oro', 'copa', 'espada', 'basto'];
    const valores = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
    palos.forEach(palo => {
      valores.forEach(valor => {
        this.load.image(`${valor}_${palo}`, conVersion(`assets/images/juego/${carpetaCartas}/${valor}_${palo}.${extensionCartas}`));
      });
    });
    // Igual que las cartas de frente: el dorso depende del mazo elegido.
    // Antes quedaba hardcodeado a cartas-clasicas sin importar el mazo —
    // un dorso nuevo puesto en cartas-nuevas/ nunca se veía. El archivo
    // siempre es .png en las tres carpetas de mazo (ver el fix de más
    // arriba en `extensionCartas` — ya no hay ninguna carpeta en .jpg).
    this.load.image('cardBack', conVersion(`assets/images/juego/${carpetaCartas}/back.${extensionCartas}`));
    const modoOscuro = localStorage.getItem('truco_modo_oscuro') === 'true';
    // Nonagésimo cuarto pase: se guarda en la instancia para poder leerlo
    // después en `_crearElementosDeTexto` (ahí se decide si se dibuja o no
    // `luzCalidaMesa` — ver ese método) — `modoOscuro` acá arriba es una
    // const local de `preload()`, no sobrevive a otros métodos de la escena.
    this.modoOscuro = modoOscuro;
    // Decimoquinto pase: fondo de día nuevo (arte del usuario) — se guardó
    // como .jpg en vez de .png porque es una imagen "de foto" (sin
    // transparencia, degradados suaves de luz) que un códec con pérdida
    // comprime mucho mejor sin diferencia visible: la versión anterior en
    // PNG pesaba >1MB a 800x600; esta pesa ~190KB a 1800x1350 (más resolución
    // y más liviana a la vez).
    // Decimosexto pase: mismo criterio para el fondo de modo noche (arte
    // nuevo del usuario, misma composición pero de noche) — también a .jpg.
    // Pase 414: detras de la mesa vuelve el piso de tablas de la cantina (arte del usuario). La madera caoba
    // vertical queda SOLO en el contenedor externo de la pagina (ver GameOnlinePhaser.js).
    this.load.image('fondoMesa', conVersion(modoOscuro
      ? 'assets/images/juego/fondo-cantina-web-noche.jpg'
      : 'assets/images/juego/fondo-cantina-web.jpg'));
    // Pedido del usuario ("vamos a colocar ahora la nueva mesa, así ya
    // completamos el diseño definitivo de la pantalla de juego 1v1"):
    // nuevo asset de mesa (paño verde + isotipo "TC", ya recortado a su
    // contenido real, sin relleno transparente alrededor — a diferencia
    // del archivo anterior, que era una lámina de 1500x2700 con la mesa
    // ocupando solo una región interna, de ahí el `setCrop` con offsets a
    // mano en `_ajustarMesaSegunAsientos`). Esta nueva mesa es solo para
    // 1v1/2v2 (la rama "normal" de esa función) — el usuario no mandó
    // reemplazo para la mesa de 3v3, que sigue con su asset de siempre.
    this.load.image('mesaRedonda', conVersion('assets/images/juego/mesa-truco-nueva.webp'));
    this.load.image('mesaRedonda3v3', conVersion('assets/images/juego/mesa-truco-3v3.webp'));
    // Pase 394: la misma mesa SIN la marca "TC" (que va como imagen aparte) — la usa el layout angosto, que estira el paño.
    this.load.image('mesaRedondaLimpia', conVersion('assets/images/juego/mesa-truco-nueva-sin-marca.webp'));
    this.load.image('marcaTcMesa', conVersion('assets/images/juego/marca-tc-mesa.png'));
    // Pase 446: mazos laterales en abanico (2v2). Una imagen por lado y por cantidad de cartas en mano (3, 2 y 1).
    // Pase 449: abanico de frente (rival de 1v1, compañero de 2v2 y rival de enfrente de 3v3), también con 3, 2 y 1 cartas.
    [3, 2, 1].forEach(n => {
      this.load.image(`mazoAbanicoFrente_${n}`, conVersion(`assets/images/juego/mazos-abanico/mazo-abanico-frente-${n}.png`));
    });
    ['izq', 'der'].forEach(lado => [3, 2, 1].forEach(n => {
      this.load.image(`mazoAbanico_${lado}_${n}`, conVersion(`assets/images/juego/mazos-abanico/mazo-abanico-${lado}-${n}.png`));
    }));
    // Fase 6 — fondo de la barra de acciones ("madera + filete dorado"),
    // reemplaza el rectángulo de color plano que había antes (ver
    // _crearElementosDeTexto). Imagen de 800x110, misma proporción que el
    // rectángulo que reemplaza, así que no hace falta tocar ninguna posición.
    // Nonagésimo pase: reemplazada por la placa de madera con remaches de
    // bronce que pasó el usuario (ver comentario junto al add.image más
    // abajo sobre por qué el tamaño de display cambió de 800x110).
    this.load.image('panelBotonera', conVersion('assets/images/juego/panel-botonera-madera-remaches.png'));
    // Nonagésimo quinto pase: se había agregado acá la carga de
    // `placaTurno` (faja de madera detrás de "● Tu turno") — el
    // nonagésimo séptimo pase la sacó de nuevo a pedido del usuario (ver
    // comentario junto a `turnoText` en create()), así que esta imagen ya
    // no se usa en ningún lado.
    // Trigésimo cuarto pase: placa de madera para el marcador de puntaje
    // (imagen), que después pasó a un asset de cuero+bronce (pase
    // siguiente) — el usuario dio marcha atrás y pidió volver al criterio
    // de placa "madera+bronce" dibujada por código, mismo lenguaje visual
    // que ya usan Lobby/Torneos/Ranking en CSS — ver `_dibujarPlacaMarcador`
    // y `this.scoreBg` más abajo. Ya no se carga ninguna imagen para este
    // panel.

    // Assets de la botonera vieja (Fase 1, 3 slices por material): de los
    // 4 materiales que existían originalmente, solo quedaba 'boton_verde'
    // en pie (para "Tengo [puntos]") — octogésimo sexto pase: ese último
    // sobreviviente también pasó al pipeline de imagen (ver Tengo.png más
    // abajo), así que 'boton_verde' se da de baja de la precarga. Los
    // archivos boton_verde_izq/centro/der.png quedan en el repo sin usar
    // (esta sesión no tiene forma de borrar archivos del dispositivo del
    // usuario) — si en algún momento se hace una limpieza de assets, son
    // candidatos. 'banner' (mensaje de estado) y 'circulo_mano' (indicador
    // de mano) no se tocan.
    const UI_BOTONES = ['banner'];
    UI_BOTONES.forEach(nombre => {
      ['izq', 'centro', 'der'].forEach(parte => {
        this.load.image(`${nombre}_${parte}`, conVersion(`assets/images/juego/ui-botones/${nombre}_${parte}.png`));
      });
    });
    this.load.image('circulo_mano', conVersion('assets/images/juego/ui-botones/circulo_mano.png'));
    // Pase 580 (paridad con la app, Pase 574): medalla de "Mano" (moneda del mate con una manito).
    this.load.image('medalla_mano', conVersion('assets/images/juego/ui-botones/medalla-mano.png'));
    // Trigésimo segundo pase: ícono de persona junto al label "Rival" (1v1) —
    // reemplaza al circulito de "es mano" que iba ahí, que ahora se usa nomás
    // para el indicador propio (manoIconoPropio) y para equipos.
    this.load.image('icono_rival', conVersion('assets/images/juego/ui-botones/icono-rival.png'));

    // Botones de canto/respuesta rediseñados (Fase 2): una imagen entera
    // por botón, con el texto ya horneado adentro por el diseñador en
    // Canva — reemplaza el pipeline de 3 slices + texto dibujado encima
    // para todos los cantos/respuestas. Set: 'con-flor-me-achico' y
    // 'no-quiero' apuntan a la misma clave ('NoQuiero'), no hace falta
    // encolarla dos veces.
    const CLAVES_BOTON_IMAGEN = [...new Set(Object.values(CLAVE_IMAGEN_BOTON))];
    CLAVES_BOTON_IMAGEN.forEach(clave => {
      this.load.image(`boton_img_${clave}`, conVersion(`assets/images/juego/ui-botones-canva-final/${clave}.png`));
    });
    // Octogésimo sexto pase: "Tengo [puntos]" no tiene un id semántico de
    // canto (no pasa por CLAVE_IMAGEN_BOTON/specImagen), así que su textura
    // se encola aparte — con el número dibujado encima en `_crearBoton`
    // (branch `imagen === 'Tengo'`).
    // Pase 267: el asset de fondo pasó de una tablita de madera oscura
    // plana a la píldora verde brillante que mandó el usuario (`Tengo.png`,
    // mismo nombre/clave, solo cambió el contenido del archivo).
    // Ducentésimo septuagésimo pase: esa píldora se estiraba entera a un
    // ancho fijo (130), así que con textos cortos ("Tengo 7") se veía
    // siempre más ancha de lo que el texto necesitaba — reportado por el
    // usuario como "el botón cambia de tamaño y queda estirado" al variar
    // el puntaje. Se recortó `Tengo.png` en 3 franjas (puntas fijas +
    // tramo recto del medio) para poder estirar SOLO el medio, igual que ya
    // se hace con los banners/botones-overlay de madera — a diferencia de
    // Quiero/Truco/etc., esta tablita no tiene texto horneado, así que acá
    // no hay nada que la técnica de 3 franjas pueda deformar.
    this.load.image('tengoIzq', conVersion('assets/images/juego/ui-botones-canva-final/tengo-izq.png'));
    this.load.image('tengoCentro', conVersion('assets/images/juego/ui-botones-canva-final/tengo-centro.png'));
    this.load.image('tengoDer', conVersion('assets/images/juego/ui-botones-canva-final/tengo-der.png'));
    this.load.audio('jugar-carta', 'assets/sounds/CardGame-SoundEffect.mp3');
    this.load.audio('ganar',       'assets/sounds/ganarpartidasonido.mp3');
    this.load.audio('repartir',    'assets/sounds/repartir_cartas.mp3');
    ['1_fosforo', '2_fosforos', '3_fosforos', '4_fosforos', '5_fosforos_cruz'].forEach((f, i) => {
      this.load.image(`fos_${i + 1}`, conVersion(`assets/images/juego/fosforos/${f}.png`));
    });   // Pase 403: clic de fosforo al sumar un punto
    // Pase 206: pedido del usuario — la pantalla de "esperando rival" tenía
    // su propio fondo de boliche/bar (marrón), distinto al fondo verde
    // fotográfico que usa el resto de la app (lobby, torneos, bracket,
    // etc.). Se apunta la misma clave 'fondoEspera' al mismo archivo
    // fondo-lobby.jpeg para no tener que tocar el resto de este archivo.
    this.load.image('fondoEspera', conVersion('assets/images/fondo-lobby.jpeg'));
    // Pase 210: assets reales que mandó el usuario para la pantalla de
    // espera — el marco de madera (soga + esquineros de metal) que
    // reemplaza el anillo/círculo dibujado a mano detrás de cada avatar
    // (ver _dibujarTileEspera), y el tablón que reemplaza el fondo plano
    // celeste del botón "Volver al Lobby" (ver _crearBoton, clave
    // `boton_img_${imagen}` — el prefijo `boton_img_` es el que ya usa esa
    // función para CUALQUIER botón-imagen, no una convención nueva).
    // Pase 267, punto 2: el marco original (`marco-avatar-espera.png`) era
    // una PLACA CUADRADA con esquineros de metal oscuros — pedido explícito
    // del usuario: "los marcos cuadrados... quedan demasiado oscuros y sin
    // contraste... convertir en Podios o Sellos Circulares de Madera Cálida
    // con Pergamino Interior". No se generó arte nuevo — el archivo
    // original YA tenía un medallón circular de soga tallada adentro de esa
    // placa cuadrada (ver el PNG completo); se recortó esa parte circular
    // (se descartaron la placa cuadrada y los esquineros de metal), se le
    // subió el brillo/calidez, y se tiñó el disco interior hacia un tono
    // crema/pergamino (antes era madera lisa oscura) — resultado: un sello
    // circular de madera clara con centro de pergamino, mismo archivo de
    // origen, sin ilustrar nada nuevo. Nuevo archivo, clave nueva (la vieja
    // 'marcoAvatarEspera' se da de baja — un solo call site, ver
    // _dibujarTileEspera).
    this.load.image('selloAvatarEspera', conVersion('assets/images/juego/sello-avatar-espera.png'));
    // Pase 346: mismo aro de madera pero con el centro TRANSPARENTE (sin el
    // relleno beige) — se usa cuando hay un jugador conectado, encima de una
    // burbuja translúcida + la foto, para que no quede fondo blanco/opaco.
    this.load.image('selloAvatarAro', conVersion('assets/images/juego/sello-avatar-aro.png'));
    // Pase 347: aro nuevo de caoba con remaches (centro transparente). En salas ranked se
    // reemplaza, por jugador, con el anillo de su rango (carga perezosa, ver _dibujarTileEspera).
    this.load.image('aroAvatarEspera', conVersion('assets/images/juego/aro-avatar-espera.png'));
    // Pase 346: cara y dorso de la moneda para el spinner "Buscando rival...".
    // Pase 374: escudo con espadas y "VS" (PNG del usuario) entre los dos aros.
    this.load.image('vsEscudoEspera', conVersion('assets/images/vs-escudo.png'));
    this.load.image('escudoSinTexto', conVersion('assets/images/escudo-sin-texto.png'));   // Pase 413: escudo liso de la pantalla final (el marcador va encima)
    // Pase 378: los 4 personajes para las siluetas del "radar" del asiento vacío (se tiñen por
    // código, ver _dibujarRadarSiluetas).
    ['gaucho', 'gaucha', 'gaucho2', 'gaucha2'].forEach(p => {
      this.load.image(`siluetaEspera_${p}`, conVersion(`assets/${p}-avatar-cara.png`));   // Pase 437: la silueta del asiento vacío es el rostro, no el cuerpo entero
    });
    // Pase 267, punto 4: este tablón ya NO se usa — el botón "Volver al
    // Lobby" pasa a ser el mismo Botón 3D Pill-shaped (nine-slice) que la
    // pantalla final (ver botonVolverEspera en create()). Se deja la
    // precarga igual (no hace daño, y por si se reutiliza en otro lado) en
    // vez de borrarla a ciegas.
    this.load.image('boton_img_TablonEspera', conVersion('assets/images/juego/tablon-boton-espera.png'));
    const PERSONAJES_CANTO = ['gaucho', 'gaucha', 'gaucho2', 'gaucha2'];

    // Pase 201: fondo de la pantalla de resultado final (reemplaza el
    // velo negro plano por el mismo fondo fotográfico que ya usa el
    // lobby) y la cara del propio personaje del jugador — victoriosa
    // si ganó, derrotada si perdió — que reemplaza el emoji fijo que
    // antes vivía pegado al texto del título. Se carga solo el par
    // derrotado/victorioso del personaje que el jugador tiene elegido
    // (con fallback a 'gaucho' si no tiene uno válido todavía), no los
    // 8 juegos completos de expresiones, para no descargar de más.
    this.load.image('fondoResultado', conVersion('assets/images/fondo-lobby.jpeg'));
    const miPersonajeResultado = PERSONAJES_CANTO.includes(this.usuario?.personaje) ? this.usuario.personaje : 'gaucho';
    // Pase 266: ahora se cargan las variantes "_cerca" — versiones
    // recortadas al bbox de contenido (+6% de margen, luego centradas en
    // un lienzo cuadrado) en vez de los PNG originales, que tenían
    // relleno transparente interno muy inconsistente entre los 4
    // personajes (del 4% al 19% del lienzo según el caso). Sin este
    // recorte, agrandar `caraTam` solo mostraba más espacio vacío
    // ampliado; con el recorte, el personaje ocupa todo el `caraTam` y
    // el sombrero puede asomar por encima del anillo (ver `radioAvatar`
    // más abajo). Los PNG originales quedan intactos por si se usan en
    // otro lado (stickers de chat, etc.).
    this.load.image('caraDerrotado', conVersion(`assets/expresionesGaucho/${miPersonajeResultado}_derrotado_cerca.png`));
    this.load.image('caraVictorioso', conVersion(`assets/expresionesGaucho/${miPersonajeResultado}_victorioso_cerca.png`));
    // Nonagésimo sexto pase: los botones de esta pantalla (revancha/volver
    // al lobby) pasan de un relleno plano dibujado por Graphics a los
    // MISMOS botones ilustrados píldora-3D (relieve+brillo horneados) que
    // ya usa Tienda.js para sus botones de precio — pedido explícito del
    // usuario: "mismo lenguaje de volumen 3D cartoon... para dar simetría
    // y peso táctil". Se reutilizan los PNG existentes en vez de generar
    // assets nuevos (mismo criterio que ya se usó para los botones de
    // Torneos/Tienda).
    // Pase 266: estos dos PNG completos ya no se dibujan directo en esta
    // escena (ver abajo, se reemplazó por los 6 slices) — quedan
    // cargados igual porque son el ORIGEN de esos slices (recortados de
    // estos mismos archivos) y por si Tienda.js u otra pantalla los
    // sigue usando enteros; no son candidatos a borrar, solo a dejar de
    // referenciar acá.
    this.load.image('botonVerde', conVersion('assets/images/boton-verde.png'));
    this.load.image('botonAmarillo', conVersion('assets/images/boton-amarillo.png'));
    // Pase 266, punto 3: los PNG de arriba (`botonVerde`/`botonAmarillo`,
    // la píldora COMPLETA) se estiraban enteros con `setDisplaySize` para
    // encajar en el ancho que pidiera cada texto — como el ancho varía
    // según el texto ("Pedir revancha" vs "Volver al lobby") pero la
    // imagen es una sola, estirarla horizontalmente aplastaba las puntas
    // redondeadas. Estos 6 slices (recortados de los mismos PNG de
    // arriba, puntas intactas) permiten el mismo truco de "3 franjas"
    // que ya usa `_crearBannerTexto` para el cartel de madera: solo el
    // centro liso se estira, las puntas solo cambian de alto. Usado en
    // `_crearBotonOverlay` (los botones de la pantalla final).
    this.load.image('botonVerdeIzq', conVersion('assets/images/boton-verde-izq.png'));
    this.load.image('botonVerdeCentro', conVersion('assets/images/boton-verde-centro.png'));
    this.load.image('botonVerdeDer', conVersion('assets/images/boton-verde-der.png'));
    this.load.image('botonAmarilloIzq', conVersion('assets/images/boton-amarillo-izq.png'));
    this.load.image('botonAmarilloCentro', conVersion('assets/images/boton-amarillo-centro.png'));
    this.load.image('botonAmarilloDer', conVersion('assets/images/boton-amarillo-der.png'));
    // Centésimo pase: ícono de trofeo dorado para la fila del ganador en
    // la tabla de posiciones — se reutiliza `historial-trofeo.png` (ya
    // tiene el contorno tipo sticker horneado, y ya se usa en Historial.js
    // exactamente para marcar "esta partida la gané") en vez de generar
    // un asset nuevo.
    this.load.image('trofeoFila', conVersion('assets/images/historial-trofeo.png'));
    // Pase 393: cuadro de fósforos (5 tantos) = icono de los PUNTOS de la Liga Criolla.
    this.load.image('fosforosPuntos', conVersion('assets/images/fosforos_5_tantos.png'));

    const CLAVES_CANTO = ['truco', 'retruco', 'vale-cuatro', 'envido', 'real-envido', 'falta-envido', 'quiero', 'no-quiero'];
    PERSONAJES_CANTO.forEach(p => {
      CLAVES_CANTO.forEach(c => {
        this.load.audio(`canto_${p}_${c}`, `assets/sounds/cantos/${p}_${c}.mp3`);
      });
    });
    const CLAVES_FLOR = ['flor', 'contra-flor', 'contra-flor-resto'];
    PERSONAJES_CANTO.forEach(p => {
      CLAVES_FLOR.forEach(c => {
        this.load.audio(`canto_${p}_${c}`, `assets/sounds/cantos/${p}_${c}.mp3`);
      });
    });
  }

  create() {
    // Pase 456: tipografía western (Rye) del marcador; los textos de Phaser no disparan la descarga, así que se pide acá y se redibujan al llegar.
    try {
      if (typeof document !== 'undefined' && document.fonts && document.fonts.load) {
        document.fonts.load('24px Rye').then(() => {
          [this.scoreText, this.scoreTextRival, this.labelPropio, this.labelRival].forEach((t) => { if (t && t.scene) t.updateText(); });
        }).catch(() => {});
      }
    } catch (err) { /* sin fuentes: queda la tipografía de respaldo */ }
    // El canvas ahora renderiza a 1200x900*devicePixelRatio en vez de a
    // 800x600 reales (ver gameConfigOnline.js, con el diagnóstico completo
    // del bug de nitidez) — pero TODAS las coordenadas de este archivo
    // (mesa, cartas, botones, banners: +50 posiciones x/y hardcodeadas)
    // siguen escritas para un mundo de 800x600. En vez de reescribir cada
    // una, usamos un zoom de cámara que escala esas coordenadas viejas al
    // tamaño real nuevo — 400 (centro viejo) sigue siendo el centro,
    // 0/800 siguen siendo los bordes, sin tocar ninguna posición existente.
    // `centerOn` es necesario porque el zoom de Phaser por default pivotea
    // desde el CENTRO de la cámara, no desde la esquina (0,0) — sin este
    // ajuste el centro visual del mundo viejo (400,300) queda desplazado.
    // Undécimo pase: el tope real (antes 1200x900, ahora ANCHO_MAX_CSS x
    // ALTO_MAX_CSS = 900x675 — ver gameConfigOnline.js) se importa desde la
    // config en vez de repetirlo acá a mano, para que este zoom y
    // `_factorEscalaTextura()` nunca puedan quedar desincronizados entre sí
    // como pasó en el pase anterior.
    // Pase 407: TODOS los textos de la escena se rasterizan a la resolución real del
    // backing store (mismo factor que las texturas pre-escaladas). Antes solo 4 textos
    // pasaban `resolution` y el resto (botones, banners, "Tu turno", timer, etc.) se
    // dibujaba a 1x y el zoom de la cámara lo estiraba → borroso. Se parchea
    // `this.add.text` una sola vez para que el default sea ese factor (tope 4x).
    if (!this._addTextParcheado) {
      this._addTextParcheado = true;
      const addTextOriginal = this.add.text.bind(this.add);
      this.add.text = (x, y, texto, estilo) => {
        const st = (estilo && typeof estilo === 'object') ? estilo : {};
        const res = Math.min(4, Math.max(1, this._factorEscalaTextura()));
        return addTextOriginal(x, y, texto, { resolution: res, ...st });
      };
    }
    const dpr = window.devicePixelRatio || 1;
    if (this._angosto) {
      this._L = this._calcularLayoutAngosto();
      this._modoCamaraAngosto('estatica');
    } else {
      this.cameras.main.setZoom((ANCHO_MAX_CSS / 800) * dpr);
      this.cameras.main.centerOn(400, 300);
    }

    const fuentesListas = Promise.all([
      document.fonts.load('700 16px Nunito'),
      document.fonts.load('600 16px Fredoka'),
      document.fonts.load('700 16px Fredoka'), 
    ]);

    // Por si el navegador tarda mucho o falla la carga, no bloqueamos el juego para siempre
    const timeout = new Promise(resolve => setTimeout(resolve, 1000));

    Promise.race([fuentesListas, timeout]).then(() => {
      this._crearElementosDeTexto();
    });
  }

_crearElementosDeTexto() {
    const fondo = this.add.image(400, 300, 'fondoMesa').setDisplaySize(800, 600).setDepth(0);
    this.fondoMesaImg = fondo;

    // Punto 6, ver _crearTexturasAtmosfera: depth 0.2, por encima del fondo
    // de madera (depth 0) pero por debajo de la mesa/paño (depth 1) y de
    // `sombraMesa` (depth 0.5) — solo agrega densidad al anillo de madera
    // visible alrededor de la mesa, nunca toca el paño ni lo que se dibuja
    // sobre él.
    this._crearTexturasAtmosfera();
    this.vinetaMaderaImg = this.add.image(400, 300, 'vinetaMadera').setDepth(0.2);

    this.sombraMesa = this.add.ellipse(400, 520, 560, 90, 0x000000, 0.35).setDepth(0.5);
    // Ducentésimo sexagésimo noveno pase: halo cálido detrás de la mesa
    // (ver `resplandorMesa` en _crearTexturasAtmosfera) — depth 0.6, entre
    // la sombra (0.5) y la mesa (1), así queda siempre DETRÁS del tapete,
    // dándole un borde de luz que la separa de la pared de fondo. A
    // diferencia de `luzCalidaMesa` más abajo, este se dibuja en los dos
    // modos (día y noche).
    this.resplandorMesaImg = this.add.image(400, 320, 'resplandorMesa').setDepth(0.6);
    this.mesaImg = this.add.image(400, 340, 'mesaRedonda').setDepth(1);
    this._ajustarMesaSegunAsientos(2);

    // Vigésimo primer pase ("iluminación y atmósfera", punto 5 de la lista
    // de diseño): luz cálida sobre el centro del paño + viñeteado suave en
    // los bordes. Se crean una sola vez acá (elementos persistentes, igual
    // que fondo/mesaImg — no pasan por `_limpiarSprites` en cada estado).
    // (`_crearTexturasAtmosfera()` ya se llamó unas líneas más arriba, para
    // `vinetaMadera` — la función es idempotente, se deja este comentario
    // para no perder el contexto original de por qué se llama acá.)
    // Depth 1.2: por encima del paño/mesa (depth 1) pero por debajo de todo
    // lo demás (cartas, botones, texto) — un foco de luz sobre el tapete,
    // no un filtro que tape nada. Se usa alpha-blend normal (sin blendMode
    // ADD) a propósito: ADD tiende a "quemar" el color hacia blanco en vez
    // de dar un tono cálido, y sin poder verlo en vivo en este momento es
    // más seguro quedarse con la mezcla simple — si en la prueba real se ve
    // muy sutil, es fácil pasar a ADD o subirle el alpha del gradiente.
    // Nonagésimo cuarto pase: bug reportado — en modo oscuro este halo
    // ámbar (pensado para el fondo de día) se ve como "una luz encendida
    // atrás de las cartas", fuera de lugar contra el fondo de noche. Se
    // deja de dibujar directamente cuando `modoOscuro` está activo; en modo
    // día sigue igual que siempre.
    if (!this.modoOscuro) {
      this.luzCalidaMesaImg = this.add.image(400, 320, 'luzCalidaMesa').setDepth(1.2);
    }
    // Depth 1000: por encima de TODO lo que dibuja la escena (cartas,
    // botonera, texto) — así el oscurecimiento de las esquinas es parejo
    // sobre toda la pantalla de juego, no solo sobre el fondo. El centro del
    // gradiente queda transparente (radio 250, ver _crearTexturasAtmosfera)
    // así que no llega a tocar ni la mesa ni las cartas jugadas, solo el
    // marco exterior.
    this.vinetaMesaImg = this.add.image(400, 300, 'vinetaMesa').setDepth(1000);
    if (this._L) { this._acomodarFondosAngosto(); this.vinetaMesaImg.setVisible(this._modoCamara === 'juego'); }

    // Vigésimo segundo pase: el intento anterior (bajarlo de Y=22 a Y=36,
    // debajo del texto de estado y arriba de las cartas) TODAVÍA se solapaba
    // con la carta central del abanico del rival en la práctica — se ve en
    // una captura real del usuario, el texto "Rival" queda cortado por el
    // borde superior de las cartas boca abajo. En vez de seguir ajustando
    // el mismo punto (x=400, centro) a los pixels, se lo sacó del todo del
    // centro superior — mismo criterio que ya se usó con el marcador: ahora
    // es una placa junto al marcador, arriba a la izquierda, lejos de
    // cualquier cosa que pueda superponerse.
    // Centésimo décimo séptimo pase: el usuario reportó que, al quedar
    // clickeable (pase anterior), el nombre se sentía en un lugar raro —
    // pegado contra `icono_rival` (silueta de persona/gaucho, ver abajo) en
    // vez de estar cerca del marcador de puntaje, que vive justo a la
    // izquierda (placa `scoreBg` centrada en x=68, ancho 72 → borde derecho
    // en x≈104). Se acerca el nombre a esa placa (de x=175 a x=112, un
    // margen chico de 8px) — ver más abajo cómo se reposiciona
    // `manoIconoRival` en cada render para seguir sin superponerse, ahora
    // que el nombre real (variable en largo) reemplazó al texto fijo
    // "Rival" (pase 115).
    // Sexagésimo primer pase (punto 2, "zona superior"), implementado en el
    // centésimo décimo octavo: el usuario venía notando que "el marcador y
    // el ícono del rival se sienten sueltos" — investigando por qué,
    // apareció una causa real y ya conocida en este archivo (ver el
    // comentario de `scoreBg`/`scoreText` unas líneas más arriba): el
    // viñeteado (`vinetaMesa`, depth 1000, ver create()) oscurece TODO lo
    // que esté en un depth menor, y `labelRival`/`manoIconoRival` se habían
    // quedado en depth 2 — el marcador ya se había subido a depth>1000 por
    // este mismo motivo, así que el nombre+ícono quedaban apagados/lavados
    // por el viñeteado mientras el marcador al lado se veía nítido. Subidos
    // a depth 1002 (mismo nivel que `scoreText`) para que escapen del
    // viñeteado igual que el marcador. Además se agrega `fondoInfoRival`,
    // una placa chica (Graphics) detrás de nombre+ícono, para que las dos
    // placas (marcador + info del rival) se lean como un solo bloque de
    // HUD en vez de "puntaje con placa" + "nombre suelto flotando sobre
    // el paño".
    //
    // Pase siguiente ("Placa Doble de Madera", pedido del usuario: "mostrar
    // los nombres de los jugadores con sus puntos"): esta placa pasa de
    // tamaño DINÁMICO (según el ancho real del nombre, redibujada en cada
    // `_renderizarEstado`) a tamaño FIJO, mismo criterio y mismo dibujo
    // (`_dibujarPlacaMarcador`) que la placa de "Vos" de más abajo — las
    // dos forman el par de placas gemelas del HUD. Al ser fijo, ya no hace
    // falta redibujarla en cada estado (se dibuja una sola vez acá, con
    // `_dibujarPlacaMarcador`, después de definir sus medidas junto con la
    // placa de "Vos"). El nombre del rival, si es más largo que lo que
    // entra, se trunca (ver `_renderizarEstado`) en vez de estirar la
    // placa — evita que un nombre largo empuje el resto del HUD o invada
    // el centro de la pantalla.
    this.fondoInfoRival = this.add.graphics().setDepth(1001);
    // Pase siguiente: anillo de tiempo (paridad con el nativo, pase 177) —
    // graphics aparte y persistente (no vive en `_sprites`, sobrevive a
    // cada re-render) para poder redibujarlo en cada tick del timer
    // (cada 500ms, ver create() más abajo) sin depender de que llegue un
    // estado nuevo del backend. `_anilloRect` (seteado en _renderizarEstado
    // y en _dibujarJugador) le dice DÓNDE dibujar; depth alto para quedar
    // por encima de cualquier elemento de la mesa, en 1v1 o en equipos.
    this.anilloTiempo = this.add.graphics().setDepth(1010);
    this._anilloRect = null;

    // Placa doble — ver comentario junto a `fondoInfoRival` más arriba y
    // el de la placa "Vos" más abajo (junto a `scoreBg`). Las dos placas
    // son gemelas: mismo tamaño, mismo estilo, una al lado de la otra.
    // `PLACA_RIVAL_CX/CY/ANCHO/ALTO` son las medidas de ESTA placa —
    // separadas de `marcadorAncho/Alto/X` (placa "Vos") porque cada una
    // vive en su propio bloque del archivo, pero comparten los mismos
    // valores de ancho/alto por diseño.
    // Pase siguiente (feedback del usuario: las placas quedaban "muy
    // pegadas al marco superior e izquierdo" — pidió ~12px de aire arriba
    // y a la izquierda). Con esta placa centrada en (178,36) y 96×48, el
    // borde superior queda en Y=12 y el borde derecho de la placa "Vos"
    // (ver más abajo) + el margen entre ambas dejan el borde izquierdo de
    // ESTA en X=130 — ninguna placa toca ya el borde de la pantalla.
    this.PLACA_RIVAL_CX = this._L ? this._L.placaRivalX : 178;
    this.PLACA_RIVAL_CY = this._L ? this._L.hudY : 36;
    const kpH = this._L ? this._L.kp : 1;   // Pase 394: escala del HUD en layout angosto
    const placaAncho = this._L ? this._L.placaW : 96;
    const placaAlto = this._L ? this._L.placaH : 60;
    // Nonagésimo tercer pase: color sólido (sin alpha en el hex) +
    // contorno fino, en vez de '#ffffffdd' sin stroke — pedido explícito
    // del usuario, el nombre del rival se perdía sobre la madera. Mismo
    // criterio que `labelPropio` (ver más abajo), para que las dos placas
    // sean igual de legibles.
    this.labelRival = this.add.text(this.PLACA_RIVAL_CX, this.PLACA_RIVAL_CY - 17 * kpH, 'Rival', {
      fontFamily: 'Rye, Georgia, serif', fontSize: `${Math.round(10 * kpH)}px`, color: '#3B1F0F',   // Pase 456: Rye (western) sobre el pergamino
      resolution: this._factorEscalaTextura(),
    }).setOrigin(0.5).setDepth(1002);
    // Centésimo décimo quinto pase: nombre del rival clickeable, mismo
    // criterio que Ranking/Lobby/chat/Perfil (abre PerfilRivalModal). Se
    // deja interactivo una sola vez acá afuera del render loop — el texto
    // se actualiza en cada `_renderizarEstado` pero el listener siempre lee
    // `this._nombreRivalActual`, que se guarda ahí mismo.
    // Pase 403: en el layout angosto la placa entera abre el Anotador Criollo (el
    // nombre del rival, que abre su perfil, va sobre sus cartas: nombreRivalAngosto).
    if (!this._L) {
      this.labelRival.setInteractive({ useHandCursor: true });
      this.labelRival.on('pointerdown', () => {
        if (this._nombreRivalActual && this.onVerPerfil) this.onVerPerfil(this._nombreRivalActual);
      });
    }
    // Pase 396 (layout angosto): las placas dicen "Vos" / "Rival" como en el
    // nativo; el nombre real del rival va sobre sus cartas (clickeable → perfil).
    if (this._L) {
      this.nombreRivalAngosto = this.add.text(400, this._L.nombreY, '', {
        font: 'bold 17px Arial', fill: '#FFF8ED', stroke: '#2a1c14', strokeThickness: 3,
        resolution: this._factorEscalaTextura(),
      }).setOrigin(0.5).setDepth(1002).setVisible(false);
      this.nombreRivalAngosto.setInteractive({ useHandCursor: true });
      this.nombreRivalAngosto.on('pointerdown', () => {
        if (this._nombreRivalActual && this.onVerPerfil) this.onVerPerfil(this._nombreRivalActual);
      });
    }
    // Puntos del rival — antes vivían combinados con los propios en un
    // solo texto "N - N" adentro de la placa "Vos" (`scoreText`); ahora
    // cada placa muestra sus propios puntos, en el mismo estilo (cifras
    // doradas) que ya tenía ese texto combinado.
    this.scoreTextRival = this.add.text(this.PLACA_RIVAL_CX, this.PLACA_RIVAL_CY + 10 * kpH, '0', {
      fontFamily: 'Rye, Georgia, serif', fontSize: `${Math.round(24 * kpH)}px`,
      color: '#C98A48', stroke: '#2B1608', strokeThickness: 3,   // Pase 456: bronce para rivales, contorno oscuro y sombra paralela
      shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 0, fill: true, stroke: true },   // Pase 469: sombra sólida 2px 2px 0 (sin blur)
      resolution: this._factorEscalaTextura()
    }).setOrigin(0.5).setDepth(1002);
    this._dibujarPlacaMarcador(this.fondoInfoRival, this.PLACA_RIVAL_CX, this.PLACA_RIVAL_CY, placaAncho, placaAlto, true);
    // Trigésimo segundo pase: antes era el circulito de "es mano" (solo
    // visible cuando el rival era mano) — ahora es un ícono de persona
    // siempre visible junto al label, y el que "se prende" (dorado, con
    // pulso) o "se apaga" (gris, quieto) según de quién es el turno, no
    // según quién es mano. Ver _renderizarEstado (_rivalTurnoEncendido).
    // Pase siguiente: antes seguía al ancho real del nombre (placa
    // dinámica); con la placa fija, se fija por fuera de su borde derecho
    // (mismo lugar relativo que antes — el ícono siempre quedaba DESPUÉS
    // del nombre, nunca superpuesto) en vez de recalcularse en cada estado.
    this.manoIconoRival = this.add.image(this.PLACA_RIVAL_CX + placaAncho / 2 + (this._L ? 14 : 11), this.PLACA_RIVAL_CY - 17 * kpH, 'icono_rival').setDisplaySize(17 * kpH, 19 * kpH).setDepth(1002).setVisible(false);
    // Pase 580: medalla de "Mano" del rival en 1v1 (aparece cuando el rival es mano), pegada a su ícono de turno.
    this.medallaManoRival = this.add.image(0, 0, 'medalla_mano').setDisplaySize(18 * kpH, 18 * kpH).setDepth(1002).setVisible(false);
    this._posicionarMedallaRival();

    // Barra de fondo para los botones de acción — línea divisoria subida de
    // 521 a 500 (y panel agrandado a juego) para ganarle ~21px al área de la
    // mesa y dárselos a los botones apilados de abajo, que venían muy chicos
    // (34px de alto) por falta de lugar. Ver _dibujarManoJugador (las cartas
    // propias se achicaron y se subieron para dejar ese espacio libre sin
    // que se solapen con la barra) y _dibujarBotonesCanto (donde se usa el
    // espacio ganado).
    // Antes acá había un rectángulo de color plano (0xFFF8ED) + una línea
    // divisoria chocolate encima (0x4A2C2A) — la imagen nueva de madera ya
    // trae su propio filete dorado como borde superior, así que la línea
    // divisoria de color plano quedaría duplicando ese borde y se sacó.
    // Nonagésimo pase: el asset nuevo (placa con remaches que pasó el
    // usuario) tiene una proporción real de ~3.63:1, muy distinta de la
    // caja vieja 800x110 (7.27:1) — forzarla a 800x110 la hubiese estirado
    // horizontalmente al doble (remaches ovalados, mismo error que ya pasó
    // con la mesa en un pase anterior). El alto se calcula a partir de la
    // proporción real de la imagen en vez de forzarla a 800 de ancho — queda
    // centrada, más angosta, con el fondo oscuro de `fondoMesa` (depth 0)
    // asomando a los costados en vez de un estiro visible. Si se prefiere
    // que ocupe todo el ancho de la mesa de punta a punta, hace falta un
    // asset recortado en 3 franjas (punta/centro repetible/punta), como ya
    // se usa en `_crearBannerTexto`.
    // Nonagésimo segundo pase: el usuario pidió agrandar el panel 15-20%
    // para que la fila única de botones nueva (ver _dibujarBotonesCanto)
    // entre holgada — se sube el alto de 110 a 130 (+18%) MANTENIENDO la
    // proporción real de la imagen (ancho sube en la misma proporción, a
    // ~472, en vez de solo estirar el alto, que hubiese vuelto a deformar
    // los remaches). El borde SUPERIOR queda fijo en Y=500 (la línea
    // divisoria de siempre) y el panel crece hacia abajo desde ahí — si en
    // cambio se centrara en el Y viejo (555), el borde superior con los
    // remaches se corriría MÁS arriba, invadiendo más la zona de las
    // cartas en mano en vez de darles aire (ver pedido del usuario sobre
    // "la tira de remaches no tape las cartas en mano", resuelto en
    // conjunto con el +10px de `_dibujarManoJugador`).
    const altoBotonera = this._L ? this._L.panelH : 130;
    const anchoBotonera = Math.round(altoBotonera * (700 / 193));
    // Pase 409: en escritorio la placa sube 10px (borde superior en Y=490) para que la botonera tenga más aire.
    const yBotonera = this._L ? this._L.panelCY : 490 + altoBotonera / 2;
    this.add.image(400, yBotonera, 'panelBotonera').setDisplaySize(anchoBotonera, altoBotonera).setDepth(150);
    // Nonagésimo primer pase: guardada como propiedad de la escena para que
    // `_dibujarBotonesCanto` pueda repartir los botones dentro del ancho
    // real de ESTA placa (más angosta que el canvas completo) en vez de un
    // ancho fijo — si se vuelve a ensanchar la placa (ver comentario de
    // arriba sobre el asset en 3 franjas), este número se actualiza solo.
    this._anchoPanelBotonera = anchoBotonera;   // Pase 443: borde derecho real de la placa (para el botón de cartas)
    this.anchoBotonera = this._L ? anchoBotonera - 90 : anchoBotonera;   // angosto: deja libre la esquina de la tuerca de ajustes (React)
    // Ducentésimo sexagésimo noveno pase: guardado también el centro
    // vertical real de la placa (`yBotonera`, ya calculado arriba a partir
    // del alto real `altoBotonera`) — `_dibujarBotonesCanto` lo venía
    // ignorando y usaba números sueltos (550, 525/575) calculados a mano
    // para la placa VIEJA de 100px de alto (banda 500-600), de antes del
    // pase 92 que la agrandó a 130px (banda 500-630, centro real 565) sin
    // actualizar esos números — por eso los botones se veían corridos
    // hacia arriba dentro de la placa ya agrandada. Ver uso en
    // `_dibujarBotonesCanto`.
    this.yCentroBotonera = yBotonera;

    // Trigésimo cuarto pase: el rectángulo dorado dibujado por código pasó
    // a una placa de madera por imagen, después a un asset de cuero+bronce
    // (pase siguiente) — el usuario dio marcha atrás sobre esa idea y pidió
    // volver a una placa dibujada por código, mismo criterio "madera+bronce"
    // que ya usan los paneles de Lobby/Torneos/Ranking (ahí en CSS, acá con
    // Graphics — ver `_dibujarPlacaMarcador`). Al ser dibujada, no depende
    // de la proporción de ningún asset: vuelve a 72×48 (el tamaño de antes
    // de forzar la relación de aspecto de la imagen de cuero).
    // Pase siguiente ("Placa Doble de Madera", pedido del usuario: "mostrar
    // los nombres de los jugadores con sus puntos... convertir en una
    // Placa Doble de Madera/Pergamino"): esta placa (antes un solo "N - N"
    // combinado) pasa a mostrar SOLO los puntos propios, con el nombre
    // arriba — su gemela (`fondoInfoRival`, ver más arriba) muestra lo
    // mismo para el rival. Mismo ancho/alto que la placa del rival
    // (`placaAncho`/`placaAlto`, definidos junto a esa placa) para que el
    // par se vea como un solo bloque de HUD parejo.
    const marcadorAncho = this._L ? this._L.placaW : 96;
    const marcadorAlto = this._L ? this._L.placaH : 60;
    // Decimoctavo pase: el marcador vivía centrado en (400,18), justo en el
    // mismo punto donde caen el texto de estado ("Conectando...") y las
    // cartas boca abajo del rival (fila que arranca en Y=95 más abajo) —
    // los tres se amontonaban ahí. Se lo movió a una placa fija arriba a la
    // izquierda para liberar el centro superior por completo.
    // Pase siguiente: X bajado de 68 a 58 — con la placa del rival ahora
    // FIJA en x=176 (en vez de seguir el ancho variable del nombre), hay
    // que dejar aire explícito entre las dos placas: borde derecho de esta
    // (58+48=106) a borde izquierdo de la del rival (176-48=128) quedan
    // 22px libres.
    // Pase siguiente (feedback del usuario: "las dos placas de madera del
    // puntaje están muy pegadas al marco superior e izquierdo... que
    // respiren"): X 58→60 e Y 24→36, mismo criterio que la placa del
    // rival (ver comentario junto a `PLACA_RIVAL_CX/CY` más arriba) — deja
    // ~12px de aire contra el borde superior e izquierdo real de la
    // pantalla (borde de esta placa: X=12, Y=12).
    const marcadorX = this._L ? this._L.placaVosX : 60;
    const marcadorY = this._L ? this._L.hudY : 36;

    // Trigésimo octavo pase: causa real de "se ve semi transparente" — el
    // marcador vivía a depth 300, POR DEBAJO del viñeteado de atmósfera
    // (`vinetaMesa`, depth 1000, ver más abajo) que oscurece las ESQUINAS
    // de la pantalla para dar ambiente a la mesa. El marcador queda en la
    // esquina superior izquierda — lejos del centro transparente del
    // viñeteado (radio 250) y cerca de su borde más oscuro (radio 480,
    // ~40% negro ahí) — así que ese oscurecimiento, pensado para el paño y
    // las cartas, también le caía encima al marcador y lo apagaba/lavaba.
    // Antes con el rectángulo dorado plano se notaba menos (el dorado es
    // muy saturado); con la madera (tonos más neutros) se nota mucho más.
    // Fix: subir el marcador (placa + texto) a depth > 1000 para que
    // quede POR ENCIMA del viñeteado, como corresponde a un elemento de
    // HUD — no es parte de la mesa que el viñeteado debería atenuar.
    //
    // Pase de esta vuelta atrás: ya no es una imagen, es un Graphics que se
    // dibuja una sola vez acá (la placa no cambia de estado en ningún
    // momento del juego, a diferencia del anillo de tiempo o el badge de
    // turno, que sí se redibujan en cada `_renderizarEstado`).
    this.scoreBg = this.add.graphics().setDepth(1001);
    this._dibujarPlacaMarcador(this.scoreBg, marcadorX, marcadorY, marcadorAncho, marcadorAlto);

    // Nombre propio, mismo criterio que `labelRival` (placa gemela) —
    // texto chico arriba, puntos grandes abajo. Se trunca a 10 caracteres
    // (ver `_truncarNombre`, usado también para el rival) para que un
    // nombre de usuario largo nunca estire la placa.
    // Nonagésimo tercer pase: mismo color sólido + contorno que
    // `labelRival` (ver más arriba) en vez de '#ffffffdd' sin stroke.
    this.labelPropio = this.add.text(marcadorX, marcadorY - 17 * kpH, this._L ? 'Vos' : (this._truncarNombre(this.usuario?.username) || 'Vos'), {
      fontFamily: 'Rye, Georgia, serif', fontSize: `${Math.round(10 * kpH)}px`, color: '#3B1F0F',   // Pase 456
      resolution: this._factorEscalaTextura(),
    }).setOrigin(0.5).setDepth(1002);

    // Texto crema con SOMBRA chocolate en vez del chocolate plano de antes:
    // sobre la madera (tonos marrón medio) el texto oscuro se perdía casi
    // por completo. Trigésimo sexto pase: el filete (stroke) de 3px sobre
    // una fuente de 20px quedaba muy grueso en proporción al trazo de la
    // letra — el relleno crema se veía como una tira finita en el medio
    // de cada número, más que un número sólido. Se sacó el stroke y se
    // pasó a una sombra (no toca el relleno, solo agrega contraste
    // detrás) — mismo criterio que ya usa el marcador nativo.
    //
    // Trigésimo séptimo pase: esa corrección NO alcanzó — la captura real
    // del usuario mostró el número borroso/gris, no "hueco". Causa de
    // fondo (la real, encontrada recién ahora): este archivo tiene un bug
    // de nitidez YA DOCUMENTADO para TEXTURAS (ver `_factorEscalaTextura`,
    // décimo pase) que nunca se había aplicado a objetos de TEXTO — el
    // canvas real es más grande que 800x600 y la cámara hace zoom
    // `(ANCHO_MAX_CSS/800) * devicePixelRatio` para compensarlo (ver
    // create() más arriba), pero un Phaser.Text por default renderiza su
    // propio bitmap de letras a resolución 1, así que ese mismo zoom que
    // mantiene nítidas a las texturas pre-escaladas estira este texto sin
    // pre-escalar y lo emborrona — exactamente lo que se ve en la
    // captura. Fix: pedirle a Phaser que renderice el texto internamente
    // a esa resolución más alta con `resolution` (mismo factor que ya usa
    // `_factorEscalaTextura` para las texturas), no un tema de color/stroke.
    // Trigésimo noveno pase: con la nitidez y el viñeteado ya arreglados
    // (pases anteriores), el usuario pidió además un borde en las letras
    // para que se lean mejor — esta vez con un stroke fino (2px, no los
    // 3px del trigésimo quinto pase que resultaron demasiado gruesos para
    // una fuente de 20px) en vez de sacarlo del todo; se mantiene la
    // sombra de atrás además, para que no quede un doble filo tan marcado.
    // Sexagésimo séptimo pase: el usuario pidió centrar mejor el número
    // contra la placa — se lo baja un poco (18→21), mismo criterio que ya
    // se había usado para la placa en sí (marcadorImagenOffsetY, arriba).
    // Septuagésimo tercer pase: el usuario pidió llevar a la web el mismo
    // aspecto que tiene el número del marcador en nativo, que le gusta más
    // — ahí el contorno se simula con 8 copias sólidas (sin blur, sin
    // difuminar) detrás del número, dando un borde parejo y duro. Acá el
    // `blur:2` de la sombra suavizaba ese borde hasta verse casi un halo
    // tenue en vez de un contorno firme — el `blur:0` lo vuelve un borde
    // sólido y duro, mismo espíritu que el truco nativo, sin tocar el
    // stroke (2px ya probado — 3px en el trigésimo sexto pase quedó
    // "hueco" para esta fuente de 20px).
    //
    // Pase siguiente (placa doble): antes mostraba "N - N" (los dos
    // puntajes combinados); ahora solo el propio — el del rival vive en
    // `scoreTextRival`, en su propia placa. Tamaño 20→18 y baja un poco
    // (21→marcadorY+11) para convivir con `labelPropio` arriba, mismo
    // layout de dos líneas que la placa del rival.
    this.scoreText = this.add.text(marcadorX, marcadorY + 10 * kpH, '0', {
      fontFamily: 'Rye, Georgia, serif',
      fontSize: `${Math.round(24 * kpH)}px`,
      color: '#E0A72A',   // Pase 456: oro para aliados
      stroke: '#2B1608',
      strokeThickness: 3,
      shadow: { offsetX: 2, offsetY: 2, color: '#000000', blur: 0, fill: true, stroke: true },   // Pase 469: sombra sólida 2px 2px 0 (sin blur)
      resolution: this._factorEscalaTextura()
    }).setOrigin(0.5).setDepth(1002);

    // Pase 403: tocar la placa VOS o RIVAL abre el "Anotador Criollo" (popup React con los
    // cuadritos de fosforos). Las zonas quedan DEBAJO de los textos (depth 1001.5), asi que
    // en escritorio el nombre del rival sigue abriendo su perfil.
    const zonaAnotador = (cx, cy, w, h) => this.add.zone(cx, cy, w, h).setDepth(1001.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => { if (this.onAbrirAnotador) this.onAbrirAnotador(); });
    this.zonasAnotador = [
      zonaAnotador(marcadorX, marcadorY, marcadorAncho, marcadorAlto),
      zonaAnotador(this.PLACA_RIVAL_CX, this.PLACA_RIVAL_CY, placaAncho, placaAlto),
    ];
    // Pase 404: geometria original de las placas (para el modo "fosforos").
    this._geoPlacas = {
      kp: kpH,
      vos: { cx: marcadorX, cy: marcadorY, w: marcadorAncho, h: marcadorAlto },
      rival: { cx: this.PLACA_RIVAL_CX, cy: this.PLACA_RIVAL_CY, w: placaAncho, h: placaAlto },
    };
    this._aplicarMarcadorEstilo();

    // Indicador de "mano" (1v1): antes era el emoji 🂠 metido en el texto,
    // ahora es la ficha circular ilustrada + el texto sin emoji al lado.
    // Septuagésimo primer pase: este indicador vivía en (698,568) — esquina
    // inferior derecha del canvas — que quedó reservada para el botón de
    // configuración (DOM, `ConfiguracionMesaBoton`, position:absolute
    // bottom:12/right:12 sobre TODO el canvas, zIndex 1000). El canvas es
    // una sola imagen plana: cualquier elemento de Phaser dibujado ahí
    // queda SIEMPRE por debajo de ese botón (no es un tema de `setDepth`,
    // eso solo ordena entre elementos del canvas). El usuario reportó
    // justamente esto: "el texto de sos mano queda detrás del botón de
    // configuración". Se lo movió lejos de esa esquina — al costado
    // derecho de la mesa, por encima de la barra de botones y afuera del
    // abanico de cartas propias (que llega hasta X≈506) y de la zona del
    // botón de config (que arranca cerca de X≈755).
    // Nonagésimo tercer pase: "Sos mano" y "Tu turno" colisionaban (casi
    // la misma posición) — pedido explícito del usuario, Opción B de las
    // dos que ofreció: layout en columna, "Sos mano" arriba, "Tu turno"
    // inmediatamente abajo, con ~8px de aire entre ambas filas (ver Y del
    // `turnoText`, más abajo). Subida un poco (472→462) para dejarle
    // lugar abajo sin invadir más la mesa hacia arriba.
    this.manoIconoPropio = this.add.image(this._L ? this._L.indicadoresX : 650, this._L ? this._L.manoIndY : 462, 'medalla_mano').setDisplaySize(24, 24).setDepth(200).setVisible(false);
    this.miManoTexto = this.add.text(this._L ? this._L.indicadoresX + 16 : 666, this._L ? this._L.manoIndY : 462, '', {
      font: 'bold 15px Arial', fill: '#FFD700', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0, 0.5).setDepth(200);

    // Texto de notificaciones persistente — lo usan error-sala, error-jugada,
    // jugador-desconectado DURANTE toda la partida, no solo en la espera.
    // Decimoctavo pase: subido de Y=45 a Y=16 (con el marcador ya afuera del
    // centro) para que quede claramente por ENCIMA de las cartas boca abajo
    // del rival (que ahora arrancan en Y=95) en vez de superpuesto con ellas.
    // Pedido del usuario: que el indicador de estado ("Conectando...",
    // también usado para error-sala/jugador-desconectado) se destaque
    // más sobre el fondo de la mesa — ya estaba centrado (origin 0.5,
    // x=400 = centro del canvas de 800) y en un amarillo/blanco suave;
    // se le agrega contorno negro + sombra suave, sin cambiar color ni
    // posición.
    // Nonagésimo cuarto pase: el usuario reportó que las 3 cartas (dorso)
    // del rival, que arrancan en Y=80 (ver `_dibujarFilaDorso`, altura
    // 95px → su borde superior llega a ~Y=23-24 en las cartas del medio
    // del abanico), tapan un poco este texto — a Y=16 con una fuente de
    // 16px, el texto ocupa aprox. Y=8 a Y=24, justo el rango donde
    // empiezan las cartas. En vez de subirlo más (ya casi toca el borde
    // real del canvas, Y=0) se le agrega un pequeño "cartelito" indicador
    // detrás — una píldora oscura semitransparente con filete dorado fino,
    // mismo espíritu que el resto de los carteles de la mesa pero mucho
    // más chica — para que el texto se lea como un indicador de HUD
    // propio en vez de quedar flotando directamente sobre el paño/cartas.
    // Al estar en depth 300 (apenas debajo del texto, 301, y bastante por
    // encima de los dorsos del rival, depth ~10-13) la píldora tapa
    // cualquier carta que llegue a asomar por detrás, no al revés.
    this.mensajeFondo = this.add.graphics().setDepth(300);
    this.mensajeFondo.fillStyle(0x1a1008, 0.55);
    this.mensajeFondo.fillRoundedRect(400 - 140, 13 - 13, 280, 26, 13);
    this.mensajeFondo.lineStyle(1.5, 0xE3A94A, 0.8);
    this.mensajeFondo.strokeRoundedRect(400 - 140, 13 - 13, 280, 26, 13);

    this.mensajeText = this.add.text(400, 13, 'Conectando...', {
      font: '16px Nunito, Arial', fill: '#ffffaa', stroke: '#000000', strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 0, fill: true }
    }).setOrigin(0.5).setDepth(301);

    // Nonagésimo cuarto pase: chiquito helper para que la píldora
    // (`mensajeFondo`) se oculte sola cuando no hay nada que mostrar —
    // en vez de tocar los ~7 lugares que hacían `mensajeText.setText(...)`
    // directo (estado-juego, jugador-unido, jugador-desconectado,
    // error-sala, error-jugada, x2 variantes de equipos/1v1) y arriesgar
    // dejar alguno sin actualizar, se centraliza en un solo punto.
    this._actualizarMensajeEstado = (texto, color) => {
      // Pase 438: mientras la tarjeta de espera está viva (se destruye en el primer render de la partida) el
      // cartelito de mensajes de la mesa no se muestra — si asomaba por un borde del fondo se veía una línea marrón.
      const esperando = !!(this.fondoEspera && this.fondoEspera.scene) && !this._salaEnJuego;
      if (esperando) texto = '';
      this.mensajeText.setText(texto || '');
      if (color) this.mensajeText.setColor(color);
      if (this.mensajeFondo) this.mensajeFondo.setVisible(!!texto);
    };

    // Pase siguiente: mismo estilo "pergamino con marco de madera" que ya
    // usa _crearBannerTexto para "hay un Envido pendiente...", "¿Querés
    // el Truco?", etc — antes este texto (resultado de Envido/Flor,
    // "Fulano cantó Truco", "X tantos en mesa") tenía su propio look con
    // fondo negro semitransparente, inconsistente con el resto de los
    // carteles de la mesa. Como cantoText es un objeto ÚNICO y
    // persistente (no vive en `_sprites`, sobrevive a cada re-render —
    // ver comentario en _mostrarCanto/_ocultarCanto más abajo), el
    // banner de imagen se arma y destruye aparte en cada show/hide en
    // vez de reusar _crearBannerTexto directamente (esa crea un
    // container nuevo cada vez, pensado para los carteles que si viven
    // en `_sprites`).
    this.cantoText = this.add.text(400, this._L ? this._L.feltCY : 300, '', {
      fontFamily: 'Nunito, Arial', fontSize: '14px', fontStyle: 'bold', color: '#4A2C2A',
      align: 'center', wordWrap: { width: 620 }
    }).setOrigin(0.5).setDepth(250).setVisible(false);
    this.cantoBanner = null;

    // Septuagésimo primer pase: reubicado junto con manoIconoPropio/
    // miManoTexto (mismo motivo — ver comentario ahí arriba), manteniendo
    // el mismo desplazamiento relativo (20px arriba, centrado sobre el par
    // ícono+texto de "mano").
    // Pase siguiente (feedback del usuario: el amarillo/naranja brillante
    // "desentona con el tono rústico de madera" del resto de la mesa) —
    // de un dorado neón (#FFD700 + contorno negro puro) a un dorado cálido
    // más apagado (mismo tono que `remacheClaro`, el brillo que ya usan
    // los remaches de bronce de esta escena) con contorno chocolate en vez
    // de negro puro, mismo criterio que el resto del texto de esta mesa
    // (scoreText, mensajeText).
    // Nonagésimo segundo pase: bajado y corrido hacia adentro (678,450 →
    // 665,478) — pedido explícito del usuario, invadía el costado derecho
    // de la mesa/el paño.
    // Nonagésimo tercer pase: "Sos mano" (arriba, ver `miManoTexto`) y
    // "Tu turno" colisionaban — Opción B pedida por el usuario: columna
    // con ~8px de aire entre ambas. Corrido a X=690 (centrado respecto al
    // ícono+texto de "Sos mano", que arrancan en X=650/666) y bajado a
    // Y=488 (fila de abajo, 26px por debajo de "Sos mano" en Y=462: alto
    // de línea ~18px + 8px de aire).
    // Nonagésimo quinto pase: Y bajado de 488 a 500 — con el badge de
    // atrás pasando de una cajita ceñida al texto (24px de alto) a la
    // placa/faja de madera ilustrada (ver `turnoPlaca` abajo, bastante
    // más alta por su proporción real ~2.26:1), hace falta más aire
    // contra "Sos mano" (icono+texto en Y=462, borde inferior ~474) para
    // no pisarlo. X=690 queda igual — esa columna está libre de la
    // botonera (que termina en X≈636) hasta bien abajo, así que no hay
    // límite por ese lado.
    // Nonagésimo séptimo pase: se sacó la placa/faja de madera ilustrada
    // que tenía atrás (pase 95, PNG con remaches de bronce) — pedido
    // explícito del usuario: "el panel de madera detrás del tu turno lo
    // sacamos". Queda solo el texto, sin placa ni pulso de atención
    // detrás (el pulso vivía en `this.turnoPlaca`, que ya no existe). El
    // Y=500 queda igual aunque ya no haga falta el aire extra contra
    // "Sos mano" que pedía la placa alta — mover el texto de vuelta no se
    // pidió.
    this.turnoText = this.add.text(this._L ? this._L.turnoX : 690, this._L ? this._L.turnoY : 500, '', {
      font: 'bold 15px Arial', fill: '#F0D9A0', stroke: '#2a1c14', strokeThickness: 3
    }).setOrigin(0.5).setDepth(200);

    this.timerText = this.add.text(400, 45, '', {
      font: 'bold 14px Arial', fill: '#ff8888', stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5).setDepth(301);

    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        if (!this._deadlineTimer) {
          this.timerText.setText('');
          return;
        }
        const restante = Math.max(0, Math.ceil((this._deadlineTimer - Date.now()) / 1000));
        // Pase siguiente: el número de cuenta atrás se oculta cuando el
        // anillo está dibujado (es el turno de otro asiento con anillo) —
        // mostrar los dos juntos quedaba redundante, y el anillo ya es el
        // pedido del usuario para ese caso. Pase 182: en equipos ya no es
        // "rival" nada más — ahora el turno de un compañero también dibuja
        // anillo (ver `_dibujarJugador` e `if (esSuTurno)` ahí), así que
        // este chequeo de `_anilloRect` sigue cubriendo todos los casos sin
        // cambios. Solo el turno PROPIO usa su propio anillo aparte (ver el
        // bloque `e.turno === 'mio'` más abajo en _renderizarEstado).
        if (this._anilloRect) {
          this.timerText.setText('');
        } else {
          this.timerText.setText(restante > 0 ? `⏱ ${restante}s` : '');
          this.timerText.setColor(restante <= 5 ? '#ff3333' : '#ff8888');
        }
      }
    });

    // Pase siguiente: el anillo se dibuja en un loop APARTE, mucho más
    // seguido (60ms, ~16 veces por segundo) que el del número de arriba
    // (500ms) — el usuario notó que la animación se veía "a los saltos".
    // Separado del tick de arriba a propósito: no tiene sentido redibujar
    // un Graphics 16 veces por segundo solo para mostrar el mismo texto.
    this.time.addEvent({
      delay: 60,
      loop: true,
      callback: () => {
        if (this._anilloRect && this._deadlineTimer && this._deadlineTimerTotal) {
          const restanteMs = Math.max(this._deadlineTimer - Date.now(), 0);
          const porcentaje = Math.min(1, restanteMs / this._deadlineTimerTotal);
          this._dibujarAnilloTiempo(this._anilloRect, porcentaje);
        } else {
          this.anilloTiempo.clear();
        }
      }
    });

    // Mientras se espera al rival, ocultamos la mesa del juego para que no
    // se vea duplicada contra la mesa que ya trae dibujada fondoEspera.
    // Se vuelve a mostrar en el handler de 'partida-iniciada'.
    this.mesaImg.setVisible(false);
    this.sombraMesa.setVisible(false);
    // Pase 346: las placas de puntaje ("test32 0" / "Rival 0") no tienen
    // sentido antes de que arranque la partida — se ocultan acá y se
    // muestran de nuevo en 'partida-iniciada', en el modo preview y al
    // primer _renderizarEstado.
    this._mostrarMarcadores(false);

    // Tarjeta de espera — tapa la mesa vacía hasta que arranca la partida.
    // Se destruye sola en el primer _limpiarSprites (primer estado-juego).
    this.fondoEspera = this.add.image(400, 300, 'fondoEspera').setDisplaySize(800, 600).setDepth(340);
    if (this._L) this._cubrirEstatico(this.fondoEspera);
    this._sprites.push(this.fondoEspera);
    this.veloEspera = this.add.rectangle(400, 300, this._L ? Math.max(800, this._vistaEspera().w + 60) : 800, this._L ? Math.max(this._L.H8 + 4, this._vistaEspera().h + 60) : 600, 0x000000, 0.35).setDepth(350);
    this._sprites.push(this.veloEspera);
    // Pase 438: el cartelito inicial "Conectando..." de la mesa no debe verse detrás de la sala de espera.
    if (this._actualizarMensajeEstado) this._actualizarMensajeEstado('');

    // Pase 267, punto 5: "romper el vacío del paño verde... agregar en el
    // fondo (con opacidad muy suave) un par de naipes flotantes" — se
    // reutiliza el dorso de carta ya cargado (`cardBack`, ver preload),
    // sin generar ningún asset nuevo. Van por ENCIMA del velo oscuro
    // (depth 351, `veloEspera` es 350) para no quedar completamente
    // lavados por él, pero bien por DEBAJO de la fila de avatares/título
    // (depth 400+) para que se lean como atmósfera de fondo, no como
    // contenido. No se les aplica blur real (`postFX`, solo WebGL — con
    // `Phaser.AUTO` el juego puede caer en Canvas en algunos dispositivos
    // y ahí `postFX` no existe) — la opacidad bien baja ya alcanza para
    // que no compitan visualmente con nada.
    [
      { x: 110, y: 480, angle: -22, scale: 0.85 },
      { x: 690, y: 130, angle: 18, scale: 0.95 },
      { x: 650, y: 470, angle: -10, scale: 0.7 },
    ].forEach(({ x, y, angle, scale }) => {
      const naipe = this.add.image(x, y, 'cardBack')
        .setDisplaySize(70 * scale, 100 * scale)
        .setAngle(angle)
        .setAlpha(0.12)
        .setDepth(351);
      this._sprites.push(naipe);
    });

    // Pase 208: se saca la tarjetita de pergamino chica que tapaba media
    // pantalla ("Esperando rival..." + punto dorado pulsando) — a pedido
    // del usuario, se reemplaza por una fila de avatares reales (uno por
    // asiento de la sala) con anillo dorado + "Conectado"/"Conectando..."
    // debajo de cada uno (ver _redibujarFilaEspera/_dibujarTileEspera más
    // abajo), directo sobre el fondo verde de fondoEspera — sin tarjeta de
    // por medio, igual que la referencia que pasó el usuario. `panelEspera`
    // se mantiene (mismo nombre, se sigue mostrando/ocultando en los mismos
    // lugares) pero ahora solo contiene el título de arriba y el botón de
    // volver — la fila de avatares en sí vive AFUERA de este container,
    // como objetos de escena sueltos (mismo criterio que mesaImg/fondoEspera
    // más arriba), porque sus posiciones se recalculan en coordenadas
    // absolutas según cuántos asientos tenga la sala.
    this.panelEspera = this.add.container(400, 300).setDepth(400);

    // Pase 209: título agrandado (20→28px) junto con el resto de la
    // pantalla de espera.
    // Pase 210: el simple add.text de acá se reemplaza por el banner de
    // pergamino real (_actualizarBannerEsperaTitulo/_crearBannerTexto) —
    // pedido del usuario ("cambiar el estilo... muy chiquito y apenas se
    // lee"). Vive AFUERA de panelEspera (como objeto de escena suelto,
    // mismo criterio que la fila de avatares) porque _crearBannerTexto ya
    // posiciona su container en coordenadas absolutas — se destruye junto
    // con el resto de la sala de espera en 'partida-iniciada'/preview (ver
    // _destruirBannerEsperaTitulo en esos puntos, _conectarSocket).
    this._actualizarBannerEsperaTitulo('Conectando con la sala...');
    // Pase 434: solo el texto de estado (sin moneda) debajo de la fila de avatares.
    this._crearCentroEspera();

    // Pase siguiente: bug de coordenadas — `_crearBoton` crea su propio
    // `this.add.container(x, y)` posicionado en coordenadas de ESCENA
    // (absolutas). Acá el botón se agrega como hijo de `panelEspera`
    // (que ya está en (400,300)), así que sus x/y pasan a ser relativos
    // AL PANEL — con (400,340) terminaba renderizando en (800,640),
    // fuera del canvas de 800x600 (por eso "no aparece el botón para
    // volver al lobby" en web). El resto de los elementos del panel
    // (texto, punto animado) ya usan coordenadas relativas al centro del
    // panel (0,0) — el botón tiene que hacer lo mismo.
    // Pase 208: bajado de y=45 a y=195 — con la fila de avatares ocupando
    // el centro de la pantalla (ver _redibujarFilaEspera, fila en y=280
    // absoluto = -20 relativo a este panel), el botón necesita quedar
    // debajo de las tarjetas de estado/nombre de cada avatar, no
    // superpuesto con ellas.
    // Pase 209: botón agrandado (180x44 → 240x56, fuente 15→19) junto con
    // el resto de la pantalla de espera.
    // Pase 210: fondo de color plano reemplazado por el tablón de madera
    // real que mandó el usuario ("un tablón para reemplazar el botón de
    // volver al lobby por ese fondo, con el texto dentro") — mismo
    // mecanismo `imagen`+`texto` que ya usa "Tengo [puntos]" en
    // _crearBoton (el texto se dibuja horneado encima, con contorno negro,
    // porque el archivo no trae el texto adentro). El ancho sale de
    // `_anchoBotonImagen` (mismo criterio que el resto de los botones-
    // imagen) para no estirar el arte a un aspecto que no es el suyo.
    // Pase 211: bug real reportado ("el tablón se ve muy pequeño detrás
    // del texto") — el archivo original que mandó el usuario es un
    // lienzo cuadrado de 500x500 con el tablón real ocupando solo una
    // franja angosta en el medio (490px de ancho x 240px de alto, no
    // 500x500), y `_anchoBotonImagen` calcula el ancho a partir del
    // aspecto del ARCHIVO ENTERO — con el lienzo cuadrado eso daba un
    // ancho casi igual al alto (56px), un tablón diminuto estirando todo
    // el lienzo (con su relleno transparente) a esa cajita chica. Se
    // recortó el PNG a su contenido real (490x248, ver comentario en
    // preload) y se subió el alto acá (56→100) para que el tablón real
    // (aspecto ~2:1, más "achatado" que un botón normal) tenga lugar
    // para el texto sin quedar apretado.
    // Pase 267, punto 4: el tablón de madera (esquinas rectas, "esquinas
    // de hierro pesadas" según el usuario) se reemplaza por el MISMO Botón
    // 3D Pill-shaped con nine-slice que ya se armó en el pase 266 para la
    // pantalla final (_crearBotonOverlay, variante 'dorado') — "que venimos
    // estandarizando en las demás pantallas", pedido explícito. Como esa
    // función posiciona su contenedor en coordenadas ABSOLUTAS de escena
    // (no relativas a un container padre, a diferencia de `_crearBoton`),
    // ya no se agrega como hijo de `panelEspera` — se pasa directo la
    // posición absoluta (panelEspera vive en (400,300), así que y=210
    // relativo pasa a ser 300+210=510 absoluto) y se deja que
    // `_crearBotonOverlay` lo empuje a `_sprites` por su cuenta (mismo
    // criterio que ya usa esa función para los botones de la pantalla
    // final). `setVisible(false)` sobre el contenedor sigue funcionando
    // igual, así que los dos puntos que ocultan `botonVolverEspera` más
    // abajo no necesitan tocarse.
    const textoVolverEspera = 'Volver al Lobby';
    const anchoVolverEspera = this._medirAnchoTextoOverlay(textoVolverEspera, '19px') + 50;
    this.botonVolverEspera = this._crearBotonOverlay({
      x: 400, y: 518, ancho: anchoVolverEspera, alto: 52, variante: 'rojo',
      texto: textoVolverEspera, tamanoFuente: 19,
      onClick: () => {
        this.socket.emit('cancelar-espera', { codigoSala: this.codigoSala });
        if (this.onVolverLobby) this.onVolverLobby();
      }
    }).contenedor;
    this._sprites.push(this.panelEspera);

    this._crearTexturaDorsoMini();
    this._crearTexturaDorsoGrande();

    this._conectarSocket();

    this.events.once('shutdown', this._limpiarSocketListeners, this);
    this.events.once('destroy', this._limpiarSocketListeners, this);
  }


 
  // ───────────────────────────────────────────────────────────────────────
  // Pase 394 — layout vertical para ventanas angostas (<700px).
  //
  // El mundo logico sigue teniendo 800 de ancho "de diseño" pero en este
  // modo la camara muestra solo 720 unidades de ancho (x de 40 a 760) y el
  // ALTO del mundo sale del alto real de la ventana (H = 720 * alto/ancho,
  // tipicamente 1100-1600 en un celular o una ventana angosta). Toda la
  // geometria que depende de ese alto vive en este objeto — el resto del
  // archivo solo lee `this._L` (que es null en escritorio, asi que el
  // layout 4:3 de siempre no cambia). Nada se calcula dos veces: si hay que
  // mover algo de la mesa angosta, se cambia ACA.
  // ───────────────────────────────────────────────────────────────────────
  _calcularLayoutAngosto() {
    const WN = 720;
    const cw = this.scale.width;
    const ch = this.scale.height;
    const zoom = cw / WN;
    const H = ch / zoom;
    // Pase 400: en ventanas muy altas (alto/ancho > 1.8) todo el juego se arma
    // como si la ventana midiera 1.8x el ancho y se apoya abajo (botonera en
    // el borde inferior); el sobrante queda ARRIBA con solo el fondo de madera.
    // Los calculos de abajo usan `Hg` y al final se suma `yOff` a cada Y.
    const Hg = Math.min(H, WN * 1.8);
    const yOff = H - Hg;
    // Modo "estatico" (sala de espera / pantalla final): se muestra el mundo
    // 800x600 de siempre, centrado, con los fondos estirados a cubrir.
    const zoom8 = cw / 760;   // sala de espera / pantalla final: 760 de ancho de mundo visible
    const H8 = ch / zoom8;

    // Factor de tamaño de cartas segun cuanto alto hay: en ventanas angostas pero
    // bajitas (alto/ancho ~1.2-1.5) las cartas grandes se pisarian entre si.
    const f = Math.max(0.62, Math.min(1, 0.62 + ((Hg - 860) / 440) * 0.38));
    const kp = 1.3;                      // placas del marcador
    const placaW = Math.round(96 * kp);
    const placaH = Math.round(60 * kp);   // Pase 450/451: placa más alta para nombre (13px) + puntaje (28px)
    // Pase 396: marcador VOS | RIVAL centrado arriba del mazo del rival (igual que el nativo)
    const hudYBase = 100;
    const placaVosX = 400 - 8 - placaW / 2;
    const placaRivalX = 400 + 8 + placaW / 2;

    // Botonera + mano (abajo, pegadas al borde inferior)
    const panelW = 700;
    const panelH = Math.round(panelW * 193 / 700);
    const panelTop = Hg - panelH;
    const panelCY = Hg - panelH / 2;
    // Pase 402: la carta de la mano nunca es mas alta que la botonera de madera. Pase 546: +15% (tope 1.95 / 1.2x la botonera) — pedido: las cartas se veían chicas en el celular.
    const kMano = Math.min(1.95 * f, 1.2 * panelH / 118);
    const manoY = panelTop - 6;

    // Mesa: la imagen se parte en TRES franjas y solo la del medio se
    // estira (un corte fino en el punto mas ancho del paño; la marca "TC"
    // va aparte, ver `marcaTcMesa`): asi la mesa gana alto como un ovalo largo (aro de arriba y de
    // abajo intactos, lados rectos) en vez de deformarse como un barril.
    // Pase 396: la mesa YA NO se estira (en la web angosta quedaba como un
    // ovalo gigante). Se muestra con su proporcion real, con perspectiva y
    // patas, centrada en el espacio libre entre el marcador y la mano, y el
    // piso/pared de la cantina asoma alrededor, igual que en el nativo.
    // Solo si la ventana es muy baja la mesa se achica (nunca baja de 0.8).
    const kRival = 1.7 * f;
    const rivalH = 95 * kRival;
    const bultoR = 9 * kRival;
    const nombreH = 28;                                // linea con el nombre del rival, sobre sus cartas
    const hudBottomBase = hudYBase + placaH / 2;
    const handH = 118 * kMano;
    const handTop = manoY - 0.85 * handH - 19 * kMano;
    const regionTop = hudBottomBase + 12;
    const tableBottomMax = panelTop + 20;
    // Pase 399: la mesa escala IGUAL en X e Y (nunca se estira solo en vertical,
    // eso deformaba la madera y la perspectiva). Se usa la escala mas grande
    // (hasta 1.30) que entra entre el mazo del rival y la mano; el aro puede
    // asomar por los lados de la pantalla, como en el nativo. Las patas quedan
    // detras de la mano y el mazo del rival va sobre el borde superior del paño.
    const CORTE_A = 255;                               // fila (de 895) donde empieza la franja del medio (sin estirar)
    const CORTE_B = 267;
    // Pase 401: las patas (filas CORTE_C..895, solo madera lisa) se dibujan a
    // PIES_Y de su alto para que la mesa no quede "alta y flaca": el paño
    // queda mas cerca del centro y la mano tapa lo que sobra. El aro y el
    // paño mantienen la escala 1:1.
    const CORTE_C = 722;
    const PIES_Y = 0.55;
    const filaTotal = CORTE_A + (CORTE_B - CORTE_A) + (CORTE_C - CORTE_B) + (895 - CORTE_C) * PIES_Y;   // alto "natural" en filas del PNG
    const topExtras = rivalH / 2 + bultoR + nombreH + 28;   // lo que ocupa el mazo del rival + su nombre sobre el borde de la mesa
    const tableBottom = Math.min(tableBottomMax, handTop + handH * 0.50);
    const htabDisp = tableBottom - (regionTop + topExtras);
    let sT = 1.07;                                     // Pase 401: el aro solo asoma ~2-3% por lado (como el nativo)
    while (sT > 0.8 && filaTotal * (700 * sT / 1169) > htabDisp) sT -= 0.02;
    sT = Math.max(0.8, sT);
    const tableW = Math.round(700 * sT);
    const u = tableW / 1169;
    const altoTopNat = CORTE_A * u;
    const altoBotNat = (CORTE_C - CORTE_B) * u + (895 - CORTE_C) * u * PIES_Y;
    const hNat = altoTopNat + (CORTE_B - CORTE_A) * u + altoBotNat;
    // Pase 546: en celulares altos (alto/ancho > ~1.8) todo quedaba apoyado abajo y arriba sobraba un tercio de
    // pantalla vacío. La mesa NO se estira (E = 0, sin deformar — el estirado de la franja media se probó y se
    // descartó): el sobrante se usa devolviendo a las patas su largo natural (PIES_Y sube de 0.55 hacia 1.0, son
    // madera lisa y no se nota), hasta que el marcador llegue a HUD_ABS_OBJETIVO (debajo de ajustes/chat).
    // Con ventanas bajas el sobrante es 0 y todo queda igual que antes.
    const E = 0;                                       // sin estirado vertical
    const slackSobra = Math.max(0, htabDisp - hNat);
    const tableTop0 = tableBottom - hNat;
    const HUD_ABS_OBJETIVO = 205;
    const filasPies = 895 - CORTE_C;
    const piesExtra = Math.max(0, Math.min(filasPies * u * (1 - PIES_Y), Math.round(tableTop0 - 220 + yOff - HUD_ABS_OBJETIVO)));
    const PIES_FINAL = PIES_Y + piesExtra / (filasPies * u);
    const tableTop = tableTop0 - piesExtra;
    const rivalY = tableTop - 40;                      // Pase 401: el mazo apoya en el borde superior del paño, sin entrar a la zona de jugadas
    const nombreY = rivalY - rivalH / 2 - bultoR - nombreH / 2 - 2;
    const feltCY = tableTop + 149 * sT + E / 2;
    const feltRY = 170 * sT + E / 2;
    const feltH = 203 * sT + E;                        // alto visible del paño verde (Pase 546: incluye el estirado E)
    const dueloEscala = Math.min(0.66 * 1.9 * f, 0.95 * feltH / 234);   // Pase 546: 0.82 -> 0.95 (cartas jugadas ~16% más grandes, siguen entrando en el paño)
    // Pase 401: el marcador queda anclado ~220 sobre el borde alto de la mesa (justo arriba del nombre/mazo del rival) (no se despega en ventanas altas)
    const hudYFinal = piesExtra > 0 ? tableTop - 220 : Math.max(hudYBase, tableTop - 220);   // Pase 546: con patas alargadas el marcador sube hasta HUD_ABS_OBJETIVO (sin el piso de 100)
    const hudBottom = hudYFinal + placaH / 2;

    // eq3 se calcula en el espacio del grupo (0..Hg) y luego se desplaza
    const eq3 = (() => {
      const nTop = hudBottom + 28;
      const nBot = manoY + 25;
      const gy = Math.max(0.8, Math.min(2.2, (nBot - nTop) / 490));
      return { cyOld: 320, cy: nBot - 200 * gy + yOff, gy };
    })();

    return {
      zoom, H, zoom8, H8, WN, yOff,
      kp, placaW, placaH, hudY: hudYFinal + yOff, placaVosX, placaRivalX,
      panelW, panelH, panelTop: panelTop + yOff, panelCY: panelCY + yOff, kMano, manoY: manoY + yOff,
      tableW, u, CORTE_A, CORTE_B, CORTE_C, PIES_Y: PIES_FINAL, altoTopNat, altoBotNat: altoBotNat + piesExtra, E, tableTop: tableTop + yOff, tableBottom: tableBottom + yOff,
      rivalY: rivalY + yOff, kRival, nombreY: nombreY + yOff, sT,
      feltCY: feltCY + yOff, feltRY, dueloY: feltCY + yOff, dueloEscala, kBoton: 1.15 + 0.15 * f,
      kSeat: 1.35, perspCY: feltCY + yOff, perspRY: feltRY,
      eq2: { cyOld: 250, cy: feltCY + yOff, gy: (137 * sT + E / 2) / 130 },
      eq3,
      indicadoresX: 62, manoIndY: panelTop - 26 + yOff, turnoX: 650, turnoY: panelTop - 26 + yOff,
    };
  }

  // Mapeo vertical de los asientos de 2v2/3v3 (null en 1v1 y en escritorio): las
  // posiciones se calculan en el mundo viejo y se estiran en vertical alrededor del
  // centro de la mesa para llenar el alto de la ventana.
  _yEq(y) {
    const m = this._eqMap;
    return m ? m.cy + (y - m.cyOld) * m.gy : y;
  }

  // 'juego': 720 de ancho de mundo, alto H. 'estatica': el 800x600 de
  // siempre centrado (sala de espera y pantalla final, que estan dibujadas
  // con coordenadas fijas sobre ese tamaño).
  _modoCamaraAngosto(modo) {
    const L = this._L;
    if (!L || this._modoCamara === modo) return;
    this._modoCamara = modo;
    const cam = this.cameras.main;
    if (modo === 'juego') {
      cam.setZoom(L.zoom);
      cam.centerOn(400, L.H / 2);
    } else {
      cam.setZoom(L.zoom8);
      cam.centerOn(400, 300);
    }
    if (this.vinetaMesaImg) this.vinetaMesaImg.setVisible(modo === 'juego');
  }

  // Cubre todo el area visible (en modo estatico) con una imagen sin
  // deformarla: toma la escala que llena ancho y alto y deja que la
  // camara recorte el sobrante.
  _cubrirEstatico(img, centroY = 300) {
    const L = this._L;
    if (!L || !img) return img;
    const src = img.texture.getSourceImage();
    // Pase 438: cubre la vista REAL de la cámara con 60 de margen (antes 800 x H8+4 justos: en celulares
    // quedaban franjas de madera arriba/abajo con el cartelito de mensajes asomando — la "línea marrón").
    const v = this._vistaEspera();
    const sc = Math.max(800 / src.width, (L.H8 + 4) / src.height, (v.w + 60) / src.width, (v.h + 60) / src.height);
    img.setDisplaySize(src.width * sc, src.height * sc).setPosition(400, centroY);
    return img;
  }

  _acomodarFondosAngosto() {
    const L = this._L;
    const tex = this.textures.get('fondoMesa').getSourceImage();
    const sc = Math.max(800 / tex.width, L.H / tex.height);
    this.fondoMesaImg.setDisplaySize(tex.width * sc, tex.height * sc).setPosition(400, L.H / 2);
    this.vinetaMaderaImg.setDisplaySize(800, L.H).setPosition(400, L.H / 2);
    this.vinetaMesaImg.setDisplaySize(800, L.H).setPosition(400, L.H / 2);
    const altoMesaTotal = L.tableBottom - L.tableTop;
    const centroMesa = (L.tableTop + L.tableBottom) / 2;
    const escY = altoMesaTotal / 528;   // el halo se estira junto con la mesa
    if (this.resplandorMesaImg) this.resplandorMesaImg.setPosition(400, centroMesa).setScale(1, escY);
    if (this.luzCalidaMesaImg) this.luzCalidaMesaImg.setVisible(false);   // estirado dejaba un arco visible sobre el paño
    if (this.sombraMesa) this.sombraMesa.setPosition(400, L.tableBottom - 30).setSize(620, 110);
  }

  _ajustarMesaSegunAsientos(cantidadAsientos) {
  const modo = cantidadAsientos === 5 ? '3v3' : 'normal';
  if (modo === this._mesaModoActual) return;
  this._mesaModoActual = modo;
  // Pase 440: en 3v3 no va el halo cálido de atrás de la mesa (se leía como un haz de luz
  // descentrado); queda el fondo de madera con el viñeteado de las esquinas.
  // Pase 451: tampoco en 1v1 ni 2v2 — fondo de madera parejo en todos los modos (sin halo cálido ni luz arriba).
  if (this.resplandorMesaImg) this.resplandorMesaImg.setVisible(false);
  if (this.luzCalidaMesaImg) this.luzCalidaMesaImg.setVisible(false);

  // Multiplica el alto por encima de la proporción real del dibujo.
  // 1.0 = fiel al original (lo que se ve "aplastado").
  // Subilo de a 0.05 hasta que dej de leerse como plato.
  // Pase siguiente (corrección sobre la mesa nueva de 1v1/2v2): este
  // factor se había pensado para el asset VIEJO, una lámina casi plana
  // que necesitaba un estirado fuerte para no leerse como un plato. La
  // mesa nueva ya viene dibujada con perspectiva y patas propias — es una
  // ilustración 3D de por sí, no "aplastada" — así que aplicarle el mismo
  // 1.95x la deformaba de más (el marco de madera se estiraba demasiado
  // hacia abajo, achatando el paño y empujando las cartas jugadas). Sigue
  // usándose tal cual para 3v3 (mesa vieja, sin cambios), pero la rama
  // "normal" de acá abajo ahora tiene su propio factor, bien separado.
  const FACTOR_ALTURA = 1.95;
  // Pase 442: la mesa de 3v3 sube 40 px de diseño (asientos y zonas de cartas suben con ella) para dejar
  // aire entre las cartas tiradas y la mano propia.
  const ELEVACION_MESA_3V3 = 40;

  // Pase 394: en layout angosto la mesa de 1v1 se arma partida en dos
  // (aro estirado + patas), ver _calcularLayoutAngosto.
  if (this._L && modo !== '3v3') {
    const L = this._L;
    const clave = this.textures.exists('mesaRedondaLimpia') ? 'mesaRedondaLimpia' : 'mesaRedonda';
    this.mesaImg
      .setTexture(clave)
      .setCrop(0, 0, 1169, L.CORTE_A + 1)
      .setOrigin(0.5, 0)
      .setScale(L.u)
      .setPosition(400, L.tableTop);
    if (!this.mesaMedio) {
      this.mesaMedio = this.add.image(400, 0, clave).setDepth(1).setOrigin(0.5, 0);
      this.mesaPatas = this.add.image(400, 0, clave).setDepth(1).setOrigin(0.5, 0);
      this.mesaPies = this.add.image(400, 0, clave).setDepth(1).setOrigin(0.5, 0);
      if (clave === 'mesaRedondaLimpia' && this.textures.exists('marcaTcMesa')) {
        this.marcaTcMesa = this.add.image(0, 0, 'marcaTcMesa').setDepth(1.05);
      }
    }
    const yMedio = L.tableTop + L.altoTopNat;
    // franja estirable: un corte de (B-A) filas estirado hasta cubrir E px
    const filasMedio = L.CORTE_B - L.CORTE_A;
    const escMedioY = (L.E + filasMedio * L.u) / filasMedio;
    this.mesaMedio
      .setCrop(0, L.CORTE_A, 1169, filasMedio)
      .setScale(L.u, escMedioY)
      .setPosition(400, yMedio - L.CORTE_A * escMedioY)
      .setVisible(this.mesaImg.visible);
    const yFilaB = yMedio + L.E + filasMedio * L.u;      // y de la fila CORTE_B
    this.mesaPatas
      .setTexture(clave)
      .setCrop(0, L.CORTE_B - 1, 1169, L.CORTE_C - L.CORTE_B + 2)
      .setScale(L.u)
      .setPosition(400, yFilaB - L.CORTE_B * L.u)
      .setVisible(this.mesaImg.visible);
    // patas acortadas (solo madera lisa): escala Y reducida
    const yFilaC1 = yFilaB + (L.CORTE_C - 1 - L.CORTE_B) * L.u;   // y de la fila CORTE_C-1
    this.mesaPies
      .setTexture(clave)
      .setCrop(0, L.CORTE_C - 1, 1169, 895 - L.CORTE_C + 1)
      .setScale(L.u, L.u * L.PIES_Y)
      .setPosition(400, yFilaC1 - (L.CORTE_C - 1) * L.u * L.PIES_Y)
      .setVisible(this.mesaImg.visible);
    if (this.marcaTcMesa) {
      // la marca original (caja 130..1062 x 59..426 de la imagen) vuelve al centro del paño ya estirado
      this.marcaTcMesa
        .setScale(L.u)
        .setPosition(400 + ((130 + 1062) / 2 - 1169 / 2) * L.u, L.tableTop + ((59 + 426) / 2) * L.u + L.E / 2)
        .setVisible(this.mesaImg.visible);
    }
    return;
  }

  if (modo === '3v3') {
    const CROP = { x: 37, y: 876, width: 1128, height: 1064 };
    const anchoDisplay = 600;
    const altoDisplay = anchoDisplay * (CROP.height / CROP.width) * FACTOR_ALTURA;

    this.mesaImg
      .setTexture('mesaRedonda3v3')
      .setOrigin(0.5, 0.5)
      .setCrop(CROP.x, CROP.y, CROP.width, CROP.height)
      .setDisplaySize(anchoDisplay, altoDisplay)
      .setPosition(400, 220 - ELEVACION_MESA_3V3);
    if (this._L) {
      // Pase 394: la mesa de 3v3 se estira en vertical para llenar la ventana (ver eq3 en _calcularLayoutAngosto)
      const m = this._L.eq3;
      this.mesaImg.setScale(this.mesaImg.scaleX, this.mesaImg.scaleY * m.gy).setPosition(400, m.cy + (220 - ELEVACION_MESA_3V3 - m.cyOld) * m.gy);
      [this.mesaMedio, this.mesaPatas, this.mesaPies, this.marcaTcMesa].forEach(o => { if (o && o.scene) o.setVisible(false); });
    }
  } else {
    // 690 (antes 660, y 700 antes de eso) — el usuario había pedido achicarla
    // a 660 en su momento (octavo pase), pero en la ronda de crítica de
    // diseño general señaló que ahora sobra espacio vacío en los laterales.
    // Se subió un paso intermedio (no se volvió al 700 original, para no
    // deshacer del todo esa decisión anterior) — decimonoveno/vigésimo pase.
    // Esta rama ("normal", cantidadAsientos !== 5) es compartida por 1v1 Y
    // 2v2, así que el cambio afecta a los dos modos, no solo a 1v1 — si en
    // algún momento se quiere que 2v2 quede con su tamaño de antes, hay que
    // separar esta rama por cantidadAsientos en vez de por el booleano
    // modo === '3v3'. No se tocaron los radios de asientos (radioX/radioY
    // más abajo) — el cambio anterior (700→660, más grande que este) tampoco
    // los había tocado, así que se sigue el mismo criterio.
    //
    // Pedido del usuario: nuevo asset de mesa ("mesa-truco-nueva.png").
    // A diferencia del anterior, este ya viene recortado a su contenido
    // real (sin relleno transparente alrededor) — no hace falta ningún
    // `setCrop` con offsets a mano como con la lámina vieja de 1500x2700.
    // `.setCrop()` sin argumentos limpia cualquier recorte que haya
    // quedado de un cambio de modo anterior (3v3 usa su propio CROP más
    // arriba).
    //
    // Primer intento: mantener el mismo `FACTOR_ALTURA` (1.95) que ya
    // usaba la mesa vieja, razonando que la proporción real de esta
    // imagen (895/1169 ≈ 0.766) es casi idéntica a la del recorte viejo
    // (1088/1435 ≈ 0.758). Feedback real del usuario tras probarlo: la
    // mesa se veía deformada ("el borde de madera se estiró
    // excesivamente hacia abajo, achatando el paño y empujando las
    // cartas jugadas") — la diferencia de proporciones entre ambos
    // assets no era lo que importaba: el asset VIEJO era una lámina casi
    // plana que necesitaba ese estirado para dejar de verse como un
    // plato, mientras que el asset NUEVO ya es una ilustración con
    // perspectiva y patas propias, correctamente proporcionada de
    // entrada. Factor propio para esta rama, sin estirado (1.0 = fiel al
    // dibujo real) — si en el juego real se nota que igual le falta un
    // poco (se ve "achatada"), conviene subir esto de a 0.05 como dice el
    // comentario de `FACTOR_ALTURA` más arriba, no volver al 1.95 viejo.
    const FACTOR_ALTURA_MESA_NUEVA = 1.0;
    const anchoDisplay = 690;
    const altoDisplay = anchoDisplay * (895 / 1169) * FACTOR_ALTURA_MESA_NUEVA;

    this.mesaImg
      .setTexture('mesaRedonda')
      .setCrop()
      .setDisplaySize(anchoDisplay, altoDisplay)
      .setPosition(400, 340);
  }
}

_crearTexturaDorsoMini() {
  // Décimo pase: en vez de bakear directo al tamaño final de display,
  // primero se genera un "master" de calidad fija (ver el mismo criterio
  // en _crearTexturaDorsoGrande, comentario más abajo) y de ahí se saca
  // la textura final según el dpr real. El bake es 100% offline (canvas
  // 2D, no GPU) así que no cuesta FPS en tiempo real.
  // Pase 209: 56x86 → 45x69 (mismo aspecto ~0.65) — pedido del usuario, los
  // dorsos de la mano de rivales/compañeros en equipos (2v2/3v3, es la
  // única textura que usa esta función, ver _dibujarJugador) se sentían
  // "un poco grandes".
  const ANCHO_FINAL = 45;
  const ALTO_FINAL  = 69;
  // 5x cubre el peor caso real: zoom de cámara 1.5 * dpr hasta 3 = 4.5x,
  // con un poco de margen (ver _factorEscalaTextura).
  const FACTOR_CALIDAD_FIJO = 5;
  const src = this.textures.get('cardBack').getSourceImage();
  const masterAncho = Math.min(src.width, ANCHO_FINAL * FACTOR_CALIDAD_FIJO);
  const masterAlto  = Math.min(src.height, ALTO_FINAL * FACTOR_CALIDAD_FIJO);
  this._crearTexturaEscalada('cardBack', 'cardBackMiniMaster', masterAncho, masterAlto);

  const factor = this._factorEscalaTextura();
  const anchoR = Math.round(ANCHO_FINAL * factor);
  const altoR  = Math.round(ALTO_FINAL * factor);
  this._claveDorsoMiniActual = `cardBackMini_${anchoR}x${altoR}`;
  this._crearTexturaEscalada('cardBackMiniMaster', this._claveDorsoMiniActual, anchoR, altoR);
  this._crearTexturasDorsoPerspectiva(this._claveDorsoMiniActual, anchoR, altoR);
}

// Pase 441: mazos en perspectiva para los asientos de 3v3. Se hornean en canvas a partir del
// mismo dorso elegido (clásico o nuevo): 'izq' y 'der' son el dorso visto de tres cuartos (el
// borde que mira a la mesa se achica y se oscurece), 'arriba' es el dorso visto en fuga (el borde
// lejano se angosta). Se cortan en tiras para lograr el trapecio, que un transform 2D no da.
_crearTexturasDorsoPerspectiva(claveBase, anchoR, altoR) {
  const src = this.textures.get(claveBase).getSourceImage();
  this._clavesDorsoPersp = this._clavesDorsoPersp || {};
  ['izq', 'der', 'arriba'].forEach((lado) => {
    const clave = `${claveBase}_p_${lado}`;
    this._clavesDorsoPersp[lado] = clave;
    if (this.textures.exists(clave)) return;
    const cv = document.createElement('canvas');
    cv.width = anchoR;
    cv.height = altoR;
    const ctx = cv.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (lado === 'arriba') {
      const N = Math.max(10, Math.round(altoR / 2));
      const hd = altoR * 0.88, y0 = (altoR - hd) / 2;
      for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N;               // 0 = borde lejano (arriba)
        const g = 0.86 + 0.14 * t;
        const sy = (i * altoR) / N;
        ctx.drawImage(src, 0, sy, anchoR, altoR / N, anchoR * (1 - g) / 2, y0 + (i * hd) / N, anchoR * g, hd / N + 0.8);
      }
    } else {
      const N = Math.max(10, Math.round(anchoR / 2));
      const wd = anchoR * 0.84, x0 = (anchoR - wd) / 2;
      for (let i = 0; i < N; i++) {
        const t = (i + 0.5) / N;               // 0 = borde izquierdo
        const lejos = lado === 'izq' ? t : 1 - t;   // el borde que mira a la mesa es el lejano
        const f = 1 - 0.14 * lejos;
        const sh = altoR * f;
        ctx.drawImage(src, (i * anchoR) / N, 0, anchoR / N, altoR, x0 + (i * wd) / N, (altoR - sh) / 2, wd / N + 0.8, sh);
      }
    }
    // sombreado: el lado lejano se oscurece
    ctx.globalCompositeOperation = 'source-atop';
    const gr = lado === 'arriba'
      ? ctx.createLinearGradient(0, 0, 0, altoR)
      : (lado === 'izq' ? ctx.createLinearGradient(0, 0, anchoR, 0) : ctx.createLinearGradient(anchoR, 0, 0, 0));
    if (lado === 'arriba') { gr.addColorStop(0, 'rgba(0,0,0,0.32)'); gr.addColorStop(0.7, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); }
    else { gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.34)'); }
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, anchoR, altoR);
    ctx.globalCompositeOperation = 'source-over';
    this.textures.addCanvas(clave, cv);
  });
}

_factorEscalaTextura() {
  if (this._L) return this._L.zoom;   // Pase 394: px reales por unidad de mundo (layout angosto)
  // Décimo pase — bug de fondo encontrado al investigar por qué el fix del
  // dorso "no se notaba": TODO el pre-escalado de texturas de este archivo
  // (botones, cartas jugadas, cartas reveladas, mano propia, dorso) venía
  // usando devicePixelRatio SOLO, pero el zoom de cámara real que se aplica
  // en create() es `(ANCHO_MAX_CSS/800) * dpr` (ver setZoom) — o sea que 1
  // unidad del mundo equivale a esa cantidad de píxeles reales del backing
  // store, no a dpr solo. Faltaba ese factor en todos lados: cada textura
  // cacheada quedaba más chica de lo que el backing store real necesita, en
  // CUALQUIER pantalla (no solo en las de dpr=1) — por eso varios ajustes
  // de esta sesión "no se notaban" tanto como deberían.
  // Este es el factor correcto a usar para cualquier pre-escalado de
  // textura de acá en adelante — reemplaza a `window.devicePixelRatio`
  // solo en todos los `_crearTexturaEscalada`/dorso de este archivo.
  // Undécimo pase: usa la constante importada `ANCHO_MAX_CSS` (ahora 900,
  // antes 1200) en vez de un literal repetido a mano — mismo motivo que en
  // create(), ver el comentario ahí.
  return (ANCHO_MAX_CSS / 800) * (window.devicePixelRatio || 1);
}

// Duodécimo pase: Máscara de Enfoque (Unsharp Mask) aplicada en cada paso de
// reducción de `_crearTexturaEscalada`. Idea que trajo el usuario de otra IA,
// verificada antes de aplicarla a ciegas: se probó con el `back.png` real,
// comparando contra el pipeline actual (sin afilado) y contra la otra
// sugerencia de esa misma IA (cachear al doble de tamaño y confiar en el
// escalado bilineal de la GPU vía `setScale`) — esa segunda idea NO mostró
// ninguna mejora real (el filtro bilineal de la GPU no le gana a este mismo
// pipeline), pero el afilado progresivo SÍ se nota: cada halving pierde
// contraste en los bordes finos porque el resample de alta calidad los
// promedia con los píxeles vecinos — reforzar el contraste de esos bordes
// ANTES de que se pierdan en el siguiente paso ayuda a que sobrevivan mejor.
// No "inventa" detalle que la resolución real no tiene (sigue limitado por
// los píxeles reales del backing store, igual que siempre), pero mejora la
// nitidez PERCIBIDA dentro de ese mismo límite. Los valores (radio, cantidad,
// umbral) se ajustaron a mano comparando varias intensidades — más de ~40%
// empieza a generar un halo visible alrededor de los bordes.
_aplicarUnsharpMask(ctx, ancho, alto, cantidad = 0.35, radioBlur = 1.0, umbral = 2) {
  const original = ctx.getImageData(0, 0, ancho, alto);

  const blurCanvas = document.createElement('canvas');
  blurCanvas.width = ancho;
  blurCanvas.height = alto;
  // Pase 545: willReadFrequently — este canvas se lee con getImageData; sin el flag Chrome (sobre todo en Android) lo deja en GPU y cada lectura frena el hilo.
  const blurCtx = blurCanvas.getContext('2d', { willReadFrequently: true });
  blurCtx.filter = `blur(${radioBlur}px)`;
  blurCtx.drawImage(ctx.canvas, 0, 0);
  const desenfocada = blurCtx.getImageData(0, 0, ancho, alto);

  const salida = ctx.createImageData(ancho, alto);
  const o = original.data, b = desenfocada.data, d = salida.data;
  for (let i = 0; i < o.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const diff = o[i + c] - b[i + c];
      d[i + c] = Math.abs(diff) >= umbral
        ? Math.max(0, Math.min(255, o[i + c] + cantidad * diff))
        : o[i + c];
    }
    d[i + 3] = o[i + 3]; // el alfa no se toca
  }
  ctx.putImageData(salida, 0, 0);
}


// Vigésimo primer pase ("iluminación y atmósfera"): dos texturas de
// gradiente radial generadas con canvas 2D (mismo mecanismo que
// `_crearTexturaEscalada`/`_aplicarUnsharpMask` — `document.createElement
// ('canvas')` + `this.textures.addCanvas`), armadas una sola vez.
// - `vinetaMesa`: transparente en el centro (radio 250, cubre la mesa y
//   las cartas), oscureciendo hacia las esquinas (radio 480, cerca de la
//   diagonal completa de 800x600 = 500) — el viñeteado clásico.
// - `luzCalidaMesa`: un halo ámbar centrado en el paño, transparente en el
//   borde, para simular una luz cálida sobre el centro de la mesa.
_crearTexturasAtmosfera() {
  if (this.textures.exists('vinetaMesa') && this.textures.exists('luzCalidaMesa')) return;

  if (!this.textures.exists('vinetaMesa')) {
    const cv = document.createElement('canvas');
    cv.width = 800; cv.height = 600;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(400, 300, 250, 400, 300, 480);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);
    this.textures.addCanvas('vinetaMesa', cv);
  }

  if (!this.textures.exists('luzCalidaMesa')) {
    const cv = document.createElement('canvas');
    cv.width = 800; cv.height = 600;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(400, 320, 0, 400, 320, 230);
    grad.addColorStop(0, 'rgba(255,196,110,0.30)');
    grad.addColorStop(1, 'rgba(255,196,110,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);
    this.textures.addCanvas('luzCalidaMesa', cv);
  }

  // Punto 6 de la crítica de mesa (sexagésimo primer pase): "el fondo de
  // madera de atrás se ve plano" — distinto del viñeteado del paño
  // (`vinetaMesa` arriba), que arranca transparente hasta radio 250 (ya
  // cubre la mesa) y recién oscurece en serio cerca de las esquinas
  // (radio 480) — la franja de madera que rodea la mesa, entre esos dos
  // radios, se queda casi sin tocar. Esta textura nueva es más angosta
  // (radio 260→420, calzada justo con el anillo de madera visible
  // alrededor de `mesaImg`) y usa un marrón cálido en vez de negro puro,
  // para sumar profundidad/densidad ahí sin repetir el mismo efecto que
  // ya tiene el paño.
  if (!this.textures.exists('vinetaMadera')) {
    const cv = document.createElement('canvas');
    cv.width = 800; cv.height = 600;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(400, 300, 260, 400, 300, 420);
    grad.addColorStop(0, 'rgba(30,15,8,0)');
    // Ducentésimo sexagésimo noveno pase: 0.38→0.48 — el usuario reportó
    // que el fondo de pared de madera oscura queda "tono sobre tono" con
    // la mesa (también de madera oscura), tragándosela. Oscurecer un poco
    // más el anillo de pared inmediato alrededor de la mesa (sin tocar el
    // paño, que sigue transparente hasta radio 260) le da más separación
    // tonal sin necesitar un asset de pared nuevo.
    grad.addColorStop(1, 'rgba(30,15,8,0.48)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);
    this.textures.addCanvas('vinetaMadera', cv);
  }

  // Ducentésimo sexagésimo noveno pase: "resplandorMesa" — halo cálido
  // detrás de la mesa (no sobre el paño: transparente hasta radio 230, el
  // mismo radio donde `luzCalidaMesa` ya cubre el centro del tapete) que
  // se hace más intenso justo en el borde exterior de la mesa/sus patas
  // (radio ~260-290) y se apaga de nuevo antes de la zona que oscurece
  // `vinetaMadera` (radio 420) — la idea es un "backlight" que separe la
  // mesa de la pared de atrás en vez de sumar otra capa pareja de luz
  // sobre todo el fondo. A diferencia de `luzCalidaMesa` (que se apaga en
  // modo oscuro porque quedaba como "una luz encendida detrás de las
  // cartas"), este halo se dibuja siempre: vive DETRÁS de la mesa
  // (depth 0.6, antes de `mesaImg` en depth 1), nunca se superpone a las
  // cartas ni a ningún elemento de juego.
  if (!this.textures.exists('resplandorMesa')) {
    const cv = document.createElement('canvas');
    cv.width = 800; cv.height = 600;
    const ctx = cv.getContext('2d');
    const grad = ctx.createRadialGradient(400, 320, 230, 400, 320, 360);
    grad.addColorStop(0, 'rgba(255,178,90,0)');
    grad.addColorStop(0.35, 'rgba(255,168,78,0.5)');
    grad.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);
    this.textures.addCanvas('resplandorMesa', cv);
  }
}

_crearTexturaEscalada(claveOriginal, claveNueva, anchoFinal, altoFinal) {
  if (this.textures.exists(claveNueva)) return;

  const src = this.textures.get(claveOriginal).getSourceImage();
  let ancho = src.width;
  let alto = src.height;
  let canvasActual = document.createElement('canvas');
  canvasActual.width = ancho;
  canvasActual.height = alto;
  let ctx = canvasActual.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0);

  while (ancho / 2 >= anchoFinal && alto / 2 >= altoFinal) {
    const siguienteAncho = Math.round(ancho / 2);
    const siguienteAlto = Math.round(alto / 2);
    const siguienteCanvas = document.createElement('canvas');
    siguienteCanvas.width = siguienteAncho;
    siguienteCanvas.height = siguienteAlto;
    const siguienteCtx = siguienteCanvas.getContext('2d', { willReadFrequently: true });   // Pase 545: se lee en _aplicarUnsharpMask
    siguienteCtx.imageSmoothingEnabled = true;
    siguienteCtx.imageSmoothingQuality = 'high';
    siguienteCtx.drawImage(canvasActual, 0, 0, ancho, alto, 0, 0, siguienteAncho, siguienteAlto);
    this._aplicarUnsharpMask(siguienteCtx, siguienteAncho, siguienteAlto);
    canvasActual = siguienteCanvas;
    ancho = siguienteAncho;
    alto = siguienteAlto;
  }

  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = anchoFinal;
  finalCanvas.height = altoFinal;
  const finalCtx = finalCanvas.getContext('2d', { willReadFrequently: true });   // Pase 545: se lee en _aplicarUnsharpMask
  finalCtx.imageSmoothingEnabled = true;
  finalCtx.imageSmoothingQuality = 'high';
  finalCtx.drawImage(canvasActual, 0, 0, ancho, alto, 0, 0, anchoFinal, altoFinal);
  this._aplicarUnsharpMask(finalCtx, anchoFinal, altoFinal, 0.35, 0.6, 2);

  this.textures.addCanvas(claveNueva, finalCanvas);
}

_crearTexturaDorsoGrande() {
  // 70x105 (antes 90x135) — tamaño real de display en el mundo del juego,
  // sin cambios (ver _dibujarFilaDorso). Lo que cambia acá (décimo pase) es
  // CÓMO se llega a ese tamaño final: antes se bakeaba directo desde el
  // arte original a 70x105 fijos, sin importar la pantalla del que juega —
  // es decir que ni siquiera una pantalla retina (dpr alto) recibía más
  // detalle que una de escritorio común, porque la textura cacheada YA
  // había tirado el detalle fino antes de llegar a la GPU.
  //
  // Ahora se bakea en DOS pasos: primero un "master" de calidad fija,
  // bastante por encima de cualquier dpr real de pantalla (FACTOR_CALIDAD_FIJO,
  // no depende del dispositivo del usuario), y de ahí recién se saca la
  // textura final al tamaño que corresponde según el devicePixelRatio real.
  // Los dos pasos usan el mismo canvas 2D offline de siempre (sin costo de
  // FPS en tiempo real — es trabajo que se hace una sola vez y se cachea),
  // así que esto NO es lo mismo que forzar supersampling en todo el canvas
  // (eso sí tiene costo de FPS porque redibuja TODO cada frame a mayor
  // resolución) — acá solo se sube la calidad de esta textura puntual ya
  // cacheada, el resto del juego sigue exactamente igual.
  // 63x95 (antes 70x105, vigésimo tercer pase) — mantener sincronizado a
  // mano con el `anchoCarta`/`altoCarta` de _dibujarFilaDorso, que es
  // donde se usa este tamaño como `setDisplaySize` real.
  const ANCHO_FINAL = 63;
  const ALTO_FINAL  = 95;
  // 5x cubre el peor caso real: zoom de cámara 1.5 * dpr hasta 3 = 4.5x,
  // con un poco de margen (ver _factorEscalaTextura).
  const FACTOR_CALIDAD_FIJO = 5;

  const src = this.textures.get('cardBack').getSourceImage();
  const masterAncho = Math.min(src.width, ANCHO_FINAL * FACTOR_CALIDAD_FIJO);
  const masterAlto  = Math.min(src.height, ALTO_FINAL * FACTOR_CALIDAD_FIJO);
  this._crearTexturaEscalada('cardBack', 'cardBackGrandeMaster', masterAncho, masterAlto);

  const factor = this._factorEscalaTextura();
  const anchoR = Math.round(ANCHO_FINAL * factor);
  const altoR  = Math.round(ALTO_FINAL * factor);
  this._claveDorsoGrandeActual = `cardBackGrande_${anchoR}x${altoR}`;
  this._crearTexturaEscalada('cardBackGrandeMaster', this._claveDorsoGrandeActual, anchoR, altoR);
}

// Pase 208 — pantalla de espera con avatares reales: destruye la fila de
// tiles (anillos, fotos, pills de estado, nombres) del render anterior
// antes de reconstruirla desde cero. Se llama al principio de cada
// _redibujarFilaEspera — reconstruir toda la fila en cada 'jugador-unido'
// es más simple y menos propenso a bugs que ir agregando/sacando tiles
// sueltos a medida que entra cada jugador.
_limpiarAvataresEspera() {
  (this._avataresEsperaSprites || []).forEach(s => { if (s && s.destroy) s.destroy(); });
  const viejos = new Set(this._avataresEsperaSprites || []);
  this._sprites = this._sprites.filter(s => !viejos.has(s));
  this._avataresEsperaSprites = [];
  // Pase 267, punto 3: el badge "Conectando..." usa un `time.addEvent` en
  // loop para animar los 3 puntitos (ver _dibujarTileEspera) — a
  // diferencia de un Tween (que Phaser ya tolera bien sobre un target
  // destruido, mismo criterio que el marco gris pulsando de siempre), un
  // timer en loop SIGUE disparando y tratando de hacer `.setText()` sobre
  // un Text ya destruido si no se lo frena acá explícitamente.
  (this._avataresEsperaTimers || []).forEach(t => { if (t && t.remove) t.remove(); });
  this._avataresEsperaTimers = [];
}

// Pase 346: muestra/oculta las placas de puntaje del HUD (propia + rival).
// `labelRival`/`manoIconoRival` las maneja _renderizarEstado (dependen del
// modo), así que acá solo se tocan al ocultar; al mostrar, se deja que
// _renderizarEstado decida su visibilidad.
_mostrarMarcadores(visible) {
  [this.mesaMedio, this.mesaPatas, this.mesaPies, this.marcaTcMesa].forEach(o => { if (o && o.scene) o.setVisible(visible && this._mesaModoActual !== '3v3'); });
  [this.scoreBg, this.scoreText, this.labelPropio, this.fondoInfoRival, this.scoreTextRival]
    .forEach(o => { if (o && o.scene) o.setVisible(visible); });
  (this.zonasAnotador || []).forEach(z => { if (z && z.scene) { z.setVisible(visible); if (z.input) z.input.enabled = visible; } });
  this._aplicarMarcadorEstilo();
  if (!visible) {
    [this.labelRival, this.manoIconoRival, this.medallaManoRival, this.nombreRivalAngosto].forEach(o => { if (o && o.scene) o.setVisible(false); });
  }
}

// Pase 210: título de la sala de espera ("2v2 — esperando jugadores"),
// restyled con el mismo marco de pergamino de 3 slices que ya usan los
// carteles de canto en partida (_crearBannerTexto) en vez de un simple
// add.text con stroke negro — pedido del usuario ("cambiar el estilo...
// muy chiquito y apenas se lee"). _crearBannerTexto arma un container
// NUEVO en cada llamada (no hay forma de solo cambiarle el texto a uno ya
// creado), así que esta función guarda la referencia y destruye la
// anterior antes de crear la que la reemplaza — mismo patrón que
// _redibujarFilaEspera con los tiles de avatares.
// Pase 374: línea chica bajo el título ("Mesa a 15 tantos · Liga Criolla"). null si todavía no llegaron los
// datos de la mesa (servidor viejo) — en ese caso el cartel queda como antes.
_textoDetalleSala() {
  if (!this._puntosSala) return null;
  const tipo = this._rankedSala ? 'Liga Criolla' : this._torneoSala ? 'Torneo' : this._privadaSala ? 'Sala privada' : 'Partida libre';
  return `Mesa a ${this._puntosSala} tantos · ${tipo}`;
}

_actualizarBannerEsperaTitulo(texto, modo = null, detalle = null, opts = {}) {
  if (this._bannerEsperaTitulo) {
    const viejo = this._bannerEsperaTitulo;
    viejo.destroy();
    this._sprites = this._sprites.filter(s => s !== viejo);
  }
  // Pase 346: cartel de CAOBA con remaches dorados (ya no el pergamino) y,
  // a la izquierda del texto, una mini píldora 3D dorada con el modo
  // ("1v1"). Se dibuja todo por código dentro de un container en (400,130).
  // Pase 393: la pantalla final reusa este cartel (opts: y, depth, color, tamano).
  const label = this.add.text(0, 0, texto, {
    fontFamily: 'Fredoka, Arial', fontSize: `${opts.tamano || 24}px`, fontStyle: '700', color: opts.color || '#FFD98A',
    stroke: '#2C160E', strokeThickness: 5,
  }).setOrigin(0.5);

  let pillTxt = null;
  let pillW = 0;
  const pillH = 30;
  const gap = 14;
  if (modo) {
    pillTxt = this.add.text(0, 0, String(modo).toLowerCase(), {
      fontFamily: 'Fredoka, Arial', fontSize: '18px', fontStyle: '700', color: '#3E2723',
    }).setOrigin(0.5);
    pillW = Math.round(pillTxt.width + 24);
  }

  // Pase 374: línea de detalle (puntos + tipo de sala) en chico debajo del título.
  let detalleTxt = null;
  if (detalle) {
    detalleTxt = this.add.text(0, 0, detalle, {
      fontFamily: 'Fredoka, Arial', fontSize: '14px', fontStyle: '600', color: '#F1D9A8',
      stroke: '#2C160E', strokeThickness: 3,
    }).setOrigin(0.5);
  }
  const yTitulo = detalleTxt ? (opts.tamano > 24 ? -13 : -10) : 0;

  const contenido = pillW ? pillW + gap + label.width : label.width;
  const padX = 44;
  const anchoDetalle = detalleTxt ? detalleTxt.width : 0;
  const ancho = Math.max(260, Math.round(Math.max(contenido, anchoDetalle) + padX * 2));
  const alto = (detalleTxt ? 80 : 64) + (opts.tamano > 24 ? 10 : 0);

  const g = this.add.graphics();
  // Sombra dura inferior
  g.fillStyle(0x000000, 0.45);
  g.fillRoundedRect(-ancho / 2, -alto / 2 + 5, ancho, alto, 14);
  // Cuerpo de caoba
  g.fillStyle(0x5C3317, 1);
  g.fillRoundedRect(-ancho / 2, -alto / 2, ancho, alto, 14);
  // Tablón superior más claro (volumen)
  g.fillStyle(0x7A4A26, 1);
  g.fillRoundedRect(-ancho / 2 + 3, -alto / 2 + 3, ancho - 6, alto * 0.48, { tl: 11, tr: 11, bl: 3, br: 3 });
  // Vetas de madera
  g.lineStyle(1.5, 0x2C160E, 0.22);
  [-14, 2, 16].forEach(dy => {
    g.beginPath();
    g.moveTo(-ancho / 2 + 20, dy);
    g.lineTo(ancho / 2 - 20, dy + 2);
    g.strokePath();
  });
  // Contorno negro
  g.lineStyle(3, 0x1a0f08, 1);
  g.strokeRoundedRect(-ancho / 2, -alto / 2, ancho, alto, 14);
  // Remaches dorados
  const rx = ancho / 2 - 16;
  const ry = alto / 2 - 13;
  [[-rx, -ry], [rx, -ry], [-rx, ry], [rx, ry]].forEach(([dx, dy]) => {
    this._dibujarRemache(g, dx, dy, 6);
  });

  const hijos = [g];
  const inicioX = -contenido / 2;
  if (pillTxt) {
    const pg = this.add.graphics();
    const px = inicioX;
    const py = -pillH / 2 + yTitulo;
    pg.fillStyle(0xB9770E, 1);
    pg.fillRoundedRect(px, py + 3, pillW, pillH, pillH / 2);
    pg.fillStyle(0xF5B041, 1);
    pg.fillRoundedRect(px, py, pillW, pillH, pillH / 2);
    pg.fillStyle(0xFFFFFF, 0.35);
    pg.fillRoundedRect(px + 5, py + 3, pillW - 10, pillH * 0.38, pillH * 0.19);
    pg.lineStyle(2, 0x000000, 1);
    pg.strokeRoundedRect(px, py, pillW, pillH, pillH / 2);
    pillTxt.setPosition(px + pillW / 2, yTitulo);
    label.setPosition(inicioX + pillW + gap + label.width / 2, yTitulo);
    hijos.push(pg, pillTxt, label);
  } else {
    label.setPosition(0, yTitulo);
    hijos.push(label);
  }
  if (detalleTxt) {
    detalleTxt.setPosition(0, opts.tamano > 24 ? 27 : 22);
    hijos.push(detalleTxt);
  }

  this._bannerEsperaTitulo = this.add.container(400, opts.y || 130, hijos).setDepth(opts.depth || 401);
  this._sprites.push(this._bannerEsperaTitulo);
}

// Pase 434: bloque central de la sala de espera — SOLO el texto de estado ("Buscando rival..." /
// "Buscando jugadores... (X/6)"). Se sacó la moneda 3D girando (Pase 346) en todos los modos.
// Se crea una sola vez y se destruye junto con el título (ver _destruirBannerEsperaTitulo).
_crearCentroEspera() {
  if (this._centroEspera) return;
  const texto = this.add.text(400, 450, 'Buscando rival...', {
    fontFamily: 'Fredoka, Arial', fontSize: '22px', fontStyle: '600', color: '#FFF8ED',
    stroke: '#000000', strokeThickness: 4,
  }).setOrigin(0.5).setDepth(405);
  this._centroEspera = { texto };
  this._sprites.push(texto);
}

// Pase 438: rectángulo de mundo que la cámara muestra de verdad (la sala de espera siempre está centrada en
// (400,300)). En escritorio es 800x600; en ventanas angostas/altas el alto crece y el ancho puede quedar
// por debajo de 800 — el layout de la sala de espera se calcula contra ESTO, no contra 800x600 fijo.
_vistaEspera() {
  const cam = this.cameras.main;
  const z = cam.zoom || 1;
  const w = this.scale.width / z;
  const h = this.scale.height / z;
  return { w, h, yTop: 300 - h / 2 };
}

// Pase 438: reparto vertical "space-evenly". Los Y de la sala de espera están escritos para un lienzo de 600
// de alto; cuando la vista es más alta (celulares), el sobrante se reparte en partes iguales entre los `G`
// bloques (cartel, filas, estado, botón) en vez de dejar todo apilado abajo. `k` = índice del bloque (0 = cartel).
// Devuelve cuánto hay que sumarle al Y de diseño. En escritorio (vista de 600) es 0 salvo el corrimiento de la vista.
_esperaDy(k, G) {
  const v = this._vistaEspera();
  const extra = Math.max(0, v.h - 600);
  return (v.yTop < 0 ? v.yTop : 0) + (extra * (k + 1)) / (G + 1);
}

_actualizarTextoBuscando() {
  const t = this._centroEspera && this._centroEspera.texto;
  if (!t || !t.scene) return;
  const lleno = this._capacidadSala && this._jugadoresSala && this._jugadoresSala.length >= this._capacidadSala;
  const equipos = this._capacidadSala > 2;
  const unidos = (this._jugadoresSala || []).length;
  t.setText(lleno ? 'Iniciando partida...' : (equipos ? `Buscando jugadores... (${unidos}/${this._capacidadSala})` : 'Buscando rival...'));
  // Pase 434: en 2v2/3v3 la grilla de dos filas ocupa más alto, el texto baja.
  t.setY((equipos ? 526 : 470) + this._esperaDy(equipos ? 4 : 2, equipos ? 6 : 4));
}

// Destruye (no solo oculta) el título de la sala de espera — se llama en
// los mismos puntos donde arranca la partida de verdad (ver
// 'partida-iniciada' y el modo preview en _conectarSocket), mismo criterio
// de "no dejar nada de la sala de espera en la partida" que el resto de
// esta pantalla.
_destruirBannerEsperaTitulo() {
  if (this._centroEspera) {
    const { texto } = this._centroEspera;
    if (texto && texto.scene) texto.destroy();
    this._sprites = this._sprites.filter(s => s !== texto);
    this._centroEspera = null;
  }
  if (this._bannerEsperaTitulo) {
    const viejo = this._bannerEsperaTitulo;
    viejo.destroy();
    this._sprites = this._sprites.filter(s => s !== viejo);
    this._bannerEsperaTitulo = null;
  }
}

// Reconstruye la fila completa de avatares de la sala de espera a partir
// de this._jugadoresSala/_modoSala/_capacidadSala (llenados por el evento
// 'jugador-unido', ver _conectarSocket). Un tile por asiento total de la
// sala (2 en 1v1, 4 en 2v2, 6 en 3v3): los primeros `_jugadoresSala.length`
// muestran el avatar real de quien ya se unió + "Conectado"; el resto
// quedan como placeholders grises pulsando "Conectando...".
_redibujarFilaEspera() {
  // Pase 210: si la partida ya arrancó (bandera puesta en 'partida-iniciada'
  // y en el modo preview, ver _conectarSocket) no hay que redibujar nada de
  // la sala de espera — puede llegar un 'jugador-unido' tardío de socket.io
  // ya con la mesa real visible.
  if (this._salaEnJuego) return;

  this._limpiarAvataresEspera();
  this._filaEsperaGeneracion = (this._filaEsperaGeneracion || 0) + 1;

  if (!this.panelEspera || !this.panelEspera.scene) return;
  // Instante entre conectar el socket y recibir el primer 'jugador-unido'
  // (todavía no sabemos cuántos asientos tiene la sala) — se deja el
  // cartel de texto de arriba solo, sin fila, hasta que llegue ese primer
  // evento (siempre llega, es casi inmediato).
  if (!this._modoSala || !this._capacidadSala) return;

  // Pase 346: el modo ("1v1") va en una mini píldora dorada dentro del cartel.
  // Pase 436: en 2v2/3v3 el cartel sube (y=100, antes 130) para aprovechar la franja vacía de arriba.
  this._actualizarBannerEsperaTitulo('Esperando jugadores', this._modoSala, this._textoDetalleSala(), this._capacidadSala > 2 ? { y: 64 + this._esperaDy(0, 6) } : { y: 105 + this._esperaDy(0, 4) });
  this._actualizarTextoBuscando();

  const total = this._capacidadSala;
  const equipos = total > 2;
  // Pase 434: en 2v2/3v3 el botón "Volver al Lobby" baja para dejar lugar a las dos filas.
  if (this.botonVolverEspera && this.botonVolverEspera.scene) this.botonVolverEspera.setY(equipos ? 568 + this._esperaDy(5, 6) : 540 + this._esperaDy(3, 4));
  // Pase 209: pedido del usuario ("en la pantalla nueva de carga,
  // agrandemos todo") — tiles, huecos y tipografía de toda la fila (ver
  // también _dibujarTileEspera más abajo) subieron de tamaño.
  // Pase 437: en 1v1 los aros crecen (140 → 170) y el hueco (96 → 125) para rellenar el paño.
  const tamano = total <= 2 ? 170 : total <= 4 ? 115 : 92;
  // Pase 346: en 1v1 el hueco crece para alojar el badge VS entre los dos aros.
  const gap = total <= 2 ? 125 : total <= 4 ? 30 : 20;
  const paso = tamano + gap;
  const anchoTotal = total * paso - gap;
  const inicioX = 400 - anchoTotal / 2 + tamano / 2;
  const cy = 290 + this._esperaDy(1, 4);   // Pase 437: 270 → 290; Pase 438: + reparto vertical según la vista

  const pendientes = [];
  if (equipos) {
    this._dibujarGrillaEquiposEspera(total, pendientes);
  } else {
    for (let i = 0; i < total; i++) {
      const jugador = this._jugadoresSala[i] || null;
      const cx = inicioX + i * paso;
      this._dibujarTileEspera(cx, cy, tamano / 2, jugador, pendientes);
    }
  }

  // Pase 346: badge "VS" amarillo 3D, centrado entre los dos avatares (solo 1v1).
  if (total === 2) this._dibujarBadgeVsEspera(400, cy, 104);

  if (pendientes.length > 0) {
    const generacionDeEstaCarga = this._filaEsperaGeneracion;
    pendientes.forEach(p => this.load.image(p.key, p.url));
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      // Si mientras cargaba entró otro jugador y se volvió a llamar a
      // _redibujarFilaEspera, esta carga quedó vieja — no dibujar sobre
      // una fila que ya no existe (evita duplicados/tiles fantasma).
      // Pase 210: la otra forma en que esta carga puede quedar vieja — la
      // partida arrancó mientras la imagen todavía bajaba de la red (el
      // bug real reportado: para el último jugador en unirse, sus tiles de
      // espera quedaban dibujados ENCIMA de la mesa real ya visible, y solo
      // desaparecían al recargar la página).
      if (generacionDeEstaCarga !== this._filaEsperaGeneracion) return;
      if (this._salaEnJuego) return;
      pendientes.forEach(p => {
        if (p.tipo === 'aro') {
          // Pase 347: cambia el aro genérico por el anillo del rango ya descargado.
          if (p.img && p.img.scene && this.textures.exists(p.key)) p.img.setTexture(p.key).setDisplaySize(p.tam, p.tam);
        } else {
          this._dibujarImagenAvatarEspera(p);
        }
      });
    });
    this.load.start();
  }
}

// Pase 434: sala de espera de 2v2/3v3 en GRILLA de dos filas horizontales (antes una sola fila
// de 4/6 tiles donde las píldoras de estado se encimaban):
//   TU EQUIPO → fila de tiles → escudo VS → fila del equipo rival → EQUIPO RIVAL.
// Mi equipo se toma del roster (`equipo` de mi usuario); si todavía no estoy, es 'A'.
// Entre píldoras de tiles contiguos queda siempre un hueco de 16 px.
_dibujarGrillaEquiposEspera(total, pendientes) {
  const n = total / 2;
  const jugadores = this._jugadoresSala || [];
  const miNombre = this.usuario && this.usuario.username;
  const yo = jugadores.find(j => j && j.username === miNombre);
  const miEquipo = (yo && yo.equipo) || 'A';
  const otroEquipo = miEquipo === 'A' ? 'B' : 'A';
  const armar = (eq) => {
    const m = jugadores.filter(j => j && j.username && j.equipo === eq);
    return Array.from({ length: n }, (_, i) => m[i] || null);
  };

  // Pase 436: tiles +25 % (T 64 → 80; el aro mide 1.125 × T = 90 px). Pase 438: si la vista es más angosta que
  // la fila (celulares), todo el bloque (aros, píldoras, hueco, fuentes) se achica con el mismo factor `e`.
  // Pase 439: T 80 → 92 (aro de ~104 px). Para que entren aros más grandes el cartel sube (y=64) y las dos filas
  // se reparten todo el alto: ver las Y de diseño más abajo.
  const T0 = 92;
  const GAP0 = 16;
  const medir = (tam) => {
    const est = { fontFamily: 'Fredoka, Arial', fontSize: `${tam}px`, fontStyle: '700' };
    const a1 = this.add.text(0, 0, '✓ Conectado', est);
    const a2 = this.add.text(0, 0, 'Conectando...', est);
    const w = Math.ceil(Math.max(a1.width, a2.width));
    a1.destroy(); a2.destroy();
    return w;
  };
  const pill0 = Math.max(medir(15) + 32, 110);
  const paso0 = Math.max(T0 * 1.125, pill0) + GAP0;
  const fila0 = (n - 1) * paso0 + pill0;
  const anchoVista = Math.min(760, this._vistaEspera().w) - 24;
  const e = Math.max(0.55, Math.min(1, anchoVista / fila0));

  const T = T0 * e;
  const radioAro = T * 0.5625;
  const fontPill = Math.max(10, Math.round(15 * e));
  const anchoPill = Math.max(medir(fontPill) + 32 * e, 110 * e);
  const GAP = GAP0 * e;
  const paso = Math.max(radioAro * 2, anchoPill) + GAP;
  const inicioX = 400 - ((n - 1) * paso) / 2;

  const ESTILO_ETIQUETA = {
    fontFamily: 'Fredoka, Arial', fontSize: `${Math.max(12, Math.round(16 * e))}px`, fontStyle: '700', color: '#F1D9A8',
    stroke: '#2C160E', strokeThickness: 4,
  };
  const etiqueta = (texto, y) => {
    const t = this.add.text(400, y, texto, ESTILO_ETIQUETA).setOrigin(0.5).setDepth(414);
    t.setLetterSpacing && t.setLetterSpacing(2);
    this._avataresEsperaSprites.push(t);
    this._sprites.push(t);
  };

  // Distribución vertical (lienzo de diseño de 600 de alto): título arriba (y=64), etiqueta (124), fila 1, escudo VS,
  // fila 2, etiqueta, texto de estado (526) y botón abajo (568). La píldora (alto 30·e) cuelga a radioAro + 34·e + 3.
  // Pase 438: cada bloque suma su parte del sobrante de alto de la vista (`_esperaDy`, 6 bloques).
  const VS = 62 * e;                                    // Pase 436: escudo +20 % (52 → 62)
  const pb = 34 * e + 3;                                // alto desde el borde del aro hasta el pie de la píldora
  const yEtiqueta1 = 124 + this._esperaDy(1, 6);
  const cy1 = yEtiqueta1 + 14 + radioAro;
  const yVs = cy1 + radioAro + pb + 2 + VS / 2 + (this._esperaDy(2, 6) - this._esperaDy(1, 6));
  const cy2 = yVs + VS / 2 + 2 + radioAro + (this._esperaDy(3, 6) - this._esperaDy(2, 6));
  const yEtiqueta2 = cy2 + radioAro + pb + 10;

  etiqueta('TU EQUIPO', yEtiqueta1);
  armar(miEquipo).forEach((j, i) => this._dibujarTileEspera(inicioX + i * paso, cy1, T / 2, j, pendientes, true, e));
  this._dibujarBadgeVsEspera(400, yVs, VS);
  armar(otroEquipo).forEach((j, i) => this._dibujarTileEspera(inicioX + i * paso, cy2, T / 2, j, pendientes, true, e));
  etiqueta('EQUIPO RIVAL', yEtiqueta2);
}

// Un tile de la fila: sello circular de madera (cálido si ya se unió, gris
// pulsando si no), la foto/avatar real (o un "?" placeholder si el asiento
// está vacío), una pill de estado ("Conectado"/"Conectando...") y el
// nombre debajo sobre su propia etiqueta de madera fina.
// `pendientes` acumula los avatares que todavía no están en la caché de
// texturas de Phaser, para cargarlos todos juntos en un solo batch (ver
// _redibujarFilaEspera) en vez de un load.start() por jugador.
_dibujarTileEspera(cx, cy, radio, jugador, pendientes, compacto = false, escala = 1) {
  const conectado = !!jugador;

  // Pase 267, punto 2: `marcoAvatarEspera` (placa cuadrada con esquineros
  // de metal, ver preload) se reemplaza por `selloAvatarEspera` — un
  // medallón CIRCULAR recortado del mismo archivo original (se descartó
  // la placa cuadrada y los esquineros), con el disco interior teñido a
  // tono pergamino/crema. En este archivo nuevo el anillo de soga tallada
  // llega prácticamente hasta el borde del lienzo (radio ≈ 0.98×radio) y
  // el disco de pergamino interior llega hasta ≈0.80×radio — por eso la
  // foto ahora puede agrandarse a 0.90×radio ("Efecto Pop-out... el avatar
  // debe ser más grande, sobresaliendo ligeramente del marco") sin quedar
  // chica y perdida como con el 0.46×radio de antes (pensado para la
  // plaqueta vieja, con su zona lisa mucho más chica).
  const tamanoFrame = radio * 2;
  // Pase 347: la foto mide 0.72×radio (diámetro 1.44×radio) y el aro se escala para que su
  // hueco la ajuste: tamaño del aro = diámetro de la foto / (hueco + 2 %). El aro nuevo de
  // caoba tiene hueco ≈ 0.62; en salas ranked cada jugador lleva el anillo de SU rango
  // (hueco propio, ver rangosUi.js). `jugador.rango_id` solo viene en salas ranked.
  const radioFoto = radio * 0.72;
  const rangoFicha = conectado && jugador.rango_id ? RANGOS_UI[Number(jugador.rango_id)] : null;
  const hueco = rangoFicha ? rangoFicha.hueco : 0.62;
  const tamanoAro = Math.round((radioFoto * 2) / (hueco + 0.02));

  if (conectado) {
    const esFoto = jugador.avatar_tipo === 'foto' && !!jugador.foto_perfil_url;
    // Pase 437: nada de cuerpo entero dentro del aro — el personaje se muestra con su ROSTRO
    // (`-avatar-cara.png`) a 120 % de zoom interno para llenar el hueco; las fotos de perfil van tal cual.
    const url = esFoto ? jugador.foto_perfil_url : `/assets/${jugador.personaje || 'gaucho'}-avatar-cara.png`;
    const zoom = esFoto ? 1 : 1.2;
    const key = `avatarEspera_${this._hashSimple(url)}`;

    if (this.textures.exists(key)) {
      this._dibujarImagenAvatarEspera({ key, cx, cy, radio: radioFoto, zoom });
    } else {
      pendientes.push({ key, url, cx, cy, radio: radioFoto, zoom });
    }
  }

  // Pase 347: con jugador conectado se dibuja el aro nuevo (o el anillo de su rango si la sala
  // es ranked) SIN relleno, encima de una burbuja translúcida + la foto. El asiento vacío
  // conserva el medallón de madera macizo con el "?", que respira.
  let marco;
  if (conectado) {
    let claveAro = 'aroAvatarEspera';
    if (rangoFicha) {
      const claveRango = `aroRango_${jugador.rango_id}`;
      if (this.textures.exists(claveRango)) claveAro = claveRango;
    }
    marco = this.add.image(cx, cy, claveAro).setDisplaySize(tamanoAro, tamanoAro).setDepth(412.6);
    if (rangoFicha && claveAro === 'aroAvatarEspera') {
      pendientes.push({ tipo: 'aro', key: `aroRango_${jugador.rango_id}`, url: rangoFicha.anillo, img: marco, tam: tamanoAro });
    }
  } else {
    // Pase 348: el asiento vacío también lleva el aro nuevo (antes el medallón viejo de soga).
    marco = this.add.image(cx, cy, 'aroAvatarEspera').setDisplaySize(tamanoAro, tamanoAro).setDepth(412.6);
  }
  this._avataresEsperaSprites.push(marco);
  this._sprites.push(marco);

  // Burbuja neutra semitransparente detrás de la foto (o del "?" si el asiento está vacío).
  const burbuja = this.add.graphics().setDepth(411.6);
  burbuja.fillStyle(0xFFFFFF, conectado ? 0.2 : 0.16);
  burbuja.fillCircle(cx, cy, radioFoto);
  this._avataresEsperaSprites.push(burbuja);
  this._sprites.push(burbuja);

  if (!conectado) {
    // Respiración suave: aro y burbuja suben/bajan de opacidad juntos.
    this.tweens.add({ targets: [marco, burbuja], alpha: { from: 1, to: 0.5 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // Pase 378: en vez del "?" quieto, pasan siluetas de los personajes (efecto radar). Si las
    // texturas no cargaron, se cae al "?" de siempre.
    if (!this._dibujarRadarSiluetas(cx, cy, radioFoto)) {
      const signo = this.add.text(cx, cy, '?', {
        fontFamily: 'Fredoka, Arial', fontSize: `${Math.round(radioFoto * 1.25)}px`, fontStyle: '700',
        color: '#FFF8ED',
      }).setOrigin(0.5).setAlpha(0.55).setDepth(412);
      this._avataresEsperaSprites.push(signo);
      this._sprites.push(signo);
      this.tweens.add({ targets: signo, alpha: { from: 0.7, to: 0.25 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // Pase 267, punto 3: "✓ Conectado" pasa de una pill plana (Graphics,
  // relleno sólido) a un Badge 3D Pill-shaped real — se reutilizan los
  // MISMOS 3 slices de píldora verde (botonVerdeIzq/Centro/Der) que ya se
  // armaron en el pase 266 para los botones de la pantalla final (mismo
  // relieve/brillo horneado, mismo criterio de nine-slice horizontal para
  // no estirar las puntas). "Conectando..." se queda con una pill dibujada
  // a mano (no hay asset de píldora "madera clara/beige"), pero con el
  // mismo criterio de capas (sombra + relleno + brillo superior) que ya
  // usan las filas de la pantalla final (pase 265) para que se lea
  // "3D"/ahuecada y no plana — más los 3 puntitos parpadeantes pedidos.
  // Pase 434 (ajustado en 436): `compacto` (grilla de equipos) — píldora de 30 px y fuente 15 negrita, más cerca del aro.
  const pillY = compacto ? cy + radio * 1.125 + 19 * escala : cy + radio + 30;
  const pillAlto = compacto ? 30 * escala : 30;

  // Pase 349: las dos píldoras ("✓ Conectado" verde / "Conectando..." crema) se dibujan por
  // código, planas y con relieve duro — igual que en el nativo — en vez de los PNG nine-slice
  // de la pantalla final (que dejaban los bordes cortados). Las dos miden lo mismo (ancho
  // fijo, calculado con el texto más largo) y NO cambian al aparecer los puntitos.
  const ESTILO_PILL = { fontFamily: 'Fredoka, Arial', fontSize: `${compacto ? Math.max(10, Math.round(15 * escala)) : 15}px`, fontStyle: compacto ? '700' : '600' };
  const medA = this.add.text(0, 0, '✓ Conectado', ESTILO_PILL);
  const medB = this.add.text(0, 0, 'Conectando...', ESTILO_PILL);
  const anchoPill = compacto ? Math.max(Math.ceil(Math.max(medA.width, medB.width)) + 32 * escala, 110 * escala) : Math.max(Math.ceil(Math.max(medA.width, medB.width)) + 36, 120);
  const anchoConectando = medB.width;
  medA.destroy();
  medB.destroy();

  const dibujarPill = (relleno, borde) => {
    const g = this.add.graphics().setDepth(413);
    const px = cx - anchoPill / 2;
    const py = pillY - pillAlto / 2;
    g.fillStyle(0x000000, 0.5); // relieve duro inferior
    g.fillRoundedRect(px, py + 3, anchoPill, pillAlto, pillAlto / 2);
    g.fillStyle(relleno, 1);
    g.fillRoundedRect(px, py, anchoPill, pillAlto, pillAlto / 2);
    g.lineStyle(2, borde, 1);
    g.strokeRoundedRect(px, py, anchoPill, pillAlto, pillAlto / 2);
    this._avataresEsperaSprites.push(g);
    this._sprites.push(g);
  };

  if (conectado) {
    dibujarPill(0x3E8E5A, 0x1F5C38);
    const pillTexto = this.add.text(cx, pillY, '✓ Conectado', {
      ...ESTILO_PILL, color: '#FFFFFF', stroke: '#14391f', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(414);
    this._avataresEsperaSprites.push(pillTexto);
    this._sprites.push(pillTexto);
  } else {
    dibujarPill(0xE9D9B0, 0x4A2C2A);
    // "Conectando" fijo + puntitos separados (1→3 cada 400 ms). El texto se ancla a la izquierda
    // del ancho de "Conectando..." para que no baile; la píldora no se redibuja.
    const xTexto = cx - anchoConectando / 2;
    const textoBase = this.add.text(xTexto, pillY, 'Conectando', {
      ...ESTILO_PILL, color: '#4A2C2A',
    }).setOrigin(0, 0.5).setDepth(414);
    const textoPuntos = this.add.text(xTexto + textoBase.width, pillY, '.', {
      ...ESTILO_PILL, color: '#4A2C2A',
    }).setOrigin(0, 0.5).setDepth(414);
    this._avataresEsperaSprites.push(textoBase, textoPuntos);
    this._sprites.push(textoBase, textoPuntos);

    let n = 1;
    const timer = this.time.addEvent({
      delay: 400, loop: true,
      callback: () => {
        n = (n % 3) + 1;
        textoPuntos.setText('.'.repeat(n));
      },
    });
    this._avataresEsperaTimers.push(timer);
  }

  // Pase 346: se saca la píldora/etiqueta con el nombre de usuario debajo de
  // "✓ Conectado" (redundante, a pedido).
}

// Pase 378: efecto "radar" del asiento vacío — mientras se busca rival, dentro del aro pasan
// siluetas oscuras de los personajes (gaucho, gaucha...) que entran por la derecha y salen por
// la izquierda, cambiando rápido, con un resplandor dorado que respira y un barrido de radar
// que gira. Devuelve false si las texturas no están (el llamador dibuja el "?" de respaldo).
// Cuando entra un rival, la fila entera se reconstruye (_limpiarAvataresEspera) y el timer se
// frena ahí, así que la silueta "se fija" en la foto real del jugador.
_dibujarRadarSiluetas(cx, cy, radioFoto) {
  const personajes = ['gaucho', 'gaucha', 'gaucho2', 'gaucha2'];
  const claves = personajes.map(p => `siluetaEspera_${p}`).filter(k => this.textures.exists(k));
  if (claves.length < 2) return false;

  const registrar = (...objs) => {
    objs.forEach(o => { this._avataresEsperaSprites.push(o); this._sprites.push(o); });
  };

  // Resplandor dorado detrás de las siluetas (3 discos concéntricos muy tenues).
  const brillo = this.add.graphics().setDepth(411.7);
  [[1.0, 0.07], [0.82, 0.08], [0.62, 0.09]].forEach(([k, a]) => {
    brillo.fillStyle(0xFFD98A, a);
    brillo.fillCircle(cx, cy, radioFoto * k);
  });
  registrar(brillo);
  this.tweens.add({ targets: brillo, alpha: { from: 0.4, to: 1 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  // Silueta: el PNG del personaje teñido de marrón oscuro, recortado al círculo del aro.
  const tam = radioFoto * 2;
  const desplazamiento = radioFoto * 0.45;
  const sil = this.add.image(cx, cy, claves[0]).setDisplaySize(tam, tam).setDepth(412);
  sil.setTintFill(0x24140C);
  sil.setAlpha(0);
  const mascara = this.make.graphics();
  mascara.fillStyle(0xffffff);
  mascara.fillCircle(cx, cy, radioFoto);
  sil.setMask(mascara.createGeometryMask());
  registrar(sil, mascara);

  // Barrido de radar: cuña dorada translúcida que gira alrededor del centro, con sus dos
  // bordes gruesos (la línea que guía y la de atrás) y un puntito fijo en el centro.
  // Pase 379: antes solo tenía la línea de adelante; ahora el contorno completo de la cuña.
  const barrido = this.add.graphics({ x: cx, y: cy }).setDepth(412.3);
  barrido.fillStyle(0xFFE8A3, 0.20);
  barrido.slice(0, 0, radioFoto, Phaser.Math.DegToRad(-55), Phaser.Math.DegToRad(0), false);
  barrido.fillPath();
  barrido.lineStyle(2, 0xFFF3C4, 0.55);
  barrido.beginPath();
  barrido.moveTo(0, 0);
  barrido.lineTo(radioFoto, 0);
  barrido.strokePath();
  barrido.beginPath();
  barrido.moveTo(0, 0);
  barrido.lineTo(radioFoto * Math.cos(Phaser.Math.DegToRad(-55)), radioFoto * Math.sin(Phaser.Math.DegToRad(-55)));
  barrido.strokePath();
  const mascaraBarrido = this.make.graphics();
  mascaraBarrido.fillStyle(0xffffff);
  mascaraBarrido.fillCircle(cx, cy, radioFoto);
  barrido.setMask(mascaraBarrido.createGeometryMask());
  registrar(barrido, mascaraBarrido);
  // Más lento que en el Pase 378 (2,2 s → 4 s por vuelta).
  this.tweens.add({ targets: barrido, angle: 360, duration: 4000, repeat: -1, ease: 'Linear' });
  // Puntito central (mismo color que las líneas del barrido, fijo, no gira).
  const punto = this.add.graphics().setDepth(412.4);
  punto.fillStyle(0xFFF3C4, 0.9);
  punto.fillCircle(cx, cy, Math.max(3, radioFoto * 0.045));
  registrar(punto);

  // Ciclo de siluetas: orden aleatorio sin repetir la misma dos veces seguidas.
  // Pase 380: más lento (560 → 900 ms por silueta).
  const DURACION_CICLO = 900;
  let cola = [];
  let ultima = null;
  const siguiente = () => {
    if (cola.length === 0) {
      cola = claves.slice().sort(() => Math.random() - 0.5);
      if (cola.length > 1 && cola[0] === ultima) cola.push(cola.shift());
    }
    ultima = cola.shift();
    return ultima;
  };
  let tweenX = null;
  let tweenAlpha = null;
  const pasarSilueta = () => {
    if (!sil.scene) return;
    // Pase 379: se frenan los tweens del ciclo anterior. Antes el viejo todavía terminaba su
    // último cuadro DESPUÉS de que yo reposicionaba la silueta a la derecha, así que el tween
    // nuevo arrancaba leyendo x ≈ izquierda y no se movía (solo hacía fade en el lugar).
    if (tweenX && tweenX.stop) tweenX.stop();
    if (tweenAlpha && tweenAlpha.stop) tweenAlpha.stop();
    sil.setTexture(siguiente());
    sil.setDisplaySize(tam, tam);
    sil.setTintFill(0x24140C);
    sil.setX(cx + desplazamiento);
    sil.setAlpha(0);
    tweenX = this.tweens.add({ targets: sil, x: { from: cx + desplazamiento, to: cx - desplazamiento }, duration: DURACION_CICLO, ease: 'Linear' });
    tweenAlpha = this.tweens.add({ targets: sil, alpha: { from: 0, to: 0.82 }, duration: 380, yoyo: true, hold: 140, ease: 'Sine.easeInOut' });
  };
  pasarSilueta();
  this._avataresEsperaTimers.push(this.time.addEvent({ delay: DURACION_CICLO, loop: true, callback: pasarSilueta }));
  return true;
}

// Pase 346: badge "VS" — placa dorada 3D (borde negro 3px, relieve inferior
// ocre) con "VS" en Fredoka chocolate, levemente inclinada.
_dibujarBadgeVsEspera(x, y, tam = 88) {
  // Pase 374: escudo con espadas y "VS" (PNG del usuario). Si por algo la textura no cargó,
  // se cae al badge dibujado por código de antes.
  if (this.textures.exists('vsEscudoEspera')) {
    const img = this.add.image(x, y, 'vsEscudoEspera').setDisplaySize(tam, tam).setDepth(414);
    this._avataresEsperaSprites.push(img);
    this._sprites.push(img);
    return;
  }
  const w = 58, h = 58, r = 16;
  const g = this.add.graphics();
  g.fillStyle(0x000000, 0.4);
  g.fillRoundedRect(-w / 2, -h / 2 + 7, w, h, r);
  g.fillStyle(0xB9770E, 1);
  g.fillRoundedRect(-w / 2, -h / 2 + 5, w, h, r);
  g.fillStyle(0xF5B041, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, r);
  g.fillStyle(0xFFFFFF, 0.35);
  g.fillRoundedRect(-w / 2 + 6, -h / 2 + 4, w - 12, h * 0.34, r * 0.6);
  g.lineStyle(3, 0x000000, 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  const t = this.add.text(0, 1, 'VS', {
    fontFamily: 'Fredoka, Arial', fontSize: '26px', fontStyle: '700', color: '#3E2723',
  }).setOrigin(0.5);
  const cont = this.add.container(x, y, [g, t]).setDepth(414).setAngle(-6);
  this._avataresEsperaSprites.push(cont);
  this._sprites.push(cont);
}

// Dibuja la foto/avatar real ya cargada en la caché de texturas, recortada
// a círculo con una máscara de geometría (Phaser no tiene un equivalente
// directo a `border-radius:50%` para imágenes — el criterio estándar es
// una Graphics con un círculo relleno, convertida a máscara vía
// `createGeometryMask()`, aplicada sobre la imagen real).
_dibujarImagenAvatarEspera({ key, cx, cy, radio, zoom = 1 }) {
  // Si falló la carga (loaderror — foto rota, URL vieja, sin conexión a
  // ese host, etc.) la textura nunca llega a existir; nos quedamos con el
  // fondo verde liso ya dibujado en _dibujarTileEspera en vez de romper
  // el resto de la fila.
  if (!this.textures.exists(key)) return;
  // Pase 210: defensa extra (además del chequeo en el callback de carga en
  // _redibujarFilaEspera) — si esta función se llegara a invocar con la
  // partida ya arrancada, no dibujar sobre la mesa real.
  if (this._salaEnJuego) return;
  // Pase 212: depth 410→412 — el marco (marcoAvatarEspera, depth 411) es
  // una plaqueta opaca sin agujero real en el medio (ver comentario en
  // _dibujarTileEspera), así que la foto tiene que quedar ENCIMA del
  // marco, no detrás, para poder verse.
  const img = this.add.image(cx, cy, key).setDisplaySize(radio * 2 * zoom, radio * 2 * zoom).setDepth(412);
  const mask = this.make.graphics();
  mask.fillStyle(0xffffff);
  mask.fillCircle(cx, cy, radio);
  img.setMask(mask.createGeometryMask());
  this._avataresEsperaSprites.push(img, mask);
  this._sprites.push(img, mask);
}

_conectarSocket() {
    // Modo preview: "PREVIEW_1V1" / "PREVIEW_2V2" / "PREVIEW_3V3" no abren
    // conexión real, solo simulan el estado para ajustar el layout de la
    // mesa sin crear salas de verdad.
    if (this.codigoSala?.startsWith?.('PREVIEW_')) {
      const modo = this.codigoSala.replace('PREVIEW_', '').toLowerCase();
      // Pase 210: bandera "ya arrancó" + destrucción completa (no solo
      // ocultar) de todo lo de la sala de espera — mismo criterio que el
      // handler real de 'partida-iniciada' más abajo, ver comentario ahí.
      this._salaEnJuego = true;
      if (this._L) this._modoCamaraAngosto('juego');
      if (this.panelEspera) this.panelEspera.setVisible(false);
      if (this.botonVolverEspera) this.botonVolverEspera.setVisible(false);
      this._limpiarAvataresEspera();
      this._destruirBannerEsperaTitulo();
      if (this.mesaImg) this.mesaImg.setVisible(true);
      if (this.sombraMesa) this.sombraMesa.setVisible(true);
      // Pase 611: Modo foto (/?preview=<modo>&foto=1, lo abre el formulario de Ajustes del admin): escena, nombres, puntos y dorso elegidos.
      const foto = getConfigFoto();
      if (foto.activo && foto.modo === modo) {
        if (foto.yo) this.usuario = { ...(this.usuario || {}), username: foto.yo };
        this._jugadoresSala = [...foto.compas, ...foto.rivales].filter(Boolean).map((n) => ({ username: n, mazo_id: foto.mazo }));
        this.estado = crearEstadoFoto(foto);
      } else {
        this.estado = this._crearEstadoMockPorModo(modo);
      }
      if (this.onEsEquipos) this.onEsEquipos(Array.isArray(this.estado.companeros));
      this._renderizarEstado(true);
      return;
    }

    this.socket = getSocket();

    // Pase 526: reconexión suave. Antes 'unirse-sala' se emitía UNA sola vez: si la conexión se caía (minimizar la
    // pestaña en el celular, cambio de red) Socket.IO reconectaba con un socket nuevo que el servidor no conocía, y la
    // mesa quedaba congelada. Ahora cada 'connect' (el primero y los de reconexión) vuelve a pedir el asiento; el
    // servidor lo reconoce por el usuario, cancela el reloj de abandono y reenvía estado y reloj de turno.
    const unirseSala = () => this.socket.emit('unirse-sala', { codigoSala: this.codigoSala, usuario: this.usuario });
    if (this._onConnectSala) this.socket.off('connect', this._onConnectSala);
    if (this._onDisconnectSala) this.socket.off('disconnect', this._onDisconnectSala);
    this._onConnectSala = () => { unirseSala(); };
    this._onDisconnectSala = (motivo) => {
      this._actualizarMensajeEstado('Reconectando...', '#ffcc55');
      // Si fue el servidor quien cortó, Socket.IO no reintenta solo.
      if (motivo === 'io server disconnect') this.socket.connect();
    };
    this.socket.on('connect', this._onConnectSala);
    this.socket.on('disconnect', this._onDisconnectSala);
    // Al volver a la pestaña/app: reconectar ya si está caído; si figura conectado, reconfirmar el asiento (idempotente).
    if (this._onVisibilidadSala) document.removeEventListener('visibilitychange', this._onVisibilidadSala);
    this._onVisibilidadSala = () => {
      if (document.visibilityState !== 'visible' || !this.socket) return;
      if (!this.socket.connected) this.socket.connect();
      else unirseSala();
    };
    document.addEventListener('visibilitychange', this._onVisibilidadSala);
    if (this.socket.connected) unirseSala();   // ya conectado (socket compartido): no hay 'connect' que esperar
    else this.socket.connect();                // el handler de 'connect' emite 'unirse-sala'

    this.socket.off('estado-juego').on('estado-juego', (estado) => {
      const esRepartoNuevo = this._esRepartoNuevo(estado);
      this.estadoAnterior = this.estado;
      this.estado = estado;
      this._actualizarMensajeEstado('');

      if (this.onEsEquipos) this.onEsEquipos(Array.isArray(estado.companeros));

      if (esRepartoNuevo) {
        try { this.sound.play('repartir', { volume: 0.5 * (this.efectosVolumen ?? 1) }); } catch (e) {}
      }
      this._renderizarEstado(esRepartoNuevo);
    });

    this.socket.off('info-sala').on('info-sala', (data) => {
      if (this.onInfoSala) this.onInfoSala(data);
    });

    this.socket.off('jugador-unido').on('jugador-unido', (data) => {
      this._actualizarMensajeEstado(data.mensaje);
      // Pase 208: además del mensaje de siempre, este evento ahora trae el
      // roster completo de la sala (username/equipo/personaje/avatar) más
      // el modo y la capacidad total — se guardan y se reconstruye toda la
      // fila de avatares de la pantalla de espera (ver _redibujarFilaEspera).
      if (Array.isArray(data.jugadores)) this._jugadoresSala = data.jugadores;
      if (data.modo) this._modoSala = data.modo;
      if (data.capacidadTotal) this._capacidadSala = data.capacidadTotal;
      // Pase 374: datos de la mesa (puntos, tipo de sala) para la línea de modo del cartel.
      if (data.puntosParaGanar) this._puntosSala = data.puntosParaGanar;
      this._rankedSala = !!data.ranked;
      this._privadaSala = !!data.privada;
      this._torneoSala = !!data.esTorneo;
      // Pase 210: el título ya no es un add.text suelto (this.textoEsperaCartel,
      // sacado) sino el banner de pergamino — _redibujarFilaEspera lo
      // actualiza con el texto "<MODO> — esperando jugadores" en cuanto
      // conoce el modo/capacidad de la sala, así que no hace falta tocarlo
      // acá aparte.
      this._redibujarFilaEspera();
    });
    this.socket.off('partida-iniciada').on('partida-iniciada', (data) => {
      // Pase 210 — bug real reportado: al último jugador en unirse le
      // quedaban los círculos de la sala de espera dibujados ENCIMA de la
      // mesa real ya visible (una carga de avatar en curso terminaba
      // después de este evento y dibujaba sobre la mesa; solo recargar la
      // página los sacaba). Fix de 2 partes: (1) esta bandera, chequeada en
      // _redibujarFilaEspera/_dibujarImagenAvatarEspera, evita que cualquier
      // carga que termine tarde dibuje algo nuevo; (2) en vez de solo
      // ocultar (setVisible(false), lo que dejaba los objetos vivos en la
      // escena) ahora se DESTRUYEN de una — pedido explícito del usuario:
      // "lo mejor es que no quede nada de la sala de espera en la partida".
      this._salaEnJuego = true;
      if (this.panelEspera) this.panelEspera.setVisible(false);
      if (this.botonVolverEspera) this.botonVolverEspera.setVisible(false);
      this._limpiarAvataresEspera();
      this._destruirBannerEsperaTitulo();
      if (this._L) this._modoCamaraAngosto('juego');
      if (this.mesaImg) this.mesaImg.setVisible(true);
      if (this.sombraMesa) this.sombraMesa.setVisible(true);
      this._mostrarMarcadores(true);
    });
    this.socket.off('jugador-desconectado').on('jugador-desconectado', (data) => {
      this._actualizarMensajeEstado(data.mensaje);
    });
    this.socket.off('jugador-reconectado').on('jugador-reconectado', (data) => {
      this._actualizarMensajeEstado(data.mensaje);
      this.time.delayedCall(2500, () => { if (this.mensajeText && this.mensajeText.text === data.mensaje) this._actualizarMensajeEstado(''); });
    });
    this.socket.off('error-sala').on('error-sala', (data) => {
      this._actualizarMensajeEstado(data.mensaje, '#ff5555');
    });
    this.socket.off('error-jugada').on('error-jugada', (data) => {
      this._jugadaEnviada = false;
      this._actualizarMensajeEstado(data.mensaje, '#ff5555');
      this.time.delayedCall(2000, () => this.mensajeText.setColor('#ffffaa'));
    });
    this.socket.off('sala-cancelada').on('sala-cancelada', (data) => {
      // Caso neutro (nadie ganó ni perdió, la sala se cancela antes de
      // terminar) — el resto de los parámetros quedan en su default.
      this._mostrarPantallaFinal(data.mensaje);
    });
      this.socket.off('juego-terminado').on('juego-terminado', (data) => {
        const gano = data.ganador === 'yo';
        if (gano) { try { this.sound.play('ganar', { volume: 0.8 * (this.efectosVolumen ?? 1) }); } catch (e) {} }

        // Pase siguiente: popup de "logro desbloqueado" al volver al lobby
        // (ver LogroDesbloqueadoPopup.js) — se guarda acá lo que mandó el
        // backend (`logrosDesbloqueados`, ver finalizarPartida en
        // index.js) para pasarlo recién cuando el jugador aprieta "Volver
        // al Lobby" (más abajo), no apenas termina la partida (todavía
        // está viendo la pantalla de resultado).
        this._logrosDesbloqueadosPendientes = data.logrosDesbloqueados || [];

        // Septuagésimo sexto pase: pedido explícito del usuario de que
        // esta pantalla copie EXACTAMENTE el mismo estilo que ya tiene
        // en el nativo (mismos colores, textos y diseño) — antes de este
        // pase el título cambiaba de texto por completo cuando era
        // campeón ("🏆 ¡Sos el campeón del torneo! 👑" en vez de
        // "¡Ganaste!"); en el nativo el título de ganó/perdió (con SUS
        // emojis: 🏆 antes de "¡Ganaste!", 😔 antes de "Perdiste" — al
        // revés de cómo estaba antes acá) se muestra SIEMPRE, y la
        // frase de campeón es una línea aparte, debajo, solo si
        // corresponde (ver `_mostrarPantallaFinal`).
        const titulo = gano ? '¡Ganaste!' : 'Perdiste';

        // La aclaración de motivo ("El rival abandonó la partida.") NO
        // existe en el nativo (esa pantalla no distingue el motivo) —
        // se mantiene como agregado propio de la web porque el backend
        // ya manda ese dato y le da contexto real al jugador, pero
        // ahora se pinta con el mismo criterio tipográfico apagado que
        // el resto de esta pantalla en vez de convivir dentro del
        // cartel del título.
        const extra = data.motivo === 'abandono'
          ? (gano ? 'El rival abandonó la partida.' : 'Perdiste por desconexión.')
          : '';

        const hayRevelacionPendiente = this._mostrandoRevelacionFlor || this._mostrandoResultadoFlor || this._mostrandoResultadoEnvido || this._mostrandoRevelacionEnvido;
        const delay = hayRevelacionPendiente ? 3800 : 0;

        this.time.delayedCall(delay, () => {
          this._mostrarPantallaFinal(titulo, !!data.esCampeon, data.esTorneo, data.torneoId, data.jugadores, extra, gano, data.recompensa || null, { ranked: !!data.ranked, privada: !!data.privada, puntosParaGanar: data.puntosParaGanar || null, motivo: data.motivo || null });
        });
      });
    this.socket.off('revancha-estado').on('revancha-estado', (data) => {
      this._actualizarEstadoRevancha(data.confirmados, data.total);
    });
    this.socket.off('revancha-lista').on('revancha-lista', (data) => {
      if (this.onRevancha) this.onRevancha(data.codigoSala);
    });
    this.socket.off('revancha-cancelada').on('revancha-cancelada', (data) => {
      this._mostrarAlertaRevancha(data.mensaje);
    });
    
    this.socket.off('turno-timer').on('turno-timer', (data) => {
      this._deadlineTimer = data.activo ? data.deadline : null;
      // Pase siguiente: se guarda también la duración total (mismo
      // criterio que el nativo, useSocketJuego.js) — el servidor solo
      // manda el deadline una vez por turno, así que la duración total se
      // estima acá, al recibirlo, y es lo que necesita el anillo de
      // tiempo para calcular qué porcentaje dibujar en cada tick.
      this._deadlineTimerTotal = data.activo ? Math.max(data.deadline - Date.now(), 1) : 0;
    });
    this.socket.off('estado-juego').on('estado-juego', (estado) => {
      const esRepartoNuevo = this._esRepartoNuevo(estado);
      this.estadoAnterior = this.estado;
      this.estado = estado;
      this._actualizarMensajeEstado('');

      if (this.onEsEquipos) this.onEsEquipos(Array.isArray(estado.companeros));

      if (esRepartoNuevo) {
        try { this.sound.play('repartir', { volume: 0.5 * (this.efectosVolumen ?? 1) }); } catch (e) {}
      }

      this._reproducirCantosSiCorresponde(estado, this.estadoAnterior);
      this._actualizarCantoBanner(estado);   // 👈 esto faltaba
      this._chequearFinDeRondaEnvido(estado);

      this._renderizarEstado(esRepartoNuevo);
    });
  }

_esRepartoNuevo(nuevoEstado) {
    const esPrimerEstadoRecibido = this._numeroRondaAnterior === undefined;
    const rondaAnterior = this._numeroRondaAnterior;
    this._numeroRondaAnterior = nuevoEstado.numeroRonda;

    if (esPrimerEstadoRecibido) {
      return nuevoEstado.numeroRonda === 1;
    }

    return rondaAnterior !== nuevoEstado.numeroRonda;
}

_mostrarPantallaFinal(titulo, esCampeon = false, esTorneo = false, torneoId = null, jugadoresFinal = null, subtitulo = '', gano = false, recompensa = null, datosFinal = null) {
    this._limpiarSprites();
    this._ocultarCanto();
    this._destruirBannerEsperaTitulo();
    this._salaEnJuego = true;               // por si llega un 'jugador-unido' tardío: no redibujar la espera
    this.fondoAlertaRevancha = null;
    this.contRevancha = null;
    this._tweensFinal = [];
    this._finalGeneracion = (this._finalGeneracion || 0) + 1;
    const generacion = this._finalGeneracion;
    const elementosMarcador = this._L ? [] : [
      this.scoreBg, this.scoreText, this.labelPropio,
      this.fondoInfoRival, this.scoreTextRival, this.labelRival, this.manoIconoRival, this.medallaManoRival,
      ...(this._fosObjs ? this._fosObjs.todos : []),
    ];
    if (this._L) {
      this._modoCamaraAngosto('estatica');
      // Pase 546: la pantalla final se dibujaba para 760 de ancho de mundo y en 1v1 (fila de ~380) quedaba chica
      // en el medio de la ventana. Se acerca la cámara según el ancho real de la fila de avatares (mismas medidas
      // que más abajo: tamano/gapIntra/gapEscudo); 2v2 y 3v3 quedan en 760 o cerca. Piso de alto: 640 de mundo.
      const jf = jugadoresFinal && jugadoresFinal.length ? jugadoresFinal : [];
      const nG = jf.filter(j => j.gano).length;
      const nP = jf.length - nG;
      const tamF = jf.length <= 2 ? 140 : jf.length <= 4 ? 115 : 92;
      const gapF = jf.length <= 2 ? 0 : jf.length <= 4 ? 30 : 20;
      const grupoF = (n) => (n > 0 ? n * (tamF + gapF) - gapF : 0);
      const anchoF = grupoF(nG) + (nG && nP ? 96 : 0) + grupoF(nP);
      const cwF = this.scale.width;
      const chF = this.scale.height;
      const visibleW = Math.max(540, Math.min(760, anchoF * 1.15 + 120), 640 * cwF / chF);
      const camF = this.cameras.main;
      camF.setZoom(cwF / Math.min(760, visibleW));
      camF.centerOn(400, 300);
      this._modoCamara = 'final';   // para que el próximo 'estatica' (sala de espera) vuelva a aplicar zoom8
    }
    this.children.list
      .filter(c => c !== undefined)
      .forEach(c => { if (!elementosMarcador.includes(c)) c.setVisible(false); });

    // Fondo: el paño verde de juego completo (sin tarjeta de pergamino) + velo liviano.
    const fondoResultado = this.add.image(400, 300, 'fondoResultado').setDepth(898);
    fondoResultado.setDisplaySize(800, 600);
    if (this._L) this._cubrirEstatico(fondoResultado);
    this._sprites.push(fondoResultado);
    const velo = this.add.rectangle(400, 300, 800, this._L ? this._L.H8 + 4 : 600, 0x14140f, 0.45).setDepth(900);
    this._sprites.push(velo);

    // ─────────────────────────────────────────────────────────────────
    // Pase 393: la pantalla final reusa el lenguaje de la sala de espera —
    // cartel de caoba arriba, "batalla de avatares" con el aro de caoba y
    // el escudo central (acá con el marcador final), moneda + frase y la
    // botonera vertical en cápsulas 3D. Sin tarjeta, sin monedas ganadas y
    // con puntos SOLO si la partida fue de Liga Criolla (ranked).
    // ─────────────────────────────────────────────────────────────────
    const PERSONAJES_CANTO = ['gaucho', 'gaucha', 'gaucho2', 'gaucha2'];
    const modo = titulo === '¡Ganaste!' ? 'victoria' : (titulo === 'Perdiste' ? 'derrota' : 'neutro');
    const datos = datosFinal || {};
    const tipoMesa = datos.ranked ? 'Liga Criolla' : esTorneo ? 'Torneo' : datos.privada ? 'Sala privada' : 'Partida libre';
    const puntosMesa = datos.puntosParaGanar || this._puntosSala;
    const detalle = puntosMesa ? `Mesa a ${puntosMesa} tantos · ${tipoMesa}` : null;

    // 1) Cartel de caoba con el resultado
    const textoCartel = modo === 'victoria' ? '¡GANASTE!' : (modo === 'derrota' ? 'PERDISTE' : 'Sala cancelada');
    this._actualizarBannerEsperaTitulo(textoCartel, null, detalle, {
      y: 84, depth: 903,
      color: modo === 'derrota' ? '#E4573D' : '#FFD98A',
      tamano: 30,
    });
    const cartel = this._bannerEsperaTitulo;
    this._bannerEsperaTitulo = null;       // ya no es el cartel de la espera

    // 2) Fila de avatares: ganadores a la izquierda, escudo con el marcador, perdedores a la derecha
    const hayJugadores = jugadoresFinal && jugadoresFinal.length > 0;
    const ganadores = hayJugadores ? jugadoresFinal.filter(j => j.gano) : [];
    const perdedores = hayJugadores ? jugadoresFinal.filter(j => !j.gano) : [];
    const todos = [...ganadores, ...perdedores];
    const total = todos.length;
    const tamano = total <= 2 ? 140 : total <= 4 ? 115 : 92;
    const gapIntra = total <= 2 ? 0 : total <= 4 ? 30 : 20;
    const gapEscudo = 96;
    const paso = tamano + gapIntra;
    const anchoGrupo = (n) => (n > 0 ? n * paso - gapIntra : 0);
    const anchoFila = anchoGrupo(ganadores.length) + (ganadores.length && perdedores.length ? gapEscudo : 0) + anchoGrupo(perdedores.length);
    let cursorX = 400 - anchoFila / 2 + tamano / 2;
    const cyAv = 212;

    const radio = tamano / 2;
    const radioFoto = radio * 0.72;
    const infoSala = (nombre) => (this._jugadoresSala || []).find(s => s.username === nombre) || {};
    const pendientes = [];
    let escudoX = 400;
    // Pase 414: todos los carteles de nombre y las pildoras Ganador/Derrotado van en la MISMA linea Y
    // (antes dependian del aro de rango de cada uno), con carteles de 36 px de alto.
    const ALTO_CARTEL = 36;
    const aroRef = Math.max(...todos.map((j) => {
      const rid = j.rango_id != null ? j.rango_id : infoSala(j.nombre).rango_id;
      const rf = rid ? RANGOS_UI[Number(rid)] : null;
      return Math.round((radioFoto * 2) / ((rf ? rf.hueco : 0.62) + 0.02));
    }), 0);
    const yNombreComun = cyAv + aroRef / 2 + 22;
    const yPillComun = yNombreComun + ALTO_CARTEL / 2 + 6 + 13;

    todos.forEach((j, idx) => {
      const esGanadorGrupo = j.gano;
      const cx = cursorX;
      cursorX += paso;
      if (idx === ganadores.length - 1 && perdedores.length) {
        escudoX = cx + tamano / 2 + gapEscudo / 2;
        cursorX += gapEscudo - gapIntra;
      }
      const info = { ...infoSala(j.nombre), ...Object.fromEntries(Object.entries(j).filter(([k, v]) => v != null && k !== 'nombre' && k !== 'gano' && k !== 'tantos')) };
      const rangoFicha = info.rango_id ? RANGOS_UI[Number(info.rango_id)] : null;
      const hueco = rangoFicha ? rangoFicha.hueco : 0.62;
      const tamanoAro = Math.round((radioFoto * 2) / (hueco + 0.02));

      // Pase 415: halo DORADO solo cuando el resultado es "¡GANASTE!" (sobre los ganadores);
      // en "PERDISTE" el aura va sobre MI avatar, en rojo carmesí (rgba(220,38,38,0.45)), y el ganador
      // queda con su marco estandar.
      const haloVictoria = modo === 'victoria' && esGanadorGrupo;
      const haloDerrota = modo === 'derrota' && j.nombre === this.usuario?.username;
      if (haloVictoria || haloDerrota) {
        // Pase 395: halo circular más llamativo — anillos concéntricos que se
        // desvanecen hacia afuera (desborde de luz), un núcleo cálido y un
        // anillo de destello que respira.
        const halo = this.add.graphics().setDepth(902);
        // Pase 417: derrota = borgoña/vino sutil rgba(180,40,40,0.25), con menos dispersión (resplandor cálido, sin encandilar)
        const anillosHalo = haloDerrota ? [
          [1.14, 0xB42828, 0.07],
          [0.98, 0xB42828, 0.10],
          [0.84, 0xB42828, 0.14],
          [0.72, 0xB42828, 0.19],
          [0.60, 0xB42828, 0.25],
        ] : [
          [1.30, 0xFFC94A, 0.10],
          [1.10, 0xFFD668, 0.16],
          [0.92, 0xFFE08A, 0.22],
          [0.76, 0xFFEBB0, 0.30],
          [0.60, 0xFFF3CC, 0.42],
        ];
        anillosHalo.forEach(([k, col, al]) => {
          halo.fillStyle(col, al);
          halo.fillCircle(0, 0, tamanoAro * k);
        });
        if (haloDerrota) halo.lineStyle(2, 0xB42828, 0.45); else halo.lineStyle(3, 0xFFF3CC, 0.9);
        halo.strokeCircle(0, 0, tamanoAro * 0.62);
        halo.setPosition(cx, cyAv);
        this._sprites.push(halo);
        this._tweensFinal.push(this.tweens.add({ targets: halo, alpha: haloDerrota ? 0.45 : 0.7, scale: haloDerrota ? 1.12 : 1.1, duration: haloDerrota ? 1300 : 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
        // Destello exterior que se expande y se apaga, en bucle
        const onda = this.add.graphics().setDepth(901.9);
        if (haloDerrota) onda.lineStyle(3, 0xB42828, 0.6); else onda.lineStyle(4, 0xFFE08A, 1);
        onda.strokeCircle(0, 0, tamanoAro * 0.62);
        onda.setPosition(cx, cyAv);
        this._sprites.push(onda);
        this._tweensFinal.push(this.tweens.add({ targets: onda, alpha: { from: haloDerrota ? 0.7 : 0.85, to: 0 }, scale: { from: 1, to: haloDerrota ? 1.5 : 1.75 }, duration: haloDerrota ? 2000 : 1800, repeat: -1, ease: 'Cubic.easeOut' }));
      }

      // Disco de fondo
      const disco = this.add.graphics().setDepth(902.1);
      disco.fillStyle(esGanadorGrupo ? 0xFFE9A8 : 0xB9AE9E, 1);
      disco.fillCircle(cx, cyAv, radioFoto);
      this._sprites.push(disco);

      // Cara: foto real si usa foto; si no, la expresión (victoriosa / derrotada) de su personaje
      const esFoto = info.avatar_tipo === 'foto' && !!info.foto_perfil_url;
      const personaje = PERSONAJES_CANTO.includes(info.personaje) ? info.personaje : 'gaucho';
      const esMio = j.nombre === this.usuario?.username;
      let claveCara, urlCara;
      if (esFoto) {
        urlCara = info.foto_perfil_url;
        claveCara = `avatarEspera_${this._hashSimple(urlCara)}`;
      } else if (esMio && this.textures.exists(esGanadorGrupo ? 'caraVictorioso' : 'caraDerrotado')) {
        claveCara = esGanadorGrupo ? 'caraVictorioso' : 'caraDerrotado';
      } else {
        claveCara = `caraFinal_${personaje}_${esGanadorGrupo ? 'v' : 'd'}`;
        urlCara = `assets/expresionesGaucho/${personaje}_${esGanadorGrupo ? 'victorioso' : 'derrotado'}_cerca.png`;
      }
      const ponerCara = () => {
        if (generacion !== this._finalGeneracion || !this.textures.exists(claveCara)) return;
        const lado = esFoto ? radioFoto * 2 : radioFoto * 2.15;
        const img = this.add.image(cx, cyAv, claveCara).setDisplaySize(lado, lado).setDepth(902.2);
        const m = this.make.graphics();
        m.fillStyle(0xffffff);
        m.fillCircle(cx, cyAv, radioFoto);
        img.setMask(m.createGeometryMask());
        this._sprites.push(img, m);
      };
      if (this.textures.exists(claveCara)) ponerCara();
      else pendientes.push({ clave: claveCara, url: urlCara, listo: ponerCara });

      // Aro de caoba (o anillo del rango en Liga Criolla)
      let claveAro = 'aroAvatarEspera';
      if (rangoFicha && this.textures.exists(`aroRango_${info.rango_id}`)) claveAro = `aroRango_${info.rango_id}`;
      const aro = this.add.image(cx, cyAv, claveAro).setDisplaySize(tamanoAro, tamanoAro).setDepth(902.6);
      this._sprites.push(aro);

      // Etiqueta de nombre (madera fina) con copa si ganó
      const maxNombre = Math.max(70, tamano + gapIntra - 8);
      let nombreMostrado = String(j.nombre || '');
      const medida = this.add.text(0, 0, nombreMostrado, { fontFamily: 'Nunito, Arial', fontSize: total <= 2 ? '16px' : '13px', fontStyle: '800' });
      while (medida.width > maxNombre - 24 && nombreMostrado.length > 3) {
        nombreMostrado = nombreMostrado.slice(0, -2);
        medida.setText(nombreMostrado + '…');
      }
      const textoNombre = nombreMostrado.length < String(j.nombre || '').length ? nombreMostrado + '…' : nombreMostrado;
      medida.destroy();
      const yNombre = yNombreComun;
      const etiqueta = this.add.text(0, 0, textoNombre, {
        fontFamily: 'Nunito, Arial', fontSize: total <= 2 ? '16px' : '13px', fontStyle: '800', color: '#FFF8ED',
        stroke: '#2C160E', strokeThickness: 3,
      }).setOrigin(0, 0.5).setDepth(904);
      const icoTrofeo = esGanadorGrupo ? 22 : 0;
      const anchoEtq = etiqueta.width + 24 + (icoTrofeo ? icoTrofeo + 4 : 0);
      const placa = this.add.graphics().setDepth(903);
      const hP = ALTO_CARTEL, mP = hP / 2;
      placa.fillStyle(0x000000, 0.4);
      placa.fillRoundedRect(cx - anchoEtq / 2, yNombre - mP + 3, anchoEtq, hP, 9);
      placa.fillStyle(0x5C3317, 1);
      placa.fillRoundedRect(cx - anchoEtq / 2, yNombre - mP, anchoEtq, hP, 9);
      placa.fillStyle(0x7A4A26, 1);
      placa.fillRoundedRect(cx - anchoEtq / 2 + 2, yNombre - mP + 2, anchoEtq - 4, 12, { tl: 7, tr: 7, bl: 2, br: 2 });
      placa.lineStyle(2, 0x1a0f08, 1);
      placa.strokeRoundedRect(cx - anchoEtq / 2, yNombre - mP, anchoEtq, hP, 9);
      this._sprites.push(placa, etiqueta);
      let xTxt = cx - anchoEtq / 2 + 12;
      if (icoTrofeo) {
        const t = this.add.image(xTxt + icoTrofeo / 2, yNombre, 'trofeoFila').setDisplaySize(icoTrofeo, icoTrofeo).setDepth(904);
        this._sprites.push(t);
        xTxt += icoTrofeo + 4;
      }
      etiqueta.setPosition(xTxt, yNombre);

      // Píldora de estado: "✓ Ganador" (verde) / "Derrotado" (gris)
      const yPill = yPillComun;
      const pillAlto = 26;
      const estiloPill = { fontFamily: 'Fredoka, Arial', fontSize: '14px', fontStyle: '600' };
      const textoPill = esGanadorGrupo ? '✓ Ganador' : 'Derrotado';
      const medPill = this.add.text(0, 0, textoPill, estiloPill);
      const anchoPill = Math.max(Math.ceil(medPill.width) + 30, 104);
      medPill.destroy();
      const pg = this.add.graphics().setDepth(903);
      const ppx = cx - anchoPill / 2, ppy = yPill - pillAlto / 2;
      pg.fillStyle(0x000000, 0.5);
      pg.fillRoundedRect(ppx, ppy + 3, anchoPill, pillAlto, pillAlto / 2);
      pg.fillStyle(esGanadorGrupo ? 0x3E8E5A : 0xCFC5B2, 1);
      pg.fillRoundedRect(ppx, ppy, anchoPill, pillAlto, pillAlto / 2);
      pg.lineStyle(2, esGanadorGrupo ? 0x1F5C38 : 0x6f6558, 1);
      pg.strokeRoundedRect(ppx, ppy, anchoPill, pillAlto, pillAlto / 2);
      const pt = this.add.text(cx, yPill, textoPill, esGanadorGrupo
        ? { ...estiloPill, color: '#FFFFFF', stroke: '#14391f', strokeThickness: 3 }
        : { ...estiloPill, color: '#FFFFFF', stroke: '#2C160E', strokeThickness: 1.5 }
      ).setOrigin(0.5).setDepth(904);
      this._sprites.push(pg, pt);
    });

    // Carga diferida de las caras que todavía no estaban en caché
    if (pendientes.length > 0) {
      const unicos = [];
      pendientes.forEach(p => { if (!unicos.find(u => u.clave === p.clave) && !this.textures.exists(p.clave)) unicos.push(p); });
      unicos.forEach(p => this.load.image(p.clave, p.url));
      if (unicos.length > 0) {
        this.load.once(Phaser.Loader.Events.COMPLETE, () => pendientes.forEach(p => p.listo()));
        this.load.start();
      } else {
        pendientes.forEach(p => p.listo());
      }
    }

    // 3) Escudo central con el marcador final
    if (total >= 2) {
      const tantosGan = ganadores.length ? Number(ganadores[0].tantos) : NaN;
      const tantosPer = perdedores.length ? Number(perdedores[0].tantos) : NaN;
      if (this.textures.exists('escudoSinTexto')) {
        const esc = this.add.image(escudoX, cyAv, 'escudoSinTexto').setDisplaySize(96, 96).setDepth(904);
        this._sprites.push(esc);
      }
      if (Number.isFinite(tantosGan) && Number.isFinite(tantosPer)) {
        const marcador = `${tantosGan} - ${tantosPer}`;
        const txtM = this.add.text(escudoX, cyAv + 1, marcador, {
          fontFamily: 'Fredoka, Arial', fontSize: '19px', fontStyle: '700', color: '#FFD98A',
          stroke: '#2C160E', strokeThickness: 4,
        }).setOrigin(0.5).setDepth(906);
        const anchoM = Math.max(txtM.width + 18, 60);
        const plaqueta = this.add.graphics().setDepth(905);
        plaqueta.fillStyle(0x000000, 0.45);
        plaqueta.fillRoundedRect(escudoX - anchoM / 2, cyAv - 14 + 3, anchoM, 30, 9);
        plaqueta.fillStyle(0x5C3317, 1);
        plaqueta.fillRoundedRect(escudoX - anchoM / 2, cyAv - 14, anchoM, 30, 9);
        plaqueta.lineStyle(2.5, 0x1a0f08, 1);
        plaqueta.strokeRoundedRect(escudoX - anchoM / 2, cyAv - 14, anchoM, 30, 9);
        this._sprites.push(plaqueta, txtM);
      }
    }

    // 4) Moneda del mate + frase de la partida
    const frase = esCampeon
      ? '¡Sos el campeón del torneo!'
      : (datos.motivo === 'abandono'
        ? (gano ? '¡Victoria por abandono!' : 'Perdiste por desconexión')
        : (modo === 'victoria' ? '¡Victoria!' : (modo === 'derrota' ? 'Derrota' : titulo || '')));
    // Pase 417: sin moneda ni frase "Derrota"/"¡Victoria!" (redundantes con el cartel): la botonera sube. Solo queda,
    // como texto simple, una frase que aporta información (campeón del torneo / abandono).
    const fraseInfo = (esCampeon || datos.motivo === 'abandono') ? frase : '';
    let y = total ? yPillComun + 13 + 22 : 250;
    if (modo === 'neutro') {
      // Pase 415: "Sala cancelada" — medallon de madera con reloj de arena + mensaje en un pergamino
      // con borde de madera. No hubo partida: nada de moneda ni de revancha.
      const cyIcono = 186;
      this._dibujarRelojArena(400, cyIcono, 40, 904);
      const mensajeCancel = String(titulo || 'La sala se canceló.');
      const txtMsg = this.add.text(400, 0, mensajeCancel, {
        fontFamily: 'Nunito, Arial', fontSize: '17px', fontStyle: '800', color: '#3B2312',
        align: 'center', wordWrap: { width: 360 }, lineSpacing: 5,
      }).setOrigin(0.5, 0.5).setDepth(906);
      const wP = 440, hP2 = Math.ceil(txtMsg.height) + 48, xP = 400 - wP / 2, yP = cyIcono + 40 + 14;
      txtMsg.setY(yP + hP2 / 2);
      const pg2 = this.add.graphics().setDepth(905);
      pg2.fillStyle(0x000000, 0.45);
      pg2.fillRoundedRect(xP, yP + 4, wP, hP2, 14);
      pg2.fillStyle(0x5C3317, 1);
      pg2.fillRoundedRect(xP, yP, wP, hP2, 14);
      pg2.fillStyle(0x7A4A26, 1);
      pg2.fillRoundedRect(xP + 2, yP + 2, wP - 4, 10, { tl: 12, tr: 12, bl: 2, br: 2 });
      pg2.fillStyle(0xEAD9B5, 1);
      pg2.fillRoundedRect(xP + 9, yP + 9, wP - 18, hP2 - 18, 8);
      pg2.fillStyle(0xB89A6A, 0.45);
      pg2.fillRoundedRect(xP + 9, yP + 9, wP - 18, 8, { tl: 8, tr: 8, bl: 2, br: 2 });
      pg2.lineStyle(2, 0x6b4a34, 1);
      pg2.strokeRoundedRect(xP + 9, yP + 9, wP - 18, hP2 - 18, 8);
      pg2.lineStyle(3, 0x1a0f08, 1);
      pg2.strokeRoundedRect(xP, yP, wP, hP2, 14);
      [[xP + 5, yP + 5], [xP + wP - 5, yP + 5], [xP + 5, yP + hP2 - 5], [xP + wP - 5, yP + hP2 - 5]].forEach(([rx, ry]) => {
        pg2.fillStyle(0xC9A25A, 1);
        pg2.fillCircle(rx, ry, 2.6);
        pg2.lineStyle(1, 0x1a0f08, 1);
        pg2.strokeCircle(rx, ry, 2.6);
      });
      this._sprites.push(pg2, txtMsg);
      y = yP + hP2 + 26;
    }
    if (fraseInfo && modo !== 'neutro') {
      const txtFrase = this.add.text(400, y + 4, fraseInfo, {
        fontFamily: 'Fredoka, Arial', fontSize: '22px', fontStyle: '600', color: '#FFF8ED',
        stroke: '#000000', strokeThickness: 4, align: 'center', wordWrap: { width: 560 },
      }).setOrigin(0.5, 0.5).setDepth(905);
      this._sprites.push(txtFrase);
      y += 38;
    }

    // 5) Puntos de Liga Criolla (solo partidas ranked): ficha con el cuadro de fósforos
    const puntosRank = recompensa && recompensa.puntos != null && Number.isFinite(Number(recompensa.puntos))
      ? Number(recompensa.puntos) : null;
    if (datos.ranked && puntosRank !== null) {
      const textoP = `${puntosRank > 0 ? '+' : ''}${puntosRank} Puntos`;
      const colorP = puntosRank > 0 ? '#1f7a3c' : (puntosRank < 0 ? '#8c2a2a' : '#7a6660');
      const tp = this.add.text(0, 0, textoP, { fontFamily: 'Fredoka, Arial', fontSize: '16px', fontStyle: '700', color: colorP }).setOrigin(0, 0.5).setDepth(905);
      const ICONO = 26, PAD = 16, ALTO_F = 36;
      const wF = PAD * 2 + ICONO + 6 + tp.width;
      const fx0 = 400 - wF / 2;
      const ficha = this.add.graphics().setDepth(904);
      ficha.fillStyle(0x4A2C2A, 0.28);
      ficha.fillRoundedRect(fx0, y, wF, ALTO_F, 11);
      ficha.fillStyle(0xEAD9B5, 1);
      ficha.fillRoundedRect(fx0 + 1.5, y + 3, wF - 3, ALTO_F - 5, 9);
      ficha.fillStyle(0xB89A6A, 0.45);
      ficha.fillRoundedRect(fx0 + 1.5, y + 3, wF - 3, 6, 9);
      ficha.lineStyle(2, 0x6b4a34, 1);
      ficha.strokeRoundedRect(fx0, y, wF, ALTO_F, 11);
      const cyF = y + ALTO_F / 2 + 1;
      const fosforos = this.add.image(fx0 + PAD + ICONO / 2, cyF, 'fosforosPuntos').setDisplaySize(ICONO, ICONO).setDepth(905);
      tp.setPosition(fx0 + PAD + ICONO + 6, cyF);
      this._sprites.push(ficha, fosforos, tp);
      y += ALTO_F + 10;
    } else {
      y += modo === 'neutro' ? 0 : 6;
    }

    // 6) Botonera vertical en cápsulas 3D
    const altoBoton = 46;
    if (!esTorneo && modo !== 'neutro') {
      const revanchaTexto = 'Pedir revancha';
      const revanchaAncho = this._medirAnchoTextoOverlay(revanchaTexto, '17px') + 60;
      const { contenedor: contRevancha, img: imgRevancha } = this._crearBotonOverlay({
        x: 400, y: y + altoBoton / 2, ancho: revanchaAncho, alto: altoBoton, variante: 'esmeralda', texto: revanchaTexto, tamanoFuente: 17,
        onClick: () => {
          this.socket.emit('pedir-revancha', { codigoSala: this.codigoSala });
          contRevancha.disableInteractive();
          if (imgRevancha) imgRevancha.setTint(0x8a9e8a);
        },
      });
      this.contRevancha = contRevancha;
      this.imgRevancha = imgRevancha;
      y += altoBoton + 10;
    }
    const labelBoton = esTorneo ? 'Ver bracket' : 'Volver al lobby';   // Pase 415: en sala cancelada es el unico boton
    const volverAncho = this._medirAnchoTextoOverlay(labelBoton, '17px') + 60;
    this._crearBotonOverlay({
      x: 400, y: y + altoBoton / 2, ancho: volverAncho, alto: altoBoton, variante: 'oro', texto: labelBoton, tamanoFuente: 17,
      onClick: () => {
        if (esTorneo && this.onVerBracket) {
          this.onVerBracket(torneoId);
        } else if (this.onVolverLobby) {
          this.onVolverLobby(this._logrosDesbloqueadosPendientes || []);
        }
      },
    });
    y += altoBoton + 8;

    if (!esTorneo && modo !== 'neutro') {
      this.fondoAlertaRevancha = this.add.graphics().setDepth(901).setVisible(false);
      this._sprites.push(this.fondoAlertaRevancha);
      this.textoEsperaRevancha = this.add.text(400, y, '', {
        fontFamily: 'Nunito, Arial', fontSize: '12px', fontStyle: 'bold', color: '#F1D9A8', align: 'center',
        stroke: '#000000', strokeThickness: 3, wordWrap: { width: 360 },
      }).setOrigin(0.5, 0).setDepth(905);
      this._sprites.push(this.textoEsperaRevancha);
    }

    // 7) Celebración: destellos junto al cartel y a los ganadores + papelitos
    if (modo === 'victoria') {
      const estrella = (ex, ey, tam, delay) => {
        const s = this.add.graphics().setDepth(907);
        s.fillStyle(0xFFFFFF, 1);
        s.fillTriangle(0, -tam, tam * 0.22, 0, -tam * 0.22, 0);
        s.fillTriangle(0, tam, tam * 0.22, 0, -tam * 0.22, 0);
        s.fillTriangle(-tam, 0, 0, tam * 0.22, 0, -tam * 0.22);
        s.fillTriangle(tam, 0, 0, tam * 0.22, 0, -tam * 0.22);
        s.fillStyle(0xFFD668, 0.9);
        s.fillCircle(0, 0, tam * 0.2);
        s.setPosition(ex, ey).setScale(0).setAlpha(0);
        this._sprites.push(s);
        this._tweensFinal.push(this.tweens.add({
          targets: s, scale: 1, alpha: 1, angle: 45, duration: 520, delay, yoyo: true, repeat: -1, repeatDelay: 900,
          ease: 'Sine.easeInOut',
        }));
      };
      const cartelAncho = cartel && cartel.getBounds ? cartel.getBounds().width : 300;
      estrella(400 + cartelAncho / 2 - 22, 58, 12, 0);
      estrella(400 - cartelAncho / 2 + 26, 104, 9, 500);
      if (ganadores.length) {
        const gx = 400 - anchoFila / 2 + tamano / 2;
        estrella(gx - tamano * 0.5, cyAv - tamano * 0.4, 10, 250);
        estrella(gx + tamano * 0.55, cyAv + tamano * 0.1, 8, 800);
        estrella(gx + tamano * 0.1, cyAv - tamano * 0.62, 7, 1200);
      }
      const colores = [0xFFB627, 0xFFD668, 0x4FB3E8, 0xFFFFFF, 0xE74C3C, 0x10B981];
      const extraTopConfeti = this._L ? Math.max(0, (this._vistaEspera().h - 600) / 2) : 0;   // layout angosto: caen desde el borde de arriba de la ventana
      for (let i = 0; i < 50; i++) {
        const cx0 = 20 + Math.random() * 760;
        const cy0 = -6 - extraTopConfeti;
        const pieza = this.add.graphics().setDepth(908);
        pieza.fillStyle(colores[i % colores.length], 1);
        if (i % 3 === 0) pieza.fillRect(-1.5, -5, 3, 10); else pieza.fillRect(-3, -3, 6, 6);
        pieza.setPosition(cx0, cy0);
        pieza.setAngle(Math.random() * 360);
        this._sprites.push(pieza);
        this.tweens.add({
          targets: pieza,
          y: 300 + Math.random() * 300 + extraTopConfeti,
          x: cx0 + (Math.random() * 80 - 40),
          angle: pieza.angle + (Math.random() > 0.5 ? 400 : -400),
          alpha: { from: 1, to: 0 },
          duration: 1800 + Math.random() * 1600,
          delay: Math.random() * 1500,
          ease: 'Cubic.easeIn',
        });
      }
    }
  }

  // Pase 415: medallon de caoba con un reloj de arena dibujado (para "Sala cancelada").
  _dibujarRelojArena(cx, cy, tam, depth) {
    const r = tam;
    const g = this.add.graphics().setDepth(depth);
    g.fillStyle(0x000000, 0.45);
    g.fillCircle(cx, cy + 4, r);
    g.fillStyle(0x5C3317, 1);
    g.fillCircle(cx, cy, r);
    g.lineStyle(3, 0x1a0f08, 1);
    g.strokeCircle(cx, cy, r);
    g.fillStyle(0x7A4A26, 1);
    g.fillCircle(cx, cy, r - 6);
    g.lineStyle(2, 0x1a0f08, 0.8);
    g.strokeCircle(cx, cy, r - 6);
    const k = r / 40;
    const cw = 34 * k, ch = 6 * k, hh = 22 * k, gw = 25 * k;
    // vidrio
    g.fillStyle(0xF4E3B8, 0.28);
    g.fillTriangle(cx - gw / 2, cy - hh + ch / 2, cx + gw / 2, cy - hh + ch / 2, cx, cy);
    g.fillTriangle(cx - gw / 2, cy + hh - ch / 2, cx + gw / 2, cy + hh - ch / 2, cx, cy);
    // arena (casi toda abajo; un hilo cayendo)
    g.fillStyle(0xE9C46A, 1);
    g.fillTriangle(cx - gw * 0.38, cy + hh - ch / 2, cx + gw * 0.38, cy + hh - ch / 2, cx, cy + hh * 0.34);
    g.fillTriangle(cx - gw * 0.14, cy - hh * 0.30, cx + gw * 0.14, cy - hh * 0.30, cx, cy - hh * 0.06);
    g.fillRect(cx - 0.9 * k, cy - hh * 0.06, 1.8 * k, hh * 0.42);
    // contorno del vidrio
    g.lineStyle(2 * k, 0x1a0f08, 1);
    g.strokeTriangle(cx - gw / 2, cy - hh + ch / 2, cx + gw / 2, cy - hh + ch / 2, cx, cy);
    g.strokeTriangle(cx - gw / 2, cy + hh - ch / 2, cx + gw / 2, cy + hh - ch / 2, cx, cy);
    // tapas de madera clara
    [cy - hh, cy + hh].forEach((ty) => {
      g.fillStyle(0xC9965A, 1);
      g.fillRoundedRect(cx - cw / 2, ty - ch / 2, cw, ch, 2 * k);
      g.lineStyle(2 * k, 0x1a0f08, 1);
      g.strokeRoundedRect(cx - cw / 2, ty - ch / 2, cw, ch, 2 * k);
    });
    this._sprites.push(g);
    return g;
  }

  // Mide el ancho real que ocuparía un texto con la fuente/tamaño de los
  // botones de esta pantalla, creando y destruyendo un objeto de texto
  // invisible — así los botones se ciñen al contenido real (como hace el
  // nativo vía padding) en vez de un ancho fijo adivinado.
  _medirAnchoTextoOverlay(texto, fontSize) {
    const tmp = this.add.text(0, 0, texto, { fontFamily: 'Fredoka, Arial', fontSize, fontStyle: '600' });
    const ancho = tmp.width;
    tmp.destroy();
    return ancho;
  }

  _actualizarEstadoRevancha(confirmados, total) {
    if (this.textoEsperaRevancha) {
      // Centésimo pase: por si este texto estaba mostrando la placa de
      // alerta de un intento anterior (no debería pasar en el flujo
      // normal, pero defensivo) — el estado de "esperando confirmación"
      // es neutro, sin placa.
      if (this.fondoAlertaRevancha) this.fondoAlertaRevancha.setVisible(false);
      this.textoEsperaRevancha.setText(`Esperando confirmación… (${confirmados}/${total || '?'})`)
        .setColor('#7a6660').setFontStyle('bold');
    }
  }

  // Centésimo pase: "Se agotó el tiempo para confirmar la revancha" vivía
  // como texto rojo plano flotando sobre el pergamino de la tarjeta —
  // pedido explícito del usuario: que se lea como una notificación
  // oficial del sistema, no como un error de texto suelto.
  // Ducentésimo septuagésimo segundo pase: pedido explícito del usuario
  // — eliminar la placa/recuadro secundario detrás del mensaje (y el
  // atenuado del botón): "que solo se renderice el cartel del mensaje y
  // el botón PNG directamente sobre el pergamino interior". El mensaje
  // ahora se dibuja como texto suelto en rojo directo sobre el pergamino
  // de la tarjeta (sin placa propia detrás), y el botón de "Pedir
  // revancha" se desactiva sin bajarle la opacidad — mismo criterio de
  // "alpha siempre 1.0" que el resto de los botones de esta pantalla.
  _mostrarAlertaRevancha(mensaje) {
    if (!this.textoEsperaRevancha) return;
    if (this.fondoAlertaRevancha) this.fondoAlertaRevancha.setVisible(false);

    // Pase 266: se agrega `setFontSize('10px')` acá (y no en la creación
    // del texto, línea ~2089) para que la reducción de tamaño afecte
    // SOLO al mensaje de alerta ("se agotó el tiempo..."), no al texto
    // "Esperando confirmación… (n/n)" que reutiliza el mismo objeto en
    // su estado normal y que el usuario no pidió achicar. 12px → 10px
    // es ~17% de reducción, dentro del 15-20% pedido.
    this.textoEsperaRevancha.setText(mensaje).setColor('#FEF08A').setFontStyle('bold').setFontSize('11px').setStroke('#000000', 3).setShadow(1, 1, '#000000', 2, true, true);   // Pase 411: pergamino claro sobre el paño, con contorno oscuro
    this.textoEsperaRevancha.setDepth(902);

    // Si el jugador todavía no había tocado "Pedir revancha" (el botón
    // sigue interactivo), se desactiva — ya no se tiñe/atenúa (pedido
    // explícito del usuario, ver comentario de la función). Si ya lo
    // había tocado, el botón ya quedó en su propio estado "ya pedida"
    // (tinte gris apagado, ver el onClick más arriba) y se deja así.
    if (this.contRevancha && this.contRevancha.input && this.contRevancha.input.enabled) {
      this.contRevancha.disableInteractive();
    }
  }

_renderizarEstado(animarReparto) {
     this._limpiarSprites();
    this._jugadaEnviada = false;   // Pase 414: llego un estado nuevo, se puede volver a jugar
    if (this._L) this._modoCamaraAngosto('juego');

    if (this.mesaImg) this.mesaImg.setVisible(true);
    if (this.sombraMesa) this.sombraMesa.setVisible(true);
    // Pase 346: con la partida en marcha, las placas de puntaje vuelven.
    this._mostrarMarcadores(true);

    const e = this.estado;
    if (!e) return;

    // Pase siguiente (anillo de tiempo web, paridad con nativo): se
    // resetea en cada render de estado — más abajo se vuelve a fijar (en
    // el bloque 1v1 o en _dibujarJugador para equipos) SOLO si el jugador
    // que tiene el turno ahora mismo es un rival. `this._anilloRect` guarda
    // el rectángulo (mismo que el fondo/placa del nombre) sobre el que el
    // tick de `timerText` (cada 500ms, ver create()) dibuja el anillo que
    // se va vaciando — no se puede dibujar de una sola vez acá porque el
    // porcentaje restante cambia entre un render de estado y el siguiente.
    this._anilloRect = null;
    this._anilloEsRival = false;
    // Nonagésimo séptimo pase: acá vivía el reset de `turnoPlaca` (la
    // placa de madera detrás de "Tu turno", sacada a pedido del usuario —
    // ver comentario junto a `turnoText` en create()). Ya no hay nada que
    // esconder: `turnoText.setText('')` más abajo alcanza solo.

    // Defensivo: el backend siempre debería mandar truco/flor/envido como
    // objetos (con sus campos en null/false cuando no hay nada pendiente),
    // pero si llega un estado sin alguno de estos completo (visto al entrar
    // a un 1v1 armado con el bot de pruebas, test-bots.js) evita que TODO
    // el render de la mesa se caiga con un TypeError — sin esto, un solo
    // estado mal formado deja la pantalla del juego rota para siempre.
    e.truco = e.truco || { nivel: null, resuelto: true };
    e.envido = e.envido || { tipo: null, resuelto: true };
    e.flor = e.flor || { nivel: null, resuelto: true };

    const hayCantoSinResolver =
      (!!e.truco.nivel && !e.truco.resuelto) ||
      (!!e.envido.tipo && !e.envido.resuelto) ||
      (!!e.flor.nivel && !e.flor.resuelto) ||
      !!e.declaracionEnvido;   // Pase 414: tambien durante la declaracion del envido ("Tengo N" / "Son buenas")

    // Pase 600 (paridad con la app): de quién es el RELOJ. Con un canto pendiente (truco / envido / flor) el servidor lo corre
    // para quien DEBE RESPONDER, no para quien tiene el turno de jugar carta (`e.turno`). Antes, si yo cantaba truco en mi
    // turno, el anillo y el "Tu turno" se quedaban de mi lado en vez de pasar al rival.
    const hayCantoParaResponder = !!(e.truco.pendienteDeRespuesta || (e.envido && e.envido.pendienteDeRespuesta) || (e.flor && e.flor.pendienteDeRespuesta));
    const hayCantoPendiente = (!!e.truco.nivel && !e.truco.resuelto) || (!!e.envido.tipo && !e.envido.resuelto) || (!!e.flor.nivel && !e.flor.resuelto);
    const relojEsDelRival = hayCantoPendiente && !hayCantoParaResponder;
    const relojEsMio = hayCantoParaResponder || (e.turno === 'mio' && !relojEsDelRival);

    // Pase siguiente (placa doble): cada lado tiene su propia placa/texto
    // ahora (antes un solo "N - N" combinado en `scoreText`) — cada
    // número, solo, casi nunca llega a 2 cifras muy seguido (el truco se
    // juega a 15/30), así que ya no hace falta el ajuste de fontSize que
    // tenía el texto combinado.
    this.scoreText.setText(String(e.scores.yo));
    if (this.scoreTextRival) this.scoreTextRival.setText(String(e.scores.rival));
    this._notificarPuntos(e.scores.yo, e.scores.rival);
    this.miManoTexto.setText(e.esMano ? 'Sos mano' : '');
    if (this.manoIconoPropio) this.manoIconoPropio.setVisible(!!e.esMano);
    this.turnoText.setText((relojEsMio && !Array.isArray(e.companeros)) ? '● Tu turno' : '');   // Pase 445: en equipos lo reemplaza mi placa
    // Pase siguiente: anillo del propio turno — mismo mecanismo que el
    // del rival, pero alrededor de "● Tu turno" (que ya vive justo
    // arriba de "Sos mano"/el ícono de mano propia, a pedido del
    // usuario). Aplica tanto en 1v1 como en equipos (turnoText no
    // depende de esModoEquipos). Antes no había NINGÚN indicador de
    // tiempo para el turno propio en la web — solo el número ⏱ arriba,
    // lejos de las cartas.
    if (relojEsMio && !Array.isArray(e.companeros)) {
      const padX = 6, padY = 3;
      this._anilloRect = {
        x: this.turnoText.x - this.turnoText.width / 2 - padX,
        y: this.turnoText.y - this.turnoText.height / 2 - padY,
        w: this.turnoText.width + padX * 2,
        h: this.turnoText.height + padY * 2,
        r: 8,
      };
    }

    const esModoEquipos = Array.isArray(e.companeros);
    // Pase siguiente (placa doble): `fondoInfoRival`/`scoreTextRival` ya
    // NO se ocultan en modo equipos — antes la placa entera desaparecía
    // porque el nombre "Rival" no tiene sentido con más de un rival, pero
    // ahora esa misma placa también es donde vive el puntaje del equipo
    // rival (antes combinado en el "N - N" de la placa "Vos", que SÍ
    // seguía visible en equipos). Solo se sigue ocultando lo que de verdad
    // no aplica a equipos: el nombre de un rival puntual y el ícono de
    // persona (ambos pensados para "un solo rival", no para un equipo).
    this.labelRival.setVisible(!esModoEquipos);
    if (this.nombreRivalAngosto && esModoEquipos) this.nombreRivalAngosto.setVisible(false);
    if (this.manoIconoRival) this.manoIconoRival.setVisible(false);   // Pase 599: se saca el ícono de turno del rival (ya está el anillo de tiempo); queda solo como ancla de la medalla de mano
    // Pase 580: en 1v1, medalla de "Mano" junto al ícono del rival cuando el rival es mano (yo no).
    if (this.medallaManoRival) { this._posicionarMedallaRival(); this.medallaManoRival.setVisible(!esModoEquipos && !e.esMano); }

    // Trigésimo segundo pase: "Rival" + su ícono se prenden (dorado, con
    // pulso continuo, igual que el 🎯 de nativo) cuando es el turno del
    // rival, y se apagan (gris, quietos) cuando es el turno propio. Se
    // guarda el estado anterior en _rivalTurnoEncendido para no reiniciar
    // el tween en cada actualización de estado si no cambió nada — esta
    // función se llama en cada evento de estado del backend, no solo al
    // cambiar de turno.
    // Nonagésimo tercer pase: el usuario reportó (de nuevo, ahora sobre el
    // NOMBRE del rival en vez de los puntos — mismo bug de fondo) que se
    // perdía por falta de opacidad: acá el pulso ENCENDIDO bajaba hasta
    // alpha 0.6, y el estado APAGADO quedaba en alpha 0.5 sobre un color
    // YA semitransparente ('#ffffff77') — compuesto, terminaba casi
    // invisible. `labelRival` deja de animarse/atenuarse por turno —
    // queda siempre a alpha 1 con el color sólido+contorno definidos en
    // su creación (ver más arriba). El indicador de turno sigue existiendo
    // (ahora solo vía el ícono `manoIconoRival`: dorado+pulso cuando es su
    // turno, gris quieto cuando no).
    const esTurnoRival = !esModoEquipos && !relojEsMio;   // Pase 600: es el reloj del rival cuando NO es el mío (incluye cuando yo canté y él tiene que responder)
    if (esTurnoRival !== this._rivalTurnoEncendido) {
      this._rivalTurnoEncendido = esTurnoRival;
      if (this.manoIconoRival) {
        this.tweens.killTweensOf(this.manoIconoRival);
        if (esTurnoRival) {
          this.manoIconoRival.setAlpha(1).clearTint();
          this.tweens.add({
            targets: this.manoIconoRival,
            alpha: { from: 1, to: 0.6 },
            duration: 550,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        } else {
          this.manoIconoRival.setAlpha(0.4).setTint(0x777777);
        }
      }
    }

    // Pase siguiente (placa doble, pedido del usuario): antes solo la
    // placa del rival se "prendía/apagaba" según de quién era el turno —
    // la propia ("Vos") se quedaba siempre igual. Se probó atenuar juntas
    // las dos (0.55 la que no tiene el turno) para reforzar de quién es el
    // turno con solo mirar el marcador.
    // Nonagésimo segundo pase: el usuario reportó que el número del rival
    // se veía "casi transparente"/poco legible con esa atenuación — pidió
    // opacidad 1.0 siempre en los DOS números, igual de legibles, con solo
    // una sombra fina (ya la tienen, ver `shadow` en la definición de
    // `scoreText`/`scoreTextRival` más arriba) en vez de alpha bajo. El
    // indicador de turno sigue existiendo por otros medios (badge "● Tu
    // turno", anillo/pulso de `labelRival` vía `_rivalTurnoEncendido`) —
    // se saca SOLO esta atenuación redundante de los números.
    this.scoreText.setAlpha(1);
    if (this.scoreTextRival) this.scoreTextRival.setAlpha(1);

    if (esModoEquipos) {
      this._renderizarEquipos(e, animarReparto, hayCantoSinResolver);
    } else {
      if (this._L) { this._eqMap = null; this._L.perspCY = this._L.feltCY; this._L.perspRY = this._L.feltRY; }
      this._ajustarMesaSegunAsientos(2);
      this._nombreRivalActual = e.nombreRival || null;
      this.labelRival.setText(this._L ? 'Rival' : (this._truncarNombre(e.nombreRival) || 'Rival'));
      if (this.nombreRivalAngosto) {
        const nr = e.nombreRival || '';
        this.nombreRivalAngosto.setText(nr.length > 18 ? nr.slice(0, 17) + '…' : nr).setVisible(!!nr);
      }

      // Pase siguiente: anillo de tiempo (paridad con el nativo, pase
      // 177) — antes usaba el rectángulo dinámico de la placa vieja;
      // ahora la placa del rival es fija (`PLACA_RIVAL_CX/CY`, ver
      // create()), así que el anillo se calcula directo de esas
      // constantes en vez de medir texto.
      if (esTurnoRival) {
        this._anilloRect = this._rectAnilloRival();
        this._anilloEsRival = true;
      }

      const revelacionFlorRival = this._mostrandoRevelacionFlor
        ? (e.florPendienteDeMostrar || []).find(f => !f.esMio)
        : null;
      const revelacionEnvidoRival = this._mostrandoRevelacionEnvido
        ? (e.envidoPendienteDeMostrar || []).find(f => !f.esMio)
        : null;
      const revelacionRival = revelacionFlorRival || revelacionEnvidoRival;

      // Pase siguiente (feedback del usuario: "las cartas del rival deben
      // asomar desde el borde superior exterior de la mesa, no estar
      // apoyadas sobre el paño verde") — subidas 25px (105→80), quedan
      // justo contra el borde superior real de la mesa nueva (el óvalo de
      // madera arranca ~Y=76 con el tamaño/posición actual de `mesaImg`,
      // ver `_ajustarMesaSegunAsientos`), en vez de nacer más abajo, ya
      // sobre el paño.
      if (revelacionRival) {
        this._dibujarFilaCartasReveladas(revelacionRival.cartas, this._L ? this._L.rivalY : 80);
      } else {
        this._dibujarFilaDorso(e.cartasRivalEnMano, this._L ? this._L.rivalY : 80);
      }

      // Sexagésimo primer/segundo pase — punto 1 ("jerarquía visual y
      // foco"): las cartas jugadas del centro se agrandaron en dos empujones
      // (0.50→0.62→0.72) para que "pesen" más.
      // Sexagésimo tercer pase — pedido nuevo: la carta que ganó su ronda
      // queda levemente por encima y por delante de la que perdió, tapando
      // un cuarto de ella — de paso esto reemplaza las dos filas separadas
      // (rival arriba, mía abajo, con 85px de aire entre medio) por un solo
      // bloque más compacto, dejando más lugar libre en la mesa. Y de paso
      // se bajó un poco el tamaño (0.72→0.66) a pedido del usuario.
      // Sexagésimo cuarto pase: el usuario probó esto en vivo y reportó que
      // el bloque quedaba un poco arriba del centro de la mesa — bajado de
      // 242 a 262. Sexagésimo quinto pase: se pasó de largo, quedó un poco
      // abajo del centro — subido de 262 a 250 (captura del usuario).
      // Pase siguiente: con la mesa nueva (asset e integración distintos a
      // la mesa vieja con la que se afinó el 250 de arriba), el usuario
      // pidió bajar LIGERAMENTE el centro para que el par de cartas quede
      // en el centro geométrico real del paño — 250→260. Nonagésimo
      // primer pase: el usuario pidió subirlas de nuevo ~15px porque
      // ahora chocaban visualmente con los botones de Envido de la fila
      // superior nueva — 260→245. Nonagésimo segundo pase: 25px más
      // arriba (245→220) para que queden alineadas al centro geométrico
      // real del paño (la fila de botones ahora vive en una sola línea
      // más abajo, dentro del panel agrandado, así que hay más aire).
      this._dibujarDueloCartas(e.jugadasRival, e.misJugadas, this._L ? this._L.dueloY : 220, this._L ? this._L.dueloEscala : 0.66, 60);
            // Pase siguiente (feedback del usuario: "deben nacer y apoyarse
            // directamente desde el marco de madera de la botonera
            // inferior, sin invadir la zona verde") — bajada 15px (490→505)
            // para que se hunda más adentro del panel de madera (que
            // arranca en Y=500, ver _crearElementosDeTexto) en vez de
            // asomar tan poco. Nonagésimo primer pase: 10px más (505→515)
            // para que queden justo detrás/debajo de los botones de la
            // fila superior nueva (Envido/Real Envido/Falta Envido).
            // Nonagésimo segundo pase: 10px más (515→525), pedido explícito
            // del usuario para que nazcan desde atrás del panel de madera
            // en vez de solaparse sobre la tira de remaches superior.
            // Nonagésimo tercer pase: marcha atrás parcial — 30px hacia
            // ARRIBA (525→495), pedido explícito del usuario porque los
            // remaches de la botonera (agrandada en el pase anterior) ya
            // tapaban los números/índices de las cartas.
            this._dibujarManoJugador(e.misCartas, this._L ? this._L.manoY : 485, e.turno === 'mio' && !hayCantoSinResolver, animarReparto);
    }

    this._dibujarBotonesCanto(e);
}                  // 👈 esta le falta: cierra la función que tiene el if/else

_renderizarEquipos(e, animarReparto, hayCantoSinResolver) {
    const centroX = 400;
    const totalAsientos = e.companeros.length + e.rivales.length;
    const esTresVTres = totalAsientos === 5;
    // Pase 207: bug real reportado por el usuario ("las posiciones... están
    // muy abajo de la posición de la mesa") — en 2v2 (esTresVTres=false) los
    // dos asientos rivales quedan EXACTOS a 180°/0° (ver _calcularAsientos:
    // N=3, anguloPaso=90), donde sin(ángulo)=0. Como py = centroY +
    // sin(ángulo)*radioY, para esos dos asientos radioY no aporta NADA — su
    // Y queda siempre pegada a centroY, sin importar su valor. Con
    // centroY=320 (el mismo que usa 3v3) los rivales terminaban casi a la
    // altura del centro de la mesa en vez de "del otro lado", muy por
    // debajo de dónde 1v1 dibuja a su único rival (y=105, ver
    // _dibujarFilaDorso). Se sube centroY solo para el modo "normal" (2v2),
    // sin tocar 3v3 (que no tenía este reclamo).
    const centroY = esTresVTres ? 280 : 250;   // Pase 442: 320 - 40 (mesa elevada)
    // _dibujarJugador hace su propia clasificación de ángulo (para ubicar
    // las cartas jugadas de cada asiento) contra un centro de mesa
    // hardcodeado por separado — se sincroniza acá para que las dos cuentas
    // usen siempre el mismo centro y no se desalineen entre sí.
    this._centroMesaYActual = centroY;
    if (this._L) {
      this._eqMap = esTresVTres ? this._L.eq3 : this._L.eq2;
      this._L.perspCY = this._eqMap.cy;
      this._L.perspRY = 170 * this._eqMap.gy;
    }
    const radioX = esTresVTres ? 280 : 285;
    const radioY = esTresVTres ? 235 : 100;

    this._ajustarMesaSegunAsientos(totalAsientos);

    const asientos = this._calcularAsientos(e.companeros, e.rivales);
    asientos.forEach(({ jugador, angulo, tipo }) => {
      const rad = angulo * (Math.PI / 180);

      const esAbajo = Math.sin(rad) > 0.3;
      const esArribaCostado = Math.sin(rad) < -0.3 && Math.abs(Math.cos(rad)) > 0.3;

      let radioXAsiento = radioX;
      let radioYAsiento = radioY;

      const esArribaCentro = Math.sin(rad) < -0.7;

      if (esAbajo) {
        // Pase 215 — pedido explícito: "subir en el eje y los jugadores de
        // izquierda y derecha de abajo" (rival0@150° y rival2@30° en 3v3,
        // los únicos dos asientos que caen en esta rama — 2v2 no tiene
        // ninguno). Se baja el multiplicador de 1.2 a 0.9 para acercarlos
        // al centro de la mesa (menos radio vertical = más arriba en
        // pantalla, ya que esAbajo siempre suma hacia abajo).
        // Pase 217 — nuevo pedido, mismos dos asientos: correrlos hacia
        // afuera en X (cada uno se aleja del centro en su propio lado,
        // izquierda/derecha) y un poco más arriba en Y todavía.
        // Pase 218 — "en especial las de izquierda y derecha de abajo esas
        // especialmente están muy abajo": bajan bastante más el
        // multiplicador de Y (0.8 → 0.55) que el resto de los asientos, que
        // solo suben "un poco". X no se toca, no fue parte de este pedido.
        radioXAsiento = radioX * 0.95;
        radioYAsiento = radioY * 0.55;
      } else if (esArribaCostado) {
        // Pase 217 — mismo pedido para los de costado de arriba (3v3): más
        // afuera en X, y más arriba en Y. Acá sin(rad) es NEGATIVO (a
        // diferencia de esAbajo), así que subir más el asiento significa
        // AUMENTAR radioYAsiento, no bajarlo (centroY + negativo*radio: a
        // mayor radio, más se resta, más arriba en pantalla).
        // Pase 218 — "los jugadores deben subir en el eje y un poco": se
        // sube otro poco más (1.3 → 1.4).
        radioXAsiento = radioX * 1.0;
        radioYAsiento = radioY * 1.4;
      } else if (esArribaCentro) {
        // Pase 182 — bug real encontrado: este es el único asiento (de los 5
        // del 3v3) con cos(ángulo)≈0 — el que queda "de enfrente" del
        // jugador, arriba y centrado — y quedaba con dos valores placeholder
        // sin terminar ("ajustá este valor" / "y este") que multiplicaban el
        // radio vertical x2 (235*2=470). El mundo lógico del juego es
        // 800x600 (ver comentario en gameConfigOnline.js), así que
        // centroY(320) - 470 = -150: el asiento se calculaba y el jugador se
        // dibujaba bien, pero a 150px por ENCIMA del borde superior del
        // canvas — invisible en la práctica, aunque no había ningún error.
        // Eso es lo que se reportó como "el usuario de enfrente no se ve".
        // Se lo deja con un radio parecido al de los asientos de costado
        // (radioY*1.2 ahí), apenas más chico para que este jugador se note
        // "más al fondo" que los de costado, pero sin salirse del canvas.
        // Pase 209: pedido del usuario, con la fila de asientos de 2v2 ya
        // corregida (pase 207) — quiere subir el asiento "de enfrente"
        // (compañero, único con esArribaCentro en 2v2) un poco más
        // todavía, dejando los dos de costado (rivales) tal cual están.
        // Multiplicador mode-specific para no tocar 3v3 (que no tenía este
        // pedido): 0.85 (sin cambios) en 3v3, 1.15 en 2v2 — más radio
        // vertical = más lejos de centroY = más arriba en pantalla.
        // Pase 210: "quedó mejor... pero lo levantaría un poco más" — el
        // usuario confirmó que los dos de costado quedaron perfectos (no se
        // tocan), solo se sube otro poco el multiplicador 2v2: 1.15 → 1.3.
        // Pase 217 — pedido nuevo, esta vez para 3v3: "el de enfrente al
        // jugador también debe elevarse en el eje y unos pixeles para que
        // entren todos correctamente en la mesa". Mismo razonamiento que
        // esArribaCostado (sin(rad) negativo acá también): subir el
        // multiplicador sube el asiento en pantalla. Se toca solo la rama
        // 3v3 (0.85 → 0.95); el valor de 2v2 (1.3) no se toca, no fue parte
        // de este pedido.
        // Pase 218 — "los jugadores deben subir en el eje y un poco" (todos
        // los de 3v3): se sube otro poco más (0.95 → 1.05). 2v2 sigue sin
        // tocarse.
        radioXAsiento = radioX * 0.9;
        radioYAsiento = radioY * (esTresVTres ? 1.05 : 1.3);
      }

      let px = centroX + Math.cos(rad) * radioXAsiento;
      let py = centroY + Math.sin(rad) * radioYAsiento;
      // Pase 441 (3v3): los dos de abajo suben y se abren hacia los costados (no pisan la mano ni la
      // botonera); los de arriba bajan para quedar pegados al borde de la mesa.
      if (esTresVTres) {
        // Pase 448: los rivales de abajo suben 9% (54 px) más para despegarse de la mano propia y de mi placa;
        // los compañeros de arriba se corren 8% (64 px) hacia adentro, pegados al borde de la mesa.
        if (esAbajo) { py -= 40 + 54; px += (px < centroX ? -35 : 35); }
        else if (esArribaCostado) { py += 30; px += (px < centroX ? 64 : -64); }
        else if (esArribaCentro) py += 20;
      } else if (totalAsientos === 3) {
        // Pase 444/446 (2v2): el compañero sube 10% (60 px) hasta el borde de madera de la mesa; los dos
        // rivales de los costados quedan a y=215, la misma altura que sus cartas jugadas.
        if (tipo === 'companero') py -= 60; else py -= 35;   // Pase 446: mazo lateral a la altura de su carta jugada (y=215)
      }
      this._dibujarJugador(jugador, px, py, angulo, tipo);
    });

    // Sexagésimo primer/segundo pase — mismo aumento de escala que en 1v1
    // (0.45→0.56→0.65), para que la carta propia jugada al centro tenga el
    // mismo peso visual en 2v2/3v3. Sexagésimo tercer pase: bajada un poco
    // (0.65→0.60) junto con el ajuste de 1v1 — en equipos no hay una sola
    // "carta rival" para enfrentar en este mismo lugar (las de compañeros/
    // rivales viven junto a cada asiento, ver _dibujarJugador), así que
    // sigue siendo una fila simple, sin DueloCartas.
    this._dibujarFilaCartas(e.misJugadas, this._yEq(esTresVTres ? 276 : 269), false, false, (this._L ? 0.60 * 1.4 : 0.60) * 0.85, false, 30, esTresVTres ? 0 : -3);   // Pase 443: 2v2 sube 15% (340 -> 299) y cartas -15%
    // Pase siguiente: mismo ajuste que en 1v1 (ver el otro call site,
    // dentro del bloque no-equipos de _renderizarEstado) — la mano
    // propia comparte la misma barra de botonera en cualquier modo.
    // Nonagésimo primer pase: mismo +10px (505→515) que el otro call site.
    // Nonagésimo segundo pase: mismo +10px (515→525) que el otro call site.
    // Nonagésimo tercer pase: mismo -30px (525→495) que el otro call site.
    this._dibujarManoJugador(e.misCartas, this._L ? this._L.manoY : 485, e.turno === 'mio' && !hayCantoSinResolver, animarReparto);
    if (e.turno === 'mio') this._dibujarPlacaTurnoPropia();   // Pase 445
}

_calcularAsientos(companeros, rivales) {
    const N = companeros.length + rivales.length;
    const anguloPaso = 360 / (N + 1);

    const orden = [];
    let ri = 0, ci = 0;
    for (let i = 0; i < N; i++) {
      if (i % 2 === 0) {
        orden.push({ jugador: rivales[ri++], tipo: 'rival' });
      } else {
        orden.push({ jugador: companeros[ci++], tipo: 'companero' });
      }
    }

    return orden.map((asiento, idx) => ({
      ...asiento,
      angulo: 90 + (idx + 1) * anguloPaso
    }));
}

// Nonagésimo quinto pase: `_dibujarBadgeTurno` (el glow de 3 capas +
// placa oscura dibujados a mano con Graphics, detrás de "● Tu turno")
// se SACÓ de acá — reemplazada por la imagen `turnoPlaca`, el asset
// ilustrado de la placa/faja de madera que mandó el usuario.
// Nonagésimo séptimo pase: `turnoPlaca` también se sacó (pedido
// explícito: "el panel de madera detrás del tu turno lo sacamos") — no
// quedó ningún badge/fondo detrás del texto, en ninguna de las dos
// versiones. `this._anilloRect` (calculado en _renderizarEstado) sigue
// existiendo sin cambios — lo sigue usando el anillo de tiempo que se
// dibuja alrededor del texto, que es un indicador distinto del badge de
// fondo que se sacó acá.

// Pase 360: remache unificado de todo el juego (igual que el CSS/nativo): bola de bronce lisa (#C9973E),
// borde marrón fino (#5A3A14) y un brillo claro arriba a la izquierda. `r` = radio exterior.
_dibujarRemache(g, x, y, r) {
  g.fillStyle(0x5a3a14, 1);
  g.fillCircle(x, y, r);
  g.fillStyle(0xc9973e, 1);
  g.fillCircle(x, y, Math.max(1, r - 1.5));
  g.fillStyle(0xfff3d2, 0.92);
  g.fillCircle(x - r * 0.32, y - r * 0.36, Math.max(0.9, r * 0.28));
}

// Nonagésimo cuarto pase: marco de madera biselada con remaches de
// bronce para el panel grande de la pantalla de resultado
// (_mostrarPantallaFinal) — pedido explícito del usuario: "usar el
// mismo marco de madera biselada con remaches de bronce que usamos en
// el Lobby" en vez del anillo dorado macizo + tarjeta crema plana de
// antes. Mismo lenguaje de capas que `_dibujarPlacaMarcador` (gradiente
// madera aproximado con rects apilados + remaches de 5 capas), pero con
// la paleta OSCURA que usa el marco de Lobby.js (`accesoCardExterior`:
// maderaClara/Media/Oscura + negroPulido + remache/remacheClaro/
// remacheOscuro) en vez de la paleta terracota que usa la placa del
// marcador (esa se calibró a mano contra el asset de la botonera, no
// contra este marco). `x,y` es la esquina superior-izquierda (no el
// centro, a diferencia de `_dibujarPlacaMarcador`) para no tener que
// recalcular todo el layout de `_mostrarPantallaFinal`, que ya trabaja
// con `px,py` como esquina.
_dibujarMarcoMaderaConRemaches(g, x, y, w, h, rExterior = 20, rInterior = 14, padInterior = 9) {
  g.clear();

  // "Grosor" de la placa — sombra sólida asomando por debajo, mismo
  // truco que el `0 8px 0 negroPulido` del boxShadow de
  // `accesoCardExterior` (da sensación de objeto con canto real, no un
  // rectángulo plano pegado a la pantalla).
  g.fillStyle(0x1a1410, 1); // negroPulido
  g.fillRoundedRect(x, y + h - 2, w, 8, rExterior * 0.4);

  // Marco exterior: gradiente madera (maderaClara→maderaMedia→
  // maderaOscura, 160deg en el CSS) aproximado con 3 capas apiladas,
  // igual criterio que `_dibujarPlacaMarcador` porque Graphics no tiene
  // gradiente confiable entre Canvas/WebGL.
  g.fillStyle(0x2a1c14, 1); // maderaOscura (base)
  g.fillRoundedRect(x, y, w, h, rExterior);
  g.fillStyle(0x4a3226, 1); // maderaMedia
  g.fillRoundedRect(x, y, w, h * 0.85, rExterior);
  g.fillStyle(0x6b4a34, 0.55); // maderaClara (bisel superior)
  g.fillRoundedRect(x + 3, y + 3, w - 6, h * 0.3, rExterior * 0.7);

  // Nonagésimo sexto pase: 3→4px — pedido explícito del usuario para
  // esta pantalla ("contorno negro grueso exterior, stroke 3-4px, estilo
  // pegatina") — un poco más grueso que el 3px que usa `accesoCardExterior`
  // en Lobby.js, a propósito: ahí es un marco chico repetido 3 veces en
  // pantalla, acá es LA tarjeta protagonista de toda la pantalla de
  // resultado, así que un trazo apenas más pesado tiene sentido.
  g.lineStyle(4, 0x1a1410, 1);
  g.strokeRoundedRect(x, y, w, h, rExterior);

  // Filete claro fino en el semi-perímetro superior — mismo truco que
  // `_dibujarPlacaMarcador` para simular el canto recibiendo luz.
  g.lineStyle(1.5, 0xc9973e, 0.4);
  g.beginPath();
  g.moveTo(x + rExterior, y + 2);
  g.lineTo(x + w - rExterior, y + 2);
  g.strokePath();

  // Tarjeta interior de pergamino, inset `padInterior` px — mismo
  // degradé sutil cremaSutil→crema que usa `accesoCard` en Lobby.js, con
  // una sombra interna fina arriba (sugiere que el marco de madera "tapa"
  // un poco el borde del pergamino, como un hueco, no una hoja suelta
  // encima).
  const ix = x + padInterior, iy = y + padInterior;
  const iw = w - padInterior * 2, ih = h - padInterior * 2;
  g.fillStyle(0xFFF8ED, 1); // crema
  g.fillRoundedRect(ix, iy, iw, ih, rInterior);
  g.fillStyle(0xFFFCF6, 0.6); // cremaSutil
  g.fillRoundedRect(ix, iy, iw, ih * 0.45, rInterior);
  g.fillStyle(0x4A2C2A, 0.08); // chocolate, sombra interior arriba
  g.fillRoundedRect(ix, iy, iw, 12, rInterior);

  // 4 remaches de bronce en las esquinas del marco EXTERIOR — mismo
  // criterio de 5 capas que `_dibujarPlacaMarcador`, reescalado (casi el
  // doble de radio: este panel es mucho más grande que la placa del
  // marcador).
  const margenRemache = padInterior * 0.85;
  [
    { rx: x + margenRemache, ry: y + margenRemache },
    { rx: x + w - margenRemache, ry: y + margenRemache },
    { rx: x + margenRemache, ry: y + h - margenRemache },
    { rx: x + w - margenRemache, ry: y + h - margenRemache },
  ].forEach(({ rx, ry }) => {
    this._dibujarRemache(g, rx, ry, 6.5);
  });
}

// Pase 404: estilo del marcador. 'numeros' = placas de siempre; 'fosforos' = las
// placas se vuelven minitableros con los cuadritos de 5 fosforos (malas y, si la
// mesa es a 30, buenas). Se puede cambiar en cualquier momento desde Ajustes.
setMarcadorEstilo(estilo) {
  this._marcadorEstilo = estilo === 'fosforos' ? 'fosforos' : 'numeros';
  this._aplicarMarcadorEstilo(false);
}

// Ancho de las placas en modo fosforos (mas anchas que las de numeros para que se lean).
_anchoPlacaFosforos() {
  const g = this._geoPlacas;
  return this._L ? Math.round(g.vos.w * 1.3) : 116;
}

// Centro X de cada placa en modo fosforos (las dos crecen hacia afuera, sin pisarse).
_cxPlacaFosforos(k) {
  const g = this._geoPlacas;
  const wF = this._anchoPlacaFosforos();
  if (this._L) {
    const d = (wF - g.vos.w) / 2;
    return k === 'vos' ? g.vos.cx - d : g.rival.cx + d;
  }
  return k === 'vos' ? 12 + wF / 2 : 12 + wF + 14 + wF / 2;
}

_crearFosforosMarcador() {
  if (this._fosObjs) return this._fosObjs;
  const factor = this._factorEscalaTextura();
  const g = this._geoPlacas;
  const gap = 3 * g.kp;
  const B = Math.floor((this._anchoPlacaFosforos() - 2 * MARGEN_INTERNO_FOS - 2 * gap) / 3);   // Pase 457: 12 px de margen interno a cada lado
  const claves = [1, 2, 3, 4, 5].map((n) => {
    const k = `fos_${n}_s`;
    this._crearTexturaEscalada(`fos_${n}`, k, Math.round(B * factor), Math.round(B * factor));
    return k;
  });
  const lado = () => ({ fantasma: [], caja: [], n: [0, 0, 0, 0, 0, 0] });
  const objs = { B, gap, claves, vos: lado(), rival: lado(), todos: [] };
  ['vos', 'rival'].forEach((nombre) => {
    for (let i = 0; i < 6; i++) {
      const f = this.add.image(0, 0, claves[3]).setDisplaySize(B, B).setDepth(1002).setAlpha(0.14).setTint(0x8a6a55).setVisible(false);
      const c = this.add.image(0, 0, claves[0]).setDisplaySize(B, B).setDepth(1003).setVisible(false);
      objs[nombre].fantasma.push(f);
      objs[nombre].caja.push(c);
      objs.todos.push(f, c);
    }
  });
  this._fosObjs = objs;
  return objs;
}

// Idempotente: deja las placas en el estilo elegido y refresca los fosforos.
_aplicarMarcadorEstilo(animar = false) {
  const g = this._geoPlacas;
  if (!g || !this.scoreBg || !this.scoreBg.scene) return;
  const fosforos = this._marcadorEstilo === 'fosforos';
  const visiblePlacas = this.scoreBg.visible;
  const pts = this._puntosPrevios || { yo: 0, rival: 0 };
  const objetivo = this._puntosSala || 15;
  const buenas = objetivo >= 30 || pts.yo > 15 || pts.rival > 15;

  const lados = [
    { k: 'vos', geo: g.vos, bg: this.scoreBg, num: this.scoreText, label: this.labelPropio, puntos: pts.yo, zona: (this.zonasAnotador || [])[0] },
    { k: 'rival', geo: g.rival, bg: this.fondoInfoRival, num: this.scoreTextRival, label: this.labelRival, puntos: pts.rival, zona: (this.zonasAnotador || [])[1] },
  ];

  if (!fosforos) {
    // Placas originales
    lados.forEach(({ geo, bg, num, label, zona }) => {
      if (this._placaFosforosActiva) {
        this._dibujarPlacaMarcador(bg, geo.cx, geo.cy, geo.w, geo.h, bg === this.fondoInfoRival);
        if (label && label.scene) label.setPosition(geo.cx, geo.cy - 17 * g.kp);
        if (num && num.scene) num.setPosition(geo.cx, geo.cy + 10 * g.kp);
        if (zona && zona.scene) zona.setSize(geo.w, geo.h).setPosition(geo.cx, geo.cy);
      }
      if (num && num.scene) num.setVisible(visiblePlacas);
    });
    if (this.manoIconoRival && this.manoIconoRival.scene && this._placaFosforosActiva) {
      this.manoIconoRival.setPosition(g.rival.cx + g.rival.w / 2 + (this._L ? 14 : 11), g.rival.cy - 17 * g.kp);
      this._posicionarMedallaRival();
    }
    if (this._fosObjs) this._fosObjs.todos.forEach(o => o.setVisible(false));
    this._placaFosforosActiva = false;
    this._rectPlacaRival = null;
    if (this._anilloRect && this._anilloEsRival) this._anilloRect = this._rectAnilloRivalNumeros();
    return;
  }

  const F = this._crearFosforosMarcador();
  const hLabel = 18 * g.kp;
  // Pase 457: la placa de fósforos usa el MISMO marco rústico (madera + pergamino + remaches) que la numérica; los cuadritos
  // respetan 12 px de margen interno (laterales e inferior) para no chocar con los tornillos dorados de las esquinas.
  const PAD = MARGEN_INTERNO_FOS;
  const altoGrillaF = buenas ? 2 * F.B + F.gap : F.B;
  const alto = hLabel + 4 + altoGrillaF + PAD;
  const h2 = Math.max(g.vos.h, alto);
  this._placaFosforosActiva = true;

  const wF = this._anchoPlacaFosforos();
  lados.forEach(({ k, geo, bg, num, label, puntos, zona }) => {
    // Layout angosto: la placa crece hacia ARRIBA (su borde de abajo queda donde estaba);
    // en escritorio crece hacia abajo desde el borde de arriba.
    const top = this._L ? (geo.cy + geo.h / 2 - h2) : (geo.cy - geo.h / 2);
    const cy2 = top + h2 / 2;
    const cx2 = this._cxPlacaFosforos(k);
    this._dibujarPlacaMarcador(bg, cx2, cy2, wF, h2, k === 'rival');
    const py = top + hLabel + 4;
    if (label && label.scene) label.setPosition(cx2, top + hLabel / 2 + 2);
    if (num && num.scene) num.setVisible(false);
    if (zona && zona.scene) zona.setSize(wF, h2).setPosition(cx2, cy2);
    const L = F[k];
    const filas = buenas ? 2 : 1;
    // Grilla estricta de 3 columnas iguales, centrada en horizontal; arriba justo bajo la etiqueta y 12 px libres abajo.
    const gy0 = py + (h2 - hLabel - 4 - PAD - filas * F.B - (filas - 1) * F.gap) / 2;
    for (let i = 0; i < 6; i++) {
      const fila = Math.floor(i / 3), col = i % 3;
      const mostrarCaja = fila < filas;
      const x = cx2 + (col - 1) * (F.B + F.gap);
      const y = gy0 + F.B / 2 + fila * (F.B + F.gap);
      const n = Math.max(0, Math.min(5, (Number(puntos) || 0) - i * 5));
      const f = L.fantasma[i], c = L.caja[i];
      // Un solo dibujo por cuadro: el cuadrito fantasma solo se ve cuando el cuadro esta vacio
      // (si no, asoma por los bordes del fosforo de arriba).
      f.setPosition(x, y).setVisible(visiblePlacas && mostrarCaja && n === 0);
      // Pase 539: el PNG de 1 fósforo ya trae el palito arriba del cuadro (ocupa el primer lado vacío del fantasma): va en la celda, sin bajarlo al centro.
      c.setPosition(x, y);
      if (n > 0 && mostrarCaja) {
        c.setTexture(F.claves[n - 1]).setDisplaySize(F.B, F.B).setVisible(visiblePlacas);
        if (animar && n > L.n[i]) {
          this.tweens.killTweensOf(c);
          c.setAlpha(0.35).setScale(c.scaleX * 1.2, c.scaleY * 1.2);
          const sx = F.B / c.width, sy = F.B / c.height;
          this.tweens.add({ targets: c, alpha: 1, scaleX: sx, scaleY: sy, duration: 260, delay: Math.max(0, i % 3) * 120, ease: 'Quad.easeOut' });
        } else if (!this.tweens.isTweening(c)) {
          c.setAlpha(1);
        }
      } else {
        c.setVisible(false);
      }
      L.n[i] = mostrarCaja ? n : 0;
    }
  });
  // Rectangulo real de la placa del rival (el anillo del timer lo bordea en modo fosforos).
  {
    const topR2 = this._L ? (g.rival.cy + g.rival.h / 2 - h2) : (g.rival.cy - g.rival.h / 2);
    this._rectPlacaRival = { x: this._cxPlacaFosforos('rival') - wF / 2, y: topR2, w: wF, h: h2, r: 9 };
    if (this._anilloRect && this._anilloEsRival) this._anilloRect = { ...this._rectPlacaRival };
  }
  if (this.manoIconoRival && this.manoIconoRival.scene) {
    const topR = this._L ? (g.rival.cy + g.rival.h / 2 - h2) : (g.rival.cy - g.rival.h / 2);
    // Fuera del marco (y del anillo del timer, que sobresale ~3 px de la placa).
    this.manoIconoRival.setPosition(this._cxPlacaFosforos('rival') + wF / 2 + (this._L ? 22 : 20), topR + hLabel / 2 + 2);
    this._posicionarMedallaRival();
  }
}

// Rectangulo del anillo del timer del rival con la placa de numeros (la de siempre).
_rectAnilloRivalNumeros() {
  const w = this._L ? this._L.placaW : 96, h = this._L ? this._L.placaH : 60;
  return { x: this.PLACA_RIVAL_CX - w / 2, y: this.PLACA_RIVAL_CY - h / 2, w, h, r: 9 };
}

// Rectangulo actual (segun el estilo del marcador) sobre el que se dibuja el anillo del rival.
_rectAnilloRival() {
  return this._rectPlacaRival ? { ...this._rectPlacaRival } : this._rectAnilloRivalNumeros();
}

// Pase 403: avisa los puntos a React (Anotador Criollo) y hace sonar un clic de
// fosforo por cada punto que se suma (maximo 5 seguidos, separados 110 ms para no
// trabar nada). Con el primer estado, o si el puntaje baja (revancha), no suena.
_notificarPuntos(yo, rival) {
  const ant = this._puntosPrevios;
  this._puntosPrevios = { yo, rival };
  this._aplicarMarcadorEstilo(!!ant);
  const cambio = !ant || ant.yo !== yo || ant.rival !== rival;
  if (cambio && this.onPuntos) this.onPuntos({ yo, rival, objetivo: this._puntosSala || 15 });
  // Pase 411: sin ningun sonido al cambiar el puntaje (el clic de fosforo queda solo en el Anotador offline).
}

// Pase siguiente (placa doble): las placas de "Vos"/Rival son de ancho
// FIJO — un nombre de usuario largo se trunca acá en vez de estirarlas
// (que empujaría el resto del HUD o invadiría el centro de la pantalla).
_truncarNombre(nombre) {
  if (!nombre) return null;
  return nombre.length > 8 ? `${nombre.slice(0, 7)}…` : nombre;
}

// Marcha atrás pedida por el usuario sobre el pase anterior (asset de
// cuero+bronce para el fondo del marcador de puntaje): vuelve a ser una
// placa dibujada por código, mismo lenguaje "madera+bronce" que ya usan
// los paneles de Lobby/Torneos/Ranking en CSS (gradiente madera,
// borde negro pulido, 4 remaches de bronce en las esquinas) — acá
// reproducido con Graphics porque este panel vive en el canvas de Phaser,
// no en el DOM. `cx,cy` es el CENTRO de la placa (mismo criterio que
// `add.image`, al que reemplaza, para no tener que tocar el punto de
// llamada). Se llama una sola vez por placa, en `create()` — a diferencia
// del anillo de tiempo o el badge de turno, estas placas no cambian
// durante la partida, así que no hace falta volver a dibujarlas en cada
// estado.
//
// Pase siguiente (placa doble, pedido del usuario: "mostrar los nombres
// de los jugadores con sus puntos"): antes esta función solo dibujaba
// dentro de `this.scoreBg` (un único parámetro implícito) — ahora recibe
// el Graphics de destino (`g`) como primer parámetro, para poder
// reutilizarla tal cual en la placa del rival (`this.fondoInfoRival`) sin
// duplicar todo el dibujo.
_dibujarPlacaMarcador(g, cx, cy, w, h, oscura = false) {
  // Pase 456: marco de madera labrada (veta, bisel y ranura tallada) con inserto de pergamino. Madera clara = mi equipo,
  // madera oscura = rivales. Los remaches viven en el marco (7 px), nunca sobre el pergamino.
  g.clear();
  const x = cx - w / 2;
  const y = cy - h / 2;
  const r = 8;
  const M = 7;   // grosor del marco
  const T = oscura
    ? { cuerpo: 0x5a3824, veta: 0x2e1a10, luz: 0x8b6244, sombra: 0x20120a, remache: 0xc79a55, remacheSombra: 0x1d1109 }
    : { cuerpo: 0xb07a43, veta: 0x7a4a22, luz: 0xdcae72, sombra: 0x5c3718, remache: 0xe8c27a, remacheSombra: 0x3a2210 };

  g.fillStyle(0x000000, 0.32);   // sombra de caída
  g.fillRoundedRect(x, y + 3, w, h, r);

  g.fillStyle(T.cuerpo, 1);      // madera
  g.fillRoundedRect(x, y, w, h, r);

  // veta: líneas onduladas horizontales sobre todo el marco
  g.lineStyle(1, T.veta, 0.3);
  [0.12, 0.27, 0.43, 0.6, 0.76, 0.9].forEach((f, k) => {
    const yy = y + h * f;
    g.beginPath();
    g.moveTo(x + 5, yy);
    for (let t = 1; t <= 8; t++) {
      g.lineTo(x + 5 + ((w - 10) * t) / 8, yy + Math.sin(t * 1.3 + k * 1.7) * 1.2);
    }
    g.strokePath();
  });

  // bisel: luz arriba/izquierda, sombra abajo/derecha
  g.lineStyle(2, T.luz, 0.75);
  g.beginPath(); g.moveTo(x + r, y + 1); g.lineTo(x + w - r, y + 1); g.strokePath();
  g.beginPath(); g.moveTo(x + 1, y + r); g.lineTo(x + 1, y + h - r); g.strokePath();
  g.lineStyle(2, T.sombra, 0.7);
  g.beginPath(); g.moveTo(x + r, y + h - 1); g.lineTo(x + w - r, y + h - 1); g.strokePath();
  g.beginPath(); g.moveTo(x + w - 1, y + r); g.lineTo(x + w - 1, y + h - r); g.strokePath();
  g.lineStyle(2, T.sombra, 1);
  g.strokeRoundedRect(x, y, w, h, r);

  // ranura tallada alrededor del pergamino
  g.lineStyle(2, T.sombra, 0.85);
  g.strokeRoundedRect(x + M - 1, y + M - 1, w - 2 * M + 2, h - 2 * M + 2, 4);

  // pergamino
  const ix = x + M, iy = y + M, iw = w - 2 * M, ih = h - 2 * M;
  g.fillStyle(0xe8d6a2, 1);
  g.fillRoundedRect(ix, iy, iw, ih, 3);
  g.fillStyle(0xf3e6bf, 0.7);    // zona más clara al centro
  g.fillRoundedRect(ix + 3, iy + 3, iw - 6, ih - 6, 3);
  g.fillStyle(0xc9a46a, 0.14);   // manchas del papel
  [[0.2, 0.3, 7], [0.72, 0.62, 9], [0.5, 0.85, 5], [0.88, 0.2, 5]].forEach(([fx, fy, rr]) => g.fillCircle(ix + iw * fx, iy + ih * fy, rr));
  [[3, 0.18], [2, 0.14], [1, 0.12]].forEach(([k, a]) => {   // bordes quemados
    g.lineStyle(1.2, 0x7a5426, a * 1.6);
    g.strokeRoundedRect(ix + k - 1, iy + k - 1, iw - 2 * (k - 1), ih - 2 * (k - 1), 3);
  });
  // filete que separa la etiqueta del puntaje
  g.lineStyle(1, 0x7a5426, 0.4);
  g.beginPath(); g.moveTo(ix + 8, cy - 9); g.lineTo(ix + iw - 8, cy - 9); g.strokePath();

  // remaches en las esquinas del marco
  const margen = 3.6;
  [
    { rx: x + margen, ry: y + margen },
    { rx: x + w - margen, ry: y + margen },
    { rx: x + margen, ry: y + h - margen },
    { rx: x + w - margen, ry: y + h - margen },
  ].forEach(({ rx, ry }) => {
    g.fillStyle(T.remacheSombra, 1);
    g.fillCircle(rx + 0.3, ry + 0.4, 2);
    g.fillStyle(T.remache, 1);
    g.fillCircle(rx, ry, 1.5);
    g.fillStyle(0xffffff, 0.55);
    g.fillCircle(rx - 0.45, ry - 0.45, 0.55);
  });
}

_dibujarAnilloTiempo(rect, porcentaje) {
  const g = this.anilloTiempo;
  g.clear();
  const p = Math.max(0, Math.min(1, porcentaje));
  if (p <= 0) return;

  const { x, y, w, h, r } = rect;
  const color = p < 0.3 ? 0xE8483A : 0xFFB627;
  g.lineStyle(2.5, color, 1);

  const recto = 2 * (w - 2 * r) + 2 * (h - 2 * r);
  const curvo = 2 * Math.PI * r;
  const total = recto + curvo;
  let restante = p * total;

  const PASOS_ARCO = 8;
  const cx0 = x + w / 2;
  const puntos = [{ x: cx0, y }, { x: x + w - r, y }];
  const agregarArco = (ccx, ccy, desde, hasta) => {
    for (let i = 1; i <= PASOS_ARCO; i++) {
      const ang = Phaser.Math.DegToRad(desde + (hasta - desde) * (i / PASOS_ARCO));
      puntos.push({ x: ccx + Math.cos(ang) * r, y: ccy + Math.sin(ang) * r });
    }
  };
  agregarArco(x + w - r, y + r, -90, 0);
  puntos.push({ x: x + w, y: y + h - r });
  agregarArco(x + w - r, y + h - r, 0, 90);
  puntos.push({ x: x + r, y: y + h });
  agregarArco(x + r, y + h - r, 90, 180);
  puntos.push({ x: x, y: y + r });
  agregarArco(x + r, y + r, 180, 270);
  puntos.push({ x: cx0, y });

  g.beginPath();
  g.moveTo(puntos[0].x, puntos[0].y);
  for (let i = 1; i < puntos.length && restante > 0; i++) {
    const largo = Math.hypot(puntos[i].x - puntos[i - 1].x, puntos[i].y - puntos[i - 1].y);
    if (restante >= largo) {
      g.lineTo(puntos[i].x, puntos[i].y);
      restante -= largo;
    } else {
      const frac = largo > 0 ? restante / largo : 0;
      g.lineTo(
        puntos[i - 1].x + (puntos[i].x - puntos[i - 1].x) * frac,
        puntos[i - 1].y + (puntos[i].y - puntos[i - 1].y) * frac
      );
      restante = 0;
    }
  }
  g.strokePath();
}

_dibujarJugador(j, cx, cy, angulo = -90, tipo = 'rival') {
    const esSuTurno = j.id === this.estado.turnoDeId;
    const rotacion = (angulo + 90) * (Math.PI / 180);

    const centroMesaX = 400;
    // Pase 207: sincronizado con el centroY dinámico de _renderizarEquipos
    // (antes este valor estaba hardcodeado en 320 acá, DESALINEADO del
    // centroY real usado para calcular cx/cy cuando ese cambió a 250 para
    // 2v2 — ver el comentario ahí). El `?? 320` cubre el caso 1v1, que no
    // pasa por _renderizarEquipos y nunca setea this._centroMesaYActual.
    const centroMesaY = this._centroMesaYActual ?? 320;
    let outX = cx - centroMesaX;
    let outY = cy - centroMesaY;
    const outLen = Math.sqrt(outX * outX + outY * outY) || 1;
    outX /= outLen;
    outY /= outLen;
    const tanX = -outY;
    const tanY = outX;
    const rotBase = Math.atan2(outX, -outY);

    // Si es compañero Y activó compartir (backend manda j.cartas con las
    // cartas reales solo en ese caso), mostramos boca arriba en vez de dorso.
    // También mostramos boca arriba si este jugador tiene una revelación de
    // Flor o de Envido pendiente y todavía está dentro de la ventana de 3.5s
    // (mismo mecanismo para las dos, cada una llena su propio array en el
    // backend — florPendienteDeMostrar / envidoPendienteDeMostrar — pero acá
    // se consumen igual).
    const revelacionFlor = this._mostrandoRevelacionFlor
      ? (this.estado.florPendienteDeMostrar || []).find(f => f.jugadorId === j.id)
      : null;
    const revelacionEnvido = this._mostrandoRevelacionEnvido
      ? (this.estado.envidoPendienteDeMostrar || []).find(f => f.jugadorId === j.id)
      : null;
    const revelacion = revelacionFlor || revelacionEnvido;
    const manoCompartida = (tipo === 'companero' && Array.isArray(j.cartas)) || !!revelacion;
    const cartasParaDibujar = revelacion ? revelacion.cartas : (manoCompartida ? j.cartas : null);

    const cantidad = j.cartasEnMano;
    // Pase 394: layout angosto — cy sigue siendo la coordenada de diseño (mundo viejo); `cyN` es donde se dibuja.
    const kS = this._L ? this._L.kSeat : 1;
    const cyN = this._yEq(cy);
    // Pase 440: en 3v3 los mazos de compañeros y rivales van un 20% más chicos.
    const totalSentados = (this.estado.companeros || []).length + (this.estado.rivales || []).length;
    const esTres = totalSentados === 5;
    const esDos = totalSentados === 3;
    const fD = esTres ? 0.8 : 1;

    if (manoCompartida) {
      // Cartas reales boca arriba (compañero compartiendo su mano, o
      // revelación de Flor/Envido): antes usaban la MISMA fórmula de abanico
      // rotado y comprimido que los dorsos de abajo (radioAbanico=22 da
      // apenas un par de píxeles de separación real entre 3 cartas), así
      // que quedaban casi apiladas y giradas — imposibles de leer. Acá van
      // planas (sin rotación) y con más separación y tamaño, para poder
      // distinguir palo y número.
      // Pase 430: la mano COMPARTIDA del compañero pasa a mini-cartas (~38px en vez de 50) en
      // abanico suave; la revelación de Flor/Envido conserva el tamaño grande de siempre.
      const anchoCarta = (revelacion ? 50 : 38) * kS;
      const altoCarta = (revelacion ? 76 : 58) * kS;
      const factor = this._factorEscalaTextura();
      const anchoR = Math.round(anchoCarta * factor);
      const altoR = Math.round(altoCarta * factor);
      // La revelación de Flor/Envido separa más las cartas (hay tiempo de
      // sobra para mirarlas); compartir mano en vivo las solapa un poco más
      // para no tapar tanto el resto de la mesa.
      const espaciadoX = revelacion ? anchoCarta * 0.62 : anchoCarta * 0.58;
      const inicioX = cx - ((cantidad - 1) * espaciadoX) / 2;

      for (let k = 0; k < cantidad; k++) {
        const keyOriginal = `${cartasParaDibujar[k].valor}_${cartasParaDibujar[k].palo}`;
        const textureKey = `${keyOriginal}_${anchoR}x${altoR}`;
        this._crearTexturaEscalada(keyOriginal, textureKey, anchoR, altoR);

        const px = inicioX + k * espaciadoX;
        // Abanico suave (±6° por carta, el centro sube un poco) solo en la mano compartida.
        const posAbanico = k - (cantidad - 1) / 2;
        const carta = this.add.image(px, revelacion ? cyN : cyN + Math.abs(posAbanico) * 2.5 * kS, textureKey)
          .setOrigin(0.5, 0.5)
          .setDepth(10 + k);
        if (!revelacion) carta.setRotation(posAbanico * 6 * (Math.PI / 180));

        this._sprites.push(carta);
      }
    } else {
      // Dorsos ocultos: se mantiene el abanico compacto rotado — acá no
      // importa la legibilidad porque todas las cartas son iguales.
      const anguloPorCarta = 9;
      const anguloTotalAbanico = (cantidad - 1) * anguloPorCarta;
      const radioAbanico = 22 * kS * fD;
      const bulto = 3.5 * kS * fD;
      // Pase 441/443: en 2v2 y 3v3 el mazo se dibuja en perspectiva según el lado de la mesa y girado ±20°.
      const lado = (esTres || esDos) ? (cx < 340 ? 'izq' : (cx > 460 ? 'der' : 'arriba')) : null;   // Pase 443: también en 2v2
      const claveDorso = (lado && this._clavesDorsoPersp && this.textures.exists(this._clavesDorsoPersp[lado]))
        ? this._clavesDorsoPersp[lado] : (this._claveDorsoMiniActual || 'cardBackMini');
      const rotBase = (lado === 'izq' ? 20 : (lado === 'der' ? -20 : 0)) * (Math.PI / 180);

      // Pase 446: en 2v2 los rivales de los costados usan el abanico ilustrado (una sola imagen con 3, 2 o 1
      // cartas según lo que les queda); la imagen derecha trae el logo TC derecho (sin espejar).
      const nAbanico = Math.min(cantidad, 3);
      const claveAbanico = ((esDos || esTres) && cantidad > 0)
        ? (lado === 'arriba' ? this._claveAbanicoMazo(this._mazoIdDe(j.nombre), 'frente', nAbanico) : this._claveAbanicoMazo(this._mazoIdDe(j.nombre), (esDos || esTres) ? (lado === 'izq' ? 'der' : 'izq') : lado, nAbanico)) : null;   // Pase 579: cada jugador usa el abanico de SU mazo (mazo_id)   // Pase 456/457: en 2v2 y 3v3 los sprites laterales van intercambiados (izquierda usa el PNG "der", derecha el "izq"); los ángulos no cambian (3v3: +7°/-7°)
      if (claveAbanico && this.textures.exists(claveAbanico)) {
        const altoAbanico = (lado === 'arriba' ? 80 : 88) * kS * fD;   // Pase 448/449: también en 3v3 (con la escala -20% de los mazos); el de enfrente un poco más bajo para no pisar su placa
        const abanico = this.add.image(cx, cyN, claveAbanico).setOrigin(0.5, 0.5).setDepth(10);
        abanico.setDisplaySize(altoAbanico * (abanico.width / abanico.height), altoAbanico);
        abanico.setAngle(esTres ? (lado === 'izq' ? 7 : (lado === 'der' ? -7 : 0)) : (lado === 'izq' ? -9 : (lado === 'der' ? 13 : 0)));   // Pase 450: 3v3 = ±7°; Pase 460: 2v2 = -9° (izq) / +13° (der), igual que el nativo (antes +21°/-18°)   // Pase 447: inclinación exacta para acompañar la elipse de la mesa
        this._sprites.push(abanico);
      } else for (let k = 0; k < cantidad; k++) {
        const anguloCarta = -anguloTotalAbanico / 2 + k * anguloPorCarta;
        const radCarta = anguloCarta * (Math.PI / 180);
        const spread = Math.sin(radCarta) * radioAbanico;
        const bulge = (1 - Math.cos(radCarta)) * bulto;

        const ox = spread, oy = -bulge;
        const px = cx + ox * Math.cos(rotBase) - oy * Math.sin(rotBase);
        const py = cyN + ox * Math.sin(rotBase) + oy * Math.cos(rotBase);

        const carta = this.add.image(px, py, claveDorso)
          .setOrigin(0.5, 0.5)
          .setRotation(radCarta + rotBase)
          .setDepth(10 + k);
        if (this._L) carta.setDisplaySize(45 * kS * fD, 69 * kS * fD);
        else if (fD !== 1) carta.setScale(carta.scaleX * fD, carta.scaleY * fD);

        this._sprites.push(carta);
      }
    }

    // Pase 440: placa de pergamino con marco de madera en lugar del cuadro plano azul/rojo.
    // Compañeros: filete verde oliva; rivales: filete borgoña. En su turno la placa se dora.
    const esManoDeEste = this.estado.manoId === j.id;
    const esCompa = tipo === 'companero';
    const ladoPlaca = cx < 340 ? 'izq' : (cx > 460 ? 'der' : 'arriba');
    const conAbanico = (esDos || esTres) && ladoPlaca !== 'arriba' && !manoCompartida && cantidad > 0;   // Pase 446/448: el abanico lateral es más alto
    const yNombre = cyN - (conAbanico ? (esTres ? 50 : 58) : (esTres ? 34 : 40)) * kS;
    const { pw, ph, px0, py0 } = this._dibujarPlacaNombre(cx, yNombre, j.nombre, kS, {
      turno: esSuTurno, acento: esCompa ? 0x7F8F38 : 0x8E2B35, mano: esManoDeEste, rival: !esCompa,
    });
    // Centésimo décimo quinto pase: nombre clickeable en equipos (2v2/3v3), mismo criterio
    // que 1v1 (ver labelRival). Pase 440: la zona clickeable es toda la placa.
    const zonaNombre = this.add.rectangle(cx, yNombre, pw, ph, 0x000000, 0.001).setDepth(52);
    zonaNombre.setInteractive({ useHandCursor: true });
    zonaNombre.on('pointerdown', () => {
      if (j.nombre && this.onVerPerfil) this.onVerPerfil(j.nombre);
    });
    this._sprites.push(zonaNombre);

    // Pase siguiente: anillo de tiempo en equipos (paridad con el
    // nativo) — mismo criterio que el bloque 1v1 de _renderizarEstado:
    // se guarda el rectángulo (el propio cartel de nombre+fondo, ya
    // medido por Phaser en nombreTxt.width/height) para que el tick de
    // timerText lo dibuje con el porcentaje de tiempo restante.
    // Pase 182 — bug real encontrado (mismo bug que en nativo, ver
    // juego.tsx): esto decía "Solo aplica al asiento rival que tiene el
    // turno — nunca a compañeros", así que en 3v3/2v2, cuando le tocaba
    // el turno a un COMPAÑERO, ningún asiento dibujaba el anillo — se
    // perdía el indicador de tiempo en esos turnos. Ahora aplica a
    // cualquier asiento (rival o compañero) que tenga el turno.
    if (esSuTurno) {
      this._anilloRect = { x: px0 - 2, y: py0 - 2, w: pw + 4, h: ph + 4, r: 8 };
    }

      const jugadas = j.jugadas;
    if (jugadas && jugadas.length > 0) {
      // Pase 214 — pedido del usuario: "las cartas jugadas están
      // desordenadas, deberíamos acercarlas más a la posición de cada uno
      // en la mesa". El esquema anterior (clasificar el ángulo en 3-4
      // "baldes" con coordenadas fijas hardcodeadas — esArribaCentro/
      // esArribaCostadoJugada/esAbajoJugada/el "else" del pase 207)
      // agrupaba asientos DISTINTOS en el mismo puñado de puntos, sin
      // relación real con dónde está sentado cada jugador — por eso se
      // veían amontonadas en vez de "la carta de cada uno cerca de cada
      // uno". Se reemplaza por un punto a mitad de camino entre el centro
      // de la mesa y la posición REAL de este asiento (cx,cy, ya conocida
      // por el llamador) — así cada jugador tiene un punto único que se
      // mueve junto con su propio asiento, sin casos especiales por
      // ángulo, y funciona igual para 2v2, 3v3 o cualquier otra cantidad
      // de asientos. `outX/outY` (definidos arriba, normalizados) más
      // `outLen` (la distancia real centro→asiento, también de arriba)
      // reconstruyen el mismo vector que antes se recalculaba acá como
      // dirX/dirY/dirLen — no hace falta repetirlo.
      // Pase 215 — pedido explícito: las cartas jugadas quedaban "muy cerca
      // de la ubicación de la carta del jugador" (o sea, muy cerca del
      // centro de la mesa) en vez de cerca de la mano de cada uno. Se sube
      // la fracción de 0.42 a 0.68 para que la carta jugada se dibuje bastante
      // más lejos del centro y más cerca del asiento real (outX/outY/outLen
      // ya apuntan en la dirección correcta para cada jugador).
      const fraccionHaciaAsiento = 0.68;
      let baseX = centroMesaX + outX * outLen * fraccionHaciaAsiento;
      let baseY = centroMesaY + outY * outLen * fraccionHaciaAsiento;
      let dirX = outX, dirY = outY;
      let rotZona = 0;
      // Pase 441: en 3v3 las cartas jugadas caen en 6 zonas fijas DENTRO del paño (dos filas de tres:
      // arriba compa/rival/compa, abajo rival/yo/rival). Las más viejas se apilan hacia el costado.
      if (esDos) {
        // Pase 443: cruz de 4 zonas dentro del paño (norte = compañero, oeste/este = rivales, el sur es mi fila).
        const ZONAS_2V2 = {
          180: { x: 235, y: 215, sx: -1, sy: 0, rot: -6 },   // Rival1 (oeste)
          270: { x: 400, y: 162, sx: 1, sy: 0, rot: 2 },     // Compañero (norte)
          0: { x: 565, y: 215, sx: 1, sy: 0, rot: 6 },       // Rival2 (este)
        };
        const z2 = ZONAS_2V2[Math.round(((angulo % 360) + 360) % 360)];
        if (z2) { baseX = z2.x; baseY = z2.y; dirX = z2.sx; dirY = z2.sy; rotZona = z2.rot * (Math.PI / 180); }
      }
      if (esTres) {
        // Pase 442: trayectoria ovalada alrededor del centro del paño (ya con la mesa elevada), en vez de la
        // grilla 2x3: norte, noroeste/noreste, oeste/este y sur (mi fila). `rot` en grados.
        const ZONAS_3V3 = {
          150: { x: 250, y: 236, sx: -1, sy: 0, rot: -12 },   // Rival1 (oeste)
          210: { x: 268, y: 160, sx: -1, sy: 0, rot: -8 },    // Compa1 (noroeste)
          270: { x: 400, y: 140, sx: 1, sy: 0, rot: 0 },      // Rival2 (norte)
          330: { x: 532, y: 160, sx: 1, sy: 0, rot: 8 },      // Compa2 (noreste)
          30: { x: 550, y: 236, sx: 1, sy: 0, rot: 12 },      // Rival3 (este)
        };
        const z = ZONAS_3V3[Math.round(((angulo % 360) + 360) % 360)];
        if (z) { baseX = z.x; baseY = z.y; dirX = z.sx; dirY = z.sy; rotZona = z.rot * (Math.PI / 180); }
      }
      // Pase 215 — bug real encontrado: "únicamente se ven las primeras
      // cartas jugadas, las que le siguen no se ven" en 2v2. Los datos ya
      // estaban confirmados correctos (log DIAG del pase anterior), así que
      // no era un bug de datos: con pasoApilado=2 cada carta nueva se
      // dibujaba apenas 2px corrida de la anterior (~40x60px), invisible a
      // simple vista.
      // Pase 216 — con 16px ya se distinguían, pero el usuario pidió
      // juntarlas más ("separación bastante amplia"): se baja a 10px, lo
      // justo para que se note el abanico sin dejar hueco entre cartas.
      // Pase 217 — con 10px, en 2v2 costaba distinguir bien cuál carta se
      // había jugado; se sube a 14px, término medio entre el 16 (mucho
      // hueco) y el 10 (demasiado pegadas).
      const pasoApilado = 14;

      // Igual que _dibujarFilaCartas: pre-escalamos con el canvas de alta
      // calidad (mismo criterio que la mano y el dorso) al tamaño BASE, antes
      // del factor de perspectiva (0.78-1.0x) — así setDisplaySize solo hace
      // el ajuste fino, en vez de reducir de un salto el PNG original a
      // ~40px vía WebGL sin mipmaps reales (por ser NPOT), que es lo que se
      // veía "escalonado" en estas cartitas jugadas de los rivales.
      // Pase 216 — pedido explícito: agrandar el tamaño de las cartas
      // jugadas en 2v2. Se sube el tamaño base de 40x60 a 52x78 (misma
      // proporción, ~1.3x) — afecta también 3v3 y 1v1 al ser código
      // compartido, pero nadie reportó que ahí se vieran mal.
      // Pase 217 — "quedó casi perfecto, agrandemos solo un poco más": se
      // sube de 52x78 a 58x87 (misma proporción 2:3, ~1.12x), un ajuste
      // fino, no otro salto grande.
      const factorJugada = this._factorEscalaTextura();
      const anchoBaseJugadaR = Math.round(58 * kS * factorJugada);
      const altoBaseJugadaR = Math.round(87 * kS * factorJugada);

      jugadas.forEach((carta, idx) => {
        const esUltima = idx === jugadas.length - 1;
        const offset = (jugadas.length - 1 - idx) * pasoApilado;
        const px = baseX + dirX * offset;
        const py = baseY + dirY * offset;
        const keyOriginal = `${carta.valor}_${carta.palo}`;
        const keyEscalada = `${keyOriginal}_${anchoBaseJugadaR}x${altoBaseJugadaR}`;
        this._crearTexturaEscalada(keyOriginal, keyEscalada, anchoBaseJugadaR, altoBaseJugadaR);

        // Pase 212 — BUG REAL ENCONTRADO (la causa de fondo de "las cartas
        // jugadas no aparecen" en 2v2/3v3, el diagnóstico con el log
        // temporal confirmó que `jugadas` llega perfecto desde el backend,
        // así que el problema SIEMPRE estuvo acá abajo): `_calcularPerspectiva`
        // devuelve `{ scale, offsetY, sombraOffsetY, sombraAlpha }` — nunca
        // tuvo una propiedad `scaleY` con ESE nombre exacto desde que se
        // refactorizó a escalado uniforme (ver el comentario del pase
        // "decimoséptimo" en _dibujarFilaCartas, unas líneas más abajo en
        // este archivo, que explica ese cambio). Este único call site nunca
        // se actualizó — `persp.scaleY` daba `undefined`, `60 * undefined`
        // daba `NaN`, y `setDisplaySize(40, NaN)` deja la imagen con alto
        // inválido: se crea el sprite (por eso el dato llegaba bien y el
        // objeto existía en la escena) pero no se ve nada, sin ningún error
        // en consola. De paso, el ancho también pasa a escalar con
        // `persp.scale` (antes quedaba fijo en 40) — mismo criterio de
        // "más lejos = más chica en las dos dimensiones" que ya usan
        // _dibujarFilaCartas/_dibujarDueloCartas más abajo.
        const pyN = this._yEq(py);
        const persp = this._calcularPerspectiva(pyN);
        const fJug = (esTres || esDos) ? 0.85 : 1;   // Pase 442/443: cartas tiradas -15% en 2v2 y 3v3
        // Pase 446: todas las cartas jugadas se dibujan igual, planas (sin aura, brillo ni escala extra en la ganadora).
        const anchoCarta = 58 * kS * persp.scale * fJug;
        const altoCarta  = 87 * kS * persp.scale * fJug;

        const img = this.add.image(px, pyN, keyEscalada)
          .setDisplaySize(anchoCarta, altoCarta)
          .setRotation(rotZona)
          .setDepth(60 + idx)
          .setAlpha(esUltima ? 1 : 0.85);
        this._sprites.push(img);
      });
    }
}

// Pedido del usuario: "falta el fino borde blanco exterior tipo sticker
// UI" que ya usan las cartas en el resto de la app — acá son PNG sin ese
// borde horneado en el arte, así que se agrega por código: una capa de
// Graphics blanca (con un filete negro suave) apenas más grande que la
// carta, siempre detrás de ella. Se dibuja en espacio LOCAL del propio
// Graphics (el rect es relativo al (0,0) de ESE objeto, no a la escena) y
// recién después se posiciona/rota el objeto entero en (x,y) — por eso
// funciona igual de bien con cartas rotadas (dorso en abanico, mano) sin
// tener que rotar puntos a mano. `ox,oy` (0 a 1) replican el mismo
// `setOrigin` con el que se dibuja la carta a la que acompaña (la
// mayoría usa 0.5,0.5; la mano del jugador usa 0.5,0.85), para que el
// borde quede centrado exactamente igual. 100% Graphics — no toca ningún
// PNG de carta.
_dibujarBordeSticker(x, y, w, h, rotacion, ox, oy, depth) {
  // Pase 401: sin recuadro blanco detras de las cartas. Se devuelve un
  // Graphics VACIO (para que los tweens y setDepth que lo usan sigan andando):
  // la carta es solo su PNG, con su propio contorno.
  const g = this.add.graphics().setPosition(x, y).setRotation(rotacion).setDepth(depth);
  return g;
  // eslint-disable-next-line no-unreachable
  const margen = 3;
  const left = -w * ox - margen;
  const top = -h * oy - margen;
  const ancho = w + margen * 2;
  const alto = h + margen * 2;
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(left, top, ancho, alto, 6);
  g.lineStyle(1.2, 0x000000, 0.3);
  g.strokeRoundedRect(left, top, ancho, alto, 6);
  return g;
}

_dibujarManoJugador(cartas, yBase, jugable, animar = false) {
    if (!cartas || cartas.length === 0) return;

    // Achicadas ~10% (110x151 → 99x136, misma proporción) y con yBase subido
    // (ver los dos llamados a esta función) para dejarle más aire a la barra
    // de acciones de abajo — el origin(0.5, 0.85) hace que el borde inferior
    // real de la carta quede en yBase + altoCarta*0.15, que es lo que importa
    // para no solaparse con la línea divisoria (ver _crearElementosDeTexto).
    // Decimocuarto pase: el canvas creció de 900x675 a 1100x825 (~1.222x) y
    // estas medidas son en UNIDADES DEL MUNDO — su tamaño real en pantalla
    // crece proporcionalmente con el canvas (ver _factorEscalaTextura), así
    // que sin tocar nada acá la mano del jugador se veía "muy grande" tras
    // ese cambio. Se achicó 99x136 → 81x111 (÷1.222, misma proporción) para
    // que el tamaño ABSOLUTO en pantalla vuelva a ser el de antes del
    // agrandado del canvas — la mesa ahora tiene más lugar alrededor, pero
    // la mano del jugador ocupa el mismo espacio físico que ya se había
    // ajustado a gusto.
    // Vigésimo tercer pase: una captura real mostró la mano "flotando" muy
    // arriba, tapando gran parte del paño — se achicó otro 10% (81x111 →
    // 73x100) y se bajó bastante el `yBase` en el llamador (465→490) para
    // que la base del abanico quede tucked adentro de la barra de botones
    // (ver el comentario de origin(0.5,0.85) más abajo: con altoCarta=100 el
    // borde inferior real queda en yBase+15=505, unos 5px dentro del panel
    // de madera que arranca en Y=500 — como el panel se dibuja con depth
    // mayor que las cartas, ese solape queda tapado por la textura, dando
    // la sensación de que la mano "nace" desde adentro de la barra).
    // Nonagésimo tercer pase: +18% de tamaño (73x100 → 86x118, misma
    // proporción), pedido explícito del usuario para que se lean mejor
    // los números/índices de cada naipe.
    // Pase 402: tamaño de la mano en UNIDADES DEL MUNDO, ligado al tamaño de la
    // mesa (no a la ventana ni al dpr). Antes la imagen se mostraba al tamaño en
    // pixeles de su textura (anchoCarta * factor de dpr), asi que en pantallas de
    // alta densidad las cartas crecian x2 y tapaban la mesa. Ahora se fuerza el
    // tamaño con setDisplaySize: mesa 690 de ancho -> carta de 1.2*86 = 103 (~15%
    // del ancho de la mesa); en el layout angosto la ancla es kMano (<= alto de la botonera).
    const kM = this._L ? this._L.kMano : 1.2;
    const anchoCarta = 86 * kM;
    const altoCarta  = 118 * kM;
    const cantidad   = cartas.length;

    const anguloTotalMax = 26;
    const anguloPorCarta = cantidad > 1 ? anguloTotalMax / (cantidad - 1) : 0;
    const espaciadoX = 70 * kM;
    // 19 (antes 25) — la carta del medio invadía bastante el centro del
    // tapete al levantarse; se acortó el "bulto" del abanico para que la
    // mano se sienta anclada más cerca de la botonera y no tan metida en la
    // mesa (punto 4 de la lista de diseño, "espaciado y respiración").
    const bulto = 19 * kM;

    const inicioX = 400 - ((cantidad - 1) * espaciadoX) / 2;
    const factor = this._factorEscalaTextura();
    cartas.forEach((carta, i) => {
      const keyOriginal = `${carta.valor}_${carta.palo}`;
      const keyMano = `${keyOriginal}_mano`;
      this._crearTexturaEscalada(keyOriginal, keyMano, Math.round(anchoCarta * factor), Math.round(altoCarta * factor));


      const anguloCarta = -((cantidad - 1) * anguloPorCarta) / 2 + i * anguloPorCarta;
      const radCarta = anguloCarta * (Math.PI / 180);

      const destinoX = inicioX + i * espaciadoX;
      const factorCentro = cantidad > 1
        ? 1 - Math.abs((i - (cantidad - 1) / 2) / ((cantidad - 1) / 2))
        : 0;
      const destinoY = yBase - factorCentro * bulto;

      // Sombra suave debajo de cada carta de la mano — mismo criterio que
      // las cartas jugadas del centro (ver _calcularPerspectiva/decimoséptimo
      // pase): sin esto, la mano quedaba "flotando" sin ningún punto de
      // apoyo visual sobre el paño (feedback del usuario). No se animan por
      // separado durante el reparto — nacen ya con el resto de la carta.
      if (!animar) {
        // Origin de la carta es (0.5, 0.85) — el borde inferior real ya
        // está muy cerca del punto de anclaje (yBase), a solo altoCarta*0.15
        // por debajo. La sombra se centra justo ahí (no más abajo, como en
        // las cartas jugadas del centro, que usan origin 0.5 estándar).
        //
        // Punto 5 de la crítica de mesa (sexagésimo primer pase): la mano se
        // sentía "pegada" al borde inferior de la mesa, sin aire. Un solo
        // óvalo de borde duro (como el de antes) no alcanza a dar esa
        // sensación de flotar — se le agrega una segunda sombra, más grande
        // y mucho más transparente, DEBAJO de la original, simulando el
        // degradé suave de un blur real (Phaser Graphics/Ellipse no soporta
        // blur nativo) sin tocar `yBase`/posición de la carta en sí, que ya
        // está afinada para calzar justo con el borde de la barra de
        // acciones (ver nota más arriba, riesgo de regresión si se mueve).
        const sombraManoSuave = this.add.ellipse(
          destinoX, destinoY + altoCarta * 0.20,
          anchoCarta * 1.05, altoCarta * 0.26,
          0x000000, 0.12
        ).setRotation(radCarta).setDepth(8 + i);
        this._sprites.push(sombraManoSuave);

        const sombraMano = this.add.ellipse(
          destinoX, destinoY + altoCarta * 0.17,
          anchoCarta * 0.78, altoCarta * 0.16,
          0x000000, 0.28
        ).setRotation(radCarta).setDepth(9 + i);
        this._sprites.push(sombraMano);
      }

      // El borde sticker se crea ANTES de la carta (para quedar detrás, a
      // 10+i-0.5) y se mete en los mismos `targets` de cada tween/posición
      // que ya mueve a `img` (animación de reparto, hover al jugar) — así
      // los dos quedan siempre pegados, sin código de sincronización aparte.
      // Pase 414: cartas bloqueadas (fuera de turno / canto sin resolver) a 0.75 de opacidad y sin interaccion.
      const alfaCarta = jugable ? 1 : 0.75;
      const borde = this._dibujarBordeSticker(
        animar ? 400 : destinoX, animar ? 300 : destinoY,
        anchoCarta, altoCarta, animar ? 0 : radCarta, 0.5, 0.85, 10 + i - 0.5
      ).setAlpha(animar ? 0 : alfaCarta);

      const img = this.add.image(animar ? 400 : destinoX, animar ? 300 : destinoY, keyMano)
        .setDisplaySize(anchoCarta, altoCarta)
        .setOrigin(0.5, 0.85)
        .setDepth(10 + i)
        .setAlpha(animar ? 0 : alfaCarta)
        .setRotation(animar ? 0 : radCarta);

      if (!jugable) {
        img.setTint(0xBBBBBB);
        img.disableInteractive();
      }

      if (animar) {
        this.time.delayedCall(i * 130, () => {
          if (!img.scene) return;
          img.setAlpha(alfaCarta);
          borde.setAlpha(alfaCarta);
          this.tweens.add({
            targets: [img, borde], x: destinoX, y: destinoY, rotation: radCarta,
            duration: 300, ease: 'Power2.easeOut'
          });
        });
      }

      if (jugable) {
        img.setInteractive({ useHandCursor: true });
        img.on('pointerover', () => {
          this.tweens.add({ targets: [img, borde], y: destinoY - 25, duration: 120, ease: 'Power2' });
          img.setDepth(100 + i);
          borde.setDepth(100 + i - 0.5);
        });
        img.on('pointerout', () => {
          this.tweens.add({ targets: [img, borde], y: destinoY, duration: 120, ease: 'Power2' });
          img.setDepth(10 + i);
          borde.setDepth(10 + i - 0.5);
        });
        img.on('pointerdown', () => {
          if (this._jugadaEnviada) return;   // Pase 414: un solo toque por turno (evita el aviso "no es tu turno")
          this._jugadaEnviada = true;
          // Pase 610: se recuerda dónde está la carta (centro, tamaño, ángulo) para que, al llegar el estado, vuele desde ahí a su lugar en la mesa (como en la app).
          try {
            const cy0 = img.y - altoCarta * 0.35 * Math.cos(img.rotation);
            const cx0 = img.x + altoCarta * 0.35 * Math.sin(img.rotation);
            this._vueloPendiente = { cartaId: carta.id, x: cx0, y: cy0, ancho: img.displayWidth, alto: img.displayHeight, rot: img.rotation, t: Date.now() };
          } catch (err) {}
          try { this.sound.play('jugar-carta', { volume: 0.6 * (this.efectosVolumen ?? 1) }); } catch (err) {}
          this.socket.emit('jugar-carta', { codigoSala: this.codigoSala, cartaId: carta.id });
        });
      }

      this._sprites.push(img);
      this._sprites.push(borde);
    });
}

_actualizarCantoBanner(e) {
    // OJO: antes había acá un guard que cortaba TODA la función si ya se
    // estaba mostrando el cartel de resultado de Flor o de Envido
    // (this._mostrandoResultadoFlor / this._mostrandoResultadoEnvido). El
    // problema: cuando Flor y Envido se resuelven cerca uno del otro en la
    // misma mano (algo común cuando la Flor está activa — Flor se resuelve
    // primero y el Envido suele venir justo después), el bloque de Envido de
    // más abajo quedaba sin ejecutarse nunca mientras el cartel de Flor
    // seguía en pantalla (3.2s) — ni el cartel de "ganó el envido" ni la
    // revelación de sus cartas llegaban a dispararse. No hace falta este
    // guard: cada bloque de abajo ya compara timestamps contra el estado
    // anterior, así que no se re-dispara solo, aunque la función corra en
    // cada actualización de estado.
    const anterior = this.estadoAnterior;

if (e.ultimoResultadoFlor && (!anterior?.ultimoResultadoFlor || e.ultimoResultadoFlor.timestamp !== anterior.ultimoResultadoFlor.timestamp)) {
const quien = e.ultimoResultadoFlor.ganadorEsMio
  ? (Array.isArray(e.companeros) ? 'Tu equipo' : 'Vos')
  : (Array.isArray(e.companeros) ? 'El equipo rival' : 'El rival');

const textoTantos = e.ultimoResultadoFlor.tantosGanador != null
  ? ` con ${e.ultimoResultadoFlor.tantosGanador} tantos`
  : '';

if (this._cantoOcultarTimer) { this._cantoOcultarTimer.remove(); this._cantoOcultarTimer = null; }
this._mostrarCanto(`${quien} ganó la Flor${textoTantos} — suma ${e.ultimoResultadoFlor.puntos} punto(s)`);
  this._mostrandoResultadoFlor = true;

  this._cantoOcultarTimer = this.time.delayedCall(3200, () => {
    this._ocultarCanto();
    this._cantoOcultarTimer = null;
    this._mostrandoResultadoFlor = false;
  });

  // Revelación de cartas en mesa — solo si vino con cartas para mostrar
  // (nunca en flor sola ni no-quiero, el backend ya se encarga de eso).
  if (e.florPendienteDeMostrar && e.florPendienteDeMostrar.length > 0) {
    this._mostrandoRevelacionFlor = true;
    if (this._revelacionFlorTimer) this._revelacionFlorTimer.remove();
    this._revelacionFlorTimer = this.time.delayedCall(3500, () => {
      this._mostrandoRevelacionFlor = false;
      this._revelacionFlorTimer = null;
      if (this.estado) this._renderizarEstado(false);   // 👈 el fix va acá adentro, nada más
    });
  }
  return;
}

    if (e.ultimoResultadoEnvido && e.ultimoResultadoEnvido.timestamp !== anterior?.ultimoResultadoEnvido?.timestamp) {
      const quien = e.ultimoResultadoEnvido.ganadorEsMio
        ? (Array.isArray(e.companeros) ? 'Tu equipo' : 'Vos')
        : (Array.isArray(e.companeros) ? 'El equipo rival' : 'El rival');
      const texto = `${quien} ganó el envido con ${e.ultimoResultadoEnvido.puntosGanador} — +${e.ultimoResultadoEnvido.puntos} punto(s)`;

      if (this._cantoOcultarTimer) { this._cantoOcultarTimer.remove(); this._cantoOcultarTimer = null; }
      this._mostrarCanto(texto);
      this._mostrandoResultadoEnvido = true;

      this._cantoOcultarTimer = this.time.delayedCall(3200, () => {
        this._ocultarCanto();
        this._cantoOcultarTimer = null;
        this._mostrandoResultadoEnvido = false;
      });

      // OJO: acá antes se disparaba también la revelación de cartas del
      // ganador del Envido (mismo mecanismo que la Flor, 3.5s). El usuario
      // pidió sacarla: la revelación de cartas del Envido ahora ocurre SOLO
      // al terminar la ronda (ver _chequearFinDeRondaEnvido más abajo),
      // nunca acá al resolverse — el cartel de texto de arriba sí se
      // mantiene sin cambios.
      return;
    }

    // Si ya hay un prompt contextual propio en pantalla (la pregunta chica arriba
    // de la botonera: Flor/Truco/Envido pendiente de respuesta, o la declaración
    // de envido), el cartel grande de "cantó: NIVEL" es redundante — y si además
    // quedó desactualizado (p. ej. un Truco pendiente interrumpido por una Flor
    // que ya se cantó), muestra información vieja. Lo ocultamos en ese caso.
    const hayPromptContextualPropio = e.flor.pendienteDeRespuesta
      || e.truco.pendienteDeRespuesta
      || e.envido.pendienteDeRespuesta
      || !!e.declaracionEnvido;

    if (hayPromptContextualPropio) {
      this._ocultarCanto();
      this._cantoClaveActual = null;
      if (this._cantoOcultarTimer) { this._cantoOcultarTimer.remove(); this._cantoOcultarTimer = null; }
      return;
    }

    let texto = '';
    let clave = '';
    let esMiPropioCanto = false;

    if (e.envido.tipo && !e.envido.resuelto) {
      const quien = e.envido.cantadoPorMi
        ? 'Vos cantaste'
        : (e.envido.cantadoPorMiEquipo ? 'Tu compañero cantó' : 'El rival cantó');
      texto = `${quien}: ${e.envido.tipo.replace('-', ' ').toUpperCase()}`;
      clave = `envido-${e.envido.tipo}-${e.envido.cantadoPorMi}-${e.envido.cantadoPorMiEquipo}`;
      esMiPropioCanto = e.envido.cantadoPorMi;
    } else if (e.truco.nivel) {
      const quien = e.truco.cantadoPorMi
        ? 'Vos cantaste'
        : (e.truco.cantadoPorMiEquipo ? 'Tu compañero cantó' : 'El rival cantó');
      texto = `${quien}: ${e.truco.nivel.toUpperCase()}`;
      clave = `truco-${e.truco.nivel}-${e.truco.cantadoPorMi}-${e.truco.cantadoPorMiEquipo}`;
      esMiPropioCanto = e.truco.cantadoPorMi;
    } else if (e.envido.tipo) {
      const quien = e.envido.cantadoPorMi
        ? 'Vos cantaste'
        : (e.envido.cantadoPorMiEquipo ? 'Tu compañero cantó' : 'El rival cantó');
      texto = `${quien}: ${e.envido.tipo.replace('-', ' ').toUpperCase()}`;
      clave = `envido-${e.envido.tipo}-${e.envido.cantadoPorMi}-${e.envido.cantadoPorMiEquipo}`;
      esMiPropioCanto = e.envido.cantadoPorMi;
    }

    // Si el canto lo hiciste vos mismo, ya lo sabés (lo acabás de tocar) — el
    // cartel grande es redundante en ese caso. Se deja solo para avisarte de
    // lo que canta tu compañero o el rival.
    if (esMiPropioCanto) {
      texto = '';
      clave = '';
    }

    const pendiente = e.truco.pendienteDeRespuesta || e.envido.pendienteDeRespuesta;

    if (!texto) {
      this._ocultarCanto();
      this._cantoClaveActual = null;
      if (this._cantoOcultarTimer) { this._cantoOcultarTimer.remove(); this._cantoOcultarTimer = null; }
      return;
    }

    const esCantoNuevo = clave !== this._cantoClaveActual;
    this._cantoClaveActual = clave;

    if (esCantoNuevo || pendiente) {
      if (this._cantoOcultarTimer) { this._cantoOcultarTimer.remove(); this._cantoOcultarTimer = null; }
      this._mostrarCanto(texto);
    }

    if (!pendiente && !this._cantoOcultarTimer) {
      this._cantoOcultarTimer = this.time.delayedCall(2500, () => {
        this._ocultarCanto();
        this._cantoOcultarTimer = null;
      });
    }
}

// Revelación de las cartas del Envido AL TERMINAR LA RONDA (todas las bazas
// jugadas) — se agrega además del cartel/revelación que ya se muestra al
// resolverse el Envido (que no se toca, sigue como estaba). El backend no
// necesitó cambios: envidoPendienteDeMostrar ya se resetea recién en
// iniciarRonda() (arranque de la MANO SIGUIENTE), así que en la única
// actualización de estado donde rondaActiva pasa de true a false (justo al
// terminar la ronda, antes del setTimeout de 2.5s que arranca la próxima)
// todavía tiene las cartas del ganador de ESTA ronda, si hubo Envido.
_chequearFinDeRondaEnvido(e) {
  const anterior = this.estadoAnterior;
  if (!anterior) return;

  // Pase 419: si un Envido cerró la PARTIDA, la ronda nunca "termina" (rondaActiva sigue en true), así que la
  // revelación de las cartas del ganador nunca se disparaba. Ahora también se dispara cuando el juego pasa a
  // terminado; en ese caso NO se pisa el cartel "X ganó el envido con N" (ya está en pantalla).
  const juegoRecienTerminadoEnMedioDeRonda = !anterior.juegoTerminado && !!e.juegoTerminado && !!e.rondaActiva;
  const rondaRecienTerminada = (anterior.rondaActiva && !e.rondaActiva) || juegoRecienTerminadoEnMedioDeRonda;
  if (!rondaRecienTerminada) return;
  if (!e.envidoPendienteDeMostrar || e.envidoPendienteDeMostrar.length === 0) return;

  if (!juegoRecienTerminadoEnMedioDeRonda) {
    const puntos = e.ultimoResultadoEnvido?.puntosGanador;
    const texto = puntos != null ? `${puntos} tantos en mesa` : 'Tantos en mesa';

    if (this._tantosEnMesaTimer) { this._tantosEnMesaTimer.remove(); this._tantosEnMesaTimer = null; }
    this._mostrarCanto(texto);
    this._tantosEnMesaTimer = this.time.delayedCall(3200, () => {
      this._ocultarCanto();
      this._tantosEnMesaTimer = null;
    });
  }

  // Reutiliza el mismo mecanismo de revelación que ya usa el Envido al
  // resolverse (mismo flag, mismo renderizado en _dibujarJugador /
  // _dibujarFilaCartasReveladas) — no hace falta código de dibujo nuevo.
  this._mostrandoRevelacionEnvido = true;
  if (this._revelacionEnvidoTimer) this._revelacionEnvidoTimer.remove();
  this._revelacionEnvidoTimer = this.time.delayedCall(3500, () => {
    this._mostrandoRevelacionEnvido = false;
    this._revelacionEnvidoTimer = null;
    if (this.estado) this._renderizarEstado(false);
  });
}

_reproducirCantosSiCorresponde(estado, anterior) {
  if (!anterior) return;

  if (estado.truco.nivel && estado.truco.nivel !== anterior.truco.nivel) {
    this._reproducirCanto(estado.truco.personajeQueCanto, estado.truco.nivel);
  }
  if (estado.envido.tipo && estado.envido.tipo !== anterior.envido.tipo) {
    this._reproducirCanto(estado.envido.personajeQueCanto, estado.envido.tipo);
  }
  if (estado.ultimaRespuesta && estado.ultimaRespuesta.timestamp !== anterior.ultimaRespuesta?.timestamp) {
    this._reproducirCanto(estado.ultimaRespuesta.personaje, estado.ultimaRespuesta.respuesta);
  }
  if (estado.flor.nivel && estado.flor.nivel !== anterior.flor?.nivel) {
    this._reproducirCanto(estado.flor.personajeQueCanto, estado.flor.nivel);
  }
}

_reproducirCanto(personaje, clave) {
  if (!personaje || !clave) return;
  const key = `canto_${personaje}_${clave}`;
  if (!this.cache.audio.exists(key)) return;
  try { this.sound.play(key, { volume: this.vocesVolumen ?? 0.85 }); } catch (e) {}
}

// Pase 579 (paridad con la app, Pase 526): cada jugador muestra el abanico de SU mazo (mazo_id que llega en 'jugador-unido').
// 'base' usa los abanicos de siempre (mazos-abanico/, cargados en preload); 'cafecito' y 'tester' se cargan recién cuando
// aparece un jugador que los usa (9 PNG por mazo, public/assets/personalizacion-opt/cartas/<id>/abanico-<frente|izq|der>-<n>.png)
// y, al terminar de cargar, se vuelve a dibujar la mesa. Mientras tanto (o si el archivo falla) se dibuja el abanico base.
// Pase 580: deja la medalla de mano del rival pegada a su ícono de turno (se llama cada vez que el ícono se reubica).
_posicionarMedallaRival() {
  const ic = this.manoIconoRival;
  const m = this.medallaManoRival;
  if (!ic || !ic.scene || !m || !m.scene) return;
  const kpH = ic.displayWidth / 17 || 1;
  m.setDisplaySize(18 * kpH, 18 * kpH).setPosition(ic.x + 2 * kpH, ic.y);   // Pase 599: el ícono de turno ya no se ve, la medalla ocupa su lugar
}

_mazoIdDe(nombre) {
  const info = (this._jugadoresSala || []).find((s) => s.username === nombre);
  const id = info && info.mazo_id;
  return (id && id !== 'base' && MAZOS.some((m) => m.id === id)) ? id : 'base';
}

_claveAbanicoMazo(mazoId, tipo, n) {
  const claveBase = tipo === 'frente' ? `mazoAbanicoFrente_${n}` : `mazoAbanico_${tipo}_${n}`;
  if (!mazoId || mazoId === 'base') return claveBase;
  const clave = `mazoAbanico_${mazoId}_${tipo}_${n}`;
  if (this.textures.exists(clave)) return clave;
  this._cargarAbanicosMazo(mazoId);
  return claveBase;
}

_cargarAbanicosMazo(mazoId) {
  if (!this._mazosAbanicoPedidos) this._mazosAbanicoPedidos = {};
  if (this._mazosAbanicoPedidos[mazoId]) return;   // una sola vez por mazo (si falla, queda el base)
  this._mazosAbanicoPedidos[mazoId] = true;
  let hayAlgo = false;
  ['frente', 'izq', 'der'].forEach((tipo) => [1, 2, 3].forEach((n) => {
    const clave = `mazoAbanico_${mazoId}_${tipo}_${n}`;
    if (this.textures.exists(clave)) return;
    this.load.image(clave, conVersion(`assets/personalizacion-opt/cartas/${mazoId}/abanico-${tipo}-${n}.png`));
    hayAlgo = true;
  }));
  if (!hayAlgo) return;
  this.load.once('complete', () => {
    try {
      if (this.estado && this.sys && this.sys.isActive()) this._renderizarEstado(false);
    } catch (e) { /* si la escena ya se cerró, no hay nada que redibujar */ }
  });
  if (!this.load.isLoading()) this.load.start();
}

_dibujarFilaDorso(cantidad, y) {
    // Decimoctavo pase: las cartas del rival se sentían "muy juntas y muy
    // centradas, rígidas" (feedback del usuario) — se aumentó el ángulo de
    // abanico (8→11) y la separación horizontal (43→52) para que se vean
    // más sueltas, y se acentuó la curva vertical (bulto 6→9) para que el
    // abanico se note más. El Y también se bajó un poco en el llamador
    // (80→95) para separarlas del texto de estado que quedó arriba.
    // Vigésimo tercer pase: nueva captura del usuario mostró las cartas
    // "flotando" muy arriba, sin apoyo sobre el borde superior de la mesa —
    // se achicaron 10% (70x105 → 63x95, ver también _crearTexturaDorsoGrande,
    // que hay que mantener sincronizado a mano porque bakea el tamaño real
    // de display por separado) y se bajaron en el llamador (95→105) para
    // que apoyen limpiamente contra ese borde en vez de quedar en el aire.
    const kR = this._L ? this._L.kRival : 1;   // Pase 394: cartas mas grandes en layout angosto
    // Pase 449: el mazo del rival de enfrente es una sola imagen en abanico (3, 2 o 1 cartas).
    const claveFrente = this._claveAbanicoMazo(this._mazoIdDe(this._nombreRivalActual), 'frente', Math.min(cantidad, 3));   // Pase 579: abanico del mazo del rival (mazo_id)
    if (cantidad > 0 && this.textures.exists(claveFrente)) {
      const altoF = 116 * kR;
      const frente = this.add.image(400, y, claveFrente).setOrigin(0.5, 0.5).setDepth(10);
      const anchoF = altoF * (frente.width / frente.height);
      frente.setDisplaySize(anchoF, altoF);
      const sombraF = this.add.ellipse(400, y + altoF * 0.4, anchoF * 0.75, altoF * 0.14, 0x000000, 0.22).setDepth(9);
      this._sprites.push(sombraF, frente);
      return;
    }
    const anguloPorCarta = 11;
    const anguloTotal = (cantidad - 1) * anguloPorCarta;
    // Pase siguiente (feedback del usuario: "se ven planas y muy
    // juntas"): un poco más de separación horizontal (52→58) y una sombra
    // proyectada sobre el paño por cada dorso (mismo criterio que ya
    // tienen las cartas de la mano propia en _dibujarManoJugador) — antes
    // esta fila no tenía ninguna sombra, de ahí la sensación de "pegadas"
    // al fondo sin profundidad física.
    const espacio = 58 * kR;
    const inicioX = 400 - ((cantidad - 1) * espacio) / 2;
    const bulto = 9 * kR;
    const anchoCarta = 63 * kR;
    const altoCarta = 95 * kR;

    for (let i = 0; i < cantidad; i++) {
      const anguloCarta = -anguloTotal / 2 + i * anguloPorCarta;
      const centro = (cantidad - 1) / 2;
      const factorCentro = cantidad > 1 ? 1 - Math.abs((i - centro) / centro) : 0;
      const destinoX = inicioX + i * espacio;
      const destinoY = y - factorCentro * bulto;
      const rotRad = anguloCarta * Math.PI / 180;

      const sombra = this.add.ellipse(
        destinoX, destinoY + altoCarta * 0.38,
        anchoCarta * 0.8, altoCarta * 0.2,
        0x000000, 0.22
      ).setRotation(rotRad).setDepth(9 + i);
      this._sprites.push(sombra);

      const borde = this._dibujarBordeSticker(destinoX, destinoY, anchoCarta, altoCarta, rotRad, 0.5, 0.5, 10 + i - 0.3);
      this._sprites.push(borde);

      const img = this.add.image(destinoX, destinoY, this._claveDorsoGrandeActual || 'cardBackGrande')
        .setDisplaySize(anchoCarta, altoCarta)
        .setDepth(10 + i)
        .setRotation(rotRad);
      this._sprites.push(img);
    }
}

_dibujarFilaCartasReveladas(cartas, y) {
    const cantidad = cartas.length;
    const kR = this._L ? this._L.kRival : 1;
    const anchoCarta = 75 * kR;
    const altoCarta = 112 * kR;
    const espacio = 85 * kR; // ancho de la carta + margen, sin superposición
    const inicioX = 400 - ((cantidad - 1) * espacio) / 2;

    // Mismo criterio que _dibujarFilaCartas/_dibujarManoJugador: escalado
    // por canvas de alta calidad en vez de dejar que WebGL achique el PNG
    // original de un salto (sin mipmaps reales por ser NPOT) — este era uno
    // de los lugares que se había quedado con el escalado directo viejo.
    const factor = this._factorEscalaTextura();
    const anchoR = Math.round(anchoCarta * factor);
    const altoR = Math.round(altoCarta * factor);

    for (let i = 0; i < cantidad; i++) {
      const keyOriginal = `${cartas[i].valor}_${cartas[i].palo}`;
      const keyEscalada = `${keyOriginal}_${anchoR}x${altoR}`;
      this._crearTexturaEscalada(keyOriginal, keyEscalada, anchoR, altoR);

      const img = this.add.image(inicioX + i * espacio, y, keyEscalada)
        .setDisplaySize(anchoCarta, altoCarta)
        .setDepth(10 + i);
      this._sprites.push(img);
    }
}

// Sexagésimo tercer pase — pedido del usuario: en 1v1, la carta que ganó
// su ronda queda levemente por encima y por delante de la que perdió,
// tapando un cuarto (25%) de la que perdió. Antes `jugadasRival` y
// `misJugadas` se dibujaban en dos filas separadas con _dibujarFilaCartas
// (rival arriba, mía abajo) sin ninguna relación visual entre sí — esta
// función las junta por ronda (mismo índice i en los dos arrays) alrededor
// de un `yCentro` común. Si a una ronda todavía le falta una de las dos
// cartas (se está jugando en este momento), o hay un empate de valor
// (parda), no hay ganador definido: se dibujan apenas superpuestas, sin
// que ninguna tape más a la otra.
_dibujarDueloCartas(cartasRivalArr, cartasMiasArr, yCentro, escala, depthBase) {
    const cartasRival = cartasRivalArr || [];
    const cartasMias = cartasMiasArr || [];
    const cantidad = Math.max(cartasRival.length, cartasMias.length);
    if (cantidad === 0) return;

    // Pedido del usuario: +10% de tamaño en las cartas jugadas del
    // centro (el "duelo" 1v1), para que los puntos/pinta de cada naipe
    // se lean sin esfuerzo. Único call site de esta función — ver más
    // abajo en _renderizarEstado (e.jugadasRival/e.misJugadas).
    const anchoBase = 90 * 1.1 * escala;
    const altoBase  = 135 * 1.1 * escala;
    // Nonagésimo tercer pase: +12px de separación entre bazas/rondas
    // (pedido explícito del usuario, las 3 columnas de cartas jugadas se
    // veían apretadas) — antes anchoBase+15, ahora anchoBase+27.
    const espacio   = Math.max(anchoBase + 27, 80);
    const inicioX   = 400 - ((cantidad - 1) * espacio) / 2;
    const factor = this._factorEscalaTextura();

    // Sexagésimo octavo pase — el usuario probó el "acercar a la mano
    // mientras se espera la otra carta" de los pases 66/67 y pidió
    // volver atrás: la carta jugada va DIRECTO al lugar del centro (como
    // si ya estuviera en su posición final), y ahí se queda quieta hasta
    // que el otro jugador tira la suya — recién ahí se acomoda una arriba
    // y otra abajo según quién ganó. Ya no hay una posición intermedia
    // "cerca de la mano".
    //
    // (la carta mía quedaba corrida a la derecha de la del rival — el
    // jitter aleatorio de posición (semilla por carta.id) se aplicaba en X
    // también, y como cada carta tiene un id distinto el jitter no
    // coincidía entre las dos → no quedaban centradas una frente a la
    // otra. Se saca el jitter en X, pase 66 — se deja solo en Y, que no
    // rompe el centrado horizontal.)
    //
    // Septuagésimo pase — el usuario reportó tres problemas relacionados,
    // los tres con la misma causa: (1) la web "da vuelta las posiciones de
    // las cartas jugadas" — antes yRival/yMia dependían de quién ganaba
    // (rivalArriba cambiaba según rivalGana), así que la carta del rival y
    // la mía se intercambiaban de lugar (arriba/abajo) según el resultado,
    // en vez de quedarse cada una en su propio lugar; (2) "la segunda
    // carta... queda un poco alejada del centro, por eso no queda una
    // por encima de otra" y (3) "no coloca correctamente la ganadora por
    // encima" — ambos son consecuencia del mismo swap: en el momento en
    // que rivalGana cambiaba de valor entre una ronda y otra, la
    // disposición visual "saltaba" de una configuración a la otra.
    // Arreglado igual que en el nativo (mismo pase): yRival/yMia ahora son
    // SIEMPRE fijos (rival arriba, mía abajo, sin importar quién gane) —
    // lo único que cambia con el resultado es la profundidad, para que la
    // ganadora quede dibujada por encima. De paso (para el punto 3): antes
    // la sombra de la ganadora y la imagen de la perdedora podían compartir
    // exactamente la misma profundidad (depth-1 de una == depth de la
    // otra) — un error de un pixel de margen entre capas que en algunos
    // casos podía tapar mal. Ahora cada capa (sombra perdedora, imagen
    // perdedora, sombra ganadora, imagen ganadora) tiene su propio nivel,
    // sin ningún empate posible.

    // Pase siguiente (feedback del usuario: "en lugar de apilarlas
    // verticalmente en una línea recta rígida, dale a la carta del rival
    // un ligero ángulo hacia la izquierda y a tu carta jugada un ángulo
    // hacia la derecha, offseteadas unos 10px, para simular un tiro real
    // sobre el paño") — `dibujarUna` ahora recibe `rotDeg`/`xOffset`
    // (0 por defecto, para no romper ningún otro call site si apareciera
    // uno nuevo) y los aplica a sombra+borde+imagen por igual, así los
    // tres quedan siempre alineados entre sí. Se pasan siempre los MISMOS
    // valores para cada lado (rival: -3°/-5px: mía: +3°/+5px) sea cual
    // sea la rama del `for` de más abajo (ronda completa o con una sola
    // carta todavía) — para que la carta no "salte" de ángulo/posición
    // cuando llega la segunda.
    const dibujarUna = (carta, x, y, depth, rotDeg = 0, xOffset = 0) => {
      const keyOriginal = `${carta.valor}_${carta.palo}`;
      const anchoBaseR = Math.round(anchoBase * factor);
      const altoBaseR = Math.round(altoBase * factor);
      const keyEscalada = `${keyOriginal}_${anchoBaseR}x${altoBaseR}`;
      this._crearTexturaEscalada(keyOriginal, keyEscalada, anchoBaseR, altoBaseR);

      // Sexagésimo cuarto pase: se había sacado la inclinación AL AZAR que
      // tenían las cartas jugadas (el usuario la probó y pidió que queden
      // derechas sobre la mesa) — este pase reintroduce una inclinación,
      // pero fija (no al azar) y distinta para cada lado, a pedido
      // explícito del usuario (ver comentario de arriba). Sexagésimo
      // sexto/Septuagésimo pase: el jitter de X/Y por `carta.id` se había
      // sacado del todo porque rompía la referencia compartida entre la
      // ganadora y la perdedora de una ronda — el offset de acá NO es
      // jitter (no depende del id de la carta, es fijo por lado), así que
      // no reintroduce ese problema: las dos cartas de una ronda siguen
      // usando exactamente la misma Y base, solo se abren un poco en X.
      const destinoX = x + xOffset;
      const destinoY = y;
      const rotRad = rotDeg * Math.PI / 180;

      const persp = this._calcularPerspectiva(destinoY);
      // Pase 610: tamaños como en la app (la carta de abajo, la mía, se ve un poco más grande que la del rival; antes ambas quedaban más chicas).
      const ajusteTam = rotDeg < 0 ? 1.04 : 1.07;
      const anchoFinal = anchoBase * persp.scale * ajusteTam;
      const altoFinal  = altoBase * persp.scale * ajusteTam;

      const SOMBRA_OFFSET_X = 4;
      const sombra = this.add.ellipse(
        destinoX + SOMBRA_OFFSET_X, destinoY + altoFinal * 0.4 + persp.sombraOffsetY,
        anchoFinal * 0.8, altoFinal * 0.22,
        0x000000, persp.sombraAlpha
      ).setRotation(rotRad).setDepth(depth - 1);
      this._sprites.push(sombra);

      // Nonagésimo segundo pase (pedido explícito del usuario): se saca el
      // borde blanco "sticker" (`_dibujarBordeSticker`) de las cartas
      // jugadas en el centro — quedan solo con su propio contorno negro
      // cel-shading (ya horneado en el PNG de cada carta) para mimetizarse
      // directo sobre el paño verde, en vez de la placa blanca redondeada
      // detrás. Las cartas en mano y los dorsos del rival SÍ conservan su
      // borde (no estaban en el pedido) — ver `_dibujarManoJugador`/
      // `_dibujarFilaDorso`, que llaman a `_dibujarBordeSticker` por su
      // cuenta, sin pasar por esta función.
      const img = this.add.image(destinoX, destinoY, keyEscalada)
        .setDisplaySize(anchoFinal, altoFinal)
        .setDepth(depth)
        .setRotation(rotRad);
      this._sprites.push(img);
      this._volarCartaJugada(img, sombra, carta, destinoX, destinoY, anchoFinal, altoFinal, rotRad, persp.sombraAlpha);   // Pase 610
    };

    // Estimación para el caso más común (con ganador) — se usa para poner
    // la carta sola directo en su lugar fijo definitivo (ver más abajo), y
    // como paso (por ronda) entre las profundidades de las 4 capas de un
    // par ya resuelto (sombra perdedora, imagen perdedora, sombra
    // ganadora, imagen ganadora) sin que ninguna empate con otra.
    const desplazamientoComun = altoBase * 0.75;
    const PASO_DEPTH = 4;

    for (let i = 0; i < cantidad; i++) {
      const cartaRival = cartasRival[i];
      const cartaMia = cartasMias[i];
      const x = inicioX + i * espacio;
      const depthRonda = depthBase + i * PASO_DEPTH;

      // Ronda todavía incompleta: la única carta jugada va directo a SU
      // lugar fijo definitivo (el del rival, arriba; el mío, abajo) — no a
      // yCentro — así no se mueve más cuando llegue la otra.
      // Nonagésimo segundo pase: ángulo subido de ±3° a ±4° (pedido
      // explícito del usuario) en los 6 call sites de `dibujarUna` de esta
      // función — mismo criterio de siempre, mismos valores fijos por
      // lado (no jitter), solo más pronunciado.
      if (cartaRival && !cartaMia) {
        dibujarUna(cartaRival, x, yCentro - desplazamientoComun / 2, depthRonda, -4, -5);
        continue;
      }
      if (cartaMia && !cartaRival) {
        dibujarUna(cartaMia, x, yCentro + desplazamientoComun / 2, depthRonda, 4, 5);
        continue;
      }
      if (!cartaRival && !cartaMia) continue;

      let rivalGana = false;
      let hayGanador = false;
      const rankRival = CARD_RANKS[`${cartaRival.valor}_${cartaRival.palo}`] || 0;
      const rankMia   = CARD_RANKS[`${cartaMia.valor}_${cartaMia.palo}`] || 0;
      if (rankRival !== rankMia) {
        hayGanador = true;
        rivalGana = rankRival > rankMia;
      }

      // Con ganador definido: se solapan 25% (altoBase*0.75 entre centros).
      // Empate (parda): casi no se solapan.
      const desplazamiento = hayGanador ? altoBase * 0.75 : altoBase * 0.9;

      // Posición SIEMPRE fija — el rival arriba, la mía abajo, sin
      // importar quién gane la ronda (antes esto dependía de rivalGana y
      // las dos cartas se intercambiaban de lugar entre una ronda y otra,
      // lo que el usuario reportó como "da vuelta las posiciones" y hacía
      // que algunos pares quedaran más separados/lejos del centro). Lo
      // único que cambia con el resultado es la profundidad, dos líneas
      // más abajo.
      const yRival = yCentro - desplazamiento / 2;
      const yMia   = yCentro + desplazamiento / 2;

      // La ganadora se dibuja DESPUÉS (con más profundidad) que la
      // perdedora, para que la tape — cada una de las 4 capas (sombra
      // perdedora, imagen perdedora, sombra ganadora, imagen ganadora) usa
      // su propio nivel de profundidad, sin compartir ninguno. Sin
      // ganador definido (parda), el orden es arbitrario (el solape es
      // chico, no se nota cuál queda "arriba").
      if (hayGanador && rivalGana) {
        dibujarUna(cartaMia,   x, yMia,   depthRonda,     4, 5);
        dibujarUna(cartaRival, x, yRival, depthRonda + 2, -4, -5);
      } else {
        dibujarUna(cartaRival, x, yRival, depthRonda,     -4, -5);
        dibujarUna(cartaMia,   x, yMia,   depthRonda + 2, 4, 5);
      }
    }
}

_dibujarFilaCartas(cartas, y, jugable, esMiMano = false, escala = 1, animar = false, depthBase = 10, rotGrados = 0) {
    if (!cartas || cartas.length === 0) return;
    const anchoBase = 90 * escala;
    const altoBase  = 135 * escala;
    // Pase 217 — único call site: la fila de cartas jugadas POR EL USUARIO
    // en 2v2/3v3 (ver _renderizarEquipos, más abajo en este archivo). El
    // usuario pidió acercarlas ("actualmente muy separadas") — con
    // escala=0.60 el piso viejo de 80 quedaba muy por encima del ancho real
    // de la carta (54px), dejando ~26px de hueco entre una y la siguiente.
    // Se cambia a un piso mucho más chico (56) casi pegado al ancho de la
    // carta, para que queden casi tocándose sin llegar a taparse del todo.
    const espacio   = Math.max(anchoBase + 4, 56);
    const inicioX   = 400 - ((cartas.length - 1) * espacio) / 2;

    const esCartaJugada = !esMiMano;

    const factor = this._factorEscalaTextura();

    cartas.forEach((carta, i) => {
    const keyOriginal = `${carta.valor}_${carta.palo}`;
    const anchoBaseR = Math.round(anchoBase * factor);
    const altoBaseR = Math.round(altoBase * factor);
    const keyEscalada = `${keyOriginal}_${anchoBaseR}x${altoBaseR}`;
    this._crearTexturaEscalada(keyOriginal, keyEscalada, anchoBaseR, altoBaseR);

      let destinoX = inicioX + i * espacio;
      let destinoY = y;
      // Sexagésimo cuarto pase: se saca la inclinación al azar de las
      // cartas jugadas (el usuario pidió que queden derechas sobre la
      // mesa) — se deja el jitter chico de posición, mismo criterio que en
      // _dibujarDueloCartas.
      const rotacion = rotGrados * (Math.PI / 180);   // Pase 444: inclinación sutil de mi carta jugada en 2v2

      if (esCartaJugada) {
        const semilla = this._hashSimple(carta.id);
        destinoX += ((semilla % 13) - 6) * 1.5;
        destinoY += ((semilla % 9) - 4) * 1.5;
      }

      const persp = esCartaJugada
        ? this._calcularPerspectiva(destinoY)
        : { scale: 1, offsetY: 0, sombraOffsetY: 0, sombraAlpha: 0 };
      // Decimoséptimo pase: antes solo se escalaba el ALTO (scaleY) y el
      // ancho quedaba fijo — una carta más lejos en una mesa real se ve más
      // chica en las dos dimensiones, no "aplastada" solo verticalmente. Ver
      // _calcularPerspectiva para el rango nuevo y el empujón extra en Y.
      destinoY += persp.offsetY;
      const anchoFinal = anchoBase * persp.scale;   // Pase 446: sin destaque de carta ganadora
      const altoFinal = altoBase * persp.scale;

      let sombra = null;
      if (esCartaJugada) {
        // Vigésimo cuarto pase: la sombra quedaba centrada justo debajo de
        // la carta (solo offset vertical) — se le agregó un offset
        // horizontal chico hacia la derecha para que se lea como una sombra
        // arrojada por una luz de arriba-a-la-izquierda (abajo-a-la-derecha),
        // en vez de un halo simétrico, más consistente con el resto de la
        // "atmósfera" de la mesa (viñeteado/luz cálida del vigésimo primer
        // pase).
        const SOMBRA_OFFSET_X = 4;
        sombra = this.add.ellipse(
          destinoX + SOMBRA_OFFSET_X, destinoY + altoFinal * 0.4 + persp.sombraOffsetY,
          anchoFinal * 0.8, altoFinal * 0.22,
          0x000000, animar ? 0 : persp.sombraAlpha
        ).setRotation(rotacion).setDepth(depthBase - 1 + i);
        this._sprites.push(sombra);
      }

      const img = this.add.image(animar ? 400 : destinoX, animar ? 300 : destinoY, keyEscalada)
        .setDisplaySize(animar ? anchoBase : anchoFinal, animar ? altoBase : altoFinal)
        .setDepth(depthBase + i)
        .setAlpha(animar ? 0 : 1)
        .setRotation(animar ? 0 : rotacion);

      if (animar) {
        this.time.delayedCall(i * 130, () => {
          if (!img.scene) return;
          img.setAlpha(1);
          img.setDisplaySize(anchoFinal, altoFinal);
          this.tweens.add({
            targets: img, x: destinoX, y: destinoY, rotation: rotacion,
            duration: 300, ease: 'Power2.easeOut'
          });
          if (sombra && sombra.scene) {
            this.tweens.add({
              targets: sombra, alpha: persp.sombraAlpha,
              duration: 300, ease: 'Power2.easeOut'
            });
          }
        });
      }

      if (jugable) {
        img.setInteractive({ useHandCursor: true });
        img.on('pointerover', () => img.setY(destinoY - 15));
        img.on('pointerout',  () => img.setY(destinoY));
        img.on('pointerdown', () => {
          try { this.sound.play('jugar-carta', { volume: 0.6 * (this.efectosVolumen ?? 1) }); } catch (err) {}
          this.socket.emit('jugar-carta', { codigoSala: this.codigoSala, cartaId: carta.id });
        });
      }

      this._sprites.push(img);
      if (esCartaJugada) this._volarCartaJugada(img, sombra, carta, destinoX, destinoY, anchoFinal, altoFinal, rotacion, persp.sombraAlpha);   // Pase 610
    });
}

// Pase 610: vuelo de la carta que acabo de tirar — un solo viaje corto y suave (340 ms, frena al llegar) desde donde estaba en la mano
// hasta su lugar final en la mesa, con un arco chico (máx. 8 px) y sin levantarse ni "caer" al terminar: es el mismo recorrido de la app.
_volarCartaJugada(img, sombra, carta, destX, destY, anchoF, altoF, rot, sombraAlpha) {
  const p = this._vueloPendiente;
  if (!p || !carta || p.cartaId !== carta.id) return false;
  this._vueloPendiente = null;
  if (Date.now() - p.t > 4000 || !img.scene) return false;
  const profundidad = img.depth;
  img.setPosition(p.x, p.y).setDisplaySize(p.ancho, p.alto).setRotation(p.rot).setDepth(900);
  if (sombra && sombra.scene) sombra.setAlpha(0);
  const prog = { t: 0 };
  this.tweens.add({
    targets: prog, t: 1, duration: 340, ease: 'Quad.easeOut',
    onUpdate: () => {
      if (!img.scene) return;
      const k = prog.t;
      img.setPosition(p.x + (destX - p.x) * k, p.y + (destY - p.y) * k - 8 * Math.sin(Math.PI * k));
      img.setDisplaySize(p.ancho + (anchoF - p.ancho) * k, p.alto + (altoF - p.alto) * k);
      img.setRotation(p.rot + (rot - p.rot) * k);
    },
    onComplete: () => {
      if (!img.scene) return;
      img.setPosition(destX, destY).setDisplaySize(anchoF, altoF).setRotation(rot).setDepth(profundidad);
      if (sombra && sombra.scene) this.tweens.add({ targets: sombra, alpha: sombraAlpha, duration: 120, ease: 'Linear' });
    }
  });
  return true;
}

// Pase 444/445: placa de pergamino con marco de madera para el nombre de un asiento. Acento verde
// oliva (equipo propio) o borgoña (rivales). En su turno se dora y recibe un resplandor dorado que
// respira (reemplaza al cartel flotante "Tu turno" en equipos). Devuelve la geometría para el anillo
// de tiempo y la zona clickeable.
_dibujarPlacaNombre(cx, yNombre, nombre, kS, { turno = false, acento = 0x7F8F38, mano = false, rival = false } = {}) {
  const fsN = Math.round(12 * kS);
  let nombreCorto = String(nombre || '');
  if (nombreCorto.length > 14) nombreCorto = nombreCorto.slice(0, 13) + '…';
  const iconoMano = mano && this.textures.exists('medalla_mano');   // Pase 580: medalla de mano en vez de la silueta
  const nombreTxt = this.add.text(0, yNombre, nombreCorto + (turno ? ' ●' : ''), {
    fontFamily: 'Nunito, Arial', fontSize: `${fsN}px`, fontStyle: '800',
    // Pase 447: nombre en verde oliva (mi equipo) o bronce rojizo (rivales); en turno se oscurece un poco para leerse sobre el dorado.
    color: rival ? (turno ? '#7A2E12' : '#8A3A1E') : (turno ? '#4F5A0E' : '#5D6B14'),
  }).setOrigin(0.5).setDepth(50);
  const padXp = 10 * kS, extraMano = iconoMano ? 15 * kS : 0;
  const pw = Math.ceil(nombreTxt.width + padXp * 2 + extraMano);
  const ph = Math.ceil(fsN + 11 * kS);
  const px0 = cx - pw / 2, py0 = yNombre - ph / 2;
  nombreTxt.setX(px0 + padXp + nombreTxt.width / 2);
  // Pase 450: sin resplandor ni animación de luz; el turno se marca solo con el dorado liso de la placa.
  const placa = this.add.graphics().setDepth(49);
  placa.fillStyle(0x000000, 0.35);
  placa.fillRoundedRect(px0, py0 + 2, pw, ph, 7);
  placa.fillStyle(turno ? 0xB9791A : (rival ? 0x3A1F0F : 0x8A5B2F), 1);   // Pase 447: madera clara (equipo) / oscura (rivales)
  placa.fillRoundedRect(px0, py0, pw, ph, 7);
  placa.fillStyle(turno ? 0xE9A31B : (rival ? 0x57331B : 0xB07A42), 1);
  placa.fillRoundedRect(px0 + 1.5, py0 + 1.5, pw - 3, Math.max(4, ph * 0.4), { tl: 6, tr: 6, bl: 1, br: 1 });
  placa.lineStyle(2, 0x1a0f08, 1);
  placa.strokeRoundedRect(px0, py0, pw, ph, 7);
  placa.fillStyle(turno ? 0xFFE9A8 : (rival ? 0xDDC9A1 : 0xF0E2C0), 1);
  placa.fillRoundedRect(px0 + 3, py0 + 3, pw - 6, ph - 6, 4);
  placa.lineStyle(1.6, acento, 1);
  placa.strokeRoundedRect(px0 + 4, py0 + 4, pw - 8, ph - 8, 3);
  this._sprites.push(placa);
  // Pase 447: mini-escudos decorativos en los extremos de la placa. Mi equipo: dorado con centro verde oliva;
  // rivales: bronce con centro rojo apagado.
  const sw = 12 * kS, sh = 15 * kS;
  [px0 - 3 * kS, px0 + pw + 3 * kS].forEach(sx => {
    const esc = this.add.graphics().setDepth(51);
    const forma = (k) => {
      const w = sw * k / 2, h = sh * k / 2;
      return [
        { x: -w, y: -h }, { x: 0, y: -h * 0.82 }, { x: w, y: -h },
        { x: w, y: h * 0.05 }, { x: w * 0.55, y: h * 0.55 }, { x: 0, y: h },
        { x: -w * 0.55, y: h * 0.55 }, { x: -w, y: h * 0.05 },
      ];
    };
    esc.fillStyle(0x000000, 0.35);
    esc.fillPoints(forma(1).map(p => ({ x: p.x, y: p.y + 1.5 })), true);
    esc.fillStyle(rival ? 0xA8692F : 0xD9A82A, 1);
    esc.fillPoints(forma(1), true);
    esc.lineStyle(1.4, 0x1a0f08, 1);
    esc.strokePoints(forma(1), true, true);
    esc.fillStyle(rival ? 0x8B2A2A : 0x6F8A2B, 1);
    esc.fillPoints(forma(0.55), true);
    esc.setPosition(sx, yNombre);
    this._sprites.push(esc);
  });
  if (iconoMano) {
    const ic = this.add.image(px0 + pw - padXp - 3 * kS, yNombre, 'medalla_mano').setDisplaySize(14 * kS, 14 * kS).setDepth(51);
    this._sprites.push(ic);
  }
  this._sprites.push(nombreTxt);
  return { pw, ph, px0, py0 };
}

// Pase 445: en equipos mi turno ya no se anuncia con el texto "● Tu turno": aparece mi propia placa
// (con mi nombre) dorada y con resplandor donde estaba ese texto, y el anillo de tiempo la rodea.
_dibujarPlacaTurnoPropia() {
  const kS = this._L ? this._L.kSeat : 1;
  const cx = this._L ? this._L.turnoX : 690;
  const cy = this._L ? this._L.turnoY : 500;
  const r = this._dibujarPlacaNombre(cx, cy, (this.usuario && this.usuario.username) || 'Vos', kS, { turno: true, acento: 0x7F8F38 });
  this._anilloRect = { x: r.px0 - 2, y: r.py0 - 2, w: r.pw + 4, h: r.ph + 4, r: 8 };
}

_hashSimple(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
}

_calcularPerspectiva(y) {
    const centroMesaY = this._L ? this._L.perspCY : 320;
    const radioY = this._L ? this._L.perspRY : 170;
    const t = Phaser.Math.Clamp((y - (centroMesaY - radioY)) / (radioY * 2), 0, 1);
    // Decimoséptimo pase: el usuario (revisando una captura real del juego)
    // pidió más sensación de profundidad en las cartas jugadas del centro —
    // "la de arriba un poco más chica y más arriba, la de abajo un poco más
    // grande". Antes esto solo achicaba el ALTO (0.78–1.00, un rango angosto
    // y sin tocar el ancho) — una carta más lejos en una mesa real se ve más
    // chica en las DOS dimensiones, no aplastada. Se pasa a un escalado
    // UNIFORME (ancho y alto por igual) con un rango bastante más marcado
    // (0.70–1.08), más un pequeño empujón extra en Y (`offsetY`) para que la
    // carta lejana suba un poco y la cercana baje un poco, sin tener que
    // re-tocar las coordenadas Y de cada punto de llamada. La sombra
    // acompaña con más rango de offset/opacidad para reforzar la misma idea.
    // Sexagésimo primer pase — punto 1 ("jerarquía visual"): sombra más
    // marcada (antes 0.22-0.50 de opacidad) para que la carta jugada se
    // sienta más despegada de la mesa, mismo criterio que ya se usaba para
    // los botones-imagen (sombra detrás para que parezcan "objetos").
    return {
      scale: 0.70 + t * 0.38,
      offsetY: (t - 0.5) * 10,
      sombraOffsetY: 4 + t * 7,
      sombraAlpha: 0.32 + t * 0.30
    };
}

  // Ancho "natural" de un botón-imagen (Fase 2) a un alto dado, preservando
  // el aspecto real del archivo — cada botón tiene su propio ancho relativo
  // (el texto horneado varía de largo), así que no hay un ratio fijo único.
  _anchoBotonImagen(clave, alto) {
    if (BOTON_RUSTICO[clave]) {
      // Pase 406: ancho = lo que mida el texto a este alto + margen para los remaches.
      const fs = alto * RATIO_FUENTE_RUSTICO;
      const medidor = this.add.text(0, 0, BOTON_RUSTICO[clave].txt, { fontFamily: 'Nunito, Arial', fontSize: `${fs.toFixed(1)}px`, fontStyle: 'bold' });
      const w = medidor.width;
      medidor.destroy();
      return Math.max(alto * 2.0, w + alto * 1.1);
    }
    const tex = this.textures.get(`boton_img_${clave}`).getSourceImage();
    return alto * (tex.width / tex.height);
  }

  // Ducentésimo septuagésimo pase: ancho real para el botón "Tengo [N]" —
  // a diferencia del resto (texto horneado, ancho fijo por archivo), acá el
  // texto es dinámico (varía entre "Tengo 0" y "Tengo 33") y la tablita de
  // fondo es de 3 franjas (tengoIzq/tengoCentro/tengoDer, ver _crearBoton),
  // así que el ancho correcto es "lo que el texto necesite" en vez de un
  // número fijo (130) que antes dejaba la píldora estirada/distinta según
  // cuántos dígitos tuviera el puntaje. Se mide con un Text descartable
  // (misma tipografía/grosor que el label real, para que el ancho medido
  // coincida con el que después se dibuja).
  _anchoBotonTengo(texto, tamanoFuente, alto) {
    // Pase 408: "Tengo N" también es una tablita rústica (variante oliva); el ancho sale del texto real.
    const fs = alto * RATIO_FUENTE_RUSTICO;
    const medidor = this.add.text(0, 0, String(texto).toUpperCase(), { fontFamily: 'Nunito, Arial', fontSize: `${fs.toFixed(1)}px`, fontStyle: 'bold' });
    const w = medidor.width;
    medidor.destroy();
    return Math.max(alto * 2.0, w + alto * 1.1);
  }

  // Pase 406: tablita de madera rústica en relieve (ver BOTON_RUSTICO). Coordenadas
  // locales centradas en (0,0). Todo con Graphics (rects redondeados apilados),
  // sin sombras difusas: la "sombra inferior" es un canto sólido debajo.
  // `simple` (Pase 411, botones de la pantalla final): un unico canto oscuro debajo, sin la sombra dura
  // ni la franja interior de marco que se veian como un segundo marco inferior descalzado.
  _dibujarBotonRustico(g, w, h, v, simple = false) {
    const P = VARIANTES_RUSTICAS[v];
    const OUT = 0x2c160e;
    // Pase 599 (paridad con la app, Pase 590): botones PLANOS — sin canto inferior ni sombra dura (se veía como una segunda capa debajo).
    const PLANO = true;
    const d = PLANO ? 0 : (simple ? Math.max(2, h * P.prof * 0.5) : Math.max(3, h * P.prof));      // alto del canto inferior (extrusión); Pase 412: a la mitad en los botones de la pantalla final
    const hb = h - d;                        // alto de la cara frontal
    const R = Math.min(h * 0.24, 11);
    const top = -h / 2;
    const b = Math.max(3, h * 0.13);         // grosor del marco de madera
    // sombra dura de apoyo
    if (!simple && !PLANO) {
      g.fillStyle(0x000000, 0.35);
      g.fillRoundedRect(-w / 2 + 1, top + d + 2, w, hb, R);
    }
    // canto (extrusión) en tono más oscuro que el marco
    if (!PLANO) {
      g.fillStyle(OUT, 1);
      g.fillRoundedRect(-w / 2, top + d, w, hb, R);
      if (!simple) {
        g.fillStyle(P.marco, 1);
        g.fillRoundedRect(-w / 2 + 1, top + d - 1, w - 2, hb - 1, R);
      }
    }
    // cara frontal: marco + luz de bisel arriba
    g.fillStyle(P.marco, 1);
    g.fillRoundedRect(-w / 2, top, w, hb, R);
    g.fillStyle(P.marcoLuz, 0.75);
    g.fillRoundedRect(-w / 2 + 1.5, top + 1.5, w - 3, hb * 0.5, { tl: R - 1, tr: R - 1, bl: 0, br: 0 });
    // veta de la madera en el marco
    g.lineStyle(1, 0x000000, 0.18);
    g.lineBetween(-w / 2 + R, top + hb - 2.5, w / 2 - R, top + hb - 2.5);
    // campo interior (pergamino / placa)
    const ix = -w / 2 + b, iy = top + b, iw = w - b * 2, ih = hb - b * 2;
    const r2 = Math.max(2, R - b * 0.6);
    g.fillStyle(P.campoSombra, 1);
    g.fillRoundedRect(ix, iy, iw, ih, r2);
    g.fillStyle(P.campo, 1);
    g.fillRoundedRect(ix, iy, iw, ih - Math.max(1.5, ih * 0.10), r2);
    g.fillStyle(P.campoLuz, 0.55);
    g.fillRoundedRect(ix + 1, iy + 1, iw - 2, ih * 0.42, { tl: r2, tr: r2, bl: 1, br: 1 });
    // vetas finas del campo
    // (la placa dorada del Truco va lisa: sin vetas, desentonaban)
    if (v !== 'oro') {
      g.lineStyle(1, v === 'claro' ? 0x8a5a2a : 0x000000, v === 'claro' ? 0.13 : 0.12);
      g.lineBetween(ix + r2, iy + ih * 0.62, ix + iw - r2, iy + ih * 0.62);
      g.lineBetween(ix + r2 * 2, iy + ih * 0.80, ix + iw - r2, iy + ih * 0.80);
    }
    // bisel interior (hundido) + aro dorado en la placa de Truco
    g.lineStyle(1.2, OUT, 0.6);
    g.strokeRoundedRect(ix, iy, iw, ih, r2);
    if (v === 'oro') {
      g.lineStyle(1.2, 0xffe9a0, 0.7);
      g.strokeRoundedRect(ix + 1.6, iy + 1.6, iw - 3.2, ih - 3.2, Math.max(1, r2 - 1.5));
    }
    // contorno exterior oscuro
    g.lineStyle(2, OUT, 1);
    g.strokeRoundedRect(-w / 2, top, w, hb, R);
    // remaches dorados a los costados
    const rr = Math.max(2.2, h * 0.075);
    const ry = top + hb / 2;
    const rx = w / 2 - Math.max(5, h * 0.2);
    this._dibujarRemache(g, -rx, ry, rr);
    this._dibujarRemache(g, rx, ry, rr);
    return d;
  }

  _crearBoton({ x, y, ancho, alto = 44, texto, colorFondo, colorTexto, imagen = null,
              colorBorde = 0x4A2C2A, grosorBorde = 3, radio = 12, tamanoFuente = 15,
              onClick, deshabilitado = false }) {
  const contenedor = this.add.container(x, y).setDepth(200);
  const hijos = [];

  const defRus = imagen === 'Tengo' ? { txt: String(texto || '').toUpperCase(), v: 'oliva' } : (imagen ? BOTON_RUSTICO[imagen] : null);
  if (defRus) {
    // Pase 406/408: botón de madera rústica dibujado por código (ver BOTON_RUSTICO; "Tengo N" usa la variante oliva).
    const def = defRus;
    const P = VARIANTES_RUSTICAS[def.v];
    const gRus = this.add.graphics();
    const dCanto = this._dibujarBotonRustico(gRus, ancho, alto, def.v);
    const fs = alto * RATIO_FUENTE_RUSTICO;
    const yTxt = -dCanto / 2;
    const estiloTxt = { fontFamily: 'Nunito, Arial', fontSize: `${fs.toFixed(1)}px`, fontStyle: 'bold' };
    const partes = [gRus];
    if (P.grabado) {
      partes.push(this.add.text(0, yTxt + Math.max(1, fs * 0.07), def.txt, { ...estiloTxt, color: '#fff4d6' }).setOrigin(0.5).setAlpha(0.7));
    }
    partes.push(this.add.text(0, yTxt, def.txt, { ...estiloTxt, color: P.texto, stroke: '#2c160e', strokeThickness: P.grabado ? 1 : Math.max(2, fs * 0.17) }).setOrigin(0.5));
    if (deshabilitado) partes.forEach(o => o.setAlpha(0.4));
    hijos.push(...partes);
  } else if (imagen === 'Tengo') {
    // Ducentésimo septuagésimo pase: "Tengo [N]" es la ÚNICA tablita de
    // este set sin texto horneado (el número lo dibuja el bloque `texto`
    // más abajo) — por eso, a diferencia de todos los demás botones-imagen
    // (Quiero/Truco/etc., que sí tienen texto horneado y no se pueden
    // recortar en franjas sin deformarlo, ver pase 269), ACÁ sí se puede
    // aplicar la técnica de 3 franjas (misma idea que `_crearBannerTexto`/
    // `_crearBotonOverlay`): dos puntas fijas (tengoIzq/tengoDer, recortadas
    // de la imagen que mandó el usuario, mantienen su proporción real según
    // `alto`) y un tramo recto del medio que se estira al ancho que haga
    // falta — así la píldora nunca se deforma, sin importar si el ancho
    // pedido (que ya sale medido del texto real, ver `_anchoBotonTengo`)
    // es chico ("Tengo 7") o grande ("Tengo 33").
    const texIzqTengo = this.textures.get('tengoIzq').getSourceImage();
    const texDerTengo = this.textures.get('tengoDer').getSourceImage();
    const capIzqTengo = Math.round(texIzqTengo.width * (alto / texIzqTengo.height));
    const capDerTengo = Math.round(texDerTengo.width * (alto / texDerTengo.height));
    const midWTengo = Math.max(1, ancho - capIzqTengo - capDerTengo);
    // Ducentésimo septuagésimo segundo pase: el usuario reportó una línea
    // de costura visible justo donde el tramo recto del medio se pega con
    // la punta derecha — artefacto típico de WebGL al apoyar dos imágenes
    // separadas borde a borde (el filtrado lineal deja ver un hilo de 1px
    // en el límite de cada textura). Fix: `tengoCentro` se dibuja un par
    // de px MÁS ANCHO de lo necesario, extendiéndose por DEBAJO de
    // `tengoDer` (que se agrega después, encima) — como los dos tramos son
    // del mismo verde liso ahí, el solape no se nota, y la punta derecha
    // (dibujada arriba) tapa cualquier artefacto de borde de `tengoCentro`.
    const SOLAPE_COSTURA = 3;
    const imgIzqTengo = this.add.image(-ancho / 2 + capIzqTengo / 2, 0, 'tengoIzq').setDisplaySize(capIzqTengo, alto);
    const imgCentroTengo = this.add.image(-ancho / 2 + capIzqTengo + midWTengo / 2 + SOLAPE_COSTURA / 2, 0, 'tengoCentro').setDisplaySize(midWTengo + SOLAPE_COSTURA, alto);
    const imgDerTengo = this.add.image(ancho / 2 - capDerTengo / 2, 0, 'tengoDer').setDisplaySize(capDerTengo, alto);
    if (deshabilitado) { imgIzqTengo.setAlpha(0.4); imgCentroTengo.setAlpha(0.4); imgDerTengo.setAlpha(0.4); }
    hijos.push(imgIzqTengo, imgCentroTengo, imgDerTengo);
  } else if (imagen) {
    // Vigésimo noveno pase: sombra detrás de cada botón-imagen para que
    // tengan aspecto de "botón" real (despegado del fondo) en vez de una
    // calcomanía plana pegada al panel — un rectángulo redondeado oscuro
    // semitransparente, desplazado apenas hacia abajo-derecha. Hacía
    // falta porque esos botones-imagen viejos eran planos, sin sombra
    // propia horneada.
    // Nonagésimo tercer pase: SACADA — el set nuevo de botones (Truco,
    // Quiero, Ir al mazo, etc., ver CLAVE_IMAGEN_BOTON) ya trae su propia
    // sombra "sticker" horneada en el PNG, así que esta sombra de código
    // quedaba duplicada/difusa encima de la del asset (pedido explícito
    // del usuario: "sin sombras externas difusas o duplicadas"). Solo
    // queda el contorno negro vectorial que ya traen las imágenes.

    // Botón con el texto ya horneado en la imagen (rediseño Canva, Fase 2)
    // — una sola imagen a su aspecto natural, sin slices ni texto encima.
    // Mismo criterio que las cartas (_crearTexturaEscalada): pre-escalamos
    // por canvas de alta calidad al tamaño real de display en vez de dejar
    // que WebGL achique el PNG original (426x180 etc., NPOT) de un salto sin
    // mipmaps reales — eso es lo que se veía "escalonado" en los botones.
    const claveOriginalImg = `boton_img_${imagen}`;
    const factorBoton = this._factorEscalaTextura();
    const anchoBotonR = Math.round(ancho * factorBoton);
    const altoBotonR = Math.round(alto * factorBoton);
    const claveEscaladaImg = `${claveOriginalImg}_${anchoBotonR}x${altoBotonR}`;
    this._crearTexturaEscalada(claveOriginalImg, claveEscaladaImg, anchoBotonR, altoBotonR);
    const img = this.add.image(0, 0, claveEscaladaImg).setDisplaySize(ancho, alto);
    if (deshabilitado) img.setAlpha(0.4);
    hijos.push(img);
  } else {
    const grafico = this.add.graphics();
    grafico.fillStyle(colorFondo, deshabilitado ? 0.4 : 1);
    grafico.fillRoundedRect(-ancho / 2, -alto / 2, ancho, alto, radio);
    grafico.lineStyle(grosorBorde, colorBorde, deshabilitado ? 0.4 : 1);
    grafico.strokeRoundedRect(-ancho / 2, -alto / 2, ancho, alto, radio);
    hijos.push(grafico);
  }

  // Con "imagen" el texto normalmente ya viene horneado en el archivo —
  // no hace falta dibujar nada encima. La única excepción es "Tengo
  // [puntos]" (`imagen: 'Tengo'` + `texto` dinámico a la vez): ahí sí hay
  // que dibujar el número arriba de la tablita en blanco. Octogésimo
  // sexto pase: antes esto se decidía con `!imagen` (daba por sentado que
  // "hay texto" y "no hay imagen" eran lo mismo) — ahora que "Tengo" tiene
  // las dos cosas a la vez, el chequeo correcto es directamente `texto`.
  if (texto && !defRus) {
    // Blanco + contorno negro grueso para que el número dibujado a mano
    // se sienta parte de la misma familia que el texto horneado por el
    // diseñador en el resto de los botones-imagen (mismo tratamiento que
    // usan Quiero/FaltaEnvido/etc.) — un shadow fino como usaban los
    // botones "material" viejos se veía débil sobre el fondo ilustrado.
    const colorTextoFinal = colorTexto || '#4A2C2A';
    const label = this.add.text(0, 0, texto, {
    fontFamily: 'Nunito, Arial',
    fontSize: `${tamanoFuente}px`,
    fontStyle: 'bold',
    color: colorTextoFinal,
    ...(imagen ? { stroke: '#000000', strokeThickness: 4 } : {}),
    }).setOrigin(0.5);
    hijos.push(label);
  }

    contenedor.add(hijos);
    contenedor.setSize(ancho, alto);

    if (!deshabilitado && onClick) {
      contenedor.setInteractive({ useHandCursor: true });
      contenedor.on('pointerdown', () => {
        this.tweens.add({ targets: contenedor, scale: 0.94, duration: 80, ease: 'Quad.easeOut' });
      });
      contenedor.on('pointerup', () => {
        this.tweens.add({ targets: contenedor, scale: 1, duration: 140, ease: 'Quad.easeOut' });
        contenedor.disableInteractive();
        onClick();
      });
      contenedor.on('pointerout', () => {
        this.tweens.add({ targets: contenedor, scale: 1, duration: 140, ease: 'Quad.easeOut' });
      });
    }

    this._sprites.push(contenedor);
    return contenedor;
}

// Banner de mensaje con el marco pintado (madera + pergamino), en 3
// slices igual que _crearBoton. Reemplaza los textos sueltos con
// backgroundColor plano que se usaban para "¿Querés el Truco?", "Tengo
// tanto", etc. El ancho/alto se calculan solos según el largo del texto.
// Pase 210: agregado un 5to parámetro opcional (nunca usado antes — todos
// los llamados existentes pasan solo 4 args y siguen viendo el mismo 14px
// marrón de siempre) para poder reusar este mismo marco en el título de la
// sala de espera con letra más grande/clara (pedido del usuario: "cambiar
// el estilo... muy chiquito y apenas se lee" — ver _actualizarBannerEsperaTitulo).
// Pase 267, punto 1: dos opciones nuevas, las DOS por defecto apagadas
// (`strokeTexto: null`, `conRemaches: false`) — los 5 llamados existentes
// (cantos de Envido/Flor/Truco en partida) no pasan estos parámetros y
// siguen viendo exactamente el mismo banner de siempre. Se activan solo
// para el título de la sala de espera (ver _actualizarBannerEsperaTitulo),
// que pidió explícitamente "texto en negrita dorada/blanca con contorno
// negro marcado" y "remaches de bronce en los extremos" — mismo criterio
// de "placa más vistosa" que ya se le dio al marco del avatar en el pase
// 266 (`marcoAvatar`: 3 círculos concéntricos), pero en versión chica para
// las puntas de un banner rectangular en vez de un círculo entero.
_crearBannerTexto(x, y, texto, depth = 200, { tamanoFuente = 14, colorTexto = '#4A2C2A', anchoWrap = 620, strokeTexto = null, conRemaches = false, iconoAnimado = false } = {}) {
  const label = this.add.text(0, 0, texto, {
    fontFamily: 'Nunito, Arial', fontSize: `${tamanoFuente}px`, fontStyle: 'bold', color: colorTexto,
    align: 'center', wordWrap: { width: anchoWrap },
    ...(strokeTexto ? { stroke: strokeTexto, strokeThickness: 4 } : {}),
  }).setOrigin(0.5);

  // Pase 267, punto 1: ícono de reloj de arena, animado con un vaivén de
  // rotación (no una vuelta completa — un reloj de arena girando 360°
  // todo el tiempo se lee raro; el tilt de -18° a 18° se lee más como "se
  // está dando vuelta" de forma ambigua/continua). Se arma como un Text
  // SEPARADO del label (no baked adentro del string) para poder rotarlo
  // solo a él — si el ícono va adentro del mismo Text que el título, no
  // hay forma de animar solo el emoji sin mover todo el texto junto.
  // Por eso el ancho del banner tiene que contemplar el icono + el gap
  // además del label (si no, el icono se sale del marco de pergamino).
  let icono = null;
  let labelOffsetX = 0;
  let anchoContenido = label.width;
  if (iconoAnimado) {
    icono = this.add.text(0, 0, '⏳', { fontSize: `${Math.round(tamanoFuente * 0.9)}px` }).setOrigin(0.5);
    const gapIcono = 10;
    anchoContenido = icono.width + gapIcono + label.width;
    const inicioX = -anchoContenido / 2;
    icono.setPosition(inicioX + icono.width / 2, 0);
    labelOffsetX = inicioX + icono.width + gapIcono + label.width / 2;
    label.setPosition(labelOffsetX, 0);
    this.tweens.add({ targets: icono, angle: { from: -18, to: 18 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  const padX = 26, padY = 14;
  const anchoBanner = Math.max(200, anchoContenido + padX * 2);
  const altoBanner = Math.max(40, label.height + padY * 2);

  const texIzq = this.textures.get('banner_izq').getSourceImage();
  const texDer = this.textures.get('banner_der').getSourceImage();
  const capW = Math.round(texIzq.width * (altoBanner / texIzq.height));
  const capWDer = Math.round(texDer.width * (altoBanner / texDer.height));
  const midW = Math.max(1, anchoBanner - capW - capWDer);

  const izq = this.add.image(-anchoBanner / 2 + capW / 2, 0, 'banner_izq').setDisplaySize(capW, altoBanner);
  const centro = this.add.image(-anchoBanner / 2 + capW + midW / 2, 0, 'banner_centro').setDisplaySize(midW, altoBanner);
  const der = this.add.image(anchoBanner / 2 - capWDer / 2, 0, 'banner_der').setDisplaySize(capWDer, altoBanner);

  const hijos = icono ? [izq, centro, der, icono, label] : [izq, centro, der, label];

  if (conRemaches) {
    // 4 remaches de bronce, uno cerca de cada esquina — mismas 3 capas
    // concéntricas (negroPulido/remache/remacheClaro) que `marcoAvatar`
    // en _mostrarPantallaFinal, a una escala bien chica (radio 5).
    const remaches = this.add.graphics();
    const rx = anchoBanner / 2 - 14;
    const ry = altoBanner / 2 - 11;
    [[-rx, -ry], [rx, -ry], [-rx, ry], [rx, ry]].forEach(([dx, dy]) => {
      this._dibujarRemache(remaches, dx, dy, 5);
    });
    hijos.splice(3, 0, remaches); // detrás del label, encima de las 3 franjas
  }

  const contenedor = this.add.container(x, y, hijos).setDepth(depth);
  this._sprites.push(contenedor);
  return contenedor;
}

// Muestra/oculta cantoText (resultado de Envido/Flor, "Fulano cantó
// Truco", "X tantos en mesa") con el mismo marco de 3 franjas que
// _crearBannerTexto, pero manejado aparte porque cantoText es un texto
// ÚNICO y persistente que se reusa muchas veces por partida (no un
// sprite efímero que se recrea en cada _renderizarEstado) — el banner de
// imagen se reconstruye detrás de él cada vez que cambia el texto, del
// mismo ancho/alto que ocupe.
_mostrarCanto(texto) {
  this.cantoText.setText(texto).setPosition(400, this._L ? this._L.feltCY : 300).setAlpha(1).setVisible(true);

  if (this.cantoBanner) { this.cantoBanner.destroy(); this.cantoBanner = null; }

  const padX = 26, padY = 14;
  const anchoBanner = Math.max(200, this.cantoText.width + padX * 2);
  const altoBanner = Math.max(40, this.cantoText.height + padY * 2);

  const texIzq = this.textures.get('banner_izq').getSourceImage();
  const texDer = this.textures.get('banner_der').getSourceImage();
  const capW = Math.round(texIzq.width * (altoBanner / texIzq.height));
  const capWDer = Math.round(texDer.width * (altoBanner / texDer.height));
  const midW = Math.max(1, anchoBanner - capW - capWDer);

  const izqCanto = this.add.image(-anchoBanner / 2 + capW / 2, 0, 'banner_izq').setDisplaySize(capW, altoBanner);
  const centroCanto = this.add.image(-anchoBanner / 2 + capW + midW / 2, 0, 'banner_centro').setDisplaySize(midW, altoBanner);
  const derCanto = this.add.image(anchoBanner / 2 - capWDer / 2, 0, 'banner_der').setDisplaySize(capWDer, altoBanner);

  this.cantoBanner = this.add.container(400, this._L ? this._L.feltCY : 300, [izqCanto, centroCanto, derCanto]).setDepth(249);
}

_ocultarCanto() {
  this.cantoText.setVisible(false);
  if (this.cantoBanner) { this.cantoBanner.destroy(); this.cantoBanner = null; }
}

// Como _crearBoton, pero pensado para overlays (pantalla de resultado):
// depth más alto, y devuelve las referencias internas (no solo el
// contenedor) para poder actualizar el texto/color dinámicamente después
// de crearlo — necesario para el botón de "Pedir revancha".
// Nonagésimo sexto pase: `colorFondo`/`colorTexto` (relleno plano +
// borde chocolate de 3px, sin relieve) se reemplazan por `variante`
// ('verde'|'dorado') — en vez de dibujar el botón a mano, se reutilizan
// los MISMOS PNG de botón-píldora-3D (relieve + brillo horneados) que ya
// usa Tienda.js para sus botones de precio. Pedido explícito del
// usuario: "mismo lenguaje de volumen 3D cartoon... para dar simetría y
// peso táctil" entre "Pedir revancha" y "Volver al lobby" — al ser la
// misma función para los dos, la simetría queda garantizada sola.
// Pase 266, punto 3: antes se armaba con UNA sola imagen estirada vía
// `setDisplaySize(ancho, alto)` sobre el PNG completo de la píldora — el
// usuario reportó que esto "achataba/estiraba" el botón porque `ancho`
// cambia según el largo del texto ("Pedir revancha" vs "🏆 Ver bracket")
// mientras la imagen fuente tiene proporciones fijas, lo que deformaba
// las puntas redondeadas. Se reemplaza por el mismo truco de "3 franjas"
// (nine-slice horizontal) que ya usa `_crearBannerTexto` para el cartel
// de madera: cada PNG de píldora quedó cortado en 3 slices (punta
// izquierda / centro liso / punta derecha, ver preload) — ahora solo el
// centro se estira para llenar el ancho que pida el texto, mientras las
// puntas solo se re-escalan en vertical (si `alto` cambia) y mantienen su
// proporción horizontal intacta, sin perder el relieve/brillo horneado
// de los bordes.
_crearBotonOverlay({ x, y, ancho, alto = 44, texto, variante = 'dorado', tamanoFuente = 15, onClick }) {
  const contenedor = this.add.container(x, y).setDepth(902);

  // Pase 409: 'rojo' / 'esmeralda' / 'oro' pasan a tablitas de madera rústica (mismo estilo que
  // la botonera de cantos), conservando el color de cada fondo: rojo → carmesí, esmeralda → verde, oro → dorado.
  if (variante === 'rojo' || variante === 'esmeralda' || variante === 'oro') {
    const vRus = variante === 'rojo' ? 'carmesi' : variante;
    const P = VARIANTES_RUSTICAS[vRus];
    const txt = String(texto).toUpperCase();
    const fs = Math.max(13, tamanoFuente);
    const estiloTxt = { fontFamily: 'Nunito, Arial', fontSize: `${fs}px`, fontStyle: 'bold' };
    const label = this.add.text(0, 0, txt, { ...estiloTxt, color: P.texto, stroke: '#2c160e', strokeThickness: Math.max(2, fs * 0.17) }).setOrigin(0.5);
    const w = Math.max(ancho, label.width + alto * 1.3, 150);
    const hBtn = alto + 6;
    const g = this.add.graphics();
    let dCanto = 0;
    const dibujar = (v) => { g.clear(); dCanto = this._dibujarBotonRustico(g, w, hBtn, v, true); label.setY(-dCanto / 2); };
    dibujar(vRus);
    contenedor.add([g, label]);
    contenedor.setSize(w, hBtn);
    contenedor.setInteractive({ useHandCursor: true });
    contenedor.on('pointerdown', () => {
      this.tweens.add({ targets: contenedor, scale: 0.94, duration: 80, ease: 'Quad.easeOut' });
    });
    contenedor.on('pointerup', () => {
      this.tweens.add({ targets: contenedor, scale: 1, duration: 140, ease: 'Quad.easeOut' });
      onClick();
    });
    contenedor.on('pointerout', () => {
      this.tweens.add({ targets: contenedor, scale: 1, duration: 140, ease: 'Quad.easeOut' });
    });
    this._sprites.push(contenedor);
    return {
      contenedor,
      img: { setTint() { dibujar('apagado'); }, clearTint() { dibujar(vRus); } },
      label,
    };
  }

  // Pase 346: variante 'rojo' (Rojo Carmesí #E74C3C) — píldora plana cel-shaded
  // dibujada por código: borde negro 2px y relieve inferior granate #78281F.
  if (variante === 'rojo') {
    const w = Math.max(ancho, 140);
    const prof = 5;
    const g = this.add.graphics();
    g.fillStyle(0x78281F, 1);
    g.fillRoundedRect(-w / 2, -alto / 2 + prof, w, alto, alto / 2);
    g.lineStyle(2, 0x000000, 1);
    g.strokeRoundedRect(-w / 2, -alto / 2 + prof, w, alto, alto / 2);
    g.fillStyle(0xE74C3C, 1);
    g.fillRoundedRect(-w / 2, -alto / 2, w, alto, alto / 2);
    g.lineStyle(2, 0x000000, 1);
    g.strokeRoundedRect(-w / 2, -alto / 2, w, alto, alto / 2);
    const labelRojo = this.add.text(0, 0, texto, {
      fontFamily: 'Fredoka, Arial', fontSize: `${tamanoFuente}px`, fontStyle: '600',
      color: '#FFFFFF', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    contenedor.add([g, labelRojo]);
    contenedor.setSize(w, alto + prof);
    contenedor.setInteractive({ useHandCursor: true });
    contenedor.on('pointerdown', () => {
      this.tweens.add({ targets: contenedor, scale: 0.94, duration: 80, ease: 'Quad.easeOut' });
    });
    contenedor.on('pointerup', () => {
      this.tweens.add({ targets: contenedor, scale: 1, duration: 140, ease: 'Quad.easeOut' });
      onClick();
    });
    contenedor.on('pointerout', () => {
      this.tweens.add({ targets: contenedor, scale: 1, duration: 140, ease: 'Quad.easeOut' });
    });
    this._sprites.push(contenedor);
    return { contenedor, img: { setTint() {}, clearTint() {} }, label: labelRojo };
  }

  // Pase 391: variantes planas 3D de código — 'esmeralda' (#10B981 / relieve
  // #065F46) y 'oro' (#F5B041 / relieve #B9770E), borde negro 2px.
  if (variante === 'esmeralda' || variante === 'oro') {
    const paleta = variante === 'esmeralda'
      ? { fill: 0x10B981, rel: 0x065F46 }
      : { fill: 0xF5B041, rel: 0xB9770E };
    const w = Math.max(ancho, 150);
    const prof = 5;
    const g = this.add.graphics();
    const dibujar = (fill, rel) => {
      g.clear();
      g.fillStyle(rel, 1);
      g.fillRoundedRect(-w / 2, -alto / 2 + prof, w, alto, alto / 2);
      g.lineStyle(2, 0x000000, 1);
      g.strokeRoundedRect(-w / 2, -alto / 2 + prof, w, alto, alto / 2);
      g.fillStyle(fill, 1);
      g.fillRoundedRect(-w / 2, -alto / 2, w, alto, alto / 2);
      g.fillStyle(0xFFFFFF, 0.22);                       // brillo superior
      g.fillRoundedRect(-w / 2 + 10, -alto / 2 + 4, w - 20, alto * 0.28, alto * 0.14);
      g.lineStyle(2, 0x000000, 1);
      g.strokeRoundedRect(-w / 2, -alto / 2, w, alto, alto / 2);
    };
    dibujar(paleta.fill, paleta.rel);
    const labelPlano = this.add.text(0, 0, texto, {
      fontFamily: 'Fredoka, Arial', fontSize: `${tamanoFuente}px`, fontStyle: '600',
      color: '#FFFFFF', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
    contenedor.add([g, labelPlano]);
    contenedor.setSize(w, alto + prof);
    contenedor.setInteractive({ useHandCursor: true });
    contenedor.on('pointerdown', () => {
      this.tweens.add({ targets: contenedor, scale: 0.94, duration: 80, ease: 'Quad.easeOut' });
    });
    contenedor.on('pointerup', () => {
      this.tweens.add({ targets: contenedor, scale: 1, duration: 140, ease: 'Quad.easeOut' });
      onClick();
    });
    contenedor.on('pointerout', () => {
      this.tweens.add({ targets: contenedor, scale: 1, duration: 140, ease: 'Quad.easeOut' });
    });
    this._sprites.push(contenedor);
    return {
      contenedor,
      img: {
        setTint() { dibujar(0x9AA39E, 0x5F6B66); },
        clearTint() { dibujar(paleta.fill, paleta.rel); },
      },
      label: labelPlano,
    };
  }

  const prefijo = variante === 'verde' ? 'botonVerde' : 'botonAmarillo';
  const texIzq = this.textures.get(`${prefijo}Izq`).getSourceImage();
  const texDer = this.textures.get(`${prefijo}Der`).getSourceImage();
  // Las puntas se escalan solo según `alto` (mantienen su ancho nativo
  // proporcional, no se estiran horizontalmente) — mismo cálculo que
  // `capW`/`capWDer` en `_crearBannerTexto`.
  const capIzq = Math.round(texIzq.width * (alto / texIzq.height));
  const capDer = Math.round(texDer.width * (alto / texDer.height));
  // Ancho mínimo para que las dos puntas no terminen pegadas sin tramo
  // recto en el medio — eso degenera en una forma de "ojo/almendra" en
  // vez de píldora (pasa si `ancho` pedido es menor que la suma de las
  // dos puntas, caso límite con textos muy cortos).
  const anchoSeguro = Math.max(ancho, capIzq + capDer + 20);
  const midW = anchoSeguro - capIzq - capDer;

  // Ducentésimo septuagésimo segundo pase: mismo fix de costura que
  // `_crearBoton` (rama 'Tengo') — `imgCentro` se dibuja un poco más
  // ancho de lo necesario, solapándose por DEBAJO de `imgDer` (que se
  // agrega después, encima), para tapar la línea de 1px que WebGL deja
  // ver en el límite entre dos texturas separadas puestas borde a borde.
  const SOLAPE_COSTURA = 3;

  const imgIzq = this.add.image(-anchoSeguro / 2 + capIzq / 2, 0, `${prefijo}Izq`).setDisplaySize(capIzq, alto);
  const imgCentro = this.add.image(-anchoSeguro / 2 + capIzq + midW / 2 + SOLAPE_COSTURA / 2, 0, `${prefijo}Centro`).setDisplaySize(midW + SOLAPE_COSTURA, alto);
  const imgDer = this.add.image(anchoSeguro / 2 - capDer / 2, 0, `${prefijo}Der`).setDisplaySize(capDer, alto);

  // Mismos colores de texto que ya usa Tienda.js para cada variante
  // (chocolate sobre el amarillo, blanco sobre el verde) — el contorno
  // negro en el verde es un agregado puntual pedido para ESTE botón
  // ("tipografía blanca bold con contorno negro"), Tienda.js no lo usa.
  const colorTexto = variante === 'verde' ? '#FFFFFF' : '#4A2C2A';
  const label = this.add.text(0, 0, texto, {
    fontFamily: 'Fredoka, Arial',
    fontSize: `${tamanoFuente}px`,
    fontStyle: '600',
    color: colorTexto,
    ...(variante === 'verde' ? { stroke: '#000000', strokeThickness: 3 } : {}),
  }).setOrigin(0.5);

  contenedor.add([imgIzq, imgCentro, imgDer, label]);
  contenedor.setSize(anchoSeguro, alto);
  contenedor.setInteractive({ useHandCursor: true });

  // `imgRevancha` (ver _mostrarPantallaFinal) necesita poder atenuar el
  // botón con `.setTint(...)` cuando se agota el tiempo de revancha
  // (pase 265) — ahora que son 3 imágenes en vez de 1, se devuelve esta
  // fachada liviana que reenvía `setTint` a las 3 por igual, para no
  // tener que tocar `_mostrarAlertaRevancha`.
  const img = {
    setTint: (color) => { imgIzq.setTint(color); imgCentro.setTint(color); imgDer.setTint(color); },
    clearTint: () => { imgIzq.clearTint(); imgCentro.clearTint(); imgDer.clearTint(); },
  };

  contenedor.on('pointerdown', () => {
    this.tweens.add({ targets: contenedor, scale: 0.94, duration: 80, ease: 'Quad.easeOut' });
  });
  contenedor.on('pointerup', () => {
    this.tweens.add({ targets: contenedor, scale: 1, duration: 140, ease: 'Quad.easeOut' });
    onClick();
  });
  contenedor.on('pointerout', () => {
    this.tweens.add({ targets: contenedor, scale: 1, duration: 140, ease: 'Quad.easeOut' });
  });

  this._sprites.push(contenedor);
  return { contenedor, img, label };
}

_dibujarBotonesCanto(e) {
  const CENTRO_X = 400;
  const GAP = 30;
  // Pase 443: en equipos va el botón circular de cartas a la derecha de la botonera; las filas
  // dejan libre ese margen y Truco / Ir al mazo pierden un 15% de ancho.
  const esEq = Array.isArray(e.companeros);
  if (esEq) this._dibujarBotonCartasEquipo(e);
  const F_ANCHO_EQ = esEq ? 0.85 : 1;

  // Nonagésimo séptimo pase (resumen histórico — ver el pase 269 más abajo
  // para el esquema actual): el usuario pidió que el TAMAÑO no cambiara de
  // mano en mano según cuántos botones hubiera, y de ahí salió un
  // ANCHO_BOTON_FIJO único para todos. Ducentésimo sexagésimo noveno pase:
  // ese ancho único (76px) resultó mucho más angosto que el dibujo real de
  // estos PNG (aspecto ~2.0-2.1, ver abajo) y los deformaba (puntas
  // "aplastadas") — se mantiene la altura fija (ALTO_BOTON_FIJO), pero el
  // ancho vuelve a salir del aspecto real de cada archivo.
  const ALTO_BOTON_FIJO = 44;

  // Ducentésimo sexagésimo noveno pase: el usuario reportó que los botones
  // se ven "aplastados" (las puntas redondeadas de la píldora pierden su
  // curva) — causa real: cada PNG de este set mide ~248×118/120/125 (aspecto
  // real ≈2.0-2.1) pero `ANCHO_BOTON_FIJO=76` los forzaba a un cajón de
  // aspecto 76/44≈1.73, bastante más angosto que el dibujo original, así
  // que CADA botón se estiraba de forma no uniforme (ver `_crearBoton`,
  // `setDisplaySize`) para entrar ahí. No se puede arreglar con Nine-Slice
  // "clásico" (estirar solo el centro) como pidió el usuario porque estos
  // PNG tienen el TEXTO horneado por el diseñador de punta a punta de la
  // imagen (ver comentario de CLAVE_IMAGEN_BOTON más arriba) — estirar el
  // centro deformaría el texto exactamente igual que ahora. La solución
  // real es no forzar ningún ancho fijo: cada botón mide su propio ancho a
  // partir de SU proporción real de archivo (ver `_anchoBotonImagen`,
  // existía pero no se usaba acá desde el pase 97) a una altura fija común
  // — eso es lo que saca el achatamiento sin generar el problema que el
  // pase 97 vino a resolver (ahí el reclamo era que el TAMAÑO DE TODOS
  // LOS BOTONES cambiaba de mano en mano, por una fila que se reajustaba
  // dinámicamente al ancho disponible cada vez según cuántos botones
  // hubiera). Esto es distinto: el ancho de CADA botón es siempre una
  // función fija de SU PROPIO archivo (nunca de la cantidad de hermanos en
  // la fila), así que el mismo botón mide siempre lo mismo en cualquier
  // fila donde aparezca — `centrarFila`, más abajo, solo interviene con un
  // freno de emergencia (reducir TODOS por igual, nunca solo uno) si la
  // fila con más botones a la vez no entrara a ancho nativo.
  // Pase 394: en layout angosto los botones crecen (la botonera es mas ancha).
  const kB0 = this._L ? this._L.kBoton : 1;
  const kB = kB0;
  const centrarFila = (specs, y, gap = GAP, extraK = 1) => {
    const kB = kB0 * extraK;   // Pase 396: escala extra opcional por fila (botonera en dos filas)
    const anchoNatural = (specs.reduce((acc, s) => acc + s.ancho, 0) + gap * (specs.length - 1)) * kB;
    const anchoDisponible = this.anchoBotonera - 40 - (esEq && !this._L ? 111 : 0);
    // Freno de emergencia: la única fila donde el ancho nativo de verdad no
    // entra es la fusionada de 5 (Truco+Envido+RealEnvido+FaltaEnvido+
    // IrAlMazo, gap 8 — ver pase 97). Si no entra, se achica TODA la fila
    // (ancho Y alto por igual, nunca solo el ancho) por el mismo factor fijo
    // — a diferencia de `filaAjustadaAlAncho` (el mecanismo viejo que el
    // pase 97 sacó), esto no se recalcula "para llenar el espacio" en cada
    // fila: en las filas de 2/3/4 botones (que ya entran de sobra a su
    // ancho nativo) el factor es siempre 1, nunca se activa, así que esos
    // botones miden siempre lo mismo sin importar la mano.
    const factor = anchoNatural > anchoDisponible ? anchoDisponible / anchoNatural : 1;
    const gapFinal = gap * factor * kB;
    const anchoTotal = anchoNatural * factor;
    let cursorX = CENTRO_X - anchoTotal / 2;
    specs.forEach((s) => {
      const anchoFinal = s.ancho * factor * kB;
      const altoFinal = s.alto * factor * kB;
      cursorX += anchoFinal / 2;
      this._crearBoton({ ...s, ancho: anchoFinal, alto: altoFinal, x: cursorX, y });
      cursorX += anchoFinal / 2 + gapFinal;
    });
  };

  // Spec de un botón-imagen (rediseño Canva, Fase 2): a partir del id
  // semántico interno (ej. 'quiero', 'real-envido') resuelve la clave de
  // archivo vía CLAVE_IMAGEN_BOTON. Ducentésimo sexagésimo noveno pase:
  // vuelve a calcular el ancho a partir del aspecto real del PNG (ver
  // `_anchoBotonImagen` y el comentario de `centrarFila` arriba) en vez de
  // un ANCHO_BOTON_FIJO único — el alto sigue siendo siempre el mismo
  // (ALTO_BOTON_FIJO), eso no cambió.
  // Vigésimo octavo pase: el halo dorado detrás de Truco/Retruco/Vale Cuatro
  // (agregado en el decimonoveno pase) se sacó a pedido del usuario — quedó
  // el parámetro `opciones` genérico por si hace falta pasar algo más a
  // futuro, pero ya no se usa para destacar nada.
  const specImagen = (idSemantico, onClick, opciones = {}) => {
    const clave = CLAVE_IMAGEN_BOTON[idSemantico];
    // Pase 406: la placa del Truco (y Retruco/Vale Cuatro) es 1.3x más grande — jerarquía visual.
    const altoB = (BOTON_RUSTICO[clave] && BOTON_RUSTICO[clave].v === 'oro') ? Math.round(ALTO_BOTON_FIJO * 1.3) : ALTO_BOTON_FIJO;
    return { alto: altoB, imagen: clave, ancho: this._anchoBotonImagen(clave, altoB), onClick, ...opciones };
  };

  // Ducentésimo sexagésimo noveno pase: `yCentroBotonera` (ver create()) es
  // el centro vertical REAL de la placa de madera (hoy 565, a partir de su
  // alto real de 130px) — reemplaza los números sueltos 550/525/575 que
  // quedaron pegados a la placa vieja de 100px (pase 73, antes de que el
  // pase 92 agrandara la placa sin tocar estos números), causa real del
  // "los botones quedaron corridos hacia arriba" reportado por el usuario.
  const Y_FILA_UNICA = this.yCentroBotonera;
  const GAP_FILAS = 6;
  const OFFSET_FILAS = ((ALTO_BOTON_FIJO + GAP_FILAS) / 2) * kB;
  const Y_FILA_SUPERIOR = Y_FILA_UNICA - OFFSET_FILAS;
  const Y_FILA_INFERIOR = Y_FILA_UNICA + OFFSET_FILAS;

  // Botones de respuesta a un Envido pendiente (Quiero/No quiero/subir).
  // Se usa desde la rama normal (nadie más tiene nada pendiente) Y desde
  // dentro de la rama de Truco pendiente, para el caso en que interrumpí
  // ese Truco con un Envido y el rival lo subió — ver comentario más abajo.
  const dibujarRespuestaEnvido = () => {
    const ENVIDO_NIVELES = ['envido', 'real-envido', 'falta-envido'];
    const idxActual = ENVIDO_NIVELES.indexOf(e.envido.tipo);
    const nivelesDisponibles = ENVIDO_NIVELES.slice(idxActual + 1);

    const specs = [
      specImagen('quiero', () => this._responderEnvido('quiero')),
      specImagen('no-quiero', () => this._responderEnvido('no-quiero')),
    ];
    nivelesDisponibles.forEach(nivel => {
      specs.push(specImagen(nivel, () => this._subirEnvido(nivel)));
    });
    // Esta fila nunca convive con otra fila de botones (siempre es la única
    // que se muestra en pantalla) — mismo tamaño fijo que el resto, no hace
    // falta nada especial por tener de sobra la banda vertical para ella sola.
    // Ducentésimo sexagésimo noveno pase: Y_FILA_UNICA (centro real de la
    // placa, hoy 565) reemplaza el 550 viejo — ver comentario junto a su
    // definición más arriba.
    centrarFila(specs, Y_FILA_UNICA);
  };

  if (e.flor.pendienteDeRespuesta) {
    const nombreNivelFlor = { 'flor': 'FLOR', 'contra-flor': 'CONTRA FLOR', 'contra-flor-resto': 'CONTRA FLOR AL RESTO' };
    this._crearBannerTexto(400, 491, `${nombreNivelFlor[e.flor.nivel]}: ¿Querés?`);

    const NIVELES_FLOR = ['flor', 'contra-flor', 'contra-flor-resto'];
    const idxActualFlor = NIVELES_FLOR.indexOf(e.flor.nivel);
    const nivelesDisponiblesFlor = NIVELES_FLOR.slice(idxActualFlor + 1);

    const specsFlor = [
      specImagen('quiero', () => this._responderFlor('quiero')),
      specImagen('con-flor-me-achico', () => this._responderFlor('no-quiero')),
    ];
    nivelesDisponiblesFlor.forEach(nivel => {
      specsFlor.push(specImagen(nivel, () => this._subirFlor(nivel)));
    });
    // Fila sin competencia (única que se muestra), mismo tamaño fijo que
    // el resto. Ducentésimo sexagésimo noveno pase: Y_FILA_UNICA en vez de
    // 550 — ver comentario completo en dibujarRespuestaEnvido.
    centrarFila(specsFlor, Y_FILA_UNICA);
    return;
  }

  if (e.declaracionEnvido) {
    if (!e.declaracionEnvido.esMiTurno) {
      this._crearBannerTexto(400, 491, 'Esperando que declaren su envido...');
      return;
    }

    const max = e.declaracionEnvido.maximoDeclarado.puntos;
    const textoPregunta = max === -1
      ? '¿Cuánto tenés?'
      : `Van ${max}. ¿Tenés más?`;

    this._crearBannerTexto(400, 491, textoPregunta);

    const specs = [
      specImagen('son-buenas', () => this._declararSonBuenas()),
    ];
    if (e.declaracionEnvido.puedoMostrar) {
      // Octogésimo sexto pase: mismo fondo ilustrado que el resto (la
      // tablita en blanco de "Quiero", ver Tengo.png) con el número
      // dibujado encima — el número cambia en cada mano, no puede ser una
      // imagen fija horneada por el diseñador. Nonagésimo séptimo pase: el
      // alto pasa a ALTO_BOTON_FIJO (alinea con "Son buenas", misma fila).
      // Ducentésimo septuagésimo pase: el ancho fijo de 130 (pensado para
      // el peor caso "Tengo 33") hacía que la píldora se viera siempre
      // estirada de más con puntajes de un dígito ("Tengo 7") — el usuario
      // lo reportó como "el botón cambia de tamaño y queda estirado" al
      // variar el texto. Ahora la tablita de fondo es de 3 franjas
      // (tengoIzq/tengoCentro/tengoDer, recortadas de la misma imagen que
      // mandó el usuario — es un fondo liso sin texto horneado, así que acá
      // SÍ se puede estirar solo el tramo recto del medio sin deformar nada,
      // a diferencia de Quiero/Truco/etc.) y el ancho sale de medir el
      // texto real (`_anchoBotonTengo`) en vez de un número fijo — la
      // píldora siempre queda ajustada a su propio número, nunca más ancha
      // de lo necesario.
      const textoTengo = `Tengo ${e.declaracionEnvido.misPuntos}`;
      const tamanoFuenteTengo = 14;
      const anchoTengo = this._anchoBotonTengo(textoTengo, tamanoFuenteTengo, ALTO_BOTON_FIJO);
      specs.push({ ancho: anchoTengo, alto: ALTO_BOTON_FIJO, tamanoFuente: tamanoFuenteTengo, imagen: 'Tengo', colorTexto: '#FFFFFF', texto: textoTengo, onClick: () => this._declararMostrar() });
    }
    // Fila sin competencia (única que se muestra), mismo criterio de arriba.
    // Ducentésimo sexagésimo noveno pase: Y_FILA_UNICA, mismo motivo.
    centrarFila(specs, Y_FILA_UNICA);
    return;
  }

  if (e.truco.pendienteDeRespuesta) {
    const hayFlorSinResolver = e.flor.nivel && !e.flor.resuelto;
    const hayEnvidoSinResolver = e.envido.tipo && !e.envido.resuelto;

    // Si el Envido pendiente es el MÍO para responder (por ejemplo: mi
    // equipo interrumpió este Truco con un Envido, y ahora el rival lo
    // subió a Real/Falta Envido), NO corresponde el cartel de "esperá" —
    // eso me dejaba trabado sin poder responder nada ni jugar carta. En
    // ese caso muestro los botones de respuesta del Envido acá mismo,
    // igual que se mostrarían si el Truco no estuviera de por medio.
    if (hayEnvidoSinResolver && e.envido.pendienteDeRespuesta) {
      dibujarRespuestaEnvido();
      return;
    }

    if (hayFlorSinResolver || hayEnvidoSinResolver) {
      const mensaje = hayFlorSinResolver
        ? 'Hay una Flor pendiente de resolver antes de seguir con el Truco'
        : 'Hay un Envido pendiente de resolver antes de seguir con el Truco';
      this._crearBannerTexto(400, 491, mensaje);
      return;
    }

    const puedeCantarEnvido = e.etapa === 'envido' && !e.envido.tipo && !e.florYaCantada && !e.tengoFlor;
    const puedeCantarFlorAca = e.tengoFlor && e.etapa === 'envido' && !e.florYaCantada && !e.flor.nivel;
    const nombreNivel = e.truco.nivel.replace('-', ' ').toUpperCase();

    // El cartel del nivel ("RETRUCO: ¿Querés?", etc.) se muestra siempre que te
    // toca responder el Truco, tengas o no además la opción de cantar Envido —
    // antes se ocultaba cuando aparecía la fila de Envido, dejando esa pantalla
    // sin ninguna indicación de a qué nivel estabas respondiendo.
    this._crearBannerTexto(400, puedeCantarEnvido ? 479 : 491, `${nombreNivel}: ¿Querés?`);

    // Zona de botones: 500 (línea divisoria) a 600 (borde del canvas) =
    // 100px. Nonagésimo séptimo pase: las dos filas (Envido chica arriba,
    // respuesta principal abajo) pasaron a compartir el mismo
    // ALTO_BOTON_FIJO (antes 28 arriba / 52 abajo, dos tamaños distintos,
    // justo lo que el usuario pidió sacar) — con 3px de margen arriba, 6px
    // de aire entre filas y 3px de margen abajo entran justo las dos:
    // 3+44+6+44+3 = 100.
    if (puedeCantarEnvido) {
      // Nonagésimo primer pase: separación 9px entre los 3 amarillos de
      // tanto, pedido explícito del usuario (8-10px) en vez del GAP
      // general de 30 que usa el resto de las filas.
      centrarFila([
        specImagen('envido', () => this._cantarEnvido('envido')),
        specImagen('real-envido', () => this._cantarEnvido('real-envido')),
        specImagen('falta-envido', () => this._cantarEnvido('falta-envido')),
      ], Y_FILA_SUPERIOR, 9);
    }

    const specs = [
      specImagen('quiero', () => this._responderTruco('quiero')),
      specImagen('no-quiero', () => this._responderTruco('no-quiero')),
    ];
    if (e.truco.nivel !== 'vale-cuatro') {
      specs.push(specImagen(proximoNivelTruco(e.truco.nivel), () => this._cantarTruco()));
    }
    if (puedeCantarFlorAca) {
      specs.push(specImagen('flor', () => this._cantarFlor()));
    }
    // Ducentésimo sexagésimo noveno pase: Y_FILA_INFERIOR (antes 575) solo
    // tiene sentido cuando la fila de Envido chica de arriba (Y_FILA_SUPERIOR,
    // antes 525) también está — juntas quedan centradas en la placa real
    // (Y_FILA_UNICA ± OFFSET_FILAS, ver definición más arriba). Pero
    // `puedeCantarEnvido` puede ser false (ya no se puede cantar Envido en
    // esta mano) y ahí esta fila queda SOLA en toda la banda — sin
    // competencia, usa directamente el centro real Y_FILA_UNICA.
    centrarFila(specs, puedeCantarEnvido ? Y_FILA_INFERIOR : Y_FILA_UNICA);

  } else if (e.envido.pendienteDeRespuesta) {
    dibujarRespuestaEnvido();

  } else {
    const puedoCantarFlor = e.tengoFlor && e.etapa === 'envido' && !e.florYaCantada && !e.flor.nivel && e.turno === 'mio';
    const hayCantoPropioPendiente =
      (!!e.truco.nivel && !e.truco.resuelto) ||
      (!!e.envido.tipo && !e.envido.resuelto) ||
      (!!e.flor.nivel && !e.flor.resuelto);
    const hayEnvido = e.etapa === 'envido' && !e.envido.tipo && e.turno === 'mio' && !e.florYaCantada && !e.tengoFlor && !hayCantoPropioPendiente;
    const hayFlorPendiente = e.flor.pendienteDeRespuesta;
    const esEquiposActual = Array.isArray(e.companeros);
    const yaCante = esEquiposActual ? e.truco.cantadoPorMiEquipo : e.truco.cantadoPorMi;

    // Nonagésimo segundo pase: fila fusionada (Truco, Envido, Real Envido,
    // Falta Envido, Ir al mazo — Flor en vez de Truco si corresponde),
    // gap:8px. Nonagésimo séptimo pase: se sacó `filaAjustadaAlAncho` (el
    // alto ya no se resolvía según cuántos botones entraban, que era
    // justo el comportamiento que el usuario pidió sacar) y el +6 de
    // jerarquía que tenía Truco — ahora cada item mapea derecho a
    // `specImagen`, con el mismo ANCHO_BOTON_FIJO/ALTO_BOTON_FIJO que usa
    // toda la botonera, Truco incluido.
    const itemsFila = [];
    if (puedoCantarFlor && !hayCantoPropioPendiente) {
      itemsFila.push({ id: 'flor', onClick: () => this._cantarFlor() });
    }
    if (e.truco.nivel !== 'vale-cuatro' && !yaCante && e.turno === 'mio' && !hayFlorPendiente && !hayCantoPropioPendiente) {
      itemsFila.push({ id: proximoNivelTruco(e.truco.nivel), onClick: () => this._cantarTruco() });
    }
    if (hayEnvido) {
      itemsFila.push({ id: 'envido', onClick: () => this._cantarEnvido('envido') });
      itemsFila.push({ id: 'real-envido', onClick: () => this._cantarEnvido('real-envido') });
      itemsFila.push({ id: 'falta-envido', onClick: () => this._cantarEnvido('falta-envido') });
    }
    if (e.turno === 'mio' && !hayFlorPendiente && !hayCantoPropioPendiente) {
      itemsFila.push({ id: 'ir-al-mazo', onClick: () => this._irseAlMazo() });
    }
    // Centro vertical de la fila: dentro del panel agrandado (borde
    // superior fijo en Y=500, ver create()), con margen seguro contra el
    // límite duro de Y=600 (nada calculado más allá de ese borde se ve, ver
    // Metodología) — con el tamaño ya fijo (ver arriba) no hace falta nada
    // extra para evitar que la fila crezca de más con pocos botones.
    const specsFila = itemsFila.map(it => { const sp = specImagen(it.id, it.onClick); return (it.id === 'envido' || it.id === 'real-envido' || it.id === 'falta-envido') ? sp : { ...sp, ancho: sp.ancho * F_ANCHO_EQ }; });
    // Pase 396 (layout angosto): botonera "piramide" como en el nativo — arriba
    // los tres cantos de tanto (Envido / Real Envido / Falta Envido), abajo
    // Truco (mas grande) + Ir al Mazo. Si no hay Envido, queda una sola fila.
    // Pase 408: la pirámide de 2 filas se usa SIEMPRE (también en escritorio), nunca una sola fila larga.
    if (hayEnvido && itemsFila.length > 3) {
      const ids = ['envido', 'real-envido', 'falta-envido'];
      const K2 = this._L ? 1.22 : 1;
      const altoArriba = this._L ? 34 : 32, altoAbajo = this._L ? 44 : 38;
      const filaArriba = itemsFila.filter(it => ids.includes(it.id))
        .map(it => { const sp = specImagen(it.id, it.onClick); const c = CLAVE_IMAGEN_BOTON[it.id]; return { ...sp, alto: altoArriba, ancho: this._anchoBotonImagen(c, altoArriba) }; });
      const filaAbajo = itemsFila.filter(it => !ids.includes(it.id))
        .map(it => { const sp = specImagen(it.id, it.onClick); const esTruco = it.id !== 'ir-al-mazo'; const h = esTruco ? Math.round(altoAbajo * 1.3) : altoAbajo; const c = CLAVE_IMAGEN_BOTON[it.id]; return { ...sp, alto: h, ancho: this._anchoBotonImagen(c, h) * F_ANCHO_EQ }; });
      const kk = kB0 * K2;
      const sep = 8 * kk;
      const hA = altoArriba * kk, hB = Math.round(altoAbajo * 1.3) * kk;
      let yTop = Y_FILA_UNICA + 10 - (hB + sep) / 2;
      let yBot = Y_FILA_UNICA + 10 + (hA + sep) / 2;
      if (!this._L) {
        // Escritorio: la zona útil de la placa va de Y≈511 a 598 (el mundo termina en 600).
        const sepD = 5, tope = 511;
        yTop = tope + hA / 2;
        yBot = tope + hA + sepD + hB / 2;
      }
      centrarFila(filaArriba, yTop, this._L ? 9 : 14, K2);
      centrarFila(filaAbajo, yBot, this._L ? 22 : 30, K2);
      return;
    }
    // Ducentésimo sexagésimo noveno pase: Y_FILA_UNICA en vez del 565 suelto
    // (coincidía por casualidad con el centro real de la placa — ahora es
    // la misma constante que usan todas las demás filas, en vez de un
    // número que había que mantener sincronizado a mano con `yBotonera`).
    centrarFila(specsFila, Y_FILA_UNICA, 8);
  }
}

// Pase 443: botón circular de "mostrar / esconder mis cartas" (equipos), dibujado en la propia botonera,
// a la derecha de la fila de abajo. Antes era un botón de React flotando en una esquina (tapaba el
// marcador). Los íconos de seña se dibujan en canvas con los mismos trazos que usaba el SVG.
_crearTexturasSenas() {
  if (this.textures.exists('senaOcultar') && this.textures.exists('senaMostrar')) return;
  const hacer = (clave, color, dibujar) => {
    const cv = document.createElement('canvas');
    cv.width = 112; cv.height = 112;
    const ctx = cv.getContext('2d');
    ctx.scale(4, 4);
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    dibujar(ctx);
    this.textures.addCanvas(clave, cv);
  };
  const trazo = (ctx, d, lw) => { ctx.lineWidth = lw; ctx.stroke(new Path2D(d)); };
  hacer('senaOcultar', '#FFF3D2', (ctx) => {
    trazo(ctx, 'M4 12 Q14 20 24 12', 2.4);
    trazo(ctx, 'M7 16.2 L5.2 19', 2.4);
    trazo(ctx, 'M14 18 L14 21.2', 2.4);
    trazo(ctx, 'M21 16.2 L22.8 19', 2.4);
    trazo(ctx, 'M5 7.5 Q14 3 23 7.5', 2);
  });
  hacer('senaMostrar', '#3B1F08', (ctx) => {
    trazo(ctx, 'M3 15 Q14 5 25 15 Q14 25 3 15 Z', 2.2);
    ctx.beginPath(); ctx.arc(14, 15, 4.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFF8E1'; ctx.beginPath(); ctx.arc(15.6, 13.4, 1.5, 0, Math.PI * 2); ctx.fill();
    trazo(ctx, 'M6 7.6 Q13 1.6 22 5.4', 2);
    trazo(ctx, 'M24.5 3 L24.5 6.5 M22.8 4.8 L26.2 4.8', 1.6);
  });
}

// Pase 539: botón de seña con el diseño del nativo (BotonCartasMesa de juego.tsx): sombra, aro de bronce con bisel, cara de madera
// barnizada, luces curvas, 4 remaches y carita (guiño = escondo mis cartas; dos ojos = las muestro). Mismo viewBox 44x47 del SVG.
_crearTexturasBotonSena() {
  if (this.textures.exists('senaBtnOff') && this.textures.exists('senaBtnOn')) return;
  const ESC = 4;
  const hacer = (clave, activo) => {
    const cv = document.createElement('canvas');
    cv.width = 44 * ESC; cv.height = 47 * ESC;
    const ctx = cv.getContext('2d');
    ctx.scale(ESC, ESC);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const grad = (cx, cy, r, x1, y1, x2, y2, paradas) => {
      const g = ctx.createLinearGradient(cx - r + x1 * 2 * r, cy - r + y1 * 2 * r, cx - r + x2 * 2 * r, cy - r + y2 * 2 * r);
      paradas.forEach(([o, c]) => g.addColorStop(o, c));
      return g;
    };
    const disco = (cx, cy, r, relleno, borde, ancho) => {
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = relleno; ctx.fill();
      if (borde) { ctx.lineWidth = ancho; ctx.strokeStyle = borde; ctx.stroke(); }
    };
    // sombra inferior
    disco(22, 25, 21, 'rgba(0,0,0,0.38)');
    // aro de bronce con bisel
    disco(22, 22, 21, grad(22, 22, 21, 0.15, 0, 0.85, 1, activo
      ? [[0, '#FFEDB0'], [0.5, '#F0B93E'], [1, '#8C5A0C']]
      : [[0, '#F3D58A'], [0.5, '#C58B34'], [1, '#6E4210']]), '#3A1F08', 1.3);
    // cara de madera barnizada
    disco(22, 22, 16.6, grad(22, 22, 16.6, 0.2, 0, 0.8, 1, activo
      ? [[0, '#F5C45A'], [0.55, '#D9951F'], [1, '#9A5F0E']]
      : [[0, '#C98F58'], [0.55, '#A06A38'], [1, '#6F4521']]), '#3A1F08', 1);
    // luz curva arriba-izquierda y sombra curva abajo-derecha
    ctx.lineWidth = 1.4; ctx.strokeStyle = 'rgba(255,236,190,0.55)'; ctx.stroke(new Path2D('M7.7 16.8 A15.2 15.2 0 0 1 25.9 7.3'));
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(40,20,5,0.35)'; ctx.stroke(new Path2D('M36.3 27.2 A15.2 15.2 0 0 1 18.1 36.7'));
    // 4 remaches
    [[8.7, 8.7], [35.3, 8.7], [8.7, 35.3], [35.3, 35.3]].forEach(([x, y]) => {
      disco(x, y, 1.8, '#E8C16A', '#4A2A0C', 0.7);
      disco(x - 0.5, y - 0.55, 0.6, '#FFF3CC');
    });
    // carita (28x28 trasladada a 8,8)
    ctx.save(); ctx.translate(8, 8);
    const tinta = '#4A2A0C';
    disco(14.7, 15.4, 11.2, 'rgba(40,18,4,0.55)');
    disco(14, 14, 11.2, grad(14, 14, 11.2, 0.3, 0, 0.7, 1, [[0, '#FFF4D0'], [0.55, '#F1CF86'], [1, '#D9A64A']]), '#6B3F12', 1.1);
    ctx.beginPath(); ctx.ellipse(10.6, 7.4, 5, 2.2, 0, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.38)'; ctx.fill();
    ctx.fillStyle = tinta;
    ctx.beginPath(); ctx.ellipse(9.6, 12, 1.6, 2.05, 0, 0, Math.PI * 2); ctx.fill();
    if (activo) { ctx.beginPath(); ctx.ellipse(18.4, 12, 1.6, 2.05, 0, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.lineWidth = 1.9; ctx.strokeStyle = tinta; ctx.stroke(new Path2D('M15.4 12.7 Q17.9 9.8 20.4 12.7')); }
    ctx.lineWidth = 2; ctx.strokeStyle = tinta; ctx.stroke(new Path2D('M8.6 16.5 Q14 21.9 19.7 16.3'));
    ctx.restore();
    this.textures.addCanvas(clave, cv);
  };
  hacer('senaBtnOff', false);
  hacer('senaBtnOn', true);
}

_dibujarBotonCartasEquipo(e) {
  if (!this._anchoPanelBotonera) return;
  this._crearTexturasBotonSena();
  const kB0 = this._L ? this._L.kBoton : 1;
  const d = Math.round(44 * kB0);
  const x = 400 + this._anchoPanelBotonera / 2 - 46 * kB0;
  const y = this.yCentroBotonera + (this._L ? 14 : 8);
  const activo = !!e.compartiendoMiMano;
  const r = d / 2;

  // Pase 539: una sola imagen con el diseño del nativo (el círculo del SVG de 44x47 está centrado en (22,22): la imagen baja 1.5 u).
  const esc = d / 44;
  const g = this.add.image(x, y + 1.5 * esc, activo ? 'senaBtnOn' : 'senaBtnOff').setDisplaySize(44 * esc, 47 * esc).setDepth(200);
  const velo = this.add.graphics().setDepth(202);
  velo.fillStyle(0x000000, 1);
  velo.fillCircle(x, y, r);
  velo.setAlpha(0);
  this._veloCartas = velo;
  const zona = this.add.zone(x, y, d, d).setDepth(203).setInteractive({ useHandCursor: true });
  zona.on('pointerdown', () => this._alternarCompartirMano());
  this._sprites.push(g, velo, zona);

  const restante = (this._cartasCooldownHasta || 0) - Date.now();
  if (restante > 0) this._animarVeloCartas(restante);
}

_animarVeloCartas(ms) {
  const velo = this._veloCartas;
  if (!velo || !velo.scene) return;
  if (this._tweenVeloCartas) { try { this._tweenVeloCartas.stop(); } catch (err) {} }
  velo.setAlpha(0.62);
  this._tweenVeloCartas = this.tweens.add({ targets: velo, alpha: 0, duration: ms, ease: 'Linear' });
}

_alternarCompartirMano() {
  // Enfriamiento de 3 s (antispam, mismo criterio que el botón de React que reemplaza).
  if (Date.now() < (this._cartasCooldownHasta || 0)) return;
  this._cartasCooldownHasta = Date.now() + 3000;
  this.socket.emit('alternar-compartir-mano', { codigoSala: this.codigoSala });
  this._animarVeloCartas(3000);
}

_declararSonBuenas() {
  this.socket.emit('declarar-envido-son-buenas', { codigoSala: this.codigoSala });
}
_subirEnvido(tipoEnvido) {
  this.socket.emit('subir-envido', { codigoSala: this.codigoSala, tipoEnvido });
}
_declararMostrar() {
  this.socket.emit('declarar-envido-mostrar', { codigoSala: this.codigoSala });
}

_cantarFlor() {
  this.socket.emit('cantar-flor', { codigoSala: this.codigoSala });
}
_subirFlor(nivel) {
  this.socket.emit('subir-flor', { codigoSala: this.codigoSala, nivel });
}
_responderFlor(respuesta) {
  this.socket.emit('responder-flor', { codigoSala: this.codigoSala, respuesta });
}

_irseAlMazo() {
  this.socket.emit('irse-al-mazo', { codigoSala: this.codigoSala });
}

  _cantarTruco() {
    this.socket.emit('cantar-truco', { codigoSala: this.codigoSala });
  }
  _responderTruco(respuesta) {
    this.socket.emit('responder-truco', { codigoSala: this.codigoSala, respuesta });
  }
  _cantarEnvido(tipoEnvido) {
    this.socket.emit('cantar-envido', { codigoSala: this.codigoSala, tipoEnvido });
  }
  _responderEnvido(respuesta) {
    this.socket.emit('responder-envido', { codigoSala: this.codigoSala, respuesta });
  }

  _limpiarSprites() {
    // Pase 391: frena los tweens infinitos de la pantalla final (rayos, destellos).
    if (this._tweensFinal) { this._tweensFinal.forEach(t => { try { t.stop(); } catch (e) {} }); this._tweensFinal = []; }
    if (this._tweenVeloCartas) { try { this._tweenVeloCartas.stop(); } catch (e) {} this._tweenVeloCartas = null; }
    this._sprites.forEach(s => { if (s && s.destroy) s.destroy(); });
    this._sprites = [];
  }

  // Genera un "estado" de partida falso, con la misma forma que manda el
  // backend real, para ajustar el layout de la mesa (1v1/2v2/3v3) sin
  // crear salas de verdad. modo: '1v1' | '2v2' | '3v3'
  _crearEstadoMockPorModo(modo) {
    const PALOS = ['oro', 'copa', 'espada', 'basto'];
    const VALORES = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
    const cartaAlAzar = (idPrefijo) => {
      const palo = PALOS[Math.floor(Math.random() * PALOS.length)];
      const valor = VALORES[Math.floor(Math.random() * VALORES.length)];
      return { id: `${idPrefijo}-${palo}-${valor}`, palo, valor };
    };
    const jugadorMock = (nombre, id, conJugada) => ({
      id,
      nombre,
      cartasEnMano: 3,
      jugadas: conJugada ? [cartaAlAzar(id)] : [],
    });

    const base = {
      scores: { yo: 3, rival: 2 },
      misCartas: [cartaAlAzar('mia1'), cartaAlAzar('mia2'), cartaAlAzar('mia3')],
      misJugadas: [cartaAlAzar('miJugada')],
      rondaActiva: true,
      turno: 'mio',
      turnoDeId: null,
      compartiendoMiMano: false,
      numeroRonda: 1,
      truco: { nivel: null, pendienteDeRespuesta: false, cantadoPorMi: false, cantadoPorMiEquipo: false },
      envido: { tipo: null, pendienteDeRespuesta: false, cantadoPorMi: false, cantadoPorMiEquipo: false },
      // Ojo: a este mock (usado por los botones "Simular 1v1/2v2/3v3" del
      // lobby) le faltaba directamente el objeto flor — por eso al entrar
      // a una simulación se rompía todo el render con "Cannot read
      // properties of undefined (reading 'nivel')": _renderizarEstado
      // siempre asume que truco/envido/flor están los tres presentes.
      flor: { nivel: null, pendienteDeRespuesta: false, cantadoPorMi: false, cantadoPorMiEquipo: false },
      // etapa 'envido' (antes 'truco'): con turno='mio' y nada más pendiente,
      // esto hace que hayEnvido dé true en _dibujarBotonesCanto y se vea la
      // fila apilada (Envido/Real/Falta arriba + Truco/Ir al mazo abajo) —
      // con 'truco' esa fila nunca aparecía, así que el mock nunca mostraba
      // los botones apilados que se agrandaron en el quinto pase (quedaba
      // siempre en la fila suelta de 56px, que no cambió).
      etapa: 'envido',
    };

    if (modo === '1v1') {
      return { ...base, cartasRivalEnMano: 3, jugadasRival: [cartaAlAzar('rivalJugada')] };
    }
    if (modo === '2v2') {
      return {
        ...base,
        companeros: [jugadorMock('CompaPreview', 'comp-1', true)],
        rivales: [jugadorMock('RivalPreview1', 'riv-1', true), jugadorMock('RivalPreview2', 'riv-2', true)],
      };
    }
    return {
      ...base,
      companeros: [jugadorMock('CompaPreview1', 'comp-1', true), jugadorMock('CompaPreview2', 'comp-2', true)],
      rivales: [
        jugadorMock('RivalPreview1', 'riv-1', true),
        jugadorMock('RivalPreview2', 'riv-2', true),
        jugadorMock('RivalPreview3', 'riv-3', true),
      ],
    };
  }

  _limpiarSocketListeners() {
    if (!this.socket) return;
    if (this._onConnectSala) { this.socket.off('connect', this._onConnectSala); this._onConnectSala = null; }
    if (this._onDisconnectSala) { this.socket.off('disconnect', this._onDisconnectSala); this._onDisconnectSala = null; }
    if (this._onVisibilidadSala) { document.removeEventListener('visibilitychange', this._onVisibilidadSala); this._onVisibilidadSala = null; }
    [
      'estado-juego', 'jugador-unido', 'partida-iniciada', 'jugador-desconectado',
      'error-sala', 'error-jugada', 'sala-cancelada', 'juego-terminado',
      'revancha-estado', 'revancha-lista', 'revancha-cancelada', 'turno-timer', 'info-sala', 'jugador-reconectado'
    ].forEach(evento => this.socket.off(evento));
  }
}