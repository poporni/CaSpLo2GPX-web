/**
 * geometry.js
 * Filtri geografici: provincia (bbox) e area poligono (ray-casting).
 */

/** Bounding box delle province lombarde (lat_min, lon_min, lat_max, lon_max) */
export const PROV_BBOX = {
  'Bergamo': [45.40, 9.40, 46.10, 10.30],
  'Brescia': [45.10, 9.90, 46.20, 10.80],
  'Como':    [45.60, 8.90, 46.20,  9.50],
  'Lecco':   [45.60, 9.20, 46.20,  9.60],
  'Pavia':   [44.60, 8.70, 45.40,  9.50],
  'Sondrio': [46.00, 9.20, 46.70, 10.70],
  'Varese':  [45.60, 8.50, 46.00,  9.00],
};

/**
 * Filtra le grotte per bounding box provincia.
 * @param {Cave[]} caves
 * @param {string} province - nome provincia o stringa vuota
 * @returns {Cave[]}
 */
export function filterByProvince(caves, province) {
  if (!province || !PROV_BBOX[province]) return caves;
  const [latMin, lonMin, latMax, lonMax] = PROV_BBOX[province];
  return caves.filter(c =>
    c.lat >= latMin && c.lat <= latMax &&
    c.lon >= lonMin && c.lon <= lonMax
  );
}

/**
 * Ray-casting point-in-polygon.
 * @param {number[]} point - [lon, lat]
 * @param {number[][]} polygon - array di [lon, lat]
 * @returns {boolean}
 */
export function pointInPolygon(point, polygon) {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (((yi > y) !== (yj > y)) &&
        (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

/**
 * Filtra le grotte per area poligono Leaflet.
 * @param {Cave[]} caves
 * @param {L.Polygon|null} drawnLayer
 * @returns {Cave[]}
 */
export function filterByArea(caves, drawnLayer) {
  if (!drawnLayer) return caves;
  const coords = drawnLayer.toGeoJSON().geometry.coordinates[0];
  return caves.filter(c => pointInPolygon([c.lon, c.lat], coords));
}

/**
 * Applica tutti i filtri attivi.
 * @param {Cave[]} caves
 * @param {string} province
 * @param {L.Polygon|null} drawnLayer
 * @returns {Cave[]}
 */
export function filterCaves(caves, province, drawnLayer) {
  return filterByArea(filterByProvince(caves, province), drawnLayer);
}
