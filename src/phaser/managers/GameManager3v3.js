import TrucoManager from './TrucoManager';
import EnvidoManager from './EnvidoManager';

/*
  Jugadores:  player | teammate1 | teammate2 | opponent1 | opponent2 | opponent3
  Equipos:    teamA = [player, teammate1, teammate2]
              teamB = [opponent1, opponent2, opponent3]
  Turno:      player → opponent1 → teammate1 → opponent2 → teammate2 → opponent3
*/

const TURN_ORDER = ['player', 'opponent1', 'teammate1', 'opponent2', 'teammate2', 'opponent3'];
const TEAM_A     = ['player', 'teammate1', 'teammate2'];
const TEAM_B     = ['opponent1', 'opponent2', 'opponent3'];

export default class GameManager3v3 {

  constructor({ scene, cardManager, deckManager, config }) {
    this.scene       = scene;
    this.cardManager = cardManager;
    this.deckManager = deckManager;
    this.config      = config || { puntosParaGanar: 15, juegoConFlor: false };

    this.cards  = { player: [], teammate1: [], teammate2: [], opponent1: [], opponent2: [], opponent3: [] };
    this.played = { player: null, teammate1: null, teammate2: null, opponent1: null, opponent2: null, opponent3: null };

    this.handIndex = 0;
    this.handsWon  = { teamA: 0, teamB: 0 };
    this.scores    = { teamA: 0, teamB: 0 };

    this.gameActive   = false;
    this.currentTurn  = 'player';
    this.currentStage = 'envido';

    this.trucoManager  = new TrucoManager(this);
    this.envidoManager = new EnvidoManager(this);

    this.envidoButtons = null;
    this.trucoButtons  = null;

    this._allCards   = [];
    this._piledCards = [];

    console.log('GameManager3v3 inicializado');
    this.difficulty = this.config.dificultad || 'normal';
  }

  /* ==========================================
   * INICIO / REINICIO
   * ========================================== */

  startGame() {
    try {
      this._cleanup();

      this.deckManager.createDeck();
      this.deckManager.shuffle();
      this.deckManager._isInitialized = true;

      this.handsWon   = { teamA: 0, teamB: 0 };
      this.handIndex  = 0;
      this.played     = { player: null, teammate1: null, teammate2: null, opponent1: null, opponent2: null, opponent3: null };
      this.currentStage = 'envido';
      this.currentTurn  = 'player';
      this.gameActive   = true;

      this.trucoManager.resetChallenge();
      this.envidoManager.resetChallenge();

      this._dealCards();
      this._updateScoreDisplay();

      this.scene.time.delayedCall(400, () => this._startTurn('player'));

    } catch (err) {
      console.error('Error en startGame 3v3:', err);
      this.scene.showErrorScreen(err.message);
    }
  }

  _cleanup() {
    (this._allCards   || []).forEach(c => { if (c?.scene) c.destroy(); });
    (this._piledCards || []).forEach(c => { if (c?.scene) c.destroy(); });
    this._allCards   = [];
    this._piledCards = [];
    this.cards  = { player: [], teammate1: [], teammate2: [], opponent1: [], opponent2: [], opponent3: [] };
    this.played = { player: null, teammate1: null, teammate2: null, opponent1: null, opponent2: null, opponent3: null };
  }

_dealCards() {
    const pos = this.scene.cardPositions;

    TURN_ORDER.forEach(who => {
        const data    = this.deckManager.dealCards(3);
        const isSide  = who === 'opponent1' || who === 'opponent3';
        const isTop   = who === 'teammate1' || who === 'teammate2' || who === 'opponent2';
        
        let w = 85, h = 128;
        if (isSide) { w = 55; h = 82; }
        else if (isTop) { w = 62; h = 93; }

        this.cards[who] = data.map((d, i) => {
            const p    = pos[who][i];
            const card = who === 'player'
                ? this.cardManager.createCard(p.x, p.y, d.key, d)
                : this.cardManager.createOpponentCard(p.x, p.y, d);
            if (card) {
                card.setDepth(10 + i);
                card.setDisplaySize(w, h);
                if (isSide) card.setAngle(90);
            }
            return card;
        }).filter(Boolean);
    });

    this._allCards = TURN_ORDER.flatMap(who => this.cards[who]);
    for (let i = 0; i < 6; i++) {
    this.scene.time.delayedCall(i * 150, () => {
        try {
            this.scene.sound.play('repartir', { volume: 0.6 });
        } catch(e) {}
    });
}
}

  /* ==========================================
   * TURNOS
   * ========================================== */

_startTurn(who) {
    if (!this.gameActive) return;
    this.currentTurn = who;

    if (who === 'player') {
        this._showTurnIndicator(); // ← ya está
        this._enablePlayerCards();
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
    } else {
        this._hideTurnIndicator(); // ← agregar acá
        this._disablePlayerCards();
        this.envidoButtons?.hide();
        this.trucoButtons?.hide();
        this.scene.time.delayedCall(800, () => {
            if (!this.gameActive) return;
            this._playAICard(who);
        });
    }
}

  _nextTurnAfter(who) {
    const allPlayed = TURN_ORDER.every(w => this.played[w] !== null);
    if (allPlayed) {
      this.scene.time.delayedCall(400, () => this._resolveHand());
      return;
    }
    const idx  = TURN_ORDER.indexOf(who);
    const next = TURN_ORDER[(idx + 1) % TURN_ORDER.length];
    // Saltar si ya jugó
    if (this.played[next] !== null) {
      this._nextTurnAfter(next);
    } else {
      this._startTurn(next);
    }
  }

  /* ==========================================
   * JUGAR CARTAS
   * ========================================== */

  _enablePlayerCards() {
    this.cards.player.forEach(card => {
      if (!card?.scene || card.getData('played')) return;
      card.setInteractive({ useHandCursor: true })
        .off('pointerdown')
        .on('pointerdown', () => this._onPlayerClick(card));
    });
  }

  _disablePlayerCards() {
    this.cards.player.forEach(card => {
      if (card?.scene && card.input) card.disableInteractive();
    });
  }

  _onPlayerClick(card) {
    if (!this.gameActive || this.currentTurn !== 'player') return;
    if (card.getData('played')) return;
    if (this.currentStage === 'envido') {
      this.currentStage = 'truco';
      this.envidoManager.resolvePendingChallenge();
    }
    this._disablePlayerCards();
    this.envidoButtons?.hide();
    this.trucoButtons?.hide();
    this._playCard(card, 'player');
  }

_playAICard(who) {
    const available = this.cards[who].filter(c => c?.scene && !c.getData('played'));
    if (available.length === 0) {
        this._nextTurnAfter(who);
        return;
    }

    available.sort((a, b) => {
        const ad = a.getData('cardData');
        const bd = b.getData('cardData');
        return this.getCardValue(bd.valor, bd.palo) - this.getCardValue(ad.valor, ad.palo);
    });

    let cardToPlay;
    if (this.difficulty === 'facil') {
        cardToPlay = Math.random() < 0.5
            ? available[Math.floor(Math.random() * available.length)]
            : available[0];
    } else if (this.difficulty === 'dificil') {
        cardToPlay = this._chooseSmartCard(available, who);
    } else {
        cardToPlay = available[0];
    }

    this._playCard(cardToPlay, who);
}

_chooseSmartCard(available, who) {
    // Busca la carta jugada más alta en la mesa hasta ahora
    const playedVals = Object.entries(this.played)
        .filter(([k, c]) => c !== null)
        .map(([k, c]) => {
            const d = c.getData('cardData');
            return d ? this.getCardValue(d.valor, d.palo) : 0;
        });

    if (playedVals.length === 0) return available[0]; // primero en jugar

    const maxOnTable = Math.max(...playedVals);

    const winning = available
        .filter(c => {
            const d = c.getData('cardData');
            return this.getCardValue(d.valor, d.palo) > maxOnTable;
        })
        .sort((a, b) => {
            const ad = a.getData('cardData'), bd = b.getData('cardData');
            return this.getCardValue(ad.valor, ad.palo) - this.getCardValue(bd.valor, bd.palo);
        });

    if (winning.length > 0) return winning[0];
    return available[available.length - 1];
}

  _playCard(card, who) {
    card.setData('played', true);    card.setData('played', true);

    // Sonido al jugar carta
    try {
        this.scene.sound.play('jugar-carta', { volume: 0.7 });
    } catch(e) {}
    card.setAngle(0);

    if (who !== 'player' && card.getData('isFacedown')) {
      const d = card.getData('cardData');
      if (d) card.setTexture(d.key);
      card.setData('isFacedown', false);
    }
    card.setDisplaySize(75, 112);
    card.setDepth(40);

    const target = this.scene.playPositions[who][this.handIndex];
    this.scene.tweens.killTweensOf(card);
    this.scene.tweens.add({
      targets: card, x: target.x, y: target.y,
      duration: 320, ease: 'Power2',
      onComplete: () => {
        if (!card.scene) return;
        card.setDisplaySize(75, 112);
        this.played[who] = card;
        this._nextTurnAfter(who);
      }
    });
  }

  /* ==========================================
   * RESOLVER MANO Y RONDA
   * ========================================== */

  _resolveHand() {
    const bestA = this._bestCard(TEAM_A);
    const bestB = this._bestCard(TEAM_B);

    let handWinner;
    if (bestA > bestB) {
      handWinner = 'teamA';
      this.showMessage('¡Tu equipo gana la mano!');
    } else if (bestB > bestA) {
      handWinner = 'teamB';
      this.showMessage('El equipo rival gana la mano');
    } else {
      handWinner = 'teamA';
      this.showMessage('¡Empate! Gana el mano');
    }

    this.handsWon[handWinner]++;
    this.handIndex++;

    const { teamA: hA, teamB: hB } = this.handsWon;
    const roundOver = hA >= 2 || hB >= 2 || this.handIndex >= 3;

    if (roundOver) {
      const rWinner = hA >= hB ? 'teamA' : 'teamB';
      const pts     = this.trucoManager?.currentChallenge?.points || 1;
      this.scene.time.delayedCall(1500, () => {
        this.trucoManager.reset();
        this.addScore(rWinner, pts, true);
      });
    } else {
      this.scene.time.delayedCall(1500, () => this._nextHand(handWinner));
    }
  }

  _bestCard(team) {
    return Math.max(...team.map(who => {
      const c = this.played[who];
      if (!c) return 0;
      const d = c.getData('cardData');
      return d ? this.getCardValue(d.valor, d.palo) : 0;
    }));
  }

  _nextHand(handWinner) {
    Object.values(this.played).forEach((card, i) => {
      if (card?.scene) {
        card.setDepth(3 + i);
        this.scene.tweens.add({
          targets: card,
          x: 400, y: 295,
          displayWidth: 50, displayHeight: 75,
          alpha: 0.85, duration: 300
        });
        this._piledCards.push(card);
      }
    });

    this.played = { player: null, teammate1: null, teammate2: null, opponent1: null, opponent2: null, opponent3: null };
    this.currentStage = 'truco';

    const starter = TEAM_A.includes(handWinner) ? 'player' : 'opponent1';
    this.scene.time.delayedCall(500, () => this._startTurn(starter));
  }

  /* ==========================================
   * PUNTAJE
   * ========================================== */

  addScore(team, points, isRoundEnd = false) {
    if (!['teamA', 'teamB'].includes(team)) return false;
    points = Math.max(1, parseInt(points) || 1);
    this.scores[team] += points;
    this._updateScoreDisplay();

    const label = team === 'teamA' ? 'Tu equipo' : 'Equipo rival';
    this.showMessage(`${label} +${points} punto(s)`);

    if (this.scores[team] >= this.config.puntosParaGanar) {
      this.scene.time.delayedCall(1500, () => this._endGame(team));
      return true;
    }
    if (isRoundEnd) {
      this.scene.time.delayedCall(1500, () => this.startGame());
    }
    return true;
  }

  _updateScoreDisplay() {
    if (this.scoreText) {
      this.scoreText.setText(`Vos: ${this.scores.teamA}  |  Rival: ${this.scores.teamB}`);
    }
  }

  _endGame(winner) {
    this.gameActive = false;
    this._disablePlayerCards();
    this.scene.showGameOver(winner === 'teamA');
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
    this._startTurn(this.currentTurn);
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
        this.currentStage = 'truco';
        this.scene.time.delayedCall(800, () => this._startTurn('player'));
      });
    });

    this.envidoButtons.off('skip').on('skip', () => {
      this.envidoButtons.hide();
      this.trucoButtons.hide();
      this.currentStage = 'truco';
      this._startTurn('player');
    });

    this.trucoButtons.off('truco-selected').on('truco-selected', (type) => {
      this.trucoManager.callTruco(type, 'player');
      this.envidoButtons.hide();
      this.trucoButtons.hide();
    });
  }

  showMessage(text) {
    if (this._lastMsg?.scene) this._lastMsg.destroy();
    this._lastMsg = this.scene.add.text(400, 290, text,
      { font: '20px Arial', fill: '#fff', backgroundColor: '#000000cc', padding: 10 }
    ).setOrigin(0.5).setDepth(600);
    this.scene.time.delayedCall(2000, () => {
      if (this._lastMsg?.scene) { this._lastMsg.destroy(); this._lastMsg = null; }
    });
  }

  createScoreDisplay() {
    if (this.scoreBg?.scene)   this.scoreBg.destroy();
    if (this.scoreText?.scene) this.scoreText.destroy();
    this.scoreBg   = this.scene.add.rectangle(400, 18, 240, 30, 0x000000, 0.6).setDepth(300);
    this.scoreText = this.scene.add.text(400, 18, 'Vos: 0  |  Rival: 0',
      { font: '18px Arial', fill: '#ffffff' }
    ).setOrigin(0.5).setDepth(301);
  }

  hideAllButtons() {
    this.envidoButtons?.hide();
    this.trucoButtons?.hide();
  }

  getCardValue(valor, palo) {
    valor = String(valor); palo = String(palo);
    if (valor === '1' && palo === 'espada') return 14;
    if (valor === '1' && palo === 'basto')  return 13;
    if (valor === '7' && palo === 'espada') return 12;
    if (valor === '7' && palo === 'oro')    return 11;
    if (valor === '3') return 10;
    if (valor === '2') return 9;
    if (valor === '1') return 8;
    if (valor === '12') return 7;
    if (valor === '11') return 6;
    if (valor === '10') return 5;
    if (valor === '7') return 4;
    if (valor === '6') return 3;
    if (valor === '5') return 2;
    if (valor === '4') return 1;
    return 0;
  }

  get gameState() {
    return {
      scores:     { player: this.scores.teamA, opponent: this.scores.teamB },
      mano:       'player',
      scoreToWin: this.config.puntosParaGanar
    };
  }

  get opponentCards() { return [...this.cards.opponent1, ...this.cards.opponent2, ...this.cards.opponent3]; }
  get playerCards()   { return this.cards.player; }

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