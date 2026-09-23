/* Node sandbox harness for app.html — tax engine, migration,
   and recommendation logic. No dependencies. Run: node test/tax-engine.test.js
   It loads the real <script> in a vm with minimal browser stubs and asserts. */
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const HTML = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');
const m = HTML.match(/\n<script>\n([\s\S]*)\n<\/script>/);
if (!m) { console.error('could not extract <script>'); process.exit(1); }

// Expose engine internals (const/function names in the script's top-level scope).
const shim = `
;Object.assign(window.__AAT__, {
  REFERENCE_DATA, DEFAULT_TAX_PROFILE, SEED_TAX_DATA, GLIDE_PRESETS, defaultTaxSettings,
  marginalRate, ltcgRateFor, deriveRates, tickerProfile, holdingDrag, ordinaryInterestRate,
  accountShelter, accountVehicle, inferVehicle, washCloneSet, taxRates, holdingDragRows,
  taxScorecard, locationSwapRecs, muniRecs, rothPlacementRecs, washWarnings, savingsDirective,
  taxableSaleInfo, moveRealizedGain, simulateAfter, classForTicker, underweightClasses, parseImportRows,
  RETIRE_DATA, defaultRetirementSettings, retireCorr, blendMuSigma, retireBracketTax, retireBracketMarginal,
  ltcgStackTax, rmdStartAge, rmdDivisor, rmdAmount, mulberry32, gaussFrom, drawReturnFrom, ssFactor,
  estimatePIAmonthly, taxableSocialSecurity, doWithdraw, decumulateYear, runProjection, switchPointVerdict, conversionFillTop,
  defaultCollegeSettings, collegeGroupMuSigma, runCollegeProjection, fmtCompactMoney, allocTableHTML,
});`;
const src = m[1] + shim;

const ctxWindow = { addEventListener() {}, removeEventListener() {}, matchMedia() { return { matches: false, addEventListener() {} }; } };
const sandbox = {
  window: ctxWindow,
  self: { crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256); return a; } } },
  document: { addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; }, querySelector() { return null; }, createElement() { return { style: {} }; }, body: { appendChild() {} } },
  console,
  getComputedStyle: () => ({getPropertyValue: () => '#123456'}),
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
    { id: 'h_bnd', accountId: 'a_tax', ticker: 'BND', assetClass: 'us_bond', acquiredDate: '2024-01-01', status: 'active' },
    { id: 'h_voo', accountId: 'a_roth', ticker: 'VOO', assetClass: 'us_large', status: 'active' },
    { id: 'h_vnq', accountId: 'a_tax', ticker: 'VNQ', assetClass: 'reit', acquiredDate: '2024-01-01', status: 'active' },
  ],
  snapshots: [{ date: '2026-01-01', values: [
    { holdingId: 'h_bnd', marketValue: 100000, costBasis: 100000 },
    { holdingId: 'h_voo', marketValue: 100000 },
    { holdingId: 'h_vnq', marketValue: 50000, costBasis: 50000 },
  ], note: '' }],
  goals: [], glidePaths: [], tickerMap: {}, children: [],
};

/* ---------- migration (v2 -> v7) ---------- */
const p = A.migrate(JSON.parse(JSON.stringify(v2)));
ok('migrate: schemaVersion -> 7', p.meta.schemaVersion === 7);
ok('migrate: plans[] added', Array.isArray(p.plans));
ok('migrate: taxSettings added', p.taxSettings && p.taxSettings.networkEnabled === false);
ok('migrate: taxSettings.inStateMuni default false', p.taxSettings.inStateMuni === false);
ok('migrate: taxData.tickers added', p.taxData && typeof p.taxData.tickers === 'object');
ok('migrate: retirementSettings added', p.retirementSettings && p.retirementSettings.retirementAge === 65 && p.retirementSettings.mappingConfirmed === false);
ok('migrate: collegeSettings added', p.collegeSettings && p.collegeSettings.defaultAnnualCostReal === 35000 && typeof p.collegeSettings.byChild === 'object');
ok('migrate: keeps accounts + holdings', p.accounts.length === 3 && p.holdings.length === 3);
const vById = Object.fromEntries(p.accounts.map(a => [a.id, a.vehicle]));
ok('migrate infers vehicle: Roth IRA -> ira', vById.a_roth === 'ira');
ok('migrate infers vehicle: 401k -> 401k', vById.a_pre === '401k');
ok('migrate infers vehicle: Brokerage -> taxable', vById.a_tax === 'taxable');
ok('migrate idempotent', (() => { const q = A.migrate(JSON.parse(JSON.stringify(p))); return q.plans.length === 0 && q.accounts.length === 3 && q.meta.schemaVersion === 7; })());

/* v4 -> v5 specifically: a v4 file (no retirementSettings) gains them without losing data */
const v4 = JSON.parse(JSON.stringify(p));
v4.meta.schemaVersion = 4;
delete v4.retirementSettings;
const p5 = A.migrate(v4);
ok('v4->v7: bumps to 7', p5.meta.schemaVersion === 7);
ok('v4->v6: adds retirementSettings', p5.retirementSettings && p5.retirementSettings.paths === 10000 && p5.retirementSettings.accountScope === 'retirement');
ok('v4->v5: adds collegeSettings', p5.collegeSettings && p5.collegeSettings.years === 4);
ok('v4->v5: preserves holdings + accounts', p5.holdings.length === 3 && p5.accounts.length === 3);
/* v3 -> v5: a v3 file (no vehicle, no inStateMuni, no retirementSettings) */
const v3 = JSON.parse(JSON.stringify(p));
v3.meta.schemaVersion = 3;
v3.accounts.forEach(a => { delete a.vehicle; });
delete v3.taxSettings.inStateMuni; delete v3.retirementSettings;
const p35 = A.migrate(v3);
ok('v3->v7: bumps to 7', p35.meta.schemaVersion === 7);
ok('v3->v5: back-fills vehicle', p35.accounts.every(a => !!a.vehicle));
ok('v3->v5: adds inStateMuni', p35.taxSettings.inStateMuni === false);
ok('v3->v5: adds retirementSettings', !!p35.retirementSettings);
ok('emptyPortfolio is v7 with tax + retirement fields', (() => { const e = A.migrate({ meta: { schemaVersion: 7 } }); return e.meta.schemaVersion === 7 && Array.isArray(e.plans) && e.taxSettings.inStateMuni === false && !!e.retirementSettings; })());

/* ---------- brackets + rates ---------- */
ok('marginalRate single 150k = 24%', A.marginalRate(R.federalBrackets.single, 150000) === 0.24);
ok('marginalRate single 300k = 35%', A.marginalRate(R.federalBrackets.single, 300000) === 0.35);
ok('marginalRate boundary 12400 = 10% (TY2026 single top of 10% band)', A.marginalRate(R.federalBrackets.single, 12400) === 0.10);
ok('ltcg single 40k = 0%', A.ltcgRateFor(R.ltcgBrackets.single, 40000) === 0.00);
ok('ltcg single 150k = 15%', A.ltcgRateFor(R.ltcgBrackets.single, 150000) === 0.15);

const r3 = A.deriveRates(R, { filingStatus: 'single', incomeBand: '200_400', state: '' }); // r_ord .35
near('deriveRates r_ord 35%', r3.r_ord, 0.35, 1e-9);
near('deriveRates r_qdi 15%', r3.r_qdi, 0.15, 1e-9);
near('deriveRates niit 3.8%', r3.niit, 0.038, 1e-9);
near('deriveRates r_ord_eff 38.8%', r3.r_ord_eff, 0.388, 1e-9);
near('deriveRates r_qdi_eff 18.8%', r3.r_qdi_eff, 0.188, 1e-9);
near('collectibles rate = min(ord,28%)+niit', r3.r_collectible_eff, 0.28 + 0.038, 1e-9);
near('MA surtax at >$1.11M (TY2026)', A.deriveRates(R, { filingStatus: 'single', incomeBand: 'gt1m', state: 'MA' }).surtax, 0.04, 1e-9);
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
const muniProfile = { divYield: 3.3, qualifiedPct: 0, capGainDistPct: 0, muni: true };
near('national muni interest pays state tax only', A.holdingDrag(100000, muniProfile, rCA), 100000 * 0.033 * rCA.r_state, 0.5);

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
const savedAcquired = p.holdings.find(h => h.id === 'h_bnd').acquiredDate;
delete p.holdings.find(h => h.id === 'h_bnd').acquiredDate;
ok('taxable sale suppressed without long-term confirmation', !A.locationSwapRecs(snap).some(r => r.aTicker === 'BND'));
p.holdings.find(h => h.id === 'h_bnd').longTermHolding = true;
ok('explicit long-term confirmation enables basis-aware sale scenario', A.locationSwapRecs(snap).some(r => r.aTicker === 'BND'));
delete p.holdings.find(h => h.id === 'h_bnd').longTermHolding;
p.holdings.find(h => h.id === 'h_bnd').acquiredDate = savedAcquired;

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
ok('Roth IRA capped at IRS 2026 $7,500/yr (not the 401k limit)', ira && Math.round(ira.pctOrAmt * 12) === 7500);
ok('401k capped at IRS 2026 $24,500/yr', k401 && Math.round(k401.pctOrAmt * 12) === 24500);
ok('401k filled before IRA', dir.splits.findIndex(s => s.accountId === 'a_pre') < dir.splits.findIndex(s => s.accountId === 'a_roth'));

/* ---------- wash sale ---------- */
ok('wash warns BND<->AGG clone', A.washWarnings({ moves: [{ sellTicker: 'BND', buyTicker: 'AGG', amount: 1 }] }).length === 1);
ok('no wash on unrelated buy', A.washWarnings({ moves: [{ sellTicker: 'BND', buyTicker: 'VOO', amount: 1 }] }).length === 0);

/* ---------- glide presets ---------- */
const gp = A.GLIDE_PRESETS || {};
ok('3 glide preset tracks', Object.keys(gp).length === 3);
const gsums = Object.values(gp).flatMap(t => t.bands.map(b => Object.values(b.targets).reduce((s, v) => s + v, 0)));
ok('every glide band sums to 100', gsums.length > 0 && gsums.every(s => s === 100));

/* ---------- holdings-import parser ---------- */
const P = A.parseImportRows;
const fidelity = 'Symbol,Description,Quantity,Last Price,Current Value\nVTI,VANGUARD,10,"$250.00","$2,500.00"\nBND,BND,20,"$70.00","$1,400.00"\nAccount Total,,,,"$3,900.00"';
const fr = P(fidelity);
ok('import: fidelity 2 rows', fr.length === 2);
ok('import: value parsed with $/commas', (fr.find(r => r.ticker === 'VTI') || {}).value === 2500 && (fr.find(r => r.ticker === 'BND') || {}).value === 1400);
ok('import: Total row excluded', !fr.some(r => /total/i.test(r.ticker)));
const loose = P('VOO 317,589.51\nBND $1,400.00\nGLD  15089.80');
ok('import: loose thousands-comma not split', (loose.find(r => r.ticker === 'BND') || {}).value === 1400 && (loose.find(r => r.ticker === 'VOO') || {}).value === 317589.51);
const tsv = P('Symbol\tValue\nVOO\t100\nBND\t200');
ok('import: TSV', tsv.length === 2 && tsv.find(r => r.ticker === 'BND').value === 200);
// Merrill-style: ticker+name combined column, $ value col, timestamped price, preamble + Total
const merrill = '"Exported on: x"\n\n"Positions","Quantity","Price","% of Portfolio","Value","Unit cost"\n"VOO VANGUARD 500 INDEX ETF","454","$699.14 02:39 PM ET","25%","$317,589.51","$447.36"\n"GLD SPDR GOLD TRUST","38","$397.10 02:39 PM ET","1%","$15,089.80","$296.01"\n"Total","","","100%","$332,679.31",""';
const mr = P(merrill);
ok('import: merrill combined ticker+name', mr.length === 2 && mr[0].value + mr[1].value === 332679.31);
ok('import: merrill picks Value col not Price', (mr.find(r => r.ticker === 'VOO') || {}).value === 317589.51);
// Summary block with its OWN "Value" column ABOVE the real positions header (Merrill 2nd format)
const summaryAbove = '"Family Investments","Value","Day\'s Value Change","Unrealized Gain/Loss"\n'
  + '"CMA-Edge 53Z","$330,895.78","$0.00 0.00%","+$38,660.31"\n'
  + '""\n'
  + '"Symbol","Quantity","Price","% of Portfolio","Value","Unit Cost"\n'
  + '"VOO","159.4493","$436.80","21.05%","$69,647.46","$303.58"\n'
  + '"GLD","58","$191.17","3.35%","$11,087.86","$164.49"\n'
  + '"Money accounts","47,111","$1.00","14%","$47,111.00","$1.00"\n'
  + '"Total","","","104%","$330,895.78",""';
const sa = P(summaryAbove);
ok('import: picks real positions header, not summary', sa.length === 2);
ok('import: reads Value col (not Quantity) after summary', (sa.find(r => r.ticker === 'VOO') || {}).value === 69647.46);
ok('import: excludes account-summary row', !sa.some(r => /CMA/i.test(r.ticker)));
ok('import: skips Money-accounts cash row', !sa.some(r => /MONEY/i.test(r.ticker)));
// cost basis: per-share Unit Cost × Quantity
const perShare = P('Symbol,Quantity,Price,Value,Unit Cost\nVOO,10,"$700.00","$7,000.00","$400.00"');
ok('import: per-share cost × qty = total basis', (perShare[0] || {}).costBasis === 4000);
// cost basis: explicit TOTAL column used as-is
const totalCost = P('Symbol,Quantity,Value,Cost Basis\nVOO,10,"$7,000.00","$4,000.00"');
ok('import: total cost basis used directly', (totalCost[0] || {}).costBasis === 4000);
// ambiguous "Cost" with a per-share magnitude → ×qty
const ambig = P('Symbol,Quantity,Value,Cost\nVOO,10,"$7,000.00","$400.00"');
ok('import: ambiguous per-share cost → ×qty', (ambig[0] || {}).costBasis === 4000);
// ambiguous "Cost" already a total magnitude → as-is
const ambigT = P('Symbol,Quantity,Value,Cost\nVOO,10,"$7,000.00","$4,000.00"');
ok('import: ambiguous total cost → as-is', (ambigT[0] || {}).costBasis === 4000);
// no cost column → no basis
ok('import: no cost column → no basis', P('Symbol,Value\nVOO,"$7,000.00"')[0].costBasis === undefined);

/* ================= RETIREMENT ENGINE — spec §6.8 acceptance tests ================= */
const mfjB = R.federalBrackets.mfj, mfjL = R.ltcgBrackets.mfj, singB = R.federalBrackets.single, singL = R.ltcgBrackets.single;

// §6.8-1 — $100k pre-tax withdrawal minus the MFJ standard deduction, walked through brackets, NOT a flat rate.
// (Spec wrote $30k std ded for TY2025; refreshed to the TY2026 figure of $32,200 per the user's 2026 update.)
const ti1 = 100000 - A.RETIRE_DATA.standardDeduction.mfj; // 100,000 − 32,200 = 67,800
near('§6.8-1 $100k pretax − MFJ std ded, walked through TY2026 brackets', A.retireBracketTax(mfjB, ti1), 24800 * 0.10 + (ti1 - 24800) * 0.12, 0.5);
ok('§6.8-1 std deduction MFJ = $32,200 (TY2026)', A.RETIRE_DATA.standardDeduction.mfj === 32200);
ok('§6.8-1 progressive != flat 22%', Math.abs(A.retireBracketTax(mfjB, ti1) - ti1 * 0.22) > 1000);

// §6.8-2 — Age-75 RMD on $2,000,000 pre-tax = 2,000,000 / 24.6 = $81,301.
ok('§6.8-2 divisor age75 = 24.6', A.rmdDivisor(75) === 24.6);
near('§6.8-2 RMD age75 $2M', A.rmdAmount(2000000, 75), 2000000 / 24.6, 0.01);
ok('§6.8-2 RMD rounds to $81,301', Math.round(A.rmdAmount(2000000, 75)) === 81301);
ok('§6.8-2 RMD checkpoints 73/80/85/90/95', A.rmdDivisor(73) === 26.5 && A.rmdDivisor(80) === 20.2 && A.rmdDivisor(85) === 16.0 && A.rmdDivisor(90) === 12.2 && A.rmdDivisor(95) === 8.9);
ok('§6.8-2 RMD start 75 for 1960+, 73 before', A.rmdStartAge(1960) === 75 && A.rmdStartAge(1959) === 73);

// §6.8-3 — 60/40 US-Large/Bonds → μ=3.72%; σ from the full formula (covariance term ⇒ 10.0%; spec prose "9.8" drops it).
const blend = A.blendMuSigma({ us_large: 0.6, us_bond: 0.4 });
near('§6.8-3 blend μ = 3.72%', blend.mu * 100, 3.72, 0.01);
const sig2 = 0.36 * (0.16 ** 2) + 0.16 * (0.05 ** 2) + 2 * 0.6 * 0.4 * 0.16 * 0.05 * 0.10;
near('§6.8-3 blend σ matches ΣΣwᵢwⱼσᵢσⱼρᵢⱼ', blend.sigma, Math.sqrt(sig2), 1e-6);
near('§6.8-3 blend σ = 10.0%', blend.sigma * 100, 10.0, 0.05);

// §6.8-4 — deterministic (σ=0, μ=5%): $100k grows to $432,194 in 30 years.
const mu5 = A.blendMuSigma({ us_large: 1 }).mu;
ok('§6.8-4 us_large μ = 5.0%', Math.abs(mu5 - 0.05) < 1e-9);
let dbal = 100000; for (let i = 0; i < 30; i++) dbal *= 1 + mu5;
near('§6.8-4 $100k → $432,194 in 30y', dbal, 432194.24, 1);
ok('§6.8-4 drawReturn σ=0 is deterministic μ', A.drawReturnFrom(A.mulberry32(1), 0.05, 0) === 0.05);

// §6.8-5 — seeded MC twice with same seed → identical output arrays.
(() => {
  const g1 = A.mulberry32(4242), g2 = A.mulberry32(4242), s1 = [], s2 = [];
  for (let i = 0; i < 12; i++) { s1.push(A.drawReturnFrom(g1, 0.05, 0.16)); s2.push(A.drawReturnFrom(g2, 0.05, 0.16)); }
  ok('§6.8-5 same seed → identical draws', JSON.stringify(s1) === JSON.stringify(s2));
})();

/* ---- engine mechanics beyond the 5 acceptance numbers ---- */
// LTCG stacked on top of ordinary against the 0/15/20 thresholds.
near('LTCG: $50k ord + $50k gain (single) all at 15%', A.ltcgStackTax(singL, 50000, 50000), 50000 * 0.15, 1);
ok('LTCG: gains inside the 0% band pay nothing', A.ltcgStackTax(singL, 20000, 20000) === 0);
// correlations
ok('corr equity×equity = 0.85', A.retireCorr('us_large', 'intl_dev') === 0.85);
ok('corr equity×bond = 0.10', A.retireCorr('us_large', 'us_bond') === 0.10);
ok('corr REIT×equity = 0.70', A.retireCorr('reit', 'us_large') === 0.70);
ok('corr cash×anything = 0', A.retireCorr('cash', 'crypto') === 0);
ok('corr diagonal = 1', A.retireCorr('em', 'em') === 1);
// SS actuarial factors
ok('SS factor: FRA=1, 62=0.70, 70=1.24', A.ssFactor(67) === 1 && Math.abs(A.ssFactor(62) - 0.70) < 1e-9 && Math.abs(A.ssFactor(70) - 1.24) < 1e-9);
// conversion-fill bracket mapping
ok('conversionFillTop 24% MFJ = 403550 (TY2026)', A.conversionFillTop('24%', mfjB) === 403550);
ok('conversionFillTop off = 0', A.conversionFillTop('off', mfjB) === 0);

// One-year decumulation: $100k spend from a $1M pre-tax pile, MFJ, std ded 30k, 5% state.
(() => {
  const out = A.decumulateYear({ pretax: 1000000, taxable: 0, roth: 0, taxfree: 0 }, 0, {
    age: 68, spendNet: 100000, ssGross: 0, fedBrackets: mfjB, ltcgBrackets: mfjL, stdDed: 30000,
    stateRate: 0.05, niitRate: 0.038, niitThreshold: 250000, taxesSSstate: false, forcedRMD: 0,
  });
  ok('decum funds spend net of tax', Math.abs(out.netCash - 100000) < 100 && out.shortfall < 100);
  ok('decum pays progressive tax (>0, <flat 27%)', out.tax > 0 && out.tax < 100000 * 0.27);
})();

// Full projection: deterministic pure growth (never retire) reproduces §6.8-4 end-to-end.
(() => {
  const cfg = {
    start: { pretax: 100000, taxable: 0, roth: 0, taxfree: 0, basis: 0 }, contrib: {}, contribGrowth: 0,
    currentAge: 65, retireAge: 999, spend: 0, weightsNow: { us_large: 1 }, weightsTarget: null, muSigma: A.RETIRE_DATA.muSigma,
    filing: 'mfj', fedBrackets: mfjB, ltcgBrackets: mfjL, stdDed: 30000, stateRate: 0, niitRate: 0.038, niitThreshold: 250000,
    taxesSSstate: false, ssGross: 0, ssClaimAge: 67, birthYearPrimary: 1960, survivorAtAge: 90, survivorStdDed: 15000,
    survivorFedBrackets: singB, survivorLtcgBrackets: singL, survivorStateRate: 0, rNow: 0.32, conversionFill: 0, paths: 1, seed: 1, deterministic: true,
  };
  const res = A.runProjection(cfg);
  ok('projection band[0] = starting balance', Math.round(res.bands[0].p50) === 100000);
  near('projection age95 = $432,194 (30 compounds)', res.bands[res.bands.length - 1].p50, 100000 * Math.pow(1.05, 30), 1);
  ok('projection spans age 65..95', res.bands.length === 31 && res.bands[res.bands.length - 1].age === 95);
})();

// Full MC: 1000 paths reproducible, bands ordered, success in (0,1), survivor marginal computed.
(() => {
  const cfg = {
    start: { pretax: 800000, taxable: 400000, roth: 200000, taxfree: 20000, basis: 250000 },
    contrib: { pretax: 23500, roth: 7000, taxable: 10000, taxfree: 4000 }, contribGrowth: 0,
    currentAge: 45, retireAge: 65, spend: 90000, weightsNow: { us_large: 0.5, intl_dev: 0.2, us_bond: 0.25, reit: 0.05 },
    weightsTarget: { us_large: 0.35, intl_dev: 0.15, us_bond: 0.45, cash: 0.05 }, muSigma: A.RETIRE_DATA.muSigma,
    filing: 'mfj', fedBrackets: mfjB, ltcgBrackets: mfjL, stdDed: 30000, stateRate: 0.05, niitRate: 0.038, niitThreshold: 250000,
    taxesSSstate: false, ssGross: 42000, ssClaimAge: 67, birthYearPrimary: 1981, survivorAtAge: 90, survivorStdDed: 15000,
    survivorFedBrackets: singB, survivorLtcgBrackets: singL, survivorStateRate: 0.05, rNow: 0.32, conversionFill: 0, paths: 1000, seed: 12345,
  };
  const r1 = A.runProjection(Object.assign({}, cfg, { deterministic: false }));
  const r2 = A.runProjection(Object.assign({}, cfg, { deterministic: false }));
  ok('MC reproducible (same seed → identical bands + success)', JSON.stringify(r1.bands) === JSON.stringify(r2.bands) && r1.success === r2.success);
  ok('MC success in (0,1)', r1.success > 0 && r1.success < 1);
  ok('MC bands ordered p10<=p50<=p90', r1.bands.every(b => b.p10 <= b.p50 + 1 && b.p50 <= b.p90 + 1));
  const det = A.runProjection(Object.assign({}, cfg, { deterministic: true, paths: 1 }));
  ok('survivor marginal >= joint (single brackets, half std ded)', det.rThenSurvivor >= det.rThenJoint - 1e-9);
  const v = A.switchPointVerdict(cfg.rNow, det.rThenJoint, det.rThenSurvivor);
  ok('switch-point verdict is Roth or Traditional', ['Roth', 'Traditional'].includes(v.verdict));
  // §6.6 conversion window: filling 24% bracket converts >0 and lowers the first RMD
  const conv = A.runProjection(Object.assign({}, cfg, { deterministic: true, paths: 1, conversionFill: 394600 }));
  ok('conversion converts >0 and cuts first RMD', conv.converted > 0 && conv.convTax > 0 && conv.firstRmd < det.firstRmd);
  // Regression: a well-funded plan must read ~fully successful, NOT 0% (the gross-up rounding residual once
  // left net cash ~$5 short of spend and flagged every healthy path as depleted).
  const rich = A.runProjection(Object.assign({}, cfg, { deterministic: false, start: { pretax: 3000000, taxable: 1000000, roth: 1000000, taxfree: 100000, basis: 600000 }, spend: 80000 }));
  ok('well-funded plan is ~fully successful (not 0)', rich.success > 0.95);
  // Monotonic: higher spending lowers success.
  const lo = A.runProjection(Object.assign({}, cfg, { deterministic: false, spend: 60000 }));
  const hi = A.runProjection(Object.assign({}, cfg, { deterministic: false, spend: 200000 }));
  ok('higher spend → lower success', lo.success >= hi.success);
})();

/* ================= COLLEGE ENGINE + compact money ================= */
// Compact currency (chart axes): K/M/B/T, full dollars under $1,000.
ok('fmtCompactMoney 1,500 = $1.5K', A.fmtCompactMoney(1500) === '$1.5K');
ok('fmtCompactMoney 2.5M', A.fmtCompactMoney(2500000) === '$2.5M');
ok('fmtCompactMoney 3.4B', A.fmtCompactMoney(3.4e9) === '$3.4B');
ok('fmtCompactMoney 1.2T', A.fmtCompactMoney(1.2e12) === '$1.2T');
ok('fmtCompactMoney under 1k = full', A.fmtCompactMoney(940) === '$940');

// 529 glide group targets → μ/σ (stocks/bonds map to representative classes)
near('college 60/40 group μ = 3.72%', A.collegeGroupMuSigma({ stocks: 60, bonds: 40 }).mu * 100, 3.72, 0.01);

// Deterministic 529 projection: 5% growth, no contributions, no cost → grows startBal to college age.
(() => {
  const cfg = { startBal: 200000, currentAge: 10, startAge: 18, years: 4, annualCost: 0, annualContrib: 0, contribGrowth: 0,
    msByAge: () => ({ mu: 0.05, sigma: 0 }), paths: 1, seed: 1, deterministic: true };
  const r = A.runCollegeProjection(cfg);
  ok('college band[0] = starting balance', Math.round(r.bands[0].p50) === 200000);
  near('college balance at 18 = 200k×1.05^8', r.bands.find(b => b.age === 18).p50, 200000 * Math.pow(1.05, 8), 1);
  ok('college fully funded when cost is 0', r.fullSuccess === 1 && r.avgYearsFunded === 4);
})();

// Deterministic 529: modest balance, real cost, 5% growth → partial funding, funded-years counted.
(() => {
  const cfg = { startBal: 60000, currentAge: 16, startAge: 18, years: 4, annualCost: 40000, annualContrib: 0, contribGrowth: 0,
    msByAge: () => ({ mu: 0.05, sigma: 0 }), paths: 1, seed: 1, deterministic: true };
  const r = A.runCollegeProjection(cfg);
  ok('college underfunded → fullSuccess 0', r.fullSuccess === 0);
  ok('college funds some but not all years', r.avgYearsFunded >= 1 && r.avgYearsFunded < 4);
})();

// MC 529 reproducible + success in [0,1]
(() => {
  const cfg = { startBal: 50000, currentAge: 8, startAge: 18, years: 4, annualCost: 30000, annualContrib: 3000, contribGrowth: 0,
    msByAge: () => A.blendMuSigma({ us_large: 60, us_bond: 40 }), paths: 500, seed: 24680 };
  const r1 = A.runCollegeProjection(Object.assign({}, cfg, { deterministic: false }));
  const r2 = A.runCollegeProjection(Object.assign({}, cfg, { deterministic: false }));
  ok('college MC reproducible', JSON.stringify(r1.bands) === JSON.stringify(r2.bands) && r1.fullSuccess === r2.fullSuccess);
  ok('college success in [0,1]', r1.fullSuccess >= 0 && r1.fullSuccess <= 1);
})();

(() => {
  const q = A.migrate(JSON.parse(JSON.stringify(v2)));
  q.accounts.push({id: 'second_ira', name: 'Traditional IRA', vehicle: 'ira', category: 'Retirement', taxTreatment: 'Pre-tax', status: 'active'});
  q.taxSettings.householdMonthlySavings = 10000;
  q.taxSettings.ytdContributions = {second_ira: 2000};
  A.portfolio = q;
  const d = A.savingsDirective(q.snapshots[0]);
  const iraAnnual = d.splits.filter(x => ['a_roth', 'second_ira'].includes(x.accountId)).reduce((sum, x) => sum + x.pctOrAmt * 12, 0);
  near('all IRAs share remaining contribution limit', iraAnnual, 5500, 0.01);
})();

near('MA 2026 indexed surtax threshold', R.maSurtax.threshold, 1107750, 0);
near('SSA 2026 second PIA bend point', A.estimatePIAmonthly(7749 * 12), 1286 * 0.9 + (7749 - 1286) * 0.32, 1e-9);

(() => {
  const cfg = {startBal: 40000, currentAge: 18, startAge: 18, years: 4, annualCost: 10000,
    annualContrib: 0, contribGrowth: 0, msByAge: () => ({mu: 0, sigma: 0}), deterministic: true};
  const c = A.runCollegeProjection(cfg);
  near('college entry year tuition is included', c.bands[0].p50, 30000, 0.01);
  near('college current entry year funds all four years', c.fullSuccess, 1, 0);
  const late = A.runCollegeProjection({...cfg, currentAge: 20, startBal: 20000});
  near('already enrolled college counts remaining years only', late.remainingYears, 2, 0);
  near('already enrolled college can succeed', late.fullSuccess, 1, 0);
})();

ok('report includes target classes with zero holdings', A.allocTableHTML([{id: 'us_large', label: 'US Large', value: 100, pct: 100}], {us_large: 80, em: 20}, 5).includes('Emerging'));

/* Financial review regressions: independent cash-flow and tax identities. */
near('SS only below combined-income threshold is federally exempt', A.taxableSocialSecurity(30000, 0, 'single'), 0, 1e-9);
near('SS single lower tier', A.taxableSocialSecurity(20000, 20000, 'single'), 2500, 1e-9);
near('SS joint upper tier', A.taxableSocialSecurity(30000, 40000, 'mfj'), 15350, 1e-9);
near('SS capped at 85%', A.taxableSocialSecurity(20000, 200000, 'single'), 17000, 1e-9);
near('SS includes tax exempt interest', A.taxableSocialSecurity(20000, 0, 'single', 20000), 2500, 1e-9);
// Box-Muller z=0 must produce the same geometric growth as the deterministic path.
let zeroNormalIndex = 0;
near('lognormal median matches deterministic 5%', A.drawReturnFrom(() => ++zeroNormalIndex % 2 ? 0.5 : 0.25, 0.05, 0.16), 0.05, 1e-12);
(() => {
  const opts = {age: 70, spendNet: 60000, ssGross: 0, filing: 'single', fedBrackets: singB, ltcgBrackets: singL,
    stdDed: 16100, stateRate: 0, niitRate: 0.038, niitThreshold: 200000, taxesSSstate: false, forcedRMD: 0};
  const gains = A.decumulateYear({pretax: 0, taxable: 100000, roth: 0, taxfree: 0}, 0, opts);
  near('unused deduction shelters gains before 0% threshold', gains.tax, 0, 1e-6);
  const pension = A.decumulateYear({pretax: 0, taxable: 0, roth: 0, taxfree: 0}, 0,
    {...opts, spendNet: 10000, pensionGross: 50000});
  near('surplus pension cash is reinvested after tax', pension.buckets.taxable + pension.tax + pension.netCash, 50000, 1e-6);
  near('surplus reinvestment receives cost basis', pension.basis, pension.buckets.taxable, 1e-6);
  const rich = A.decumulateYear({pretax: 1000000, taxable: 0, roth: 0, taxfree: 0}, 0,
    {...opts, age: 50, spendNet: 300000, stateRate: 0.13});
  near('high-tax gross-up actually delivers requested cash', rich.netCash, 300000, 0.01);
  const exhausted = A.decumulateYear({pretax: 10000, taxable: 0, roth: 0, taxfree: 0}, 0,
    {...opts, spendNet: 10000, stdDed: 0});
  near('final tax bill counted as shortfall', exhausted.shortfall, 1000, 0.01);
  const cfg = {start: {pretax: 100000, taxable: 0, roth: 0, taxfree: 0, basis: 0}, contrib: {}, contribGrowth: 0,
    currentAge: 74, retireAge: 74, spend: 0, weightsNow: {us_large: 1}, muSigma: A.RETIRE_DATA.muSigma,
    filing: 'single', fedBrackets: singB, ltcgBrackets: singL, stdDed: 16100, stateRate: 0, niitRate: 0.038,
    niitThreshold: 200000, taxesSSstate: false, ssGross: 0, ssClaimAge: 67, birthYearPrimary: 1960,
    survivorAtAge: 999, survivorStdDed: 16100, survivorFedBrackets: singB, survivorLtcgBrackets: singL,
    survivorStateRate: 0, paths: 1, deterministic: true};
  const rmd = A.runProjection(cfg);
  near('RMD uses previous year-end balance before current growth', rmd.firstRmd, 100000 / 24.6, 1e-6);
  const incomeOnly = A.runProjection({...cfg, start: {pretax: 0, taxable: 0, roth: 0, taxfree: 0, basis: 0},
    ssGross: 20000, spend: 20000});
  near('fully funded income-only plan succeeds with zero ending assets', incomeOnly.success, 1, 1e-9);
})();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
