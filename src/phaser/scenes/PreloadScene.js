import Phaser from 'phaser';

const CLAVE_BARAJA = 'truco_baraja';

export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super('PreloadScene');
    }

    preload() {
        // 1. Mostrar barra de progreso
        this.createProgressBar();

        // 2. Cargar cartas (40 naipes) — la carpeta y extensión dependen
        // de la preferencia de mazo guardada en Configuración. Las claves
        // de textura (`${valor}_${palo}`) quedan IGUALES en ambos mazos a
        // propósito, así el resto del código del tablero (que referencia
        // esas claves) no necesita saber ni importarle qué mazo está activo.
        const barajaElegida = localStorage.getItem(CLAVE_BARAJA) === 'nueva' ? 'nueva' : 'clasica';
        const carpeta = barajaElegida === 'nueva' ? 'cartas-nuevas' : 'cartas-clasicas';
        // Pase siguiente: el usuario reemplazó las 40 cartas clásicas por
        // PNG con bordes redondeados (recorte en Canva) — antes esta
        // carpeta era la única que seguía en .jpg, ahora los dos mazos son
        // .png, así que la extensión ya no depende de qué mazo esté
        // elegido. Con .jpg fijo (como estaba antes) el mazo clásico
        // rompía: el load.image pedía un archivo que ya no existe y las
        // cartas se veían negras (textura nunca cargada).
        const extension = 'png';

        const palos = ['oro', 'copa', 'espada', 'basto'];
        const valores = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

        palos.forEach(palo => {
            valores.forEach(valor => {
                this.load.image(`${valor}_${palo}`, `assets/images/juego/${carpeta}/${valor}_${palo}.${extension}`);
            });
        });

        // 3. Assets comunes
        this.load.image('mesa', 'assets/images/juego/mesa.png');
        // El dorso también depende del mazo elegido (mismo criterio que las
        // cartas de frente) — antes quedaba hardcodeado a cartas-clasicas
        // (con extensión .jpg, que ni siquiera existe ahí: el archivo real
        // es back.png), así que un dorso nuevo puesto en cartas-nuevas/
        // nunca se llegaba a cargar, sin importar qué mazo tuviera elegido
        // el usuario. El archivo de dorso es siempre .png en las tres
        // carpetas de mazo, a diferencia de las cartas de frente.
        this.load.image('cardBack', `assets/images/juego/${carpeta}/back.png`);

        // 4. Assets del menú
        this.load.audio('click-sound', 'assets/sounds/click.mp3');
        this.load.image('checkbox', 'assets/botones/checkbox.png');
        this.load.image('checkbox_checked', 'assets/botones/checkbox_checked.png');
    }

    create() {
        this.scene.start('MenuScene');
    }

    createProgressBar() {
        // (Implementación existente)
    }
}