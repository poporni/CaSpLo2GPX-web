/**
 * app.js
 * Controller principale. Tutti i binding DOM sono gestiti qui.
 * I moduli ES6 sono sempre deferred: il DOM è pronto quando questo codice gira.
 */

import { fetchKml }                       from './downloader.js';
import { parseKml }                       from './parser.js';
import { filterCaves }                    from './geometry.js';
import { generateGpx, downloadGpx,
         buildFilename }                  from './exporter.js';
import { map, setCaves, setProvince,
         renderCaves, toggleDraw,
         isDrawing, undoLastVertex,
         clearArea, getDrawnLayer,
         searchComune, highlightCave }    from './map.js';

// ── State ─────────────────────────────────────────────────────────────────────
const State = {
  allCaves:  [],
  isLoading: false,
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const elLog         = document.getElementById('log');
const elProgress    = document.getElementById('progress-wrap');
const elFill        = document.getElementById('progress-fill');
const elLabel       = document.getElementById('progress-label');
const elBtnExport   = document.getElementById('btn-export');
const elBtnDraw     = document.getElementById('btn-draw');
const elBtnUndo     = document.getElementById('btn-undo');
const elBtnClear    = document.getElementById('btn-clear-area');
const elAreaInfo    = document.getElementById('area-info');
const elProvincia   = document.getElementById('provincia');
const elSearch      = document.getElementById('search-input');
const elBtnSearch   = document.getElementById('btn-search');
const elCaveSearch  = document.getElementById('cave-search-input');
const elBtnCaveSrch = document.getElementById('btn-cave-search');
const elCaveResults = document.getElementById('cave-search-results');
const elFilename    = document.getElementById('filename');
const elFooterDate  = document.getElementById('footer-catasto-date');
const elModal       = document.getElementById('modal');
const elHamburger   = document.getElementById('hamburger');
const elOverlay     = document.getElementById('panel-overlay');
const elPanel       = document.querySelector('.panel');
const elBtnInfo     = document.getElementById('btn-info');
const elModalClose  = document.querySelector('.modal-close');

// Fix 3: nascondi undo all'avvio
if (elBtnUndo) elBtnUndo.style.display = 'none';

// ── Verifica DOM ──────────────────────────────────────────────────────────────
// Log di debug: verifica che i bottoni siano stati trovati
const domCheck = {
  'btn-search':      elBtnSearch,
  'btn-cave-search': elBtnCaveSrch,
  'btn-draw':        elBtnDraw,
  'btn-undo':        elBtnUndo,
  'btn-export':      elBtnExport,
};
Object.entries(domCheck).forEach(([id, el]) => {
  if (!el) console.warn(`⚠ elemento non trovato: #${id}`);
});

// ── Log ───────────────────────────────────────────────────────────────────────
function log(msg) {
  elLog.textContent += msg + '\n';
  elLog.scrollTop = elLog.scrollHeight;
}
function setProgress(pct, label) {
  elProgress.classList.add('visible');
  elFill.style.width  = pct + '%';
  elLabel.textContent = label;
}
function hideProgress() { elProgress.classList.remove('visible'); }

// ── Footer data aggiornamento ─────────────────────────────────────────────────
function setFooterDate(lastModified) {
  if (!lastModified) return;
  try {
    const d  = new Date(lastModified);
    const ts = d.toLocaleDateString('it-IT') + ' ' +
               d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const label = `Catasto aggiornato: ${ts}`;
    // Desktop: footer
    if (elFooterDate) elFooterDate.textContent = label;
    // Mobile: nel modal "Origine dati"
    const elModalDate = document.getElementById('modal-catasto-date');
    if (elModalDate) elModalDate.textContent = label;
  } catch (_) {}
}

// ── Hamburger mobile ──────────────────────────────────────────────────────────
function openPanel() {
  elPanel?.classList.add('open');
  elOverlay?.classList.add('open');
  elHamburger?.classList.add('open');
}
function closePanel() {
  elPanel?.classList.remove('open');
  elOverlay?.classList.remove('open');
  elHamburger?.classList.remove('open');
}
function togglePanel() {
  elPanel?.classList.contains('open') ? closePanel() : openPanel();
}

elHamburger?.addEventListener('click', togglePanel);
elOverlay?.addEventListener('click', e => {
  if (e.target === elOverlay) closePanel();
});
elOverlay?.addEventListener('touchstart', e => {
  if (e.target === elOverlay) closePanel();
}, { passive: true });

// ── Modal con focus trap ─────────────────────────────────────────────────────
let lastFocused = null;

function trapFocus(modal) {
  const focusable = modal.querySelectorAll(
    'a, button, input, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusable[0];
  const last  = focusable[focusable.length - 1];
  function onKey(e) {
    if (e.key === 'Tab') {
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    }
    if (e.key === 'Escape') closeModal();
  }
  modal.addEventListener('keydown', onKey);
  return () => modal.removeEventListener('keydown', onKey);
}

function openModal() {
  lastFocused = document.activeElement;
  elModal?.classList.add('open');
  const release = trapFocus(elModal);
  elModal._releaseTrap = release;
  requestAnimationFrame(() => {
    const first = elModal?.querySelector('button, [tabindex]:not([tabindex="-1"])');
    first?.focus();
  });
}

function closeModal() {
  if (elModal?._releaseTrap) { elModal._releaseTrap(); delete elModal._releaseTrap; }
  elModal?.classList.remove('open');
  lastFocused?.focus();
}

elBtnInfo?.addEventListener('click', openModal);
elModalClose?.addEventListener('click', closeModal);
elModal?.addEventListener('click', e => { if (e.target === elModal) closeModal(); });

// ── Provincia ─────────────────────────────────────────────────────────────────
elProvincia?.addEventListener('change', () => {
  setProvince(elProvincia.value);
  if (State.allCaves.length) renderCaves();
});

// ── Esporta GPX ───────────────────────────────────────────────────────────────
elBtnExport?.addEventListener('click', () => {
  if (!State.allCaves.length) return;
  const province   = elProvincia.value;
  const drawnLayer = getDrawnLayer();
  const filtered   = filterCaves(State.allCaves, province, drawnLayer);
  if (!filtered.length) { log('⚠  Nessuna grotta nei filtri selezionati.'); return; }
  log(`↻  Generazione GPX (${filtered.length} grotte)…`);
  const gpx      = generateGpx(filtered);
  const filename = elFilename.value.trim() || buildFilename(province, !!drawnLayer);
  downloadGpx(gpx, filename);
  log(`✓  File scaricato: ${filename}`);
});

// ── Ricerca comune ────────────────────────────────────────────────────────────
async function onSearch() {
  const q = elSearch?.value.trim();
  if (!q) return;
  const found = await searchComune(q);
  if (!found) log(`⚠  Comune non trovato: ${q}`);
}

elBtnSearch?.addEventListener('click', onSearch);
elSearch?.addEventListener('keydown', e => { if (e.key === 'Enter') onSearch(); });

// ── Ricerca grotta ────────────────────────────────────────────────────────────
function onCaveSearch() {
  const q = elCaveSearch?.value.trim().toLowerCase();
  if (!elCaveResults) return;
  elCaveResults.innerHTML = '';
  elCaveResults.classList.remove('visible');
  if (!q || !State.allCaves.length) return;

  const matches = State.allCaves
    .filter(c => c.name.toLowerCase().includes(q))
    .slice(0, 20);

  if (!matches.length) {
    elCaveResults.innerHTML = '<div class="cave-result-none">Nessuna grotta trovata</div>';
    elCaveResults.classList.add('visible');
    return;
  }

  matches.forEach(c => {
    const div = document.createElement('div');
    div.className   = 'cave-result-item';
    div.textContent = c.name;
    div.addEventListener('click', () => {
      map.setView([c.lat, c.lon], 14);
      elCaveResults.classList.remove('visible');
      if (elCaveSearch) elCaveSearch.value = c.name;
      highlightCave(c);
      closePanel();   // Fix 1: chiudi hamburger su mobile dopo selezione
    });
    elCaveResults.appendChild(div);
  });
  elCaveResults.classList.add('visible');
}

// Binding ricerca grotta — sia click che touchend per mobile
elBtnCaveSrch?.addEventListener('click',    onCaveSearch);
elBtnCaveSrch?.addEventListener('touchend', e => { e.preventDefault(); onCaveSearch(); });
elCaveSearch?.addEventListener('keydown',   e => { if (e.key === 'Enter') onCaveSearch(); });

document.addEventListener('click', e => {
  if (!elCaveSearch?.contains(e.target) && !elCaveResults?.contains(e.target))
    elCaveResults?.classList.remove('visible');
});

// ── Disegna area ──────────────────────────────────────────────────────────────
function updateDrawBtn() {
  if (!elBtnDraw) return;
  const drawing = isDrawing();
  elBtnDraw.textContent = drawing ? '⏹ Stop' : '✏ Disegna';
  elBtnDraw.classList.toggle('active', !drawing);
}

elBtnDraw?.addEventListener('click', () => {
  if (isDrawing()) {
    // Stop: ferma il drawer
    toggleDraw(() => {}, () => {});
    updateDrawBtn();
    elBtnUndo.disabled      = true;
    elBtnUndo.style.display = 'none';
    return;
  }

  // Fix 4: chiudi hamburger su mobile quando si avvia il disegno
  closePanel();

  // Mostra undo (era nascosto), disabilitato finché non c'è almeno un vertice
  elBtnUndo.style.display = 'inline-block';
  elBtnUndo.disabled      = true;
  updateDrawBtn();

  const onVertex = () => {
    elBtnUndo.disabled = false;
  };

  const onDrawDone = n => {
    updateDrawBtn();
    elAreaInfo.textContent = `Poligono con ${n} vertici`;
    elAreaInfo.classList.add('active');
    elBtnClear.style.display = '';
    elBtnUndo.disabled       = true;
    elBtnUndo.style.display  = 'none';
    renderCaves();
  };

  toggleDraw(onDrawDone, onVertex);
});

elBtnUndo?.addEventListener('click', undoLastVertex);
elBtnUndo?.addEventListener('touchend', e => { e.preventDefault(); undoLastVertex(); });

elBtnClear?.addEventListener('click', () => {
  clearArea();
  elAreaInfo.textContent = 'Nessuna area selezionata';
  elAreaInfo.classList.remove('active');
  elBtnClear.style.display = 'none';
  elBtnUndo.disabled       = true;
  if (State.allCaves.length) renderCaves();
});

// ── Avvio automatico ──────────────────────────────────────────────────────────
async function init() {
  log('CaSpLo2GPX web 1.0.1');
  log('Scarica e converte il Catasto Speleologico Lombardo in GPX');
  log('');
  log('⬇  Download KML in corso…');

  State.isLoading      = true;
  elBtnExport.disabled = true;

  try {
    const { text: kmlText, fromCache, lastModified } = await fetchKml(
      (pct, label) => setProgress(pct, label)
    );
    log(fromCache ? '✓  KML letto dalla cache Cloudflare' : '✓  KML scaricato');

    State.allCaves = parseKml(kmlText, (pct, label) => setProgress(pct, label));
    log(`✓  ${State.allCaves.length} grotte caricate`);

    setProgress(95, 'Rendering mappa…');
    setCaves(State.allCaves);
    setProgress(100, `${State.allCaves.length} grotte`);
    log('✓  Mappa aggiornata');
    log('');
    log("Seleziona una provincia o disegna un'area, poi clicca Esporta GPX.");

    setFooterDate(lastModified);
    elBtnExport.disabled = false;
  } catch (e) {
    const emsg = (e && e.message) ? e.message : String(e);
    const msg  = (emsg.includes('503') || emsg.toLowerCase().includes('raggiungibile'))
      ? 'Il Catasto Speleologico Lombardo è temporaneamente non raggiungibile. Riprova più tardi.'
      : `Errore: ${emsg}`;
    log(`✗  ${msg}`);
    console.error(e);
    setProgress(0, 'Errore');
  } finally {
    State.isLoading = false;
    setTimeout(hideProgress, 2000);
  }
}

init();
