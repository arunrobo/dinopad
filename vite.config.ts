import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string };

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' mode: we control when to apply updates.
      // The hook fires needRefresh=true when a new SW is waiting; we then
      // call updateServiceWorker(true) to reload with the fresh assets.
      registerType: 'prompt',
      injectRegister: 'auto',
      // Let the existing public/manifest.json be served as-is
      manifest: false,
      workbox: {
        // Precache every JS, CSS, HTML, font and image produced by Vite
        // Fonts are self-hosted via @fontsource — no CDN runtime caching needed
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
      },
    }),
  ],
  define: {
    // Injected at build time from package.json – no manual version tracking needed
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      output: {
        // Place font files in their own subfolder for clarity
        assetFileNames: (info) =>
          /\.(woff2?|ttf|otf|eot)$/i.test(info.names?.[0] ?? '')
            ? 'assets/fonts/[name]-[hash][extname]'
            : 'assets/[name]-[hash][extname]',
      },
    },
  },
  base: './',
});
