const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync('assets/retirement-handoff.js','utf8'),source=fs.readFileSync('app.html','utf8');
let stored=null,destination=null;
const storage={setItem(k,v){stored=v;},getItem(){return stored;},removeItem(){stored=null;}};
const window={location:{assign(v){destination=v;}},sessionStorage:storage};
const ctx={window,sessionStorage:storage,Date};vm.createContext(ctx);vm.runInContext(code,ctx);
assert.equal(stored,null,'No automatic storage');
assert.equal(window.quartermasterRetirementHandoff({currentAge:40,retirementAge:65,planThroughAge:95,stocksPct:60,savings:999999,monthlySpending:8888}).ok,true);
assert.equal(destination,'/app/#retirement-start');assert.ok(!stored.includes('savings'));assert.ok(!stored.includes('monthlySpending'));
vm.runInContext(source.slice(source.indexOf('function consumeRetirementSetup()'),source.indexOf('function startRetirementSetup()')),ctx);
assert.equal(ctx.consumeRetirementSetup().retirementAge,65);assert.equal(stored,null,'Consume removes data');assert.equal(ctx.consumeRetirementSetup(),null);
for(const expiresAt of [Date.now()-1,Date.now()+3600000]){stored=JSON.stringify({version:1,expiresAt,input:{currentAge:40,retirementAge:65,planThroughAge:95,stocksPct:60}});assert.equal(ctx.consumeRetirementSetup(),null);assert.equal(stored,null);}
stored='invalid json';assert.equal(ctx.consumeRetirementSetup(),null);assert.equal(stored,null);
assert.equal(window.quartermasterRetirementHandoff({currentAge:40,retirementAge:39,planThroughAge:95,stocksPct:60}).ok,false);
storage.setItem=()=>{throw Error('blocked');};assert.equal(window.quartermasterRetirementHandoff({currentAge:40,retirementAge:65,planThroughAge:95,stocksPct:60}).ok,false);
console.log('Retirement handoff: explicit only, no balances/income, short-lived, one-time, invalid data and blocked storage passed.');
