import Phaser from 'phaser';

export default class EnvidoButtons extends Phaser.GameObjects.Container {

  constructor(scene, x = 400, y = 560) {
    super(scene, x, y);
    this.scene = scene;
    this.challengeButtons = [];
    this.responseButtons  = [];
    this.skipButton       = null;
    this._createButtons();
    scene.add.existing(this);
    this.setVisible(false).setDepth(100);
  }

  _createButtons() {
    const base = {
      font:            '16px Arial',
      fill:            '#ffffff',
      padding:         { x: 14, y: 8 },
      fixedWidth:      120,
      align:           'center'
    };

    const challenges = [
      { text: 'Envido',       key: 'envido'       },
      { text: 'Real Envido',  key: 'real-envido'  },
      { text: 'Falta Envido', key: 'falta-envido' }
    ];

    // Botones de desafío en fila horizontal
    // ancho botón ~120 + 8 gap = 128 por botón
    challenges.forEach((ch, i) => {
      const btn = this.scene.add.text(i * 128, 0, ch.text, {
        ...base, backgroundColor: '#5c3310'
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.emit('challenge-selected', ch))
      .on('pointerover',  () => btn.setStyle({ backgroundColor: '#8b4f1a' }))
      .on('pointerout',   () => btn.setStyle({ backgroundColor: '#5c3310' }));
      this.challengeButtons.push(btn);
      this.add(btn);
    });

    // Botón "Pasar" a la derecha
    this.skipButton = this.scene.add.text(3 * 128, 0, 'Pasar', {
      ...base, fixedWidth: 90, backgroundColor: '#333333'
    })
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => this.emit('skip'))
    .on('pointerover',  () => this.skipButton.setStyle({ backgroundColor: '#555555' }))
    .on('pointerout',   () => this.skipButton.setStyle({ backgroundColor: '#333333' }))
    .setVisible(false);
    this.add(this.skipButton);

    // Botones de respuesta (Quiero / No Quiero) — misma fila
    const qBtn = this.scene.add.text(0, 0, 'Quiero', {
      ...base, fixedWidth: 110, backgroundColor: '#1a5c1a'
    })
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => this.emit('response', { type: 'accept' }))
    .on('pointerover',  () => qBtn.setStyle({ backgroundColor: '#267326' }))
    .on('pointerout',   () => qBtn.setStyle({ backgroundColor: '#1a5c1a' }))
    .setVisible(false);

    const nqBtn = this.scene.add.text(118, 0, 'No Quiero', {
      ...base, fixedWidth: 120, backgroundColor: '#5c1a1a'
    })
    .setInteractive({ useHandCursor: true })
    .on('pointerdown', () => this.emit('response', { type: 'reject' }))
    .on('pointerover',  () => nqBtn.setStyle({ backgroundColor: '#732626' }))
    .on('pointerout',   () => nqBtn.setStyle({ backgroundColor: '#5c1a1a' }))
    .setVisible(false);

    this.responseButtons = [qBtn, nqBtn];
    this.add(qBtn);
    this.add(nqBtn);
  }

  showForChallenge(showSkip = true) {
    this._setGroupVisible(this.challengeButtons, true);
    this._setGroupVisible(this.responseButtons,  false);
    if (this.skipButton) this.skipButton.setVisible(showSkip);
    this.setVisible(true);
  }

  showForResponse() {
    this._setGroupVisible(this.challengeButtons, false);
    this._setGroupVisible(this.responseButtons,  true);
    if (this.skipButton) this.skipButton.setVisible(false);
    this.setVisible(true);
  }

  hide() {
    this.setVisible(false);
  }

  _setGroupVisible(group, visible) {
    (group || []).forEach(btn => { if (btn) btn.setVisible(visible); });
  }

  destroy() {
    this._setGroupVisible(this.challengeButtons, false);
    this._setGroupVisible(this.responseButtons,  false);
    if (this.skipButton) this.skipButton.destroy();
    super.destroy();
  }
}