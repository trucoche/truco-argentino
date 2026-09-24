import Phaser from 'phaser';
import CardManager from '../managers/CardManager';
import DeckManager from '../managers/DeckManager';
import GameManager from '../managers/GameManager';
import EnvidoButtons from '../ui/EnvidoButtons';
import TrucoButtons from '../ui/TrucoButtons';

export default class GameScene1v1 extends Phaser.Scene {

  constructor() {
    super('GameScene1v1');
    this._config = {
      puntosParaGanar: 15,
      juegoConFlor: false
    };
  }

  get config() {
    return this._config || { puntosParaGanar: 15, juegoConFlor: false };
  }

  init(data) {
    if (data && typeof data === 'object') {
      this._config = { ...this._config, ...data };
    }
  }

  preload() {
    const palos   = ['oro', 'copa', 'espada', 'basto'];
    const valores = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
    palos.forEach(palo => {
      valores.forEach(valor => {
        this.load.image(`${valor}_${palo}`, `assets/images/juego/cartas/${valor}_${palo}.jpg`);
      });
    });
    this.load.image('cardBack', 'assets/images/juego/cartas/back.PNG');
    this.load.image('mesa',     'assets/images/juego/mesa.png');
    this.load.on('loaderror', (file) => console.error('Error cargando:', file.key));
    this.load.audio('background',  'assets/sounds/background.ogg');
    this.load.audio('click-sound', 'assets/sounds/click.mp3');
    this.load.audio('repartir',    'assets/sounds/repartir_cartas.mp3');
    this.load.audio('jugar-carta', 'assets/sounds/CardGame-SoundEffect.mp3');
    this.load.audio('ganar',       'assets/sounds/ganarpartidasonido.mp3');
    this.load.on('loaderror', (file) => {
    console.error('Error cargando archivo:', file.key, file.url);
});
  }

  async create() {
    try {
      this.setupBasicGraphics();
      this.initializeUI();
      await this.initializeGame();
      console.log('Sonidos cargados:', {
    repartir:    this.sound.get('repartir'),
    jugarCarta:  this.sound.get('jugar-carta'),
    ganar:       this.sound.get('ganar')
});
      this.time.delayedCall(300, () => this.gameManager.startGame());
    } catch (error) {
      console.error('Error en create:', error);
      this.showErrorScreen(error.message);
    }
  }

  setupBasicGraphics() {
    // Mesa
    this.add.image(400, 300, 'mesa').setDisplaySize(800, 600).setDepth(0);

    // Línea divisoria central sutil
    this.add.rectangle(400, 300, 700, 2, 0xffffff, 0.08).setDepth(1);

    // Labels de zona
    this.add.text(400, 22, 'IA',  { font: '14px Arial', fill: '#ffffffaa' }).setOrigin(0.5).setDepth(2);
    this.add.text(400, 578, 'Vos', { font: '14px Arial', fill: '#ffffffaa' }).setOrigin(0.5).setDepth(2);

    // Barra de botones fija abajo
    this.add.rectangle(400, 570, 800, 50, 0x000000, 0.45).setDepth(90);
  }

initializeUI() {
    // Botones centrados en la barra inferior
    // EnvidoButtons: 4 botones × 128px = 512px total, centrado en x=400 → origen en 400-256=144
    this.envidoButtons = new EnvidoButtons(this, 144, 548);
    // TrucoButtons: 3 botones × 128px = 384px total, centrado en x=400 → origen en 400-192=208  
    this.trucoButtons  = new TrucoButtons(this,  208, 548);
}

  async initializeGame() {
    this.deckManager = new DeckManager(this);
    await this.deckManager.initialize();

    this.cardManager = new CardManager(this);

    this.gameManager = new GameManager({
      scene:         this,
      cardManager:   this.cardManager,
      deckManager:   this.deckManager,
      onScoreUpdate: () => {},
      config:        this.config
    });

    // Posiciones ajustadas al nuevo layout
    this.gameManager.positions = {
      playerHand:   [{ x: 280, y: 470 }, { x: 400, y: 470 }, { x: 520, y: 470 }],
      opponentHand: [{ x: 280, y:  80 }, { x: 400, y:  80 }, { x: 520, y:  80 }]
    };

    this.gameManager.playPositions = {
      player:   [{ x: 230, y: 360 }, { x: 390, y: 360 }, { x: 550, y: 360 }],
      opponent: [{ x: 230, y: 200 }, { x: 390, y: 200 }, { x: 550, y: 200 }]
    };

    this.gameManager.envidoButtons = this.envidoButtons;
    this.gameManager.trucoButtons  = this.trucoButtons;
    this.gameManager.setupEventHandlers();
    this.gameManager.createScoreDisplay();

    console.log('Escena 1v1 inicializada');
  }

  showGameOver(playerWon) {
    if (playerWon && this.sound.get('ganar')) {
        this.sound.play('ganar', { volume: 0.8 });
    }

    this.envidoButtons?.hide();
    this.trucoButtons?.hide();

    const winnerText = playerWon ? '¡Ganaste!' : '¡Perdiste!';
    const color      = playerWon ? '#4CAF50'   : '#F44336';
    const bgColor    = playerWon ? 0x1b5e20    : 0x7f0000;

    this.add.rectangle(400, 300, 440, 260, bgColor, 0.92)
      .setStrokeStyle(3, 0xffffff, 0.8).setDepth(900);

    this.add.text(400, 215, winnerText, {
      fontFamily: 'Arial', fontSize: 56, fontStyle: 'bold', color
    }).setOrigin(0.5).setDepth(901);

    const scores = this.gameManager?.scores || { player: 0, opponent: 0 };
    this.add.text(400, 290, `Vos ${scores.player}  —  IA ${scores.opponent}`, {
      fontFamily: 'Arial', fontSize: 26, color: '#ffffff'
    }).setOrigin(0.5).setDepth(901);

    // Botón Menú
    this.add.text(305, 355, 'Menú', {
      fontFamily: 'Arial', fontSize: 24, color: '#ffffff',
      backgroundColor: '#333333', padding: { x: 18, y: 8 }
    }).setOrigin(0.5).setDepth(901)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MenuScene'));

    // Botón Revancha
    this.add.text(495, 355, 'Revancha', {
      fontFamily: 'Arial', fontSize: 24, color: '#ffffff',
      backgroundColor: '#1565C0', padding: { x: 18, y: 8 }
    }).setOrigin(0.5).setDepth(901)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.restart());
  }

  showErrorScreen(message) {
    this.children.removeAll();

    this.add.rectangle(400, 300, 620, 380, 0x1a1a1a, 0.95)
      .setStrokeStyle(3, 0xff0000);

    this.add.text(400, 200, 'Error', {
      font: '28px Arial', fill: '#ff5555'
    }).setOrigin(0.5);

    this.add.text(400, 290, message || 'Error desconocido', {
      font: '18px Arial', fill: '#ffaaaa',
      wordWrap: { width: 560 }, align: 'center'
    }).setOrigin(0.5);

    this.add.text(400, 420, 'Reintentar', {
      font: '26px Arial', fill: '#ffffff',
      backgroundColor: '#333333', padding: 10
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.restart());

    this.time.delayedCall(15000, () => this.scene.restart());
  }
}