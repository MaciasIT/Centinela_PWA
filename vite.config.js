import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';

const manifest = JSON.parse(fs.readFileSync('./manifest.json', 'utf-8'));
// Única fuente de versión de la app (HU-23): se propaga a la UI y al worker.
const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'));

// Sustituye __APP_VERSION__ en el HTML (index.html, manual.html) por la
// versión de package.json, de modo que no exista un literal duplicado.
const appVersionPlugin = {
  name: 'centinela-app-version',
  enforce: 'pre',
  transformIndexHtml(html) {
    return html.replaceAll('__APP_VERSION__', pkg.version);
  },
};

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        manual: 'manual.html',
      },
    },
  },
  plugins: [
    appVersionPlugin,
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
