// assets/service-worker.js - PWA Service Worker with improved cache handling

const CACHE_NAME = 'demandsense-cache-v2'; // Increment version for updates
const STATIC_ASSETS = [
  '/',
  '/login.html',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/favicon.ico',
  '/favicon/favicon-16x16.png',
  '/favicon/favicon-32x32.png',
  '/favicon/apple-touch-icon.png',
  '/icons/icon-72.png',
  '/icons/icon-96.png',
  '/icons/icon-128.png',
  '/icons/icon-144.png',
  '/icons/icon-152.png',
  '/icons/icon-192.png',
  '/icons/icon-384.png',
  '/icons/icon-512.png',
  '/src/cache-buster.js',
  '/src/app.js',
  '/src/api.js',
  '/src/forecast-chart.js',
  '/src/inventory-dashboard.js',
  '/src/what-if-panel.js',
  '/src/data-validator.js',
  '/src/pdf-export.js'
];

// External assets (these might change, so cache with care)
const EXTERNAL_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  console.log('🔧 Service Worker v2 installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Caching static assets...');
        // Use addAll but handle failures gracefully
        return Promise.allSettled(
          STATIC_ASSETS.map(asset => 
            cache.add(asset).catch(err => 
              console.warn('⚠️ Failed to cache:', asset, err.message)
            )
          )
        );
      })
      .then(() => {
        console.log('✅ Service Worker installed');
        return self.skipWaiting();
      })
      .catch(err => console.error('❌ Cache error:', err))
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('⚡ Service Worker activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker activated');
      // Immediately claim all clients
      return self.clients.claim();
    })
  );
});

// Fetch event - Network first for HTML, cache first for assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Skip API calls
  if (url.pathname.startsWith('/api/')) {
    return;
  }
  
  // Skip chrome-extension requests
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // For HTML pages - network first, then cache
  if (event.request.mode === 'navigate' || 
      (event.request.headers.get('accept') && 
       event.request.headers.get('accept').includes('text/html'))) {
    
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh HTML (but with no-cache headers)
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cached version if offline
          return caches.match(event.request).then(cached => {
            if (cached) {
              return cached;
            }
            // If no cached HTML, try to serve index.html
            return caches.match('/index.html');
          });
        })
    );
    return;
  }

  // For static assets - cache first, then network (stale-while-revalidate)
  if (url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          // Return cached version and update cache in background
          const fetchPromise = fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, networkResponse);
                });
              }
              return networkResponse;
            })
            .catch(() => {});
          
          return cachedResponse || fetchPromise;
        })
    );
    return;
  }

  // For everything else - network only
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        // If offline and it's a request we might have cached
        return caches.match(event.request).then(cached => {
          return cached || new Response('Offline', { status: 503 });
        });
      })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'forecast-sync') {
    event.waitUntil(syncForecasts());
  }
});

// Push notifications
self.addEventListener('push', event => {
  const options = {
    body: event.data.text(),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      { action: 'view', title: 'View Forecast' },
      { action: 'close', title: 'Close' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('DemandSense AI', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handler for version checks
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

// Helper: Sync forecasts when back online
async function syncForecasts() {
  try {
    const cache = await caches.open('forecast-queue');
    const requests = await cache.keys();
    
    for (const request of requests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.delete(request);
        }
      } catch (error) {
        console.error('Sync failed for:', request.url, error);
      }
    }
  } catch (error) {
    console.error('Sync error:', error);
  }
}