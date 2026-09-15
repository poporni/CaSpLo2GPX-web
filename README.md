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
4. Clicca un marker e usa **Dettagli** per aprire la scheda locale della grotta, oppure **Vai a** per la navigazione.
5. Clicca **⬇ Esporta GPX** per scaricare il file.

I filtri provincia e area sono cumulativi e possono essere usati insieme o separatamente.

### Funzionalità della mappa
- **Zoom** con la rotella del mouse o con i tasti +/−; **sposta** con il drag.
- **Clustering automatico** a zoom basso: i cerchi mostrano il numero di grotte nell'area. Aumenta lo zoom per vedere i marker individuali.
- **Clic su un marker** → popup sintetico con codice, nome, dati principali, eventuale miniatura, pulsante "Dettagli" e link "Vai a".
- **Scheda locale grotta**: pannello responsive con foto caricata solo all'apertura, quota, sviluppo, profondità, coordinate, ID OpenKIS, copia coordinate e link condivisibile `?cave=...`.
- **Foto**: il popup usa la miniatura del KML; la scheda prova a usare la foto originale pubblica quando è ricavabile dalla convenzione OpenKIS, con fallback automatico alla miniatura.
- **Layer mappa**: puoi passare da OpenStreetMap standard a Tracestrack Topo dal pannello laterale.
- **Ricerca comune**: scrivi il nome e premi Invio per centrare la mappa.
- **Ricerca grotta**: cerca per nome tra tutte le grotte del catasto.

Le schede locali usano solo i dati già pubblicati nel KML OpenKIS. Non viene fatto scraping delle pagine protette e non vengono avviate richieste automatiche alle URL `op=view`.

### Layer Tracestrack Topo

OpenStreetMap.org espone Tracestrack Topo come layer selezionabile con `layers=P`, ma i tile raster sono serviti da Tracestrack e richiedono una API key per l'uso diretto in applicazioni esterne. Per questo il fork non include chiavi nel repository: se scegli **Tracestrack Topo**, inserisci la tua API key Tracestrack nel campo dedicato. La key viene salvata solo nel `localStorage` del browser.

Se la key non è presente o non è valida, l'app resta su OpenStreetMap standard e mostra un avviso nel log.

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

Con il Makefile:

```bash
make install
make serve
```

Il Makefile espone anche i target principali:

```bash
make lint
make test
make build
make check
```

`make check` esegue lint, test e build.

---

## Docker

Per testare senza installare Node.js sul sistema host:

```bash
make docker-build
make docker-run
```

Poi apri `http://localhost:3000`.

Comandi equivalenti senza Makefile:

```bash
docker build -t casplo2gpx-web .
docker run --rm -it -p 3000:80 --name casplo2gpx-web casplo2gpx-web
```

Per eseguire i test in un container Node.js temporaneo:

```bash
make docker-test
```

---

## Backup archivistico OpenKIS

Il repository include uno script standalone per creare un archivio locale dei dati pubblicamente esposti da OpenKIS, senza accedere a pagine protette o aggirare controlli di autorizzazione.

Backup dati senza immagini:

```bash
npm run backup
# oppure
make backup
```

Backup completo con immagini:

```bash
npm run backup:full
# oppure
make backup-full
```

Lo script crea una directory `backups/openkis-<timestamp>/` con:

- `raw/openkis_caves.kml`: KML pubblico grezzo
- `raw/openkis_caves.json`: JSON pubblico grezzo, se disponibile
- `data/caves.json`: dati normalizzati per ripristino locale
- `data/caves.geojson`: punti geografici GeoJSON
- `data/caves.csv`: tabella CSV
- `data/media-index.json`: esito download immagini
- `media/images/`: immagini scaricate, solo con `--include-images`

Opzioni utili:

```bash
node scripts/backup-openkis.js --out backups/test --limit 20 --include-images
node scripts/backup-openkis.js --help
```

Con `--include-images` viene scaricata una immagine per grotta: originale pubblica quando deducibile dalla convenzione OpenKIS, altrimenti miniatura. Il download è sequenziale e usa un piccolo delay per non stressare il server; se rilanciato, riusa i file già presenti salvo `--force`.

---

## Lint e formattazione

```bash
# Controlla il codice JS
npm run lint

# Formatta JS, CSS e HTML
npm run format
```

Equivalenti Makefile:

```bash
make lint
make format
```

---

## Build produzione

Il progetto usa moduli ES nativi in sviluppo. Per produzione si può generare un bundle minificato con esbuild:

```bash
npm run build
```

Equivalente Makefile:

```bash
make build
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
├── Makefile
├── Dockerfile
├── .dockerignore
├── .eslintrc.json
├── cloudflare-worker.js      ← codice del Cloudflare Worker
├── icona_CaSpLo2GPX_256.png
├── .github/
│   └── workflows/
│       └── ci.yml            ← lint + build automatici
├── css/
│   └── style.css
├── js/
    ├── app.js                ← controller principale
    ├── baselayers.js         ← configurazione layer OpenStreetMap e Tracestrack
    ├── cave.js               ← helper nome e deep-link grotta
    ├── details.js            ← scheda locale grotta e foto lazy-loaded
    ├── map.js                ← Leaflet, clustering, disegno area
    ├── parser.js             ← parsing KML
    ├── exporter.js           ← generazione e download GPX
    ├── geometry.js           ← filtri provincia e poligono
    └── downloader.js         ← fetch dal Cloudflare Worker
└── scripts/
    └── backup-openkis.js     ← backup archivistico KML/JSON/media pubblici
```

---

## Origine dei dati

I dati del Catasto Speleologico Lombardo non sono prodotti da CaSpLo2GPX web.

**Fonte:** [Catasto Speleologico Lombardo](https://www.speleolombardia.it)

I dati sono distribuiti con licenza **Creative Commons Attribuzione – Non Commerciale – Non Opere Derivate 3.0 Italia (CC BY-NC-ND 3.0 IT)**.

CaSpLo2GPX web effettua esclusivamente la conversione dei dati dal formato KML al formato GPX e la visualizzazione locale delle informazioni già presenti nel KML. Il link al portale ufficiale resta indicato come fonte, ma la scheda ufficiale può richiedere autorizzazione.

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
- Docker, opzionale, per usare i target `make docker-*`

### Per il Cloudflare Worker
- Account Cloudflare gratuito
- Incolla il contenuto di `cloudflare-worker.js` nell'editor del Worker

---

## Cronologia versioni

### Fork in sviluppo
- Scheda dettaglio locale generata nel browser con dati già presenti nel KML OpenKIS
- Estrazione strutturata di codice, nome, sinonimi, quota, sviluppo, profondità, ID OpenKIS e URL thumbnail
- Popup Leaflet sintetico con pulsante "Dettagli" e link "Vai a"
- Foto caricate lazy solo all'apertura del popup o della scheda; nella scheda viene preferita la foto originale pubblica quando deducibile
- Decodifica di entità HTML annidate nei nomi e parsing più restrittivo dei campi quota/sviluppo/profondità incompleti
- Deep link locale con parametro `?cave=...`
- Test parser per foto, ID, sanitizzazione e descrizioni incomplete
- Dockerfile, `.dockerignore` e Makefile per sviluppo/test locale con o senza Docker
- Script standalone per backup archivistico di KML, JSON normalizzato, GeoJSON, CSV e immagini pubbliche
- Selettore layer mappa con supporto a Tracestrack Topo tramite API key personale salvata nel browser

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
