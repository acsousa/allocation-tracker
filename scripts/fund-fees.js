/* Normalize offline issuer observations into one applicable total-expense ratio.
 * Run `node scripts/fund-fees.js` after reviewing research updates. Never replace
 * an unknown total with a sponsor/management fee or a successor share class. */
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const reviewedOn = '2026-10-07';
const read = file => JSON.parse(fs.readFileSync(path.join(root, 'data', file), 'utf8'));
const number = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100;
function isoDate(value) {
  if (!value || value === '-') return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : null;
}
function selectFee(record, verification, disposition, date = reviewedOn) {
  if (record?.runtimeEligible === false) return { reason: 'reference only; expense denominator or identity requires review' };
  if (!record) return { reason: disposition ? `identity: ${disposition.status}` : 'no total-expense observation' };
  if (disposition) return { reason: `identity: ${disposition.status}` };
  if (!['candidate', 'primary-confirmed'].includes(record.status)) return { reason: 'source requires review' };
  if (record.identityMatched === false || verification && (verification.status !== 'matched' || verification.identityMatched !== true)) return { reason: 'product verification requires review' };
  if (!record.source || !/^https:\/\//.test(record.source) || !isoDate(record.retrievedOn)) return { reason: 'missing source or retrieval date' };
  const waiverEnd = isoDate(record.waiverExpiresOn || record.waiverExpiration || verification?.feeTable?.expirationDate?.value);
  if (waiverEnd && waiverEnd < date) return { reason: 'waiver expired; reconfirm total expenses' };
  // An old dated document is not made current merely by downloading it again.
  if (record.documentDate && Date.parse(date) - Date.parse(record.documentDate) > 366 * 864e5) return { reason: 'document older than one year; recheck required' };
  const field = number(record.netPct) ? 'netPct' : number(record.expenseRatioPct) ? 'expenseRatioPct' : number(record.grossPct) ? 'grossPct' : null;
  if (!field) return { reason: number(record.sponsorFeePct) ? 'sponsor fee only; total unknown' : 'no total-expense observation' };
  if (number(record.netPct) && number(record.grossPct) && record.netPct > record.grossPct) return { reason: 'net exceeds gross; reconcile source' };
  if (field === 'grossPct' && (waiverEnd || /(?:waiver|waived)/i.test(record.note || ''))) return { reason: 'gross only with a known waiver; net total unknown' };
  const asOf = isoDate(record[`${field}AsOf`] || record.asOf);
  if ((asOf && asOf > date) || record.retrievedOn > date || record.documentDate > date) return { reason: 'future-dated observation' };
  const fee = { expenseRatio: record[field], source: record.source, reviewedOn: record.retrievedOn,
    asOf, basis: field === 'netPct' ? 'net' : field === 'expenseRatioPct' ? 'issuer-total' : 'gross' };
  if (waiverEnd) fee.waiverEnd = waiverEnd;
  if (record.cusip) fee.cusip = record.cusip;
  if (record.documentDate) fee.documentDate = record.documentDate;
  if (record.documentMonth) fee.documentMonth = record.documentMonth;
  return { fee };
}
function buildFundFees(date = reviewedOn) {
  const files = ['issuer-fee-candidates.json', 'fidelity-fee-observations.json', 'issuer-gap-fee-observations.json', 'fidelity-expanded-fees.json', 'vanguard-expanded-fees.json', 'portfolio-fee-observations.json', 'issuer-directory-fees.json'];
  const records = Object.assign({}, ...files.map(f => read(`research/${f}`).entries));
  const verification = read('research/ishares-product-verification.json').entries;
  const resolutions = read('research/fund-identity-resolutions.json').entries;
  const universe = read('instrument-audit.json').fundUniverse;
  const entries = {}, excluded = {};
  for (const symbol of [...universe].sort()) {
    const result = selectFee(records[symbol], verification[symbol], resolutions[symbol], date);
    if (result.fee) entries[symbol] = result.fee; else excluded[symbol] = result.reason;
  }
  return { schemaVersion: 1, reviewedOn: date, units: 'percentage points; 0.03 means 0.03%',
    policy: 'Exact audited symbols only. Net total preferred, then issuer total, then gross without known waiver. No sponsor-only, adjusted-income, unresolved identity, expired-waiver, conflicting or stale-document substitutes. Retrieval/review dates are not fee-effective dates.',
    coverage: { accepted: Object.keys(entries).length, universe: universe.length, percent: Object.keys(entries).length / universe.length * 100 }, entries, excluded };
}
function loadFundFees() {
  const data = read('fund-fees.json');
  if (data.schemaVersion !== 1) throw Error('Unsupported fund-fee schema');
  for (const [symbol, fee] of Object.entries(data.entries)) {
    if (!number(fee.expenseRatio) || !['net','issuer-total','gross'].includes(fee.basis) || !fee.source?.startsWith('https://') || !isoDate(fee.reviewedOn)) throw Error(`Invalid normalized fund fee: ${symbol}`);
  }
  return data.entries;
}
if (require.main === module) {
  const data = buildFundFees();
  fs.writeFileSync(path.join(root, 'data/fund-fees.json'), JSON.stringify(data, null, 2) + '\n');
  console.log(JSON.stringify(data.coverage));
}
module.exports = { loadFundFees, buildFundFees, selectFee };
