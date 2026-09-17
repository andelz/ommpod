/**
 * POD service worker.
 *
 * Angular's generated `ngsw-worker.js` is imported at the bottom of this file
 * and owns the app shell. A client is controlled by exactly one worker, so ngsw
 * and a second custom worker cannot both be registered at scope `/` — the later
 * registration replaces the earlier one. This wrapper is therefore what
 * `provideServiceWorker()` points at, and it keeps only the three jobs ngsw has
 * no answer for:
 *
 *   - downloading an episode on demand, streamed into the cache with progress
 *   - serving those cached bytes back to <audio>
 *   - caching artwork, which ngsw declines because the responses are opaque
 *
 * The fetch listener is registered BEFORE the import so that it runs first, and
 * it calls stopImmediatePropagation() on the events it claims: ngsw must never
 * see them, because a second respondWith() on one event throws.
 */

const AUDIO_CACHE = 'pod-audio-v1';
const IMAGE_CACHE = 'pod-images-v1';

/** The shell cache this worker kept before ngsw took the job over. */
const LEGACY_APP_CACHE = 'pod-app-v1';

const AUDIO_EXT = /\.(mp3|m4a|m4b|aac|ogg|oga|opus|wav|flac)(\?|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;

/**
 * Cross-origin media is ours; everything else belongs to ngsw. `destination` is
 * the honest signal, with the extension test as a fallback for the browsers
 * that leave it empty on media preloads.
 */
function claim(req) {
  if (req.method !== 'GET') return null;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) return null;

  const dest = req.destination;
  if (dest === 'audio' || dest === 'video' || AUDIO_EXT.test(url.pathname)) return serveAudio;
  if (dest === 'image' || IMAGE_EXT.test(url.pathname)) return serveImage;
  return null;
}

self.addEventListener('fetch', (event) => {
  const handler = claim(event.request);
  if (!handler) return; // ngsw's listener picks it up
  event.stopImmediatePropagation();
  event.respondWith(handler(event.request));
});

self.addEventListener('activate', (event) => {
  // Installs predating ngsw still carry the hand-rolled shell cache.
  event.waitUntil(caches.delete(LEGACY_APP_CACHE));
});

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

    // Stream straight into the cache, counting bytes as they pass through so we
    // can report progress without ever holding the whole episode in memory —
    // a long episode is well over 100MB, and buffering it used to cost that in RAM.
    const contentLength = Number(response.headers.get('content-length') ?? '0');
    let received = 0;

    const counter = new TransformStream({
      transform(chunk, controller) {
        received += chunk.byteLength;
        if (contentLength > 0 && port) {
          port.postMessage({ type: 'progress', id, pct: Math.round((received / contentLength) * 99) });
        }
        controller.enqueue(chunk);
      },
    });

    const stored = new Response(response.body.pipeThrough(counter), {
      status: 200,
      headers: { 'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg' },
    });
    const cache = await caches.open(AUDIO_CACHE);
    // Resolves once the stream has been drained to disk.
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

// Last: ngsw registers its own listeners here and handles everything above
// declined to claim.
importScripts('./ngsw-worker.js');
