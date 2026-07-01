export default class IAManager {
  constructor(scene) {
    this.scene = scene;
  }

  decidirJugada() {
    const estado = this.scene.estados.estadoActual;

    switch(estado) {
      case 'jugando':
        return this.jugarCarta();
      case 'truco':
        return this.decidirTruco();
      case 'envido':
        return this.decidirEnvido();
      default:
        return this.esperar();
    }
  }

  jugarCarta() {
    if (this.scene.cartasEnMesa.jugador.length > 0) {
      return this.responderAJugada();
    } else {
      return this.jugarCartaInicial();
    }
  }

  responderAJugada() {
    // Lógica para responder a una jugada del jugador humano
  }

  jugarCartaInicial() {
    // Lógica para jugar primera carta en la ronda
  }

  decidirTruco() {
    // Lógica para decidir si acepta/quiere/retruca
  }
}