const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { loadCatalog, validateCatalog, coverage, catalogScript, readApp } = require('../scripts/instrument-catalog');
const { buildSite } = require('../scripts/build-site');
const audit = require('../data/instrument-audit.json');
const catalog = loadCatalog();
const copy = () => structuredClone(catalog);
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('✓ ' + name); }
function appAPI(html) {
  const sandbox = { window: { addEventListener() {} }, document: { addEventListener() {} }, self: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(html.match(/\n<script>\n([\s\S]*)\n<\/script>/)[1] + '\nwindow.profile = tickerProfile; window.identity = holdingIdentity; window.parseRows = parseImportRows; window.matches = importMatches;', sandbox);
  return { ...sandbox.window.__AAT__, profile: sandbox.window.profile, identity: sandbox.window.identity, parseRows: sandbox.window.parseRows, matches: sandbox.window.matches, api: sandbox.window.__AAT__ };
}
const A = appAPI(readApp());
check('direct crypto and ETFs retain separate identities through imports and save/reload', () => {
  for (const symbol of ['BTC', 'ETH', 'XRP']) {
    assert.equal(A.identity(symbol, '', ''), null);
    const fund = A.identity(symbol, 'etf', '');
    const direct = A.identity(symbol, 'direct', 'A misleading fund name');
    assert.equal(fund.ticker, symbol);
    assert.equal(fund.instrumentKind, 'etf');
    assert.equal(direct.ticker, symbol + '-DIRECT');
    assert.match(direct.name, /held directly/);
    assert.equal(direct.instrumentKind, 'direct-crypto');
    assert.equal(A.classifyTicker(direct.ticker, {}), 'crypto');
    assert.equal(A.identity(direct.ticker, '', '').name, direct.name);
  }
  const p = A.emptyPortfolio();
  p.accounts.push({ id: 'crypto-account', name: 'Test', category: 'Non-Retirement', status: 'active' });
  const identities = [A.identity('BTC', 'etf', ''), A.identity('BTC', 'direct', '')];
  p.holdings = identities.map((identity, i) => ({ ...identity, id: 'crypto-' + i, accountId: 'crypto-account', assetClass: 'crypto', status: 'active' }));
  p.holdings.push({ id: 'legacy', ticker: 'ETH', accountId: 'crypto-account', assetClass: 'crypto', status: 'active' });
  A.api.portfolio = A.migrate(JSON.parse(JSON.stringify(p)));
  assert.equal(A.api.portfolio.holdings[1].ticker, 'BTC-DIRECT');
  assert.equal(A.api.portfolio.holdings[0].instrumentKind, 'etf');
  const parsed = A.parseRows('Ticker,Name,Value\nBTC,ETF,100\nBTC,Bitcoin,200\nETH,Ethereum ETF,300');
  assert.equal(parsed.length, 3);
  A.ui.import = { accountId: 'crypto-account', parsed, identityChoices: {} };
  assert.equal(A.matches().unresolved.length, 3);
  A.ui.import.identityChoices = { 0: 'etf', 1: 'direct', 2: 'etf' };
  const matches = A.matches();
  assert.equal(matches.unresolved.length, 0);
  assert.equal(matches.matched.length, 2);
  assert.equal(matches.matched.find(r => r.ticker === 'BTC-DIRECT').value, 200);
  assert.equal(matches.created[0].ticker, 'ETH');
  assert.equal(matches.missing[0].id, 'legacy');
  A.api.portfolio = A.emptyPortfolio();
  A.ui.import = null;
});
check('all legacy ticker mappings preserved except source-reviewed changes', () => {
  const map = Object.fromEntries(catalog.instruments.map(r => [r.symbol, r.assetClass]));
  for (const entry of audit.classificationChecks) {
    assert.equal(map[entry.symbol], entry.after);
    if (entry.before === null) delete map[entry.symbol];
    else map[entry.symbol] = entry.before;
  }
  assert.equal(Object.keys(map).length, 1966);
  const ordered = Object.fromEntries(Object.entries(map).sort(([a], [b]) => a.localeCompare(b)));
  assert.equal(crypto.createHash('sha256').update(JSON.stringify(ordered)).digest('hex'), '5c3d56628ece5e7a92ba451b0ab5a4871b8ee6312e9b4e585ae9329def47be0d');
});
check('corrected tickers normalize; mixed funds require choice; user overrides win', () => {
  assert.equal(A.classifyTicker(' vmbs ', {}), 'us_bond');
  assert.equal(A.classifyTicker('SPYM', {}), 'us_large');
  assert.equal(A.classifyTicker('SPTM', {}), 'us_total');
  for (const r of catalog.instruments.filter(r => r.assetClass === null)) {
    assert.equal(A.classifyTicker(r.symbol, {}), null);
    assert.equal(A.classifyTicker(r.symbol, { [r.symbol]: 'us_mid' }), 'us_mid');
  }
  assert.equal(A.classifyTicker('VMBS', { VMBS: 'us_mid' }), 'us_mid');
  assert.equal(A.classifyTicker('UNLISTED_TEST', {}), null);
  assert.equal(A.classifyTicker('__proto__', {}), null);
});
check('saved holdings, custom compositions, and snapshot values do not change', () => {
  const p = JSON.parse(JSON.stringify(A.emptyPortfolio()));
  p.accounts.push({ id: 'a', name: 'Test', category: 'Retirement', taxTreatment: 'Roth', status: 'active' });
  p.holdings.push({ id: 'h', accountId: 'a', ticker: 'VMBS', assetClass: 'us_mid', status: 'active', composition: { us_mid: 75, us_small: 25 } });
  p.snapshots.push({ id: 's', date: '2026-01-01', values: [{ holdingId: 'h', marketValue: 1234 }] });
  p.tickerMap.VMBS = 'us_mid';
  const loaded = JSON.parse(JSON.stringify(A.migrate(p)));
  assert.deepEqual(loaded.holdings, p.holdings);
  assert.deepEqual(loaded.snapshots, p.snapshots);
  assert.deepEqual(loaded.tickerMap, p.tickerMap);
});
check('bundled tax profiles remain estimates and explicit user data wins', () => {
  assert.equal(A.profile('VOO', 'us_large', {}).estimated, true);
  const user = { divYield: 2, qualifiedPct: 80, capGainDistPct: 0 };
  assert.equal(A.profile('VOO', 'us_large', { tickers: { VOO: user } }).profile, user);
  assert.equal(A.profile('SPYM', 'us_large', {}).profile.divYield, A.profile('SPLG', 'us_large', {}).profile.divYield);
});
check('catalog rejects duplicates, invalid classes, incomplete reviews and unapproved fields', () => {
  for (const mutate of [
    c => c.instruments.push(c.instruments[0]),
    c => c.instruments[0].assetClass = 'bad',
    c => c.instruments[0].assetClass = null,
    c => c.instruments[0].expenseRatio = 0,
    c => c.usTotalSplit.us_large = 83,
    c => c.taxAssumptions.VOO.qualifiedPct = 101,
    c => c.washSaleReviewGroups[0].push('UNKNOWN'),
  ]) { const c = copy(); mutate(c); assert.throws(() => validateCatalog(c), /Instrument catalog/); }
});
check('coverage includes all audited fund candidates and does not treat missing as zero', () => {
  assert.equal(audit.fundUniverse.length, 448);
  assert.equal(new Set(audit.fundUniverse).size, audit.fundUniverse.length);
  for (const s of audit.fundUniverse) assert.ok(catalog.instruments.some(r => r.symbol === s));
  for (const s of ['SPAXX', 'VMFXX', 'SPLG', 'FXAIX', 'VOO']) assert.ok(audit.fundUniverse.includes(s));
  const c = coverage({ A: 0, B: null }, ['A', 'B', 'C']);
  assert.equal(c.populated, 1); assert.deepEqual(c.missing, ['B', 'C']);
  const ninety = Object.fromEntries(Array.from({ length: 9 }, (_, n) => [String(n), 0]));
  assert.equal(coverage(ninety, Array.from({ length: 10 }, (_, n) => String(n))).ratio > audit.minimumCoverageExclusive, false);
  assert.deepEqual(audit.newFinancialFields, {});
});
check('sourced fund names exceed 90%; incomplete fields remain outside both builds', () => {
  const { auditFundCoverage } = require('../scripts/audit-fund-coverage');
  const report = auditFundCoverage();
  assert.equal(report.names.populated, 418);
  assert.ok(report.names.ratio > 0.9);
  assert.equal(report.expenseRatios.enabled, false);
  assert.equal(report.feeObservations.populated, 433);
  assert.equal(report.accountedFor.populated, 448);
  assert.equal(report.identityResolutions.AVB.status, 'not-a-fund');
  assert.ok(report.expenseRatios.missing.includes('BTC'), 'sponsor fee is not a total expense ratio');
  assert.ok(report.feeObservations.missing.includes('SPLG'), 'successor identity is not a fee observation');
  assert.ok(!report.expenseRatios.missing.includes('FZROX'), 'a sourced zero remains populated');
  assert.equal(report.allocationSplits.enabled, false);
  const c = copy();
  c.instruments.filter(r => r.name).slice(0, 30).forEach(r => { delete r.name; });
  assert.throws(() => validateCatalog(c), /exceed 90% coverage/);
  const bad = copy(); delete bad.instruments.find(r => r.name).identitySource;
  assert.throws(() => validateCatalog(bad), /identity provenance/);
  assert.ok(!readApp().includes('issuer-fee-candidates'));
});
check('embedded catalog cannot close the app script', () => {
  const c = copy(); c.instruments.find(r => r.reviewNote).reviewNote = '</script><script>alert(1)</script>';
  assert.ok(!catalogScript(c).includes('</script>'));
});
check('hosted and offline builds contain the same catalog without a runtime data fetch', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'qm-instruments-'));
  try {
    buildSite(output, '', 'disabled');
    for (const file of ['app/index.html', 'downloads/quartermaster.html']) {
      const html = fs.readFileSync(path.join(output, file), 'utf8');
      assert.ok(html.includes(catalogScript()));
      assert.ok(!html.includes('/* INSTRUMENT_CATALOG:'));
      assert.ok(!/fetch\([^\n]*instruments\.json/.test(html));
      assert.equal(appAPI(html).classifyTicker('VMBS', {}), 'us_bond');
    }
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});
console.log(`${checks} instrument catalog regression groups passed`);
