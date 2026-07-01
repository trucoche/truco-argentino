import { GAME_STATES } from '../utils/constants';

export default class StateManager {
  constructor(scene) {
    this.scene = scene;
    this.currentState = GAME_STATES.INITIAL;
  }

  changeState(newState) {
    const validTransitions = {
      [GAME_STATES.INITIAL]: [GAME_STATES.DEALING],
      [GAME_STATES.DEALING]: [GAME_STATES.PLAYING, GAME_STATES.ENVIDO],
      [GAME_STATES.PLAYING]: [GAME_STATES.TRUCO, GAME_STATES.ENVIDO, GAME_STATES.ROUND_END],
      [GAME_STATES.TRUCO]: [GAME_STATES.PLAYING, GAME_STATES.ROUND_END],
      [GAME_STATES.ENVIDO]: [GAME_STATES.PLAYING, GAME_STATES.ROUND_END],
      [GAME_STATES.ROUND_END]: [GAME_STATES.DEALING, GAME_STATES.GAME_END]
    };

    if (validTransitions[this.currentState].includes(newState)) {
      console.log(`State change: ${this.currentState} -> ${newState}`);
      this.executeStateExitActions(this.currentState);
      this.currentState = newState;
      this.executeStateEntryActions(newState);
    } else {
      console.warn(`Invalid state transition: ${this.currentState} -> ${newState}`);
    }
  }

  executeStateEntryActions(state) {
    switch(state) {
      case GAME_STATES.DEALING:
        this.scene.cardManager.dealCards();
        this.changeState(GAME_STATES.PLAYING);
        break;
      case GAME_STATES.PLAYING:
        this.scene.enablePlayerInteraction();
        break;
      // ... otros casos
    }
  }

  executeStateExitActions(state) {
    // Limpieza al salir de estados
  }
}