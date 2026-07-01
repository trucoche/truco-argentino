// src/phaser/managers/TurnManager.js
export default class TurnManager {
  constructor(scene) {
    this.scene = scene;
    this.currentTurn = 'player'; // o 'opponent'
  }

  startTurn() {
    if (this.currentTurn === 'player') {
      this.scene.gameManager.enablePlayerInteractions();
    } else {
      this.playOpponentTurn();
    }
  }

  playOpponentTurn() {
    // Lógica de IA para el oponente
    setTimeout(() => {
      const randomCardIndex = Math.floor(Math.random() * this.scene.gameManager.opponentCards.length);
      this.playCard(this.scene.gameManager.opponentCards[randomCardIndex]);
    }, 1000);
  }

  switchTurn() {
    this.currentTurn = this.currentTurn === 'player' ? 'opponent' : 'player';
    this.startTurn();
  }
}