import EnvidoManager from './EnvidoManager';
import EnvidoButtons from '../ui/EnvidoButtons';
import TrucoManager from './TrucoManager';
import TrucoButtons from '../ui/TrucoButtons';

export default class GameManager {

  /* ==========================================
   * CONSTRUCTOR E INICIALIZACIÓN
   * ========================================== */

  constructor({ scene, cardManager, deckManager, onScoreUpdate, config }) {
    this.scene        = scene;
    this.cardManager  = cardManager;
    this.deckManager  = deckManager;
    this.onScoreUpdate = onScoreUpdate;
    this.config       = config || { puntosParaGanar: 15, juegoConFlor: false };

    // Arrays de cartas
    this.playerCards   = [];
    this.opponentCards = [];
    this.playedCards   = { player: [], opponent: [] };

    // Estado del juego
    this.gameActive    = false;
    this.currentTurn   = 'player';
    this.currentStage  = 'envido'; // 'envido' | 'truco' | 'card-play'

    // Slots de cartas jugadas (3 por jugador)
    this.playedSlots = {
      player:   [false, false, false],
      opponent: [false, false, false]
    };

    // Marcador
    this.scores = { player: 0, opponent: 0 };

    // Posiciones de la mano
this.positions = {
    playerHand:   [{ x: 280, y: 490 }, { x: 400, y: 490 }, { x: 520, y: 490 }],
    opponentHand: [{ x: 280, y: 100 }, { x: 400, y: 100 }, { x: 520, y: 100 }]
};

this.playPositions = {
    player:   [{ x: 230, y: 370 }, { x: 380, y: 370 }, { x: 530, y: 370 }],
    opponent: [{ x: 230, y: 230 }, { x: 380, y: 230 }, { x: 530, y: 230 }]
};

    // Inicializar managers de lógica
    this.trucoManager  = new TrucoManager(this);
    this.envidoManager = new EnvidoManager(this);

    // Estado de manos ganadas en la ronda actual
    this.handsWon = { player: 0, opponent: 0 };
    this.handCount = 0; // cuántas manos se jugaron en esta ronda

    console.log('GameManager inicializado');
    this._piledCards = [];
    this.difficulty = this.config.dificultad || 'normal';
  }

  /* ==========================================
   * INICIO Y REINICIO
   * ========================================== */

  startGame() {
    try {
      this._cleanupPreviousRound();

      // Reiniciar mazo
      this.deckManager.createDeck();
      this.deckManager.shuffle();
      this.deckManager._isInitialized = true;

      // Reiniciar estado de ronda
      this.handsWon  = { player: 0, opponent: 0 };
      this.handCount = 0;
      this.playedCards  = { player: [], opponent: [] };
      this.playedSlots  = {
        player:   [false, false, false],
        opponent: [false, false, false]
      };
      this.currentStage = 'envido';
      this.currentTurn  = 'player';
      this.gameActive   = true;

      // Reiniciar desafíos
      this.trucoManager.resetChallenge();
      this.envidoManager.resetChallenge();

      // Repartir cartas
      this._dealCards();

      // Mostrar marcador
      this._updateScoreDisplay();

      // Iniciar turno del jugador después de un breve delay
      this.scene.time.delayedCall(400, () => {
        this._startPlayerTurn();
      });

    } catch (error) {
      console.error('Error en startGame:', error);
      this.scene.showErrorScreen(error.message);
    }
  }

_cleanupPreviousRound() {
    // Destruir absolutamente todas las cartas creadas
    (this._allCreatedCards || []).forEach(card => {
        if (card && card.scene) card.destroy();
    });
    // Destruir pilas del centro
    (this._piledCards || []).forEach(card => {
        if (card && card.scene) card.destroy();
    });
    
    this._allCreatedCards = [];
    this._piledCards      = [];
    this.playerCards      = [];
    this.opponentCards    = [];
    this.playedCards      = { player: [], opponent: [] };
}

_dealCards() {
    this._allCreatedCards = [];

    const playerData   = this.deckManager.dealCards(3);
    const opponentData = this.deckManager.dealCards(3);

    // Crear todas las cartas en el centro primero
    this.playerCards = playerData.map((data, i) => {
        const card = this.cardManager.createCard(400, 300, data.key, data);
        if (card) {
            card.setDepth(10 + i);
            card.setAlpha(0);
        }
        return card;
    }).filter(Boolean);

    this.opponentCards = opponentData.map((data, i) => {
        const card = this.cardManager.createOpponentCard(400, 300, data);
        if (card) {
            card.setDepth(10 + i);
            card.setAlpha(0);
            card.setDisplaySize(100, 150);
        }
        return card;
    }).filter(Boolean);

    this._allCreatedCards = [...this.playerCards, ...this.opponentCards];

    // Animar cada carta volando a su posición final
    const allCards = [
        ...this.playerCards.map((card, i) => ({ card, pos: this.positions.playerHand[i] })),
        ...this.opponentCards.map((card, i) => ({ card, pos: this.positions.opponentHand[i] }))
    ];

    allCards.forEach(({ card, pos }, i) => {
        this.scene.time.delayedCall(i * 120, () => {
            if (!card.scene) return;

            // Sonido de reparto
            try { this.scene.sound.play('repartir', { volume: 0.5 }); } catch(e) {}

            card.setAlpha(1);
            this.scene.tweens.add({
                targets:  card,
                x:        pos.x,
                y:        pos.y,
                duration: 350,
                ease:     'Power2.easeOut'
            });
        });
    });
}

_cleanupPreviousRound() {
    // Destruir absolutamente todas las cartas creadas
    (this._allCreatedCards || []).forEach(card => {
        if (card && card.scene) card.destroy();
    });
    this._allCreatedCards = [];
    this._piledCards = [];
    this.playerCards   = [];
    this.opponentCards = [];
    this.playedCards   = { player: [], opponent: [] };
}

  /* ==========================================
   * TURNOS
   * ========================================== */

_startPlayerTurn() {
    if (!this.gameActive) return;
    this.currentTurn = 'player';
    this._showTurnIndicator(); 
    this._enablePlayerCards();

    // Mostrar botones según la fase
    if (this.currentStage === 'envido') {
      this.envidoButtons?.showForChallenge();
      this.trucoButtons?.hide();
    } else if (this.currentStage === 'truco' && this.canCallTruco()) {
      this.trucoButtons?.showForChallenge();
      this.envidoButtons?.hide();
    } else {
      this.envidoButtons?.hide();
      this.trucoButtons?.hide();
    }
  }

_startOpponentTurn() {
    if (!this.gameActive) return;
    this.currentTurn = 'opponent';
    this._hideTurnIndicator();
    this._disablePlayerCards();
    this.envidoButtons?.hide();
    this.trucoButtons?.hide();

    this.scene.time.delayedCall(900, () => {
      if (!this.gameActive) return;
      this._playOpponentCard();
    });
  }

  /* ==========================================
   * JUGAR CARTAS
   * ========================================== */

  _enablePlayerCards() {
    this.playerCards.forEach(card => {
      if (!card || !card.scene || card.getData('played')) return;
      card.setInteractive({ useHandCursor: true })
        .off('pointerdown')
        .on('pointerdown', () => this._onPlayerCardClick(card));
    });
  }

  _disablePlayerCards() {
    this.playerCards.forEach(card => {
      if (card && card.scene && card.input) {
        card.disableInteractive();
      }
    });
  }

  _onPlayerCardClick(card) {
    if (!this.gameActive || this.currentTurn !== 'player') return;
    if (card.getData('played')) return;

    // Al jugar carta, el envido ya no se puede cantar
    if (this.currentStage === 'envido') {
      this.currentStage = 'truco';
      this.envidoManager.resolvePendingChallenge();
    }

    this._disablePlayerCards();
    this.envidoButtons?.hide();
    this.trucoButtons?.hide();

    this._playCard(card, 'player');
  }

_playOpponentCard() {
    const playable = this.opponentCards.filter(c => c && c.scene && !c.getData('played'));
    if (playable.length === 0) {
        this._startPlayerTurn();
        return;
    }

    playable.sort((a, b) => {
        const ad = a.getData('cardData');
        const bd = b.getData('cardData');
        return this.getCardValue(bd.valor, bd.palo) - this.getCardValue(ad.valor, ad.palo);
    });

    let cardToPlay;
    if (this.difficulty === 'facil') {
        // 50% juega al azar, no siempre la mejor
        cardToPlay = Math.random() < 0.5
            ? playable[Math.floor(Math.random() * playable.length)]
            : playable[0];
    } else if (this.difficulty === 'dificil') {
        // Siempre juega óptimo, además guarda cartas altas para el final si puede ganar con menos
        cardToPlay = playable[playable.length - 1].getData('played') ? playable[0] : this._chooseSmartCard(playable);
    } else {
        // normal: siempre la más alta
        cardToPlay = playable[0];
    }

    this._playCard(cardToPlay, 'opponent');
}

_chooseSmartCard(playable) {
    // En difícil: si va perdiendo la mano, tira la más baja que pueda ganar; si no puede ganar, descarta la más floja
    const myCardOnTable = this.playedCards.player[this.playedCards.player.length - 1];
    if (!myCardOnTable) return playable[0]; // primero en jugar, tira la más alta

    const playerVal = this.getCardValue(
        myCardOnTable.getData('cardData').valor,
        myCardOnTable.getData('cardData').palo
    );

    // Buscar la carta más baja que aún le gane al jugador
    const winning = playable
        .filter(c => {
            const d = c.getData('cardData');
            return this.getCardValue(d.valor, d.palo) > playerVal;
        })
        .sort((a, b) => {
            const ad = a.getData('cardData'), bd = b.getData('cardData');
            return this.getCardValue(ad.valor, ad.palo) - this.getCardValue(bd.valor, bd.palo);
        });

    if (winning.length > 0) return winning[0]; // gana con la mínima necesaria
    // Si no puede ganar, descarta la más floja
    return playable[playable.length - 1];
}

_playCard(card, playerType) { 
    const slotIndex = this.playedSlots[playerType].indexOf(false);
    if (slotIndex === -1) return;

    this.playedSlots[playerType][slotIndex] = true;
    card.setData('played', true);
        // Sonido al jugar carta
    try {
        this.scene.sound.play('jugar-carta', { volume: 0.7 });
    } catch(e) {}

  if (playerType === 'opponent' && card.getData('isFacedown')) {
      const cardData = card.getData('cardData');
      if (cardData) {
          card.setTexture(cardData.key);
          card.setDisplaySize(100, 150); // ← agregar esta línea
      }
      card.setData('isFacedown', false);
  }

    const target = this.playPositions[playerType][slotIndex];
    card.setDepth(30 + slotIndex);

    // Asegurarse que está en _allCreatedCards
    if (!this._allCreatedCards) this._allCreatedCards = [];
    if (!this._allCreatedCards.includes(card)) {
        this._allCreatedCards.push(card);
    }

  if (card.scene && this.scene.tweens) {
      this.scene.tweens.killTweensOf(card);
      this.scene.tweens.add({
          targets:  card,
          x:        target.x,
          y:        target.y,
          duration: 350,
          ease:     'Power2',
          onComplete: () => {
              if (!card.scene) return;
              // Forzar tamaño correcto al terminar animación
              card.setDisplaySize(100, 150);
              this.playedCards[playerType].push(card);
              this._afterCardPlayed(playerType);
          }
      });
  }else {
        card.x = target.x;
        card.y = target.y;
        this.playedCards[playerType].push(card);
        this._afterCardPlayed(playerType);
    }
}

  _afterCardPlayed(playerType) {
    const playerPlayed   = this.playedCards.player.length;
    const opponentPlayed = this.playedCards.opponent.length;

    // Ambos jugaron → resolver mano
    if (playerPlayed > 0 && opponentPlayed > 0 &&
        playerPlayed === opponentPlayed) {
      this.scene.time.delayedCall(400, () => this._resolveHand());
      return;
    }

    // Solo uno jugó → turno del otro
    if (playerType === 'player') {
      this._startOpponentTurn();
    } else {
      this._startPlayerTurn();
    }
  }

  /* ==========================================
   * RESOLVER MANOS Y RONDAS
   * ========================================== */

  _resolveHand() {
    const pCards = this.playedCards.player;
    const oCards = this.playedCards.opponent;
    const lastP  = pCards[pCards.length - 1];
    const lastO  = oCards[oCards.length - 1];

    if (!lastP || !lastO || !lastP.scene || !lastO.scene) return;

    const pdData = lastP.getData('cardData');
    const odData = lastO.getData('cardData');
    const pVal   = this.getCardValue(pdData.valor, pdData.palo);
    const oVal   = this.getCardValue(odData.valor, odData.palo);

    let handWinner;
    if (pVal > oVal) {
      handWinner = 'player';
      this.showMessage('¡Ganaste la mano!');
    } else if (oVal > pVal) {
      handWinner = 'opponent';
      this.showMessage('El oponente gana la mano');
    } else {
      handWinner = 'player'; // empate gana el mano (simplificado)
      this.showMessage('¡Empate! Gana el mano');
    }

    this.handsWon[handWinner]++;
    this.handCount++;

    const pH = this.handsWon.player;
    const oH = this.handsWon.opponent;

    // ¿Terminó la ronda? (alguien ganó 2 manos, o se jugaron 3)
    const roundOver = pH >= 2 || oH >= 2 || this.handCount >= 3;

    if (roundOver) {
        const roundWinner = pH >= oH ? 'player' : 'opponent';
        const points = this.trucoManager?.currentChallenge?.points || 1;
        this.scene.time.delayedCall(1500, () => {
            this.trucoManager.reset();
            this.addScore(roundWinner, points, true); // ← solo este cambio
        });
    } else {
      // Siguiente mano dentro de la ronda
      this.scene.time.delayedCall(1500, () => {
        this._nextHand(handWinner);
      });
    }
  }

_nextHand(handWinner) {
    [...this.playedCards.player, ...this.playedCards.opponent].forEach((card, i) => {
        if (card && card.scene) {
            card.setDepth(5 + i);
            this.scene.tweens.add({
                targets: card,
                x: 380 + (i * 8),
                y: 300 + (i * 4),
                alpha: 0.45,
                duration: 300
            });
            this._piledCards.push(card); // ← guardar referencia
        }
    });

    this.playedCards = { player: [], opponent: [] };
    this.playedSlots = {
        player:   [false, false, false],
        opponent: [false, false, false]
    };

    this.currentStage = 'truco';
    this.currentTurn  = handWinner;

    this.scene.time.delayedCall(500, () => {
        if (handWinner === 'player') {
            this._startPlayerTurn();
        } else {
            this._startOpponentTurn();
        }
    });
}

  /* ==========================================
   * PUNTAJE
   * ========================================== */

addScore(player, points, isRoundEnd = false) {
    if (!['player', 'opponent'].includes(player)) return false;
    points = Math.max(1, parseInt(points) || 1);

    this.scores[player] += points;
    this._updateScoreDisplay();
    this.showMessage(`${player === 'player' ? 'Vos' : 'IA'} +${points} punto(s)`);

    if (this.scores[player] >= this.config.puntosParaGanar) {
        this.scene.time.delayedCall(1500, () => this._endGame(player));
        return true;
    }

    // Solo repartir nuevamente si es fin de ronda
    if (isRoundEnd) {
        this.scene.time.delayedCall(1500, () => this.startGame());
    }

    return true;
}

  _updateScoreDisplay() {
    if (this.scoreText) {
      this.scoreText.setText(`Vos: ${this.scores.player}  |  IA: ${this.scores.opponent}`);
    }
  }

_endGame(winner) {
    this.gameActive = false;
    this._hideTurnIndicator(); 
    this._disablePlayerCards();
    this.scene.showGameOver(winner === 'player');
}

  /* ==========================================
   * TRUCO Y ENVIDO
   * ========================================== */

  canCallTruco() {
    return !this.trucoManager?.currentChallenge?.type;
  }

  continueAfterTruco() {
    this.envidoButtons?.hide();
    this.trucoButtons?.hide();
    this.currentStage = 'truco';
    if (this.currentTurn === 'player') {
      this._startPlayerTurn();
    } else {
      this._startOpponentTurn();
    }
  }

  /* ==========================================
   * UI — BOTONES Y MARCADOR
   * ========================================== */

  initUIComponents() {
    this.envidoButtons = this.scene.envidoButtons;
    this.trucoButtons  = this.scene.trucoButtons;
  }

  setupEventHandlers() {
    if (!this.envidoButtons || !this.trucoButtons) return;

    this.envidoButtons.off('challenge-selected').on('challenge-selected', (challenge) => {
        const type = challenge?.key || challenge;
        this.envidoManager.callEnvido('player', type);
        this.envidoButtons.hide();
        this.trucoButtons.hide();

        this.scene.time.delayedCall(1200, () => {
            const accepts = Math.random() > 0.4;
            if (accepts) {
                this.envidoManager.respondToEnvido('opponent', 'accept');
                this.envidoManager.resolveChallenge();
            } else {
                this.envidoManager.respondToEnvido('opponent', 'reject');
            }
            // ← Ya NO llama a startGame, solo continúa la mano
            this.currentStage = 'truco';
            this.scene.time.delayedCall(1000, () => {
                this._startPlayerTurn();
            });
        });
    });

    this.envidoButtons.off('skip').on('skip', () => {
      this.envidoButtons.hide();
      this.trucoButtons.hide();
      this.currentStage = 'truco';
      this._startPlayerTurn();
    });

    this.trucoButtons.off('truco-selected').on('truco-selected', (type) => {
      if (!this.trucoManager) return;
      this.trucoManager.callTruco(type, 'player');
      this.envidoButtons.hide();
      this.trucoButtons.hide();
    });
  }

  hideAllButtons() {
    this.envidoButtons?.hide();
    this.trucoButtons?.hide();
  }

  showMessage(text) {
    if (this._lastMessage && this._lastMessage.scene) {
      this._lastMessage.destroy();
    }

    this._lastMessage = this.scene.add.text(
      this.scene.cameras.main.centerX,
      this.scene.cameras.main.centerY - 60,
      text,
      { font: '24px Arial', fill: '#ffffff', backgroundColor: '#000000cc', padding: 12 }
    ).setOrigin(0.5).setDepth(600);

    this.scene.time.delayedCall(2000, () => {
      if (this._lastMessage && this._lastMessage.scene) {
        this._lastMessage.destroy();
        this._lastMessage = null;
      }
    });
  }

createScoreDisplay() {
    if (this.scoreBg   && this.scoreBg.scene)   this.scoreBg.destroy();
    if (this.scoreText && this.scoreText.scene)  this.scoreText.destroy();

    this.scoreBg = this.scene.add.rectangle(400, 18, 200, 30, 0x000000, 0.6)
        .setDepth(300);
    this.scoreText = this.scene.add.text(400, 18,
        `Vos: 0  |  IA: 0`,
        { font: '18px Arial', fill: '#ffffff' }
    ).setOrigin(0.5).setDepth(301);
}

  /* ==========================================
   * JERARQUÍA DE CARTAS (TRUCO ARGENTINO)
   * ========================================== */

  getCardValue(valor, palo) {
    valor = String(valor);
    palo  = String(palo);

    if (valor === '1' && palo === 'espada') return 14;
    if (valor === '1' && palo === 'basto')  return 13;
    if (valor === '7' && palo === 'espada') return 12;
    if (valor === '7' && palo === 'oro')    return 11;
    if (valor === '3') return 10;
    if (valor === '2') return 9;
    if (valor === '1') return 8;  // copa y oro
    if (valor === '12') return 7;
    if (valor === '11') return 6;
    if (valor === '10') return 5;
    if (valor === '7') return 4;  // copa y basto
    if (valor === '6') return 3;
    if (valor === '5') return 2;
    if (valor === '4') return 1;
    return 0;
  }

_showTurnIndicator() {
    if (this._turnIndicator) {
        this._turnIndicator.destroy();
        this._turnIndicator = null;
    }
    if (this._turnTween) {
        this._turnTween.stop();
        this._turnTween = null;
    }

    this._turnIndicator = this.scene.add.text(
        720, 548,  // ← derecha, al lado del botón Pasar
        '● Tu turno',
        {
            font: 'bold 15px Arial',
            fill: '#FFD700',
            stroke: '#000000',
            strokeThickness: 3
        }
    ).setOrigin(0.5).setDepth(200);

    this._turnTween = this.scene.tweens.add({
        targets:  this._turnIndicator,
        alpha:    0.2,
        duration: 600,
        yoyo:     true,
        repeat:   -1,
        ease:     'Sine.easeInOut'
    });
}

_hideTurnIndicator() {
    if (this._turnIndicator) {
        this._turnIndicator.destroy();
        this._turnIndicator = null;
    }
    if (this._turnTween) {
        this._turnTween.stop();
        this._turnTween = null;
    }
}
}