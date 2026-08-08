const CACHE_NAME = 'lamundo-github-cms-v1';
const ASSETS = [
    './',
    './index.html',
    './admin.html',
    './data.json'
];

self.addEventListener('install', (e) => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (e) => {
    // Always go network-first so data.json and JS updates propagate immediately
    e.respondWith(
        fetch(e.request).catch(() => {
            return caches.match(e.request).then(response => {
                if (response) return response;
                if (e.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
