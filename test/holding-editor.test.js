const assert=require('node:assert/strict'),vm=require('node:vm');
const html=require('../scripts/instrument-catalog').readApp();
const sandbox={getComputedStyle(){return{getPropertyValue(){return '#123456';}};},window:{addEventListener(){},scrollTo(){}},document:{addEventListener(){},getElementById(){return null;},querySelectorAll(){return[];}},console,setTimeout(){},requestAnimationFrame(f){f();}};
vm.createContext(sandbox);
vm.runInContext(html.match(/\n<script>\n([\s\S]*)\n<\/script>/)[1]+`
render=()=>{};toast=()=>{};openDialog=d=>{ui.dialog=d;};
window.T={expenseAnalysis,resolvedFundAssumptions,applyHoldingEditor,openHoldingEditor,validateFundOverrides,validateFundData,holdingsForSnapshot,holdingDragRows,holdingAtSnapshot,ensureCheckinDraft,saveCheckin,serialize,renderPositions,renderTax,holdingEditorHTML,checkinHoldings,validatePortfolio,editorInheritedAssumptions,checkinAccountBlock,reportExpensesSection,expenseSortRows,expenseFundRows,expensePanelHTML,annualDragSummary,dragOverviewHTML,feeCoverageLabel,captureHoldingEditor,onClick,
reset(){portfolio=emptyPortfolio();demoMode=false;setupStep=0;ui.checkin=null;ui.view='positions';ui.snapDate='2025-01-01';ui.posSnapDate='2025-01-01';ui.positionsSnap=null;ui.posCategory='all';checkinDraftDirty=false;},setDemo(v){demoMode=v;},draftDirty:()=>checkinDraftDirty};`,sandbox);
const A=sandbox.window.__AAT__,T=sandbox.window.T;
let count=0;const test=(name,fn)=>{fn();count++;console.log('✓ '+name);};
function reset(){T.reset();A.portfolio.accounts=[{id:'a',name:'Brokerage',category:'Non-Retirement',vehicle:'taxable',status:'active'},{id:'b',name:'IRA',category:'Retirement',vehicle:'ira',status:'active'}];A.portfolio.holdings=[{id:'h',accountId:'a',ticker:'VTI',name:'Fund',assetClass:'us_total',status:'active'},{id:'j',accountId:'b',ticker:'VTI',name:'Fund',assetClass:'us_total',status:'active'}];A.portfolio.snapshots=[{date:'2025-01-01',values:[{holdingId:'h',marketValue:10000,costBasis:7000},{holdingId:'j',marketValue:30000,costBasis:25000}]}];}
// Retain legacy account-override model regressions for old portfolio files.
function edit(draft=false){T.openHoldingEditor('h',draft);A.ui.dialog.simpleEditor=false;return A.ui.dialog;}
function simpleEdit(draft=false){T.openHoldingEditor('h',draft);return A.ui.dialog;}
const fee={fundType:'fund',expenseRatio:0.2,expenseBasis:'net',source:'Issuer example',asOf:'2025-01-01'};
reset();
test('validated bundled fees populate recognized funds; unknowns stay excluded',()=>{let a=T.expenseAnalysis(A.latestSnapshot());assert.equal(a.covered,40000);assert.equal(a.total,12);A.portfolio.holdings.forEach(h=>h.ticker='UNKNOWN');a=T.expenseAnalysis(A.latestSnapshot());assert.equal(a.covered,0);assert.equal(a.weighted,null);reset();});
test('shared assumptions apply across accounts; account override replaces; blank resets',()=>{
 let d=edit();d.sharedEdits={...fee,divYield:3};d.accountEdits={...fee,expenseRatio:0.1};T.applyHoldingEditor(d);
 let a=T.expenseAnalysis(A.latestSnapshot());assert.equal(a.total,70);assert.equal(a.coverage,100);assert.ok(Math.abs(a.weighted-0.175)<1e-12);
 d=edit();d.accountEdits={expenseRatio:''};T.applyHoldingEditor(d);assert.equal(T.expenseAnalysis(A.latestSnapshot()).total,80);
 assert.equal(T.resolvedFundAssumptions(A.portfolio.holdings[0]).qualifiedPct,95);
});
test('explicit zero has full coverage and does not mean missing',()=>{let d=edit();d.sharedEdits={...fee,expenseRatio:0};T.applyHoldingEditor(d);const a=T.expenseAnalysis(A.latestSnapshot());assert.equal(a.coverage,100);assert.equal(a.weighted,0);});
test('metadata and stale waiver gates protect fee coverage',()=>{let d=edit();d.sharedEdits={expenseRatio:0.2};T.applyHoldingEditor(d);assert.equal(T.expenseAnalysis(A.latestSnapshot()).covered,0);d=edit();d.sharedEdits={...fee,waiverEnd:'2020-01-01'};T.applyHoldingEditor(d);assert.equal(T.expenseAnalysis(A.latestSnapshot()).covered,0);});
test('scope changes do not change recorded balances, gains, or snapshot JSON',()=>{const before=JSON.stringify(A.portfolio.snapshots),gain=A.allocate(A.portfolio.holdings,A.latestSnapshot()).byHolding[0].gain;let d=edit();d.sharedEdits={...fee,divYield:6};T.applyHoldingEditor(d);assert.equal(JSON.stringify(A.portfolio.snapshots),before);assert.equal(A.allocate(A.portfolio.holdings,A.latestSnapshot()).byHolding[0].gain,gain);});
test('tax assumptions affect taxable distributions while IRA has zero current tax',()=>{const rows=T.holdingDragRows(A.latestSnapshot());assert.equal(rows.find(r=>r.holdingId==='h').profile.divYield,6);assert.ok(rows.find(r=>r.holdingId==='h').drag>0);assert.equal(rows.find(r=>r.holdingId==='j').drag,0);});
test('invalid edits fail atomically',()=>{const before=T.serialize();let d=edit();d.sharedEdits={expenseRatio:-1};assert.throws(()=>T.applyHoldingEditor(d));assert.equal(T.serialize(),before);assert.throws(()=>T.validateFundOverrides({qualifiedPct:101}));assert.throws(()=>T.validateFundOverrides({asOf:'2025-02-30'}));});
test('recorded position edits are ignored unless an explicit draft is opened',()=>{const before=JSON.stringify(A.portfolio.snapshots);let d=edit();d.values.marketValue=999999;T.applyHoldingEditor(d);assert.equal(JSON.stringify(A.portfolio.snapshots),before);assert.equal(A.ui.checkin,null);assert.match(T.holdingEditorHTML(d),/Recorded check-ins are read-only/);});
test('draft position edits preserve old identity and balances when recorded',()=>{
 reset();const before=JSON.stringify(A.portfolio.snapshots[0]);T.ensureCheckinDraft();A.ui.checkin.date='2025-02-01';let d=edit(true);d.values.name='Updated name';d.values.marketValue='12000';d.values.costBasis='8000';d.values.assetClass='us_large';T.applyHoldingEditor(d);
 assert.equal(A.portfolio.holdings[0].name,'Fund');assert.equal(T.checkinHoldings('a')[0].name,'Updated name');assert.equal(T.draftDirty(),true);T.saveCheckin();
 assert.equal(A.portfolio.holdings[0].name,'Updated name');assert.equal(JSON.stringify(A.portfolio.snapshots[0]),before);assert.equal(T.holdingsForSnapshot(A.portfolio.snapshots[0],'all')[0].name,'Fund');assert.equal(A.latestSnapshot().values[0].marketValue,12000);
 assert.equal(T.holdingsForSnapshot(A.latestSnapshot(),'all')[0].name,'Updated name');
 const loaded=A.migrate(JSON.parse(T.serialize()));assert.equal(loaded.holdingHistory['2025-01-01'].h.name,'Fund');assert.equal(loaded.snapshots[1].holdingDetails.h.name,'Updated name');
});
test('recording on an existing date never overwrites history',()=>{const before=JSON.stringify(A.portfolio.snapshots);T.ensureCheckinDraft();A.ui.checkin.date='2025-01-01';A.ui.checkin.values.h.marketValue=1;T.saveCheckin();assert.equal(JSON.stringify(A.portfolio.snapshots),before);});
test('archived positions remain in historical fee and tax analyses',()=>{reset();let d=edit();d.sharedEdits={...fee};T.applyHoldingEditor(d);A.portfolio.holdings[0].status='archived';assert.equal(T.expenseAnalysis(A.latestSnapshot()).total,80);assert.equal(T.holdingDragRows(A.latestSnapshot()).length,2);});
test('demo blocks mutation; malformed override files reject',()=>{T.setDemo(true);assert.throws(()=>T.applyHoldingEditor(edit()));T.setDemo(false);assert.throws(()=>A.migrate({...JSON.parse(T.serialize()),fundAssumptions:{shared:{'VTI|security':{expenseRatio:-4}}}}));});
test('direct investments are not zero-fee funds; missing identities are separate',()=>{reset();let d=edit();d.sharedEdits={fundType:'direct'};T.applyHoldingEditor(d);assert.equal(T.expenseAnalysis(A.latestSnapshot()).eligible,0);A.portfolio.holdings[0].ticker='UNKNOWN';assert.equal(T.expenseAnalysis(A.latestSnapshot()).unclassified,10000);});
test('clearing legacy basis stays unknown and unknown holding period survives edits',()=>{
 reset();A.portfolio.holdings[0].costBasis=7000;A.portfolio.holdings[0].acquiredDate='2020-01-01';T.ensureCheckinDraft();A.ui.checkin.date='2025-02-01';let d=edit(true);d.values.costBasis='';T.applyHoldingEditor(d);T.saveCheckin();
 assert.equal(A.portfolio.holdings[0].longTermHolding,undefined);assert.equal(A.allocate(A.portfolio.holdings,A.latestSnapshot()).byHolding[0].gain,null);assert.equal(T.holdingDragRows(A.latestSnapshot()).find(r=>r.holdingId==='h').costBasis,null);
});
test('account moves preserve destination overrides and historical account identity',()=>{
 reset();A.portfolio.holdings[1].ticker='BND';A.portfolio.fundAssumptions={shared:{},accounts:{a:{'VTI|security':{divYield:2}},b:{'VTI|security':{divYield:5}}}};
 T.ensureCheckinDraft();A.ui.checkin.date='2025-02-01';let d=edit(true);d.values.accountId='b';T.applyHoldingEditor(d);T.saveCheckin();assert.equal(A.portfolio.fundAssumptions.accounts.b['VTI|security'].divYield,5);assert.equal(T.holdingsForSnapshot(A.portfolio.snapshots[0],'all')[0].accountId,'a');
});
test('draft fund assumptions remain staged and discarding loses them',()=>{
 reset();T.ensureCheckinDraft();let d=edit(true);d.sharedEdits={...fee};T.applyHoldingEditor(d);assert.equal(T.expenseAnalysis(A.latestSnapshot()).total,12);assert.ok(A.ui.checkin.fundAssumptions);A.ui.checkin=null;assert.equal(A.portfolio.fundAssumptions,undefined);
});
test('canonical file types and contradictory effective tax flags reject',()=>{
 reset();assert.throws(()=>T.validateFundData({shared:{x:{muni:'false'}}}));assert.throws(()=>T.validateFundData({shared:{x:{expenseRatio:'0.2'}}}));
 for(const values of [{muni:false,inStateMuni:true},{collectible:true,sixtyForty:true},{muni:true,qbiEligible:true}]){let d=edit();d.sharedEdits=values;assert.throws(()=>T.applyHoldingEditor(d));}
});
test('fee provenance cannot be borrowed by an account rate and gross/future rates remain references',()=>{
 reset();let d=edit();d.sharedEdits={...fee};d.accountEdits={expenseRatio:0.3};T.applyHoldingEditor(d);assert.equal(T.expenseAnalysis(A.latestSnapshot()).covered,30000);
 d=edit();d.sharedEdits={...fee,expenseBasis:'gross'};d.accountEdits={};T.applyHoldingEditor(d);assert.equal(T.expenseAnalysis(A.latestSnapshot()).covered,0);
 d=edit();d.sharedEdits={...fee,asOf:'2099-01-01'};T.applyHoldingEditor(d);assert.equal(T.expenseAnalysis(A.latestSnapshot()).covered,0);
});
test('blank shared override shows inherited default under account scope',()=>{
 reset();const d=edit();d.sharedEdits={divYield:''};d.scope='account';assert.ok(T.editorInheritedAssumptions(d).divYield>0);
});
test('reopening a staged ticker or account change uses the staged identity',()=>{
 reset();T.ensureCheckinDraft();let d=edit(true);d.values.ticker='VOO';T.applyHoldingEditor(d);d=edit(true);d.sharedEdits={...fee};T.applyHoldingEditor(d);assert.equal(A.ui.checkin.fundAssumptions.shared['VOO|security'].expenseRatio,0.2);
 reset();A.portfolio.holdings[1].ticker='BND';A.portfolio.fundAssumptions={shared:{},accounts:{a:{'VTI|security':{divYield:2}},b:{'VTI|security':{divYield:5}}}};T.ensureCheckinDraft();d=edit(true);d.values.accountId='b';T.applyHoldingEditor(d);d=edit(true);d.values.marketValue=12000;T.applyHoldingEditor(d);assert.equal(A.ui.checkin.values.h.marketValue,12000);assert.equal(A.ui.checkin.fundAssumptions.accounts.b['VTI|security'].divYield,5);
});
test('historical CSV preserves the prior ticker and report discloses current fee assumptions',()=>{
 reset();const original=A.snapshotCSV(A.latestSnapshot());T.ensureCheckinDraft();A.ui.checkin.date='2025-02-01';let d=edit(true);d.values.ticker='VOO';T.applyHoldingEditor(d);T.saveCheckin();assert.equal(A.snapshotCSV(A.portfolio.snapshots[0]),original);assert.match(T.reportExpensesSection(A.latestSnapshot()),/current assumptions on recorded balances/);
});
test('simple editor applies fee and yield across accounts without metadata inputs',()=>{
 reset();A.portfolio.fundAssumptions={shared:{},accounts:{a:{'VTI|security':{divYield:9}},b:{'VTI|security':{expenseRatio:5,divYield:8}}}};
 let d=simpleEdit();d.sharedEdits={expenseRatio:0.1,divYield:2};T.applyHoldingEditor(d);
 assert.equal(T.expenseAnalysis(A.latestSnapshot()).total,40);
 for(const h of A.portfolio.holdings)assert.equal(T.resolvedFundAssumptions(h).divYield,2);
 d=simpleEdit();delete d.sharedEdits.expenseRatio;T.applyHoldingEditor(d);assert.equal(T.expenseAnalysis(A.latestSnapshot()).total,12);
 const markup=T.holdingEditorHTML(simpleEdit());assert.ok(!markup.includes('id="he-scope"'));assert.ok(!markup.includes('id="he-a-expenseBasis"'));assert.ok(!markup.includes('id="he-a-source"'));assert.ok(!markup.includes('Advanced tax'));
 assert.match(markup,/data-inherited="true"/);assert.match(markup,/type="checkbox" id="he-longTermHolding"/);
});
test('every cost column sorts including unknowns last; links replace Edit buttons',()=>{
 reset();A.portfolio.holdings[1].ticker='UNKNOWN';let rows=T.expenseAnalysis(A.latestSnapshot()).rows;
 for(const key of ['ticker','account','value','ratio','cost'])for(const dir of [1,-1]){A.ui.expenseSort={key,dir};const sorted=T.expenseSortRows(rows);assert.equal(sorted.length,2);if(['ratio','cost'].includes(key))assert.equal(sorted[1].h.ticker,'UNKNOWN');}
 const markup=T.expensePanelHTML(A.latestSnapshot());assert.equal((markup.match(/data-act="expense-sort"/g)||[]).length,5);assert.match(markup,/class="holding-edit-link"/);assert.ok(!markup.includes('>Edit</button>'));
});
test('fund cost rows roll up exact funds without losing fees or hiding legacy differences',()=>{
 reset();let analysis=T.expenseAnalysis(A.latestSnapshot()),rows=T.expenseFundRows(analysis.rows);
 assert.equal(rows.length,1);assert.equal(rows[0].value,40000);assert.equal(rows[0].cost,12);assert.equal(rows[0].accountLabel,'2 accounts');
 assert.equal((T.expensePanelHTML(A.latestSnapshot()).match(/class="holding-edit-link"/g)||[]).length,1);
 A.portfolio.fundAssumptions={shared:{},accounts:{b:{'VTI|security':{...fee,expenseRatio:0.1}}}};
 analysis=T.expenseAnalysis(A.latestSnapshot());rows=T.expenseFundRows(analysis.rows);assert.equal(rows.length,2);assert.equal(rows.reduce((n,r)=>n+r.cost,0),analysis.total);
 A.portfolio.holdings[1].ticker='VTSAX';rows=T.expenseFundRows(T.expenseAnalysis(A.latestSnapshot()).rows);assert.equal(rows.length,2);
 reset();A.portfolio.holdings.forEach(h=>h.assetClass='us_bond');assert.match(T.renderTax(),/drag-metric-(ok|warn|crit)/);
});
test('overview total sums fees and taxes using the entire asset base',()=>{
 reset();let summary=T.annualDragSummary(A.latestSnapshot(),{totalDrag:28});assert.equal(summary.total,40);assert.equal(summary.assets,40000);assert.equal(summary.impact,0.1);assert.equal(summary.partial,false);
 A.portfolio.holdings[1].ticker='UNKNOWN';summary=T.annualDragSummary(A.latestSnapshot(),{totalDrag:28});assert.equal(summary.total,31);assert.equal(summary.assets,40000);assert.equal(summary.partial,true);
 const markup=T.dragOverviewHTML(A.latestSnapshot(),{totalDrag:28,dragPct:0.28});assert.match(markup,/Known annual costs · partial/);assert.equal((markup.match(/class="drag-card-link"/g)||[]).length,2);assert.ok(!markup.includes('drag-section-nav'));
 A.portfolio.snapshots[0].values=[];assert.equal(T.annualDragSummary(A.latestSnapshot(),{totalDrag:0}).impact,null);
});
test('unresolved holdings reduce fee coverage; confirmed direct securities do not',()=>{
 reset();A.portfolio.holdings[1].ticker='UNIDENTIFIED';let a=T.expenseAnalysis(A.latestSnapshot());assert.equal(a.coverage,25);assert.equal(a.coveredCount,1);assert.equal(a.eligibleCount,2);
 A.portfolio.holdings[1].ticker='AAPL';a=T.expenseAnalysis(A.latestSnapshot());assert.equal(a.coverage,100);assert.equal(a.eligibleCount,1);assert.equal(a.rows.find(r=>r.h.ticker==='AAPL').p.fundType,'direct');
 A.portfolio.holdings[1].ticker='UNIDENTIFIED';A.portfolio.snapshots[0].values[1].marketValue=0.01;a=T.expenseAnalysis(A.latestSnapshot());assert.notEqual(T.feeCoverageLabel(a),'100%');
});
test('broker deposit and 529 fees require matching holding context',()=>{
 reset();const h=A.portfolio.holdings[0];Object.assign(h,{ticker:'IIAXX',name:'BANK OF AMERICA, NA RASP',assetClass:'cash'});assert.equal(T.resolvedFundAssumptions(h).fundType,'direct');h.name='Different investment';assert.notEqual(T.resolvedFundAssumptions(h).fundType,'direct');
 Object.assign(h,{ticker:'MA FID500',name:'MA FIDELITY 500 INDEX',assetClass:'us_large'});assert.equal(T.resolvedFundAssumptions(h).expenseRatio,undefined);A.portfolio.accounts[0].category='529';assert.equal(T.resolvedFundAssumptions(h).expenseRatio,0.08);
});

test('historical ticker transitions keep current fund assumptions and reject obsolete allocations',()=>{
 reset();A.portfolio.fundAssumptions={shared:{'VTI|security':{divYield:9},'VOO|security':{divYield:2}},accounts:{}};
 A.portfolio.snapshots[0].holdingDetails={h:{...A.portfolio.holdings[0]}};
 A.portfolio.holdings[0].ticker='VOO';
 A.portfolio.snapshots.push({date:'2025-02-01',values:[{holdingId:'h',marketValue:12000,costBasis:7000}]});
 A.ui.positionsSnap='2025-01-01';let d=simpleEdit();assert.equal(d.values.ticker,'VTI');
 d.allocationEdited=true;d.values.composition={us_large:100};
 assert.throws(()=>T.applyHoldingEditor(d),/different investment/);assert.equal(A.ui.checkin,null);
 T.onClick({target:{closest(){return{dataset:{act:'he-start-checkin',hid:'h'}};}},preventDefault(){}});
 d=A.ui.dialog;assert.equal(d.values.ticker,'VOO');assert.equal(d.sharedEdits.divYield,2);assert.ok(!d.allocationEdited);
 T.applyHoldingEditor(d);assert.equal(A.ui.checkin.fundAssumptions.shared['VOO|security'].divYield,2);
 assert.equal(A.ui.checkin.fundAssumptions.shared['VTI|security'].divYield,9);
});
test('invalid fund inputs with historical allocation edits do not open or alter a draft',()=>{
 reset();const before=T.serialize(),view=A.ui.view;let d=simpleEdit();d.allocationEdited=true;d.values.composition={us_large:100};d.sharedEdits={expenseRatio:-1};
 assert.throws(()=>T.applyHoldingEditor(d),/Annual expense ratio/);assert.equal(A.ui.checkin,null);assert.equal(A.ui.view,view);assert.equal(T.serialize(),before);
 d.sharedEdits={divYield:101};assert.throws(()=>T.applyHoldingEditor(d),/yield/);assert.equal(A.ui.checkin,null);
});
console.log(`${count} holding-editor / expense-analysis regression groups passed`);
