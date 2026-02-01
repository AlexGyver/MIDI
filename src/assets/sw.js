const CACHE_NAME = 'cache_@cachename';

const CACHED_URLS = [
    '/',
    '/favicon.svg',
    '/index.html',
    '/script.js',
    '/style.css',
];

// Установка: добавление файлов в кеш
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(CACHED_URLS))
    );
});

// Активация: удаление старых кешей
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames =>
            Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            )
        )
    );
});

// Обработка запросов
self.addEventListener('fetch', event => {
    const { request } = event;

    // Пропускаем кросс-доменные и специальные запросы
    if (!request.url.startsWith(self.location.origin)) return;
    if (request.cache === 'only-if-cached' && request.mode !== 'same-origin') return;

    event.respondWith(handleFetch(request));
    event.waitUntil(updateCache(request));
});

// отдаём ресурс из кеша или из сети
async function handleFetch(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    if (cachedResponse) return cachedResponse;

    try {
        const networkResponse = await fetch(request);
        return networkResponse;
    } catch (error) {
        // return caches.match('/offline.html');
        return new Response('Offline and resource not cached', {
            status: 503,
            statusText: 'Service Unavailable',
        });
    }
}

// обновляем кеш в фоновом режиме
async function updateCache(request) {
    if (request.method !== 'GET') return;
    try {
        const response = await fetch(request);
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
    } catch (e) { }
}