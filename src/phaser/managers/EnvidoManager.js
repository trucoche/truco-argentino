import { envidoValues } from '../utils/envidoValues';
import Phaser from 'phaser';

export default class EnvidoManager {
  constructor(gameManager) {
    this.gameManager = gameManager;
    this.currentChallenge = null;
    this.possibleChallenges = ['envido', 'real-envido', 'falta-envido'];
    this.resetChallenge();
  }

  resetChallenge() {
    this.currentChallenge = {
      type: null,          // Tipo de desafío (envido/real/falta)
      caller: null,        // 'player' o 'opponent'
      responder: null,     // 'player' o 'opponent'
      points: 0,           // Puntos en juego
      resolved: false,     // Si se resolvió el desafío
      accepted: false,     // Si fue aceptado
      stage: 'offer',      // offer/response/compare
      playerScore: null,   // Puntos declarados por jugador
      opponentScore: null  // Puntos declarados por oponente
    };
  }

calculateEnvidoPoints(cards) {
    const validCards = cards
        .filter(card => card && !card.getData('played'))
        .map(card => card.getData('cardData'))
        .filter(data => data);

    const suits = {};
    validCards.forEach(card => {
        const val = ['10','11','12'].includes(String(card.valor)) ? 0 : parseInt(card.valor);
        suits[card.palo] = suits[card.palo] || [];
        suits[card.palo].push(val);
    });

    let maxEnvido = 0;
    Object.values(suits).forEach(values => {
        if (values.length >= 2) {
            values.sort((a, b) => b - a);
            maxEnvido = Math.max(maxEnvido, values[0] + values[1] + 20);
        } else {
            maxEnvido = Math.max(maxEnvido, values[0]);
        }
    });

    return maxEnvido;
}

getCardValue(value) {
  // Cartas 10, 11, 12 valen 0
  return ['10', '11', '12'].includes(value) ? 0 : parseInt(value);
}

callEnvido(playerType, type) {
  if (!this.possibleChallenges.includes(type)) {
    console.error('Tipo de envido inválido:', type);
    return false;
  }

  this.currentChallenge = {
    type,
    caller: playerType,
    responder: null,
    points: this.calculateChallengePoints(type),
    resolved: false,
    accepted: false,
    stage: 'offer'
  };

  this.gameManager.showMessage(`¡${this.getChallengeName(type)} cantado!`);
  return true;
}

getChallengeName(type) {
  const names = {
    'envido': 'Envido',
    'real-envido': 'Real Envido',
    'falta-envido': 'Falta Envido'
  };
  return names[type] || type;
}

calculateChallengePoints(type) {
    const scores = this.gameManager.scores || { player: 0, opponent: 0 };
    const leaderScore = Math.max(scores.player, scores.opponent);
    
    const points = {
        'envido':       2,
        'real-envido':  3,
        'falta-envido': this.gameManager.config.puntosParaGanar - leaderScore
    };
    
    return points[type] || 0;
}

respondToEnvido(playerType, response) {
  if (!['accept', 'reject', 'raise'].includes(response)) {
    console.error('Respuesta inválida:', response);
    return false;
  }

  const challenge = this.currentChallenge;
  challenge.responder = playerType;

  switch (response) {
    case 'accept':
      challenge.accepted = true;
      challenge.stage = 'compare';
      this.gameManager.showMessage(`${playerType === 'player' ? 'Jugador' : 'Oponente'} quiere el envido`);
      break;
      
    case 'reject':
      challenge.accepted = false;
      challenge.resolved = true;
      this.gameManager.showMessage(`${playerType === 'player' ? 'Jugador' : 'Oponente'} no quiere`);
      this.resolveRejectedChallenge();
      break;
      
    case 'raise':
      challenge.stage = 'counteroffer';
      this.gameManager.showMessage(`${playerType === 'player' ? 'Jugador' : 'Oponente'} sube la apuesta`);
      break;
  }

  return true;
}

resolveChallenge() {
    const challenge = this.currentChallenge;
    if (!challenge.accepted) return;

    const playerPoints   = this.calculateEnvidoPoints(this.gameManager.playerCards);
    const opponentPoints = this.calculateEnvidoPoints(this.gameManager.opponentCards);

    let winner;
    if (playerPoints > opponentPoints) {
        winner = 'player';
    } else if (opponentPoints > playerPoints) {
        winner = 'opponent';
    } else {
        winner = 'player'; // empate: gana el mano (simplificado)
    }

    this.gameManager.addScore(winner, challenge.points);
    
    const winnerName = winner === 'player' ? 'Vos' : 'IA';
    this.gameManager.showMessage(
        `¡${winnerName} gana el ${this.getChallengeName(challenge.type)} con ${Math.max(playerPoints, opponentPoints)} puntos!`
    );

    challenge.resolved = true;
}

resolveRejectedChallenge() {
  const challenge = this.currentChallenge;
  this.gameManager.addScore(challenge.caller, 1);
  this.gameManager.showMessage(
    `+1 punto para ${challenge.caller === 'player' ? 'Jugador' : 'Oponente'} por no querer`
  );
}

resolvePendingChallenge() {
    if (!this.currentChallenge || this.currentChallenge.resolved) return;
    // Si hay un desafío pendiente sin resolver, el que no cantó pierde
    if (this.currentChallenge.caller) {
        this.gameManager.addScore(this.currentChallenge.caller, 1);
    }
    this.resetChallenge();
}

}