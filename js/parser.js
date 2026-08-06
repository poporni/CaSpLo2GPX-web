/**
 * parser.js
 * Parsing del KML del Catasto Speleologico Lombardo.
 * Restituisce un array di oggetti Cave.
 *
 * @typedef {Object} Cave
 * @property {string} name
 * @property {number} lat
 * @property {number} lon
 * @property {number} ele
 * @property {string} plain  - testo descrizione
 * @property {string} apriUrl
 * @property {string} vaiUrl
 */

// DOMPurify: import statico — incluso nel bundle esbuild in produzione.
// In sviluppo (moduli ES diretti) viene caricato da node_modules.
import DOMPurify from 'dompurify';

function sanitizeHtml(html) {
  if (typeof DOMPurify !== 'undefined' && DOMPurify.sanitize) {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['a', 'b', 'i', 'strong', 'em', 'br', 'p'],
      ALLOWED_ATTR: ['href'],
    });
  }
  return html; // fallback: DOMParser in parseDescription rimuove on*
}

/**
 * Estrae i link "Apri" e "Vai a" dall'HTML della descrizione.
 * Usa DOMParser (text/html) per evitare XSS da innerHTML diretto.
 * @param {string} html
 * @returns {{ plain: string, apriUrl: string, vaiUrl: string }}
 */
function parseDescription(html) {
  if (!html) return { plain: '', apriUrl: '', vaiUrl: '' };

  // Prima sanitizza con DOMPurify (se disponibile), poi parsa con DOMParser
  const cleanHtml = sanitizeHtml(html);
  const doc = new DOMParser().parseFromString(cleanHtml, 'text/html');
  let apriUrl = '', vaiUrl = '';

  doc.querySelectorAll('a').forEach(a => {
    const label = (a.textContent || '').trim().toLowerCase();
    const href  = a.getAttribute('href') || '';
    // Accetta solo URL http/https — scarta javascript: e altri schemi
    if (!/^https?:\/\//i.test(href)) return;
    if (label === 'apri')  apriUrl = href;
    if (label === 'vai a') vaiUrl  = href;
  });

  // Estrai testo plain rimuovendo i nodi <a>
  doc.querySelectorAll('a').forEach(a => a.remove());
  // Rimuovi eventuali attributi on* da qualsiasi elemento rimasto
  doc.querySelectorAll('*').forEach(el => {
    Array.from(el.attributes)
      .filter(attr => attr.name.startsWith('on'))
      .forEach(attr => el.removeAttribute(attr.name));
  });
  const plain = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
  return { plain, apriUrl, vaiUrl };
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
      const name   = pm.querySelector('name')?.textContent?.trim() || 'Grotta';
      const desc   = pm.querySelector('description')?.textContent || '';
      const coords = pm.querySelector('coordinates')?.textContent?.trim();
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

      const { plain, apriUrl, vaiUrl } = parseDescription(desc);
      caves.push({ name, lat, lon, ele, plain, apriUrl, vaiUrl });
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
