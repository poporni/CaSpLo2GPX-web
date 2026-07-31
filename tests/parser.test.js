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
    expect(grotta.name).toBe('LO1-GROTTA TEST');
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
});
