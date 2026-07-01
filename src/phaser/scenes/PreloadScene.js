import Phaser from 'phaser';

export default class PreloadScene extends Phaser.Scene {
    constructor() {
        super('PreloadScene');
    }

    preload() {
        // 1. Mostrar barra de progreso
        this.createProgressBar();

        // 2. Cargar cartas (40 naipes)
        const palos = ['oro', 'copa', 'espada', 'basto'];
        const valores = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
        
        palos.forEach(palo => {
            valores.forEach(valor => {
                this.load.image(`${valor}_${palo}`, `assets/images/juego/cartas/${valor}_${palo}.jpg`);
            });
        });

        // 3. Assets comunes
        this.load.image('mesa', 'assets/images/juego/mesa.png');
        this.load.image('cardBack', 'assets/images/juego/cartas/back.jpg');

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