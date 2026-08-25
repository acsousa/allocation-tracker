# CLAUDE.md — Allocation Tracker

Guidance for Claude Code (and humans) working in this repo. Committed so it
travels to every console/clone.

## What this is

A single-file, **fully offline** personal asset-allocation tracker:
`allocation-tracker.html` — vanilla JS + inline CSS, no build step, no
dependencies, **zero network requests** (hard acceptance test). You hand the
same HTML file to a friend; their data lives in a separate JSON file they save.

- **App file:** `allocation-tracker.html` (the entire product).
- **User data:** `my-portfolio.json` (never in this repo — gitignored).
- **Spec (normative):** `~/Documents/Claude/Projects/Budgeting/asset-allocation-tool-spec.md`
  (currently v1.3). §13 = financial logic (tax), §14 = navigation/IA. When code
  and spec disagree on tax math or IA, the spec wins.

## Golden rules

1. **Never touch the user's real data.** Their portfolio lives in
   `~/Documents/Portfolio/` (and any `my-portfolio.json`). Never create,
   overwrite, `rm`, or `>`-redirect a `my-portfolio.json` in this repo or the
   data folder. Test only on **throwaway copies** under `/private/tmp`. (A past
   auto-load test destroyed real data — unrecoverable.)
2. **Zero network.** No CDN, no external fonts, no `fetch` to any external host.
   The only `fetch` is a same-origin `./my-portfolio.json` autoload probe. Keep
   it that way; it's an acceptance test.
3. **One file.** All CSS/JS inline in `allocation-tracker.html`. No new files
   shipped as part of the app.
4. **Additive schema migrations only.** Never drop user data. See Migration.

## How to run / test

No dev server needed to just open it — but for the File System Access API and a
realistic test, serve a **copy**:

```bash
mkdir -p /private/tmp/aat_serve && cp allocation-tracker.html /private/tmp/aat_serve/index.html
cd /private/tmp/aat_serve && python3 -m http.server 8747
# open http://localhost:8747/index.html, click "Load demo data"
```

**Syntax check** (extract the script, no execution):

```bash
python3 - <<'PY'
import re; h=open('allocation-tracker.html').read()
m=re.search(r'\n<script>\n(.*)\n</script>',h,re.S); open('/tmp/_c.js','w').write(m.group(1))
PY
node --check /tmp/_c.js
```

**Tax-engine harness** (node `vm` sandbox that loads the real `<script>` with
browser stubs and asserts §13 math + migration): pattern lives at
`/private/tmp/aat_test.js` (ephemeral — copy the HTML to
`/private/tmp/aat_html.html` first). The repo stays single-file, so the harness
is not committed; recreate it from the app's `window.__AAT__` export plus a shim
that exposes the tax functions. Always run it after touching the tax engine.

Exercise UI changes in a real browser (type-check ≠ works). Check the console
for errors; the only expected one is the `my-portfolio.json` 404 probe.

## Architecture

- **State:** one global `portfolio` object (the saved data) + one `ui` object
  (ephemeral view state). No framework.
- **Render:** `render()` is a router that switches on `ui.view` and rebuilds
  `#app` innerHTML. Pure render functions return HTML strings.
- **Events:** delegated. Markup carries `data-act="..."` (+ `data-*`); handlers
  `onClick`/`onChange`/`onInput` resolve `e.target.closest('[data-act]')` and
  switch on the act. To add an interaction: add a `data-act` in markup + a case
  in the matching handler.
- **Persistence:** File System Access API (`showSaveFilePicker`/`showOpenFilePicker`)
  on Chrome/Edge; download/upload fallback elsewhere. The FSA *file handle* is
  cached in IndexedDB (a reference only — never the data). Do **not** store
  portfolio data in localStorage/IndexedDB (user requirement).
- **Charts:** hand-rolled inline SVG (donut, drift bars, stacked area). No chart
  library.

## Data model (`portfolio`)

`meta` (schemaVersion, driftBandPct) · `children[]` · `accounts[]` ·
`holdings[]` · `snapshots[]` (values by holdingId) · `goals[]` (append-only
journal) · `glidePaths[]` (per-child 529) · `tickerMap` (learned classifications)
· `plans[]` (quarterly plans: moves/noAction/directive) · `taxSettings`
(filing status, income band, state, gain budget, monthly savings, YTD, override)
· `taxData` (per-ticker user overrides). Accounts/holdings are **archived, never
deleted**.

`REFERENCE_DATA` is embedded tax-year data (brackets, LTCG/NIIT thresholds, all
50 states, MA surtax, contribution limits) — **data, not the user's JSON**.
Bump it each tax year; `taxYear` is shown in the UI. `SEED_MAP`/`SEED_MAP_EXT`
= ticker→asset-class; `SEED_TAX_DATA`/`DEFAULT_TAX_PROFILE` = bundled fund tax
profiles / class defaults.

### Schema versioning / migration

`SCHEMA_VERSION` + `migrate(data)`. Reject newer-major files; migrate older ones
silently and **additively** (never drop fields). New fields get defaults in
`emptyPortfolio()` and are back-filled in `migrate()`. Current version: 3
(v2→v3 added plans/taxSettings/taxData).

## Navigation / IA (§14)

Top tabs: **Check-In · Review · Plan · Report · Settings** (left→right =
enter it, understand it, decide, record). The active top tab is **bold**.
Review sub-tabs: Overview / Positions / Goals / Tax / History. Settings
sub-tabs: Accounts / Household / Tax Profile / Data & Privacy. Internal
`ui.view` ids map to these via `topTabOf()`; the logo opens an About modal. The
word "Dashboard" must not appear in the UI ("Overview").

## Tax engine (§13)

Pure functions: `deriveRates` (§13.1), `holdingDrag` (§13.2), `holdingDragRows`
/ `taxScorecard` (§13.9, incl. Location Efficiency + tax-shielded), `accountShelter`,
`locationSwapRecs` (§13.5), `muniRecs` (§13.6), `washWarnings` (§13.7),
`savingsDirective` (§13.8), `driftMoves` + `generatePlanProposals` (§13.4).
Rates are **decimals**; profile percentages are **percent**. Everything offline.
Keep the "estimates, not tax advice — confirm with a CPA" disclaimers visible.

## UI conventions

- **Currency (always $ + commas).** Read-only: `fmtMoney(n)` / `fmtMoney2(n)`
  (both add `$` and commas). **Never** prefix `$` before them (double-`$`).
  Editable currency `<input>`s render with `fmtEditNum(n)` (commas) and parse
  with `parseNum()` (strips `$`/commas/spaces). Percent: `fmtPct` /
  `fmtPctSigned`. Signed money: `fmtMoneySigned` / `fmtMoneySigned2`.
- **Acronyms get hover help:** wrap in `abbr(short, full)` → `<abbr title>`
  (QDI, LTCG, NIIT, YTD, HSA, IRA, REIT, MA, 529, …).
- **Design system ("Industry" blueprint):** warm off-white bg, ink text,
  slate-blue accent, square corners, Barlow / Barlow Condensed (system-ui
  fallback). Use the `--color-*` CSS custom properties — never hardcode hex.
  `.panel` / `.blueprint` / `.card` / `.tag` / `.kpi` / `.table` / `.subnav`
  are the shared classes.
- **Tables that must align** use `table-layout: fixed` + a `<colgroup>`; wrap
  wide tables in `overflow-x:auto`.
- Print/report: `@media print` renders the `.report`; `.no-print` (nav, subnav,
  toolbars, dialogs) is hidden.

## Git / remote

- Origin: **personal GitHub `acsousa`** (private `acsousa/allocation-tracker`),
  HTTPS. NOT the work `asousa-enigma` account. A **repo-local** credential
  helper (`git config --local credential.helper` → `gh auth token -u acsousa`)
  makes `git push` work with no global-config impact.
- Commits authored `asousa-enigma <andrew@enigma.aero>` to match history; end
  agent commit messages with a `Co-Authored-By` trailer.
- Branch off `main`; conventional-commit titles (`feat:` / `fix:` / `chore:` …).
  Independent of the px4 repo — never re-link.
