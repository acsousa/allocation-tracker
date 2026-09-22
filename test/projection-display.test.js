/* Regression: simulations rerun only on demand and stale retirement results stay visible. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');
let checks = 0;
function check(message, fn) { fn(); checks++; console.log('✓ ' + message); }

const runPanel = html.match(/function simulationRunPanel[\s\S]*?\n}\n\nfunction retireStaleNotice/)[0];
const retireView = html.match(/function renderRetire\(\)[\s\S]*?\n}\n\n\/\/ Assumptions panel/)[0];
const assumptions = html.match(/function retireAssumptionsPanel[\s\S]*?\n}\n\n\/\* =+/)[0];
const collegeView = html.match(/function renderCollege\(\)[\s\S]*?\n}\n\n\/\* College field commit/)[0];
const collegeSettings = html.match(/function applyCollegeSetting[\s\S]*?\n}\n\n\/\* =+/)[0];

check('run panel keeps the simple button-only layout', () => {
  assert.match(runPanel, />Run Simulation</);
  assert.ok(!runPanel.includes('Run ${Number(count).toLocaleString()} simulations'));
  assert.ok(!runPanel.includes('data-act="sim-paths"'));
});

check('retirement summarizes withdrawal confidence and an 85% savings gap', () => {
  assert.match(retireView, /<div class="kicker"[^>]*>Withdrawal confidence<\/div>/);
  assert.match(retireView, /<h4>Plan at a glance<\/h4>/);
  assert.match(retireView, /Additional savings/);
  assert.match(retireView, /Share of \$\{cfg\.paths\.toLocaleString\(\)\} simulated futures/);
  assert.match(retireView, /const firstDraw = firstDrawRow \? M\(firstDrawRow\.net \|\| 0, firstDrawRow\.age\) : spend/);
  assert.match(retireView, /After-tax amount available to spend in the first retirement year/);
  assert.ok(!retireView.includes('Before-tax amount drawn'));
  assert.match(retireView, /How this projection works/);
  assert.ok(!retireView.includes('<h4>Spending confidence</h4>'));
  assert.match(retireView, /savingsGap\.amount === 0 \? 'No gap'/);
  assert.ok(!retireView.includes('No modeled gap'));
});

check('retirement result cards share aligned heading and body geometry', () => {
  assert.match(html, /\.kicker \{ display:block;min-height:18px;font-size: 11px; line-height:18px;/);
  assert.match(html, /\.outlook-primary \.panel-hd \{ min-height:59px;box-sizing:border-box; \}/);
  assert.match(html, /\.retire-projection \.panel-hd h4,\.retire-confidence \.panel-hd h4 \{ font-size:24px;line-height:1\.15; \}/);
  assert.match(html, /\.retire-projection > \.kicker,\.retire-confidence > \.kicker \{ font-size:12px; \}/);
  assert.match(html, /\.retire-confidence \.retire-confidence-body \{ padding:18px 20px !important; \}/);
  assert.match(html, /\.withdrawal-kpi-copy \.kicker \{ white-space:nowrap;font-size:10px;/);
  assert.match(html, /\.retire-confidence \.projection-how \{ margin-bottom:18px; \}/);
  assert.match(retireView, /<details class="projection-how"><summary>How this projection works<\/summary>/);
});

check('retirement sections use concise headings and inset detail tables', () => {
  for (const label of ['RMD schedule', 'Detail projection', 'Assumptions']) assert.match(html, new RegExp('class="kicker"[^>]*>' + label));
  assert.ok(!html.includes('check the math'));
  assert.match(retireView, /retirefan', \{ showData: false \}/);
  assert.match(retireView, /padding:6px 20px 18px;[^`]*overflow-x:auto/);
  assert.match(retireView, /<section class="retire-tax-section">/);
});

check('simulation path count is configured in settings', () => {
  assert.match(html, /Simulation paths \(retirement &amp; college\)[\s\S]*data-act="sim-paths"/);
  assert.match(html, /Default 10,000\. Runs only when you press a simulation button\./);
});

check('browser workers include every retirement projection dependency', () => {
  assert.match(html, /const fns = \[retireCatOf, retireCorr, blendMuSigma, retireBracketTax, retireBracketMarginal/);
  assert.match(html, /const REFERENCE_DATA=\$\{JSON\.stringify\(\{ niitThreshold: REFERENCE_DATA\.niitThreshold \}\)\}/);
});

check('retirement contributions remain explicit model inputs', () => {
  assert.match(html, /does not apply that estimate automatically/);
  assert.match(html, /Use illustrative statutory ceilings/);
  assert.match(html, /const contrib = Object\.assign\(\{ pretax: 0, taxable: 0, roth: 0, taxfree: 0 \}, rs\.contribOverride \|\| \{\}\)/);
  assert.ok(!html.includes('Reset to inferred'));
});

check('retirement keeps the last completed model when inputs become stale', () => {
  assert.match(retireView, /if \(!RETIRE_CACHE\)/);
  assert.match(retireView, /const retireStale = !retireCacheIsCurrent\(\)/);
  assert.match(retireView, /data-retire-stale-card/);
  assert.match(retireView, /retireStaleNotice\(\)/);
});

check('spending changes show a selected draft without recomputing results', () => {
  assert.match(html, /id="retire-spend-draft"/);
  assert.ok(!html.includes('function updateRetireLive'));
  assert.match(html, /portfolio\.retirementSettings\.spendingTargetRealAnnual = Number\(t\.value\) \|\| 0; markDirty\(\); showRetireStaleIndicators\(\);/);
});

check('assumption edits retain cached results and expose a rerun notice', () => {
  assert.match(assumptions, /data-retire-assumptions/);
  assert.match(assumptions, /retireStaleNotice\(\)/);
  assert.match(html, /applyRetireSetting\(a, ds, t, inlineAssumption\)/);
  assert.match(html, /if \(!preserveCache\) invalidateRetireCache\(\)/);
});

check('college drawdown shading begins one year before withdrawal', () => {
  assert.match(html, /const drawdownBandStart = Math\.max\(cfg\.currentAge, cfg\.startAge - 1\)/);
  assert.match(html, /\{ age: drawdownBandStart, label: 'Drawdown years' \}/);
  assert.match(html, /shadeFrom: drawdownBandStart/);
  assert.match(html, /yellow band begins one year before the first withdrawal/);
  assert.match(collegeView, /shadeLabel: 'drawdown years', showData: false/);
});

check('college keeps completed results visible while revised inputs are stale', () => {
  assert.match(collegeView, /const collegeHasResults = portfolio\.children\.every\(child => COLLEGE_CACHE\.has\(child\.id\)\)/);
  assert.match(collegeView, /const collegeStale = !collegeCacheIsCurrent\(cid\)/);
  assert.match(collegeView, /collegeStaleNotice\(collegeStale\)/);
  assert.match(collegeView, /const inputCfg = buildCollegeConfig\(cid\)/);
  assert.ok(!collegeSettings.includes('invalidateCollegeCache'));
  assert.match(html, /data-kind="college">Re-run simulation/);
});

check('shared app footer is the only app-page disclaimer footer', () => {
  assert.equal((html.match(/<footer class="app-base-footer/g) || []).length, 1);
  assert.equal((html.match(/Suggestions, not advice — nothing is executed here/g) || []).length, 1);
});

check('allocation refinements keep related data compact and grouped', () => {
  assert.match(html, /\.page-intro-copy \{ flex:1 1 640px;max-width:none;min-width:0; \}/);
  assert.match(html, /grid-template-columns:repeat\(2,minmax\(180px,240px\)\)/);
  assert.match(html, /class="swatch" style="background:\$\{d\.color\}/);
  assert.match(html, /'College savings \(529\)'/);
  assert.ok(!html.includes('// 529 — one card per child'));
});

check('history places previous check-ins below the active history chart', () => {
  const historyView = html.match(/function renderHistory\(\)[\s\S]*?\n}\n\n\/\* =+/)[0];
  assert.ok(historyView.indexOf('${chartPanel}') < historyView.indexOf('${checkinsPanel}'));
});

check('projection language does not overstate percentile outcomes', () => {
  assert.ok(!html.includes('even in the worst 10%, you'));
  assert.ok(!html.includes('Most likely (median)'));
});

check('reports disclose the reference-data version and current-assumption treatment', () => {
  assert.match(html, /version: '2026\.1'/);
  assert.match(html, /referenceDataVersion: REFERENCE_DATA\.version/);
  assert.match(html, /Historical balances are preserved as entered; tax and projection results use the currently bundled assumptions/);
});

console.log(`${checks} projection display checks passed`);
