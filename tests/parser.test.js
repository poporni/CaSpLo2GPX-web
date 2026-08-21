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

const REAL_WORLD_KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://earth.google.com/kml/2.1">
<Folder><name>ctl_caves</name>
  <Placemark>
    <name>LO2192-GROTTA DEL FO&amp;amp;#039; DI BARNI</name>
    <description><![CDATA[
      <em>BÜS DE LA PISSALONGA</em><br />
      <img src="https://www.speleolombardia.it/catasto/misc/fndatabase/ctl_caves/2192/photo1/thumbs/2192 LO foto ingresso Marco Bonelli e Felicita Spreafico.jpg.jpg" />
      <br />Q. SV.35 P.14.2
      <a href="https://www.speleolombardia.it/catasto/it/caves/view/2192/">Apri</a>
      <a href="https://www.google.it/maps/dir//45.9050051,9.2605437/">Vai a</a>
    ]]></description>
    <Point><coordinates>9.2605437,45.9050051,0</coordinates></Point>
  </Placemark>
  <Placemark>
    <name>LO2549-GROTTA DELLA SORGENTE</name>
    <description><![CDATA[
      <img src="https://www.speleolombardia.it/catasto/misc/fndatabase/ctl_caves/2549/photo1/thumbs/2549 LO foto ingresso Andrea Ferrario.JPG.jpg" />
      <br />Q. SV.5 P.0.3
      <a href="https://www.speleolombardia.it/catasto/it/caves/view/2549/">Apri</a>
      <a href="https://www.google.it/maps/dir//45.9041877,9.2637888/">Vai a</a>
    ]]></description>
    <Point><coordinates>9.2637888,45.9041877,0</coordinates></Point>
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
    expect(grotta.photoUrl).toBe('');
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
    expect(grotta.photoUrl).toBe('');
    expect(grotta.sourceUrl).toBe('');
    expect(grotta.apriUrl).toBe('');
  });

  test('non include contenuti script nel testo plain', () => {
    const result = parseKml(UNSAFE_KML, noop);
    const grotta = result[0];
    expect(grotta.plain).not.toContain('alert');
    expect(grotta.plain).toContain('Q.10');
  });

  test('decodifica nomi con entità HTML annidate', () => {
    const result = parseKml(REAL_WORLD_KML, noop);
    const barni = result[0];
    expect(barni.rawName).toBe("LO2192-GROTTA DEL FO' DI BARNI");
    expect(barni.name).toBe("GROTTA DEL FO' DI BARNI");
  });

  test('estrae sinonimi da em senza confonderli con i campi metrici', () => {
    const result = parseKml(REAL_WORLD_KML, noop);
    const barni = result[0];
    expect(barni.synonyms).toBe('BÜS DE LA PISSALONGA');
    expect(barni.elevation).toBe('');
    expect(barni.development).toBe('35');
    expect(barni.depth).toBe('14.2');
  });

  test('non usa il campo successivo come valore quando una metrica è vuota', () => {
    const result = parseKml(REAL_WORLD_KML, noop);
    const sorgente = result[1];
    expect(sorgente.elevation).toBe('');
    expect(sorgente.development).toBe('5');
    expect(sorgente.depth).toBe('0.3');
  });

  test('deriva una URL foto originale quando la thumbnail segue la convenzione OpenKIS', () => {
    const result = parseKml(REAL_WORLD_KML, noop);
    const sorgente = result[1];
    expect(sorgente.thumbnailUrl).toBe(
      'https://www.speleolombardia.it/catasto/misc/fndatabase/ctl_caves/2549/photo1/thumbs/2549%20LO%20foto%20ingresso%20Andrea%20Ferrario.JPG.jpg'
    );
    expect(sorgente.photoUrl).toBe(
      'https://www.speleolombardia.it/catasto/misc/fndatabase/ctl_caves/2549/photo1/2549%20LO%20foto%20ingresso%20Andrea%20Ferrario.JPG'
    );
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
      photoUrl: '',
      sourceUrl: '',
      directionsUrl: '',
      sourceId: '',
    });
  });
});
