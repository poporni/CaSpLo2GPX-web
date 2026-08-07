/**
 * Cloudflare Worker — CaSpLo2GPX proxy con cache, ETag e 503
 *
 * Flusso:
 *   Browser → Worker → Cache Cloudflare (se fresca)
 *                    → speleolombardia.it (se scaduta o assente)
 *
 * Miglioramenti:
 *   - 503 + JSON se il Catasto è irraggiungibile
 *   - ETag / Last-Modified per rivalidazione condizionale
 *   - X-Cache: HIT / MISS per il client
 */

const KML_URL   = 'https://www.speleolombardia.it/catasto/openkis_kml.php?mod=caves&lat=45,8&lon=9.5&zoom=8&iconsize=1.5';
const CACHE_TTL = 60 * 60 * 24; // 24 ore

const WORKER_VERSION = '1.0.2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'X-CaSpLo2GPX-Version': WORKER_VERSION,
};

function errorResponse(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

// Domini autorizzati a chiamare il Worker (anti-abuse)
// Aggiungere il proprio dominio GitHub Pages qui
const ALLOWED_ORIGINS = [
  'https://poporni.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

export default {
  async fetch(request, env, ctx) {

    // Preflight CORS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Fix 4: controllo Referer/Origin per limitare accesso non autorizzato
    const origin  = request.headers.get('Origin')  || '';
    const referer = request.headers.get('Referer') || '';
    const allowed = ALLOWED_ORIGINS.some(o =>
      origin.startsWith(o) || referer.startsWith(o)
    );
    if (!allowed && origin !== '') {
      return new Response(JSON.stringify({ error: 'Origine non autorizzata' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }

    const cache    = caches.default;
    const cacheKey = new Request(KML_URL);

    // 1. Controlla la cache Cloudflare
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
      headers.set('X-Cache', 'HIT');
      // X-Catasto-Cached-At è già nell'header della risposta cached
      return new Response(cached.body, { status: 200, headers });
    }

    // 2. Cache miss: scarica dal sito con rivalidazione condizionale
    const upstreamHeaders = {
      'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Referer':         'https://www.speleolombardia.it/',
      'Accept':          'application/xml, text/xml, */*',
      'Accept-Language': 'it-IT,it;q=0.9',
    };

    // Passa ETag / Last-Modified se li abbiamo in cache (rivalidazione)
    if (cached) {
      const etag = cached.headers.get('ETag');
      const lm   = cached.headers.get('Last-Modified');
      if (etag) upstreamHeaders['If-None-Match']     = etag;
      if (lm)   upstreamHeaders['If-Modified-Since'] = lm;
    }

    let upstream;
    try {
      upstream = await fetch(KML_URL, { headers: upstreamHeaders });
    } catch (e) {
      return errorResponse(503, 'Catasto non raggiungibile');
    }

    // 304 Not Modified: restituisce dalla cache con header aggiornati
    if (upstream.status === 304 && cached) {
      const headers = new Headers(cached.headers);
      Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));
      headers.set('X-Cache', 'HIT');
      return new Response(cached.body, { status: 200, headers });
    }

    if (!upstream.ok) {
      return errorResponse(503, `Catasto non raggiungibile (HTTP ${upstream.status})`);
    }

    // 3. Legge e valida il body
    const body = await upstream.arrayBuffer();
    const text = new TextDecoder().decode(body);
    if (!text.includes('<kml')) {
      return errorResponse(502, 'Risposta non KML valida');
    }

    // 4. Costruisce la risposta con ETag, Last-Modified e X-Catasto-Cached-At
    const now = new Date().toUTCString();   // momento esatto del download
    const responseHeaders = {
      'Content-Type':          'application/xml; charset=utf-8',
      'Cache-Control':         `public, max-age=${CACHE_TTL}`,
      'X-Cache':               'MISS',
      'X-Catasto-Cached-At':   now,         // data certa dell'ultimo download
      ...CORS_HEADERS,
    };
    const etag = upstream.headers.get('ETag');
    const lm   = upstream.headers.get('Last-Modified');
    if (etag) responseHeaders['ETag']          = etag;
    if (lm)   responseHeaders['Last-Modified'] = lm;

    const responseToCache = new Response(body, { status: 200, headers: responseHeaders });
    ctx.waitUntil(cache.put(cacheKey, responseToCache.clone()));

    return new Response(body, { status: 200, headers: responseHeaders });
  },
};
