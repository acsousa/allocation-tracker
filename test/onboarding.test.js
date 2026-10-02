/* Session flow and read-only demo regressions. No dependencies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(require('node:path').join(__dirname, '..', 'app.html'), 'utf8');
const source = html.match(/\n<script>\n([\s\S]*)\n<\/script>/)[1];
const handoffStore = new Map();
const sessionStorage = {getItem:key=>handoffStore.has(key)?handoffStore.get(key):null,setItem:(key,value)=>handoffStore.set(key,String(value)),removeItem:key=>handoffStore.delete(key)};
const window = {addEventListener(){}, scrollTo(){}, sessionStorage, location:{hash:'',protocol:'https:',origin:'https://realallocation.com',href:'https://realallocation.com/app/'}};
const sandbox = {window, self:{}, console, URL, Blob, setTimeout(){}, requestAnimationFrame(fn){fn();}, document:{addEventListener(){},querySelectorAll(){return [];},getElementById(){return null;}}};
vm.createContext(sandbox);
vm.runInContext(source + `
render = () => {}; toast = () => {}; openDialog = d => { ui.dialog = d; };
window.test = {reviewSubtabs, selectedDashboardGoal, dashKpiHTML, dashToolbarHTML, driftControlsHTML, checkinAccountBlock, saveHoldingFromDialog, setHoldingClass, ensureCheckinDraft, setSetupGoalLevel, chooseSetupGoal, applySetupGoal, setupGoalTotal, taxProfileNeedsReview, beginSetup, reviewChanges, renderReviewChanges, renderSetup, renderOpenFile, dialogHTML, topTabOf, demoActionAllowed, onClick, onInput, onChange, syncHoldingClassField, saveCheckin, saveFile, handlePublicRoute, consumeLandingPortfolio, handoffKey:LANDING_FILE_HANDOFF_KEY,
state:()=>({demoMode,setupStep,dirty,checkinDraftDirty,fileName}),
setDraft: d => { ui.checkin=d; checkinDraftDirty=true; },
setMode: (step, demo=false) => {setupStep=step;demoMode=demo;}
};`,sandbox);
const A=window.__AAT__, T=window.test;
const event=(act,rest={})=>({target:{closest:()=>({dataset:{act,...rest},value:'999'})},preventDefault(){}});
let checks=0;
function check(name,fn){fn();checks++;console.log('✓ '+name);}
check('Dashboard is separate from Review',()=>{assert.equal(T.topTabOf('dashboard'),'dashboard');assert.equal(T.topTabOf('review'),'review');});
check('new setup clears demo and keeps child creation inside the 529 account dialog',()=>{A.loadDemoData();T.beginSetup();assert.equal(T.state().setupStep,1);assert.equal(T.state().demoMode,false);assert.equal(A.portfolio.holdings.length,0);assert.equal(A.portfolio.goals.length,0);assert.ok(!T.renderSetup().includes('Add a child for a 529'));A.ui.dialog={type:'account'};const dialog=T.dialogHTML();assert.match(dialog,/data-act="account-add-child"/);assert.match(dialog,/id="f-child-inline" hidden/);assert.match(dialog,/id="f-vehicle-wrap" style="display:block;/);assert.match(dialog,/<details class="projection-how" style="margin-top:12px;"><summary>Additional account details<\/summary>/);assert.ok(!dialog.includes('Complete account details'));const categorySelect=dialog.slice(dialog.indexOf('id="f-cat"'),dialog.indexOf('</select>',dialog.indexOf('id="f-cat"')));const vehicleSelect=dialog.slice(dialog.indexOf('id="f-vehicle"'),dialog.indexOf('</select>',dialog.indexOf('id="f-vehicle"')));assert.ok(categorySelect.indexOf('Savings')<categorySelect.indexOf('Other'));assert.ok(vehicleSelect.indexOf('Savings account')<vehicleSelect.indexOf('Other'));A.ui.dialog=null;});
check('dialog validation combines a red field with a visible error message',()=>{assert.match(html,/\.input\[aria-invalid="true"\]/);assert.match(html,/const details = field\.closest && field\.closest\('details'\); if \(details\) details\.open = true;/);assert.match(html,/field\.focus\(\); toast\(message\);/);});
check('setup uses the full app width and advances without redundant step bars',()=>{assert.match(html,/\.setup-shell \{ width:100%;min-width:0;margin:0; \}/);assert.ok(!html.includes('.setup-shell { width:100%;min-width:0;max-width:1000px'));T.onClick(event('setup-next'));assert.equal(T.state().setupStep,1);A.portfolio.accounts.push({id:'a',name:'Account',category:'Retirement',status:'active'});T.onClick(event('setup-next'));assert.equal(T.state().setupStep,2);T.onClick(event('setup-next'));assert.equal(T.state().setupStep,3);assert.ok(A.ui.checkin);const markup=T.renderSetup();assert.match(markup,/Enter your holdings/);assert.ok(!markup.includes('setup-progress'));assert.ok(!markup.includes('ritual-steps'));});
check('account type is inferred when confident and requested only when ambiguous',()=>{assert.equal(A.inferVehicleChoice({name:'My Roth IRA',category:'Retirement'}),'ira');assert.equal(A.inferVehicleChoice({name:'Retirement account',category:'Retirement'}),null);A.portfolio.accounts.push({id:'ira',name:'My Roth IRA',category:'Retirement',status:'active'});A.ui.dialog={type:'account',acctId:'ira'};const known=T.dialogHTML();assert.match(known,/Account type detected automatically/);assert.match(known,/id="f-vehicle-wrap" style="display:none;/);A.ui.dialog={type:'holding',acctId:'a'};const holding=T.dialogHTML();assert.ok(holding.indexOf('Current value') < holding.indexOf('Asset class'));assert.match(holding,/id="f-cls" data-act="holding-class"[^>]*disabled/);A.ui.dialog=null;});
check('tickers capitalize immediately and unknown tickers require a class',()=>{const classes=new Set();const elements={'f-ticker':{value:'voo'},'f-cls':{value:'',disabled:true,setAttribute(){},removeAttribute(){}},'holding-class-field':{classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),toggle:(c,on)=>on?classes.add(c):classes.delete(c)}},'f-cls-help':{textContent:''}};sandbox.document.getElementById=id=>elements[id]||null;T.onInput({target:{dataset:{act:'holding-ticker'},value:'voo',closest(){return this;}},preventDefault(){}});elements['f-ticker'].value='voo';T.syncHoldingClassField();assert.equal(elements['f-ticker'].value,'VOO');assert.equal(elements['f-cls'].value,'us_large');assert.equal(elements['f-cls'].disabled,true);elements['f-ticker'].value='zzunknown';T.syncHoldingClassField();assert.equal(elements['f-ticker'].value,'ZZUNKNOWN');assert.equal(elements['f-cls'].value,'');assert.equal(elements['f-cls'].disabled,false);assert.equal(classes.has('is-required'),true);sandbox.document.getElementById=()=>null;});
check('taxable holding entry uses long-term confirmation instead of a purchase date',()=>{A.portfolio.accounts.push({id:'tax',name:'Brokerage',category:'Brokerage',vehicle:'taxable',taxTreatment:'Taxable',status:'active'});A.ui.dialog={type:'holding',acctId:'tax'};const taxable=T.dialogHTML();assert.match(taxable,/id="f-long-term"/);assert.match(taxable,/Held longer than one year/);assert.ok(!taxable.includes('Purchase date'));assert.ok(!taxable.includes('id="f-acquired"'));A.ui.dialog={type:'holding',acctId:'ira'};assert.ok(!T.dialogHTML().includes('id="f-long-term"'));A.ui.dialog=null;});
check('setup goals validate totals, apply selected mix, and reset to no target',()=>{
  T.chooseSetupGoal('60');assert.equal(T.setupGoalTotal(),100);assert.equal(T.applySetupGoal(),true);assert.equal(A.portfolio.goals[0].targets.bonds,40);
  A.ui.setupGoal.targets.bonds=41;assert.equal(T.applySetupGoal(),false);
  T.chooseSetupGoal('none');assert.equal(T.applySetupGoal(),true);assert.equal(A.portfolio.goals.length,0);
});
check('setup defaults to basic groups and preserves detail choices when toggled',()=>{
  T.chooseSetupGoal('80');
  assert.equal(A.ui.setupGoal.level,'group');
  assert.equal(A.ui.setupGoal.targets.stocks,80);
  assert.equal(T.applySetupGoal(),true);
  assert.equal(A.goalDetailTargets(A.portfolio.goals[0]),null);
  assert.equal(A.goalGroupTargets(A.portfolio.goals[0]).stocks,80);
  T.onClick(event('setup-back'));
  let markup=T.renderSetup();
  assert.match(markup,/data-level="group" checked/);
  assert.ok(!markup.includes('id="setup-target-us_large"'));
  T.setSetupGoalLevel('detail');
  assert.equal(A.ui.setupGoal.targets.us_large,50);
  assert.equal(A.ui.setupGoal.targets.intl_dev,30);
  A.ui.setupGoal.targets.us_large=45;A.ui.setupGoal.targets.intl_dev=35;
  const original=JSON.stringify(A.ui.setupGoal.targets);
  T.setSetupGoalLevel('group');assert.equal(A.ui.setupGoal.targets.stocks,80);
  T.setSetupGoalLevel('detail');assert.equal(JSON.stringify(A.ui.setupGoal.targets),original);
  assert.equal(T.applySetupGoal(),true);assert.equal(A.goalDetailTargets(A.portfolio.goals[0]).us_large,45);
  T.setSetupGoalLevel('group');A.ui.setupGoal.targets.stocks=60;A.ui.setupGoal.targets.bonds=40;
  T.setSetupGoalLevel('detail');assert.equal(T.setupGoalTotal(),100);
  assert.equal(A.goalGroupTargets({targets:A.ui.setupGoal.targets}).stocks,60);
  assert.equal(A.ui.setupGoal.targets.us_large,33.75);
  T.chooseSetupGoal('none');assert.equal(A.ui.setupGoal.level,'group');T.applySetupGoal();T.onClick(event('setup-next'));
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
check('goal selector and header identify distinct goals with the same effective date',()=>{
  const oldGoals=A.portfolio.goals;
  try {
    const first={name:'Growth',effectiveDate:'2026-01-01',targets:{stocks:80,bonds:20}};
    const second={name:'Balanced',effectiveDate:'2026-01-01',targets:{stocks:60,bonds:40}};
    A.portfolio.goals=[first,second];
    for(const [key,expected,other] of [['goal:0',first,second],['goal:1',second,first]]) {
      const e=event('pick-goal');e.target.closest=()=>({dataset:{act:'pick-goal'},value:key});T.onChange(e);
      const goal=T.selectedDashboardGoal('2026-09-16');assert.equal(goal,expected);
      const controls=T.driftControlsHTML();
      assert.ok(controls.includes('value="'+key+'" selected'));
      assert.equal((controls.match(/ selected/g)||[]).length,1);
      assert.equal((controls.match(/\(active\)/g)||[]).length,1);
      const header=T.dashKpiHTML(A.portfolio.snapshots[0],{total:10000,byHolding:[]},[],goal);
      assert.ok(header.includes('>'+expected.name+'</div>'));assert.ok(!header.includes('>'+other.name+'</div>'));
    }
    A.ui.goalSel='';assert.equal(T.selectedDashboardGoal('2026-09-16'),second);
    A.ui.goalSel='goal:99';assert.equal(T.selectedDashboardGoal('2026-09-16'),second);assert.equal(A.ui.goalSel,'');
  } finally {A.portfolio.goals=oldGoals;A.ui.goalSel='';}
});
check('first check-in review explains that a comparison is not available',()=>{assert.equal(T.reviewChanges(),null);assert.match(T.renderReviewChanges(),/first check-in/);});
check('review includes archived holdings and distinguishes balance changes',()=>{A.portfolio.holdings[0].status='archived';A.portfolio.snapshots.push({date:'2026-10-16',values:[{holdingId:'h',marketValue:10500}]});assert.equal(T.reviewChanges().delta,500);assert.match(T.renderReviewChanges(),/not investment returns/);});
check('demo blocks account, holding, goal, snapshot and mapping mutations',()=>{A.loadDemoData();const before=JSON.stringify(A.portfolio);for(const a of ['save-account','archive-account','archive-holding','goal-save','ci-save','plan-generate']){assert.equal(T.demoActionAllowed(a),false);T.onClick(event(a));}T.onChange(event('rd-map-vehicle',{account:A.portfolio.accounts[0].id}));assert.equal(JSON.stringify(A.portfolio),before);assert.equal(T.state().dirty,false);});
check('demo allows exploration and temporary modeling',()=>{for(const a of ['nav','pick-snap','drill','rd-retire-age','cl-cost','dollar-mode']) assert.equal(T.demoActionAllowed(a),true);});
check('Start here always opens the guide, including with data present',()=>{T.onClick(event('landing-open'));assert.equal(A.ui.dialog.type,'onboard');});
check('app deep links enter setup, file selection, onboarding, and exact demo chapters without chained dialogs',()=>{window.location.hash='#setup';assert.equal(T.handlePublicRoute(),true);assert.equal(A.ui.view,'setup');assert.equal(T.state().setupStep,1);assert.equal(A.ui.dialog,null);window.location.hash='#open';assert.equal(T.handlePublicRoute(),true);assert.equal(A.ui.view,'openfile');assert.equal(A.ui.dialog,null);assert.match(T.renderOpenFile(),/Choose portfolio file/);window.location.hash='#start';assert.equal(T.handlePublicRoute(),true);assert.equal(A.ui.dialog.type,'onboard');window.location.hash='#lp-privacy';assert.equal(T.handlePublicRoute(),false);for(const [hash,view] of [['#demo/dashboard','dashboard'],['#demo/review/tax','tax'],['#demo/outlook','retire'],['#demo-college','college']]){window.location.hash=hash;assert.equal(T.handlePublicRoute(),true);assert.equal(A.ui.view,view);assert.equal(A.ui.dialog,null);assert.equal(T.state().demoMode,true);}});
check('landing file selection hands the portfolio to the app once and skips the second picker',()=>{const imported=A.emptyPortfolio();imported.accounts.push({id:'a-imported',name:'Imported account',category:'Retirement',status:'active'});window.sessionStorage.setItem(T.handoffKey,JSON.stringify({name:'Existing portfolio.json',text:JSON.stringify(imported)}));window.location.hash='#open';assert.equal(T.handlePublicRoute(),true);assert.equal(A.ui.view,'dashboard');assert.equal(A.portfolio.accounts[0].name,'Imported account');assert.equal(T.state().fileName,'Existing portfolio.json');assert.equal(window.sessionStorage.getItem(T.handoffKey),null);A.loadDemoData();});
check('adding and updating holdings keeps their account expanded in onboarding and check-in',()=>{
  const originalLookup=sandbox.document.getElementById;
  try {
    for(const step of [3,0]) {
      A.portfolio=A.emptyPortfolio();T.setMode(step);A.ui.view=step?'setup':'checkin';
      A.portfolio.accounts.push({id:'first',name:'First IRA',category:'Retirement',status:'active'}, {id:'second',name:'Second IRA',category:'Retirement',status:'active'});
      A.ui.checkin=null;T.ensureCheckinDraft();
      assert.equal(A.ui.checkinOpen.first,true);assert.ok(!A.ui.checkinOpen.second);
      const fields={'f-ticker':{value:'VTI'},'f-hname':{value:''},'f-cls':{value:'us_total',disabled:true},'f-val':{value:'1000'},'f-basis':{value:''}};
      sandbox.document.getElementById=id=>fields[id]||null;
      T.saveHoldingFromDialog('second');
      const h=A.portfolio.holdings[0];
      assert.equal(A.ui.checkinOpen.second,true);assert.equal(A.ui.checkinOpen.first,true);
      assert.match(T.checkinAccountBlock(A.portfolio.accounts[1],A.ui.checkin,{}),/class="table checkin-holdings"/);
      A.ui.checkinOpen.first=false;
      T.onInput(event('ci-val',{hid:h.id}));
      assert.equal(A.ui.checkin.values[h.id].marketValue,'999');assert.equal(A.ui.checkinOpen.second,true);assert.equal(A.ui.checkinOpen.first,false);
      T.setHoldingClass(h.id,'us_large');assert.equal(A.ui.checkinOpen.second,true);
      T.onClick(event('ci-toggle',{account:'second'}));assert.equal(A.ui.checkinOpen.second,false);
    }
  } finally {sandbox.document.getElementById=originalLookup;A.loadDemoData();}
});
(async()=>{const r=await T.saveFile();assert.equal(r.ok,false);console.log('✓ demo file saving blocked');checks++;console.log(checks+' onboarding regression groups passed');})().catch(e=>{console.error(e);process.exitCode=1;});
