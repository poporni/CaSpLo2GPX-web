/**
 * tests/parser.test.js
 * Test unitari per parser.js
 * Eseguire con: npm test
 */

import { describe, test, expect } from '@jest/globals';
import { parseKml } from '../js/parser.js';

const noop = () => {};

// KML minimale valido
const MINIMAL_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.1">
<Folder><name>ctl_caves</name>
  <Placemark>
    <name>LO1-GROTTA TEST</name>
    <description><![CDATA[Q.500 SV.10 P.5 <a href="https://www.speleolombardia.it/catasto/it/caves/view/1/">Apri</a> <a href="https://www.google.it/maps/dir//45.9,9.6/">Vai a</a>]]></description>
    <Point><coordinates>9.6,45.9,500</coordinates></Point>
  </Placemark>
  <Placemark>
    <name>LO2-GROTTA CON COORDINATE INVALIDE</name>
    <description></description>
    <Point><coordinates>999,999,0</coordinates></Point>
  </Placemark>
  <Placemark>
    <name>LO3-GROTTA SENZA COORDINATE</name>
    <description></description>
  </Placemark>
</Folder>
</kml>`;

const PHOTO_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.1">
<Folder><name>ctl_caves</name>
  <Placemark>
    <name>LO42-GROTTA CON FOTO - RAMO NORD</name>
    <description><![CDATA[
      Sinonimi: Buco del Test<br>
      Q. 1234 SV. 56 P. -78
      <img src="https://www.speleolombardia.it/catasto/thumbs/foto.jpg" onerror="alert(1)">
      <a href="https://www.speleolombardia.it/catasto/index.php?mod=caves&amp;op=view&amp;id=987">Apri</a>
      <a href="https://www.google.it/maps/dir//46.1,9.8/">Vai a</a>
    ]]></description>
    <Point><coordinates>9.8,46.1,1234</coordinates></Point>
  </Placemark>
</Folder>
</kml>`;

const UNSAFE_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.1">
<Folder><name>ctl_caves</name>
  <Placemark>
    <name>LO99-GROTTA XSS</name>
    <description><![CDATA[
      Q.10 SV.20 P.30
      <script>alert('xss')</script>
      <img src="javascript:alert(1)">
      <img src="https://evil.example/foto.jpg">
      <a href="javascript:alert(1)">Apri</a>
    ]]></description>
    <Point><coordinates>9.1,45.1,10</coordinates></Point>
  </Placemark>
</Folder>
</kml>`;

const MULTI_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.1">
<Folder><name>ctl_caves</name>
  <Placemark><name>A</name><Point><coordinates>9.0,45.0,100</coordinates></Point></Placemark>
  <Placemark><name>B</name><Point><coordinates>9.5,45.5,200</coordinates></Point></Placemark>
  <Placemark><name>C</name><Point><coordinates>10.0,46.0,300</coordinates></Point></Placemark>
</Folder>
</kml>`;

describe('parseKml', () => {
  test('restituisce array da KML valido', () => {
    const result = parseKml(MINIMAL_KML, noop);
    expect(Array.isArray(result)).toBe(true);
  });

  test('carica la grotta con coordinate valide', () => {
    const result = parseKml(MINIMAL_KML, noop);
    expect(result.length).toBeGreaterThanOrEqual(1);
    const grotta = result[0];
    expect(grotta.rawName).toBe('LO1-GROTTA TEST');
    expect(grotta.code).toBe('LO1');
    expect(grotta.name).toBe('GROTTA TEST');
    expect(grotta.lat).toBeCloseTo(45.9, 4);
    expect(grotta.lon).toBeCloseTo(9.6, 4);
    expect(grotta.ele).toBe(500);
  });

  test('scarta coordinate fuori range geografico', () => {
    const result = parseKml(MINIMAL_KML, noop);
    const invalida = result.find(c => c.name.includes('INVALIDE'));
    expect(invalida).toBeUndefined();
  });

  test('scarta placemark senza coordinate', () => {
    const result = parseKml(MINIMAL_KML, noop);
    const senza = result.find(c => c.name.includes('SENZA'));
    expect(senza).toBeUndefined();
  });

  test('estrae link apriUrl e vaiUrl dalla descrizione', () => {
    const result = parseKml(MINIMAL_KML, noop);
    const grotta = result[0];
    expect(grotta.apriUrl).toContain('speleolombardia.it');
    expect(grotta.vaiUrl).toContain('google.it');
    expect(grotta.sourceUrl).toBe(grotta.apriUrl);
    expect(grotta.directionsUrl).toBe(grotta.vaiUrl);
    expect(grotta.sourceId).toBe('1');
  });

  test('estrae foto, sinonimi e dati principali dalla descrizione', () => {
    const result = parseKml(PHOTO_KML, noop);
    const grotta = result[0];
    expect(grotta.code).toBe('LO42');
    expect(grotta.name).toBe('GROTTA CON FOTO - RAMO NORD');
    expect(grotta.thumbnailUrl).toBe('https://www.speleolombardia.it/catasto/thumbs/foto.jpg');
    expect(grotta.synonyms).toBe('Buco del Test');
    expect(grotta.elevation).toBe('1234');
    expect(grotta.development).toBe('56');
    expect(grotta.depth).toBe('-78');
    expect(grotta.sourceId).toBe('987');
  });

  test('lascia vuota la foto se il KML non contiene img valido', () => {
    const result = parseKml(MINIMAL_KML, noop);
    expect(result[0].thumbnailUrl).toBe('');
  });

  test('scarta URL immagine e link non http/https o fuori allowlist', () => {
    const result = parseKml(UNSAFE_KML, noop);
    const grotta = result[0];
    expect(grotta.thumbnailUrl).toBe('');
    expect(grotta.sourceUrl).toBe('');
    expect(grotta.apriUrl).toBe('');
  });

  test('non include contenuti script nel testo plain', () => {
    const result = parseKml(UNSAFE_KML, noop);
    const grotta = result[0];
    expect(grotta.plain).not.toContain('alert');
    expect(grotta.plain).toContain('Q.10');
  });

  test('carica più grotte', () => {
    const result = parseKml(MULTI_KML, noop);
    expect(result.length).toBe(3);
  });

  test('i campi lat/lon/ele sono numeri', () => {
    const result = parseKml(MULTI_KML, noop);
    result.forEach(c => {
      expect(typeof c.lat).toBe('number');
      expect(typeof c.lon).toBe('number');
      expect(typeof c.ele).toBe('number');
    });
  });

  test('gestisce KML vuoto senza crash', () => {
    const empty = `<?xml version="1.0"?><kml xmlns="http://earth.google.com/kml/2.1"></kml>`;
    expect(() => parseKml(empty, noop)).not.toThrow();
    expect(parseKml(empty, noop)).toEqual([]);
  });

  test('gestisce descrizioni mancanti senza campi fantasma', () => {
    const result = parseKml(MULTI_KML, noop);
    expect(result[0]).toMatchObject({
      plain: '',
      thumbnailUrl: '',
      sourceUrl: '',
      directionsUrl: '',
      sourceId: '',
    });
  });
});
