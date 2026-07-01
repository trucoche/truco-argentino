import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import gameConfig from '../phaser/config/gameConfig';

export default function GameContainer() {
  const gameInstance = useRef(null);

  useEffect(() => {
    if (!gameInstance.current) {
      gameInstance.current = new Phaser.Game({
        ...gameConfig,
        parent: 'game-container'
      });
    }

    return () => {
      if (gameInstance.current) {
        gameInstance.current.destroy(true);
        gameInstance.current = null;
      }
    };
  }, []);

  return <div id="game-container" style={{ width: '100%', height: '100vh' }} />;
}