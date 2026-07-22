import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),        // landing page
        viewer: resolve(__dirname, 'viewer.html'),       // AR viewer
        builder: resolve(__dirname, 'builder.html'),     // authoring editor
      },
    },
  },
  server: { host: true },
});
