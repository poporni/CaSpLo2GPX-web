/**
 * tests/backup.test.js
 * Test unitari per lo script di backup OpenKIS.
 */

import { describe, test, expect } from '@jest/globals';
import {
  buildCsv,
  buildGeoJson,
  buildImageCandidates,
  mergeOpenKisJson,
  parseOpenKisJson,
  safePathSegment,
} from '../scripts/backup-openkis.js';

const SAMPLE_CAVES = [
  {
    code: 'LO1',
    name: 'GROTTA TEST',
    rawName: 'LO1-GROTTA TEST',
    sourceId: '100',
    lat: 45.9,
    lon: 9.6,
    ele: 500,
    elevation: '500',
    development: '12',
    depth: '3',
    synonyms: '',
    plain: 'Q.500 SV.12 P.3',
    sourceUrl: 'https://www.speleolombardia.it/catasto/it/caves/view/100/',
    directionsUrl: 'https://www.google.it/maps/dir//45.9,9.6/',
    thumbnailUrl: 'https://www.speleolombardia.it/catasto/misc/fndatabase/ctl_caves/100/photo1/thumbs/test.JPG.jpg',
    photoUrl: 'https://www.speleolombardia.it/catasto/misc/fndatabase/ctl_caves/100/photo1/test.JPG',
  },
];

describe('backup-openkis helpers', () => {
  test('costruisce candidate immagini con originale prima della thumbnail', () => {
    expect(buildImageCandidates(SAMPLE_CAVES[0])).toEqual([
      { kind: 'original', url: SAMPLE_CAVES[0].photoUrl },
      { kind: 'thumbnail', url: SAMPLE_CAVES[0].thumbnailUrl },
    ]);
  });

  test('sanifica segmenti path mantenendo nomi leggibili', () => {
    expect(safePathSegment('../LO1: Grotta/Test?')).toBe('__LO1_ Grotta_Test_');
  });

  test('genera GeoJSON ripristinabile', () => {
    const geojson = buildGeoJson(SAMPLE_CAVES);
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features[0].geometry.coordinates).toEqual([9.6, 45.9, 500]);
    expect(geojson.features[0].properties.code).toBe('LO1');
  });

  test('genera CSV con escape dei campi testuali', () => {
    const csv = buildCsv([{ ...SAMPLE_CAVES[0], name: 'Grotta, "test"' }]);
    expect(csv).toContain('"Grotta, ""test"""');
    expect(csv).toContain('mediaLocalPath');
  });

  test('estrae e integra i campi JSON OpenKIS pubblici', () => {
    const items = parseOpenKisJson(JSON.stringify({
      items: [{
        id: '100',
        code: 'LO1',
        regione: 'LOMBARDIA',
        provincia: 'LC',
        comune: 'BARZIO',
        areas: 'LC1',
        closed: 'N',
        meteorology: 'none',
        fauna: 'pipistrelli',
        depth_total: '3',
        depth_negative: '1',
        depth_positive: '2',
        lenght_total: '12',
      }],
    }));

    const [merged] = mergeOpenKisJson(SAMPLE_CAVES, items);
    expect(merged.province).toBe('LC');
    expect(merged.municipality).toBe('BARZIO');
    expect(merged.depthNegative).toBe('1');
    expect(merged.lengthTotal).toBe('12');
    expect(merged.openkis.fauna).toBe('pipistrelli');
  });
});
