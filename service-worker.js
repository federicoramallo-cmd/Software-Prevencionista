// service-worker.js - Service Worker para funcionalidad offline

const CACHE_NAME = 'sso-cache-v6';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/empresas.json',
    '/planificacion-inicial.json',
    '/accidentes-inicial.json',
    '/manifest.json',
    '/assets/logos/frc-logo.png',
    '/assets/logos/sso.svg',
    '/assets/logos/Logo Aplomo.jpeg',
    '/assets/logos/Logo ESON.jpeg',
    '/assets/logos/Logo MovilUno.jpg',
    '/assets/logos/Logo Rabufer.jpg',
    '/Gestión Gral de SYSO 2026 (Actividades, accidentes, etc.).xlsx',
    '/RE 002 Registro de inspección de seguridad.doc'
];

self.addEventListener('install', function(event) {
    console.log('Service Worker instalándose...');
    self.skipWaiting();
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
        caches.keys()
            .then(function(cacheNames) {
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
            .then(function() {
                return self.clients.claim();
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
