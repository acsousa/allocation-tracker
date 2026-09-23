/* The public landing quotes this exact demo. Keep the copy and live engines tied together. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8');
const source = html.match(/\n<script>\n([\s\S]*)\n<\/script>/)[1];
const window = {
  addEventListener() {}, removeEventListener() {},
  matchMedia() { return { matches: false, addEventListener() {} }; },
  location: { hash: '', pathname: '/app/' },
  history: { replaceState() {} },
  sessionStorage: { getItem() { return null; }, removeItem() {}, setItem() {} },
};
const sandbox = {
  window, location: window.location,
  self: { matchMedia: window.matchMedia }, console,
  document: {
    addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; }, querySelector() { return null; },
    createElement() { return { style: {}, remove() {}, click() {} }; },
    body: { appendChild() {} }, documentElement: { removeAttribute() {}, setAttribute() {} },
  },
  getComputedStyle: () => ({ getPropertyValue: () => '#123456' }),
  setTimeout, clearTimeout,
};
vm.createContext(sandbox);
vm.runInContext(source + `
Object.assign(window.__AAT__, { taxScorecard, locationSwapRecs, retireModel, collegeModel });
`, sandbox, { filename: 'app.html' });

const A = window.__AAT__;
A.loadDemoData();
const p = A.portfolio;
const snapshot = A.latestSnapshot();
const allocation = A.allocate(A.householdHoldings(), snapshot);
assert.equal(allocation.total, 265000, 'landing portfolio total');
assert.equal(snapshot.values.reduce((sum, row) => sum + row.marketValue, 0), 280000, 'total including 529');

const fxnax = A.taxScorecard(snapshot).rows.find(row => row.ticker === 'FXNAX');
assert.equal(fxnax.accountName, 'Brokerage');
assert.ok(Math.abs(fxnax.drag - 359.92) < 0.01, 'FXNAX tax drag');
const swap = A.locationSwapRecs(snapshot)[0];
assert.equal(swap.aTicker, 'FXNAX');
assert.ok(Math.abs(swap.savingsPerYr - 298.04) < 0.01, 'modeled location improvement');
assert.equal(swap.oneTimeCost, 0);

const retirement = A.retireModel();
const retirementAge = retirement.base.bands.find(row => row.age === retirement.cfg.retireAge);
assert.ok(Math.abs(retirement.base.success - 0.8644) < 0.00001, 'retirement confidence');
assert.ok(Math.abs(retirementAge.p50 - 1948594.9973) < 1, 'retirement median');
assert.ok(Math.abs(retirementAge.p10 - 1110198.4942) < 1, 'retirement 10th percentile');

const college = A.collegeModel(p.children[0].id);
assert.ok(Math.abs(college.base.fullSuccess - 0.8664) < 0.00001, 'college full-funding probability');
assert.ok(Math.abs(college.base.avgYearsFunded - 3.8652) < 0.00001, 'college average years funded');

console.log('Landing demo audit passed: allocation, tax location, retirement, and college figures match the public story.');
