/**
 * tests/baselayers.test.js
 * Test unitari per la selezione dei layer cartografici.
 */

import { describe, test, expect } from '@jest/globals';
import { buildTracestrackTopoUrl, MAP_LAYER_IDS,
         resolveMapLayerSelection } from '../js/baselayers.js';

describe('buildTracestrackTopoUrl', () => {
  test('restituisce stringa vuota senza API key', () => {
    expect(buildTracestrackTopoUrl('')).toBe('');
    expect(buildTracestrackTopoUrl('   ')).toBe('');
  });

  test('costruisce URL tile Tracestrack Topo con key codificata', () => {
    expect(buildTracestrackTopoUrl(' chiave test ')).toBe(
      'https://tile.tracestrack.com/topo__/{z}/{x}/{y}.webp?key=chiave%20test'
    );
  });
});

describe('resolveMapLayerSelection', () => {
  test('usa OpenStreetMap per layer sconosciuti', () => {
    expect(resolveMapLayerSelection('non-esiste')).toEqual({
      ok: true,
      layerId: MAP_LAYER_IDS.OSM,
      requestedId: MAP_LAYER_IDS.OSM,
      reason: '',
    });
  });

  test('blocca Tracestrack Topo se manca la key', () => {
    expect(resolveMapLayerSelection(MAP_LAYER_IDS.TRACESTRACK_TOPO)).toEqual({
      ok: false,
      layerId: MAP_LAYER_IDS.OSM,
      requestedId: MAP_LAYER_IDS.TRACESTRACK_TOPO,
      reason: 'missing-tracestrack-key',
    });
  });

  test('accetta Tracestrack Topo quando la key e presente', () => {
    expect(resolveMapLayerSelection(MAP_LAYER_IDS.TRACESTRACK_TOPO, 'abc')).toEqual({
      ok: true,
      layerId: MAP_LAYER_IDS.TRACESTRACK_TOPO,
      requestedId: MAP_LAYER_IDS.TRACESTRACK_TOPO,
      reason: '',
    });
  });
});
