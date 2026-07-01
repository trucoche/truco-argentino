import Phaser from 'phaser';

export default class DepthManager {
  constructor(scene) {
    this.scene = scene;
    this.baseDepth = 10;
    this.currentDepth = this.baseDepth;
    this.layerIncrement = 1;
    this.maxDepth = 10000;
    this.registeredObjects = new Set();
  }

  getNextDepth() {
    this.currentDepth += this.layerIncrement;
    
    if (this.currentDepth >= this.maxDepth) {
      this.resetDepths();
    }
    
    return this.currentDepth;
  }

  resetDepths() {
    console.log('Reseteando profundidades...');
    let newDepth = this.baseDepth;
    this.registeredObjects.forEach(obj => {
      if (obj.active) {
        obj.setDepth(newDepth);
        newDepth += this.layerIncrement;
      }
    });
    this.currentDepth = newDepth;
  }

  assignDepth(gameObject) {
    const depth = this.getNextDepth();
    gameObject.setDepth(depth);
    this.registeredObjects.add(gameObject);
    return depth;
  }

  bringToTop(gameObject) {
    const depth = this.getNextDepth();
    gameObject.setDepth(depth);
    return depth;
  }

  destroy() {
    this.registeredObjects.clear();
  }
}