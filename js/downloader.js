/**
 * downloader.js
 * Scarica il KML dal Cloudflare Worker.
 * Restituisce { text, fromCache, lastModified }.
 */

const KML_WORKER_URL = 'https://casplo2gpx-web.pop-orni.workers.dev';

/**
 * @param {function} onProgress - callback(pct, label)
 * @returns {Promise<{text: string, fromCache: boolean, lastModified: string|null}>}
 */
export async function fetchKml(onProgress) {
  onProgress(10, 'Download KML…');

  let res;
  try { res = await fetch(KML_WORKER_URL); }
  catch (e) { throw new Error(`Connessione fallita: ${e && e.message ? e.message : String(e)}`); }

  if (!res.ok) {
    let detail = '';
    try { const j = await res.json(); detail = j?.error || ''; } catch (_) {}
    throw new Error(detail || `HTTP ${res.status}`);
  }

  if (!res.body) throw new Error('Risposta priva di body dal server');

  const fromCache    = res.headers.get('X-Cache') === 'HIT';
  const lastModified = res.headers.get('X-Catasto-Cached-At')
                    || res.headers.get('Last-Modified')
                    || null;

  const contentLength = parseInt(res.headers.get('Content-Length')) || 0;
  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const size = (value && (value.byteLength ?? value.length)) || 0;
    if (size === 0) continue;
    chunks.push(value);
    received += size;
    if (contentLength) {
      const pct = Math.round(10 + (received / contentLength) * 50);
      onProgress(pct, `Download… ${(received / 1024 / 1024).toFixed(1)} MB`);
    }
  }

  // Concatena chunks
  const all = new Uint8Array(received);
  let pos = 0;
  for (const chunk of chunks) {
    const arr = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
    all.set(arr, pos);
    pos += arr.length;
  }
  const text = new TextDecoder('utf-8').decode(all);

  if (!text.includes('<kml')) throw new Error('Risposta non KML valida');

  onProgress(60, `${(received / 1024 / 1024).toFixed(1)} MB scaricati`);
  return { text, fromCache, lastModified };
}
