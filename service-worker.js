// service-worker.js - Service Worker para funcionalidad offline

const CACHE_NAME = 'sso-cache-v1';
const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json'
];

// Instalación del Service Worker
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

// Activación del Service Worker
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
                })
            );
        })
    );
});

// Interceptar solicitudes de red
self.addEventListener('fetch', function(event) {
    event.respondWith(
        caches.match(event.request)
            .then(function(response) {
                // Retornar respuesta del cache si existe
                if (response) {
                    return response;
                }

                // Si no está en cache, hacer la solicitud de red
                return fetch(event.request).then(
                    function(response) {
                        // Verificar si la respuesta es válida
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        // Clonar la respuesta
                        var responseToCache = response.clone();

                        // Almacenar en cache para futuras solicitudes
                        caches.open(CACHE_NAME)
                            .then(function(cache) {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
            })
            .catch(function() {
                // Si falla la red y no hay cache, mostrar página offline
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
            })
    );
});

// Sincronización en segundo plano (si es soportado)
self.addEventListener('sync', function(event) {
    if (event.tag === 'sync-data') {
        event.waitUntil(syncPendingData());
    }
});

// Función para sincronizar datos pendientes
function syncPendingData() {
    console.log('Sincronizando datos pendientes...');
    // Aquí iría la lógica para enviar datos almacenados localmente al servidor
    // Por ejemplo, obtener datos de IndexedDB y enviarlos vía fetch
}