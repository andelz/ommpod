/**
 * POD service worker.
 * - Caches app shell (JS/CSS/HTML) for offline use
 * - Downloads and caches audio episodes on demand
 * - Intercepts all fetches: serves from cache when offline
 */

const APP_CACHE = 'pod-app-v1';
const AUDIO_CACHE = 'pod-audio-v1';
const IMAGE_CACHE = 'pod-images-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then(cache => cache.addAll(['/', '/index.html', '/manifest.webmanifest']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// --- Fetch interception ---
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isLocal = req.url.startsWith(self.location.origin);

  const isImage = /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(req.url) ||
    req.destination === 'image';

  event.respondWith(
    isLocal ? serveAppShell(req) : isImage ? serveImage(req) : serveAudio(req)
  );
});

async function serveAppShell(req) {
  const cache = await caches.open(APP_CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const fresh = await fetch(req);
    if (fresh.ok) cache.put(req, fresh.clone());
    return fresh;
  } catch {
    if (req.mode === 'navigate') return cache.match('/index.html') ?? Response.error();
    return Response.error();
  }
}

async function serveImage(req) {
  const cache = await caches.open(IMAGE_CACHE);
  const cached = await cache.match(req.url);
  if (cached) return cached;
  try {
    const fresh = await fetch(req, { mode: 'no-cors' });
    if (fresh.type === 'opaque' || fresh.ok) cache.put(req.url, fresh.clone());
    return fresh;
  } catch {
    return Response.error();
  }
}

async function serveAudio(req) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(req.url);
  if (cached) return cached;
  return fetch(req);
}

// --- Message handling ---
self.addEventListener('message', (event) => {
  const { type } = event.data ?? {};
  const port = event.ports[0] ?? null;

  if (type === 'DOWNLOAD') {
    event.waitUntil(handleDownload(event.data, port));
  } else if (type === 'DELETE') {
    event.waitUntil(handleDelete(event.data.url, port));
  } else if (type === 'LIST_CACHED') {
    event.waitUntil(handleList(port));
  }
});

async function handleDownload(data, port) {
  const { id, url } = data;
  try {
    let response = null;
    let opaque = false;

    // Try CORS — gives us a readable body for progress tracking
    try {
      response = await fetch(url, { mode: 'cors', cache: 'no-store' });
      if (!response.ok) response = null;
    } catch {
      response = null;
    }

    if (!response) {
      // no-cors: opaque response — body unreadable, but the browser can cache and
      // serve it to <audio> elements just fine
      response = await fetch(url, { mode: 'no-cors', cache: 'no-store' });
      opaque = true;
    }

    if (opaque) {
      const cache = await caches.open(AUDIO_CACHE);
      await cache.put(url, response);
      port?.postMessage({ type: 'progress', id, pct: 100 });
      port?.postMessage({ type: 'done', id });
      return;
    }

    // Stream with progress
    const contentLength = Number(response.headers.get('content-length') ?? '0');
    const reader = response.body.getReader();
    const chunks = [];
    let received = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      if (contentLength > 0 && port) {
        port.postMessage({ type: 'progress', id, pct: Math.round((received / contentLength) * 99) });
      }
    }

    const blob = new Blob(chunks);
    const stored = new Response(blob, {
      status: 200,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg' },
    });
    const cache = await caches.open(AUDIO_CACHE);
    await cache.put(url, stored);

    port?.postMessage({ type: 'progress', id, pct: 100 });
    port?.postMessage({ type: 'done', id });
  } catch (err) {
    port?.postMessage({ type: 'error', id, message: String(err) });
  }
}

async function handleDelete(url, port) {
  const cache = await caches.open(AUDIO_CACHE);
  await cache.delete(url);
  port?.postMessage({ type: 'deleted' });
}

async function handleList(port) {
  const cache = await caches.open(AUDIO_CACHE);
  const keys = await cache.keys();
  port?.postMessage({ type: 'cached_list', urls: keys.map(r => r.url) });
}
