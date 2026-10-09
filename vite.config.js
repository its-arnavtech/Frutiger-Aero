import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/phaser/')) return 'phaser';
          if (id.includes('node_modules/three/')) return 'three';
          if (id.includes('node_modules/@babylonjs/')) return 'babylon-math';
        },
      },
    },
  },
});
