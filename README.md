# Mobilanalyse marked

Lokal marimo-app for analyse av `data/mobil.parquet`.

## Start lokalt som notebook

```bash
uv sync
uv run marimo edit mobilanalyse.py
```

Read-only appvisning:

```bash
uv run marimo run mobilanalyse.py
```

## Codex pairing

Start notebooken i marimo-browseren, åpne `Pair with an agent`, velg Codex og bruk kommandoen marimo viser. Token fra pair-dialogen er midlertidig og skal ikke committes.

Eksempel på formen marimo viser:

```bash
codex "$(uvx marimo@latest pair prompt --url 'http://localhost:2718/' --with-token --codex)"
```

Notebooken kan fortsatt brukes lokalt, mens den publiserbare statistikkappen bygges til `dist/`.

## Bygg statisk statistikkapp

Den ferdige appen bygges som ren statisk HTML/CSS/JS med forhåndsbygde
JSON-, CSV- og XLSX-filer. Den kan publiseres direkte fra `dist/` på GitHub
Pages. Appen krever ingen Python- eller Marimo-runtime i nettleseren. CSV-filene
er maskinlesbare radlister, mens Excel-eksportene er presentasjonstabeller med
serier som rader og årstall som kolonner.

Alle visninger i den statiske appen er helårsvisninger. Grossistfanen bruker
`tilgangskjøper-valg.xlsx` som startforslag for hvilken tilbyder som hører til
hvilken grossist per år, mens alle abonnement-, omsetnings- og
konsentrasjonstall beregnes fra `data/mobil.parquet`.

ARPU beregnes med gjennomsnittlig abonnementsgrunnlag gjennom året:
for år `y` brukes snittet av abonnement helår `y-1` og abonnement helår `y`.
For første tilgjengelige år eller en ny tilbyder uten foregående snapshot brukes
årets snapshot alene. Hver figur og tabell i appen har en metodeknapp med
filtre, formler og forklaring av beregningen.

```bash
./scripts/build-static.sh
uv run python scripts/verify_app.py
node scripts/verify_app_browser.mjs
```

Dette lager:

```text
dist/
├── index.html
├── assets/
│   ├── app.js
│   ├── styles.css
│   ├── data/
│   │   ├── app-data.json
│   │   └── verification.json
│   └── exports/
│       ├── *.csv
│       └── *.xlsx
└── data/
    └── mobil.parquet
```

Publiser hele `dist/`-mappen. Lokalt bør appen serveres over HTTP, for eksempel:

```bash
python3 -m http.server 8765 -d dist
```

Dataverifikasjonen sjekker blant annet at andeler summerer til 100, at
projeksjonene har forventede år, at appen ikke er en Marimo-eksport, at
PowerPoint-tabeller fortsatt er tabeller, og at hovedtallene ligger nær
PowerPoint-baseline i `sommervikar-endelig.pptx`. Browser-verifikasjonen bruker
system-Chrome headless til å teste faner, kontroller, drag-and-drop-oppsettet,
Excel-/PNG-eksporter og mobil viewport.
