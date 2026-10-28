/* Concatenated after the app's pure retirement engine at build time.
 * All amounts are today's dollars. Constant real contributions and benefits.
 * A single synthetic taxfree bucket disables account-specific taxation, RMDs,
 * withdrawal penalties, and tax drag. It does NOT imply actual savings are tax-free.
 * Annual end-of-year steps match the portfolio engine: the first retirement-age
 * point includes that year's spending; contributions occur in earlier age steps.
 * Income offsets retirement spending only; working-year saving is entered directly.
 */
const RetirementSimulatorModel = (() => {
  const defaults = Object.freeze({ currentAge: 40, retirementAge: 65, planThroughAge: 95,
    savings: 250000, monthlyContribution: 1000, monthlySpending: 5000, stocksPct: 60,
    socialSecurityMonthly: 0, socialSecurityAge: 67, pensionMonthly: 0, pensionAge: 65 });
  const bounds = { currentAge: [18,100], retirementAge: [18,109], planThroughAge: [19,110],
    savings: [0,10000000], monthlyContribution: [0,10000000], monthlySpending: [0,10000000],
    stocksPct: [0,100], socialSecurityMonthly: [0,10000000], socialSecurityAge: [62,70],
    pensionMonthly: [0,10000000], pensionAge: [18,110] };
  const ageKeys = new Set(['currentAge','retirementAge','planThroughAge','socialSecurityAge','pensionAge']);
  const assumptions = Object.freeze({ dollars: 'today', taxes: 'not modeled', individualOnly: true,
    fees: 'not separately modeled', income: 'constant purchasing power; offsets retirement spending only',
    timing: 'Annual end-of-year balances; retirement-age balance includes the first retirement-year withdrawal',
    stocks: 'US Total Market', bonds: 'US Bonds', stockRealReturnPct: 5, bondRealReturnPct: 1.8,
    stockVolatilityPct: 16, bondVolatilityPct: 5, stockBondCorrelation: 0.1 });
  function validate(input) {
    const errors = {}, value = {};
    for (const [key, [min, max]] of Object.entries(bounds)) {
      const raw = input && input[key];
      const optional = key.startsWith('socialSecurity') || key.startsWith('pension');
      const v = raw === undefined && optional ? defaults[key] : raw;
      if ((typeof v !== 'number' && typeof v !== 'string') || (typeof v === 'string' && !v.trim()) || !Number.isFinite(Number(v))) {
        errors[key] = 'Enter a number.'; continue;
      }
      value[key] = Number(v);
      if (value[key] < min || value[key] > max) errors[key] = `Enter a value from ${min} to ${max}.`;
      else if (ageKeys.has(key) && !Number.isInteger(value[key])) errors[key] = 'Enter a whole-number age.';
    }
    if (value.retirementAge < value.currentAge) errors.retirementAge = 'For an already-retired estimate, use your current age.';
    if (value.planThroughAge <= value.retirementAge) errors.planThroughAge = 'Plan-through age must be later than retirement age.';
    return { valid: Object.keys(errors).length === 0, errors, value };
  }
  function config(input, options = {}) {
    const checked = validate(input);
    if (!checked.valid) { const e = new Error('Check the retirement inputs.'); e.errors = checked.errors; throw e; }
    const v = checked.value;
    const paths = options.paths ?? 10000, seed = options.seed ?? 20261027;
    if (!Number.isInteger(paths) || paths < 1 || paths > 10000) throw new Error('Paths must be an integer from 1 to 10000.');
    if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) throw new Error('Seed must be an unsigned 32-bit integer.');
    const zeroBrackets = [{ upTo: Infinity, rate: 0 }];
    return { currentAge: v.currentAge, retireAge: v.retirementAge, endAge: v.planThroughAge,
      paths, seed, deterministic: options.deterministic === true,
      start: { pretax: 0, taxable: 0, roth: 0, taxfree: v.savings, basis: 0 },
      contrib: { pretax: 0, taxable: 0, roth: 0, taxfree: v.monthlyContribution * 12 }, contribGrowth: 0,
      weightsNow: { us_total: v.stocksPct / 100, us_bond: 1 - v.stocksPct / 100 }, weightsTarget: null,
      muSigma: RETIRE_DATA.muSigma, workDrag: null, spend: v.monthlySpending * 12,
      filing: 'single', hasSpouse: false, birthYearPrimary: 2000, stdDed: 0, fedBrackets: zeroBrackets,
      ltcgBrackets: zeroBrackets, stateRate: 0, niitRate: 0, niitThreshold: Infinity, taxesSSstate: false,
      ssPeople: v.socialSecurityMonthly > 0 ? [{ claimAge: v.socialSecurityAge, annualBenefit: v.socialSecurityMonthly * 12 }] : [],
      pensions: v.pensionMonthly > 0 ? [{ startAge: v.pensionAge, amount: v.pensionMonthly * 12, cola: true }] : [],
      inflation: 0, conversionFill: 0 };
  }
  function run(input, options = {}) {
    const cfg = config(input, options), result = runProjection(cfg);
    return Object.assign(result, { input: validate(input).value, assumptions,
      retirementAge: cfg.retireAge,
      retirementBalance: result.bands.find(b => b.age === Math.max(cfg.currentAge, cfg.retireAge - 1)).p50,
      retirementBalanceLabel: cfg.retireAge === cfg.currentAge ? 'Savings today' : 'Median last working-year savings',
      firstRetirementYearEnd: result.bands.find(b => b.age === Math.max(cfg.currentAge + 1, cfg.retireAge)).p50,
      confidence: result.success >= .85 ? 'High' : result.success >= .70 ? 'Medium' : 'Low',
      paths: cfg.deterministic ? 1 : cfg.paths, seed: cfg.seed });
  }
  function compare(input, kind, options = {}) {
    const checked = validate(input);
    if (!checked.valid) return run(input, options); // Consistent validation exception.
    const changed = { ...checked.value };
    if (kind === 'save-more') changed.monthlyContribution += 250;
    else if (kind === 'retire-later') changed.retirementAge += 2;
    else if (kind === 'spend-less') changed.monthlySpending = Math.max(0, changed.monthlySpending - 250);
    else throw new Error('Unknown comparison.');
    return { baseline: run(checked.value, options), scenario: run(changed, options), input: changed, kind };
  }
  return Object.freeze({ defaults, assumptions, validate, config, run, compare });
})();
if (typeof globalThis !== 'undefined') globalThis.RetirementSimulatorModel = RetirementSimulatorModel;
if (typeof module !== 'undefined' && module.exports) module.exports = RetirementSimulatorModel;
