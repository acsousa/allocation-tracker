/* Regression: simulations rerun only on demand and stale retirement results stay visible. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const path = require('node:path');

const html = require('../scripts/instrument-catalog').readApp();
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

check('retirement summarizes withdrawal confidence with plain-language levels and a savings gap', () => {
  assert.match(retireView, /<div class="kicker"[^>]*>Withdrawal confidence<\/div>/);
  assert.match(retireView, /<h4>Plan at a glance<\/h4>/);
  assert.match(retireView, /Additional Savings Gap/);
  assert.match(retireView, /Overall confidence that the selected spending lasts through age \$\{cfg\.endAge\}/);
  assert.match(retireView, /const annualSpending = spend/);
  assert.match(retireView, /Annual spending target/);
  assert.match(retireView, /How much you plan to spend each year in retirement, in today’s dollars/);
  assert.match(retireView, /How this projection works/);
  assert.ok(retireView.includes('Withdrawal confidence summarizes thousands of simulated market outcomes'));
  assert.ok(retireView.includes('High means at least 85% of simulated futures fund the plan, Medium means 70–84%, and Low means below 70%.'));
  assert.match(retireView, /\$\{confidenceLevel\}<\/strong>/);
  assert.ok(!retireView.includes('${fmtPct(base.success * 100, 0)}'));
  assert.match(retireView, /through age \$\{cfg.endAge\}/);
  assert.ok(!retireView.includes('${RETIRE_DATA.endAge}'));
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
  assert.match(html, /\{ age: drawdownBandStart, label: 'Plan peak', showAge: false \}/);
  assert.match(html, /shadeFrom: drawdownBandStart/);
  assert.match(html, /yellow band covers the decline into the first bill/);
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
  assert.equal((html.match(/All content and tools on this platform are for educational and informational purposes only\./g) || []).length, 1);
});

check('allocation refinements keep related data compact and grouped', () => {
  assert.match(html, /\.page-intro-copy \{ flex:1 1 640px;max-width:none;min-width:0; \}/);
  assert.match(html, /grid-template-columns:repeat\(2,minmax\(180px,240px\)\)/);
  assert.match(html, /class="swatch" style="background:\$\{d\.color\}/);
  assert.match(html, /'College savings \(529\)'/);
  assert.ok(!html.includes('// 529 — one card per child'));
});

check('dashboard KPIs make the 529 denominator and prior-check-in growth explicit', () => {
  const kpis = html.match(/function dashKpiHTML\([\s\S]*?\n}\n\nfunction drillScopeLabel/)[0];
  assert.match(kpis, /Total including 529: \$\{fmtMoney\(grandTotal\(snap\)\)\}/);
  assert.match(kpis, /Growth since prior check-in/);
  assert.match(kpis, /includes cash flows/);
  assert.match(kpis, /const prevAlloc = allocate\(holdings, prev\)/);
  assert.ok(!kpis.includes('<div class="kicker">Drift band</div>'));
  assert.ok(kpis.indexOf('Growth since prior check-in') < kpis.indexOf('Goal in force'));
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

check('retirement and college keep milestones visible while the hover cursor moves', () => {
  const vm = require('node:vm'), elements = new Map(), charts = [];
  const context = {window:{addEventListener(){}}, self:{}, console, document:{
    addEventListener(){}, getElementById:id=>elements.get(id), querySelectorAll:()=>charts,
  }};
  vm.createContext(context);
  const source = html.match(/\n<script>\n([\s\S]*)\n<\/script>/)[1];
  vm.runInContext(source + '\nwindow.fanTest = {fanChartSVG,onFanHover,onFanLeave,withdrawalConfidenceLevel};', context);
  const api = context.window.fanTest;
  assert.equal(api.withdrawalConfidenceLevel(0.69), 'Low');
  assert.equal(api.withdrawalConfidenceLevel(0.70), 'Medium');
  assert.equal(api.withdrawalConfidenceLevel(0.849), 'Medium');
  assert.equal(api.withdrawalConfidenceLevel(0.85), 'High');
  const bands = [60,61].map(age=>({age,p10:100,p25:200,p50:300,p75:400,p90:500}));
  for (const id of ['retirefan', 'collegefan-child']) {
    const markup = api.fanChartSVG(bands,{age:60,label:'Milestone'},id,{showData:false});
    assert.match(markup, /stroke-dasharray="3 3"/);
    assert.ok(markup.includes(`<g id="${id}-marker" pointer-events="none" style="transition:opacity 160ms ease;">`), 'default milestone is initially visible');
    assert.match(markup, /<g pointer-events="none">/);
    const chart = {dataset:{fanchart:id},contains:node=>node?.chart===chart};charts.push(chart);
    for(const suffix of ['-cursor','-cdot','-cval','-readout']) elements.set(id+suffix,{style:{display:'none'},setAttribute(){},textContent:''});
    elements.set(id+'-marker',{style:{display:'',opacity:''}});
    const hit = {chart,dataset:{fanid:id,age:'61',cx:'706'},closest:selector=>selector==='.fanhit'?hit:chart};
    api.onFanHover({target:hit,type:'pointermove'});
    assert.equal(elements.get(id+'-marker').style.display,'', 'hover keeps the fixed milestone visible');
    assert.equal(elements.get(id+'-marker').style.opacity,'', 'distant hover keeps the fixed milestone at full strength');
    assert.equal(elements.get(id+'-cursor').style.display,'');
    assert.equal(elements.get(id+'-cval').style.display,'');
    api.onFanLeave({target:hit,relatedTarget:{chart}});
    assert.equal(elements.get(id+'-cursor').style.display,'', 'moving within the graph retains the indicator');
    assert.equal(elements.get(id+'-marker').style.display,'', 'moving within the graph keeps the fixed milestone visible');
    const nearHit = {chart,dataset:{fanid:id,age:'60',cx:'60'},closest:selector=>selector==='.fanhit'?nearHit:chart};
    api.onFanHover({target:nearHit,type:'pointermove'});
    assert.equal(elements.get(id+'-marker').style.opacity,'0.16', 'nearby hover fades the fixed milestone to avoid overlap');
    api.onFanLeave({target:hit,relatedTarget:null});
    for(const suffix of ['-cursor','-cdot','-cval']) assert.equal(elements.get(id+suffix).style.display,'none');
    assert.equal(elements.get(id+'-marker').style.display,'', 'leaving keeps the milestone marker visible');
    assert.equal(elements.get(id+'-marker').style.opacity,'', 'leaving restores the fixed milestone to full strength');
    assert.match(elements.get(id+'-readout').textContent,/Hover, tap, or focus/);
    api.onFanHover({target:hit,type:'focusin'});
    assert.equal(elements.get(id+'-cval').style.display,'', 'keyboard focus can reveal a value');
    api.onFanLeave({target:hit,type:'focusout',relatedTarget:{}});
    assert.equal(elements.get(id+'-cval').style.display,'none');
    assert.equal(elements.get(id+'-marker').style.display,'', 'keyboard interaction keeps the milestone visible');
  }
  const report = api.fanChartSVG(bands,{age:60,label:'Milestone'},'reportfan',{static:true});
  assert.match(report,/stroke-dasharray="3 3"/);
  assert.ok(!report.includes('data-fanchart='));
  const noAge = api.fanChartSVG(bands,{age:60,label:'Plan peak',showAge:false},'college-label',{showData:false});
  assert.match(noAge, />Plan peak<\/text>/);
  assert.ok(!noAge.includes('Plan peak 60'));
});

console.log(`${checks} projection display checks passed`);
