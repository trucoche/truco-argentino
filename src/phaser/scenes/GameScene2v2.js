import Phaser from 'phaser';
import CardManager    from '../managers/CardManager';
import DeckManager    from '../managers/DeckManager';
import GameManager2v2 from '../managers/GameManager2v2';
import EnvidoButtons  from '../ui/EnvidoButtons';
import TrucoButtons   from '../ui/TrucoButtons';

/*
  Layout de 4 jugadores:

        [Compañero  top-center]
  [Op1 left]      [Op2 right]
        [Vos  bottom-center]

  Zona de juego central con 4 posiciones por mano.
*/

export default class GameScene2v2 extends Phaser.Scene {

  constructor() {
    super('GameScene2v2');
    this._config = { puntosParaGanar: 15, juegoConFlor: false };
  }

  get config() { return this._config; }

  init(data) {
    if (data && typeof data === 'object') {
      this._config = { ...this._config, ...data };
    }
  }

  /* ==========================================
   * PRELOAD
   * ========================================== */

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

  /* ==========================================
   * CREATE
   * ========================================== */

  async create() {
    try {
      this._setupLayout();
      this._setupGraphics();
      this._initUI();
      await this._initGame();
      this.time.delayedCall(300, () => this.gameManager.startGame());
    } catch (err) {
      console.error('Error en GameScene2v2.create:', err);
      this.showErrorScreen(err.message);
    }
  }

  /* ==========================================
   * POSICIONES
   * ========================================== */

_setupLayout() {
    this.cardPositions = {
        player:    [{ x: 260, y: 505 }, { x: 380, y: 505 }, { x: 500, y: 505 }],
        teammate:  [{ x: 260, y:  70 }, { x: 380, y:  70 }, { x: 500, y:  70 }],
        opponent1: [{ x:  55, y: 210 }, { x:  55, y: 300 }, { x:  55, y: 390 }],
        opponent2: [{ x: 745, y: 210 }, { x: 745, y: 300 }, { x: 745, y: 390 }]
    };

    // Cada jugador tiene su zona fija, las 3 manos se apilan ligeramente
    this.playPositions = {
        player:    [{ x: 370, y: 420 }, { x: 378, y: 412 }, { x: 386, y: 404 }],
        teammate:  [{ x: 430, y: 175 }, { x: 438, y: 183 }, { x: 446, y: 191 }],
        opponent1: [{ x: 190, y: 310 }, { x: 198, y: 310 }, { x: 206, y: 310 }],
        opponent2: [{ x: 610, y: 310 }, { x: 602, y: 310 }, { x: 594, y: 310 }]
    };
}
  /* ==========================================
   * GRÁFICOS Y LABELS
   * ========================================== */

  _setupGraphics() {
    // Mesa
    this.add.image(400, 300, 'mesa').setDisplaySize(800, 600).setDepth(0);

    // Separador central
    this.add.rectangle(400, 300, 700, 2, 0xffffff, 0.07).setDepth(1);

    // Labels de jugadores
    const labelStyle = { font: '13px Arial', fill: '#ffffffbb' };
    this.add.text(380, 22,  'Compañero', labelStyle).setOrigin(0.5).setDepth(2);
    this.add.text(380, 578, 'Vos',       labelStyle).setOrigin(0.5).setDepth(2);
    this.add.text( 30, 300, 'IA 1',      labelStyle).setOrigin(0.5).setDepth(2).setAngle(-90);
    this.add.text(770, 300, 'IA 2',      labelStyle).setOrigin(0.5).setDepth(2).setAngle(90);

    // Barra de botones inferior
    this.add.rectangle(400, 570, 800, 50, 0x000000, 0.45).setDepth(90);
  }

  /* ==========================================
   * UI — BOTONES
   * ========================================== */

  _initUI() {
    this.envidoButtons = new EnvidoButtons(this, 144, 558);
    this.trucoButtons  = new TrucoButtons(this,  208 + 190, 558);
  }

  /* ==========================================
   * INICIALIZAR JUEGO
   * ========================================== */

  async _initGame() {
    this.deckManager = new DeckManager(this);
    await this.deckManager.initialize();

    this.cardManager = new CardManager(this);

    this.gameManager = new GameManager2v2({
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

  /* ==========================================
   * GAME OVER
   * ========================================== */

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
      fontFamily: 'Arial', fontSize: 40, fontStyle: 'bold', color
    }).setOrigin(0.5).setDepth(901);

    const s = this.gameManager?.scores || { teamA: 0, teamB: 0 };
    this.add.text(400, 285, `Vos ${s.teamA}  —  Rival ${s.teamB}`, {
      fontFamily: 'Arial', fontSize: 26, color: '#ffffff'
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

  /* ==========================================
   * PANTALLA DE ERROR
   * ========================================== */

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