const assert = require('node:assert/strict');
const vm = require('node:vm');
const { buildRetirementSimulator, extractRetirementEngine } = require('../scripts/retirement-engine');
const context = { module: { exports: {} } };
vm.runInNewContext(buildRetirementSimulator(), context);
const M = context.module.exports;
const base = { ...M.defaults };
const plain = o => JSON.parse(JSON.stringify(o));
assert.equal(M.validate(base).valid, true);
for (const patch of [{ currentAge: '' }, { savings: null }, { monthlySpending: Infinity }, { stocksPct: -1 },
  { retirementAge: 39 }, { currentAge: 40.5 }, { planThroughAge: 65 }, { savings: false }, { socialSecurityAge: 61 }]) {
  assert.equal(M.validate({ ...base, ...patch }).valid, false, JSON.stringify(patch));
  assert.throws(() => M.run({ ...base, ...patch }, { paths: 1 }));
}
assert.throws(() => M.run(base, { paths: 0 }));
assert.throws(() => M.run(base, { paths: 10001 }));
assert.throws(() => M.run(base, { seed: NaN }));
const a = M.run(base, { paths: 100, seed: 7 });
assert.deepEqual(plain(a), plain(M.run(base, { paths: 100, seed: 7 })));
assert.equal(a.bands[0].p50, base.savings);
assert.equal(a.retirementBalance, a.bands.find(b => b.age === base.retirementAge - 1).p50);
assert.equal(a.firstRetirementYearEnd, a.bands.find(b => b.age === base.retirementAge).p50);
assert.deepEqual(plain(M.compare(base, 'save-more', { paths: 100, seed: 7 }).baseline), plain(a));
assert.ok(M.compare(base, 'save-more', { paths: 100, seed: 7 }).scenario.retirementBalance > a.retirementBalance);
assert.ok(M.compare(base, 'spend-less', { paths: 100, seed: 7 }).scenario.success >= a.success);
assert.throws(() => M.compare(base, 'unrecognized', { paths: 1 }));
const core = {};
vm.runInNewContext(`${extractRetirementEngine()}\nthis.project = runProjection;`, core);
assert.deepEqual(plain(core.project(M.config(base, { paths: 100, seed: 7 })).bands), plain(a.bands));
// Pure deterministic cash-flow fixture using the same extracted engine, with zero returns.
const fixture = { ...base, currentAge: 60, retirementAge: 62, planThroughAge: 64, savings: 100000,
  monthlyContribution: 1000, monthlySpending: 2000, stocksPct: 0 };
const cfg = M.config(fixture, { deterministic: true });
cfg.muSigma = { us_bond: [0,0], us_total: [0,0] };
const known = core.project(cfg);
assert.deepEqual(plain(known.bands.map(b => b.p50)), [100000,112000,88000,64000,40000]);
assert.equal(known.detTable[2].tax, 0);
assert.equal(known.detTable[2].withdrawn, 24000);
const retired = { ...fixture, retirementAge: 60, monthlyContribution: 0 };
const already = M.run(retired, { deterministic: true });
assert.equal(already.retirementBalance, retired.savings);
assert.equal(already.firstRetirementYearEnd, already.bands[1].p50);
const empty = M.run({ ...retired, savings: 0 }, { paths: 10 });
assert.equal(empty.success, 0);
const noNeed = M.run({ ...retired, savings: 0, monthlySpending: 0 }, { paths: 10 });
assert.equal(noNeed.success, 1);
const income = M.config({ ...retired, savings: 0, currentAge: 67, retirementAge: 67, planThroughAge: 70,
 socialSecurityMonthly: 1000, socialSecurityAge: 67, pensionMonthly: 1000, pensionAge: 60 }, { deterministic: true });
const covered = core.project(income);
assert.equal(covered.success, 1);
assert.ok(covered.detTable.slice(1).every(r => r.tax === 0 && r.withdrawn === 0 && r.net === 24000));
assert.equal(M.config(base).ssPeople.length, 0);
assert.equal(M.config(base).pensions.length, 0);
assert.equal(M.config(base).hasSpouse, false);
assert.equal(M.config(base).start.pretax, 0);
console.log('Standalone retirement model: validation, shared-engine equivalence, deterministic cash flows, comparisons, and retirement edge cases passed.');
