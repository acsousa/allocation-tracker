/* Regression: dragging retirement spending must retain the selected dollar units. */
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname, '..', 'allocation-tracker.html'), 'utf8');
const script = html.match(/\n<script>\n([\s\S]*)\n<\/script>/)[1];
const nodes = Object.fromEntries(['retire-spend-label', 'retire-success', 'retire-fan'].map(id => [id, {}]));
const sandbox = {
  window: { addEventListener() {}, matchMedia() { return { matches: false }; } },
  document: { addEventListener() {}, getElementById(id) { return nodes[id] || null; } },
  console
};
vm.createContext(sandbox);
vm.runInContext(script + `
portfolio = { retirementSettings: { inflationPct: 10 } };
retireModel = () => ({cfg: {currentAge: 60, retireAge: 65}, base: {success: .75, bands: [{age: 61, p10: 100, p25: 200, p50: 300, p75: 400, p90: 500}]}});
fanChartSVG = bands => JSON.stringify(bands);
dollarModeIsFuture = () => true;
updateRetireLive(90000);
`, sandbox);
let band = JSON.parse(nodes['retire-fan'].innerHTML)[0];
assert.ok(Math.abs(band.p50 - 330) < 1e-8, 'Future-dollar median must remain inflated during slider updates');
assert.ok(Math.abs(band.p10 - 110) < 1e-8, 'Future-dollar percentile must retain inflation');
assert.match(nodes['retire-spend-label'].textContent, /90,000/);
assert.match(nodes['retire-success'].textContent, /75/);
vm.runInContext('dollarModeIsFuture = () => false; updateRetireLive(90000);', sandbox);
assert.equal(JSON.parse(nodes['retire-fan'].innerHTML)[0].p50, 300, 'Real-dollar display must remain uninflated');
assert.ok(!html.includes('even in the worst 10%, you'), 'Do not describe P10 as a guaranteed floor');
assert.ok(!html.includes('Most likely (median)'), 'Median is not the mode');
console.log('7 projection display checks passed');
