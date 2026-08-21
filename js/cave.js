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
