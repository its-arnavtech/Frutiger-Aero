import { defineConfig } from 'vite';

export default defineConfig({
  // Local source modules change independently during scenery development.
  // Do not let a disconnected hot-reload client reuse an older module graph.
  // Production retains Vite's hashed bundles and normal asset caching.
  server: {
    headers: { 'Cache-Control': 'no-store' },
  },
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
