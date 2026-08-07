# CaSpLo2GPX web

**CaSpLo2GPX web** è la versione browser di CaSpLo2GPX.
Scarica il Catasto Speleologico Lombardo e lo converte in GPX direttamente nel browser, senza installare nulla. Funziona da PC, tablet e smartphone.

---

<img width="1920" height="869" alt="CaSpLo2GPX-web-07-31-2026_02_18_PM" src="https://github.com/user-attachments/assets/206935a6-e8b9-47fc-a4d0-706195bb11e9" />

---

## Come si usa

1. **Apri** la web app: il Catasto viene scaricato e visualizzato automaticamente sulla mappa.
2. *(Opzionale)* Seleziona una **provincia** dal menu a tendina per filtrare le grotte.
3. *(Opzionale)* Clicca **✏ Disegna** per tracciare un'area sulla mappa: solo le grotte dentro l'area verranno incluse nel GPX. Usa **↩** per annullare l'ultimo vertice, **✗** per cancellare l'area.
4. Clicca **⬇ Esporta GPX** per scaricare il file.

I filtri provincia e area sono cumulativi e possono essere usati insieme o separatamente.

### Funzionalità della mappa
- **Zoom** con la rotella del mouse o con i tasti +/−; **sposta** con il drag.
- **Clustering automatico** a zoom basso: i cerchi mostrano il numero di grotte nell'area. Aumenta lo zoom per vedere i marker individuali.
- **Clic su un marker** → popup con nome, dati e link "Apri scheda" / "Vai a Google Maps".
- **Ricerca comune**: scrivi il nome e premi Invio per centrare la mappa.
- **Ricerca grotta**: cerca per nome tra tutte le grotte del catasto.

---

## Sviluppo locale

I file JS usano ES modules (`import`/`export`), quindi non funzionano aprendo `index.html` direttamente dal filesystem. Serve un server locale:

```bash
# Installa le dipendenze di sviluppo
npm install

# Avvia server locale su http://localhost:3000
npm run serve
```

Poi apri `http://localhost:3000` nel browser.

---

## Lint e formattazione

```bash
# Controlla il codice JS
npm run lint

# Formatta JS, CSS e HTML
npm run format
```

---

## Build produzione

Il progetto usa moduli ES nativi in sviluppo. Per produzione si può generare un bundle minificato con esbuild:

```bash
npm run build
```

Questo produce `dist/bundle.js`. Per usarlo in produzione, sostituire in `index.html`:

```html
<!-- Sviluppo -->
<script type="module" src="js/app.js"></script>

<!-- Produzione -->
<script src="dist/bundle.js"></script>
```

La cartella `dist/` è esclusa dal repository (`.gitignore`) e viene rigenerata dalla CI ad ogni push.

---

## CI / GitHub Actions

Il workflow `.github/workflows/ci.yml` si attiva ad ogni push e pull request su `main`:

1. Installa le dipendenze (`npm ci`)
2. Esegue il lint (`npm run lint`)
3. Esegue la build (`npm run build`)
4. Verifica che `dist/bundle.js` esista

---

## Architettura

```
Browser
  ↓
GitHub Pages  (hosting statico gratuito)
  ↓
Cloudflare Worker  (proxy CORS + cache 24h)
  ↓
speleolombardia.it  (solo se la cache è scaduta)
```

Il primo utente di ogni giornata aggiorna la cache Cloudflare; tutti gli altri ricevono il KML dalla CDN senza toccare il server di origine.

---

## Struttura del progetto

```
CaSpLo2GPX-web/
├── index.html
├── package.json
├── .eslintrc.json
├── cloudflare-worker.js      ← codice del Cloudflare Worker
├── icona_CaSpLo2GPX_256.png
├── .github/
│   └── workflows/
│       └── ci.yml            ← lint + build automatici
├── css/
│   └── style.css
└── js/
    ├── app.js                ← controller principale
    ├── map.js                ← Leaflet, clustering, disegno area
    ├── parser.js             ← parsing KML
    ├── exporter.js           ← generazione e download GPX
    ├── geometry.js           ← filtri provincia e poligono
    └── downloader.js         ← fetch dal Cloudflare Worker
```

---

## Origine dei dati

I dati del Catasto Speleologico Lombardo non sono prodotti da CaSpLo2GPX web.

**Fonte:** [Catasto Speleologico Lombardo](https://www.speleolombardia.it)

I dati sono distribuiti con licenza **Creative Commons Attribuzione – Non Commerciale – Non Opere Derivate 3.0 Italia (CC BY-NC-ND 3.0 IT)**.

CaSpLo2GPX web effettua esclusivamente la conversione dei dati dal formato KML al formato GPX.

**Licenza:** CC BY-NC-ND 3.0 Italia
https://creativecommons.org/licenses/by-nc-nd/3.0/it/

---

## Licenza

Il software **CaSpLo2GPX web** è distribuito con licenza **GNU Affero General Public License v3.0 (AGPL-3.0)**.

Vedi il file `LICENSE` per il testo completo della licenza.

---

## Sviluppatore

**poporni**

---

## Requisiti

### Per usare la web app
- Qualsiasi browser moderno (Chrome, Firefox, Safari, Edge)
- Connessione Internet
- Nessuna installazione richiesta

### Per sviluppare
- Node.js 18 o superiore
- `npm install` per le dipendenze di sviluppo

### Per il Cloudflare Worker
- Account Cloudflare gratuito
- Incolla il contenuto di `cloudflare-worker.js` nell'editor del Worker

---

## Cronologia versioni

### 1.0.0
Prima versione pubblica.
- Download automatico del KML all'apertura della pagina
- Visualizzazione immediata delle grotte sulla mappa
- Clustering automatico a zoom basso, marker individuali a zoom alto
- Filtro per provincia lombarda
- Selezione area con poligono libero (Leaflet.draw)
- Undo dell'ultimo vertice durante il disegno
- Ricerca comuni via Nominatim
- Ricerca grotta per nome con highlight animato
- Esportazione GPX con metadati di licenza
- Cloudflare Worker con cache 24h e header `X-Catasto-Cached-At`
- Layout responsive (PC, tablet, smartphone) con hamburger menu
- Progetto modulare: `app.js`, `map.js`, `parser.js`, `exporter.js`, `geometry.js`, `downloader.js`
- Sanitizzazione XSS delle descrizioni KML
- Content Security Policy (CSP)
- Accessibilità: `aria-live`, `role="dialog"`, focus trap nel modal
- CI con GitHub Actions: lint + build automatici

### 1.0.1
Rilascio di sicurezza e qualità.

**Sicurezza**
- **SRI / CDN**: aggiunta strategia bundle-first con esbuild — in produzione Leaflet e Leaflet.draw vengono inclusi nel bundle locale (`dist/bundle.js`), eliminando la dipendenza da CDN e il relativo rischio di compromissione
- **Referer/Origin check nel Worker**: il Cloudflare Worker ora verifica che le richieste provengano da domini autorizzati (`ALLOWED_ORIGINS`), limitando l'accesso non autorizzato alla quota gratuita
- **DOMPurify import statico**: rimosso il caricamento dinamico con fallback silenzioso; DOMPurify viene ora importato staticamente e incluso nel bundle, garantendo che la sanitizzazione sia sempre attiva
- **Source map esterne**: in produzione (`npm run build`) le source map vengono generate come file separati (`bundle.js.map`) invece di essere inline, evitando l'esposizione del codice sorgente nel bundle distribuito
- **CSP**: mantenuta via meta tag (GitHub Pages non supporta header HTTP); documentata la migrazione a Cloudflare Pages per CSP via header
- **npm audit**: aggiunto step di audit sicurezza nella pipeline CI

**Qualità**
- **`package.json`**: Leaflet e Leaflet.draw aggiunti come dipendenze npm (non più solo CDN); aggiunto script `prebuild` per pulizia automatica della cartella `dist/`
- **CI aggiornata**: aggiunto step `npm audit --audit-level=high` dopo l'installazione delle dipendenze
- **Versione bumped** a 1.0.1 in tutti i file (app.js, cloudflare-worker.js, package.json, footer HTML)

**Note di aggiornamento**
- Aggiornare `ALLOWED_ORIGINS` in `cloudflare-worker.js` con il proprio dominio GitHub Pages prima di fare il deploy del Worker
- Eseguire `npm install` per ottenere le nuove dipendenze (Leaflet, Leaflet.draw, DOMPurify come pacchetti npm)

### 1.0.2
Rilascio di stabilità CI e fix Worker.

**Fix CI**
- Corretto il comando `jest`: sostituito `jest --experimental-vm-modules` (non riconosciuto) con `node --experimental-vm-modules node_modules/.bin/jest`
- Aggiornato Node.js in CI da 20 a 24 (Node 20 deprecato su GitHub Actions)
- Sostituito `npm ci` con `npm install` (non era presente `package-lock.json`)
- Aggiunto `"type": "module"` in `package.json` per supporto ES modules in Jest
- Rimosso `extensionsToTreatAsEsm: [".js"]` dalla configurazione Jest (conflitto con `type: module`)

**Fix Cloudflare Worker**
- Corretto `ALLOWED_ORIGINS`: il browser invia come `Origin` solo il dominio base (`https://poporni.github.io`) senza il path — il controllo ora corrisponde correttamente e il download del KML funziona da GitHub Pages

