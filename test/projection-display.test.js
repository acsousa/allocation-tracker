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
  assert.match(runPanel, /Run \$\{Number\(count\)\.toLocaleString\(\)\} simulations/);
  assert.ok(!runPanel.includes('data-act="sim-paths"'));
});

check('simulation path count is configured in settings', () => {
  assert.match(html, /Simulation paths \(retirement &amp; college\)[\s\S]*data-act="sim-paths"/);
  assert.match(html, /Default 10,000\. Runs only when you press a simulation button\./);
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

check('projection language does not overstate percentile outcomes', () => {
  assert.ok(!html.includes('even in the worst 10%, you'));
  assert.ok(!html.includes('Most likely (median)'));
});

console.log(`${checks} projection display checks passed`);
