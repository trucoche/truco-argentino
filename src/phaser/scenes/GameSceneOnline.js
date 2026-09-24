import Phaser from 'phaser';
import { getSocket } from '../../services/socket';
import { ANCHO_MAX_CSS } from '../config/gameConfigOnline';
import { CARD_RANKS } from '../utils/constants';

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
    this.load.image('mesaRedonda', conVersion('assets/images/juego/mesa-truco.png'));
    this.load.image('mesaRedonda3v3', conVersion('assets/images/juego/mesa-truco-3v3.png'));
    // Fase 6 — fondo de la barra de acciones ("madera + filete dorado"),
    // reemplaza el rectángulo de color plano que había antes (ver
    // _crearElementosDeTexto). Imagen de 800x110, misma proporción que el
    // rectángulo que reemplaza, así que no hace falta tocar ninguna posición.
    this.load.image('panelBotonera', conVersion('assets/images/juego/panel-botonera.png'));
    // Trigésimo cuarto pase: placa de madera para el marcador de puntaje,
    // reemplaza el rectángulo dorado dibujado por código.
    this.load.image('panelPuntaje', conVersion('assets/images/juego/panel-puntaje.png'));

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
    // se encola aparte — es la misma tablita de "Quiero" pero sin texto
    // horneado (ver Tengo.png), con el número dibujado encima en
    // `_crearBoton` (branch `imagen && texto`).
    this.load.image('boton_img_Tengo', conVersion('assets/images/juego/ui-botones-canva-final/Tengo.png'));
    this.load.audio('jugar-carta', 'assets/sounds/CardGame-SoundEffect.mp3');
    this.load.audio('ganar',       'assets/sounds/ganarpartidasonido.mp3');
    this.load.audio('repartir',    'assets/sounds/repartir_cartas.mp3');
    this.load.image('fondoEspera', conVersion('assets/images/juego/fondo-espera.jpeg'));
    const PERSONAJES_CANTO = ['gaucho', 'gaucha', 'gaucho2', 'gaucha2'];
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
    // una placa chica (Graphics, se redibuja en cada estado según el ancho
    // real del nombre) detrás de nombre+ícono, para que las dos placas
    // (marcador + info del rival) se lean como un solo bloque de HUD en vez
    // de "puntaje con placa" + "nombre suelto flotando sobre el paño".
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

    this.labelRival = this.add.text(112, 18, 'Rival', { font: '14px Arial', fill: '#ffffffdd' }).setOrigin(0, 0.5).setDepth(1002);
    // Centésimo décimo quinto pase: nombre del rival clickeable, mismo
    // criterio que Ranking/Lobby/chat/Perfil (abre PerfilRivalModal). Se
    // deja interactivo una sola vez acá afuera del render loop — el texto
    // se actualiza en cada `_renderizarEstado` pero el listener siempre lee
    // `this._nombreRivalActual`, que se guarda ahí mismo.
    this.labelRival.setInteractive({ useHandCursor: true });
    this.labelRival.on('pointerdown', () => {
      if (this._nombreRivalActual && this.onVerPerfil) this.onVerPerfil(this._nombreRivalActual);
    });
    // Trigésimo segundo pase: antes era el circulito de "es mano" (solo
    // visible cuando el rival era mano) — ahora es un ícono de persona
    // siempre visible junto al label, y el que "se prende" (dorado, con
    // pulso) o "se apaga" (gris, quieto) según de quién es el turno, no
    // según quién es mano. Ver _renderizarEstado (_rivalTurnoEncendido).
    this.manoIconoRival = this.add.image(228, 18, 'icono_rival').setDisplaySize(19, 22).setDepth(1002).setVisible(false);

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
    this.add.image(400, 555, 'panelBotonera').setDisplaySize(800, 110).setDepth(150);

    // Trigésimo cuarto pase: el rectángulo dorado dibujado por código se
    // reemplazó por una placa de madera (imagen del usuario), respetando su
    // relación de aspecto real. Primer intento a 110×70 quedó "muy placa
    // para tan poco texto" (feedback del usuario) — trigésimo quinto pase:
    // se achicó a 72×46 y el texto subió de 18 a 20px. Trigésimo octavo
    // pase: nueva versión de la imagen (aspecto real ≈1.52:1, levemente
    // distinto) — se ajustó el alto a 48 para no forzar la proporción.
    const marcadorAncho = 72;
    const marcadorAlto = 48;
    // Decimoctavo pase: el marcador vivía centrado en (400,18), justo en el
    // mismo punto donde caen el texto de estado ("Conectando...") y las
    // cartas boca abajo del rival (fila que arranca en Y=95 más abajo) —
    // los tres se amontonaban ahí. Se lo movió a una placa fija arriba a la
    // izquierda (x=68) para liberar el centro superior por completo.
    const marcadorX = 68;
    // Cuadragésimo tercer pase: con el panel de madera nuevo (cuadragésimo
    // segundo pase), el usuario notó que el número quedaba desalineado
    // respecto de la placa — se baja solo la IMAGEN unos px (el texto se
    // queda en su Y de siempre) para recentrarla contra la numeración.
    const marcadorImagenOffsetY = 4;

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
    // Fix: subir el marcador (imagen + texto) a depth > 1000 para que
    // quede POR ENCIMA del viñeteado, como corresponde a un elemento de
    // HUD — no es parte de la mesa que el viñeteado debería atenuar.
    this.scoreBg = this.add.image(marcadorX, 18 + marcadorImagenOffsetY, 'panelPuntaje').setDisplaySize(marcadorAncho, marcadorAlto).setDepth(1001);

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
    this.scoreText = this.add.text(marcadorX, 21, '0 - 0', {
      fontFamily: 'Nunito, Arial',
      fontSize: '20px',
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
    this.manoIconoPropio = this.add.image(650, 472, 'circulo_mano').setDisplaySize(24, 24).setDepth(200).setVisible(false);
    this.miManoTexto = this.add.text(666, 472, '', {
      font: 'bold 15px Arial', fill: '#FFD700', stroke: '#000000', strokeThickness: 3
    }).setOrigin(0, 0.5).setDepth(200);

    // Texto de notificaciones persistente — lo usan error-sala, error-jugada,
    // jugador-desconectado DURANTE toda la partida, no solo en la espera.
    // Decimoctavo pase: subido de Y=45 a Y=16 (con el marcador ya afuera del
    // centro) para que quede claramente por ENCIMA de las cartas boca abajo
    // del rival (que ahora arrancan en Y=95) en vez de superpuesto con ellas.
    this.mensajeText = this.add.text(400, 16, 'Conectando...', {
      font: '16px Nunito, Arial', fill: '#ffffaa'
    }).setOrigin(0.5).setDepth(301);

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
    this.turnoText = this.add.text(678, 450, '', {
      font: 'bold 15px Arial', fill: '#FFD700', stroke: '#000000', strokeThickness: 3
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

    // Tarjeta de espera — tapa la mesa vacía hasta que arranca la partida.
    // Se destruye sola en el primer _limpiarSprites (primer estado-juego).
    this.fondoEspera = this.add.image(400, 300, 'fondoEspera').setDisplaySize(800, 600).setDepth(340);
    this._sprites.push(this.fondoEspera);
    this.veloEspera = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.35).setDepth(350);
    this._sprites.push(this.veloEspera);

    this.panelEspera = this.add.container(400, 300).setDepth(400);

    const fondoEsperaPanel = this.add.graphics();
    fondoEsperaPanel.fillStyle(0xFFF8ED, 1);
    fondoEsperaPanel.fillRoundedRect(-190, -90, 380, 180, 20);
    fondoEsperaPanel.lineStyle(4, 0x4A2C2A, 1);
    fondoEsperaPanel.strokeRoundedRect(-190, -90, 380, 180, 20);
    this.panelEspera.add(fondoEsperaPanel);

    this.textoEsperaCartel = this.add.text(0, -35, 'Esperando rival...', {
      font: '16px Nunito, Arial', fill: '#4A2C2A', align: 'center', wordWrap: { width: 340 }
    }).setOrigin(0.5);
    this.panelEspera.add(this.textoEsperaCartel);

    this.puntoEspera = this.add.text(0, -5, '●', { font: '20px Arial', fill: '#FFB627' }).setOrigin(0.5);
    this.panelEspera.add(this.puntoEspera);
    this.tweens.add({
      targets: this.puntoEspera, alpha: 0.2, duration: 500, yoyo: true, repeat: -1
    });

    // Pase siguiente: bug de coordenadas — `_crearBoton` crea su propio
    // `this.add.container(x, y)` posicionado en coordenadas de ESCENA
    // (absolutas). Acá el botón se agrega como hijo de `panelEspera`
    // (que ya está en (400,300)), así que sus x/y pasan a ser relativos
    // AL PANEL — con (400,340) terminaba renderizando en (800,640),
    // fuera del canvas de 800x600 (por eso "no aparece el botón para
    // volver al lobby" en web). El resto de los elementos del panel
    // (texto, punto animado) ya usan coordenadas relativas al centro del
    // panel (0,0) — el botón tiene que hacer lo mismo.
    this.botonVolverEspera = this._crearBoton({
      x: 0, y: 45, ancho: 180, colorFondo: 0x2E9BD6, texto: 'Volver al Lobby',
      onClick: () => {
        this.socket.emit('cancelar-espera', { codigoSala: this.codigoSala });
        if (this.onVolverLobby) this.onVolverLobby();
      }
    });
    this.panelEspera.add(this.botonVolverEspera);
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
    const CROP = { x: 36, y: 818, width: 1435, height: 1088 };
    const anchoDisplay = 690;
    const altoDisplay = anchoDisplay * (CROP.height / CROP.width) * FACTOR_ALTURA;

    this.mesaImg
      .setTexture('mesaRedonda')
      .setCrop(CROP.x, CROP.y, CROP.width, CROP.height)
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
  const ANCHO_FINAL = 56;
  const ALTO_FINAL  = 86;
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
    grad.addColorStop(1, 'rgba(30,15,8,0.38)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);
    this.textures.addCanvas('vinetaMadera', cv);
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

_conectarSocket() {
    // Modo preview: "PREVIEW_1V1" / "PREVIEW_2V2" / "PREVIEW_3V3" no abren
    // conexión real, solo simulan el estado para ajustar el layout de la
    // mesa sin crear salas de verdad.
    if (this.codigoSala?.startsWith?.('PREVIEW_')) {
      const modo = this.codigoSala.replace('PREVIEW_', '').toLowerCase();
      if (this.panelEspera) this.panelEspera.setVisible(false);
      if (this.botonVolverEspera) this.botonVolverEspera.setVisible(false);
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
      this.mensajeText.setText('');

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
      this.mensajeText.setText(data.mensaje);
      if (this.textoEsperaCartel && this.textoEsperaCartel.scene) {
        this.textoEsperaCartel.setText(data.mensaje);
      }
    });
    this.socket.off('partida-iniciada').on('partida-iniciada', (data) => {
      if (this.panelEspera) this.panelEspera.setVisible(false);
      if (this.botonVolverEspera) this.botonVolverEspera.setVisible(false);
      if (this.mesaImg) this.mesaImg.setVisible(true);
      if (this.sombraMesa) this.sombraMesa.setVisible(true);
    });
    this.socket.off('jugador-desconectado').on('jugador-desconectado', (data) => {
      this.mensajeText.setText(data.mensaje);
    });
    this.socket.off('error-sala').on('error-sala', (data) => {
      this.mensajeText.setText(data.mensaje).setColor('#ff5555');
    });
    this.socket.off('error-jugada').on('error-jugada', (data) => {
      this.mensajeText.setText(data.mensaje).setColor('#ff5555');
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
        const titulo = gano ? '🏆 ¡Ganaste!' : '😔 Perdiste';

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
          this._mostrarPantallaFinal(titulo, !!data.esCampeon, data.esTorneo, data.torneoId, data.jugadores, extra);
        });
      });
    this.socket.off('revancha-estado').on('revancha-estado', (data) => {
      this._actualizarEstadoRevancha(data.confirmados, data.total);
    });
    this.socket.off('revancha-lista').on('revancha-lista', (data) => {
      if (this.onRevancha) this.onRevancha(data.codigoSala);
    });
    this.socket.off('revancha-cancelada').on('revancha-cancelada', (data) => {
      if (this.textoEsperaRevancha) {
        this.textoEsperaRevancha.setText(data.mensaje).setColor('#ff5555');
      }
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
      this.mensajeText.setText('');

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

_mostrarPantallaFinal(titulo, esCampeon = false, esTorneo = false, torneoId = null, jugadoresFinal = null, subtitulo = '') {
this._limpiarSprites();
    this._ocultarCanto();
    this.children.list
      .filter(c => c !== undefined)
      .forEach(c => { if (c !== this.scoreBg && c !== this.scoreText) c.setVisible(false); });

    // Velo oscuro cubriendo toda la mesa
    const velo = this.add.rectangle(400, 300, 800, 600, 0x000000, 0.65).setDepth(900);
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

    // 1) Título — SIEMPRE dorado macizo (el nativo no lo hace variar
    // según ganó/perdió), ancho ceñido al texto real vía `.width` en vez
    // de una fórmula por cantidad de caracteres — mismo criterio que el
    // `carteloTitulo` nativo, que se ciñe por padding, no por un ancho
    // fijo adivinado.
    const padHTitulo = 18, padVTitulo = 6;
    const textoTitulo = this.add.text(0, 0, titulo, {
      fontFamily: 'Fredoka, Arial', fontSize: '22px', fontStyle: '600', color: '#4A2C2A', align: 'center',
    }).setDepth(902);
    const pillW = textoTitulo.width + padHTitulo * 2;
    const pillH = textoTitulo.height + padVTitulo * 2;
    this._sprites.push(textoTitulo);

    let altoContenido = padArriba + pillH;

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
    const hayJugadores = jugadoresFinal && jugadoresFinal.length > 0;
    if (hayJugadores) {
      altoContenido += jugadoresFinal.length * 32 + 16;
    }

    // 5) Botón de revancha (si no es torneo) — con su texto de estado
    // arriba (como en el nativo: "Esperando confirmación… (X/Y)" vive
    // ANTES del botón, no después) — y 6) botón de volver al lobby.
    if (!esTorneo) {
      altoContenido += 20 + 44 + 8;
    }
    altoContenido += 44;

    const panelAlto = Math.min(560, Math.max(220, altoContenido + padAbajo));
    const py = 300 - panelAlto / 2;
    const anilloGrosor = 5;

    const anillo = this.add.graphics().setDepth(900);
    anillo.fillStyle(0xFFB627, 1); // C.dorado
    anillo.fillRoundedRect(px - anilloGrosor, py - anilloGrosor, panelAncho + anilloGrosor * 2, panelAlto + anilloGrosor * 2, 24);
    this._sprites.push(anillo);

    const panel = this.add.graphics().setDepth(901);
    panel.fillStyle(0xFFF8ED, 1); // C.crema
    panel.fillRoundedRect(px, py, panelAncho, panelAlto, 20);
    panel.lineStyle(3, 0x4A2C2A, 1); // C.chocolate
    panel.strokeRoundedRect(px, py, panelAncho, panelAlto, 20);
    this._sprites.push(panel);

    const pillCenterY = py + padArriba + pillH / 2;
    const cartel = this.add.graphics().setDepth(901);
    cartel.fillStyle(0xFFB627, 1);
    cartel.fillRoundedRect(400 - pillW / 2, pillCenterY - pillH / 2, pillW, pillH, 10);
    textoTitulo.setPosition(400, pillCenterY).setOrigin(0.5);
    this._sprites.push(cartel);

    let y = pillCenterY + pillH / 2 + 12;

    if (campeonTxt) {
      campeonTxt.setPosition(400, y);
      y += campeonTxt.height + 16;
    }

    if (textoSubtitulo) {
      textoSubtitulo.setPosition(400, y);
      y += textoSubtitulo.height + 14;
    }

    if (hayJugadores) {
      const filaAncho = panelAncho - 80;
      jugadoresFinal.forEach((j) => {
        const colorAcento = j.gano ? 0x3E8E5A : 0xB0454B;
        const colorTexto = j.gano ? '#1f7a3c' : '#8c3a3a';
        const etiqueta = j.gano ? '🏆 Ganador' : 'Perdedor';

        const filaFondo = this.add.graphics().setDepth(901);
        filaFondo.fillStyle(0x4A2C2A, 0.05);
        filaFondo.fillRoundedRect(400 - filaAncho / 2, y - 14, filaAncho, 28, 8);
        filaFondo.fillStyle(colorAcento, 1);
        filaFondo.fillRoundedRect(400 - filaAncho / 2, y - 14, 5, 28, 2);
        this._sprites.push(filaFondo);

        const filaTexto = this.add.text(400 - filaAncho / 2 + 12, y, j.nombre, {
          fontFamily: 'Nunito, Arial', fontSize: '13px', fontStyle: 'bold', color: colorTexto,
        }).setOrigin(0, 0.5).setDepth(902);
        this._sprites.push(filaTexto);

        const filaEtiqueta = this.add.text(400 + filaAncho / 2 - 12, y, etiqueta, {
          fontFamily: 'Nunito, Arial', fontSize: '12px', fontStyle: 'bold', color: colorTexto,
        }).setOrigin(1, 0.5).setDepth(902);
        this._sprites.push(filaEtiqueta);

        y += 32;
      });
      y += 16;
    }

    if (!esTorneo) {
      this.textoEsperaRevancha = this.add.text(400, y, '', {
        fontFamily: 'Nunito, Arial', fontSize: '12px', fontStyle: 'bold', color: '#7a6660', align: 'center',
        wordWrap: { width: panelAncho - 40 },
      }).setOrigin(0.5, 0).setDepth(902);
      this._sprites.push(this.textoEsperaRevancha);
      y += 20;

      const revanchaTexto = '🔁 Pedir revancha';
      const revanchaAncho = this._medirAnchoTextoOverlay(revanchaTexto, '13px') + 44;
      const { contenedor: contRevancha, grafico: grafRevancha } = this._crearBotonOverlay({
        x: 400, y: y + 22, ancho: revanchaAncho, colorFondo: 0x3E8E5A, texto: revanchaTexto, colorTexto: '#FFF8ED', tamanoFuente: 13,
        onClick: () => {
          this.socket.emit('pedir-revancha', { codigoSala: this.codigoSala });
          contRevancha.disableInteractive();
          grafRevancha.clear();
          grafRevancha.fillStyle(0x3E8E5A, 0.45);
          grafRevancha.fillRoundedRect(-revanchaAncho / 2, -22, revanchaAncho, 44, 14);
          grafRevancha.lineStyle(3, 0x4A2C2A, 0.45);
          grafRevancha.strokeRoundedRect(-revanchaAncho / 2, -22, revanchaAncho, 44, 14);
        },
      });
      y += 44 + 8;
    }

    const labelBoton = esTorneo ? '🏆 Ver bracket' : 'Volver al lobby';
    const volverAncho = this._medirAnchoTextoOverlay(labelBoton, '13px') + 44;
    this._crearBotonOverlay({
      x: 400, y: y + 22, ancho: volverAncho, colorFondo: 0xFFB627, texto: labelBoton, tamanoFuente: 13,
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
      this.textoEsperaRevancha.setText(`Esperando confirmación… (${confirmados}/${total || '?'})`).setColor('#7a6660');
    }
  }

_renderizarEstado(animarReparto) {
     this._limpiarSprites();

    if (this.mesaImg) this.mesaImg.setVisible(true);
    if (this.sombraMesa) this.sombraMesa.setVisible(true);

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

    // Pase siguiente: con AMBOS números en 2 cifras (ej "12 - 12") el texto
    // a 20px se pasaba del ancho de la placa (`marcadorAncho`, 72px) — se
    // achica un poco la fuente en ese caso (18px si algún lado ya llegó a
    // 2 cifras, 20px normal con 1 cifra) para que siempre entre bien.
    const textoScore = `${e.scores.yo} - ${e.scores.rival}`;
    const algunLadoDosCifras = String(e.scores.yo).length >= 2 || String(e.scores.rival).length >= 2;
    this.scoreText.setFontSize(algunLadoDosCifras ? '17px' : '20px');
    this.scoreText.setText(textoScore);
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
    this.labelRival.setVisible(!esModoEquipos);
    if (this.manoIconoRival) this.manoIconoRival.setVisible(!esModoEquipos);
    if (this.fondoInfoRival) this.fondoInfoRival.setVisible(!esModoEquipos);

    // Trigésimo segundo pase: "Rival" + su ícono se prenden (dorado, con
    // pulso continuo, igual que el 🎯 de nativo) cuando es el turno del
    // rival, y se apagan (gris, quietos) cuando es el turno propio. Se
    // guarda el estado anterior en _rivalTurnoEncendido para no reiniciar
    // el tween en cada actualización de estado si no cambió nada — esta
    // función se llama en cada evento de estado del backend, no solo al
    // cambiar de turno.
    const esTurnoRival = !esModoEquipos && e.turno !== 'mio';
    if (esTurnoRival !== this._rivalTurnoEncendido) {
      this._rivalTurnoEncendido = esTurnoRival;
      const objetivos = this.manoIconoRival ? [this.labelRival, this.manoIconoRival] : [this.labelRival];
      this.tweens.killTweensOf(objetivos);
      if (esTurnoRival) {
        this.labelRival.setColor('#FFD700').setAlpha(1);
        if (this.manoIconoRival) this.manoIconoRival.setAlpha(1).clearTint();
        this.tweens.add({
          targets: objetivos,
          alpha: { from: 1, to: 0.6 },
          duration: 550,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      } else {
        this.labelRival.setColor('#ffffff77').setAlpha(0.5);
        if (this.manoIconoRival) this.manoIconoRival.setAlpha(0.4).setTint(0x777777);
      }
    }

    if (esModoEquipos) {
      this._renderizarEquipos(e, animarReparto, hayCantoSinResolver);
    } else {
      this._ajustarMesaSegunAsientos(2);
      this._nombreRivalActual = e.nombreRival || null;
      this.labelRival.setText(e.nombreRival || 'Rival');
      // Centésimo décimo séptimo pase: `icono_rival` sigue al nombre en vez
      // de vivir en un X fijo — antes (X=228 fijo) un nombre real más largo
      // que "Rival" quedaba tapado por el ícono o lo empujaba visualmente;
      // ahora el ícono siempre se acomoda justo después del texto, sea cual
      // sea su largo. `manoIconoRival` tiene origen central (0.5,0.5) por
      // default, así que se le suma la mitad de su ancho (19/2) al borde
      // derecho del texto + un margen chico de 6px.
      if (this.manoIconoRival) {
        this.manoIconoRival.x = this.labelRival.x + this.labelRival.width + 6 + 9.5;
      }
      // Sexagésimo primer pase (punto 2): placa chica detrás de nombre+
      // ícono, redibujada según el ancho real del texto (varía con el
      // nombre) — mismo criterio de "medida real, no un número fijo" que
      // ya se usa para reposicionar `manoIconoRival` arriba. Chocolate
      // translúcido con filete dorado fino, mismo lenguaje visual que el
      // resto de placas/paneles del juego (marcador, botones).
      if (this.fondoInfoRival && this.manoIconoRival) {
        const inicioX = this.labelRival.x - 8;
        const finX = this.manoIconoRival.x + 9.5 + 8;
        this.fondoInfoRival.clear();
        this.fondoInfoRival.fillStyle(0x2a1a12, 0.55);
        this.fondoInfoRival.fillRoundedRect(inicioX, 4, finX - inicioX, 28, 9);
        this.fondoInfoRival.lineStyle(1.5, 0xC9860E, 0.6);
        this.fondoInfoRival.strokeRoundedRect(inicioX, 4, finX - inicioX, 28, 9);

        // Pase siguiente: anillo de tiempo (paridad con el nativo, pase
        // 177) — mismo rectángulo que la placa de arriba, se dibuja aparte
        // (this.anilloTiempo, ver create()) solo cuando es el turno del
        // rival y hay timer activo.
        if (esTurnoRival) {
          this._anilloRect = { x: inicioX, y: 4, w: finX - inicioX, h: 28, r: 9 };
        }
      }

      const revelacionFlorRival = this._mostrandoRevelacionFlor
        ? (e.florPendienteDeMostrar || []).find(f => !f.esMio)
        : null;
      const revelacionEnvidoRival = this._mostrandoRevelacionEnvido
        ? (e.envidoPendienteDeMostrar || []).find(f => !f.esMio)
        : null;
      const revelacionRival = revelacionFlorRival || revelacionEnvidoRival;

      if (revelacionRival) {
        this._dibujarFilaCartasReveladas(revelacionRival.cartas, 80);
      } else {
        this._dibujarFilaDorso(e.cartasRivalEnMano, 105);
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
      this._dibujarDueloCartas(e.jugadasRival, e.misJugadas, 250, 0.66, 60);
            this._dibujarManoJugador(e.misCartas, 490, e.turno === 'mio' && !hayCantoSinResolver, animarReparto);
    }

    this._dibujarBotonesCanto(e);
}                  // 👈 esta le falta: cierra la función que tiene el if/else

_renderizarEquipos(e, animarReparto, hayCantoSinResolver) {
    const centroX = 400;
    const centroY = 320;
    const totalAsientos = e.companeros.length + e.rivales.length;
    const esTresVTres = totalAsientos === 5;
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
        radioXAsiento = radioX * 0.85;
        radioYAsiento = radioY * 1.2;
      } else if (esArribaCostado) {
        radioXAsiento = radioX * 0.9;
        radioYAsiento = radioY * 1.2;
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
        radioXAsiento = radioX * 0.9;
        radioYAsiento = radioY * 0.85;
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
    this._dibujarManoJugador(e.misCartas, 490, e.turno === 'mio' && !hayCantoSinResolver, animarReparto);
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

// Pase siguiente: dibuja el anillo de tiempo que se va vaciando alrededor
// de `rect` ({x,y,w,h,r}) — paridad visual con el anillo SVG del nativo
// (AnilloTiempoRival, juego.tsx), pero armado a mano con Graphics: Phaser
// no tiene un equivalente a stroke-dasharray/dashoffset, así que en vez de
// reproducir ese truco se recorre el perímetro completo (arrancando en la
// mitad del borde superior, sentido horario) y se dibuja solo la porción
// que corresponde al `porcentaje` de tiempo restante — mismo resultado
// visual (un anillo que se va achicando en sentido horario). Las esquinas
// redondeadas se aproximan con una polilínea corta (8 segmentos por
// cuarto de círculo, de sobra para un radio tan chico) en vez de usar
// `Graphics.arc()`, para no depender de cómo cada renderer (Canvas/WebGL)
// mezcla arcos con líneas dentro de un mismo path.
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
    const centroMesaY = 320;
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
      const esArribaCentro = outY < -0.7;
      const esArribaCostadoJugada = outY < -0.3 && Math.abs(outX) > 0.3;
      const esAbajoJugada = outY > 0.3;
      const esIzquierda = outX < 0;

      // Coordenadas fijas en la mesa (centro en 400,320) — totalmente
      // independientes de dónde esté la carta oculta del jugador. Cada
      // grupo se ajusta acá directo, sin efecto secundario sobre nada más.
      let baseX = 400;
      let baseY = 320;

      if (esArribaCentro) {
        baseX = 400;
        baseY = 250;
      } else if (esArribaCostadoJugada) {
        baseX = esIzquierda ? 330 : 470;
        baseY = 290;
      } else if (esAbajoJugada) {
        baseX = esIzquierda ? 330 : 470;
        baseY = 400;
      }

      const dirX = cx - centroMesaX;
      const dirY = cy - centroMesaY;
      const dirLen = Math.sqrt(dirX * dirX + dirY * dirY) || 1;
      const pasoApilado = 2;

      // Igual que _dibujarFilaCartas: pre-escalamos con el canvas de alta
      // calidad (mismo criterio que la mano y el dorso) al tamaño BASE, antes
      // del factor de perspectiva (0.78-1.0x) — así setDisplaySize solo hace
      // el ajuste fino, en vez de reducir de un salto el PNG original a
      // ~40px vía WebGL sin mipmaps reales (por ser NPOT), que es lo que se
      // veía "escalonado" en estas cartitas jugadas de los rivales.
      const factorJugada = this._factorEscalaTextura();
      const anchoBaseJugadaR = Math.round(40 * factorJugada);
      const altoBaseJugadaR = Math.round(60 * factorJugada);

      jugadas.forEach((carta, idx) => {
        const esUltima = idx === jugadas.length - 1;
        const offset = (jugadas.length - 1 - idx) * pasoApilado;
        const px = baseX + (dirX / dirLen) * offset;
        const py = baseY + (dirY / dirLen) * offset;
        const keyOriginal = `${carta.valor}_${carta.palo}`;
        const keyEscalada = `${keyOriginal}_${anchoBaseJugadaR}x${altoBaseJugadaR}`;
        this._crearTexturaEscalada(keyOriginal, keyEscalada, anchoBaseJugadaR, altoBaseJugadaR);

        const persp = this._calcularPerspectiva(py);
        const anchoCarta = 40;
        const altoCarta  = 60 * persp.scaleY;

        const img = this.add.image(px, py, keyEscalada)
          .setDisplaySize(anchoCarta, altoCarta)
          .setDepth(60 + idx)
          .setAlpha(esUltima ? 1 : 0.85);
        this._sprites.push(img);
      });
    }
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
    const anchoCarta = 73;
    const altoCarta  = 100;
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
          this.tweens.add({
            targets: img, x: destinoX, y: destinoY, rotation: radCarta,
            duration: 300, ease: 'Power2.easeOut'
          });
        });
      }

      if (jugable) {
        img.setInteractive({ useHandCursor: true });
        img.on('pointerover', () => {
          this.tweens.add({ targets: img, y: destinoY - 25, duration: 120, ease: 'Power2' });
          img.setDepth(100 + i);
        });
        img.on('pointerout', () => {
          this.tweens.add({ targets: img, y: destinoY, duration: 120, ease: 'Power2' });
          img.setDepth(10 + i);
        });
        img.on('pointerdown', () => {
          try { this.sound.play('jugar-carta', { volume: 0.6 }); } catch (err) {}
          this.socket.emit('jugar-carta', { codigoSala: this.codigoSala, cartaId: carta.id });
        });
      }

      this._sprites.push(img);
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
    const espacio = 52;
    const inicioX = 400 - ((cantidad - 1) * espacio) / 2;
    const bulto = 9;
    const anchoCarta = 63;
    const altoCarta = 95;

    for (let i = 0; i < cantidad; i++) {
      const anguloCarta = -anguloTotal / 2 + i * anguloPorCarta;
      const centro = (cantidad - 1) / 2;
      const factorCentro = cantidad > 1 ? 1 - Math.abs((i - centro) / centro) : 0;
      const destinoY = y - factorCentro * bulto;

      const img = this.add.image(inicioX + i * espacio, destinoY, this._claveDorsoGrandeActual || 'cardBackGrande')
        .setDisplaySize(anchoCarta, altoCarta)
        .setDepth(10 + i)
        .setRotation(anguloCarta * Math.PI / 180);
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

    const anchoBase = 90 * escala;
    const altoBase  = 135 * escala;
    const espacio   = Math.max(anchoBase + 15, 80);
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

    const dibujarUna = (carta, x, y, depth) => {
      const keyOriginal = `${carta.valor}_${carta.palo}`;
      const anchoBaseR = Math.round(anchoBase * factor);
      const altoBaseR = Math.round(altoBase * factor);
      const keyEscalada = `${keyOriginal}_${anchoBaseR}x${altoBaseR}`;
      this._crearTexturaEscalada(keyOriginal, keyEscalada, anchoBaseR, altoBaseR);

      // Sexagésimo cuarto pase: se saca la inclinación al azar que tenían
      // las cartas jugadas (el usuario la probó y pidió que queden derechas
      // sobre la mesa). Sexagésimo sexto pase: también se saca el jitter en
      // X (ver comentario más arriba) — solo quedaba el de Y.
      // Septuagésimo pase — el usuario reportó que a veces las cartas del
      // duelo "no llegan correctamente al centro" y que el resultado era
      // inconsistente ("a veces queda bien, a veces no") — se encontró la
      // causa: el jitter de Y todavía quedaba acá, calculado por
      // `carta.id` (¡distinto para cada una de las dos cartas del par!),
      // y como `_calcularPerspectiva` cambia la ESCALA según la posición Y,
      // dos cartas con jitters distintos terminaban con tamaños/posiciones
      // levemente distintos entre sí — la ganadora y la perdedora ya no
      // quedaban usando exactamente la misma referencia, así que el
      // solape se veía bien o mal según qué tan parecido le tocaba el
      // jitter a esa pareja de ids en particular (pura suerte). Ahora que
      // el objetivo es un apilado prolijo y confiable (yRival/yMia fijos,
      // ver más arriba), ya no tiene sentido este jitter — se saca del
      // todo, las dos cartas de cada ronda quedan exactamente en su Y fija.
      const destinoX = x;
      const destinoY = y;

      const persp = this._calcularPerspectiva(destinoY);
      const anchoFinal = anchoBase * persp.scale;
      const altoFinal  = altoBase * persp.scale;

      const SOMBRA_OFFSET_X = 4;
      const sombra = this.add.ellipse(
        destinoX + SOMBRA_OFFSET_X, destinoY + altoFinal * 0.4 + persp.sombraOffsetY,
        anchoFinal * 0.8, altoFinal * 0.22,
        0x000000, persp.sombraAlpha
      ).setDepth(depth - 1);
      this._sprites.push(sombra);

      const img = this.add.image(destinoX, destinoY, keyEscalada)
        .setDisplaySize(anchoFinal, altoFinal)
        .setDepth(depth);
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
      if (cartaRival && !cartaMia) {
        dibujarUna(cartaRival, x, yCentro - desplazamientoComun / 2, depthRonda);
        continue;
      }
      if (cartaMia && !cartaRival) {
        dibujarUna(cartaMia, x, yCentro + desplazamientoComun / 2, depthRonda);
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
        dibujarUna(cartaMia,   x, yMia,   depthRonda);
        dibujarUna(cartaRival, x, yRival, depthRonda + 2);
      } else {
        dibujarUna(cartaRival, x, yRival, depthRonda);
        dibujarUna(cartaMia,   x, yMia,   depthRonda + 2);
      }
    }
}

_dibujarFilaCartas(cartas, y, jugable, esMiMano = false, escala = 1, animar = false, depthBase = 10) {
    if (!cartas || cartas.length === 0) return;
    const anchoBase = 90 * escala;
    const altoBase  = 135 * escala;
    const espacio   = Math.max(anchoBase + 15, 80);
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

  _crearBoton({ x, y, ancho, alto = 44, texto, colorFondo, colorTexto, imagen = null,
              colorBorde = 0x4A2C2A, grosorBorde = 3, radio = 12, tamanoFuente = 15,
              onClick, deshabilitado = false }) {
  const contenedor = this.add.container(x, y).setDepth(200);
  const hijos = [];

  if (imagen) {
    // Vigésimo noveno pase: sombra detrás de cada botón-imagen para que
    // tengan aspecto de "botón" real (despegado del fondo) en vez de una
    // calcomanía plana pegada al panel — un rectángulo redondeado oscuro
    // semitransparente, desplazado apenas hacia abajo-derecha (misma
    // dirección de luz "desde arriba-izquierda" que ya usan las sombras
    // de las cartas jugadas y de la mano). Se dibuja ANTES que la imagen
    // (primero en `hijos`) para quedar detrás. El radio es proporcional al
    // alto del botón porque acá no siempre llega un `radio` explícito (los
    // botones-imagen no lo pasan) y el redondeo real del arte varía con el
    // tamaño de cada botón.
    if (!deshabilitado) {
      const radioSombra = alto * 0.17;
      const sombraBoton = this.add.graphics();
      sombraBoton.fillStyle(0x000000, 0.35);
      sombraBoton.fillRoundedRect(-ancho / 2 + 3, -alto / 2 + 4, ancho, alto, radioSombra);
      hijos.push(sombraBoton);
    }

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
_crearBannerTexto(x, y, texto, depth = 200) {
  const label = this.add.text(0, 0, texto, {
    fontFamily: 'Nunito, Arial', fontSize: '14px', fontStyle: 'bold', color: '#4A2C2A',
    align: 'center', wordWrap: { width: 620 },
  }).setOrigin(0.5);

  const padX = 26, padY = 14;
  const anchoBanner = Math.max(200, label.width + padX * 2);
  const altoBanner = Math.max(40, label.height + padY * 2);

  const texIzq = this.textures.get('banner_izq').getSourceImage();
  const texDer = this.textures.get('banner_der').getSourceImage();
  const capW = Math.round(texIzq.width * (altoBanner / texIzq.height));
  const capWDer = Math.round(texDer.width * (altoBanner / texDer.height));
  const midW = Math.max(1, anchoBanner - capW - capWDer);

  const izq = this.add.image(-anchoBanner / 2 + capW / 2, 0, 'banner_izq').setDisplaySize(capW, altoBanner);
  const centro = this.add.image(-anchoBanner / 2 + capW + midW / 2, 0, 'banner_centro').setDisplaySize(midW, altoBanner);
  const der = this.add.image(anchoBanner / 2 - capWDer / 2, 0, 'banner_der').setDisplaySize(capWDer, altoBanner);

  const contenedor = this.add.container(x, y, [izq, centro, der, label]).setDepth(depth);
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
_crearBotonOverlay({ x, y, ancho, alto = 44, texto, colorFondo, colorTexto = '#4A2C2A', tamanoFuente = 15, onClick }) {
  const contenedor = this.add.container(x, y).setDepth(902);

  // Septuagésimo sexto pase: relleno plano + borde chocolate de 3px, sin
  // degradé ni sombra ni acento interior — mismo trazo que
  // `botonVolverLobby` en el nativo (un View con `backgroundColor`
  // sólido y `borderWidth:3` nomás, nada de relieve). Fuente Fredoka
  // (tituloSemiBold), no Nunito — igual que `botonAccionTexto` nativo.
  const grafico = this.add.graphics();
  grafico.fillStyle(colorFondo, 1);
  grafico.fillRoundedRect(-ancho / 2, -alto / 2, ancho, alto, 14);
  grafico.lineStyle(3, 0x4A2C2A, 1);
  grafico.strokeRoundedRect(-ancho / 2, -alto / 2, ancho, alto, 14);

  const label = this.add.text(0, 0, texto, {
  fontFamily: 'Fredoka, Arial',
  fontSize: `${tamanoFuente}px`,
  fontStyle: '600',
  color: colorTexto
}).setOrigin(0.5);

  contenedor.add([grafico, label]);
  contenedor.setSize(ancho, alto);
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
  return { contenedor, grafico, label };
}

_dibujarBotonesCanto(e) {
  const CENTRO_X = 400;
  const GAP = 30;

  const centrarFila = (specs, y) => {
    const anchoTotal = specs.reduce((acc, s) => acc + s.ancho, 0) + GAP * (specs.length - 1);
    let cursorX = CENTRO_X - anchoTotal / 2;
    specs.forEach((s) => {
      cursorX += s.ancho / 2;
      this._crearBoton({ ...s, x: cursorX, y });
      cursorX += s.ancho / 2 + GAP;
    });
  };

  // Spec de un botón-imagen (rediseño Canva, Fase 2): a partir del id
  // semántico interno (ej. 'quiero', 'real-envido') resuelve la clave de
  // archivo vía CLAVE_IMAGEN_BOTON y calcula el ancho real preservando el
  // aspecto natural del PNG para el alto pedido — cada botón tiene su
  // propio ancho relativo porque el texto horneado varía de largo, así
  // que no hay un ratio único para todos.
  // Vigésimo octavo pase: el halo dorado detrás de Truco/Retruco/Vale Cuatro
  // (agregado en el decimonoveno pase) se sacó a pedido del usuario — quedó
  // el parámetro `opciones` genérico por si hace falta pasar algo más a
  // futuro, pero ya no se usa para destacar nada.
  const specImagen = (idSemantico, alto, onClick, opciones = {}) => {
    const clave = CLAVE_IMAGEN_BOTON[idSemantico];
    return { alto, imagen: clave, ancho: this._anchoBotonImagen(clave, alto), onClick, ...opciones };
  };

  // Botones de respuesta a un Envido pendiente (Quiero/No quiero/subir).
  // Se usa desde la rama normal (nadie más tiene nada pendiente) Y desde
  // dentro de la rama de Truco pendiente, para el caso en que interrumpí
  // ese Truco con un Envido y el rival lo subió — ver comentario más abajo.
  const dibujarRespuestaEnvido = () => {
    const ENVIDO_NIVELES = ['envido', 'real-envido', 'falta-envido'];
    const idxActual = ENVIDO_NIVELES.indexOf(e.envido.tipo);
    const nivelesDisponibles = ENVIDO_NIVELES.slice(idxActual + 1);

    const specs = [
      specImagen('quiero', 56, () => this._responderEnvido('quiero')),
      specImagen('no-quiero', 56, () => this._responderEnvido('no-quiero')),
    ];
    nivelesDisponibles.forEach(nivel => {
      specs.push(specImagen(nivel, 56, () => this._subirEnvido(nivel)));
    });
    // Esta fila nunca convive con otra fila de botones (siempre es la única
    // que se muestra en pantalla), así que puede usar un alto grande (56)
    // sin riesgo de chocar con nada — a diferencia de las ramas "apiladas"
    // más abajo, que tienen que repartirse una banda vertical mucho más chica.
    // Septuagésimo tercer pase: el usuario reportó que las filas de un solo
    // renglón (2-3 botones) quedaban "un poco/muy abajo, no centradas en la
    // botonera" — la banda de botones real es 500 a 600 (100px, ver
    // Metodología/comentarios de más abajo), así que el centro vertical
    // real es 550, no 564 (14px más abajo del centro real, con margen de
    // sobra hacia el piso pero casi nada hacia arriba). Bajado a 550 en las
    // 3 filas "sin competencia" de esta función (dibujarRespuestaEnvido,
    // Flor sin Truco pendiente, declaración de Envido).
    centrarFila(specs, 550);
  };

  if (e.flor.pendienteDeRespuesta) {
    const nombreNivelFlor = { 'flor': 'FLOR', 'contra-flor': 'CONTRA FLOR', 'contra-flor-resto': 'CONTRA FLOR AL RESTO' };
    this._crearBannerTexto(400, 491, `${nombreNivelFlor[e.flor.nivel]}: ¿Querés?`);

    const NIVELES_FLOR = ['flor', 'contra-flor', 'contra-flor-resto'];
    const idxActualFlor = NIVELES_FLOR.indexOf(e.flor.nivel);
    const nivelesDisponiblesFlor = NIVELES_FLOR.slice(idxActualFlor + 1);

    const specsFlor = [
      specImagen('quiero', 56, () => this._responderFlor('quiero')),
      specImagen('con-flor-me-achico', 56, () => this._responderFlor('no-quiero')),
    ];
    nivelesDisponiblesFlor.forEach(nivel => {
      specsFlor.push(specImagen(nivel, 56, () => this._subirFlor(nivel)));
    });
    // Fila sin competencia (única que se muestra), mismo criterio que
    // dibujarRespuestaEnvido: alto grande (56). Septuagésimo tercer pase:
    // recentrada a 550 (centro real de la banda 500-600) — ver comentario
    // completo en dibujarRespuestaEnvido, más arriba.
    centrarFila(specsFlor, 550);
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
      specImagen('son-buenas', 56, () => this._declararSonBuenas()),
    ];
    if (e.declaracionEnvido.puedoMostrar) {
      // Octogésimo sexto pase: mismo fondo ilustrado que el resto (la
      // tablita en blanco de "Quiero", ver Tengo.png) con el número
      // dibujado encima — el número cambia en cada mano, no puede ser una
      // imagen fija horneada por el diseñador. `ancho` fijo (en vez del
      // natural de `_anchoBotonImagen`, más angosto) para que "Tengo 33"
      // entre cómodo — mismo ancho que ya usaba el pipeline viejo.
      specs.push({ ancho: 175, alto: 56, tamanoFuente: 16, imagen: 'Tengo', colorTexto: '#FFFFFF', texto: `Tengo ${e.declaracionEnvido.misPuntos}`, onClick: () => this._declararMostrar() });
    }
    // Fila sin competencia (única que se muestra), mismo criterio de arriba.
    // Septuagésimo tercer pase: recentrada a 550, mismo motivo.
    centrarFila(specs, 550);
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

    // Zona de botones: 500 (línea divisoria) a 600 (borde del canvas) = 100px
    // (antes 79px, ver _crearElementosDeTexto). Fila de Envido chica arriba
    // (28 de alto, antes 20) y fila principal de respuesta abajo (52, antes
    // 44) — con 6px de margen arriba, 8px de aire entre las dos filas y 6px
    // de margen abajo: 6+28+8+52+6 = 100, exacto.
    if (puedeCantarEnvido) {
      centrarFila([
        specImagen('envido', 28, () => this._cantarEnvido('envido')),
        specImagen('real-envido', 28, () => this._cantarEnvido('real-envido')),
        specImagen('falta-envido', 28, () => this._cantarEnvido('falta-envido')),
      ], 520);
    }

    const specs = [
      specImagen('quiero', 52, () => this._responderTruco('quiero')),
      specImagen('no-quiero', 52, () => this._responderTruco('no-quiero')),
    ];
    if (e.truco.nivel !== 'vale-cuatro') {
      specs.push(specImagen(proximoNivelTruco(e.truco.nivel), 52, () => this._cantarTruco()));
    }
    if (puedeCantarFlorAca) {
      specs.push(specImagen('flor', 52, () => this._cantarFlor()));
    }
    // Septuagésimo tercer pase: este y=568 solo tiene sentido cuando la fila
    // de Envido chica de arriba (520) también está — juntas reparten la
    // banda 500-600 como documenta el comentario de arriba (6+28+8+52+6=100).
    // Pero `puedeCantarEnvido` puede ser false (ya no se puede cantar
    // Envido en esta mano) y ahí esta fila queda SOLA en toda la banda —
    // seguía fija en 568 igual, quedando notablemente abajo (el usuario lo
    // reportó justo con 2-3 botones sueltos, sin la fila de Envido arriba).
    // Sin competencia, el centro real de la banda es 550.
    centrarFila(specs, puedeCantarEnvido ? 568 : 550);

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

    // El canvas de Phaser mide 800x600 (ver gameConfigOnline.js) — aunque la
    // barra de acciones se dibuja como un rectángulo centrado en y=555 (de
    // 500 a 610), todo lo que cae más allá de y=600 queda recortado por el
    // borde del canvas. La banda vertical realmente visible para botones es
    // entonces de 500 (línea divisoria) a 600 (borde del canvas) = 100px
    // (antes 79px, con la divisoria en 521 — se subió a 500 achicando y
    // subiendo las cartas propias, ver _dibujarManoJugador, para ganarle
    // ~21px a la mesa y dárselos a esta barra).
    //
    // Cuando hay una sola fila (specsAbajo sin la fila de Envido arriba) esa
    // banda entera está libre y el botón puede ser grande (alto=56, igual
    // que las filas "sin competencia" de más arriba). Cuando hay DOS filas
    // apiladas (Envido arriba + specsAbajo abajo) hay que repartir esos
    // 100px entre ambas — con ALTO_BOTON_APILADO=42 (antes 34) entran las
    // dos con margen: 5px arriba, 6px de aire entre las dos filas, 5px
    // abajo (5+42+6+42+5 = 100, exacto).
    const ALTO_BOTON_APILADO = 42;
    const ALTO_BOTON_SOLO = 56;

    if (hayEnvido) {
      // y=526: fila de arriba, spans 505-547 (5px de margen contra la
      // divisoria en 500).
      centrarFila([
        specImagen('envido', ALTO_BOTON_APILADO, () => this._cantarEnvido('envido')),
        specImagen('real-envido', ALTO_BOTON_APILADO, () => this._cantarEnvido('real-envido')),
        specImagen('falta-envido', ALTO_BOTON_APILADO, () => this._cantarEnvido('falta-envido')),
      ], 526);
    }

    const esEquiposActual = Array.isArray(e.companeros);
    const yaCante = esEquiposActual ? e.truco.cantadoPorMiEquipo : e.truco.cantadoPorMi;

    // Cuando hayEnvido es true, specsAbajo comparte la banda con la fila de
    // arriba y tiene que quedarse chico; cuando es false, specsAbajo es la
    // única fila en pantalla y puede ser grande.
    const altoAbajo = hayEnvido ? ALTO_BOTON_APILADO : ALTO_BOTON_SOLO;

    const specsAbajo = [];
    if (puedoCantarFlor && !hayCantoPropioPendiente) {
      specsAbajo.push(specImagen('flor', altoAbajo, () => this._cantarFlor()));
    }
    if (e.truco.nivel !== 'vale-cuatro' && !yaCante && e.turno === 'mio' && !hayFlorPendiente && !hayCantoPropioPendiente) {
      // Punto 4 de la crítica de la mesa (pase 61): "darle más presencia
      // visual a Truco" — el halo dorado que tenía antes se sacó a pedido
      // del usuario (vigésimo octavo pase), así que se destaca por TAMAÑO
      // en vez de color: unos px más de alto que sus vecinos de fila
      // (`_anchoBotonImagen` escala el ancho en proporción, así que
      // también queda un poco más ancho, no solo más alto).
      specsAbajo.push(specImagen(proximoNivelTruco(e.truco.nivel), altoAbajo + 6, () => this._cantarTruco()));
    }
    if (e.turno === 'mio' && !hayFlorPendiente && !hayCantoPropioPendiente) {
      specsAbajo.push(specImagen('ir-al-mazo', altoAbajo, () => this._irseAlMazo()));
    }
    // Bajada 3px a pedido del usuario (Truco/Ir al mazo se veían muy pegados
    // a la fila de Envido de arriba).
    // hayEnvido true: y=577, fila de abajo, spans 556-598 — quedan solo 2px
    // de margen contra el borde real del canvas en 600 (ver el límite duro
    // documentado en Metodología: nada calculado más allá de ese borde se
    // ve). Si se vuelve a tocar este valor, OJO con no pasarse de ahí.
    // hayEnvido false: ESTA es la fila que el usuario reportó como "no
    // centrada, queda abajo" (con 2 o 3 botones — Flor/próximo nivel de
    // Truco/Ir al mazo, según cuáles apliquen). y=567 nunca fue el centro
    // real de la banda 500-600 (eso es 550) — quedaba con margen de sobra
    // hacia el piso pero casi nada hacia el techo, más notorio cuanto menos
    // botones hay. Septuagésimo tercer pase: recentrado a 550.
    centrarFila(specsAbajo, hayEnvido ? 577 : 550);
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