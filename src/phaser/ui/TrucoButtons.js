import Phaser from 'phaser';

export default class TrucoButtons extends Phaser.GameObjects.Container {

  constructor(scene, x = 400, y = 560) {
    super(scene, x, y);
    this.scene   = scene;
    this.buttons = [];
    this.currentChallengeLevel = 0;
    this._createButtons();
    scene.add.existing(this);
    this.setVisible(false).setDepth(100);
  }

  _createButtons() {
    const base = {
      font:        '16px Arial',
      fill:        '#ffffff',
      padding:     { x: 14, y: 8 },
      fixedWidth:  120,
      align:       'center',
      backgroundColor: '#2a5c1a'
    };

    const types = [
      { text: 'Truco',      key: 'truco'      },
      { text: 'Retruco',    key: 'retruco'    },
      { text: 'Vale Cuatro',key: 'vale-cuatro'}
    ];

    types.forEach((type, i) => {
      const btn = this.scene.add.text(i * 128, 0, type.text, { ...base })
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this._onTrucoCall(type.key))
        .on('pointerover',  () => btn.setStyle({ backgroundColor: '#3d8c26' }))
        .on('pointerout',   () => btn.setStyle({ backgroundColor: '#2a5c1a' }));
      this.buttons.push(btn);
      this.add(btn);
    });
  }

  _onTrucoCall(type) {
    this.emit('truco-selected', type);
    this.hide();
  }

  showForChallenge() {
    this.buttons.forEach((btn, i) => {
      const show = i >= this.currentChallengeLevel;
      btn.setVisible(show);
      if (show) btn.setInteractive({ useHandCursor: true });
      else      btn.disableInteractive();
    });
    this.setVisible(true);
  }

  updateChallengeLevel(level) {
    this.currentChallengeLevel = level;
  }

  hide() {
    this.setVisible(false);
  }

  destroy() {
    this.buttons.forEach(btn => { if (btn) btn.destroy(); });
    super.destroy();
  }
}