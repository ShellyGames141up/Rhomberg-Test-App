const CACHE_NAME = 'rhomberg-app-preview-v7';

const APP_FILES = [
  './',
  './index.html',
  './styles.css?v=7',
  './app.js?v=7',
  './manifest.webmanifest',
  './assets/images/rhomberg-gauge-mark.svg',
  './assets/images/rhomberg-wordmark-transparent.png',
  './assets/images/process-gauge.png',
  './assets/images/utility-gauge.png',
  './assets/images/diaphragm-gauge.png',
  './assets/images/temperature.png',
  './assets/images/transmitters.png',
  './assets/images/switches.png',
  './assets/images/temperature-sensors.png',
  './assets/images/gas-analysis.png',
  './assets/images/calibration.png',
  './assets/datasheets/PBB-product-sheet.pdf',
  './assets/datasheets/Utility-gauge-overview.pdf',
  './assets/datasheets/Pressure-gauge-ordering-guide.pdf',
  './assets/datasheets/Temperature-ordering-guide.pdf',
  './assets/datasheets/RPT106-product-sheet.pdf'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }))
  );
});
