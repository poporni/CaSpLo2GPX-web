/**
 * cave.js
 * Helper condivisi per presentare una grotta in UI ed export.
 */

/**
 * Restituisce il nome completo leggibile, conservando il codice se disponibile.
 * @param {Cave} cave
 * @returns {string}
 */
export function getCaveDisplayName(cave) {
  if (!cave) return 'Grotta';
  if (cave.rawName) return cave.rawName;
  if (cave.code && cave.name) return `${cave.code}-${cave.name}`;
  return cave.name || 'Grotta';
}

/**
 * Chiave stabile per deep link locali.
 * @param {Cave} cave
 * @returns {string}
 */
export function getCaveKey(cave) {
  if (!cave) return '';
  return cave.sourceId || cave.code || cave.rawName || cave.name || '';
}

/**
 * Valore quota da mostrare: evita di presentare 0 m quando il KML non espone Q.
 * @param {Cave} cave
 * @returns {string}
 */
export function getCaveElevation(cave) {
  if (!cave) return '';
  if (cave.elevation) return cave.elevation;
  return Number.isFinite(cave.ele) && cave.ele !== 0 ? String(cave.ele) : '';
}

/**
 * Formatta misure lineari già validate dal parser.
 * @param {string|number} value
 * @returns {string}
 */
export function formatMetric(value) {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value).trim();
  if (!text) return '';
  return /[a-zà-ù%]/i.test(text) ? text : `${text} m`;
}
