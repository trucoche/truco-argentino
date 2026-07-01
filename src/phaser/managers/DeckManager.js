import Phaser from 'phaser';

export default class DeckManager {
  constructor(scene) {
    this.scene = scene;
    this.cards = [];
    this._isInitialized = false;
  }

  /**
   * Inicializa el mazo (crea y baraja)
   * @returns {Promise<void>}
   */
  initialize() {
    return new Promise((resolve) => {
      this.createDeck();
      this.shuffle();
      this._isInitialized = true;
      console.log('Mazo inicializado con', this.cards.length, 'cartas');
      resolve();
    });
  }

  createDeck() {
    this.cards = [];
    const palos = ['oro', 'copa', 'espada', 'basto'];
    const valores = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];
    
    palos.forEach(palo => {
      valores.forEach(valor => {
        this.cards.push({
          valor,
          palo,
          key: `${valor}_${palo}`
        });
      });
    });
    return this;
  }


  shuffle() {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
    return this;
  }

  dealCards(count) {
    if (!this._isInitialized) {
      throw new Error('El mazo no ha sido inicializado');
    }
    return this.cards.splice(0, count);
  }

  /**
   * Obtiene el valor jerárquico de la carta para comparaciones
   * @private
   */
  _getCardRank(valor) {
    const rankMap = {
      1: 14,  // El as es la carta más alta
      2: 2,
      3: 3,
      4: 4,
      5: 5,
      6: 6,
      7: 7,
      10: 10,
      11: 11,
      12: 12
    };
    return rankMap[valor] || 0;
  }

  /**
   * Reinicia el mazo completamente
   * @returns {Promise<void>}
   */
  reset() {
    return this.initialize();
  }
}