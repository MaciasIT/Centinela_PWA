/**
 * Centinela — Service Worker
 * Caché offline y actualizaciones
 */

const CACHE_NAME = 'centinela-v2.0.0';
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/app.js',
    '/js/api.js',
    '/js/scanner.js',
    '/js/history.js',
    '/js/tips.js',
    '/js/share.js',
    '/manifest.json',
];

const EXTERNAL_ASSETS = [
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
    'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js',
];

// Instalación: cachear assets estáticos
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Cachear assets locales
            await cache.addAll(STATIC_ASSETS);

            // Intentar cachear assets externos (no bloquear si falla)
            for (const url of EXTERNAL_ASSETS) {
                try {
                    await cache.add(url);
                } catch (e) {
                    console.warn('No se pudo cachear:', url, e);
                }
            }
        })
    );
    self.skipWaiting();
});

// Activación: limpiar cachés antiguas
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch: Network first para API, Cache first para assets
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // No interceptar peticiones a la API
    if (url.hostname.includes('workers.dev') || url.hostname.includes('virustotal')) {
        return;
    }

    // Para navegación (HTML), intentar red primero
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Actualizar caché con la versión nueva
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(() => {
                    return caches.match(request) || caches.match('/index.html');
                })
        );
        return;
    }

    // Para assets estáticos: Cache first, fallback a red
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                // Actualizar en background (stale-while-revalidate)
                fetch(request)
                    .then((response) => {
                        if (response.ok) {
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
                        }
                    })
                    .catch(() => {});
                return cached;
            }

            return fetch(request).then((response) => {
                if (response.ok && request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                }
                return response;
            });
        })
    );
});
