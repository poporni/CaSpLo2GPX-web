/**
 * parser.js
 * Parsing del KML del Catasto Speleologico Lombardo.
 * Restituisce un array di oggetti Cave.
 *
 * @typedef {Object} Cave
 * @property {string} name
 * @property {string} rawName
 * @property {string} code
 * @property {number} lat
 * @property {number} lon
 * @property {number} ele
 * @property {string} elevation
 * @property {string} synonyms
 * @property {string} development
 * @property {string} depth
 * @property {string} plain  - testo descrizione
 * @property {string} sourceUrl
 * @property {string} directionsUrl
 * @property {string} thumbnailUrl
 * @property {string} photoUrl
 * @property {string} sourceId
 * @property {string} apriUrl
 * @property {string} vaiUrl
 */

// DOMPurify: sanitizzazione aggiuntiva.
// Caricato dinamicamente per compatibilità con ambienti di test (Jest/jsdom).
let _DOMPurify = null;
(async () => {
  try {
    const mod = await import('dompurify');
    _DOMPurify = mod.default || mod;
  } catch (_) { /* fallback: solo DOMParser */ }
})();

function sanitizeHtml(html) {
  if (_DOMPurify && typeof _DOMPurify.sanitize === 'function') {
    return _DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['a', 'b', 'i', 'strong', 'em', 'br', 'p', 'img'],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'title'],
    });
  }
  return html; // fallback: DOMParser in parseDescription rimuove on*
}

const TRUSTED_IMAGE_HOSTS = new Set([
  'speleolombardia.it',
  'www.speleolombardia.it',
]);

function normalizeHttpUrl(value, baseUrl = 'https://www.speleolombardia.it') {
  if (!value) return '';
  try {
    const url = new URL(String(value).trim(), baseUrl);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
    return url.href;
  } catch (_) {
    return '';
  }
}

function normalizeImageUrl(value) {
  const href = normalizeHttpUrl(value);
  if (!href) return '';
  try {
    const host = new URL(href).hostname.toLowerCase();
    return TRUSTED_IMAGE_HOSTS.has(host) ? href : '';
  } catch (_) {
    return '';
  }
}

function derivePhotoUrl(thumbnailUrl) {
  if (!thumbnailUrl) return '';
  try {
    const url = new URL(thumbnailUrl);
    if (!url.pathname.includes('/photo1/thumbs/')) return '';

    const decodedName = decodeURIComponent(url.pathname.split('/').pop() || '');
    const hasGeneratedThumbSuffix =
      /\.(?:jpe?g|png|gif|webp|tiff?|bmp)\.jpe?g$/i.test(decodedName);
    if (!hasGeneratedThumbSuffix) return '';

    url.pathname = url.pathname
      .replace('/thumbs/', '/')
      .replace(/\.jpe?g$/i, '');
    const candidate = normalizeImageUrl(url.href);
    return candidate && candidate !== thumbnailUrl ? candidate : '';
  } catch (_) {
    return '';
  }
}

function decodeEntities(value) {
  let decoded = String(value || '');
  for (let i = 0; i < 3; i++) {
    const doc = new DOMParser().parseFromString(decoded, 'text/html');
    const next = doc.documentElement?.textContent || decoded;
    if (next === decoded) break;
    decoded = next;
  }
  return decoded;
}

function cleanupText(value) {
  return decodeEntities(value).replace(/\s+/g, ' ').trim();
}

const METRIC_LABELS = [
  'Q\\s*[\\.:]',
  'Quota\\s*:',
  'SV\\s*[\\.:]',
  'Sviluppo\\s*:',
  'P\\s*[\\.:]',
  'Profondit[àa]\\s*:',
].join('|');

function extractTextField(text, labelPattern) {
  const pattern = new RegExp(
    `(?:^|\\s)(?:${labelPattern})\\s*:?\\s*(.+?)(?=\\s+(?:${METRIC_LABELS})|$)`,
    'i'
  );
  const match = cleanupText(text).match(pattern);
  return match ? cleanupText(match[1]) : '';
}

function extractMetricField(text, labelPattern) {
  const clean = cleanupText(text);
  const pattern = new RegExp(`(?:^|[\\s;|,])(?:${labelPattern})\\s*`, 'i');
  const match = pattern.exec(clean);
  if (!match) return '';

  const tail = clean.slice(match.index + match[0].length);
  const nextField = new RegExp(`(?:^|[\\s;|,])(?:${METRIC_LABELS})`, 'i');
  const end = tail.search(nextField);
  const rawValue = cleanupText(end >= 0 ? tail.slice(0, end) : tail);
  return normalizeMetricValue(rawValue);
}

function normalizeMetricValue(value) {
  const match = cleanupText(value).match(/^[-+]?(?:\d+(?:[.,]\d+)?|\.\d+)(?:\s*(?:m|mt|metri))?$/i);
  if (!match) return '';
  return match[0]
    .replace(',', '.')
    .replace(/\s*(?:m|mt|metri)$/i, '')
    .trim();
}

function extractSynonyms(doc, plain) {
  const explicit = extractTextField(plain, 'Sinonim[oi]|Synonyms?');
  if (explicit) return explicit;

  const em = doc.querySelector('em');
  return cleanupText(em?.textContent || '');
}

function extractSourceId(sourceUrl) {
  if (!sourceUrl) return '';
  try {
    const url = new URL(sourceUrl);
    const queryId = url.searchParams.get('id');
    if (queryId) return queryId;
    const pathId = url.pathname.match(/\/view\/([^/?#]+)\/?$/i);
    return pathId ? decodeURIComponent(pathId[1]) : '';
  } catch (_) {
    return '';
  }
}

function parsePlacemarkName(rawName) {
  const cleanRawName = cleanupText(rawName) || 'Grotta';
  const separator = cleanRawName.indexOf('-');
  if (separator <= 0 || separator === cleanRawName.length - 1) {
    return { rawName: cleanRawName, code: '', name: cleanRawName };
  }

  const code = cleanupText(cleanRawName.slice(0, separator));
  const name = cleanupText(cleanRawName.slice(separator + 1));
  const looksLikeCode = code.length <= 16 && /\d/.test(code);
  if (!looksLikeCode || !name) {
    return { rawName: cleanRawName, code: '', name: cleanRawName };
  }

  return { rawName: cleanRawName, code, name };
}

/**
 * Estrae dati strutturati dall'HTML della descrizione.
 * Usa DOMParser (text/html) per evitare XSS da innerHTML diretto.
 * @param {string} html
 * @returns {{
 *   plain: string,
 *   sourceUrl: string,
 *   directionsUrl: string,
 *   thumbnailUrl: string,
 *   photoUrl: string,
 *   sourceId: string,
 *   synonyms: string,
 *   elevation: string,
 *   development: string,
 *   depth: string
 * }}
 */
function parseDescription(html) {
  const empty = {
    plain: '',
    sourceUrl: '',
    directionsUrl: '',
    thumbnailUrl: '',
    photoUrl: '',
    sourceId: '',
    synonyms: '',
    elevation: '',
    development: '',
    depth: '',
  };
  if (!html) return empty;

  // Prima sanitizza con DOMPurify (se disponibile), poi parsa con DOMParser
  const cleanHtml = sanitizeHtml(html);
  const doc = new DOMParser().parseFromString(cleanHtml, 'text/html');
  let sourceUrl = '', directionsUrl = '';
  let thumbnailUrl = '', photoUrl = '';

  for (const img of doc.querySelectorAll('img[src]')) {
    thumbnailUrl = normalizeImageUrl(img.getAttribute('src'));
    if (thumbnailUrl) break;
  }
  photoUrl = derivePhotoUrl(thumbnailUrl);

  doc.querySelectorAll('a').forEach(a => {
    const label = (a.textContent || '').trim().toLowerCase();
    const href  = normalizeHttpUrl(a.getAttribute('href'));
    if (!href) return;
    if (label.includes('apri')) sourceUrl = href;
    if (label.includes('vai')) directionsUrl = href;
  });

  // Estrai testo plain rimuovendo nodi non descrittivi o potenzialmente attivi.
  doc.querySelectorAll('a').forEach(a => a.remove());
  doc.querySelectorAll('script, style, iframe, object, embed, svg').forEach(el => el.remove());
  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes)
      .filter(attr => attr.name.startsWith('on'))
      .forEach(attr => el.removeAttribute(attr.name));
  });
  const plain = cleanupText(doc.body?.textContent || '');

  return {
    plain,
    sourceUrl,
    directionsUrl,
    thumbnailUrl,
    photoUrl,
    sourceId: extractSourceId(sourceUrl),
    synonyms: extractSynonyms(doc, plain),
    elevation: extractMetricField(plain, 'Q\\s*[\\.:]|Quota\\s*:'),
    development: extractMetricField(plain, 'SV\\s*[\\.:]|Sviluppo\\s*:'),
    depth: extractMetricField(plain, 'P\\s*[\\.:]|Profondit[àa]\\s*:'),
  };
}

/**
 * Converte il testo XML del KML in array di Cave.
 * @param {string} xmlText
 * @param {function} onProgress - callback(pct, label)
 * @returns {Cave[]}
 */
export function parseKml(xmlText, onProgress) {
  onProgress(65, 'Parsing KML…');

  const doc = new DOMParser().parseFromString(xmlText, 'text/xml');
  const placemarks = Array.from(doc.querySelectorAll('Placemark'));
  const total = placemarks.length || 1;  // evita divisione per zero
  const caves = [];
  let errors = 0;

  placemarks.forEach((pm, i) => {
    try {
      const parsedName = parsePlacemarkName(pm.querySelector('name')?.textContent || 'Grotta');
      const desc       = pm.querySelector('description')?.textContent || '';
      const coords     = pm.querySelector('coordinates')?.textContent?.trim();
      if (!coords) return;

      const parts = coords.split(',');
      if (parts.length < 2) return;
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      const ele = parts.length > 2 ? parseFloat(parts[2]) : 0;
      // Valida coordinate: range geografico valido e non NaN
      if (isNaN(lat) || isNaN(lon) ||
          lat < -90 || lat > 90 ||
          lon < -180 || lon > 180) return;

      const details = parseDescription(desc);
      caves.push({
        ...parsedName,
        lat,
        lon,
        ele,
        elevation: details.elevation,
        synonyms: details.synonyms,
        development: details.development,
        depth: details.depth,
        plain: details.plain,
        sourceUrl: details.sourceUrl,
        directionsUrl: details.directionsUrl,
        thumbnailUrl: details.thumbnailUrl,
        photoUrl: details.photoUrl,
        sourceId: details.sourceId,
        // Alias storici mantenuti per compatibilità con export e test esistenti.
        apriUrl: details.sourceUrl,
        vaiUrl: details.directionsUrl,
      });
    } catch (e) {
      errors++;
    }

    if (i % 500 === 0) {
      const pct = Math.round(65 + (i / total) * 25);
      onProgress(pct, `Parsing… ${i}/${total}`);
    }
  });

  if (errors) console.warn(`Parser: ${errors} placemark ignorati su ${total}`);
  onProgress(90, `${caves.length} grotte caricate`);
  return caves;
}
