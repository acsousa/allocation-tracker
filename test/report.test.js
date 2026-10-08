/* Report data fidelity: formatting must preserve balances, goals and unknowns. */
const assert=require('node:assert/strict'),vm=require('node:vm');
const html=require('../scripts/instrument-catalog').readApp();
const sandbox={self:{},getComputedStyle(){return{getPropertyValue(){return '#123456';}};},window:{addEventListener(){}},document:{addEventListener(){}},console,setTimeout(){}};
vm.createContext(sandbox);
vm.runInContext(html.match(/\n<script>\n([\s\S]*)\n<\/script>/)[1]+`
render=()=>{};
window.reportTest={reportCheckinComparison,reportChangesSection,reportCostOverview,reportExpensesSection,reportTaxSection,expenseAnalysis,expenseFundRows,taxScorecard,annualDragSummary,planMoveTotals,planMoveSummaryHTML,reportHTML,allocTableHTML,latestSnapshot,set529(v){portfolio.meta.include529InHousehold=v;}};`,sandbox);
const A=sandbox.window.__AAT__,T=sandbox.window.reportTest;A.loadDemoData();
const before=JSON.stringify(A.portfolio),report=T.reportHTML(T.latestSnapshot());
assert.equal(JSON.stringify(A.portfolio),before,'Report generation must not mutate saved financial data');
for(const account of A.portfolio.accounts)assert.ok(report.includes(account.name),'Account name missing');
assert.ok(report.includes('excludes 529s'));T.set529(true);assert.ok(T.reportHTML(T.latestSnapshot()).includes('includes 529s'));T.set529(false);
const table=T.allocTableHTML([{id:'stocks',label:'Stocks',value:100,pct:100,color:'#123456'}],{stocks:60,bonds:40},5);
assert.ok(table.includes('Bonds'),'Zero-balance target rows must survive');
assert.ok(table.includes('40%'));assert.ok(table.includes('$0'));assert.ok(table.includes('Drift (pp)'));
assert.ok(T.allocTableHTML([{id:'stocks',label:'Stocks',value:100,pct:100,color:'#123456'}],null,5).includes('—'),'Missing goals must remain unknown, not zero');
assert.ok(report.includes('Run the retirement simulation'),'Stale/unrun projection must not be presented as current');
assert.ok(report.includes('Disclaimer'));assert.ok(report.includes('current assumptions on recorded balances'));
console.log('Report fidelity checks passed: immutable data, account names, 529 scope, zero-target rows, unknown goals, stale projections and disclosures.');

const mixed={moves:[{buyTicker:'VTI',amount:1000},{sellTicker:'BND',buyTicker:'VTI',amount:2000,done:true},{sellTicker:'VTI',amount:300},{sellTicker:'  ',buyTicker:' ',amount:999},{buyTicker:'VTI',amount:-1},{buyTicker:'VTI',amount:NaN}]};
assert.deepEqual(JSON.parse(JSON.stringify(T.planMoveTotals(mixed))),{deploy:1000,move:2000,withdraw:300});
assert.deepEqual(JSON.parse(JSON.stringify(T.planMoveTotals({...mixed,noAction:true}))),{deploy:0,move:0,withdraw:0});
assert.deepEqual(JSON.parse(JSON.stringify(T.planMoveTotals(null))),{deploy:0,move:0,withdraw:0});
for(const label of ['Amount to deploy','Amount to move','Amount to withdraw (sell)'])assert.ok(report.includes(label));
for(const value of ['$1,000','$2,000','$300']){assert.ok(T.planMoveSummaryHTML(mixed).includes(value));assert.ok(T.planMoveSummaryHTML(mixed,true).includes(value));}
console.log('Plan rollups passed: exclusive categories, completed moves, invalid/blank rows, no-action and shared report totals.');

const snapshot=T.latestSnapshot(),fees=T.expenseAnalysis(snapshot),tax=T.taxScorecard(snapshot);
const costReport=T.reportExpensesSection(snapshot),taxReport=T.reportTaxSection(snapshot);
assert.equal((costReport.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].match(/<tr>/g)||[]).length,T.expenseFundRows(fees.rows).length);
assert.equal((taxReport.match(/<tbody>([\s\S]*?)<\/tbody>/)[1].match(/<tr>/g)||[]).length,tax.rows.length,'Include every taxable AND sheltered holding, not just six');
assert.equal(T.annualDragSummary(snapshot,tax).total,fees.total+tax.totalDrag);
assert.ok(T.reportCostOverview(snapshot).includes('Missing fees are excluded'));
assert.ok(taxReport.includes('hypothetical taxable placement'));
const p=A.portfolio;p.accounts=[{id:'a',name:'Closed account',status:'archived'},{id:'b',name:'New account'}];p.holdings=[{id:'h',accountId:'b',ticker:'VTI',status:'active'}];
p.snapshots=[{date:'2025-01-01',values:[{holdingId:'h',marketValue:100}],holdingDetails:{h:{id:'h',accountId:'a',ticker:'VTI'}}},{date:'2025-04-01',values:[{holdingId:'h',marketValue:150}]},{date:'2025-07-01',values:[{holdingId:'h',marketValue:999}]}];
const comparison=T.reportCheckinComparison(p.snapshots[1]);
assert.equal(comparison.previous.date,'2025-01-01');assert.equal(comparison.total,150);assert.equal(comparison.delta,50);
assert.equal(comparison.rows.find(r=>r.id==='a').before,100);assert.equal(comparison.rows.find(r=>r.id==='a').after,0);assert.equal(comparison.rows.find(r=>r.id==='b').after,150);
assert.equal(T.reportCheckinComparison(p.snapshots[0]),null);assert.ok(T.reportChangesSection(p.snapshots[0]).includes('baseline'));
assert.ok(!T.reportChangesSection(p.snapshots[1]).includes('Balance changes combine'));
assert.ok(T.reportChangesSection(p.snapshots[1]).includes('text-align:right;">Previous'));
console.log('Expanded report passed: all fee/tax rows, partial coverage, reconciled costs, selected historical comparison, archived accounts and first-check-in baseline.');

// Printing must await every eligible simulation and never print incomplete results.
(async()=>{
 const calls=[],p={retirementSettings:{mappingConfirmed:true},children:[{id:'a'},{id:'b'}]};
 const ctx={document:{title:"Quartermaster"},formatCheckinDate:()=>"October 1, 2026",portfolio:p,currentSnapshot:()=>({date:'2026-10-01'}),ui:{},retireAccounts:()=>[{}],render(){},requestAnimationFrame:fn=>fn(),toast:m=>calls.push('error'),window:{print:()=>{assert.equal(ctx.document.title,'asset review October 1, 2026');calls.push('print');}},retireCacheIsCurrent:()=>true,collegeCacheIsCurrent:()=>true,retireModelAsync:async()=>{calls.push('retire');},collegeModelAsync:async id=>{calls.push(id);}};
 vm.createContext(ctx);vm.runInContext(html.slice(html.indexOf('let reportPreparing = false;'),html.indexOf('function renderReport()')),ctx);
 await Promise.all([ctx.printReportWithSimulations(),ctx.printReportWithSimulations()]);
 assert.deepEqual(calls,['retire','a','b','print']);
 assert.equal(ctx.document.title,'Quartermaster','Restore the app title after printing');
 calls.length=0;ctx.retireModelAsync=async()=>{throw Error('failed');};await ctx.printReportWithSimulations();assert.deepEqual(calls,['error']);
 calls.length=0;ctx.retireModelAsync=async()=>{p.changed=true;};await ctx.printReportWithSimulations();assert.deepEqual(calls,['a','b','error']);
 calls.length=0;ctx.currentSnapshot=()=>null;await ctx.printReportWithSimulations();assert.deepEqual(calls,['error']);
 calls.length=0;ctx.currentSnapshot=()=>({date:'2026-10-01'});ctx.retireModelAsync=async()=>{};ctx.requestAnimationFrame=fn=>{p.lateChange=(p.lateChange||0)+1;fn();};await ctx.printReportWithSimulations();assert.deepEqual(calls,['a','b','error'],'Changes during chart painting must block printing');
 console.log('Automatic report simulations passed: sequential completion, duplicate clicks, failure, changed inputs and missing snapshot.');
})().catch(error=>{console.error(error);process.exitCode=1;});

const grouped=T.allocTableHTML(
 [{id:'stocks',label:'Stocks',value:600,pct:60,color:'#123456'},{id:'bonds',label:'Bonds',value:400,pct:40,color:'#654321'}],
 {stocks:55,bonds:45},5,
 [{id:'us_large',label:'US Large Cap',value:400,pct:40,color:'#123456'},{id:'intl_dev',label:'International Developed',value:200,pct:20,color:'#123456'},{id:'us_bond',label:'US Bonds',value:400,pct:40,color:'#654321'}],
 {us_large:35,intl_dev:20,us_bond:40,intl_bond:5});
const stockBody=grouped.match(/<tbody data-rollup-group="stocks">([\s\S]*?)<\/tbody>/)[1];
const bondBody=grouped.match(/<tbody data-rollup-group="bonds">([\s\S]*?)<\/tbody>/)[1];
assert.ok(stockBody.indexOf('rep-rollup-row')<stockBody.indexOf('rep-detail-row'));
assert.ok(stockBody.includes('data-asset="intl_dev"'));assert.ok(!stockBody.includes('data-asset="us_bond"'));
assert.ok(bondBody.includes('data-asset="intl_bond"'));assert.ok(bondBody.includes('$0'));
assert.ok(stockBody.includes('20%'),'Detail percentages retain the full section denominator');
assert.equal((grouped.match(/rep-detail-row/g)||[]).length,4,'Each detail appears once, including unheld targets');
assert.ok(report.includes('Indented rows make up the group above'));
console.log('Allocation hierarchy passed: one detail row per class, correct parent, unheld targets, and unchanged percentage denominator.');

const sparse=T.allocTableHTML([{id:'us_large',label:'US Large Cap',value:100,pct:100,color:'#123456'}],{},5);
assert.ok(sparse.includes('>0%</td>'),'An omitted class in a defined goal displays the zero used by drift');
assert.match(html,/e\.key\.toLowerCase\(\) === 'p'[\s\S]{0,100}printReportWithSimulations/);
assert.match(html,/case 'run-simulation': \{\s+if \(reportPreparing\)/);
