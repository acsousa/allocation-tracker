/* Node sandbox harness for allocation-tracker.html — tax engine, migration,
   and recommendation logic. No dependencies. Run: node test/tax-engine.test.js
   It loads the real <script> in a vm with minimal browser stubs and asserts. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'allocation-tracker.html'), 'utf8');
const m = HTML.match(/\n<script>\n([\s\S]*)\n<\/script>/);
if (!m) { console.error('could not extract <script>'); process.exit(1); }

// Expose engine internals (const/function names in the script's top-level scope).
const shim = `
;Object.assign(window.__AAT__, {
  REFERENCE_DATA, DEFAULT_TAX_PROFILE, SEED_TAX_DATA, GLIDE_PRESETS, defaultTaxSettings,
  marginalRate, ltcgRateFor, deriveRates, tickerProfile, holdingDrag, ordinaryInterestRate,
  accountShelter, accountVehicle, inferVehicle, washCloneSet, taxRates, holdingDragRows,
  taxScorecard, locationSwapRecs, muniRecs, rothPlacementRecs, washWarnings, savingsDirective,
  moveRealizedGain, simulateAfter, classForTicker, underweightClasses,
});`;
const src = m[1] + shim;

const ctxWindow = { addEventListener() {}, removeEventListener() {}, matchMedia() { return { matches: false, addEventListener() {} }; } };
const sandbox = {
  window: ctxWindow,
  self: { crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; } } },
  document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; }, querySelector() { return null; }, createElement() { return { style: {} }; }, body: { appendChild() {} } },
  console,
};
vm.createContext(sandbox);
try { vm.runInContext(src, sandbox, { filename: 'aat.js' }); }
catch (e) { console.error('LOAD ERROR:', e); process.exit(1); }

const A = ctxWindow.__AAT__;
const R = A.REFERENCE_DATA;

let pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + name); } }
function near(name, a, b, tol) { ok(name + ` (${(+a).toFixed(3)}≈${(+b).toFixed(3)})`, Math.abs(a - b) <= (tol == null ? 0.5 : tol)); }

/* ---------- fixtures ---------- */
const v2 = {
  meta: { schemaVersion: 2, driftBandPct: 5 },
  accounts: [
    { id: 'a_tax', name: 'Brokerage', category: 'Non-Retirement', taxTreatment: 'Taxable', status: 'active', sortOrder: 0 },
    { id: 'a_roth', name: 'Roth IRA', category: 'Retirement', taxTreatment: 'Roth', status: 'active', sortOrder: 1 },
    { id: 'a_pre', name: '401k', category: 'Retirement', taxTreatment: 'Pre-tax', status: 'active', sortOrder: 2 },
  ],
  holdings: [
    { id: 'h_bnd', accountId: 'a_tax', ticker: 'BND', assetClass: 'us_bond', status: 'active' },
    { id: 'h_voo', accountId: 'a_roth', ticker: 'VOO', assetClass: 'us_large', status: 'active' },
    { id: 'h_vnq', accountId: 'a_tax', ticker: 'VNQ', assetClass: 'reit', status: 'active' },
  ],
  snapshots: [{ date: '2026-01-01', values: [
    { holdingId: 'h_bnd', marketValue: 100000, costBasis: 100000 },
    { holdingId: 'h_voo', marketValue: 100000 },
    { holdingId: 'h_vnq', marketValue: 50000, costBasis: 50000 },
  ], note: '' }],
  goals: [], glidePaths: [], tickerMap: {}, children: [],
};

/* ---------- migration (v2 -> v4) ---------- */
const p = A.migrate(JSON.parse(JSON.stringify(v2)));
ok('migrate: schemaVersion -> 4', p.meta.schemaVersion === 4);
ok('migrate: plans[] added', Array.isArray(p.plans));
ok('migrate: taxSettings added', p.taxSettings && p.taxSettings.networkEnabled === false);
ok('migrate: taxSettings.inStateMuni default false', p.taxSettings.inStateMuni === false);
ok('migrate: taxData.tickers added', p.taxData && typeof p.taxData.tickers === 'object');
ok('migrate: keeps accounts + holdings', p.accounts.length === 3 && p.holdings.length === 3);
const vById = Object.fromEntries(p.accounts.map(a => [a.id, a.vehicle]));
ok('migrate infers vehicle: Roth IRA -> ira', vById.a_roth === 'ira');
ok('migrate infers vehicle: 401k -> 401k', vById.a_pre === '401k');
ok('migrate infers vehicle: Brokerage -> taxable', vById.a_tax === 'taxable');
ok('migrate idempotent', (() => { const q = A.migrate(JSON.parse(JSON.stringify(p))); return q.plans.length === 0 && q.accounts.length === 3 && q.meta.schemaVersion === 4; })());

/* v3 -> v4 specifically: a v3 file (tax module present, no vehicle) gets vehicle + inStateMuni */
const v3 = JSON.parse(JSON.stringify(p));
v3.meta.schemaVersion = 3;
v3.accounts.forEach(a => { delete a.vehicle; });
delete v3.taxSettings.inStateMuni;
const p4 = A.migrate(v3);
ok('v3->v4: bumps to 4', p4.meta.schemaVersion === 4);
ok('v3->v4: back-fills vehicle', p4.accounts.every(a => !!a.vehicle));
ok('v3->v4: adds inStateMuni', p4.taxSettings.inStateMuni === false);
ok('v3->v4: preserves holdings', p4.holdings.length === 3);
ok('emptyPortfolio is v4 with tax fields', (() => { const e = A.migrate({ meta: { schemaVersion: 4 } }); return e.meta.schemaVersion === 4 && Array.isArray(e.plans) && !!e.taxSettings.inStateMuni === false; })());

/* ---------- brackets + rates ---------- */
ok('marginalRate single 150k = 24%', A.marginalRate(R.federalBrackets.single, 150000) === 0.24);
ok('marginalRate single 300k = 35%', A.marginalRate(R.federalBrackets.single, 300000) === 0.35);
ok('marginalRate boundary 11925 = 10%', A.marginalRate(R.federalBrackets.single, 11925) === 0.10);
ok('ltcg single 40k = 0%', A.ltcgRateFor(R.ltcgBrackets.single, 40000) === 0.00);
ok('ltcg single 150k = 15%', A.ltcgRateFor(R.ltcgBrackets.single, 150000) === 0.15);

const r3 = A.deriveRates(R, { filingStatus: 'single', incomeBand: '200_400', state: '' }); // r_ord .35
near('deriveRates r_ord 35%', r3.r_ord, 0.35, 1e-9);
near('deriveRates r_qdi 15%', r3.r_qdi, 0.15, 1e-9);
near('deriveRates niit 3.8%', r3.niit, 0.038, 1e-9);
near('deriveRates r_ord_eff 38.8%', r3.r_ord_eff, 0.388, 1e-9);
near('deriveRates r_qdi_eff 18.8%', r3.r_qdi_eff, 0.188, 1e-9);
near('collectibles rate = min(ord,28%)+niit', r3.r_collectible_eff, 0.28 + 0.038, 1e-9);
near('MA surtax at >$1.083M', A.deriveRates(R, { filingStatus: 'single', incomeBand: 'gt1m', state: 'MA' }).surtax, 0.04, 1e-9);
near('override r_ord honored', A.deriveRates(R, { filingStatus: 'single', incomeBand: '200_400', override: { ordinaryRate: 0.5 } }).r_ord, 0.5, 1e-9);

/* ---------- holdingDrag mechanics ---------- */
const rColl = r3;
const collP = { divYield: 0, qualifiedPct: 0, capGainDistPct: 2, collectible: true };
const plainP = { divYield: 0, qualifiedPct: 0, capGainDistPct: 2 };
ok('collectibles > LTCG at 35% bracket', A.holdingDrag(10000, collP, rColl) > A.holdingDrag(10000, plainP, rColl));
const sixForty = { divYield: 0, qualifiedPct: 0, capGainDistPct: 4, sixtyForty: true };
near('60/40 rate between LTCG and ordinary', A.holdingDrag(10000, sixForty, rColl), 10000 * 0.04 * (0.6 * rColl.r_ltcg_eff + 0.4 * rColl.r_ord_eff), 0.5);
// H1 QBI
const reitQbi = { divYield: 3.8, qualifiedPct: 0, capGainDistPct: 0.5, qbiEligible: true };
const reitNo = { divYield: 3.8, qualifiedPct: 0, capGainDistPct: 0.5 };
ok('QBI lowers REIT drag', A.holdingDrag(10000, reitQbi, rColl) < A.holdingDrag(10000, reitNo, rColl));
near('REIT ordinary uses 0.8x r_ord', A.ordinaryInterestRate(reitQbi, rColl), 0.8 * rColl.r_ord + rColl.niit + rColl.r_state, 1e-9);
// M1 Treasury state-exemption
const rCA = A.deriveRates(R, { filingStatus: 'single', incomeBand: '200_400', state: 'CA' });
const treas = { divYield: 4, qualifiedPct: 0, capGainDistPct: 0, usGovtPct: 100 };
const corp = { divYield: 4, qualifiedPct: 0, capGainDistPct: 0, usGovtPct: 0 };
ok('Treasury drag < corporate in CA', A.holdingDrag(10000, treas, rCA) < A.holdingDrag(10000, corp, rCA));
near('100% Treasury pays no state on interest', A.ordinaryInterestRate(treas, rCA), rCA.r_ord + rCA.niit, 1e-9);

/* ---------- M2: foreign tax credit ---------- */
const intlFtc = { divYield: 3.0, qualifiedPct: 70, capGainDistPct: 0.1, ftcEligible: true };
const intlNo = { divYield: 3.0, qualifiedPct: 70, capGainDistPct: 0.1 };
ok('FTC reduces intl drag', A.holdingDrag(10000, intlFtc, r3) < A.holdingDrag(10000, intlNo, r3));
near('FTC reduction = 7% of dividend', A.holdingDrag(10000, intlNo, r3) - A.holdingDrag(10000, intlFtc, r3), 0.07 * 0.03 * 10000, 0.5);
ok('drag never negative', A.holdingDrag(10000, { divYield: 3, qualifiedPct: 100, capGainDistPct: 0, ftcEligible: true }, A.deriveRates(R, { filingStatus: 'single', incomeBand: 'lt50' })) >= 0);

/* ---------- scorecard ---------- */
A.portfolio = p;
p.taxSettings.filingStatus = 'single'; p.taxSettings.incomeBand = '200_400'; p.taxSettings.state = '';
const snap = p.snapshots[0];
const sc = A.taxScorecard(snap);
const dBnd = sc.rows.find(r => r.ticker === 'BND');
const dVoo = sc.rows.find(r => r.ticker === 'VOO');
near('BND drag ~ 1590.8', dBnd.drag, 1590.8, 2);
ok('VOO in Roth drag = 0', dVoo.drag === 0 && dVoo.sheltered);
near('taxable assets = 150k', sc.taxableAssets, 150000, 1);
ok('location score 0 (all inefficient taxable)', sc.locScore === 0);

/* ---------- location swap ---------- */
const swaps = A.locationSwapRecs(snap);
ok('swap rec proposed', swaps.length >= 1 && swaps[0].aTicker === 'BND');
ok('swap carries realizedGain field', typeof swaps[0].realizedGain === 'number');

/* ---------- M4: muni in-state ---------- */
p.taxSettings.state = 'CA'; p.taxSettings.incomeBand = '200_400'; // r_ord 35% >= 32%
p.taxSettings.inStateMuni = false;
const muniNat = A.muniRecs(snap).find(r => r.aTicker === 'BND');
p.taxSettings.inStateMuni = true;
const muniIn = A.muniRecs(snap).find(r => r.aTicker === 'BND');
ok('national muni is state-taxable', muniNat && muniNat.muniAT < 3.3);
ok('in-state muni exempt from both (higher after-tax)', muniIn && Math.abs(muniIn.muniAT - 3.3) < 1e-6);
ok('in-state muni saves more', muniIn.savingsPerYr > muniNat.savingsPerYr);
p.taxSettings.state = ''; p.taxSettings.inStateMuni = false;

/* ---------- M3: Roth placement ---------- */
const rothFix = A.migrate(JSON.parse(JSON.stringify(v2)));
// Roth holds bonds (slow); traditional 401k holds EM (fast)
rothFix.holdings = [
  { id: 'r_bnd', accountId: 'a_roth', ticker: 'BND', assetClass: 'us_bond', status: 'active' },
  { id: 't_em', accountId: 'a_pre', ticker: 'VWO', assetClass: 'em', status: 'active' },
];
rothFix.snapshots = [{ date: '2026-01-01', values: [
  { holdingId: 'r_bnd', marketValue: 20000 }, { holdingId: 't_em', marketValue: 20000 },
], note: '' }];
A.portfolio = rothFix;
const rothRecs = A.rothPlacementRecs(rothFix.snapshots[0]);
ok('roth placement rec fires', rothRecs.length === 1);
ok('roth rec moves EM into Roth', rothRecs[0] && rothRecs[0].highTicker === 'VWO' && rothRecs[0].lowTicker === 'BND');
// no rec when already well-placed (swap them)
rothFix.holdings[0].assetClass = 'em'; rothFix.holdings[0].ticker = 'VWO';
rothFix.holdings[1].assetClass = 'us_bond'; rothFix.holdings[1].ticker = 'BND';
ok('no roth rec when already optimal', A.rothPlacementRecs(rothFix.snapshots[0]).length === 0);

/* ---------- accountShelter (vehicle-aware) + savings directive caps ---------- */
A.portfolio = p;
const byId = Object.fromEntries(p.accounts.map(a => [a.id, a]));
ok('shelter: taxable', A.accountShelter(byId.a_tax).sheltered === false);
ok('shelter: roth tax-free', A.accountShelter(byId.a_roth).sheltered && /free/.test(A.accountShelter(byId.a_roth).reason));
ok('shelter: hsa vehicle tax-free', A.accountShelter({ vehicle: 'hsa', category: 'Other' }).sheltered && /HSA/.test(A.accountShelter({ vehicle: 'hsa' }).reason));
p.taxSettings.householdMonthlySavings = 3000;
const dir = A.savingsDirective(snap);
const ira = dir.splits.find(s => s.accountId === 'a_roth');
const k401 = dir.splits.find(s => s.accountId === 'a_pre');
ok('Roth IRA capped at $7,000/yr (not $23,500)', ira && Math.round(ira.pctOrAmt * 12) === 7000);
ok('401k capped at $23,500/yr', k401 && Math.round(k401.pctOrAmt * 12) === 23500);
ok('401k filled before IRA', dir.splits.findIndex(s => s.accountId === 'a_pre') < dir.splits.findIndex(s => s.accountId === 'a_roth'));

/* ---------- wash sale ---------- */
ok('wash warns BND<->AGG clone', A.washWarnings({ moves: [{ sellTicker: 'BND', buyTicker: 'AGG', amount: 1 }] }).length === 1);
ok('no wash on unrelated buy', A.washWarnings({ moves: [{ sellTicker: 'BND', buyTicker: 'VOO', amount: 1 }] }).length === 0);

/* ---------- glide presets ---------- */
const gp = A.GLIDE_PRESETS || {};
ok('3 glide preset tracks', Object.keys(gp).length === 3);
const gsums = Object.values(gp).flatMap(t => t.bands.map(b => Object.values(b.targets).reduce((s, v) => s + v, 0)));
ok('every glide band sums to 100', gsums.length > 0 && gsums.every(s => s === 100));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
