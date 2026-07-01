import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
    console.log('BootScene construida');
  }

  preload() {
    console.log('BootScene preload()');
    // Precarga mínima (logo, barra carga)
    this.load.image('logo', '/assets/images/logo.png');
  }

  create() {
    console.log('BootScene create()');
    // Muestra logo brevemente
    this.add.image(400, 300, 'logo');
    
    // Temporizador para pasar a Preload
    this.time.delayedCall(1500, () => {
      this.scene.start('PreloadScene');
    });
  }
}