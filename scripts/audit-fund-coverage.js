/* Offline coverage report. Only normalized accepted observations enter the app build. */
const fs = require('node:fs');
const path = require('node:path');
const {loadFundFees} = require('./fund-fees');
const { loadCatalog, coverage } = require('./instrument-catalog');
function auditFundCoverage() {
  const root = path.join(__dirname, '..');
  const audit = JSON.parse(fs.readFileSync(path.join(root, 'data/instrument-audit.json'), 'utf8'));
  const catalog = loadCatalog();
  const readResearch = name => JSON.parse(fs.readFileSync(path.join(root, 'data/research', name), 'utf8')).entries;
  const fees = Object.assign({}, ...['issuer-fee-candidates.json', 'fidelity-fee-observations.json', 'issuer-gap-fee-observations.json', 'fidelity-expanded-fees.json', 'vanguard-expanded-fees.json', 'portfolio-fee-observations.json', 'issuer-directory-fees.json'].map(readResearch));
  const resolutions = readResearch('fund-identity-resolutions.json');
  const hasNumber = (r, fields) => fields.some(k => typeof r?.[k] === 'number' && Number.isFinite(r[k]) && r[k] >= 0);
  const totalFields = ['grossPct', 'netPct', 'expenseRatioPct'];
  const totals = Object.fromEntries(Object.entries(fees).filter(([, r]) => hasNumber(r, totalFields)));
  const observations = Object.fromEntries(Object.entries(fees).filter(([, r]) => hasNumber(r, [...totalFields, 'sponsorFeePct'])));
  const universe = audit.fundUniverse;
  const names = Object.fromEntries(catalog.instruments.filter(r => r.name).map(r => [r.symbol, r.name]));
  return {
    universe: universe.length,
    minimumUsableRecords: Math.floor(universe.length * 0.9) + 1,
    names: { ...coverage(names, universe), enabled: true },
    normalizedExpenseRatios: { ...coverage(loadFundFees(), universe), enabled: true, status: 'Accepted offline total-expense observations under the documented normalization policy. Not a guarantee of current fees; known expiry dates require runtime checks.' },
    expenseRatios: { ...coverage(totals, universe), enabled: false,
      status: 'Collected total-expense observations only, not verified-current coverage. Sponsor fees alone do not count as total expenses. This raw observation coverage is distinct from the normalized fees enabled in the app.' },
    feeObservations: { ...coverage(observations, universe), enabled: false,
      status: 'Includes separately labeled sponsor fees. Collection does not imply current verification.' },
    identityResolutions: Object.fromEntries(universe.filter(s => resolutions[s]).map(s => [s, resolutions[s]])),
    accountedFor: { ...coverage({ ...observations, ...resolutions }, universe),
      status: 'A fee observation OR an identity disposition. This is not expense-ratio coverage and cannot enable a financial feature.' },
    allocationSplits: { ...coverage({}, universe), enabled: false,
      status: 'No complete dated splits validated against the app taxonomy. Geographic or sector tables alone are not equivalent to asset-class splits.' },
  };
}
if (require.main === module) console.log(JSON.stringify(auditFundCoverage(), null, 2));
module.exports = { auditFundCoverage };
