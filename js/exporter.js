/**
 * exporter.js
 * Genera il file GPX e avvia il download nel browser.
 */

function escXml(s) {
  return String(s)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

/**
 * Rimuove caratteri non validi nei nomi file.
 * @param {string} s
 * @returns {string}
 */
function safeName(s) {
  return String(s)
    .replace(/[/\\<>:"|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, '_');
}

/**
 * Genera il contenuto GPX da un array di Cave.
 * @param {Cave[]} caves
 * @returns {string} XML GPX
 */
export function generateGpx(caves) {
  const today = new Date().toISOString().split('T')[0];

  const wpts = caves.map(c => {
    const descParts = [
      c.plain,
      c.apriUrl ? `Apri: ${c.apriUrl}` : '',
      c.vaiUrl  ? `Vai a: ${c.vaiUrl}` : '',
    ].filter(Boolean).join('\n');

    return `  <wpt lat="${c.lat}" lon="${c.lon}">
    <ele>${c.ele}</ele>
    <name>${escXml(c.name)}</name>
    ${descParts ? `<desc>${escXml(descParts)}</desc>` : ''}
    ${c.apriUrl ? `<link href="${escXml(c.apriUrl)}"><text>${escXml(c.name)}</text><type>text/html</type></link>` : ''}
  </wpt>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="CaSpLo2GPX web"
     xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Catasto Speleologico Lombardo ${today}</name>
    <desc>Dati provenienti dal Catasto Speleologico Lombardo. Licenza CC BY-NC-ND 3.0 IT. Convertiti con CaSpLo2GPX web.</desc>
    <author><name>CaSpLo2GPX web</name></author>
    <copyright author="Catasto Speleologico Lombardo">
      <license>https://creativecommons.org/licenses/by-nc-nd/3.0/it/</license>
    </copyright>
  </metadata>
${wpts}
</gpx>`;
}

/**
 * Avvia il download del file GPX nel browser.
 * @param {string} content
 * @param {string} filename
 */
export function downloadGpx(content, filename) {
  const blob = new Blob([content], { type: 'application/gpx+xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Costruisce il nome file automatico con caratteri sicuri.
 * @param {string} province
 * @param {boolean} hasArea
 * @returns {string}
 */
export function buildFilename(province, hasArea) {
  const today = new Date().toISOString().split('T')[0];
  const parts = [];
  if (province) parts.push(safeName(province));
  if (hasArea)  parts.push('area');
  if (!parts.length) parts.push('Lombardia');
  return `Catasto_Speleologico_${parts.join('_')}_${today}.gpx`;
}
