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
    // Emit a single CSS file and a single JS chunk so the post-build
    // `scripts/inline.mjs` step can fold everything into one
    // self-contained dist/index.html. That inlined HTML doubles as the
    // template the in-app "Publish HTML" feature embeds process data into.
    // `inlineDynamicImports` is mutually exclusive with `manualChunks`, so
    // the old elkjs/xyflow split is deliberately gone — we trade cross-chunk
    // caching for a single self-serving file.
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
