/* Session flow and read-only demo regressions. No dependencies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'index.html'), 'utf8');
const source = html.match(/\n<script>\n([\s\S]*)\n<\/script>/)[1];
const window = {addEventListener(){}, scrollTo(){}, location:{hash:'',protocol:'https:',href:'https://realallocation.com/index.html'}};
const sandbox = {window, self:{}, console, URL, Blob, setTimeout(){}, requestAnimationFrame(fn){fn();}, document:{addEventListener(){},querySelectorAll(){return [];},getElementById(){return null;}}};
vm.createContext(sandbox);
vm.runInContext(source + `
render = () => {}; toast = () => {}; openDialog = d => { ui.dialog = d; };
window.test = {reviewSubtabs, dashToolbarHTML, driftControlsHTML, checkinAccountBlock, chooseSetupGoal, applySetupGoal, setupGoalTotal, taxProfileNeedsReview, beginSetup, reviewChanges, renderReviewChanges, renderSetup, topTabOf, demoActionAllowed, onClick, onInput, onChange, saveCheckin, saveFile, handlePublicRoute,
state:()=>({demoMode,setupStep,dirty,checkinDraftDirty}),
setDraft: d => { ui.checkin=d; checkinDraftDirty=true; },
setMode: (step, demo=false) => {setupStep=step;demoMode=demo;}
};`,sandbox);
const A=window.__AAT__, T=window.test;
const event=(act,rest={})=>({target:{closest:()=>({dataset:{act,...rest},value:'999'})},preventDefault(){}});
let checks=0;
function check(name,fn){fn();checks++;console.log('✓ '+name);}
check('Dashboard is separate from Review',()=>{assert.equal(T.topTabOf('dashboard'),'dashboard');assert.equal(T.topTabOf('review'),'review');});
check('new setup clears demo and old holdings without saving',()=>{A.loadDemoData();T.beginSetup();assert.equal(T.state().setupStep,1);assert.equal(T.state().demoMode,false);assert.equal(A.portfolio.holdings.length,0);assert.equal(A.portfolio.goals.length,0);});
check('setup needs an account, then advances through basics and holdings',()=>{T.onClick(event('setup-next'));assert.equal(T.state().setupStep,1);A.portfolio.accounts.push({id:'a',name:'Account',category:'Retirement',status:'active'});T.onClick(event('setup-next'));assert.equal(T.state().setupStep,2);T.onClick(event('setup-next'));assert.equal(T.state().setupStep,3);assert.ok(A.ui.checkin);});
check('setup goals validate totals, apply selected mix, and reset to no target',()=>{
  T.chooseSetupGoal('60');assert.equal(T.setupGoalTotal(),100);assert.equal(T.applySetupGoal(),true);assert.equal(A.portfolio.goals[0].targets.us_bond,40);
  A.ui.setupGoal.targets.us_bond=41;assert.equal(T.applySetupGoal(),false);
  T.chooseSetupGoal('none');assert.equal(T.applySetupGoal(),true);assert.equal(A.portfolio.goals.length,0);
});
check('tax helper distinguishes untouched defaults from confirmed inputs',()=>{
  assert.equal(T.taxProfileNeedsReview(),true);A.portfolio.taxSettings.profileReviewed=true;assert.equal(T.taxProfileNeedsReview(),false);delete A.portfolio.taxSettings.profileReviewed;
});
check('empty accounts show one add action without an empty table or setup review controls',()=>{
 const markup=T.checkinAccountBlock(A.portfolio.accounts[0],A.ui.checkin,{});
 assert.ok(!markup.includes('No holdings yet'));assert.ok(!markup.includes('<table'));
 assert.equal((markup.match(/data-act="add-holding"/g)||[]).length,1);
 assert.ok(!markup.includes('data-act="ci-review"'));
});
check('finish setup records balances but leaves file unsaved',()=>{A.portfolio.holdings.push({id:'h',accountId:'a',ticker:'VTI',assetClass:'us_total',status:'active'});T.setDraft({date:'2026-09-16',values:{h:{marketValue:'10000',costBasis:''}},basisSet:{}});T.saveCheckin();assert.equal(A.ui.view,'dashboard');assert.equal(T.state().setupStep,0);assert.equal(T.state().dirty,true);assert.equal(T.state().checkinDraftDirty,false);assert.equal(A.portfolio.snapshots[0].values[0].marketValue,10000);});
check('subsequent check-ins open Review while setup opens Dashboard',()=>{
 T.setDraft({date:'2026-09-17',values:{h:{marketValue:'10100',costBasis:''}},basisSet:{}});T.saveCheckin();assert.equal(A.ui.view,'review');A.portfolio.snapshots.pop();
});
check('Allocation sits between changes and holdings; comparison controls move out of crumbs',()=>{
 assert.equal(T.reviewSubtabs()[1][0],'allocation');assert.equal(T.topTabOf('allocation'),'review');
 const bar=T.dashToolbarHTML(A.portfolio.snapshots[0]);assert.ok(!bar.includes('data-act="pick-goal"'));assert.ok(!bar.includes('data-act="level"'));
 assert.ok(T.driftControlsHTML().includes('data-act="pick-goal"'));
});
check('first check-in review explains that a comparison is not available',()=>{assert.equal(T.reviewChanges(),null);assert.match(T.renderReviewChanges(),/first check-in/);});
check('review includes archived holdings and distinguishes balance changes',()=>{A.portfolio.holdings[0].status='archived';A.portfolio.snapshots.push({date:'2026-10-16',values:[{holdingId:'h',marketValue:10500}]});assert.equal(T.reviewChanges().delta,500);assert.match(T.renderReviewChanges(),/not investment returns/);});
check('demo blocks account, holding, goal, snapshot and mapping mutations',()=>{A.loadDemoData();const before=JSON.stringify(A.portfolio);for(const a of ['save-account','archive-account','archive-holding','goal-save','ci-save','plan-generate']){assert.equal(T.demoActionAllowed(a),false);T.onClick(event(a));}T.onChange(event('rd-map-vehicle',{account:A.portfolio.accounts[0].id}));assert.equal(JSON.stringify(A.portfolio),before);assert.equal(T.state().dirty,false);});
check('demo allows exploration and temporary modeling',()=>{for(const a of ['nav','pick-snap','drill','rd-retire-age','cl-cost','dollar-mode']) assert.equal(T.demoActionAllowed(a),true);});
check('Start here always opens the guide, including with data present',()=>{T.onClick(event('landing-open'));assert.equal(A.ui.dialog.type,'onboard');});
check('pricing start route opens the guide and section route is handled',()=>{window.location.hash='#start';assert.equal(T.handlePublicRoute(),true);assert.equal(A.ui.dialog.type,'onboard');window.location.hash='#lp-trust';assert.equal(T.handlePublicRoute(),true);});
(async()=>{const r=await T.saveFile();assert.equal(r.ok,false);console.log('✓ demo file saving blocked');checks++;console.log(checks+' onboarding regression groups passed');})().catch(e=>{console.error(e);process.exitCode=1;});
