/* Import audited public-directory facts. Existing allocation choices and tax
 * assumptions stay unchanged. Uncertain new allocations require user review. */
const fs=require('node:fs'),path=require('node:path');const root=path.join(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const write=(p,v)=>fs.writeFileSync(path.join(root,p),JSON.stringify(v,null,2)+'\n');
function classify(row){
 const c=row.category||'',n=row.name.toLowerCase(),f=row.flags||{};
 if(f.isMoneyMarket||c==='Money Market')return 'cash';
 if(/target|allocation|balanced|convertible|long.short|market neutral|hedged equity|buffer|multi.asset|managed futures|global|world/i.test(c+' '+n)||f.isBalanced)return null;
 if(/\bbitcoin\b|\bethereum\b|\bsolana\b/i.test(n))return 'crypto';
 if(/real estate|REIT/i.test(c+' '+n))return 'reit';
 if(/commodities broad|commodity strategy/i.test(c+' '+n))return 'commod';
 if(f.isBond||/bond|government|muni|bank loan|securitized|fixed income/i.test(c))return /international|emerging|foreign/i.test(c+' '+n)?'intl_bond':'us_bond';
 if(/emerging/i.test(c+' '+n))return 'em';
 // Foreign large-cap categories can include emerging markets: no invented split.
 if(/international|foreign|region|japan|china|europe|pacific|ex.us/i.test(c+' '+n)||f.isInternational)return null;
 if(/total (?:stock )?market/i.test(n))return 'us_total';
 if(/Small[- ]Cap|^Small /i.test(c))return 'us_small';
 if(/Mid[- ]Cap/i.test(c))return 'us_mid';
 if(/Large[- ]Cap|^Large /i.test(c))return 'us_large';
 return null;
}
function run(){
 const d=read('data/research/issuer-directory-expansion.json'),waivers=read('data/research/issuer-directory-waivers.json').entries;
 const cat=read('data/instruments.json'),audit=read('data/instrument-audit.json'),kinds=read('data/instrument-kinds.json');
 const map=new Map(cat.instruments.map(r=>[r.symbol,r])),universe=new Set(audit.fundUniverse),added=[],fees={};
 const sourceMap=new Map(d.sources.map(s=>[s.url,s]));
 for(const [symbol,r] of Object.entries(d.entries)){
  if(!map.has(symbol)){
   const assetClass=classify(r);map.set(symbol,{symbol,assetClass,source:r.source,reviewedOn:d.retrievedOn,reviewNote:assetClass==null?'Issuer identity verified; mixed, global, sector or insufficient allocation detail. Choose and review the allocation; no fund split inferred.':'Broad allocation mapped from issuer category; not a measured holdings split.'});added.push(symbol);
  }
  const record=map.get(symbol);Object.assign(record,{name:r.name,identitySource:r.productSource,identityReviewedOn:d.retrievedOn});
  universe.add(symbol);kinds.entries[symbol]={kind:'fund',name:r.name,source:r.productSource,reviewedOn:d.retrievedOn};
  if(r.fee){
   const verification=r.verification?.status==='candidate'?r.verification:null;
   fees[symbol]={status:'primary-confirmed',identityMatched:true,source:verification?.source||r.source,retrievedOn:d.retrievedOn,sourceSHA256:verification?.sourceSHA256||sourceMap.get(r.source)?.sha256,...(r.cusip?{cusip:r.cusip}:{}),...r.fee,note:'Exact issuer-listed ticker/share class. Published total expenses, not sales loads, yields or performance. Retrieval date is not a fee-effective date.'};
  }
  if(waivers[symbol])fees[symbol]=waivers[symbol];
 }
 cat.instruments=[...map.values()].sort((a,b)=>a.symbol.localeCompare(b.symbol));cat.reviewedOn=d.retrievedOn;
 audit.fundUniverse=[...universe].sort();audit.issuerDirectoryExpansion={reviewedOn:d.retrievedOn,scope:d.scope,sourceFile:'data/research/issuer-directory-expansion.json',symbols:Object.keys(d.entries).sort(),addedSymbols:[...new Set([...(audit.issuerDirectoryExpansion?.addedSymbols||[]),...added])].sort(),excludedNonTickerCount:d.excludedNonTicker.length};
 write('data/instruments.json',cat);write('data/instrument-audit.json',audit);write('data/instrument-kinds.json',kinds);
 write('data/research/issuer-directory-fees.json',{schemaVersion:1,reviewedOn:d.retrievedOn,entries:fees});
 console.log(`Directory symbols ${Object.keys(d.entries).length}; added ${added.length}; catalog ${map.size}; fund universe ${universe.size}; directory fees ${Object.keys(fees).length}`);
}
if(require.main===module)run();module.exports={classify};
