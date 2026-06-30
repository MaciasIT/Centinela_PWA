import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf-8'));

export default defineConfig({
  plugins: [
    VitePWA({
      strategies: 'injectManifest',
      srcDir: '.',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectRegister: null, // No inyectar registro automático, se maneja en js/app.js
      manifest: manifest,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,webmanifest}'],
        // Evitar que el build del propio sw.js se meta en su caché
        globIgnores: ['sw.js', 'workbox-*.js'],
      },
      devOptions: {
        enabled: true,
        type: 'module',
      }
    })
  ]
});
