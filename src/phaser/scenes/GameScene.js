import Phaser from 'phaser';
import CardManager from '../managers/CardManager';
import DeckManager from '../managers/DeckManager';

export default class GameScene extends Phaser.Scene {
    constructor() {
        super('GameScene');
    }

    create() {
        // Inicializar managers
        this.deckManager = new DeckManager(this);
        this.cardManager = new CardManager(this);

        // Crear y barajar mazo
        this.deckManager.createDeck();
        this.deckManager.shuffle();

        // Repartir cartas
        this.dealInitialCards();
    }

    dealInitialCards() {
        // Cartas del jugador (frente)
        const playerCards = this.deckManager.dealCards(3).map((carta, i) => {
            return this.cardManager.getCard(
                300 + (i * 100), 
                500, 
                carta.key, 
                carta
            );
        });

        // Cartas del oponente (dorso)
        const opponentCards = this.deckManager.dealCards(3).map((carta, i) => {
            return this.cardManager.getCard(
                300 + (i * 100), 
                100, 
                'cardBack', 
                carta
            );
        });

        // Animación de reparto
        this.cardManager.dealCards(
            [...playerCards, ...opponentCards],
            [
                // Posiciones jugador
                { x: 300, y: 500 }, { x: 400, y: 500 }, { x: 500, y: 500 },
                // Posiciones oponente
                { x: 300, y: 100 }, { x: 400, y: 100 }, { x: 500, y: 100 }
            ],
            { onComplete: () => console.log('Cartas repartidas') }
        );
    }
}