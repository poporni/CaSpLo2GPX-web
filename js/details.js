/**
 * details.js
 * Scheda locale della grotta, renderizzata nel browser a partire dal KML.
 */

import { getCaveDisplayName, getCaveKey } from './cave.js';

let elOverlay = null;
let elPanel = null;
let elContent = null;
let elClose = null;
let lastFocused = null;
let caves = [];
let onFocusCave = null;
let initialized = false;
let currentCave = null;

export function initCaveDetails(options = {}) {
  if (initialized) return;
  initialized = true;
  caves = options.caves || [];
  onFocusCave = options.onFocusCave || null;

  elOverlay = document.getElementById('cave-details-overlay');
  elPanel = document.getElementById('cave-details-panel');
  elContent = document.getElementById('cave-details-content');
  elClose = document.getElementById('cave-details-close');

  if (!elOverlay || !elPanel || !elContent || !elClose) {
    console.warn('Dettagli grotta: markup non trovato');
    return;
  }

  elClose.addEventListener('click', () => closeCaveDetails());
  elOverlay.addEventListener('click', e => {
    if (e.target === elOverlay) closeCaveDetails();
  });
  document.addEventListener('keydown', onDocumentKeydown);
  window.addEventListener('popstate', openCaveFromLocation);
}

export function setCaveDetailsCaves(nextCaves) {
  caves = nextCaves || [];
  openCaveFromLocation();
}

export function openCaveDetails(cave, options = {}) {
  if (!cave || !elOverlay || !elPanel || !elContent) return;
  currentCave = cave;
  lastFocused = document.activeElement;
  renderCave(cave);
  elOverlay.classList.add('open');
  elOverlay.setAttribute('aria-hidden', 'false');
  document.body.classList.add('details-open');

  if (options.updateUrl !== false) {
    pushCaveUrl(cave);
  }
  if (options.focusMap && onFocusCave) {
    onFocusCave(cave);
  }

  requestAnimationFrame(() => {
    const first = elPanel.querySelector('button, a, [tabindex]:not([tabindex="-1"])');
    first?.focus();
  });
}

export function closeCaveDetails(options = {}) {
  if (!elOverlay) return;
  currentCave = null;
  elOverlay.classList.remove('open');
  elOverlay.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('details-open');
  if (options.updateUrl !== false) clearCaveUrl();
  lastFocused?.focus();
}

function renderCave(cave) {
  const titleText = getCaveDisplayName(cave);

  const header = document.createElement('div');
  header.className = 'cave-details-header';

  if (cave.code) {
    const code = document.createElement('div');
    code.className = 'cave-details-code';
    code.textContent = cave.code;
    header.appendChild(code);
  }

  const title = document.createElement('h2');
  title.id = 'cave-details-title';
  title.textContent = cave.name || titleText;
  header.appendChild(title);

  if (cave.synonyms) {
    const synonyms = document.createElement('p');
    synonyms.className = 'cave-details-synonyms';
    synonyms.textContent = cave.synonyms;
    header.appendChild(synonyms);
  }

  const media = document.createElement('section');
  media.className = 'cave-details-media';
  media.setAttribute('aria-label', 'Foto');
  if (cave.thumbnailUrl) {
    const link = document.createElement('a');
    link.href = cave.thumbnailUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const img = document.createElement('img');
    img.src = cave.thumbnailUrl;
    img.alt = `Foto di ${titleText}`;
    img.loading = 'lazy';
    img.decoding = 'async';
    link.appendChild(img);
    media.appendChild(link);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'cave-details-placeholder';
    placeholder.textContent = 'Nessuna foto disponibile';
    media.appendChild(placeholder);
  }

  const facts = document.createElement('dl');
  facts.className = 'cave-details-facts';
  addFact(facts, 'Quota', formatMetric(cave.elevation || cave.ele));
  addFact(facts, 'Sviluppo', formatMetric(cave.development));
  addFact(facts, 'Profondità', formatMetric(cave.depth));
  addFact(facts, 'Coordinate', `${cave.lat.toFixed(6)}, ${cave.lon.toFixed(6)}`);
  addFact(facts, 'ID OpenKIS', cave.sourceId);

  const actions = document.createElement('div');
  actions.className = 'cave-details-actions';
  if (cave.directionsUrl || cave.vaiUrl) {
    actions.appendChild(buildLinkButton(cave.directionsUrl || cave.vaiUrl, 'Vai a'));
  }
  actions.appendChild(buildCopyButton('Copia coordinate', `${cave.lat.toFixed(6)}, ${cave.lon.toFixed(6)}`));
  actions.appendChild(buildCopyButton('Condividi link', buildShareUrl(cave)));

  const source = document.createElement('section');
  source.className = 'cave-details-source';
  const sourceTitle = document.createElement('h3');
  sourceTitle.textContent = 'Fonte';
  const sourceText = document.createElement('p');
  sourceText.textContent = 'Dati pubblicati nel KML del Catasto Speleologico Lombardo. La scheda ufficiale potrebbe richiedere autorizzazione.';
  source.appendChild(sourceTitle);
  source.appendChild(sourceText);
  if (cave.sourceUrl || cave.apriUrl) {
    source.appendChild(buildPlainLink(cave.sourceUrl || cave.apriUrl, 'Portale ufficiale'));
  }

  elContent.replaceChildren(header, media, facts, actions, source);
}

function addFact(root, label, value) {
  if (!value) return;
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  root.append(dt, dd);
}

function buildLinkButton(href, label) {
  const link = document.createElement('a');
  link.className = 'btn-sm cave-details-action';
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;
  return link;
}

function buildPlainLink(href, label) {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = label;
  return link;
}

function buildCopyButton(label, text) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn-sm cave-details-action';
  button.textContent = label;
  button.addEventListener('click', async () => {
    const ok = await copyText(text);
    const original = button.textContent;
    button.textContent = ok ? 'Copiato' : 'Non copiato';
    setTimeout(() => { button.textContent = original; }, 1400);
  });
  return button;
}

async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}

  const input = document.createElement('textarea');
  input.value = text;
  input.setAttribute('readonly', '');
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  document.body.appendChild(input);
  input.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch (_) {
    ok = false;
  }
  document.body.removeChild(input);
  return ok;
}

function formatMetric(value) {
  if (value === null || value === undefined || value === '') return '';
  const text = String(value).trim();
  if (!text) return '';
  return /[a-zà-ù%]/i.test(text) ? text : `${text} m`;
}

function buildShareUrl(cave) {
  const url = new URL(window.location.href);
  const key = getCaveKey(cave);
  if (key) url.searchParams.set('cave', key);
  return url.href;
}

function pushCaveUrl(cave) {
  const url = new URL(window.location.href);
  const key = getCaveKey(cave);
  if (!key || url.searchParams.get('cave') === key) return;
  url.searchParams.set('cave', key);
  window.history.pushState({ cave: key }, '', url);
}

function clearCaveUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('cave')) return;
  url.searchParams.delete('cave');
  window.history.pushState({}, '', url);
}

function openCaveFromLocation() {
  const key = new URL(window.location.href).searchParams.get('cave');
  if (!key) {
    if (currentCave) closeCaveDetails({ updateUrl: false });
    return;
  }

  const cave = findCaveByKey(key);
  if (cave) openCaveDetails(cave, { updateUrl: false, focusMap: true });
}

function findCaveByKey(key) {
  const normalized = normalizeKey(key);
  return caves.find(cave =>
    normalizeKey(cave.sourceId) === normalized ||
    normalizeKey(cave.code) === normalized ||
    normalizeKey(cave.rawName) === normalized ||
    normalizeKey(cave.name) === normalized
  );
}

function normalizeKey(value) {
  return String(value || '').trim().toLowerCase();
}

function onDocumentKeydown(e) {
  if (!currentCave || !elPanel) return;

  if (e.key === 'Escape') {
    closeCaveDetails();
    return;
  }

  if (e.key !== 'Tab') return;
  const focusable = Array.from(elPanel.querySelectorAll(
    'a, button, input, textarea, select, [tabindex]:not([tabindex="-1"])'
  )).filter(el => !el.disabled && el.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}
