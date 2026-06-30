import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Precaché automático de archivos compilados por Vite
precacheAndRoute(self.__WB_MANIFEST || []);

// Limpieza de cachés antiguas creadas por versiones anteriores de Workbox
cleanupOutdatedCaches();

// Forzar activación inmediata del nuevo Service Worker
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

// Interceptar compartir objetivo (Web Share Target POST)
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/share-target') {
        event.respondWith(
            (async () => {
                const formData = await request.formData();
                const title = formData.get('title') || '';
                const text = formData.get('text') || '';
                const sharedUrl = formData.get('url') || '';
                
                // Redirigir a la home con parámetros para procesamiento
                const redirectUrl = `/?title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}&url=${encodeURIComponent(sharedUrl)}`;
                return Response.redirect(redirectUrl, 303);
            })()
        );
    }
});

// Estrategia de caché para fuentes de Google (CSS y archivos woff2)
registerRoute(
    ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
    new CacheFirst({
        cacheName: 'google-fonts-cache',
        plugins: [
            new ExpirationPlugin({
                maxEntries: 10,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
            }),
        ],
    })
);
