/**
 * baselayers.js
 * Configurazione dei layer cartografici di base.
 */

export const MAP_LAYER_IDS = {
  OSM: 'osm',
  TRACESTRACK_TOPO: 'tracestrack-topo',
};

export const MAP_LAYER_STORAGE_KEY = 'casplo2gpx.mapLayer';
export const TRACESTRACK_KEY_STORAGE_KEY = 'casplo2gpx.tracestrackKey';

const OSM_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

const TRACESTRACK_TOPO_ATTRIBUTION =
  'Data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
  'SRTM, GEBCO, SONNY\'s LiDAR DTM, NASADEM, ESA WorldCover; ' +
  'Maps © <a href="https://tracestrack.com/">Tracestrack</a>';

export const MAP_LAYER_OPTIONS = [
  { id: MAP_LAYER_IDS.OSM, label: 'OpenStreetMap' },
  { id: MAP_LAYER_IDS.TRACESTRACK_TOPO, label: 'Tracestrack Topo' },
];

export function buildTracestrackTopoUrl(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) return '';
  return `https://tile.tracestrack.com/topo__/{z}/{x}/{y}.webp?key=${encodeURIComponent(key)}`;
}

export function resolveMapLayerSelection(requestedId, tracestrackKey = '') {
  const layerId = Object.values(MAP_LAYER_IDS).includes(requestedId)
    ? requestedId
    : MAP_LAYER_IDS.OSM;

  if (layerId === MAP_LAYER_IDS.TRACESTRACK_TOPO && !String(tracestrackKey || '').trim()) {
    return {
      ok: false,
      layerId: MAP_LAYER_IDS.OSM,
      requestedId: layerId,
      reason: 'missing-tracestrack-key',
    };
  }

  return { ok: true, layerId, requestedId: layerId, reason: '' };
}

export function createBaseTileLayer(layerId, options = {}) {
  if (layerId === MAP_LAYER_IDS.TRACESTRACK_TOPO) {
    const url = buildTracestrackTopoUrl(options.tracestrackKey);
    if (!url) throw new Error('Tracestrack Topo richiede una API key');
    return L.tileLayer(url, {
      attribution: TRACESTRACK_TOPO_ATTRIBUTION,
      maxZoom: 19,
    });
  }

  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: OSM_ATTRIBUTION,
    maxZoom: 19,
  });
}
