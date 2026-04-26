// service-worker.js - Service Worker para funcionalidad offline

const CACHE_NAME = 'sso-cache-v2';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/empresas.json',
    '/manifest.json',
    '/assets/logos/sso.svg',
    '/assets/logos/constructora-norte.svg',
    '/assets/logos/metalurgica-delta.svg',
    '/assets/logos/logistica-sur.svg'
];

self.addEventListener('install', function(event) {
    console.log('Service Worker instalándose...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(function(cache) {
                console.log('Cache abierto');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('activate', function(event) {
    console.log('Service Worker activándose...');
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Eliminando cache antigua:', cacheName);
                        return caches.delete(cacheName);
                    }

                    return null;
                })
            );
        })
    );
});

self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                if (response) {
                    return response;
                }

                return fetch(event.request).then(function(networkResponse) {
                    if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                        return networkResponse;
                    }

                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(function(cache) {
                        cache.put(event.request, responseToCache);
                    });

                    return networkResponse;
                });
            })
            .catch(function() {
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }

                return new Response('', { status: 504, statusText: 'Offline' });
            })
    );
});

self.addEventListener('sync', function(event) {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncPendingData());
    }
});

function syncPendingData() {
    console.log('Sincronizando datos pendientes...');
}
