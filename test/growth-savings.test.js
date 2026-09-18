const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const script = html.match(/\n<script>\n([\s\S]*)\n<\/script>/)[1];
const sandbox = {
  window: { addEventListener() {}, matchMedia() { return { matches: false }; } },
  self: {}, console, setTimeout() {},
  document: { addEventListener() {}, getElementById() { return null; } },
};
vm.createContext(sandbox);
vm.runInContext(script, sandbox);
const A = sandbox.window.__AAT__;

const holding = { id: 'h1', accountId: 'a1', ticker: 'CASH', assetClass: 'cash', status: 'active' };
const snapshots = [
  { date: '2026-01-01', values: [{ holdingId: 'h1', marketValue: 10000 }] },
  { date: '2026-03-01', values: [{ holdingId: 'h1', marketValue: 10500 }] },
  { date: '2027-01-01', values: [{ holdingId: 'h1', marketValue: 11000 }] },
];
const growth = A.annualizedBalanceGrowth([holding], snapshots);
assert.ok(growth);
assert.ok(Math.abs(growth.annualized - 0.1) < 0.001);
assert.equal(growth.checkins, 3);
assert.equal(A.annualizedBalanceGrowth([holding], snapshots.slice(0, 2)), null);
assert.equal(A.annualizedBalanceGrowth([holding], [snapshots[0], { date: '2026-02-01', values: snapshots[1].values }, { date: '2026-03-01', values: snapshots[2].values }]), null);

assert.equal(A.inferVehicle({ name: 'High-yield savings', category: 'Non-Retirement' }), 'savings');
assert.equal(A.inferVehicle({ name: '12 month CD', category: 'Non-Retirement' }), 'savings');
assert.equal(A.inferVehicle({ name: 'Emergency fund', category: 'Savings' }), 'savings');
assert.equal(A.accountVehicle({ vehicle: 'savings' }), 'savings');

const p = A.emptyPortfolio();
p.accounts = [
  { id: 'a1', name: 'Savings', category: 'Savings', vehicle: 'savings', taxTreatment: 'Taxable', status: 'active' },
  { id: 'a2', name: '401(k)', category: 'Retirement', vehicle: '401k', taxTreatment: 'Pre-tax', status: 'active' },
];
p.holdings = [holding];
p.snapshots = snapshots;
p.retirementSettings.accountScope = 'retirement';
A.portfolio = p;
assert.doesNotThrow(() => A.migrate(p));
assert.deepEqual(Array.from(A.retireAccounts(), a => a.id), ['a2']);
p.retirementSettings.accountScope = 'all';
assert.deepEqual(Array.from(A.retireAccounts(), a => a.id), ['a1', 'a2']);

assert.equal(A.siteSimulationPaths(), 10000);
A.setSiteSimulationPaths(7500);
assert.equal(p.retirementSettings.paths, 7500);
assert.equal(p.collegeSettings.paths, 7500);
assert.equal(A.siteSimulationPaths(), 7500);
assert.equal(A.buildRetireConfig().paths, 7500);
assert.equal(A.buildCollegeConfig('missing-child').paths, 7500);

console.log('19 growth, savings, and simulation checks passed');
