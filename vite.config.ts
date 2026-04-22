import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

// `base` must match the repo name so GitHub Pages serves assets from
// https://<user>.github.io/slinky-robot/ correctly.
export default defineConfig({
  plugins: [react()],
  base: '/slinky-robot/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          elkjs: ['elkjs/lib/elk.bundled.js'],
          xyflow: ['@xyflow/react'],
        },
      },
    },
  },
});
