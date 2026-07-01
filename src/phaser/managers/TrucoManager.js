export default class TrucoManager {
    constructor(gameManager) {
        this.gameManager = gameManager;
        this.currentLevel = 0;
        this.challengeSequence = ['truco', 'retruco', 'vale-cuatro'];
        this.resetChallenge();
    }

    resetChallenge() {
        this.currentChallenge = {
            type: null,
            caller: null,
            responder: null,
            points: 0,
            resolved: true,
            accepted: false,
            timestamp: Date.now()
        };
    }

    getCurrentChallenge() {
        if (!this.currentChallenge) {
            this.resetChallenge();
        }
        return this.currentChallenge;
    }

    callTruco(type, caller) {
        const challenge = this.getCurrentChallenge();

        const validTypes = ['truco', 'retruco', 'vale-cuatro'];
        if (!validTypes.includes(type)) {
            console.error('Tipo de truco inválido:', type);
            return false;
        }

        challenge.type = type;
        challenge.caller = caller;
        challenge.resolved = false;
        challenge.points = type === 'truco' ? 2 : type === 'retruco' ? 3 : 4;

        this.gameManager.showMessage(`¡${type.toUpperCase()}!`);
        console.log(`Truco llamado: ${type} por ${caller}`);

        if (caller === 'player') {
            this.gameManager.scene.time.delayedCall(1500, () => {
                this.handleOpponentResponse();
            });
        }

        return true;
    }

    handleOpponentResponse() {
        const opponentCards = this.gameManager.opponentCards;
        const acceptProbability = this.calculateAcceptProbability(opponentCards);

        this.gameManager.scene.time.delayedCall(1500, () => {
            const response = Math.random() < acceptProbability ? 'accept' : 'reject';
            this.gameManager.showMessage(
                `El oponente ${response === 'accept' ? 'quiere' : 'no quiere'} el truco`
            );
            this.respondToTruco(response);
        });
    }

calculateAcceptProbability(cards) {
    if (!cards || !Array.isArray(cards)) return 0.5;

    const strongCards = cards.filter(card => {
        if (!card || !card.scene) return false;
        const data = card.getData('cardData');
        if (!data) return false;
        return ['1', '2', '3', '7'].includes(String(data.valor));
    }).length;

    const difficulty = this.gameManager.difficulty || 'normal';
    const modifier = difficulty === 'facil' ? -0.15 : difficulty === 'dificil' ? 0.15 : 0;

    let base;
    if (strongCards >= 2) base = 0.8;
    else if (strongCards === 1) base = 0.5;
    else base = 0.3;

    return Math.min(0.95, Math.max(0.05, base + modifier));
}

    respondToTruco(response) {
        if (response === 'accept') {
            this.currentChallenge.resolved = true;
            this.gameManager.continueAfterTruco();
        } else {
            const winner = this.currentChallenge.caller;
            const points = this.currentChallenge.points;
            this.gameManager.addScore(winner || 'player', points);
            this.reset();
            this.startNewRound();
        }
    }

    resolveTruco(roundWinner) {
        if (!this.currentChallenge) return;
        this.gameManager.addScore(roundWinner, this.currentChallenge.points);
        this.reset();
    }

    reset() {
        this.currentChallenge = null;
        this.currentLevel = 0;
    }

    startNewRound() {
        this.reset();
        this.gameManager.startGame();
    }

    isValidChallenge(type) {
        const currentIndex = this.challengeSequence.indexOf(type);
        const lastIndex = this.currentChallenge ?
            this.challengeSequence.indexOf(this.currentChallenge.type) : -1;
        return currentIndex > lastIndex;
    }

    hasGoodCards(cards) {
        const strongCards = cards.filter(card =>
            ['1', '2', '3', '7'].includes(card.getData('cardData').valor)
        ).length;
        return strongCards >= 2;
    }
}