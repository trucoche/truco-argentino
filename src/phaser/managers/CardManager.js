import Phaser from 'phaser';
import DepthManager from './DepthManager';

export default class CardManager {
    constructor(scene) {
    this.scene = scene;
    
    // Configuración única para todos los tamaños
    this.cardSettings = {
      hand: {
        width: 100,
        height: 150,
        scale: 0.35
      },
      played: {
        width: 120,
        height: 180,
        scale: 0.4
      }
    };

    this.cardPool = this.scene.add.group({
      classType: Phaser.GameObjects.Image,
      maxSize: 40,
      createCallback: (card) => {
        card.setOrigin(0.5, 0.5)
            .setInteractive({ useHandCursor: true })
            .setData('sizeSettings', this.cardSettings.hand); // Tamaño inicial
      }
    });
  }

  /**
   * Crea/recicla una carta con tamaño consistente
   */

createCard(x, y, texture, cardData) {
    if (!this.scene.textures.exists(texture)) return null;
    
    // Crear siempre nuevo, no reusar del pool
    const card = this.scene.add.image(x, y, texture);
    const settings = this.cardSettings.hand;
    
    card.setOrigin(0.5, 0.5)
        .setScale(settings.scale)
        .setDisplaySize(settings.width, settings.height)
        .setData('cardData', cardData)
        .setData('sizeSettings', settings)
        .setInteractive({ useHandCursor: true });
    
    return card;
}

  /**
   * Crea una carta para el oponente (con dorso visible inicialmente)
   * @param {number} x - Posición horizontal
   * @param {number} y - Posición vertical
   * @param {object} cardData - Datos de la carta
   * @returns {Phaser.GameObjects.Image} - Carta del oponente
   */

createOpponentCard(x, y, cardData) {
    if (!cardData || typeof cardData !== 'object') return null;
    
    const card = this.scene.add.image(x, y, 'cardBack');
    const settings = this.cardSettings.hand;
    
    card.setOrigin(0.5, 0.5)
        .setScale(settings.scale)
        .setDisplaySize(settings.width, settings.height)
        .setData('isOpponent', true)
        .setData('isFacedown', true)
        .setData('cardData', { ...cardData });
    
    return card;
}

  /**
   * Deshabilita interacciones para todas las cartas
   */
  disableAllInteractions() {
    this.cardPool.getChildren().forEach(card => {
      card.disableInteractive();
    });
  }

  /**
   * Habilita interacciones para un conjunto de cartas
   * @param {Array} cards - Array de cartas a habilitar
   */
  enableInteractions(cards) {
    cards.forEach(card => {
      card.setInteractive({ useHandCursor: true });
    });
  }

  /**
 * Actualiza el tamaño de una carta según su estado
 * @param {Phaser.GameObjects.Image} card - Objeto de carta
 * @param {string} state - 'hand' o 'played'
 */
updateCardSize(card, state = 'hand') {
  const settings = this.cardSettings[state];
  if (!settings || !card) return;
  
  card.setData('sizeSettings', settings)
      .setScale(settings.scale)
      .setDisplaySize(settings.width, settings.height);
}
}