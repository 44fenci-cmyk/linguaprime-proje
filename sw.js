/* Kılavuz 2: Gelişmiş Service Worker Stratejisi */
const CACHE_NAME = 'linguaprime-v3.2-coach';
const STATIC_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './ai-bridge.js',
  './manifest.json',
  './ai-service.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/simple-crypto-js@3.0.1/dist/SimpleCrypto.min.js'
];

// Dinamik içerikler için ayrı cache
const API_CACHE_NAME = 'linguaprime-api-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  
  // Groq API istekleri - sadece network
  if (url.hostname === 'api.groq.com') {
    e.respondWith(fetch(e.request));
    return;
  }
  
  // Statik assetler için cache first
  const isStaticAsset = STATIC_ASSETS.some(asset => {
    const path = asset.replace('./', '');
    return path !== '' && e.request.url.endsWith(path);
  }) || e.request.url.includes('.css') || e.request.url.includes('.js');

  if (isStaticAsset) {
    e.respondWith(
      caches.match(e.request).then(response => response || fetch(e.request))
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then(response => {
        const resClone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
        return response;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME && key !== API_CACHE_NAME)
          .map(key => caches.delete(key))
    ))
  );
  self.clients.claim();
});
