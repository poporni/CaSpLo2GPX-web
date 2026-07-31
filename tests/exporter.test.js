/**
 * tests/exporter.test.js
 * Test unitari per exporter.js
 */

import { describe, test, expect } from '@jest/globals';
import { generateGpx, buildFilename } from '../js/exporter.js';

const SAMPLE_CAVES = [
  {
    name: 'LO1-GROTTA TEST',
    lat: 45.9, lon: 9.6, ele: 500,
    plain: 'Q.500 SV.10 P.5',
    apriUrl: 'https://www.speleolombardia.it/catasto/it/caves/view/1/',
    vaiUrl:  'https://www.google.it/maps/dir//45.9,9.6/',
  },
  {
    name: 'LO2-GROTTA <SPECIALE> & "TEST"',
    lat: 46.0, lon: 9.7, ele: 600,
    plain: '',
    apriUrl: '',
    vaiUrl:  '',
  },
];

describe('generateGpx', () => {
  test('restituisce stringa XML GPX valida', () => {
    const gpx = generateGpx(SAMPLE_CAVES);
    expect(typeof gpx).toBe('string');
    expect(gpx).toContain('<?xml');
    expect(gpx).toContain('<gpx');
    expect(gpx).toContain('</gpx>');
  });

  test('contiene i waypoint', () => {
    const gpx = generateGpx(SAMPLE_CAVES);
    expect(gpx).toContain('<wpt');
    expect(gpx).toContain('LO1-GROTTA TEST');
  });

  test('include metadati licenza', () => {
    const gpx = generateGpx(SAMPLE_CAVES);
    expect(gpx).toContain('<metadata>');
    expect(gpx).toContain('CC BY-NC-ND');
  });

  test('escapa caratteri XML speciali nel nome', () => {
    const gpx = generateGpx(SAMPLE_CAVES);
    expect(gpx).not.toContain('<SPECIALE>');
    expect(gpx).toContain('&lt;SPECIALE&gt;');
    expect(gpx).toContain('&amp;');
    expect(gpx).toContain('&quot;');
  });

  test('include link apriUrl', () => {
    const gpx = generateGpx(SAMPLE_CAVES);
    expect(gpx).toContain('speleolombardia.it');
  });

  test('gestisce array vuoto senza crash', () => {
    expect(() => generateGpx([])).not.toThrow();
    expect(generateGpx([])).toContain('<gpx');
  });
});

describe('buildFilename', () => {
  test('include provincia nel nome', () => {
    const name = buildFilename('Lecco', false);
    expect(name).toContain('Lecco');
    expect(name).toContain('.gpx');
  });

  test('include area nel nome se presente', () => {
    const name = buildFilename('Bergamo', true);
    expect(name).toContain('Bergamo');
    expect(name).toContain('area');
  });

  test('usa Lombardia se nessun filtro', () => {
    const name = buildFilename('', false);
    expect(name).toContain('Lombardia');
  });

  test('sanifica caratteri non validi', () => {
    const name = buildFilename('Monza e della Brianza', false);
    expect(name).not.toMatch(/[/\\<>:"|?*]/);
  });

  test('include la data nel formato YYYY-MM-DD', () => {
    const name = buildFilename('Como', false);
    expect(name).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
