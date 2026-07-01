import Phaser from 'phaser';
import CardManager    from '../managers/CardManager';
import DeckManager    from '../managers/DeckManager';
import GameManager3v3 from '../managers/GameManager3v3';
import EnvidoButtons  from '../ui/EnvidoButtons';
import TrucoButtons   from '../ui/TrucoButtons';

/*
  Layout 6 jugadores:

  [teammate1]  [opponent2]  [teammate2]
  [opponent1]              [opponent3]
                [player]
*/

export default class GameScene3v3 extends Phaser.Scene {

  constructor() {
    super('GameScene3v3');
    this._config = { puntosParaGanar: 15, juegoConFlor: false };
  }

  get config() { return this._config; }

  init(data) {
    if (data && typeof data === 'object') {
      this._config = { ...this._config, ...data };
    }
  }

  preload() {
    const palos   = ['oro', 'copa', 'espada', 'basto'];
    const valores = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
    palos.forEach(p => valores.forEach(v => {
      this.load.image(`${v}_${p}`, `assets/images/juego/cartas/${v}_${p}.jpg`);
    }));
    this.load.image('cardBack', 'assets/images/juego/cartas/back.jpg');
    this.load.image('mesa',     'assets/images/juego/mesa.png');
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
      this._setupLayout();
      this._setupGraphics();
      this._initUI();
      await this._initGame();
      this.time.delayedCall(300, () => this.gameManager.startGame());
    } catch (err) {
      console.error('Error en GameScene3v3.create:', err);
      this.showErrorScreen(err.message);
    }
  }

_setupLayout() {
    this.cardPositions = {
        player:    [{ x: 265, y: 505 }, { x: 375, y: 505 }, { x: 485, y: 505 }],
        teammate1: [{ x: 130, y:  65 }, { x: 195, y:  65 }, { x: 260, y:  65 }],
        teammate2: [{ x: 540, y:  65 }, { x: 605, y:  65 }, { x: 670, y:  65 }],
        opponent1: [{ x:  40, y: 220 }, { x:  40, y: 300 }, { x:  40, y: 380 }],
        opponent2: [{ x: 335, y:  65 }, { x: 400, y:  65 }, { x: 465, y:  65 }],
        opponent3: [{ x: 760, y: 220 }, { x: 760, y: 300 }, { x: 760, y: 380 }]
    };

    this.playPositions = {
        player:    [{ x: 355, y: 415 }, { x: 362, y: 407 }, { x: 369, y: 399 }],
        teammate1: [{ x: 255, y: 200 }, { x: 262, y: 208 }, { x: 269, y: 216 }],
        teammate2: [{ x: 545, y: 200 }, { x: 552, y: 208 }, { x: 559, y: 216 }],
        opponent1: [{ x: 175, y: 310 }, { x: 182, y: 310 }, { x: 189, y: 310 }],
        opponent2: [{ x: 400, y: 175 }, { x: 407, y: 183 }, { x: 414, y: 191 }],
        opponent3: [{ x: 625, y: 310 }, { x: 618, y: 310 }, { x: 611, y: 310 }]
    };
}

  _setupGraphics() {
    this.add.image(400, 300, 'mesa').setDisplaySize(800, 600).setDepth(0);
    this.add.rectangle(400, 300, 700, 2, 0xffffff, 0.07).setDepth(1);

    const s = { font: '12px Arial', fill: '#ffffffbb' };
    this.add.text(205, 22,  'Compañero 1', s).setOrigin(0.5).setDepth(2);
    this.add.text(595, 22,  'Compañero 2', s).setOrigin(0.5).setDepth(2);
    this.add.text(390, 22,  'IA 2',        s).setOrigin(0.5).setDepth(2);
    this.add.text( 20, 300, 'IA 1',        s).setOrigin(0.5).setDepth(2).setAngle(-90);
    this.add.text(780, 300, 'IA 3',        s).setOrigin(0.5).setDepth(2).setAngle(90);
    this.add.text(375, 578, 'Vos',         s).setOrigin(0.5).setDepth(2);

    // Barra inferior
    this.add.rectangle(400, 570, 800, 50, 0x000000, 0.45).setDepth(90);
  }

  _initUI() {
    this.envidoButtons = new EnvidoButtons(this, 144, 558);
    this.trucoButtons  = new TrucoButtons(this,  398, 558);
  }

  async _initGame() {
    this.deckManager = new DeckManager(this);
    await this.deckManager.initialize();

    this.cardManager = new CardManager(this);

    this.gameManager = new GameManager3v3({
      scene:       this,
      cardManager: this.cardManager,
      deckManager: this.deckManager,
      config:      this.config
    });

    this.gameManager.envidoButtons = this.envidoButtons;
    this.gameManager.trucoButtons  = this.trucoButtons;
    this.gameManager.setupEventHandlers();
    this.gameManager.createScoreDisplay();
  }

showGameOver(playerTeamWon) {
    try {
        if (playerTeamWon) this.sound.play('ganar', { volume: 0.8 });
    } catch(e) {}

    this.envidoButtons?.hide();
    this.trucoButtons?.hide();
    // ... resto igual

    const txt     = playerTeamWon ? '¡Tu equipo ganó!' : '¡Ganó el equipo rival!';
    const color   = playerTeamWon ? '#4CAF50' : '#F44336';
    const bgColor = playerTeamWon ? 0x1b5e20  : 0x7f0000;

    this.add.rectangle(400, 300, 480, 260, bgColor, 0.92)
      .setStrokeStyle(3, 0xffffff, 0.8).setDepth(900);

    this.add.text(400, 215, txt, {
      fontFamily: 'Arial', fontSize: 38, fontStyle: 'bold', color
    }).setOrigin(0.5).setDepth(901);

    const s = this.gameManager?.scores || { teamA: 0, teamB: 0 };
    this.add.text(400, 285, `Vos ${s.teamA}  —  Rival ${s.teamB}`, {
      fontFamily: 'Arial', fontSize: 24, color: '#ffffff'
    }).setOrigin(0.5).setDepth(901);

    this.add.text(305, 350, 'Menú', {
      fontFamily: 'Arial', fontSize: 22, color: '#ffffff',
      backgroundColor: '#333333', padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setDepth(901)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MenuScene'));

    this.add.text(495, 350, 'Revancha', {
      fontFamily: 'Arial', fontSize: 22, color: '#ffffff',
      backgroundColor: '#1565C0', padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setDepth(901)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.restart());
  }

  showErrorScreen(message) {
    this.children.removeAll();
    this.add.rectangle(400, 300, 600, 360, 0x1a1a1a, 0.95)
      .setStrokeStyle(3, 0xff0000);
    this.add.text(400, 220, 'Error', { font: '26px Arial', fill: '#ff5555' }).setOrigin(0.5);
    this.add.text(400, 295, message || 'Error desconocido', {
      font: '17px Arial', fill: '#ffaaaa', wordWrap: { width: 540 }, align: 'center'
    }).setOrigin(0.5);
    this.add.text(400, 400, 'Reintentar', {
      font: '24px Arial', fill: '#ffffff', backgroundColor: '#333333', padding: 10
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.restart());
    this.time.delayedCall(15000, () => this.scene.restart());
  }
}