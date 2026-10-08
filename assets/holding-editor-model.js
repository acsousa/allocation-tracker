/* Offline fund defaults plus portable user overrides. */
let holdingEditorRendering=false;
function renderHoldingEditor(){holdingEditorRendering=true;try{render();}finally{holdingEditorRendering=false;}}
const fundAssumptionFields = [
  {key:'fundType',label:'Investment type',type:'select',options:[['unknown','Needs identification'],['fund','Fund / ETF / plan option'],['direct','Direct security / cash / crypto']]},
  {key:'expenseRatio',label:'Annual expense ratio (%)',type:'number',min:0,max:100},
  {key:'expenseBasis',label:'Fee basis',type:'select',options:[['total','Total expenses'],['net','Net total expenses'],['gross','Gross — before waivers'],['published','Published — basis unspecified']]},
  {key:'source',label:'Source / statement reference',type:'text'},
  {key:'asOf',label:'Fee as-of date',type:'date'},
  {key:'waiverEnd',label:'Waiver end date (optional)',type:'date'},
  {key:'divYield',label:'Annual income yield assumption (%)',type:'number',min:0,max:100},
  {key:'qualifiedPct',label:'Qualified share of dividends (%)',type:'number',min:0,max:100},
  {key:'capGainDistPct',label:'Annual capital-gain distributions (% of value)',type:'number',min:0,max:100},
  {key:'usGovtPct',label:'Government-exempt share of ordinary income (%)',type:'number',min:0,max:100},
  ...[['muni','Municipal interest'],['inStateMuni','Qualifying in-state municipal interest'],['ftcEligible','Foreign-tax-credit assumption applies'],['qbiEligible','Qualifying REIT income assumption'],['collectible','Collectibles tax treatment'],['sixtyForty','Section 1256 treatment']].map(([key,label])=>({key,label,type:'boolean'}))
];
function instrumentKey(h) { const ticker=String(h.ticker||'').trim().toUpperCase();return `${ticker}|${cryptoSymbol(ticker)?h.instrumentKind||'security':directCryptoSymbol(ticker)?'direct-crypto':'security'}`; }
function contextualInstrument(h){
 const symbol=String(h.ticker||'').trim().toUpperCase(),name=String(h.name||'').trim().toUpperCase();
 return (typeof CONTEXTUAL_INSTRUMENTS==='undefined'?[]:CONTEXTUAL_INSTRUMENTS).find(r=>r.symbols.includes(symbol)&&r.name===name&&(!r.assetClass||r.assetClass===h.assetClass)&&(!r.accountCategory||accountById(h.accountId)?.category===r.accountCategory));
}
function defaultFundAssumptions(h) {
  const context=contextualInstrument(h);
  const base = {...(DEFAULT_TAX_PROFILE[h.assetClass]||DEFAULT_TAX_PROFILE.other),...(SEED_TAX_DATA[h.ticker]||{}),...(portfolio.taxData?.tickers?.[h.ticker]||{})};
  const direct = context?.kind==='direct' || h.instrumentKind==='direct-crypto' || /-DIRECT$/.test(h.ticker||'') || ['BITCOIN','ETHEREUM','CASH'].includes(String(h.ticker||'').toUpperCase()) || (typeof INSTRUMENT_KINDS!=='undefined'&&INSTRUMENT_KINDS[h.ticker]==='direct');
  const fee=direct?null:context?.expenseRatio!=null?{...context,basis:'issuer-total'}:(typeof FUND_FEES!=='undefined'?FUND_FEES[h.ticker]:null);
  return {...base,...(fee?{expenseRatio:fee.expenseRatio,expenseBasis:'total',feeOriginalBasis:fee.basis,source:fee.source,asOf:fee.reviewedOn,waiverEnd:fee.waiverEnd}:{}),fundType:direct?'direct':fee||(typeof INSTRUMENT_KINDS!=='undefined'&&INSTRUMENT_KINDS[h.ticker]==='fund')?'fund':'unknown'};
}
function resolvedFundAssumptions(h) {
  const key=instrumentKey(h),data=portfolio.fundAssumptions||{};
  return mergeFundAssumptions(h,data.shared?.[key]||{},data.accounts?.[h.accountId]?.[key]||{});
}
function mergeFundAssumptions(h,shared,account) {
 const result={...defaultFundAssumptions(h),...shared,...account};
 if(Object.hasOwn(shared,'expenseRatio'))for(const key of ['expenseBasis','source','asOf','waiverEnd'])result[key]=shared[key];
 // A changed rate must carry its own provenance, not borrow another rate's source.
 if(Object.hasOwn(account,'expenseRatio'))for(const key of ['expenseBasis','source','asOf','waiverEnd'])result[key]=account[key];
 return result;
}
function validateEffectiveTax(p) {
 if(p.inStateMuni&&!p.muni)throw Error('In-state municipal treatment requires municipal interest.');
 if(p.collectible&&p.sixtyForty)throw Error('Choose either collectibles or Section 1256 treatment, not both.');
 if(p.muni&&(p.qbiEligible||p.ftcEligible||p.collectible||p.sixtyForty))throw Error('Municipal interest conflicts with the selected REIT, foreign-credit, or special tax treatment. Reset the conflicting assumptions.');
}
function editorFundData() { return ui.checkin?.fundAssumptions || portfolio.fundAssumptions || {}; }
function fundTaxProfile(h) { return resolvedFundAssumptions(h); }
function validateFundOverrides(values) {
  const out={};
  for(const f of fundAssumptionFields) {
    const v=values[f.key]; if(v==null || v==='') continue;
    if(f.type==='number') { const n=parseNum(v);if(n==null||n<f.min||n>f.max) throw Error(`${f.label}: enter a number from ${f.min} to ${f.max}.`);out[f.key]=n; }
    else if(f.type==='boolean') { if(![true,false,'true','false'].includes(v)) throw Error(`${f.label}: choose Yes or No.`);out[f.key]=v===true||v==='true'; }
    else if(f.type==='select') { if(!f.options.some(([key])=>key===v)) throw Error(`${f.label}: choose a listed option.`);out[f.key]=v; }
    else if(f.type==='date') { if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v) throw Error(`${f.label}: enter a valid date.`);out[f.key]=v; }
    else { if(typeof v!=='string'||v.length>500)throw Error(`${f.label}: use at most 500 characters.`);out[f.key]=v.trim(); }
  }
  return out;
}
function validateFundData(data) {
  if(data==null)return;
  if(typeof data!=='object'||Array.isArray(data))throw Error('Invalid fund assumptions.');
  for(const group of [data.shared||{},...Object.values(data.accounts||{})]) {
    if(!group||typeof group!=='object'||Array.isArray(group))throw Error('Invalid fund assumption scope.');
    for(const value of Object.values(group)) {
      if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid fund assumption fields.');
      validateFundOverrides(value);
      for(const f of fundAssumptionFields) if(value[f.key]!=null&&((f.type==='number'&&typeof value[f.key]!=='number')||(f.type==='boolean'&&typeof value[f.key]!=='boolean')))throw Error('Invalid stored type for '+f.label);
    }
  }
}
function holdingAtSnapshot(h,s) { return s?.holdingDetails?.[h.id] || portfolio.holdingHistory?.[s?.date]?.[h.id] || h; }
function checkinHolding(h) { return {...h,...(ui.checkin?.holdingEdits?.[h.id]||{})}; }
function checkinHoldings(accountId) { return activeHoldings().map(checkinHolding).filter(h=>accountId==null||h.accountId===accountId); }
function preserveHoldingHistory(h) {
 for(const s of portfolio.snapshots) if(s.values.some(v=>v.holdingId===h.id)&&!s.holdingDetails?.[h.id]){
  portfolio.holdingHistory ||= {};portfolio.holdingHistory[s.date] ||= {};
  portfolio.holdingHistory[s.date][h.id] ||= JSON.parse(JSON.stringify(h));
 }
}
function commitHoldingEdits(ci) {
  if(ci.fundAssumptions)portfolio.fundAssumptions=ci.fundAssumptions;
  for(const [id,changes] of Object.entries(ci.holdingEdits||{})) {
    const h=portfolio.holdings.find(h=>h.id===id);if(!h)continue;
    preserveHoldingHistory(h);
    Object.assign(h,changes);
  }
}
function openHoldingEditor(hid,fromDraft=false) {
  const original=portfolio.holdings.find(h=>h.id===hid);if(!original)return;
  const snap=ui.view==='positions'?positionsSnapshot():currentSnapshot();
  const h=fromDraft?checkinHolding(original):holdingAtSnapshot(original,snap);
  const value=fromDraft?ui.checkin?.values[hid]:valueIndex(snap)[hid];
  const key=instrumentKey(h),data=editorFundData();
  const sharedEdits={...(data.shared?.[key]||{})},accountEdits={...(data.accounts?.[h.accountId]?.[key]||{})};
  holdingEditorRendering=true;try{openDialog({type:'holding-editor',hid,simpleEditor:true,baseHolding:h,currentAssumptionKey:key,draft:!!fromDraft,scope:'shared',snapshotDate:snap?.date,sharedEdits,accountEdits,assumptions:sharedEdits,
    values:{ticker:h.ticker||'',name:h.name||'',instrumentKind:h.instrumentKind||'',accountId:h.accountId,assetClass:h.assetClass||'other',marketValue:value?.marketValue??'',costBasis:value?.costBasis??'',longTermHolding:h.longTermHolding==null?'':String(h.longTermHolding),composition:h.composition?{...h.composition}:{}}});}finally{holdingEditorRendering=false;}
}
function captureHoldingEditor() {
  const d=ui.dialog;if(d?.type!=='holding-editor')return;
  for(const key of ['ticker','name','instrumentKind','accountId','assetClass','marketValue','costBasis','longTermHolding']) {
    const el=document.getElementById('he-'+key);if(el&&!el.disabled&&(key!=='assetClass'||el.value!=='')&&(el.type!=='checkbox'||d.longTermTouched))d.values[key]=el.type==='checkbox'?el.checked:el.value;
  }
  const allocation=document.querySelector?.('.he-allocation');if(allocation)d.allocationOpen=allocation.open;
  if(d.allocationEdited){d.values.composition={};for(const c of TAXONOMY.detail){const el=document.getElementById('he-split-'+c.id);if(el&&el.value.trim()!=='')d.values.composition[c.id]=el.value;}}
  for(const f of fundAssumptionFields) { const el=document.getElementById('he-a-'+f.key);if(el&&el.dataset.inherited!=='true')d.assumptions[f.key]=el.value; }
}
function editorInheritedAssumptions(d) {
  const h={...(d.baseHolding||portfolio.holdings.find(h=>h.id===d.hid)),...d.values};
  return d.scope==='account'?{...defaultFundAssumptions(h),...Object.fromEntries(Object.entries(d.sharedEdits).filter(([,v])=>v!==''&&v!=null))}:defaultFundAssumptions(h);
}
// Recorded check-ins may describe a different instrument than the current position.
// Only carry unsaved fund assumptions across an editor transition for the same identity.
function carryEditorFundEdits(previous,next) {
 const identity=d=>instrumentKey({...d.baseHolding,...d.values});
 if(identity(previous)!==identity(next)) {
  next.identityNotice='This position is now '+next.values.ticker+'. Its current fund assumptions are shown; historical fund assumptions were not copied.';
  return false;
 }
 next.sharedEdits=previous.sharedEdits;next.accountEdits=previous.accountEdits;
 next.scope=previous.scope;next.assumptions=next.scope==='account'?next.accountEdits:next.sharedEdits;
 return true;
}
function allocationMatchesCurrentHolding(d) {
 const current=portfolio.holdings.find(h=>h.id===d.hid);
 return current&&instrumentKey({...current,...(ui.checkin?.holdingEdits?.[d.hid]||{})})===instrumentKey({...d.baseHolding,...d.values});
}
function applyHoldingEditor(d) {
  if(demoMode)throw Error('Demo is read only.');
  if(d.allocationEdited){
    let sum=0;for(const value of Object.values(d.values.composition||{})){const n=parseNum(value);if(n==null||n<0||n>100)throw Error('Allocation percentages must be between 0 and 100.');sum+=n;}
    if(sum!==0&&Math.abs(sum-100)>0.01)throw Error('Allocation split must total 100%.');
    if(!d.draft){
      // Reject invalid fund inputs before opening a draft or changing the view.
      const shared=validateFundOverrides(d.sharedEdits),account=validateFundOverrides(d.accountEdits);
      const current=portfolio.holdings.find(h=>h.id===d.hid);
      validateEffectiveTax(mergeFundAssumptions({...current,...(ui.checkin?.holdingEdits?.[d.hid]||{})},shared,account));
      if(!allocationMatchesCurrentHolding(d))throw Error('This position now holds a different investment. Start a check-in to edit its current allocation.');
      if(!ui.checkin)ensureCheckinDraft();
      const before=d;openHoldingEditor(d.hid,true);d=ui.dialog;
      carryEditorFundEdits(before,d);
      d.values.composition=before.values.composition;d.values.assetClass=before.values.assetClass;
      ui.view=setupStep?'setup':'checkin';
    }
  }
  const original=portfolio.holdings.find(h=>h.id===d.hid);if(!original)throw Error('Holding not found.');
  const h=d.draft?checkinHolding(original):(d.baseHolding||original);
  const shared=validateFundOverrides(d.sharedEdits);let account=validateFundOverrides(d.accountEdits);
  if(d.simpleEditor){
    for(const key of ['expenseRatio','expenseBasis','source','asOf','waiverEnd','divYield'])delete account[key];
    if(Object.hasOwn(shared,'expenseRatio')){shared.expenseBasis='total';shared.source='User entered';shared.asOf=todayISO();delete shared.waiverEnd;}
    else for(const key of ['expenseBasis','source','asOf','waiverEnd'])delete shared[key];
  }
  let target=h,position;
  if(d.draft) {
    if(!ui.checkin)throw Error('Start a check-in before changing a position.');
    if(h.status==='archived')throw Error('This position is archived. Add a new holding for a new investment.');
    const v=d.values,ticker=String(v.ticker||'').trim().toUpperCase();
    if(![undefined,null,'',true,false,'true','false'].includes(v.longTermHolding))throw Error('Choose Unknown, Yes or No for holding period.');
    if(!ticker||ticker.length>40||!String(v.name||'').trim()&&ticker==='')throw Error('Enter a ticker or holding identifier.');
    if(v.instrumentKind==='direct-crypto'&&!cryptoSymbol(ticker)&&!directCryptoSymbol(ticker))throw Error('Held directly applies only to a recognized cryptocurrency.');
    const identity=holdingIdentity(ticker,v.instrumentKind==='direct-crypto'?'direct':v.instrumentKind,v.name);
    if(!identity)throw Error('Choose ETF or held directly for this crypto symbol.');
    if(!portfolio.accounts.some(a=>a.id===v.accountId&&a.status!=='archived'))throw Error('Choose an active account.');
    if(!DETAIL_BY_ID[v.assetClass])throw Error('Choose an asset class.');
    const composition={};for(const [key,value] of Object.entries(v.composition||{})){const n=parseNum(value);if(!DETAIL_BY_ID[key]||n==null||n<0||n>100)throw Error('Allocation percentages must be between 0 and 100.');if(n)composition[key]=n;}
    if(Object.keys(composition).length&&Math.abs(Object.values(composition).reduce((a,b)=>a+b,0)-100)>0.01)throw Error('Allocation split must total 100%.');
    target={...h,...identity,instrumentKind:identity.instrumentKind||(v.instrumentKind==='etf'?'etf':undefined),name:identity.instrumentKind==='direct-crypto'?identity.name:String(v.name||'').trim(),accountId:v.accountId,assetClass:v.assetClass,longTermHolding:v.longTermHolding===''||v.longTermHolding==null?undefined:(v.longTermHolding===true||v.longTermHolding==='true'),composition:Object.keys(composition).length?composition:null};
    if(checkinHoldings().some(x=>x.id!==h.id&&x.accountId===target.accountId&&instrumentKey(x)===instrumentKey(target)))throw Error('That investment already exists in this account. Edit its existing position.');
    const mv=parseNum(v.marketValue),cb=parseNum(v.costBasis);
    if(mv==null||mv<0)throw Error('Market value must be a nonnegative number.');
    if(String(v.costBasis??'').trim()&&(cb==null||cb<0))throw Error('Cost basis must be blank or a nonnegative number.');
    target.costBasis=cb==null?undefined:cb;
    position={marketValue:mv,costBasis:cb==null?'':cb};
  }
  // Validate completely before mutating portfolio or draft. Identity changes must
  // never copy fund assumptions silently onto a different investment.
  if(d.simpleEditor&&Object.hasOwn(shared,'expenseRatio')&&defaultFundAssumptions(target).fundType==='unknown')shared.fundType='fund';
  const changedIdentity=instrumentKey(target)!==instrumentKey(h);
  if(changedIdentity&&d.loadedInstrumentKey!==instrumentKey(target)&&(Object.keys(shared).length||Object.keys(account).length))throw Error('Reset fund assumptions before changing the ticker; apply identity first, then enter assumptions for the new investment.');
  const key=instrumentKey(target);
  if(!d.simpleEditor && target.accountId!==h.accountId && d.loadedAccountId!==target.accountId) {
    const original=validateFundOverrides(editorFundData().accounts?.[h.accountId]?.[instrumentKey(h)]||{});
    if(JSON.stringify(account)!==JSON.stringify(original))throw Error('Apply account-specific assumptions before moving the holding.');
    account=validateFundOverrides(editorFundData().accounts?.[target.accountId]?.[key]||{});
  }
  validateEffectiveTax(mergeFundAssumptions(target,shared,account));
  // Check shared changes in every account, including accounts with inherited flags.
  for(const other of portfolio.holdings.filter(x=>instrumentKey(x)===key&&x.accountId!==target.accountId))validateEffectiveTax(mergeFundAssumptions(other,shared,editorFundData().accounts?.[other.accountId]?.[key]||{}));
  if(d.draft){ui.checkin.holdingEdits ||= {};ui.checkin.holdingEdits[h.id]=target;ui.checkin.values[h.id]=position;ui.checkin.basisSet ||= {};ui.checkin.basisSet[h.id]=true;ui.checkinOpen[target.accountId]=true;checkinDraftDirty=true;}
  let data;
  if(ui.checkin) {ui.checkin.fundAssumptions ||= JSON.parse(JSON.stringify(portfolio.fundAssumptions||{shared:{},accounts:{}}));data=ui.checkin.fundAssumptions;checkinDraftDirty=true;}
  else {portfolio.fundAssumptions ||= {shared:{},accounts:{}};data=portfolio.fundAssumptions;}
  data.shared ||= {};data.accounts ||= {};
  if(!changedIdentity||d.loadedInstrumentKey===key){data.shared[key]=shared;data.accounts[target.accountId] ||= {};data.accounts[target.accountId][key]=account;
    if(d.simpleEditor)for(const group of Object.values(data.accounts))if(group[key])for(const field of ['expenseRatio','expenseBasis','source','asOf','waiverEnd','divYield'])delete group[key][field];}
  invalidateRetireCache();invalidateCollegeCache();markDirty();
}
function expenseAnalysis(snapshot) {
  const index=valueIndex(snapshot);
  const rows=holdingsForSnapshot(snapshot,'all').map(h=>{
    const value=Number(index[h.id]?.marketValue)||0,p=resolvedFundAssumptions(h);
    const ratio=p.expenseRatio,applicable=p.fundType==='fund';
    const usable=applicable&&typeof ratio==='number'&&Number.isFinite(ratio)&&ratio>=0&&['net','total'].includes(p.expenseBasis)&&!!p.asOf&&p.asOf<=todayISO()&&!!p.source&&!(p.waiverEnd&&p.waiverEnd<todayISO());
    return {h,value,p,usable,cost:usable?value*ratio/100:null};
  }).filter(r=>r.value>0);
  const eligible=rows.filter(r=>r.p.fundType!=='direct').reduce((n,r)=>n+r.value,0);
  const covered=rows.filter(r=>r.usable).reduce((n,r)=>n+r.value,0);
  const total=rows.reduce((n,r)=>n+(r.cost??0),0),unclassified=rows.filter(r=>r.p.fundType==='unknown').reduce((n,r)=>n+r.value,0);
  const instruments=new Map();for(const r of rows.filter(r=>r.p.fundType!=='direct')){const key=instrumentKey(r.h);instruments.set(key,(instruments.get(key)??true)&&r.usable);}
  const eligibleCount=instruments.size,coveredCount=[...instruments.values()].filter(Boolean).length;
  return {eligibleCount,coveredCount,rows:rows.sort((a,b)=>(b.cost??-1)-(a.cost??-1)),eligible,covered,total,unclassified,weighted:covered?total/covered*100:null,coverage:eligible?covered/eligible*100:null};
}
function holdingEditLink(hid,label,draft=false) {
 return `<button type="button" class="holding-edit-link" data-act="edit-holding" data-hid="${esc(hid)}"${draft?' data-draft="true"':''} aria-label="Edit ${esc(label)}">${esc(label)}</button>`;
}
function expenseFundRows(rows) {
 const groups=new Map();
 for(const row of rows){
  // Retain distinct legacy fee overrides and unknown fees rather than hiding them
  // behind a misleading single ratio. Fund/share-class identity stays exact.
  const key=JSON.stringify([instrumentKey(row.h),row.p.fundType,row.usable,row.usable?row.p.expenseRatio:null]);
  let group=groups.get(key);
  if(!group){group={...row,value:0,cost:row.usable?0:null,accountIds:[],accountNames:[]};groups.set(key,group);}
  group.value+=row.value;if(row.cost!=null)group.cost+=row.cost;
  if(!group.accountIds.includes(row.h.accountId)){group.accountIds.push(row.h.accountId);group.accountNames.push(accountById(row.h.accountId)?.name||'Unknown account');}
 }
 return [...groups.values()].map(group=>({...group,accountLabel:group.accountIds.length===1?group.accountNames[0]:`${group.accountIds.length} accounts`}));
}
function expenseSortRows(rows) {
 const sort=ui.expenseSort||{key:'cost',dir:-1};
 const getters={ticker:r=>r.h.ticker,account:r=>r.accountLabel||accountById(r.h.accountId)?.name||'',value:r=>r.value,ratio:r=>r.usable?r.p.expenseRatio:null,cost:r=>r.cost};
 const get=getters[sort.key]||getters.cost;
 return rows.slice().sort((a,b)=>{const x=get(a),y=get(b);if(x==null)return y==null?0:1;if(y==null)return -1;return (typeof x==='string'?x.localeCompare(y):x-y)*sort.dir;});
}
function dragMetricHTML(label,value,detail,tone='') {
 return `<div class="drag-metric${tone?' drag-metric-'+tone:''}"><div class="kicker">${label}</div><strong class="tnum">${value}</strong><small>${detail}</small></div>`;
}
function feeCoverageLabel(a){return a.coverage==null?'—':a.covered===a.eligible?'100%':a.coverage>=99.95?'<100%':fmtPct(a.coverage,1);}
function expenseSummaryHTML(snapshot) {
 const a=expenseAnalysis(snapshot),partial=a.covered<a.eligible||a.unclassified>0;
 return `<div class="drag-metrics expense-summary">${dragMetricHTML(partial?'Known annual fund costs':'Estimated annual fund costs',a.covered?fmtMoney(a.total):'—','At the selected check-in balances')}${dragMetricHTML('Weighted expense ratio',a.weighted==null?'—':fmtPct(a.weighted,2),'Across funds with known fees')}${dragMetricHTML('Fee coverage',feeCoverageLabel(a),`${a.coveredCount} of ${a.eligibleCount} funds / unresolved investments · ${fmtMoney(a.covered)} of ${fmtMoney(a.eligible)} assessed assets`)}</div>`;
}
function annualDragSummary(snapshot,sc) {
 const fees=expenseAnalysis(snapshot),assets=fees.rows.reduce((sum,row)=>sum+row.value,0);
 const total=fees.total+sc.totalDrag;
 return {fees,assets,total,impact:assets>0?total/assets*100:null,partial:fees.covered<fees.eligible||fees.unclassified>0};
}
function dragOverviewHTML(snapshot,sc) {
 const summary=annualDragSummary(snapshot,sc),a=summary.fees;
 const linkedCard=(label,value,detail,action,link)=>`<div class="drag-metric"><div class="drag-card-heading"><div class="kicker">${label}</div><button type="button" class="drag-card-link" data-act="${action}" aria-label="See ${action==='jump-costs'?'fund costs':'taxes'} below">${link} ↓</button></div><strong class="tnum">${value}</strong><small>${detail}</small></div>`;
 return `<section class="panel drag-overview" aria-labelledby="drag-overview-title"><div class="drag-overview-heading"><div><div class="kicker">At a glance</div><h2 id="drag-overview-title">Your costs &amp; taxes</h2></div>${snapPickerHTML()}</div><p class="drag-section-description">Annual estimates at your selected balances · all accounts, including 529</p><div class="drag-metrics drag-overview-metrics"><div class="drag-metric drag-total-card"><div class="kicker">${summary.partial?'Known annual costs · partial':'Estimated total annual costs'}</div><div class="drag-total-pair"><div class="drag-total-mini"><strong class="tnum">${fmtMoney(summary.total)}</strong><small>Annual cost ($)</small></div><div class="drag-total-mini"><strong class="tnum">${summary.impact==null?'—':`${summary.impact>0?'−':''}${summary.impact.toFixed(2)}%`}</strong><small>Return impact (%)</small></div></div></div>${linkedCard('Fund costs',a.covered?fmtMoney(a.total):a.eligible||a.unclassified?'—':fmtMoney(0),`${a.coverage==null?'No fee-bearing investments':feeCoverageLabel(a)+' of assessed assets covered'}${a.unclassified?' · some investments unclassified':''}`,'jump-costs','Fund costs')}${linkedCard('Distribution tax drag',fmtMoney(sc.totalDrag),`${fmtPct(sc.dragPct,2)} of taxable assets`,'jump-taxes','Tax drag')}</div><p class="drag-helper drag-total-help">Total = known fund expenses + estimated distribution taxes. Return impact divides that total by all portfolio assets.${summary.partial?' Partial estimate: missing fees are excluded.':''} Fees are already reflected in fund returns.</p></section>`;
}
function expensePanelHTML(snapshot) {
 const a=expenseAnalysis(snapshot),sort=ui.expenseSort||{key:'cost',dir:-1};
 const th=(key,label)=>`<th aria-sort="${sort.key===key?(sort.dir===1?'ascending':'descending'):'none'}"><button type="button" class="table-sort" data-act="expense-sort" data-key="${key}">${label}${sort.key===key?(sort.dir===1?' ▲':' ▼'):''}</button></th>`;
 return `<section class="panel expense-panel"><div class="panel-hd"><h3>By holding</h3><span class="drag-helper">Select a column to sort</span></div><div class="table-scroll"><table class="table"><thead><tr>${th('ticker','Holding')}${th('account','Accounts')}${th('value','Value')}${th('ratio','Expense ratio')}${th('cost','Annual cost')}</tr></thead><tbody>${expenseSortRows(expenseFundRows(a.rows)).map(r=>`<tr><td>${holdingEditLink(r.h.id,r.h.ticker)}</td><td title="${esc(r.accountNames.join(', '))}">${esc(r.accountLabel)}</td><td class="tnum">${fmtMoney(r.value)}</td><td class="tnum" title="${esc(r.usable?`${r.p.source||'User entered'}${r.p.source!=='User entered'&&r.p.feeOriginalBasis==='gross'?' · before waivers':''} · checked ${r.p.asOf||'unknown'}`:'Fee unavailable; excluded from estimate')}">${r.p.fundType==='direct'?'Not applicable':r.usable?fmtPct(r.p.expenseRatio,3):'Unknown'}</td><td class="tnum">${r.cost==null?'—':fmtMoney2(r.cost)}</td></tr>`).join('')||'<tr><td colspan="5">No positions in this check-in.</td></tr>'}</tbody></table></div><p class="text-muted" style="font-size:12px;padding:0 20px;">${fmtMoney(a.eligible-a.covered)} in funds or unresolved investments with unknown fees. Balances and fees are combined across accounts for the same fund and rate. Select a holding to update its expense ratio or yield.</p></section>`;
}
function editorPreviewHTML(d) {
 try {
  const h={...(d.baseHolding||portfolio.holdings.find(h=>h.id===d.hid)),...d.values};
  const p=mergeFundAssumptions(h,validateFundOverrides(d.sharedEdits),validateFundOverrides(d.accountEdits));
  const value=parseNum(d.values.marketValue),basis=parseNum(d.values.costBasis),shelter=accountShelter(accountById(h.accountId));
  const usable=p.fundType==='fund'&&p.expenseRatio!=null&&['net','total'].includes(p.expenseBasis)&&p.asOf&&p.asOf<=todayISO()&&p.source&&!(p.waiverEnd&&p.waiverEnd<todayISO());
  return `<div id="he-preview" class="he-preview"><strong>Estimated effect</strong><div>Annual net fund expenses: ${usable&&value!=null?fmtMoney2(value*p.expenseRatio/100):'Unknown / incomplete'}</div><div>Current distribution taxes: ${value==null?'—':fmtMoney2(shelter.sheltered?0:holdingDrag(value,p,taxRates()))}/yr</div><div>Unrealized gain: ${value!=null&&basis!=null?fmtMoneySigned2(value-basis):'Unknown basis'}</div><small>Current inputs; not a bill or historical charge. Simulation returns are unchanged.</small></div>`;
 } catch {return '<div id="he-preview" class="he-preview">Complete valid inputs to preview their effect.</div>';}
}
function refreshEditorPreview() {
 captureHoldingEditor();const d=ui.dialog;if(d?.type!=='holding-editor')return;
 const preview=document.getElementById('he-preview');if(preview)preview.outerHTML=editorPreviewHTML(d);
 document.querySelectorAll('[data-act="he-reset"]').forEach(el=>{el.disabled=d.assumptions[el.dataset.field]==null||d.assumptions[el.dataset.field]==='';});
}

function reportCostOverview(snap) {
 const sc=taxScorecard(snap),s=annualDragSummary(snap,sc),a=s.fees;
 return `<section class="rep-section rep-analysis rep-cost-overview"><div class="kicker">Costs across total portfolio</div><h3>Costs &amp; tax drag</h3><div class="rep-sub">Annual estimates · all accounts, including 529 · selected check-in balances</div>
 <div class="rep-summary"><div><span>${s.partial?'Known annual costs · partial':'Estimated annual costs'}</span><strong>${fmtMoney(s.total)}</strong><small>${s.impact==null?'—':(s.impact>0?'−':'')+fmtPct(s.impact,2)} return impact</small></div><div><span>Fund costs</span><strong>${a.covered?fmtMoney(a.total):a.eligible?'Unknown':fmtMoney(0)}</strong><small>${feeCoverageLabel(a)} of assessed assets covered</small></div><div><span>Distribution tax drag</span><strong>${fmtMoney(sc.totalDrag)}</strong><small>${fmtPct(sc.dragPct,2)} of taxable assets</small></div></div>
 <p class="rep-note">Total = known fund expenses + estimated distribution taxes. Return impact divides this total by ${fmtMoney(s.assets)} in all portfolio assets.${s.partial?' Missing fees are excluded; the total is incomplete.':''} These are annualized estimates, not charges incurred since the last check-in. Fund fees are already reflected in returns; do not subtract them twice.</p></section>`;
}
function reportExpensesSection(snap) {
 const a=expenseAnalysis(snap);
 const rows=expenseFundRows(a.rows).sort((x,y)=>(y.cost??-1)-(x.cost??-1)).map(r=>`<tr><td>${esc(r.h.ticker||r.h.name||'—')}</td><td>${esc(r.accountNames.join(', '))}</td><td class="tnum">${fmtMoney(r.value)}</td><td class="tnum">${r.p.fundType==='direct'?'N/A':r.usable?fmtPct(r.p.expenseRatio,3):'Unknown'}</td><td class="tnum">${r.cost==null?'—':fmtMoney2(r.cost)}</td></tr>`).join('');
 return `<section class="rep-section rep-analysis rep-long-table"><h3>Fund costs</h3>
 <div class="rep-summary"><div><span>Known annual fund costs</span><strong>${a.covered?fmtMoney(a.total):a.eligible?'Unknown':fmtMoney(0)}</strong></div><div><span>Weighted expense ratio</span><strong>${a.weighted==null?'—':fmtPct(a.weighted,2)}</strong><small>Funds with known fees</small></div><div><span>Fee coverage</span><strong>${feeCoverageLabel(a)}</strong><small>${a.coveredCount} of ${a.eligibleCount} funds / unresolved investments</small></div></div>
 <p class="rep-note">${fmtMoney(a.covered)} of ${fmtMoney(a.eligible)} assessed assets covered. ${fmtMoney(a.eligible-a.covered)} has unknown fees, including ${fmtMoney(a.unclassified)} in unresolved investments. Direct holdings are excluded from fee coverage; N/A does not mean zero trading or account costs.</p>
 <table class="table rep-data-table"><thead><tr><th>Holding</th><th>Accounts</th><th>Value</th><th>Expense ratio</th><th>Annual cost</th></tr></thead><tbody>${rows||'<tr><td colspan="5">No positions in this check-in.</td></tr>'}</tbody></table>
 <p class="rep-note">Balances combine across accounts for the same fund/share class and fee; differing rates remain separate. Bundled fees and user overrides; current assumptions on recorded balances, not historical charges. Plan/adviser fees may be additional. Tax estimates are separate.</p></section>`;
}

function openEditorSplit() {
 captureHoldingEditor();const parent=ui.dialog;
 if(parent?.type!=='holding-editor')return;
 openDialog({type:'class-pick',hid:parent.hid,parentEditor:parent});
}
function returnEditorSplit(composition,assetClass) {
 const previous=ui.dialog.parentEditor;if(!previous)return;
 let parent=previous;
 if(!parent.draft){
  if(!allocationMatchesCurrentHolding(parent)){toast('This position now holds a different investment. Start a check-in to edit its current allocation.');return;}
  if(portfolio.holdings.find(h=>h.id===parent.hid)?.status==='archived'){toast('This holding is archived. Add a new position in an active account.');return;}
  if(!ui.checkin)ensureCheckinDraft();
  openHoldingEditor(parent.hid,true);parent=ui.dialog;
  carryEditorFundEdits(previous,parent);
  ui.view=setupStep?'setup':'checkin';
 }
 parent.values.composition={...composition};parent.values.assetClass=assetClass;
 ui.dialog=parent;renderHoldingEditor();document.querySelector('[data-act="he-open-split"]')?.focus();
}

function changeInlineAllocation(action,target) {
 const d=ui.dialog;if(d?.type!=='holding-editor')return;
 captureHoldingEditor();d.allocationEdited=true;d.allocationOpen=true;
 if(action==='he-allocation-class'){d.values.assetClass=target.value;d.values.composition={};renderHoldingEditor();document.getElementById('he-assetClass')?.focus();return;}
 if(action==='he-allocation-preset'){
  d.values.composition={...(COMP_PRESETS[target.dataset.preset]||{})};
  const top=Object.entries(d.values.composition).sort((a,b)=>b[1]-a[1])[0];if(top)d.values.assetClass=top[0];
  renderHoldingEditor();document.querySelector(`[data-act="he-allocation-preset"][data-preset="${target.dataset.preset}"]`)?.focus();return;
 }
 captureHoldingEditor();const sum=Object.values(d.values.composition).reduce((n,v)=>n+(parseNum(v)||0),0);
 const el=document.getElementById('he-allocation-total');if(el){el.textContent=`Total ${Math.round(sum*100)/100}%`;el.style.color=sum&&Math.abs(sum-100)>0.01?'var(--color-warn)':'';}
}
