const CACHE_NAME = 'rhomberg-app-preview-v9';

const APP_FILES = [
  './',
  './index.html',
  './styles.css?v=9',
  './runtime-config.js?v=9',
  './app.js?v=9',
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
  const requestUrl = new URL(event.request.url);
  if (event.request.method !== 'GET' || requestUrl.origin !== self.location.origin) return;

  // Authenticated API responses must never enter the public application cache.
  if (requestUrl.pathname.includes('/api/')) return;

  // Runtime mode and API URL must update immediately during a controlled deployment.
  if (requestUrl.pathname.endsWith('/runtime-config.js')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request)));
    return;
  }

  const acceptsHtml = event.request.headers.get('accept')?.includes('text/html');
  if (event.request.mode === 'navigate' && acceptsHtml) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.ok && response.headers.get('content-type')?.includes('text/html')) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  const isPublicAsset = requestUrl.pathname.includes('/assets/');
  const cacheableDestination = ['script', 'style', 'image', 'font', 'manifest'].includes(event.request.destination);
  if (!isPublicAsset && !cacheableDestination) return;

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      return response;
    }))
  );
});
