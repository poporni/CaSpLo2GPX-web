#!/usr/bin/env node
/**
 * Backup archivistico degli endpoint pubblici OpenKIS usati da CaSpLo2GPX-web.
 *
 * Non accede a pagine protette e non aggira controlli: salva solo KML/JSON
 * pubblici e immagini raggiungibili senza autenticazione.
 */

import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { parseKml } from '../js/parser.js';

export const KML_URL = 'https://www.speleolombardia.it/catasto/openkis_kml.php?mod=caves&lat=45,8&lon=9.5&zoom=8&iconsize=1.5';
export const JSON_URL = 'https://www.speleolombardia.it/catasto/openkis_json.php?mod=caves&lat=45,8&lon=9.5&zoom=8&iconsize=1.5';

const BACKUP_FORMAT_VERSION = 1;
const DEFAULT_DELAY_MS = 250;
const USER_AGENT = 'CaSpLo2GPX-web archival backup script (+https://github.com/poporni/CaSpLo2GPX-web)';

function usage() {
  return `Uso:
  node scripts/backup-openkis.js [opzioni]

Opzioni:
  --out <dir>            Directory output (default: backups/openkis-<timestamp>)
  --include-images       Scarica una immagine per grotta: originale se disponibile, altrimenti thumbnail
  --delay-ms <n>         Pausa tra download immagini, default ${DEFAULT_DELAY_MS} ms
  --limit <n>            Limita le grotte processate, utile per test
  --no-json              Non scarica l'endpoint JSON pubblico aggiuntivo
  --force                Riscarica immagini anche se il file locale esiste
  --help                 Mostra questo aiuto

Output:
  manifest.json
  README.md
  raw/openkis_caves.kml
  raw/openkis_caves.json
  data/caves.json
  data/caves.geojson
  data/caves.csv
  data/media-index.json
  media/images/...       Solo con --include-images
`;
}

function parseArgs(argv) {
  const opts = {
    outDir: '',
    includeImages: false,
    delayMs: DEFAULT_DELAY_MS,
    limit: 0,
    fetchJson: true,
    force: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') opts.help = true;
    else if (arg === '--include-images') opts.includeImages = true;
    else if (arg === '--force') opts.force = true;
    else if (arg === '--no-json') opts.fetchJson = false;
    else if (arg === '--out') opts.outDir = argv[++i] || '';
    else if (arg === '--delay-ms') opts.delayMs = parseInteger(argv[++i], 'delay-ms');
    else if (arg === '--limit') opts.limit = parseInteger(argv[++i], 'limit');
    else throw new Error(`Opzione non riconosciuta: ${arg}`);
  }

  if (opts.delayMs < 0) throw new Error('--delay-ms deve essere >= 0');
  if (opts.limit < 0) throw new Error('--limit deve essere >= 0');
  return opts;
}

function parseInteger(value, label) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) throw new Error(`Valore non valido per --${label}: ${value}`);
  return n;
}

async function ensureDomParser() {
  if (globalThis.DOMParser) return;
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  globalThis.DOMParser = dom.window.DOMParser;
}

function timestampForPath(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

function defaultOutDir() {
  return path.join('backups', `openkis-${timestampForPath()}`);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/xml, application/json, text/plain, */*',
      'Referer': 'https://www.speleolombardia.it/',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} scaricando ${url}`);
  return {
    text: await res.text(),
    headers: headersToObject(res.headers),
    url: res.url,
  };
}

function headersToObject(headers) {
  return Object.fromEntries(Array.from(headers.entries()).sort(([a], [b]) => a.localeCompare(b)));
}

export function buildImageCandidates(cave) {
  const candidates = [];
  if (cave.photoUrl) candidates.push({ kind: 'original', url: cave.photoUrl });
  if (cave.thumbnailUrl && cave.thumbnailUrl !== cave.photoUrl) {
    candidates.push({ kind: 'thumbnail', url: cave.thumbnailUrl });
  }
  return candidates;
}

export function parseOpenKisJson(text) {
  if (!text) return [];
  const parsed = JSON.parse(text);
  return Array.isArray(parsed?.items) ? parsed.items : [];
}

export function mergeOpenKisJson(caves, items) {
  if (!items.length) return caves;
  const byId = new Map();
  const byCode = new Map();

  items.forEach(item => {
    if (item.id) byId.set(String(item.id), item);
    if (item.code) byCode.set(String(item.code), item);
  });

  return caves.map(cave => {
    const item = byId.get(String(cave.sourceId)) || byCode.get(String(cave.code));
    if (!item) return cave;
    return {
      ...cave,
      region: item.regione || '',
      province: item.provincia || '',
      municipality: item.comune || '',
      areas: item.areas || '',
      closed: item.closed || '',
      meteorology: item.meteorology || '',
      fauna: item.fauna || '',
      depthTotal: item.depth_total || '',
      depthNegative: item.depth_negative || '',
      depthPositive: item.depth_positive || '',
      lengthTotal: item.lenght_total || item.length_total || '',
      openkis: item,
    };
  });
}

function mediaDirectoryName(cave, index) {
  const key = cave.sourceId || cave.code || String(index + 1);
  const label = cave.code || cave.name || 'grotta';
  return safePathSegment(`${key}-${label}`).slice(0, 96) || String(index + 1);
}

export function safePathSegment(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[/\\<>:"|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '_');
}

function filenameFromUrl(url, fallback = 'image') {
  try {
    const pathname = new URL(url).pathname;
    const decoded = decodeURIComponent(pathname.split('/').pop() || fallback);
    const filename = safePathSegment(decoded);
    return filename || fallback;
  } catch (_) {
    return fallback;
  }
}

function localImagePath(cave, index, candidate) {
  const folder = mediaDirectoryName(cave, index);
  const filename = filenameFromUrl(candidate.url, `${candidate.kind}.jpg`);
  return path.join('media', 'images', folder, filename);
}

async function downloadBestImage(cave, index, outDir, opts) {
  const attempts = [];
  for (const candidate of buildImageCandidates(cave)) {
    const relativePath = localImagePath(cave, index, candidate);
    const absolutePath = path.join(outDir, relativePath);
    const result = await downloadImage(candidate.url, absolutePath, opts);
    attempts.push({ ...candidate, ...result, localPath: relativePath });
    if (result.status === 'downloaded' || result.status === 'exists') {
      return {
        selected: { ...candidate, ...result, localPath: relativePath },
        attempts,
      };
    }
    await sleep(opts.delayMs);
  }

  return { selected: null, attempts };
}

async function downloadImage(url, absolutePath, opts) {
  if (!opts.force) {
    const existing = await fileInfo(absolutePath);
    if (existing) return { status: 'exists', ...existing };
  }

  await mkdir(path.dirname(absolutePath), { recursive: true });
  const tempPath = `${absolutePath}.tmp`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'image/*,*/*',
        'Referer': 'https://www.speleolombardia.it/',
      },
    });
    if (!res.ok) {
      await removeIfExists(tempPath);
      return { status: 'failed', httpStatus: res.status, error: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      await removeIfExists(tempPath);
      return { status: 'failed', httpStatus: res.status, error: `Content-Type non immagine: ${contentType}` };
    }

    await pipeline(res.body, createWriteStream(tempPath));
    await rename(tempPath, absolutePath);
    return { status: 'downloaded', contentType, ...(await fileInfo(absolutePath)) };
  } catch (e) {
    await removeIfExists(tempPath);
    return { status: 'failed', error: e?.message || String(e) };
  }
}

async function fileInfo(absolutePath) {
  try {
    const st = await stat(absolutePath);
    const buf = await readFile(absolutePath);
    return {
      bytes: st.size,
      sha256: createHash('sha256').update(buf).digest('hex'),
    };
  } catch (_) {
    return null;
  }
}

async function removeIfExists(filePath) {
  try {
    await unlink(filePath);
  } catch (_) {}
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function buildGeoJson(caves) {
  return {
    type: 'FeatureCollection',
    features: caves.map(cave => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [cave.lon, cave.lat, cave.ele || 0],
      },
      properties: {
        name: cave.name,
        rawName: cave.rawName,
        code: cave.code,
        sourceId: cave.sourceId,
        elevation: cave.elevation,
        development: cave.development,
        depth: cave.depth,
        synonyms: cave.synonyms,
        plain: cave.plain,
        sourceUrl: cave.sourceUrl,
        directionsUrl: cave.directionsUrl,
        thumbnailUrl: cave.thumbnailUrl,
        photoUrl: cave.photoUrl,
        region: cave.region || '',
        province: cave.province || '',
        municipality: cave.municipality || '',
        areas: cave.areas || '',
        closed: cave.closed || '',
        meteorology: cave.meteorology || '',
        fauna: cave.fauna || '',
        depthTotal: cave.depthTotal || '',
        depthNegative: cave.depthNegative || '',
        depthPositive: cave.depthPositive || '',
        lengthTotal: cave.lengthTotal || '',
        mediaLocalPath: cave.media?.selected?.localPath || '',
        mediaKind: cave.media?.selected?.kind || '',
      },
    })),
  };
}

export function buildCsv(caves) {
  const columns = [
    'code',
    'name',
    'rawName',
    'sourceId',
    'lat',
    'lon',
    'ele',
    'elevation',
    'development',
    'depth',
    'synonyms',
    'plain',
    'sourceUrl',
    'directionsUrl',
    'thumbnailUrl',
    'photoUrl',
    'region',
    'province',
    'municipality',
    'areas',
    'closed',
    'meteorology',
    'fauna',
    'depthTotal',
    'depthNegative',
    'depthPositive',
    'lengthTotal',
    'mediaLocalPath',
    'mediaKind',
  ];

  const rows = caves.map(cave => columns.map(column => {
    if (column === 'mediaLocalPath') return cave.media?.selected?.localPath || '';
    if (column === 'mediaKind') return cave.media?.selected?.kind || '';
    return cave[column] ?? '';
  }));

  return [
    columns.join(','),
    ...rows.map(row => row.map(csvCell).join(',')),
  ].join('\n') + '\n';
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildArchiveReadme(manifest) {
  return `# Backup Catasto Speleologico Lombardo

Creato: ${manifest.createdAt}

Questo archivio contiene una copia dei dati pubblicamente esposti dagli endpoint OpenKIS usati da CaSpLo2GPX-web.
Non include pagine protette, allegati non pubblici o informazioni che richiedono autenticazione.

## Contenuto

- \`raw/openkis_caves.kml\`: KML pubblico grezzo
- \`raw/openkis_caves.json\`: JSON pubblico grezzo, se scaricato
- \`data/caves.json\`: dati normalizzati per ripristino locale
- \`data/caves.geojson\`: punti geografici GeoJSON
- \`data/caves.csv\`: tabella CSV
- \`data/media-index.json\`: esito download immagini
- \`media/images/\`: immagini scaricate, se richieste

## Ripristino locale

Per ricostruire un'app o un database locale, usa \`data/caves.json\` come sorgente principale.
Ogni grotta conserva gli URL originali e, quando disponibile, il percorso locale dell'immagine scelta in \`media.selected.localPath\`.
Quando l'endpoint JSON pubblico e disponibile, i campi originali sono preservati in \`openkis\`.

## Licenza dati

Fonte dati: Catasto Speleologico Lombardo.
Licenza indicata dal progetto CaSpLo2GPX-web: CC BY-NC-ND 3.0 IT.
`;
}

function summarizeMedia(mediaIndex) {
  const summary = {
    cavesWithMedia: 0,
    downloaded: 0,
    exists: 0,
    failed: 0,
    original: 0,
    thumbnail: 0,
    bytes: 0,
  };

  mediaIndex.forEach(item => {
    if (item.selected) {
      summary.cavesWithMedia++;
      summary[item.selected.kind]++;
      summary.bytes += item.selected.bytes || 0;
    }
    item.attempts.forEach(attempt => {
      if (attempt.status === 'downloaded') summary.downloaded++;
      else if (attempt.status === 'exists') summary.exists++;
      else if (attempt.status === 'failed') summary.failed++;
    });
  });

  return summary;
}

async function writeJson(filePath, data) {
  await writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export async function runBackup(rawOpts = {}) {
  await ensureDomParser();

  const opts = {
    outDir: rawOpts.outDir || defaultOutDir(),
    includeImages: !!rawOpts.includeImages,
    delayMs: rawOpts.delayMs ?? DEFAULT_DELAY_MS,
    limit: rawOpts.limit || 0,
    fetchJson: rawOpts.fetchJson !== false,
    force: !!rawOpts.force,
  };

  const outDir = path.resolve(opts.outDir);
  const rawDir = path.join(outDir, 'raw');
  const dataDir = path.join(outDir, 'data');
  await mkdir(rawDir, { recursive: true });
  await mkdir(dataDir, { recursive: true });

  console.log(`Backup OpenKIS in ${outDir}`);
  console.log('Scarico KML pubblico...');
  const kml = await fetchText(KML_URL);
  if (!kml.text.includes('<kml')) throw new Error('La risposta KML non contiene <kml>');
  await writeFile(path.join(rawDir, 'openkis_caves.kml'), kml.text, 'utf8');

  let rawJson = null;
  if (opts.fetchJson) {
    try {
      console.log('Scarico JSON pubblico aggiuntivo...');
      rawJson = await fetchText(JSON_URL);
      await writeFile(path.join(rawDir, 'openkis_caves.json'), rawJson.text, 'utf8');
    } catch (e) {
      console.warn(`JSON pubblico non salvato: ${e?.message || e}`);
    }
  }

  let caves = parseKml(kml.text, () => {});
  let jsonItems = [];
  if (rawJson) {
    try {
      jsonItems = parseOpenKisJson(rawJson.text);
      caves = mergeOpenKisJson(caves, jsonItems);
    } catch (e) {
      console.warn(`JSON pubblico non integrato: ${e?.message || e}`);
    }
  }
  if (opts.limit) caves = caves.slice(0, opts.limit);
  console.log(`${caves.length} grotte normalizzate`);

  const mediaIndex = [];
  if (opts.includeImages) {
    console.log(`Scarico immagini migliori disponibili con delay ${opts.delayMs} ms...`);
    for (let i = 0; i < caves.length; i++) {
      const cave = caves[i];
      const media = await downloadBestImage(cave, i, outDir, opts);
      cave.media = media;
      mediaIndex.push({
        code: cave.code,
        sourceId: cave.sourceId,
        name: cave.name,
        selected: media.selected,
        attempts: media.attempts,
      });
      if ((i + 1) % 100 === 0 || i + 1 === caves.length) {
        console.log(`  immagini: ${i + 1}/${caves.length}`);
      }
      await sleep(opts.delayMs);
    }
  }

  await writeJson(path.join(dataDir, 'caves.json'), caves);
  await writeJson(path.join(dataDir, 'caves.geojson'), buildGeoJson(caves));
  await writeFile(path.join(dataDir, 'caves.csv'), buildCsv(caves), 'utf8');
  await writeJson(path.join(dataDir, 'media-index.json'), mediaIndex);

  const manifest = {
    backupFormatVersion: BACKUP_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    source: {
      kmlUrl: KML_URL,
      jsonUrl: opts.fetchJson ? JSON_URL : '',
      kmlResponseUrl: kml.url,
      jsonResponseUrl: rawJson?.url || '',
      kmlHeaders: kml.headers,
      jsonHeaders: rawJson?.headers || {},
    },
    options: {
      includeImages: opts.includeImages,
      delayMs: opts.delayMs,
      limit: opts.limit,
      fetchJson: opts.fetchJson,
      force: opts.force,
    },
    counts: {
      caves: caves.length,
      cavesWithThumbnailUrl: caves.filter(c => c.thumbnailUrl).length,
      cavesWithDerivedPhotoUrl: caves.filter(c => c.photoUrl).length,
      openKisJsonItems: jsonItems.length,
      cavesWithOpenKisJson: caves.filter(c => c.openkis).length,
    },
    media: summarizeMedia(mediaIndex),
    files: {
      rawKml: 'raw/openkis_caves.kml',
      rawJson: rawJson ? 'raw/openkis_caves.json' : '',
      cavesJson: 'data/caves.json',
      cavesGeoJson: 'data/caves.geojson',
      cavesCsv: 'data/caves.csv',
      mediaIndex: 'data/media-index.json',
    },
    limitations: [
      'Backup dei soli endpoint e file pubblicamente raggiungibili senza autenticazione.',
      'Non include dati eventualmente presenti solo in viste protette del portale ufficiale.',
      'Le immagini originali vengono tentate solo quando il percorso e deducibile dalla convenzione OpenKIS photo1/thumbs.',
    ],
  };
  await writeJson(path.join(outDir, 'manifest.json'), manifest);
  await writeFile(path.join(outDir, 'README.md'), buildArchiveReadme(manifest), 'utf8');

  console.log('Backup completato.');
  console.log(`Manifest: ${path.join(outDir, 'manifest.json')}`);
  return { outDir, manifest };
}

const isCli = process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCli) {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) {
      console.log(usage());
      process.exit(0);
    }
    await runBackup(opts);
  } catch (e) {
    console.error(e?.message || e);
    console.error('');
    console.error(usage());
    process.exit(1);
  }
}
