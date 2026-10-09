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

// Interceptar compartir objetivo (Web Share Target POST, HU-12)
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    if (request.method === 'POST' && url.pathname === '/share-target') {
        event.respondWith(
            (async () => {
                let title = '';
                let text = '';
                let sharedUrl = '';
                try {
                    const formData = await request.formData();
                    title = formData.get('title') || '';
                    text = formData.get('text') || '';
                    sharedUrl = formData.get('url') || '';
                } catch {
                    // Si el cuerpo no se puede leer, se sigue a la portada sin datos.
                }

                // Redirigir (absoluto) a la home con los parámetros a procesar.
                const redirectUrl = new URL('/share-target', self.location.origin);
                redirectUrl.searchParams.set('title', title);
                redirectUrl.searchParams.set('text', text);
                redirectUrl.searchParams.set('url', sharedUrl);
                // La app lee los parámetros y limpia la URL (consumeSharedTarget).
                const target = new URL('/', self.location.origin);
                target.search = redirectUrl.search;
                return Response.redirect(target.href, 303);
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
