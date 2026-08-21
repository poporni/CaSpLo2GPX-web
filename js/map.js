/**
 * map.js
 * Mappa Leaflet, clustering, disegno area, ricerca, highlight.
 */

import { filterCaves } from './geometry.js';
import { getCaveDisplayName } from './cave.js';

const BLU   = '#2E6DA4';
const BLU_S = '#1A4F7A';
const VERDE = '#4A8F3F';

// ── Mappa ─────────────────────────────────────────────────────────────────────
export const map = L.map('map', {
  tap: false,   // Fix mobile: disabilita tap handler di Leaflet (causa doppi click)
}).setView([45.65, 9.85], 8);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  maxZoom: 19,
}).addTo(map);

const cavesLayer   = L.layerGroup().addTo(map);
const featureGroup = new L.FeatureGroup().addTo(map);

// ── Stato draw ────────────────────────────────────────────────────────────────
let drawnLayer   = null;
let activeDrawer = null;

export function getDrawnLayer() { return drawnLayer; }
export function isDrawing()     { return activeDrawer !== null; }

/**
 * Avvia o ferma il disegno del poligono.
 */
export function toggleDraw(onDrawDone, onVertex) {
  if (activeDrawer) {
    activeDrawer.disable();
    activeDrawer = null;
    map.off('draw:drawvertex');
    map.off(L.Draw.Event.CREATED);
    return;
  }

  activeDrawer = new L.Draw.Polygon(map, {
    shapeOptions:       { color: '#E05020', fillOpacity: .08 },
    allowIntersection:  false,
    showArea:           false,
    touchIcon: new L.DivIcon({
      iconSize:  new L.Point(20, 20),
      className: 'leaflet-div-icon leaflet-editing-icon',
    }),
  });
  activeDrawer.enable();

  map.on('draw:drawvertex', () => {
    if (onVertex) onVertex();
  });

  map.once(L.Draw.Event.CREATED, e => {
    map.off('draw:drawvertex');
    activeDrawer = null;
    if (drawnLayer) featureGroup.removeLayer(drawnLayer);
    drawnLayer = e.layer;
    featureGroup.addLayer(drawnLayer);
    onDrawDone(drawnLayer.getLatLngs()[0].length);
  });
}

/** Annulla l'ultimo vertice durante il disegno. */
export function undoLastVertex() {
  if (!activeDrawer) return;
  try {
    if (typeof activeDrawer.deleteLastVertex === 'function') {
      activeDrawer.deleteLastVertex();
    } else {
      const ev = new KeyboardEvent('keydown', {
        key: 'Backspace', keyCode: 8, which: 8, bubbles: true, cancelable: true,
      });
      document.dispatchEvent(ev);
    }
  } catch (e) { console.warn('undo vertex:', e); }
}

/** Rimuove il poligono disegnato. */
export function clearArea() {
  if (drawnLayer) { featureGroup.removeLayer(drawnLayer); drawnLayer = null; }
}

// ── Rendering grotte ──────────────────────────────────────────────────────────
let _allCaves = [];
let _province = '';
let _openCaveDetails = null;

export function setProvince(p) { _province = p; }
export function setCaveDetailsHandler(handler) { _openCaveDetails = handler; }

export function setCaves(caves) {
  _allCaves = caves;
  renderCaves();
}

export function renderCaves() {
  cavesLayer.clearLayers();
  const filtered = filterCaves(_allCaves, _province, drawnLayer);
  const zoom     = map.getZoom();
  zoom >= 11 ? _renderIndividual(filtered) : _renderClustered(filtered, zoom);
}

function _renderIndividual(caves) {
  caves.forEach(c => {
    const m = L.circleMarker([c.lat, c.lon], {
      radius: 5, fillColor: BLU, color: BLU_S, weight: 1, fillOpacity: .85,
    });
    m.bindPopup(() => buildCavePopup(c));
    cavesLayer.addLayer(m);
  });
}

function buildCavePopup(cave) {
  const root = document.createElement('div');
  root.className = 'cave-popup';

  const title = document.createElement('strong');
  title.textContent = getCaveDisplayName(cave);
  root.appendChild(title);

  const facts = document.createElement('div');
  facts.className = 'cave-popup-facts';
  addPopupFact(facts, 'Quota', formatMetric(cave.elevation || cave.ele));
  addPopupFact(facts, 'Sviluppo', formatMetric(cave.development));
  addPopupFact(facts, 'Profondità', formatMetric(cave.depth));
  root.appendChild(facts);

  if (cave.thumbnailUrl) {
    const img = document.createElement('img');
    img.className = 'cave-popup-thumb';
    img.src = cave.thumbnailUrl;
    img.alt = `Foto di ${getCaveDisplayName(cave)}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    root.appendChild(img);
  }

  const actions = document.createElement('div');
  actions.className = 'cave-popup-actions';

  const details = document.createElement('button');
  details.type = 'button';
  details.className = 'btn-sm cave-popup-details';
  details.textContent = 'Dettagli';
  details.disabled = !_openCaveDetails;
  details.addEventListener('click', () => {
    map.closePopup();
    if (_openCaveDetails) _openCaveDetails(cave);
  });
  actions.appendChild(details);

  if (cave.directionsUrl || cave.vaiUrl) {
    const directions = document.createElement('a');
    directions.className = 'btn-sm cave-popup-link';
    directions.href = cave.directionsUrl || cave.vaiUrl;
    directions.target = '_blank';
    directions.rel = 'noopener noreferrer';
    directions.textContent = 'Vai a';
    actions.appendChild(directions);
  }

  root.appendChild(actions);
  return root;
}

function addPopupFact(root, label, value) {
  if (!value) return;
  const item = document.createElement('span');
  item.textContent = `${label}: ${value}`;
  root.appendChild(item);
}

function formatMetric(value) {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value).trim();
  if (!text) return '';
  return /[a-zà-ù%]/i.test(text) ? text : `${text} m`;
}

function _renderClustered(caves, zoom) {
  const cellSize = zoom < 8 ? 0.5 : 0.15;
  const cells    = {};
  caves.forEach(c => {
    const key = `${Math.round(c.lat / cellSize)},${Math.round(c.lon / cellSize)}`;
    if (!cells[key]) cells[key] = { n: 0, lat: 0, lon: 0 };
    cells[key].n++;
    cells[key].lat += c.lat;
    cells[key].lon += c.lon;
  });
  Object.values(cells).forEach(cell => {
    const lat = cell.lat / cell.n;
    const lon = cell.lon / cell.n;
    const r   = Math.min(24, Math.max(8, Math.log(cell.n + 1) * 5));
    const col = cell.n > 50 ? VERDE : BLU;
    L.circleMarker([lat, lon], {
      radius: r, fillColor: col, color: '#fff', weight: 1.5, fillOpacity: .85,
    }).bindTooltip(String(cell.n), {
      permanent: true, className: 'cluster-label', direction: 'center',
    }).addTo(cavesLayer);
  });
}

map.on('zoomend moveend', renderCaves);

// ── Highlight grotta cercata ──────────────────────────────────────────────────
let _highlightLayer = null;

export function highlightCave(cave) {
  if (_highlightLayer) { map.removeLayer(_highlightLayer); _highlightLayer = null; }
  _highlightLayer = L.circleMarker([cave.lat, cave.lon], {
    radius: 14, fillColor: '#E05020', color: '#A03010',
    weight: 3, fillOpacity: .35, className: 'cave-highlight',
  }).addTo(map);
  const title = document.createElement('strong');
  title.textContent = getCaveDisplayName(cave);
  _highlightLayer.bindPopup(title).openPopup();
  setTimeout(() => {
    if (_highlightLayer) { map.removeLayer(_highlightLayer); _highlightLayer = null; }
  }, 8000);
}

// ── Ricerca comune ────────────────────────────────────────────────────────────
export async function searchComune(query) {
  const url  = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query + ', Lombardia, Italia')}`;
  const res  = await fetch(url);
  const data = await res.json();
  if (data.length) {
    map.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 12);
    return true;
  }
  return false;
}
