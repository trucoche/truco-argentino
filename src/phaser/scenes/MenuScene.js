import Phaser from 'phaser';

export default class MenuScene extends Phaser.Scene {
    constructor() {
        super('MenuScene');
        this.modoJuego = null;
        this.persistentObjects = []; // Array para objetos persistentes
    }

    preload() {
        this.load.audio('background',  'assets/sounds/background.ogg');
        this.load.audio('click-sound', 'assets/sounds/click.mp3');
        this.load.audio('repartir',    'assets/sounds/repartir_cartas.mp3');
        this.load.audio('jugar-carta', 'assets/sounds/CardGame-SoundEffect.mp3');
        this.load.audio('ganar',       'assets/sounds/ganarpartidasonido.mp3');
        this.load.image('checkbox', 'assets/botones/checkbox.png');
        this.load.image('checkbox_checked', 'assets/botones/checkbox_checked.png');
        this.load.image('mesa', 'assets/images/juego/mesa.png'); 
    }

     create() {
        // Crear objetos persistentes (fondo y título)
        const fondo = this.add.image(400, 270, 'mesa').setDisplaySize(800, 500);
        const titulo = this.add.text(400, 90, 'RETRUCO ARGENTINO', {
            font: '48px Arial',
            fill: '#FFFFFF',
            stroke: '#000000',
            strokeThickness: 6
        }).setOrigin(0.5);
        
        // Almacenar objetos persistentes
        this.persistentObjects.push(fondo, titulo);
        
        this.mostrarPantallaSeleccionModo();
        // Música de fondo (se mantiene entre pantallas del menú)
        if (!this.sound.get('background')) {
            this.bgMusic = this.sound.add('background', { loop: true, volume: 0.4 });
            if (this.musicEnabled !== false) this.bgMusic.play();
        }

        this.crearBotonMusica();
    }

    // Pantalla 1: Selección de tipo de juego
    mostrarPantallaSeleccionModo() {
        this.limpiarPantalla();

        // Subtítulo
        this.add.text(400, 160, 'Selecciona modo de juego', {
            font: '24px Arial',
            fill: '#FFFFFF'
        }).setOrigin(0.5);

        // Botones de modo de juego
        this.crearBoton(400, 250, '1 vs 1 (Individual)', () => {
            this.modoJuego = '1v1';
            this.mostrarPantallaConfiguracion();
        });

        this.crearBoton(400, 320, '2 vs 2 (Parejas)', () => {
            this.modoJuego = '2v2';
            this.mostrarPantallaConfiguracion();
        });

        this.crearBoton(400, 390, '3 vs 3 (Equipo)', () => {
            this.modoJuego = '3v3';
            this.mostrarPantallaConfiguracion();
        });
    }


    // Pantalla 2: Configuración de partida
mostrarPantallaConfiguracion() {
    this.limpiarPantalla();

    this.add.text(400, 130, `Modo: ${this.modoJuego}`, {
        font: '28px Arial', fill: '#FFFF00'
    }).setOrigin(0.5);

    this.add.text(400, 158, 'Configuración de partida', {
        font: '24px Arial', fill: '#FFFFFF'
    }).setOrigin(0.5);

    this.crearOpcionFlor(350, 200);

    // Selector de dificultad
    this.add.text(400, 245, 'Dificultad:', {
        font: '20px Arial', fill: '#FFFFFF'
    }).setOrigin(0.5);

    this.dificultad = this.dificultad || 'normal';
    this.crearSelectorDificultad(400, 275);

    this.crearBoton(400, 330, 'Partida Rápida (15 puntos)', () => {
        this.iniciarPartida(15);
    });

    this.crearBoton(400, 395, 'Partida Completa (30 puntos)', () => {
        this.iniciarPartida(30);
    });

    this.crearBoton(400, 460, 'Volver', () => {
        this.mostrarPantallaSeleccionModo();
    });
}

crearSelectorDificultad(x, y) {
    const niveles = [
        { key: 'facil',   label: 'Fácil'   },
        { key: 'normal',  label: 'Normal'  },
        { key: 'dificil', label: 'Difícil' }
    ];

    this.botonesDificultad = [];

    niveles.forEach((nivel, i) => {
        const bx = x - 130 + (i * 130);
        const isActive = this.dificultad === nivel.key;

        const boton = this.add.rectangle(bx, y, 110, 36,
            isActive ? 0x2980b9 : 0x444444
        ).setInteractive({ useHandCursor: true });

        const texto = this.add.text(bx, y, nivel.label, {
            font: '16px Arial', fill: '#ffffff'
        }).setOrigin(0.5);

        boton.on('pointerdown', () => {
            this.sound.play('click-sound');
            this.dificultad = nivel.key;
            this.mostrarPantallaConfiguracion(); // refrescar para marcar el activo
        });

        this.botonesDificultad.push(boton, texto);
    });
}

    // Crear opción de Flor con checkbox mejorado
crearOpcionFlor(x, y) {
    const grupoFlor = this.add.group();
    
    // Texto
    const texto = this.add.text(x, y, 'Jugar con Flor:', {
        font: '20px Arial',
        fill: '#FFFFFF'
    }).setOrigin(1, 0.5);
    grupoFlor.add(texto);

    // Tamaño fijo para el checkbox (en píxeles)
    const checkboxWidth = 30;
    const checkboxHeight = 30;

    // Checkbox - establecer tamaño de visualización fijo
    const checkbox = this.add.image(x + 40, y, 'checkbox')
        .setInteractive({ useHandCursor: true })
        .setDisplaySize(checkboxWidth, checkboxHeight); // Tamaño fijo
    grupoFlor.add(checkbox);

    // Texto de estado
    const estadoText = this.add.text(x + 70, y, 'No', {
        font: '20px Arial',
        fill: '#FFFFFF'
    }).setOrigin(0, 0.5);
    grupoFlor.add(estadoText);

    let juegoConFlor = false;

    checkbox.on('pointerdown', () => {
        this.sound.play('click-sound');
        juegoConFlor = !juegoConFlor;
        
        // Cambiar textura manteniendo el mismo tamaño
        checkbox.setTexture(juegoConFlor ? 'checkbox_checked' : 'checkbox')
               .setDisplaySize(checkboxWidth, checkboxHeight); // Mantener tamaño
        
        estadoText.setText(juegoConFlor ? 'Sí' : 'No');
        this.juegoConFlor = juegoConFlor;
    });

    return grupoFlor;
}

    // Iniciar partida con configuración seleccionada
iniciarPartida(puntosParaGanar) {
    this.sound.stopAll();
    this.limpiarPantalla(true);

    const sceneKey = `GameScene${this.modoJuego}`;

    this.scene.start(sceneKey, {
        puntosParaGanar: puntosParaGanar,
        juegoConFlor: this.juegoConFlor || false,
        dificultad: this.dificultad || 'normal'
    });
}

    // Limpiar elementos de la pantalla
    limpiarPantalla() {
        // Obtener todos los objetos hijos
        const children = this.children.getChildren();
        
        // Filtrar para eliminar solo los no persistentes
        for (let i = children.length - 1; i >= 0; i--) {
            const child = children[i];
            
            // No eliminar sonidos ni objetos persistentes
            if (!(child instanceof Phaser.Sound.BaseSound) && 
                !this.persistentObjects.includes(child)) {
                
                // Si es un grupo, limpiarlo primero
                if (child instanceof Phaser.GameObjects.Group) {
                    child.clear(true, true);
                }
                child.destroy();
            }
        }
    }

    // Crear botones estilizados
    crearBoton(x, y, texto, callback) {
        const boton = this.add.rectangle(x, y, 300, 50, 0x3498db)
            .setInteractive({ useHandCursor: true });
        
        const textoBoton = this.add.text(x, y, texto, {
            font: '18px Arial',
            fill: '#FFFFFF'
        }).setOrigin(0.5);

        // Efectos hover
        boton.on('pointerover', () => {
            boton.fillColor = 0x2980b9;
            textoBoton.setScale(1.05);
        });

        boton.on('pointerout', () => {
            boton.fillColor = 0x3498db;
            textoBoton.setScale(1);
        });

        boton.on('pointerdown', () => {
            this.sound.play('click-sound');
            callback();
        });

        return boton;
    }
    crearBotonMusica() {
    this.musicEnabled = this.musicEnabled !== false; // default true
    const icon = this.musicEnabled ? '🔊' : '🔇';

    this.musicButton = this.add.text(760, 20, icon, {
        font: '28px Arial'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    this.musicButton.on('pointerdown', () => {
        this.musicEnabled = !this.musicEnabled;
        this.musicButton.setText(this.musicEnabled ? '🔊' : '🔇');

        if (this.musicEnabled) {
            this.bgMusic.play();
        } else {
            this.bgMusic.stop();
        }
    });

    this.persistentObjects.push(this.musicButton);
}
}