import Phaser from 'phaser';
import PreloadScene from '../scenes/PreloadScene'; // Asegúrate de incluirla
import MenuScene from '../scenes/MenuScene';
import GameScene1v1 from '../scenes/GameScene1v1';
import GameScene2v2 from '../scenes/GameScene2v2';
import GameScene3v3 from '../scenes/GameScene3v3';

const gameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  scene: [PreloadScene, MenuScene, GameScene1v1, GameScene2v2, GameScene3v3], // Orden correcto
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  backgroundColor: '#2d2d2d'
};

export default gameConfig;