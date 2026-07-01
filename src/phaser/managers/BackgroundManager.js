import Phaser from 'phaser';

export default class BackgroundManager {
    constructor(scene) {
        this.scene = scene;
        this.background = null;
    }

    create() {
        try {
            // Verifica que la textura existe antes de crearla
            if (!this.scene.textures.exists('mesa')) {
                console.error('Texture "mesa" not found');
                return null;
            }
            
            this.background = this.scene.add.image(400, 300, 'mesa')
                .setDisplaySize(800, 600)
                .setDepth(0);
                
            return this.background;
        } catch (error) {
            console.error('Error creating background:', error);
            return null;
        }
    }
}