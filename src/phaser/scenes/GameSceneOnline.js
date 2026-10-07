import Phaser from 'phaser';
import { getSocket } from '../../services/socket';
import { ANCHO_MAX_CSS } from '../config/gameConfigOnline';
import { CARD_RANKS } from '../utils/constants';
import { RANGOS_UI } from '../../components/Perfil/rangosUi';

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
const ASSET_VERSION = Date.now();
const conVersion = (ruta) => `${ruta}?v=${ASSET_VERSION}`;

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

export default class GameSceneOnline extends Phaser.Scene {

  constructor() {
    super('GameSceneOnline');
  }

  init(data) {
    this.usuario    = data.usuario;
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
    const extensionCartas = 'png';

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
    this.load.image('cardBack', conVersion(`assets/images/juego/${carpetaCartas}/back.png`));
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
    this.load.image('mesaRedonda', conVersion('assets/images/juego/mesa-truco-nueva.png'));
    this.load.image('mesaRedonda3v3', conVersion('assets/images/juego/mesa-truco-3v3.png'));
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
    this.load.image('monedaEsperaCara', conVersion('assets/images/moneda.png'));
    this.load.image('monedaEsperaDorso', conVersion('assets/images/moneda-dorso.png'));
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
    const dpr = window.devicePixelRatio || 1;
    this.cameras.main.setZoom((ANCHO_MAX_CSS / 800) * dpr);
    this.cameras.main.centerOn(400, 300);

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

    // Punto 6, ver _crearTexturasAtmosfera: depth 0.2, por encima del fondo
    // de madera (depth 0) pero por debajo de la mesa/paño (depth 1) y de
    // `sombraMesa` (depth 0.5) — solo agrega densidad al anillo de madera
    // visible alrededor de la mesa, nunca toca el paño ni lo que se dibuja
    // sobre él.
    this._crearTexturasAtmosfera();
    this.add.image(400, 300, 'vinetaMadera').setDepth(0.2);

    this.sombraMesa = this.add.ellipse(400, 520, 560, 90, 0x000000, 0.35).setDepth(0.5);
    // Ducentésimo sexagésimo noveno pase: halo cálido detrás de la mesa
    // (ver `resplandorMesa` en _crearTexturasAtmosfera) — depth 0.6, entre
    // la sombra (0.5) y la mesa (1), así queda siempre DETRÁS del tapete,
    // dándole un borde de luz que la separa de la pared de fondo. A
    // diferencia de `luzCalidaMesa` más abajo, este se dibuja en los dos
    // modos (día y noche).
    this.add.image(400, 320, 'resplandorMesa').setDepth(0.6);
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
      this.add.image(400, 320, 'luzCalidaMesa').setDepth(1.2);
    }
    // Depth 1000: por encima de TODO lo que dibuja la escena (cartas,
    // botonera, texto) — así el oscurecimiento de las esquinas es parejo
    // sobre toda la pantalla de juego, no solo sobre el fondo. El centro del
    // gradiente queda transparente (radio 250, ver _crearTexturasAtmosfera)
    // así que no llega a tocar ni la mesa ni las cartas jugadas, solo el
    // marco exterior.
    this.add.image(400, 300, 'vinetaMesa').setDepth(1000);

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
    this.PLACA_RIVAL_CX = 178;
    this.PLACA_RIVAL_CY = 36;
    const placaAncho = 96;
    const placaAlto = 48;
    // Nonagésimo tercer pase: color sólido (sin alpha en el hex) +
    // contorno fino, en vez de '#ffffffdd' sin stroke — pedido explícito
    // del usuario, el nombre del rival se perdía sobre la madera. Mismo
    // criterio que `labelPropio` (ver más abajo), para que las dos placas
    // sean igual de legibles.
    this.labelRival = this.add.text(this.PLACA_RIVAL_CX, this.PLACA_RIVAL_CY - 11, 'Rival', {
      font: '12px Arial', fill: '#FFF8ED', stroke: '#2a1c14', strokeThickness: 2.5,
    }).setOrigin(0.5).setDepth(1002);
    // Centésimo décimo quinto pase: nombre del rival clickeable, mismo
    // criterio que Ranking/Lobby/chat/Perfil (abre PerfilRivalModal). Se
    // deja interactivo una sola vez acá afuera del render loop — el texto
    // se actualiza en cada `_renderizarEstado` pero el listener siempre lee
    // `this._nombreRivalActual`, que se guarda ahí mismo.
    this.labelRival.setInteractive({ useHandCursor: true });
    this.labelRival.on('pointerdown', () => {
      if (this._nombreRivalActual && this.onVerPerfil) this.onVerPerfil(this._nombreRivalActual);
    });
    // Puntos del rival — antes vivían combinados con los propios en un
    // solo texto "N - N" adentro de la placa "Vos" (`scoreText`); ahora
    // cada placa muestra sus propios puntos, en el mismo estilo (cifras
    // doradas) que ya tenía ese texto combinado.
    this.scoreTextRival = this.add.text(this.PLACA_RIVAL_CX, this.PLACA_RIVAL_CY + 11, '0', {
      fontFamily: 'Nunito, Arial', fontSize: '18px', fontStyle: 'bold',
      color: '#FFF8ED', stroke: '#4A2C2A', strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 1, color: '#4A2C2A', blur: 0, fill: true },
      resolution: this._factorEscalaTextura()
    }).setOrigin(0.5).setDepth(1002);
    this._dibujarPlacaMarcador(this.fondoInfoRival, this.PLACA_RIVAL_CX, this.PLACA_RIVAL_CY, placaAncho, placaAlto);
    // Trigésimo segundo pase: antes era el circulito de "es mano" (solo
    // visible cuando el rival era mano) — ahora es un ícono de persona
    // siempre visible junto al label, y el que "se prende" (dorado, con
    // pulso) o "se apaga" (gris, quieto) según de quién es el turno, no
    // según quién es mano. Ver _renderizarEstado (_rivalTurnoEncendido).
    // Pase siguiente: antes seguía al ancho real del nombre (placa
    // dinámica); con la placa fija, se fija por fuera de su borde derecho
    // (mismo lugar relativo que antes — el ícono siempre quedaba DESPUÉS
    // del nombre, nunca superpuesto) en vez de recalcularse en cada estado.
    this.manoIconoRival = this.add.image(this.PLACA_RIVAL_CX + placaAncho / 2 + 11, this.PLACA_RIVAL_CY - 11, 'icono_rival').setDisplaySize(17, 19).setDepth(1002).setVisible(false);

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
    const altoBotonera = 130;
    const anchoBotonera = Math.round(altoBotonera * (700 / 193));
    const yBotonera = 500 + altoBotonera / 2;
    this.add.image(400, yBotonera, 'panelBotonera').setDisplaySize(anchoBotonera, altoBotonera).setDepth(150);
    // Nonagésimo primer pase: guardada como propiedad de la escena para que
    // `_dibujarBotonesCanto` pueda repartir los botones dentro del ancho
    // real de ESTA placa (más angosta que el canvas completo) en vez de un
    // ancho fijo — si se vuelve a ensanchar la placa (ver comentario de
    // arriba sobre el asset en 3 franjas), este número se actualiza solo.
    this.anchoBotonera = anchoBotonera;
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
    const marcadorAncho = 96;
    const marcadorAlto = 48;
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
    const marcadorX = 60;
    const marcadorY = 36;

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
    this.labelPropio = this.add.text(marcadorX, marcadorY - 11, this._truncarNombre(this.usuario?.username) || 'Vos', {
      font: '12px Arial', fill: '#FFF8ED', stroke: '#2a1c14', strokeThickness: 2.5,
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
    this.scoreText = this.add.text(marcadorX, marcadorY + 11, '0', {
      fontFamily: 'Nunito, Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#FFF8ED',
      stroke: '#4A2C2A',
      strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 1, color: '#4A2C2A', blur: 0, fill: true },
      resolution: this._factorEscalaTextura()
    }).setOrigin(0.5).setDepth(1002);

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
    this.manoIconoPropio = this.add.image(650, 462, 'circulo_mano').setDisplaySize(24, 24).setDepth(200).setVisible(false);
    this.miManoTexto = this.add.text(666, 462, '', {
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
      shadow: { offsetX: 0, offsetY: 2, color: '#000000', blur: 4, fill: true }
    }).setOrigin(0.5).setDepth(301);

    // Nonagésimo cuarto pase: chiquito helper para que la píldora
    // (`mensajeFondo`) se oculte sola cuando no hay nada que mostrar —
    // en vez de tocar los ~7 lugares que hacían `mensajeText.setText(...)`
    // directo (estado-juego, jugador-unido, jugador-desconectado,
    // error-sala, error-jugada, x2 variantes de equipos/1v1) y arriesgar
    // dejar alguno sin actualizar, se centraliza en un solo punto.
    this._actualizarMensajeEstado = (texto, color) => {
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
    this.cantoText = this.add.text(400, 300, '', {
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
    this.turnoText = this.add.text(690, 500, '', {
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
    this._sprites.push(this.fondoEspera);
    this.veloEspera = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.35).setDepth(350);
    this._sprites.push(this.veloEspera);

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
    // Pase 346: moneda 3D girando + "Buscando rival..." debajo del VS.
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


 
  _ajustarMesaSegunAsientos(cantidadAsientos) {
  const modo = cantidadAsientos === 5 ? '3v3' : 'normal';
  if (modo === this._mesaModoActual) return;
  this._mesaModoActual = modo;

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

  if (modo === '3v3') {
    const CROP = { x: 37, y: 876, width: 1128, height: 1064 };
    const anchoDisplay = 600;
    const altoDisplay = anchoDisplay * (CROP.height / CROP.width) * FACTOR_ALTURA;

    this.mesaImg
      .setTexture('mesaRedonda3v3')
      .setCrop(CROP.x, CROP.y, CROP.width, CROP.height)
      .setDisplaySize(anchoDisplay, altoDisplay)
      .setPosition(400, 220);
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
}

_factorEscalaTextura() {
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
  const blurCtx = blurCanvas.getContext('2d');
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
    const siguienteCtx = siguienteCanvas.getContext('2d');
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
  const finalCtx = finalCanvas.getContext('2d');
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
  [this.scoreBg, this.scoreText, this.labelPropio, this.fondoInfoRival, this.scoreTextRival]
    .forEach(o => { if (o && o.scene) o.setVisible(visible); });
  if (!visible) {
    [this.labelRival, this.manoIconoRival].forEach(o => { if (o && o.scene) o.setVisible(false); });
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
_actualizarBannerEsperaTitulo(texto, modo = null) {
  if (this._bannerEsperaTitulo) {
    const viejo = this._bannerEsperaTitulo;
    viejo.destroy();
    this._sprites = this._sprites.filter(s => s !== viejo);
  }
  // Pase 346: cartel de CAOBA con remaches dorados (ya no el pergamino) y,
  // a la izquierda del texto, una mini píldora 3D dorada con el modo
  // ("1v1"). Se dibuja todo por código dentro de un container en (400,130).
  const label = this.add.text(0, 0, texto, {
    fontFamily: 'Fredoka, Arial', fontSize: '24px', fontStyle: '700', color: '#FFD98A',
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

  const contenido = pillW ? pillW + gap + label.width : label.width;
  const padX = 44;
  const ancho = Math.max(260, Math.round(contenido + padX * 2));
  const alto = 64;

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
    g.fillStyle(0x2C160E, 1);
    g.fillCircle(dx, dy, 6);
    g.fillStyle(0xF5B041, 1);
    g.fillCircle(dx, dy, 4.5);
    g.fillStyle(0xFFF1C2, 0.9);
    g.fillCircle(dx - 1.3, dy - 1.3, 1.5);
  });

  const hijos = [g];
  const inicioX = -contenido / 2;
  if (pillTxt) {
    const pg = this.add.graphics();
    const px = inicioX;
    const py = -pillH / 2;
    pg.fillStyle(0xB9770E, 1);
    pg.fillRoundedRect(px, py + 3, pillW, pillH, pillH / 2);
    pg.fillStyle(0xF5B041, 1);
    pg.fillRoundedRect(px, py, pillW, pillH, pillH / 2);
    pg.fillStyle(0xFFFFFF, 0.35);
    pg.fillRoundedRect(px + 5, py + 3, pillW - 10, pillH * 0.38, pillH * 0.19);
    pg.lineStyle(2, 0x000000, 1);
    pg.strokeRoundedRect(px, py, pillW, pillH, pillH / 2);
    pillTxt.setPosition(px + pillW / 2, 0);
    label.setPosition(inicioX + pillW + gap + label.width / 2, 0);
    hijos.push(pg, pillTxt, label);
  } else {
    label.setPosition(0, 0);
    hijos.push(label);
  }

  this._bannerEsperaTitulo = this.add.container(400, 130, hijos).setDepth(401);
  this._sprites.push(this._bannerEsperaTitulo);
}

// Pase 346: bloque central "moneda 3D girando (44px) + Buscando rival..." —
// se crea una sola vez (no se redibuja con cada 'jugador-unido', así el giro
// no se reinicia) y se destruye junto con el título (ver
// _destruirBannerEsperaTitulo).
_crearCentroEspera() {
  if (this._centroEspera) return;
  const TAM = 44;
  const cy = 418;
  const moneda = this.add.image(400, cy, 'monedaEsperaCara').setDisplaySize(TAM, TAM).setDepth(405);
  const texto = this.add.text(400, cy + 46, 'Buscando rival...', {
    fontFamily: 'Fredoka, Arial', fontSize: '22px', fontStyle: '600', color: '#FFF8ED',
    stroke: '#000000', strokeThickness: 4,
  }).setOrigin(0.5).setDepth(405);
  let carasActual = 'cara';
  const giro = { ang: 0 };
  const tween = this.tweens.add({
    targets: giro, ang: 360, duration: 2600, repeat: -1, ease: 'Linear',
    onUpdate: () => {
      if (!moneda.scene) return;
      const c = Math.cos((giro.ang * Math.PI) / 180);
      const cara = c >= 0 ? 'cara' : 'dorso';
      if (cara !== carasActual) {
        carasActual = cara;
        moneda.setTexture(cara === 'cara' ? 'monedaEsperaCara' : 'monedaEsperaDorso');
      }
      moneda.setDisplaySize(TAM * Math.max(Math.abs(c), 0.04), TAM);
    },
  });
  this._centroEspera = { moneda, texto, tween };
  this._sprites.push(moneda, texto);
}

_actualizarTextoBuscando() {
  const t = this._centroEspera && this._centroEspera.texto;
  if (!t || !t.scene) return;
  const lleno = this._capacidadSala && this._jugadoresSala && this._jugadoresSala.length >= this._capacidadSala;
  t.setText(lleno ? 'Iniciando partida...' : (this._capacidadSala > 2 ? 'Buscando jugadores...' : 'Buscando rival...'));
}

// Destruye (no solo oculta) el título de la sala de espera — se llama en
// los mismos puntos donde arranca la partida de verdad (ver
// 'partida-iniciada' y el modo preview en _conectarSocket), mismo criterio
// de "no dejar nada de la sala de espera en la partida" que el resto de
// esta pantalla.
_destruirBannerEsperaTitulo() {
  if (this._centroEspera) {
    const { moneda, texto, tween } = this._centroEspera;
    if (tween && tween.stop) tween.stop();
    [moneda, texto].forEach(o => { if (o && o.scene) o.destroy(); });
    this._sprites = this._sprites.filter(s => s !== moneda && s !== texto);
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
  this._actualizarBannerEsperaTitulo('Esperando jugadores', this._modoSala);
  this._actualizarTextoBuscando();

  const total = this._capacidadSala;
  // Pase 209: pedido del usuario ("en la pantalla nueva de carga,
  // agrandemos todo") — tiles, huecos y tipografía de toda la fila (ver
  // también _dibujarTileEspera más abajo) subieron de tamaño.
  const tamano = total <= 2 ? 140 : total <= 4 ? 115 : 92;
  // Pase 346: en 1v1 el hueco crece (76) para alojar el badge VS entre los dos aros.
  const gap = total <= 2 ? 96 : total <= 4 ? 30 : 20;
  const paso = tamano + gap;
  const anchoTotal = total * paso - gap;
  const inicioX = 400 - anchoTotal / 2 + tamano / 2;
  const cy = 270;

  const pendientes = [];
  for (let i = 0; i < total; i++) {
    const jugador = this._jugadoresSala[i] || null;
    const cx = inicioX + i * paso;
    this._dibujarTileEspera(cx, cy, tamano / 2, jugador, pendientes);
  }

  // Pase 346: badge "VS" amarillo 3D, centrado entre los dos avatares (solo 1v1).
  if (total === 2) this._dibujarBadgeVsEspera(400, cy);

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

// Un tile de la fila: sello circular de madera (cálido si ya se unió, gris
// pulsando si no), la foto/avatar real (o un "?" placeholder si el asiento
// está vacío), una pill de estado ("Conectado"/"Conectando...") y el
// nombre debajo sobre su propia etiqueta de madera fina.
// `pendientes` acumula los avatares que todavía no están en la caché de
// texturas de Phaser, para cargarlos todos juntos en un solo batch (ver
// _redibujarFilaEspera) en vez de un load.start() por jugador.
_dibujarTileEspera(cx, cy, radio, jugador, pendientes) {
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
    const url = esFoto ? jugador.foto_perfil_url : `/assets/${jugador.personaje || 'gaucho'}-avatar.png`;
    const key = `avatarEspera_${this._hashSimple(url)}`;

    if (this.textures.exists(key)) {
      this._dibujarImagenAvatarEspera({ key, cx, cy, radio: radioFoto });
    } else {
      pendientes.push({ key, url, cx, cy, radio: radioFoto });
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
    const signo = this.add.text(cx, cy, '?', {
      fontFamily: 'Fredoka, Arial', fontSize: `${Math.round(radioFoto * 1.25)}px`, fontStyle: '700',
      color: '#FFF8ED',
    }).setOrigin(0.5).setAlpha(0.55).setDepth(412);
    this._avataresEsperaSprites.push(signo);
    this._sprites.push(signo);
    // Respiración suave: aro, burbuja y "?" suben/bajan de opacidad juntos.
    this.tweens.add({ targets: [marco, burbuja], alpha: { from: 1, to: 0.5 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: signo, alpha: { from: 0.7, to: 0.25 }, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
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
  const pillY = cy + radio + 30;
  const pillAlto = 32;

  if (conectado) {
    const pillTextoBase = '✓ Conectado';
    const medidor = this.add.text(0, 0, pillTextoBase, { fontFamily: 'Fredoka, Arial', fontSize: '14px', fontStyle: '600' });
    const anchoTexto = medidor.width;
    medidor.destroy();

    const texIzqPill = this.textures.get('botonVerdeIzq').getSourceImage();
    const texDerPill = this.textures.get('botonVerdeDer').getSourceImage();
    const capIzqPill = Math.round(texIzqPill.width * (pillAlto / texIzqPill.height));
    const capDerPill = Math.round(texDerPill.width * (pillAlto / texDerPill.height));
    const pillAncho = Math.max(anchoTexto + 36, capIzqPill + capDerPill + 20);
    const midPill = pillAncho - capIzqPill - capDerPill;

    const pIzq = this.add.image(cx - pillAncho / 2 + capIzqPill / 2, pillY, 'botonVerdeIzq').setDisplaySize(capIzqPill, pillAlto).setDepth(413);
    const pCentro = this.add.image(cx - pillAncho / 2 + capIzqPill + midPill / 2, pillY, 'botonVerdeCentro').setDisplaySize(midPill, pillAlto).setDepth(413);
    const pDer = this.add.image(cx + pillAncho / 2 - capDerPill / 2, pillY, 'botonVerdeDer').setDisplaySize(capDerPill, pillAlto).setDepth(413);
    this._avataresEsperaSprites.push(pIzq, pCentro, pDer);
    this._sprites.push(pIzq, pCentro, pDer);

    const pillTexto = this.add.text(cx, pillY, pillTextoBase, {
      fontFamily: 'Fredoka, Arial', fontSize: '14px', fontStyle: '600', color: '#FFFFFF',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(414);
    this._avataresEsperaSprites.push(pillTexto);
    this._sprites.push(pillTexto);
  } else {
    // "Conectando" fijo + puntitos separados que van y vienen cada 400ms
    // — separados en 2 Text para que el ancho del texto no cambie cada
    // vez que cambia la cantidad de puntos (se mide con los 3 puntos
    // puestos, "Conectando...", y el texto base se ancla a la izquierda
    // de ESE ancho fijo en vez de quedar centrado y bailando).
    // Ducentésimo septuagésimo segundo pase: el usuario reportó que
    // "Conectando..." se veía chico al lado de "✓ Conectado" — en código
    // los dos ya estaban en 14px, pero "✓ Conectado" usa Fredoka bold
    // (más ancha/pesada) mientras este texto usa Nunito, que a igual
    // tamaño en px se lee más fino/chico. Sube a 17px (+21%, dentro del
    // 20-25% pedido) para equipararlos a simple vista.
    const FUENTE_CONECTANDO = 'bold 17px Nunito, Arial';
    const base = 'Conectando';
    const medidorTotal = this.add.text(0, 0, `${base}...`, { font: FUENTE_CONECTANDO });
    const anchoTotal = medidorTotal.width;
    medidorTotal.destroy();

    // El ancho de la píldora venía fijo en `radio*2+22` (pensado para el
    // 14px viejo) — con el texto más grande, en salas de 3+ asientos
    // (`tamano`/`radio` más chicos, ver _redibujarFilaEspera) el texto ya
    // no entraba y se salía de la píldora. Ahora el ancho es el máximo
    // entre ese mínimo de siempre y lo que el texto real necesita (mismo
    // criterio que ya usa la píldora "✓ Conectado" unas líneas arriba).
    const pillAncho = Math.max(radio * 2 + 22, anchoTotal + 36);
    const px = cx - pillAncho / 2, py = pillY - pillAlto / 2;
    const pill = this.add.graphics().setDepth(413);
    pill.fillStyle(0x3a2412, 0.18); // sombra sutil, da el "hueco" ahuecado
    pill.fillRoundedRect(px, py, pillAncho, pillAlto, pillAlto / 2);
    pill.fillStyle(0xE9D9B0, 1); // madera clara / beige
    pill.fillRoundedRect(px + 1.5, py + 1.5, pillAncho - 3, pillAlto - 5, pillAlto / 2 - 1.5);
    pill.fillStyle(0xFFFFFF, 0.4); // brillo superior sutil — mismo criterio que las filas del pase 265
    pill.fillRoundedRect(px + 1.5, py + 1.5, pillAncho - 3, pillAlto * 0.45, pillAlto / 2 - 1.5);
    pill.lineStyle(2, 0x4A2C2A, 1);
    pill.strokeRoundedRect(px, py, pillAncho, pillAlto, pillAlto / 2);
    this._avataresEsperaSprites.push(pill);
    this._sprites.push(pill);

    const textoBase = this.add.text(cx - anchoTotal / 2, pillY, base, {
      font: FUENTE_CONECTANDO, fill: '#4A2C2A',
    }).setOrigin(0, 0.5).setDepth(414);
    const textoPuntos = this.add.text(cx - anchoTotal / 2 + textoBase.width, pillY, '.', {
      font: FUENTE_CONECTANDO, fill: '#4A2C2A',
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

// Pase 346: badge "VS" — placa dorada 3D (borde negro 3px, relieve inferior
// ocre) con "VS" en Fredoka chocolate, levemente inclinada.
_dibujarBadgeVsEspera(x, y) {
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
_dibujarImagenAvatarEspera({ key, cx, cy, radio }) {
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
  const img = this.add.image(cx, cy, key).setDisplaySize(radio * 2, radio * 2).setDepth(412);
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
      if (this.panelEspera) this.panelEspera.setVisible(false);
      if (this.botonVolverEspera) this.botonVolverEspera.setVisible(false);
      this._limpiarAvataresEspera();
      this._destruirBannerEsperaTitulo();
      if (this.mesaImg) this.mesaImg.setVisible(true);
      if (this.sombraMesa) this.sombraMesa.setVisible(true);
      this.estado = this._crearEstadoMockPorModo(modo);
      if (this.onEsEquipos) this.onEsEquipos(Array.isArray(this.estado.companeros));
      this._renderizarEstado(true);
      return;
    }

    this.socket = getSocket();
    this.socket.connect();
    this.socket.emit('unirse-sala', { codigoSala: this.codigoSala, usuario: this.usuario });

    this.socket.off('estado-juego').on('estado-juego', (estado) => {
      const esRepartoNuevo = this._esRepartoNuevo(estado);
      this.estadoAnterior = this.estado;
      this.estado = estado;
      this._actualizarMensajeEstado('');

      if (this.onEsEquipos) this.onEsEquipos(Array.isArray(estado.companeros));

      if (esRepartoNuevo) {
        try { this.sound.play('repartir', { volume: 0.5 }); } catch (e) {}
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
      if (this.mesaImg) this.mesaImg.setVisible(true);
      if (this.sombraMesa) this.sombraMesa.setVisible(true);
      this._mostrarMarcadores(true);
    });
    this.socket.off('jugador-desconectado').on('jugador-desconectado', (data) => {
      this._actualizarMensajeEstado(data.mensaje);
    });
    this.socket.off('error-sala').on('error-sala', (data) => {
      this._actualizarMensajeEstado(data.mensaje, '#ff5555');
    });
    this.socket.off('error-jugada').on('error-jugada', (data) => {
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
        if (gano) { try { this.sound.play('ganar', { volume: 0.8 }); } catch (e) {} }

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
          this._mostrarPantallaFinal(titulo, !!data.esCampeon, data.esTorneo, data.torneoId, data.jugadores, extra, gano);
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
        try { this.sound.play('repartir', { volume: 0.5 }); } catch (e) {}
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

_mostrarPantallaFinal(titulo, esCampeon = false, esTorneo = false, torneoId = null, jugadoresFinal = null, subtitulo = '', gano = false) {
this._limpiarSprites();
    this._ocultarCanto();
    // Centésimo pase: referencias a la placa de alerta de revancha y al
    // botón de "Pedir revancha" — se resetean acá porque `_limpiarSprites`
    // (arriba) ya destruyó los objetos de la pantalla final anterior, si
    // hubo una (revancha aceptada → nueva partida → nuevo fin de partida).
    // Sin este reset, `_mostrarAlertaRevancha` podría encontrar una
    // referencia a un Graphics ya destruido y fallar al llamar `.clear()`.
    this.fondoAlertaRevancha = null;
    this.contRevancha = null;
    // Pase siguiente (placa doble): antes solo `scoreBg`/`scoreText` (el
    // "N - N" combinado) sobrevivían a esta pantalla final — ahora que el
    // puntaje vive repartido en dos placas (la propia y la del rival), hay
    // que conservar las DOS para que la pantalla de resultado siga
    // mostrando el marcador completo (antes mostraba ambos números en un
    // solo texto; con la placa dividida hace falta listar cada pieza).
    const elementosMarcador = [
      this.scoreBg, this.scoreText, this.labelPropio,
      this.fondoInfoRival, this.scoreTextRival, this.labelRival, this.manoIconoRival,
    ];
    this.children.list
      .filter(c => c !== undefined)
      .forEach(c => { if (!elementosMarcador.includes(c)) c.setVisible(false); });

    // Pase 201: pedido del usuario de sacar el fondo negro plano de
    // esta pantalla y usar el mismo fondo fotográfico que ya tiene el
    // lobby — el velo de color pasa a ser mucho más liviano, solo para
    // que la tarjeta central siga leyéndose bien encima.
    const fondoResultado = this.add.image(400, 300, 'fondoResultado').setDepth(898);
    fondoResultado.setDisplaySize(800, 600);
    this._sprites.push(fondoResultado);

    const velo = this.add.rectangle(400, 300, 800, 600, 0x14140f, 0.45).setDepth(900);
    this._sprites.push(velo);

    // Septuagésimo sexto pase: pedido explícito del usuario de copiar
    // ACÁ el mismo estilo que ya tiene esta pantalla en el nativo
    // (mismos colores, textos y diseño), reemplazando el rediseño propio
    // del pase anterior (cartel con degradé, acentos de esquina, sombra
    // detrás del panel, colores que cambiaban según ganó/perdió). El
    // nativo (overlay de resultado de `juego.tsx`) usa un lenguaje mucho
    // más simple: un anillo dorado macizo (5px de "grosor", vía un
    // rectángulo más grande detrás) alrededor de una tarjeta crema con
    // borde chocolate de 3px — sin degradé, sin sombra, sin acentos de
    // esquina — y un cartel de título también dorado macizo, SIEMPRE del
    // mismo color sin importar el resultado (`carteloTitulo` en
    // juego.tsx es un estilo fijo, no condicional). Se replica ese mismo
    // esquema acá con `graphics` planas en vez de gradientes.
    //
    // A diferencia del pase anterior (panel de alto fijo), el alto de la
    // tarjeta ahora se calcula en base al contenido real que va a llevar
    // (título, línea de campeón si corresponde, aclaración si la hay,
    // filas de jugadores, botón de revancha si corresponde, botón de
    // volver) — igual que en el nativo, donde la tarjeta crece con su
    // contenido en vez de tener un tamaño fijo adivinado. Para esto se
    // crean primero los textos (así se puede medir su ancho/alto real
    // vía `.width`/`.height`, que Phaser calcula con la fuente real) y
    // recién después se dibuja el anillo/tarjeta con el alto exacto que
    // hace falta, y se termina de ubicar todo en su lugar final.
    const panelAncho = 400;
    const px = 400 - panelAncho / 2;
    const padArriba = 26;
    const padAbajo = 26;
    // Centésimo pase: alto fijo de cada fila de jugador + aire entre una y
    // la otra — antes las dos filas quedaban pegadas (un solo bloque
    // partido al medio por el color); ahora son dos placas visualmente
    // independientes, así que hace falta un gap real entre ellas. Se
    // declaran acá (no sueltos adentro del bloque de abajo) porque el
    // cálculo de `altoContenido` (más abajo) necesita el mismo número para
    // no desfasar el alto real del panel.
    const filaJugadorAlto = 28;
    const gapEntreFilas = 10;
    // Pase 266, punto 3: 44→52 — el usuario pidió "aumentar la altura
    // mínima de los botones (Pedir revancha / Volver al lobby) para que
    // los textos interiores respiren con un margen amplio". Se declara
    // acá (no un literal suelto en cada `_crearBotonOverlay`) por el
    // mismo motivo que `filaJugadorAlto`: el precálculo de
    // `altoContenido` más abajo y el `y +=` entre un botón y el otro
    // necesitan el mismo número para no desfasar el panel.
    const altoBotonFinal = 52;

    // 1) Título — ancho ceñido al texto real vía `.width` en vez de una
    // fórmula por cantidad de caracteres — mismo criterio que el
    // `carteloTitulo` nativo, que se ciñe por padding, no por un ancho
    // fijo adivinado.
    // Pase 211: bug real reportado — con un título largo (ej. "Pasaron 10
    // minutos sin que se sumara nadie más. Se canceló la sala.", el
    // mensaje de sala cancelada por timeout) este texto no tenía
    // `wordWrap`, así que medía su ancho REAL en una sola línea sin
    // límite — y el cartel dorado (`pillW`, calculado a partir de ese
    // ancho) terminaba mucho más ancho que la tarjeta entera
    // (`panelAncho`), desbordando sus bordes. Mismo `wordWrap` que ya usa
    // `textoSubtitulo` más abajo (panelAncho - 60) — un título corto
    // ("¡Ganaste!") sigue entrando en una sola línea igual que antes, uno
    // largo ahora pasa a 2-3 líneas en vez de estirar el cartel.
    // Nonagésimo sexto pase: antes el título era SIEMPRE dorado macizo,
    // sin importar el resultado (paridad explícita con el nativo, pase
    // 76). El usuario pidió ahora lo contrario, explícitamente: título
    // verde esmeralda con resplandor tipo cartoon si ganó, rojo carmesí/
    // borgoña si perdió — se revierte esa paridad a propósito, por
    // pedido directo, no por error. El resplandor (pedido solo para la
    // victoria) se logra con la sombra de Phaser con blur>0 — el resto de
    // los textos de esta escena usan a propósito blur:0 (contorno sólido,
    // no difuminado) para legibilidad general, pero un halo difuminado es
    // justamente el efecto pedido acá.
    const colorTitulo = gano ? '#1f7a3c' : '#8c2a2a';
    const padHTitulo = 18, padVTitulo = 6;
    const textoTitulo = this.add.text(0, 0, titulo, {
      fontFamily: 'Fredoka, Arial', fontSize: '22px', fontStyle: '600', color: colorTitulo, align: 'center',
      wordWrap: { width: panelAncho - 60 },
      ...(gano ? { shadow: { offsetX: 0, offsetY: 0, color: '#FFD668', blur: 10, fill: true } } : {}),
    }).setDepth(902);
    const pillW = textoTitulo.width + padHTitulo * 2;
    const pillH = textoTitulo.height + padVTitulo * 2;
    this._sprites.push(textoTitulo);

    let altoContenido = padArriba + pillH;

    // 1.5) Cara del personaje del propio jugador — victoriosa si ganó,
    // derrotada si perdió — reemplaza el emoji fijo que antes vivía
    // pegado al texto del título (pedido del usuario). Mismo personaje
    // que el jugador tiene elegido, cargado en preload() como
    // 'caraVictorioso'/'caraDerrotado'.
    // Pase 204: 72→140 — el usuario pidió agrandarla porque sobraba
    // espacio vacío alrededor; el resto del layout ya calcula el alto
    // del panel en base a `caraTam`, así que agrandarla acá alcanza (el
    // panel sigue cómodo bajo el tope de 560px, ver `panelAlto` abajo).
    // Centésimo primer pase: 140→190 (+35%, dentro del 30-40% pedido) —
    // mismo motivo que el pase 204, el usuario la pidió más grande todavía.
    const caraTam = 190;
    const caraFinal = this.add.image(400, 0, gano ? 'caraVictorioso' : 'caraDerrotado').setDepth(902);
    caraFinal.setDisplaySize(caraTam, caraTam);
    this._sprites.push(caraFinal);

    // Nonagésimo sexto pase: "borde circular estilo moneda de bronce...
    // con trazo negro marcado para integrarlo a la placa" — 3 anillos
    // concéntricos dibujados con `strokeCircle` (no `fillCircle`: un
    // relleno tapa a `caraFinal`, un trazo deja el centro transparente)
    // mismo criterio de capas que los remaches de `_dibujarPlacaMarcador`
    // pero a la escala de un marco de avatar en vez de un rivet chico.
    // Se posiciona junto con `caraFinal` más abajo (mismo punto, mismo
    // momento), no acá — todavía no se sabe el Y final.
    // Pase 266: + 6 → - 14. Ahora que `caraFinal` carga la variante
    // "_cerca" (recorte ajustado al contenido, ver preload), el personaje
    // ocupa el 100% de `caraTam` en vez de flotar con relleno vacío
    // alrededor. Un radio MENOR que caraTam/2 hace que el sombrero/parte
    // superior de la cabeza sobresalga por encima del anillo dorado en
    // vez de quedar contenido adentro — el "efecto pop-out sticker"
    // pedido. El valor -14 es empírico: deja asomar la copa del sombrero
    // sin tapar el anillo en el resto del contorno (cara/hombros siguen
    // adentro, que es lo que da la sensación de superposición y no de
    // recorte roto).
    const radioAvatar = caraTam / 2 - 14;
    const marcoAvatar = this.add.graphics().setDepth(901.9);
    marcoAvatar.lineStyle(10, 0x1a1410, 1); // negroPulido — contorno exterior grueso
    marcoAvatar.strokeCircle(0, 0, radioAvatar);
    marcoAvatar.lineStyle(7, 0xc9973e, 1); // remache — cuerpo de la moneda de bronce
    marcoAvatar.strokeCircle(0, 0, radioAvatar - 1);
    marcoAvatar.lineStyle(2, 0xf0d9a0, 0.85); // remacheClaro — brillo fino interior
    marcoAvatar.strokeCircle(0, 0, radioAvatar - 4);
    this._sprites.push(marcoAvatar);

    altoContenido += 10 + caraTam;

    // 2) "👑 ¡Sos el campeón del torneo!" — línea aparte, no reemplaza
    // el título (en el nativo conviven las dos: el título de
    // ganó/perdió arriba siempre, y esta debajo solo si es campeón).
    let campeonTxt = null;
    if (esCampeon) {
      campeonTxt = this.add.text(400, 0, '👑 ¡Sos el campeón del torneo!', {
        fontFamily: 'Fredoka, Arial', fontSize: '15px', fontStyle: '600', color: '#C9860E', align: 'center',
      }).setOrigin(0.5, 0).setDepth(902);
      this._sprites.push(campeonTxt);
      altoContenido += 12 + campeonTxt.height + 16;
    }

    // 3) Aclaración de motivo (ej. "El rival abandonó la partida.") —
    // esto es un agregado propio de la web, el nativo no la muestra; se
    // mantiene porque el backend ya manda ese dato y le da contexto real
    // al jugador de por qué terminó la partida, pero ahora se pinta con
    // el mismo criterio tipográfico apagado que el resto de los textos
    // secundarios de esta pantalla en vez de convivir dentro del cartel
    // del título.
    let textoSubtitulo = null;
    if (subtitulo) {
      textoSubtitulo = this.add.text(400, 0, subtitulo, {
        fontFamily: 'Nunito, Arial', fontSize: '13px', color: '#7a6660', align: 'center',
        wordWrap: { width: panelAncho - 60 },
      }).setOrigin(0.5, 0).setDepth(902);
      this._sprites.push(textoSubtitulo);
      altoContenido += (esCampeon ? 0 : 12) + textoSubtitulo.height + 14;
    } else if (!esCampeon) {
      altoContenido += 12;
    }

    // 4) Filas de jugadores — fondo neutro parejo para las dos filas (no
    // coloreado por resultado) + franja de acento a la izquierda, mismo
    // criterio que `filaJugadorResultado` en el nativo (ahí el color
    // solo tiñe la franja y el texto, nunca el fondo de la fila entera).
    // Pase siguiente: se agrega una línea divisoria fina antes de las
    // filas de jugadores (separa visualmente "resultado" de "detalle de
    // quién ganó/perdió", como pide el feedback de que esta pantalla se
    // sentía poco jerarquizada) — de ahí el +14 extra acá.
    const hayJugadores = jugadoresFinal && jugadoresFinal.length > 0;
    if (hayJugadores) {
      // Centésimo pase: antes era `jugadoresFinal.length * 32` (28 de
      // fila + 4 de aire implícito, pegadas) — ahora cada fila suma su
      // propio alto más el gap real contra la siguiente, salvo la
      // última (no hay gap después de la última fila, por eso el -1).
      altoContenido += 14 + jugadoresFinal.length * filaJugadorAlto + (jugadoresFinal.length - 1) * gapEntreFilas + 16;
    }

    // 5) Botón de revancha (si no es torneo) — con su texto de estado
    // arriba (como en el nativo: "Esperando confirmación… (X/Y)" vive
    // ANTES del botón, no después) — y 6) botón de volver al lobby.
    if (!esTorneo) {
      altoContenido += 20 + altoBotonFinal + 8;
    }
    altoContenido += altoBotonFinal;

    const panelAlto = Math.min(560, Math.max(220, altoContenido + padAbajo));
    const py = 300 - panelAlto / 2;

    // Nonagésimo cuarto pase: el anillo dorado macizo + tarjeta crema
    // plana (sin relieve, con líneas divisorias de tabla web — feedback
    // explícito del usuario) se reemplazan por el marco de madera
    // biselada con remaches de bronce que ya usa el Lobby — ver
    // `_dibujarMarcoMaderaConRemaches`, un solo Graphics en vez de dos.
    const marco = this.add.graphics().setDepth(900);
    this._dibujarMarcoMaderaConRemaches(marco, px, py, panelAncho, panelAlto, 20, 14, 9);
    this._sprites.push(marco);

    // Pase siguiente: pedido del usuario de "sumar algún detalle de
    // celebración si ganás" — un puñado de cuadraditos de colores que
    // caen desde arriba del panel y se desvanecen, una sola vez, nada
    // en loop. Solo cuando el resultado es una victoria propia (nunca en
    // el caso neutro de sala cancelada ni cuando perdés).
    if (gano) {
      const coloresConfeti = [0xFFB627, 0xFFD668, 0x4FB3E8, 0x2D9B4F];
      for (let i = 0; i < 16; i++) {
        const cx = px + 16 + Math.random() * (panelAncho - 32);
        const cy = py - 4;
        const pieza = this.add.graphics().setDepth(901.5);
        pieza.fillStyle(coloresConfeti[i % coloresConfeti.length], 1);
        pieza.fillRect(-3, -3, 6, 6);
        pieza.setPosition(cx, cy);
        pieza.setAngle(Math.random() * 360);
        this._sprites.push(pieza);
        this.tweens.add({
          targets: pieza,
          y: cy + 46 + Math.random() * 44,
          x: cx + (Math.random() * 44 - 22),
          angle: pieza.angle + (Math.random() > 0.5 ? 220 : -220),
          alpha: 0,
          duration: 1000 + Math.random() * 500,
          delay: Math.random() * 250,
          ease: 'Cubic.easeIn',
        });
      }
    }

    const pillCenterY = py + padArriba + pillH / 2;
    // Nonagésimo cuarto pase: el cartel de título pasa del rectángulo
    // dorado macizo y plano de antes al mismo banner de pergamino de 3
    // franjas que ya usa el resto de la mesa para carteles de texto
    // (`_crearBannerTexto`/`_mostrarCanto`) — pedido explícito del
    // usuario: "colocar el encabezado en un cartel de madera o listón
    // de pergamino desplegado".
    const texIzqTit = this.textures.get('banner_izq').getSourceImage();
    const texDerTit = this.textures.get('banner_der').getSourceImage();
    const capWTit = Math.round(texIzqTit.width * (pillH / texIzqTit.height));
    const capWDerTit = Math.round(texDerTit.width * (pillH / texDerTit.height));
    const midWTit = Math.max(1, pillW - capWTit - capWDerTit);
    const cartelIzq = this.add.image(400 - pillW / 2 + capWTit / 2, pillCenterY, 'banner_izq').setDisplaySize(capWTit, pillH).setDepth(901);
    const cartelCentro = this.add.image(400 - pillW / 2 + capWTit + midWTit / 2, pillCenterY, 'banner_centro').setDisplaySize(midWTit, pillH).setDepth(901);
    const cartelDer = this.add.image(400 + pillW / 2 - capWDerTit / 2, pillCenterY, 'banner_der').setDisplaySize(capWDerTit, pillH).setDepth(901);
    textoTitulo.setPosition(400, pillCenterY).setOrigin(0.5).setDepth(902);
    this._sprites.push(cartelIzq, cartelCentro, cartelDer);

    let y = pillCenterY + pillH / 2 + 12;

    caraFinal.setPosition(400, y + caraTam / 2);
    marcoAvatar.setPosition(400, y + caraTam / 2);
    y += caraTam + 10;

    if (campeonTxt) {
      campeonTxt.setPosition(400, y);
      y += campeonTxt.height + 16;
    }

    if (textoSubtitulo) {
      textoSubtitulo.setPosition(400, y);
      y += textoSubtitulo.height + 14;
    }

    if (hayJugadores) {
      // Línea divisoria fina — separa el cartel de resultado de arriba
      // del detalle de "quién ganó/perdió" de abajo, mismo criterio de
      // separadores tenues que ya usa Ranking.js (fila con
      // borderBottom dashed) en vez de dejarlo todo flotando junto.
      const anchoLinea = panelAncho - 60;
      const lineaDivisoria = this.add.graphics().setDepth(901);
      lineaDivisoria.lineStyle(2, 0x4A2C2A, 0.12);
      lineaDivisoria.lineBetween(400 - anchoLinea / 2, y, 400 + anchoLinea / 2, y);
      this._sprites.push(lineaDivisoria);
      y += 14;

      const filaAncho = panelAncho - 80;
      jugadoresFinal.forEach((j) => {
        const filaFondo = this.add.graphics().setDepth(901);
        const fy = y - filaJugadorAlto / 2;

        // Centésimo pase: pedido explícito del usuario — ya no son dos
        // mitades de un mismo bloque (franja de acento a la izquierda
        // nada más); cada fila pasa a ser una placa VISUALMENTE
        // INDEPENDIENTE, con su propio contorno fino alrededor entero
        // ("borde de madera fina" en la ganadora, "borde rojo carmesí"
        // en la perdedora) además del gap real que ya separa una de la
        // otra (ver `gapEntreFilas`, declarado arriba junto a
        // `panelAncho`). Se sacó la franja sólida de la izquierda — el
        // contorno completo ya cumple ese rol de "detalle de color" sin
        // necesitar las dos cosas a la vez.
        let colorTexto;
        if (j.gano) {
          // Pergamino claro ahuecado (sin cambios de tono respecto al
          // pase 263) + borde de madera fina (maderaClara, el mismo tono
          // que ya usa el resto de la mesa para marcos de madera) en vez
          // de la franja esmeralda sólida de antes — el verde esmeralda
          // queda como "detalle" en el filete interior, no como borde.
          filaFondo.fillStyle(0x4A2C2A, 0.18); // sombra sutil, da profundidad al hueco
          filaFondo.fillRoundedRect(400 - filaAncho / 2, fy, filaAncho, filaJugadorAlto, 8);
          filaFondo.fillStyle(0xFFF8ED, 1); // crema/pergamino
          filaFondo.fillRoundedRect(400 - filaAncho / 2 + 1.5, fy + 1.5, filaAncho - 3, filaJugadorAlto - 5, 6.5);
          filaFondo.fillStyle(0xFFFFFF, 0.35); // brillo superior sutil
          filaFondo.fillRoundedRect(400 - filaAncho / 2 + 1.5, fy + 1.5, filaAncho - 3, 7, 6.5);
          filaFondo.lineStyle(1, 0x2D9B4F, 0.5); // filete esmeralda interior — el "detalle" pedido
          filaFondo.lineBetween(400 - filaAncho / 2 + 10, fy + filaJugadorAlto - 2.5, 400 + filaAncho / 2 - 10, fy + filaJugadorAlto - 2.5);
          filaFondo.lineStyle(2, 0x6b4a34, 1); // maderaClara — borde de madera fina, entero
          filaFondo.strokeRoundedRect(400 - filaAncho / 2, fy, filaAncho, filaJugadorAlto, 8);
          colorTexto = '#3a2412'; // chocolate oscuro, legible sobre pergamino claro
        } else {
          // Cuero oscuro ahuecado (sin cambios de tono) + borde rojo
          // carmesí entero, mismo criterio que la ganadora.
          filaFondo.fillStyle(0x1a1410, 0.9); // negroPulido — base del hueco
          filaFondo.fillRoundedRect(400 - filaAncho / 2, fy, filaAncho, filaJugadorAlto, 8);
          filaFondo.fillStyle(0x4a3226, 1); // maderaMedia tratada como cuero
          filaFondo.fillRoundedRect(400 - filaAncho / 2 + 1.5, fy + 1.5, filaAncho - 3, filaJugadorAlto - 5, 6.5);
          filaFondo.fillStyle(0x000000, 0.22);
          filaFondo.fillRoundedRect(400 - filaAncho / 2 + 1.5, fy + 1.5, filaAncho - 3, 7, 6.5);
          filaFondo.lineStyle(2, 0xB0454B, 1); // rojo carmesí — borde entero
          filaFondo.strokeRoundedRect(400 - filaAncho / 2, fy, filaAncho, filaJugadorAlto, 8);
          colorTexto = '#FFF8ED'; // crema, legible sobre cuero oscuro
        }
        this._sprites.push(filaFondo);

        // Pase 201: se quita el chip de avatar con la inicial del
        // nombre (pedido del usuario: "con el nombre alcanza") — el
        // texto de la fila arranca directo después del borde izquierdo.
        const filaTexto = this.add.text(400 - filaAncho / 2 + 14, y, j.nombre, {
          fontFamily: 'Nunito, Arial', fontSize: '13px', fontStyle: 'bold', color: colorTexto,
          ...(j.gano ? {} : { stroke: '#000000', strokeThickness: 2 }),
        }).setOrigin(0, 0.5).setDepth(902);
        this._sprites.push(filaTexto);

        // Centésimo pase: la etiqueta "🏆 Ganador" (texto) se reemplaza
        // por un ícono de trofeo real en el extremo derecho — pedido
        // explícito del usuario ("ícono de Copa/Trofeo dorado 3D en el
        // extremo derecho"), en vez de un emoji adentro del texto. La
        // fila perdedora mantiene su etiqueta de texto "Perdedor" (no se
        // pidió ningún ícono para ese lado).
        if (j.gano) {
          const iconoTrofeo = this.add.image(400 + filaAncho / 2 - 16, y, 'trofeoFila')
            .setDisplaySize(24, 24).setDepth(902);
          this._sprites.push(iconoTrofeo);
        } else {
          const filaEtiqueta = this.add.text(400 + filaAncho / 2 - 12, y, 'Perdedor', {
            fontFamily: 'Nunito, Arial', fontSize: '12px', fontStyle: 'bold', color: '#f0a3a3',
            stroke: '#000000', strokeThickness: 2,
          }).setOrigin(1, 0.5).setDepth(902);
          this._sprites.push(filaEtiqueta);
        }

        y += filaJugadorAlto + gapEntreFilas;
      });
      // La última fila ya suma `gapEntreFilas` de más (el gap es "contra
      // la siguiente fila", pero no hay una siguiente) — se resta antes
      // de sumar el margen real de cierre de esta sección.
      y -= gapEntreFilas;
      y += 16;
    }

    if (!esTorneo) {
      // Centésimo pase: placa de fondo para el texto de estado de la
      // revancha — arranca invisible (la mayoría de los estados de este
      // texto, "Esperando confirmación…", no llevan placa, solo texto
      // apagado como antes). Se muestra solo cuando `_mostrarAlertaRevancha`
      // la necesita (el aviso de "se agotó el tiempo"). Se crea ACÁ, no
      // dentro de `_mostrarAlertaRevancha`, porque esta es la única vez
      // que se conoce el ancho/posición real del panel — después solo se
      // redimensiona con `.clear()` + redibujado.
      this.fondoAlertaRevancha = this.add.graphics().setDepth(901).setVisible(false);
      this._sprites.push(this.fondoAlertaRevancha);

      this.textoEsperaRevancha = this.add.text(400, y, '', {
        fontFamily: 'Nunito, Arial', fontSize: '12px', fontStyle: 'bold', color: '#7a6660', align: 'center',
        wordWrap: { width: panelAncho - 40 },
      }).setOrigin(0.5, 0).setDepth(902);
      this._sprites.push(this.textoEsperaRevancha);
      y += 20;

      // Ducentésimo septuagésimo segundo pase: pedido explícito del
      // usuario — sacar el ícono/emoji de la izquierda, texto limpio.
      const revanchaTexto = 'Pedir revancha';
      const revanchaAncho = this._medirAnchoTextoOverlay(revanchaTexto, '13px') + 44;
      const { contenedor: contRevancha, img: imgRevancha } = this._crearBotonOverlay({
        x: 400, y: y + altoBotonFinal / 2, ancho: revanchaAncho, alto: altoBotonFinal, variante: 'verde', texto: revanchaTexto, tamanoFuente: 13,
        onClick: () => {
          this.socket.emit('pedir-revancha', { codigoSala: this.codigoSala });
          // Nonagésimo sexto pase: antes el estado "ya pedida" se
          // simulaba redibujando el Graphics con menos opacidad.
          // Ducentésimo septuagésimo segundo pase: pedido explícito del
          // usuario — los botones de esta pantalla deben quedar siempre
          // en alpha 1.0 (nada semitransparente). El estado "ya pedida"
          // ahora se marca solo con un tinte gris apagado sobre el
          // sprite (sigue 100% opaco) en vez de bajar la opacidad.
          contRevancha.disableInteractive();
          if (imgRevancha) imgRevancha.setTint(0x8a9e8a);
        },
      });
      // Centésimo pase: guardadas como propiedades de la escena — el
      // handler de 'revancha-cancelada' (registrado en create(), fuera de
      // esta función) necesita apagar este botón cuando se agota el
      // tiempo, y no tenía ninguna referencia a él hasta ahora.
      this.contRevancha = contRevancha;
      this.imgRevancha = imgRevancha;
      y += altoBotonFinal + 8;
    }

    const labelBoton = esTorneo ? '🏆 Ver bracket' : 'Volver al lobby';
    const volverAncho = this._medirAnchoTextoOverlay(labelBoton, '13px') + 44;
    this._crearBotonOverlay({
      x: 400, y: y + altoBotonFinal / 2, ancho: volverAncho, alto: altoBotonFinal, variante: 'dorado', texto: labelBoton, tamanoFuente: 13,
      onClick: () => {
        if (esTorneo && this.onVerBracket) {
          this.onVerBracket(torneoId);
        } else if (this.onVolverLobby) {
          // Pase siguiente: se manda junto lo que haya quedado guardado
          // arriba en el handler de 'juego-terminado' — así el popup de
          // logro desbloqueado aparece recién en el Lobby, no acá.
          this.onVolverLobby(this._logrosDesbloqueadosPendientes || []);
        }
      },
    });
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
    this.textoEsperaRevancha.setText(mensaje).setColor('#8c2a2a').setFontStyle('bold').setFontSize('10px');
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
      (!!e.flor.nivel && !e.flor.resuelto);

    // Pase siguiente (placa doble): cada lado tiene su propia placa/texto
    // ahora (antes un solo "N - N" combinado en `scoreText`) — cada
    // número, solo, casi nunca llega a 2 cifras muy seguido (el truco se
    // juega a 15/30), así que ya no hace falta el ajuste de fontSize que
    // tenía el texto combinado.
    this.scoreText.setText(String(e.scores.yo));
    if (this.scoreTextRival) this.scoreTextRival.setText(String(e.scores.rival));
    this.miManoTexto.setText(e.esMano ? 'Sos mano' : '');
    if (this.manoIconoPropio) this.manoIconoPropio.setVisible(!!e.esMano);
    this.turnoText.setText(e.turno === 'mio' ? '● Tu turno' : '');
    // Pase siguiente: anillo del propio turno — mismo mecanismo que el
    // del rival, pero alrededor de "● Tu turno" (que ya vive justo
    // arriba de "Sos mano"/el ícono de mano propia, a pedido del
    // usuario). Aplica tanto en 1v1 como en equipos (turnoText no
    // depende de esModoEquipos). Antes no había NINGÚN indicador de
    // tiempo para el turno propio en la web — solo el número ⏱ arriba,
    // lejos de las cartas.
    if (e.turno === 'mio') {
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
    if (this.manoIconoRival) this.manoIconoRival.setVisible(!esModoEquipos);

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
    const esTurnoRival = !esModoEquipos && e.turno !== 'mio';
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
      this._ajustarMesaSegunAsientos(2);
      this._nombreRivalActual = e.nombreRival || null;
      this.labelRival.setText(this._truncarNombre(e.nombreRival) || 'Rival');

      // Pase siguiente: anillo de tiempo (paridad con el nativo, pase
      // 177) — antes usaba el rectángulo dinámico de la placa vieja;
      // ahora la placa del rival es fija (`PLACA_RIVAL_CX/CY`, ver
      // create()), así que el anillo se calcula directo de esas
      // constantes en vez de medir texto.
      if (esTurnoRival) {
        this._anilloRect = {
          x: this.PLACA_RIVAL_CX - 48, y: this.PLACA_RIVAL_CY - 24,
          w: 96, h: 48, r: 9,
        };
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
        this._dibujarFilaCartasReveladas(revelacionRival.cartas, 80);
      } else {
        this._dibujarFilaDorso(e.cartasRivalEnMano, 80);
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
      this._dibujarDueloCartas(e.jugadasRival, e.misJugadas, 220, 0.66, 60);
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
            this._dibujarManoJugador(e.misCartas, 495, e.turno === 'mio' && !hayCantoSinResolver, animarReparto);
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
    const centroY = esTresVTres ? 320 : 250;
    // _dibujarJugador hace su propia clasificación de ángulo (para ubicar
    // las cartas jugadas de cada asiento) contra un centro de mesa
    // hardcodeado por separado — se sincroniza acá para que las dos cuentas
    // usen siempre el mismo centro y no se desalineen entre sí.
    this._centroMesaYActual = centroY;
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

      const px = centroX + Math.cos(rad) * radioXAsiento;
      const py = centroY + Math.sin(rad) * radioYAsiento;
      this._dibujarJugador(jugador, px, py, angulo, tipo);
    });

    // Sexagésimo primer/segundo pase — mismo aumento de escala que en 1v1
    // (0.45→0.56→0.65), para que la carta propia jugada al centro tenga el
    // mismo peso visual en 2v2/3v3. Sexagésimo tercer pase: bajada un poco
    // (0.65→0.60) junto con el ajuste de 1v1 — en equipos no hay una sola
    // "carta rival" para enfrentar en este mismo lugar (las de compañeros/
    // rivales viven junto a cada asiento, ver _dibujarJugador), así que
    // sigue siendo una fila simple, sin DueloCartas.
    this._dibujarFilaCartas(e.misJugadas, 340, false, false, 0.60, false, 30);
    // Pase siguiente: mismo ajuste que en 1v1 (ver el otro call site,
    // dentro del bloque no-equipos de _renderizarEstado) — la mano
    // propia comparte la misma barra de botonera en cualquier modo.
    // Nonagésimo primer pase: mismo +10px (505→515) que el otro call site.
    // Nonagésimo segundo pase: mismo +10px (515→525) que el otro call site.
    // Nonagésimo tercer pase: mismo -30px (525→495) que el otro call site.
    this._dibujarManoJugador(e.misCartas, 495, e.turno === 'mio' && !hayCantoSinResolver, animarReparto);
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
    g.fillStyle(0x000000, 0.4); // sombra proyectada
    g.fillCircle(rx + 1.2, ry + 1.6, 7.5);
    g.fillStyle(0x7a5322, 1); // remacheOscuro (anillo de base)
    g.fillCircle(rx, ry, 6.5);
    g.fillStyle(0xc9973e, 1); // remache (cuerpo bronce)
    g.fillCircle(rx, ry, 5);
    g.fillStyle(0x5a3d18, 0.55); // sombra interna (esfericidad)
    g.fillCircle(rx + 1, ry + 1, 3.5);
    g.fillStyle(0xf0d9a0, 0.95); // remacheClaro (brillo especular)
    g.fillCircle(rx - 1.5, ry - 1.5, 2);
  });
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
_dibujarPlacaMarcador(g, cx, cy, w, h) {
  g.clear();
  const x = cx - w / 2;
  const y = cy - h / 2;
  const r = 6;

  // Sombra de caída, apenas desplazada hacia abajo — mismo truco que el
  // boxShadow con capas oscuras del CSS, para dar sensación de placa con
  // volumen en vez de un rectángulo plano.
  g.fillStyle(0x000000, 0.35);
  g.fillRoundedRect(x, y + 2, w, h, r);

  // Cuerpo: Graphics no tiene un gradiente confiable entre Canvas/WebGL,
  // así que el degradé madera del CSS (maderaClara→maderaMedia→
  // maderaOscura, 160deg) se aproxima con 3 capas sólidas apiladas: base
  // oscura, cuerpo medio, y una franja clara arriba a modo de bisel.
  // Nonagésimo pase: colores re-calibrados a mano (con el cuentagotas)
  // sobre el asset nuevo de la placa de la botonera, para que el
  // marcador use "la misma textura" que pidió el usuario — el tono
  // viejo (marrón casi negro, 0x2a1c14/0x4a3226/0x6b4a34) era el mismo
  // lenguaje que Lobby/Torneos/Ranking, pero más oscuro y menos rojizo
  // que la madera terracota del asset nuevo.
  g.fillStyle(0x431c10, 1); // maderaOscura
  g.fillRoundedRect(x, y, w, h, r);
  g.fillStyle(0xa84e31, 1); // maderaMedia
  g.fillRoundedRect(x, y, w, h * 0.72, r);
  g.fillStyle(0xd37a4a, 0.55); // maderaClara (bisel superior)
  g.fillRoundedRect(x + 2, y + 2, w - 4, h * 0.32, r * 0.7);

  // Borde — mismo tono (sampleado directo del PNG de la botonera) en vez
  // del negro pulido viejo.
  g.lineStyle(2, 0x6b271d, 1);
  g.strokeRoundedRect(x, y, w, h, r);

  // Pase siguiente (feedback: "fondo marrón oscuro muy simple"): una
  // sola línea de borde + 3 rectángulos apilados se leía plano a este
  // tamaño chico — se agrega un filete claro fino, apenas adentro del
  // borde negro, solo en el semi-perímetro superior (mismo truco que un
  // `border-top`/`border-left` más claro en CSS para simular el canto
  // recibiendo luz de una placa con volumen real).
  g.lineStyle(1, 0xc98a5e, 0.5);
  g.beginPath();
  g.moveTo(x + r, y + 1);
  g.lineTo(x + w - r, y + 1);
  g.strokePath();

  // 4 remaches de bronce en las esquinas, mismo criterio que los <span>
  // circulares del CSS (radial-gradient remacheClaro→remache→
  // remacheOscuro). Pase siguiente (feedback del usuario: "se ven como
  // círculos agregados sin sombra ni relieve 3D") — la versión anterior
  // era 3 círculos concéntricos con el MISMO centro, que a este tamaño se
  // leen como un solo punto plano. Ahora cada remache es una composición
  // de 5 capas con luz viniendo de arriba-izquierda (mismo criterio que
  // el resto de esta escena): sombra blanda proyectada hacia abajo-
  // derecha (lo despega de la madera), anillo oscuro de base, cuerpo
  // bronce, una sombra interna hacia abajo-derecha (da volumen esférico,
  // no solo un disco) y un brillo especular arriba-izquierda.
  const margen = 7.5;
  [
    { rx: x + margen, ry: y + margen },
    { rx: x + w - margen, ry: y + margen },
    { rx: x + margen, ry: y + h - margen },
    { rx: x + w - margen, ry: y + h - margen },
  ].forEach(({ rx, ry }) => {
    g.fillStyle(0x000000, 0.35); // sombra proyectada
    g.fillCircle(rx + 0.9, ry + 1.3, 4.8);
    g.fillStyle(0x3a1a0a, 1); // remacheOscuro (anillo de base)
    g.fillCircle(rx, ry, 4.2);
    g.fillStyle(0xe3a94a, 1); // remache (cuerpo bronce, sampleado del PNG de la botonera)
    g.fillCircle(rx, ry, 3.2);
    g.fillStyle(0x8a5a28, 0.6); // remacheOscuro (sombra interna, da esfericidad)
    g.fillCircle(rx + 0.7, ry + 0.7, 2.3);
    g.fillStyle(0xf2d587, 0.95); // remacheClaro (brillo especular)
    g.fillCircle(rx - 1, ry - 1, 1.3);
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

    if (manoCompartida) {
      // Cartas reales boca arriba (compañero compartiendo su mano, o
      // revelación de Flor/Envido): antes usaban la MISMA fórmula de abanico
      // rotado y comprimido que los dorsos de abajo (radioAbanico=22 da
      // apenas un par de píxeles de separación real entre 3 cartas), así
      // que quedaban casi apiladas y giradas — imposibles de leer. Acá van
      // planas (sin rotación) y con más separación y tamaño, para poder
      // distinguir palo y número.
      const anchoCarta = 50;
      const altoCarta = 76;
      const factor = this._factorEscalaTextura();
      const anchoR = Math.round(anchoCarta * factor);
      const altoR = Math.round(altoCarta * factor);
      // La revelación de Flor/Envido separa más las cartas (hay tiempo de
      // sobra para mirarlas); compartir mano en vivo las solapa un poco más
      // para no tapar tanto el resto de la mesa.
      const espaciadoX = revelacion ? anchoCarta * 0.62 : anchoCarta * 0.42;
      const inicioX = cx - ((cantidad - 1) * espaciadoX) / 2;

      for (let k = 0; k < cantidad; k++) {
        const keyOriginal = `${cartasParaDibujar[k].valor}_${cartasParaDibujar[k].palo}`;
        const textureKey = `${keyOriginal}_${anchoR}x${altoR}`;
        this._crearTexturaEscalada(keyOriginal, textureKey, anchoR, altoR);

        const px = inicioX + k * espaciadoX;
        const carta = this.add.image(px, cy, textureKey)
          .setOrigin(0.5, 0.5)
          .setDepth(10 + k);

        this._sprites.push(carta);
      }
    } else {
      // Dorsos ocultos: se mantiene el abanico compacto rotado — acá no
      // importa la legibilidad porque todas las cartas son iguales.
      const anguloPorCarta = 9;
      const anguloTotalAbanico = (cantidad - 1) * anguloPorCarta;
      const radioAbanico = 22;
      const bulto = 3.5;

      for (let k = 0; k < cantidad; k++) {
        const anguloCarta = -anguloTotalAbanico / 2 + k * anguloPorCarta;
        const radCarta = anguloCarta * (Math.PI / 180);
        const spread = Math.sin(radCarta) * radioAbanico;
        const bulge = (1 - Math.cos(radCarta)) * bulto;

        const px = cx + spread;
        const py = cy - bulge;

        const carta = this.add.image(px, py, this._claveDorsoMiniActual || 'cardBackMini')
          .setOrigin(0.5, 0.5)
          .setRotation(radCarta)
          .setDepth(10 + k);

        this._sprites.push(carta);
      }
    }

    const colorFondo = esSuTurno ? '#00000099' : (tipo === 'companero' ? '#1565C0cc' : '#8B1A1Acc');
    const esManoDeEste = this.estado.manoId === j.id;
    const nombreTxt = this.add.text(cx, cy - 40, `${j.nombre}${esSuTurno ? ' ●' : ''}${esManoDeEste ? ' 🂠' : ''}`, {
      font: esSuTurno ? 'bold 12px Arial' : '12px Arial',
      fill: esSuTurno ? '#FFD700' : '#ffffff',
      backgroundColor: colorFondo,
      padding: { x: 5, y: 2 }
    }).setOrigin(0.5).setDepth(50);
    // Centésimo décimo quinto pase: nombre clickeable en equipos (2v2/3v3),
    // mismo criterio que 1v1 (ver labelRival) — acá se recrea en cada
    // render, así que el listener puede capturar `j.nombre` directo del
    // closure, sin necesitar una variable de instancia aparte.
    nombreTxt.setInteractive({ useHandCursor: true });
    nombreTxt.on('pointerdown', () => {
      if (j.nombre && this.onVerPerfil) this.onVerPerfil(j.nombre);
    });
    this._sprites.push(nombreTxt);

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
      const padX = 5, padY = 2;
      this._anilloRect = {
        x: cx - nombreTxt.width / 2 - padX,
        y: (cy - 40) - nombreTxt.height / 2 - padY,
        w: nombreTxt.width + padX * 2,
        h: nombreTxt.height + padY * 2,
        r: 8,
      };
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
      const baseX = centroMesaX + outX * outLen * fraccionHaciaAsiento;
      const baseY = centroMesaY + outY * outLen * fraccionHaciaAsiento;
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
      const anchoBaseJugadaR = Math.round(58 * factorJugada);
      const altoBaseJugadaR = Math.round(87 * factorJugada);

      jugadas.forEach((carta, idx) => {
        const esUltima = idx === jugadas.length - 1;
        const offset = (jugadas.length - 1 - idx) * pasoApilado;
        const px = baseX + outX * offset;
        const py = baseY + outY * offset;
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
        const persp = this._calcularPerspectiva(py);
        const anchoCarta = 58 * persp.scale;
        const altoCarta  = 87 * persp.scale;

        const img = this.add.image(px, py, keyEscalada)
          .setDisplaySize(anchoCarta, altoCarta)
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
  const margen = 3;
  const g = this.add.graphics().setPosition(x, y).setRotation(rotacion).setDepth(depth);
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
    const anchoCarta = 86;
    const altoCarta  = 118;
    const cantidad   = cartas.length;

    const anguloTotalMax = 26;
    const anguloPorCarta = cantidad > 1 ? anguloTotalMax / (cantidad - 1) : 0;
    const espaciadoX = 70;
    // 19 (antes 25) — la carta del medio invadía bastante el centro del
    // tapete al levantarse; se acortó el "bulto" del abanico para que la
    // mano se sienta anclada más cerca de la botonera y no tan metida en la
    // mesa (punto 4 de la lista de diseño, "espaciado y respiración").
    const bulto = 19;

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
      const borde = this._dibujarBordeSticker(
        animar ? 400 : destinoX, animar ? 300 : destinoY,
        anchoCarta, altoCarta, animar ? 0 : radCarta, 0.5, 0.85, 10 + i - 0.5
      ).setAlpha(animar ? 0 : 1);

      const img = this.add.image(animar ? 400 : destinoX, animar ? 300 : destinoY, keyMano)
        .setOrigin(0.5, 0.85)
        .setDepth(10 + i)
        .setAlpha(animar ? 0 : 1)
        .setRotation(animar ? 0 : radCarta);

      if (!jugable) {
        img.setTint(0x888888);
      }

      if (animar) {
        this.time.delayedCall(i * 130, () => {
          if (!img.scene) return;
          img.setAlpha(1);
          borde.setAlpha(1);
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
          try { this.sound.play('jugar-carta', { volume: 0.6 }); } catch (err) {}
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

  const rondaRecienTerminada = anterior.rondaActiva && !e.rondaActiva;
  if (!rondaRecienTerminada) return;
  if (!e.envidoPendienteDeMostrar || e.envidoPendienteDeMostrar.length === 0) return;

  const puntos = e.ultimoResultadoEnvido?.puntosGanador;
  const texto = puntos != null ? `${puntos} tantos en mesa` : 'Tantos en mesa';

  if (this._tantosEnMesaTimer) { this._tantosEnMesaTimer.remove(); this._tantosEnMesaTimer = null; }
  this._mostrarCanto(texto);
  this._tantosEnMesaTimer = this.time.delayedCall(3200, () => {
    this._ocultarCanto();
    this._tantosEnMesaTimer = null;
  });

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
    const anguloPorCarta = 11;
    const anguloTotal = (cantidad - 1) * anguloPorCarta;
    // Pase siguiente (feedback del usuario: "se ven planas y muy
    // juntas"): un poco más de separación horizontal (52→58) y una sombra
    // proyectada sobre el paño por cada dorso (mismo criterio que ya
    // tienen las cartas de la mano propia en _dibujarManoJugador) — antes
    // esta fila no tenía ninguna sombra, de ahí la sensación de "pegadas"
    // al fondo sin profundidad física.
    const espacio = 58;
    const inicioX = 400 - ((cantidad - 1) * espacio) / 2;
    const bulto = 9;
    const anchoCarta = 63;
    const altoCarta = 95;

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
    const anchoCarta = 75;
    const altoCarta = 112;
    const espacio = 85; // ancho de la carta + margen, sin superposición
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
      const anchoFinal = anchoBase * persp.scale;
      const altoFinal  = altoBase * persp.scale;

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

_dibujarFilaCartas(cartas, y, jugable, esMiMano = false, escala = 1, animar = false, depthBase = 10) {
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
      const rotacion = 0;

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
      const anchoFinal = anchoBase * persp.scale;
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
          try { this.sound.play('jugar-carta', { volume: 0.6 }); } catch (err) {}
          this.socket.emit('jugar-carta', { codigoSala: this.codigoSala, cartaId: carta.id });
        });
      }

      this._sprites.push(img);
    });
}

_hashSimple(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
    }
    return Math.abs(hash);
}

_calcularPerspectiva(y) {
    const centroMesaY = 320;
    const radioY = 170;
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
    const medidor = this.add.text(0, 0, texto, {
      fontFamily: 'Nunito, Arial', fontSize: `${tamanoFuente}px`, fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    });
    const anchoTexto = medidor.width;
    medidor.destroy();

    const PAD_X = 20;
    const texIzq = this.textures.get('tengoIzq').getSourceImage();
    const texDer = this.textures.get('tengoDer').getSourceImage();
    const capIzq = texIzq.width * (alto / texIzq.height);
    const capDer = texDer.width * (alto / texDer.height);
    // Igual que el "anchoSeguro" de `_crearBotonOverlay`: nunca más angosto
    // que las dos puntas juntas + un tramo recto mínimo, para que no
    // degenere en forma de almendra con puntajes de 1 dígito.
    return Math.max(anchoTexto + PAD_X * 2, capIzq + capDer + 20);
  }

  _crearBoton({ x, y, ancho, alto = 44, texto, colorFondo, colorTexto, imagen = null,
              colorBorde = 0x4A2C2A, grosorBorde = 3, radio = 12, tamanoFuente = 15,
              onClick, deshabilitado = false }) {
  const contenedor = this.add.container(x, y).setDepth(200);
  const hijos = [];

  if (imagen === 'Tengo') {
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
  if (texto) {
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
      remaches.lineStyle(3, 0x1a1410, 1);
      remaches.strokeCircle(dx, dy, 5);
      remaches.fillStyle(0xc9973e, 1);
      remaches.fillCircle(dx, dy, 4);
      remaches.fillStyle(0xf0d9a0, 0.85);
      remaches.fillCircle(dx - 1, dy - 1, 1.4);
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
  this.cantoText.setText(texto).setPosition(400, 300).setAlpha(1).setVisible(true);

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

  this.cantoBanner = this.add.container(400, 300, [izqCanto, centroCanto, derCanto]).setDepth(249);
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
  const centrarFila = (specs, y, gap = GAP) => {
    const anchoNatural = specs.reduce((acc, s) => acc + s.ancho, 0) + gap * (specs.length - 1);
    const anchoDisponible = this.anchoBotonera - 40;
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
    const gapFinal = gap * factor;
    const anchoTotal = anchoNatural * factor;
    let cursorX = CENTRO_X - anchoTotal / 2;
    specs.forEach((s) => {
      const anchoFinal = s.ancho * factor;
      const altoFinal = s.alto * factor;
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
    return { alto: ALTO_BOTON_FIJO, imagen: clave, ancho: this._anchoBotonImagen(clave, ALTO_BOTON_FIJO), onClick, ...opciones };
  };

  // Ducentésimo sexagésimo noveno pase: `yCentroBotonera` (ver create()) es
  // el centro vertical REAL de la placa de madera (hoy 565, a partir de su
  // alto real de 130px) — reemplaza los números sueltos 550/525/575 que
  // quedaron pegados a la placa vieja de 100px (pase 73, antes de que el
  // pase 92 agrandara la placa sin tocar estos números), causa real del
  // "los botones quedaron corridos hacia arriba" reportado por el usuario.
  const Y_FILA_UNICA = this.yCentroBotonera;
  const GAP_FILAS = 6;
  const OFFSET_FILAS = (ALTO_BOTON_FIJO + GAP_FILAS) / 2;
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
    const specsFila = itemsFila.map(it => specImagen(it.id, it.onClick));
    // Ducentésimo sexagésimo noveno pase: Y_FILA_UNICA en vez del 565 suelto
    // (coincidía por casualidad con el centro real de la placa — ahora es
    // la misma constante que usan todas las demás filas, en vez de un
    // número que había que mantener sincronizado a mano con `yBotonera`).
    centrarFila(specsFila, Y_FILA_UNICA, 8);
  }
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
    [
      'estado-juego', 'jugador-unido', 'partida-iniciada', 'jugador-desconectado',
      'error-sala', 'error-jugada', 'sala-cancelada', 'juego-terminado',
      'revancha-estado', 'revancha-lista', 'revancha-cancelada', 'turno-timer', 'info-sala'
    ].forEach(evento => this.socket.off(evento));
  }
}