const assert=require('node:assert/strict');
const fs=require('node:fs');
const read=p=>JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../',p),'utf8'));
const d=read('data/research/issuer-directory-expansion.json'),cat=read('data/instruments.json'),a=read('data/instrument-audit.json'),k=read('data/instrument-kinds.json'),fees=read('data/fund-fees.json');
const {classify}=require('../scripts/import-issuer-directories');
const {selectFee}=require('../scripts/fund-fees');
assert.equal(Object.keys(d.entries).length,1768);
for(const [symbol,r] of Object.entries(d.entries)){
 const instrument=cat.instruments.find(x=>x.symbol===symbol);
 assert.equal(instrument.name,r.name,symbol);
 assert.ok(a.fundUniverse.includes(symbol),symbol);
 assert.equal(k.entries[symbol].kind,'fund',symbol);
 assert.ok(r.source && r.productSource,symbol);
}
assert.equal(d.excludedNonTicker.length,139);
assert.equal(a.issuerDirectoryExpansion.addedSymbols.length,1402);
for(const category of ['Global Large-Stock Blend','Target-Date 2050','Moderate Allocation','Foreign Large Blend'])assert.equal(classify({name:'Example fund',category}),null,category);
assert.equal(classify({name:'Example fund',category:'Money Market'}),'cash');
assert.equal(classify({name:'Example fund',category:'Intermediate Core Bond'}),'us_bond');
for(const symbol of ['FAAA','FCLO']){
 const r=read('data/research/issuer-directory-waivers.json').entries[symbol];
 assert.equal(selectFee(r,undefined,undefined,'2026-10-07').fee.expenseRatio,0);
 assert.ok(selectFee(r,undefined,undefined,'2027-02-01').reason);
}
for(const symbol of ['FCEXX','VTSMX'])assert.equal(fees.entries[symbol],undefined,'Missing fee must stay unknown');
const checks=read('data/research/issuer-directory-sample-checks.json').checks;
assert.equal(checks.length,23);
for(const c of checks){
 assert.equal(c.status,'matched');assert.ok(c.sourceSHA256);
 assert.equal(fees.entries[c.symbol].expenseRatio,c.netPct??c.expenseRatioPct,c.symbol);
}
console.log('Issuer expansion: 1768 identities, conservative classification, fee samples and waiver expiry verified');
