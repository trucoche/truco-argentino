import Phaser from 'phaser';

export default class TweenManager {
  constructor(scene) {
    this.scene = scene;
    this.activeTweens = new Set();
    this.tweenPool = [];
    this.maxPoolSize = 20;
  }

  create(config) {
    let tween;
    
    if (this.tweenPool.length > 0) {
      tween = this.tweenPool.pop();
      tween.reset(config.targets);
    } else {
      tween = this.scene.tweens.create(config.targets);
    }

    Object.assign(tween, config);
    
    const originalComplete = config.onComplete;
    tween.on('complete', () => {
      this.release(tween);
      if (originalComplete) originalComplete();
    });

    this.activeTweens.add(tween);
    return tween;
  }

  play(config) {
    const tween = this.create(config);
    tween.play();
    return tween;
  }

  release(tween) {
    if (!tween) return;
    
    tween.stop();
    this.activeTweens.delete(tween);
    
    if (this.tweenPool.length < this.maxPoolSize) {
      this.tweenPool.push(tween);
    } else {
      tween.destroy();
    }
  }

  clearAll() {
    this.activeTweens.forEach(tween => {
      tween.stop();
      tween.destroy();
    });
    this.activeTweens.clear();
    this.tweenPool = [];
  }

  stagger(config) {
    const startTime = this.scene.time.now;
    const { targets, staggerDelay = 100, ...tweenConfig } = config;
    
    if (!Array.isArray(targets)) {
      return this.play({ targets, ...tweenConfig });
    }

    return targets.map((target, i) => {
      return this.scene.time.delayedCall(startTime + (i * staggerDelay), () => {
        this.play({ targets: target, ...tweenConfig });
      });
    });
  }
}