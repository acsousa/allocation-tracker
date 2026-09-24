/* Boundary and asynchronous persistence regressions. No dependencies. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.html'), 'utf8').match(/\n<script>\n([\s\S]*)\n<\/script>/)[1];
let input, picker, pickerOptions, writeHook, downloads = 0;
const window = { addEventListener() {}, showSaveFilePicker: async options => { pickerOptions = options; return picker; }, showOpenFilePicker: async () => [picker] };
const sandbox = { window, self: {}, console, setTimeout() {}, Blob,
  URL: { createObjectURL() { downloads++; return 'blob:test'; }, revokeObjectURL() {} },
  document: { addEventListener() {}, createElement() { return input = { style: {}, click() {}, remove() { this.removed = true; } }; }, body: { appendChild() {} } },
};
vm.createContext(sandbox);
vm.runInContext(source + `\nwindow.test = { csvEscape, tryAutoload, openFileViaInput,
  setState(p, h) { portfolio = p; fileHandle = h; demoMode = false; checkinDraftDirty = false; dirty = true; persistenceStatus = h ? 'saved' : 'not-saved'; pendingDownloadSave = null; },
  state() { return { portfolio, fileHandle, fileName, dirty, persistenceStatus, pendingDownloadSave }; }
};`, sandbox);
const A = window.__AAT__, T = window.test;
const fresh = () => JSON.parse(JSON.stringify(A.emptyPortfolio()));
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('✓ ' + name); }
check('migration is immutable and restores missing metadata defaults', () => {
  const p = { meta: { schemaVersion: 3 }, accounts: [{ id: 'a', name: 'IRA' }], holdings: [{id:'h',accountId:'a',ticker:'voo'}] };
  const before = JSON.stringify(p), next = A.migrate(p);
  assert.equal(JSON.stringify(p), before); assert.equal(next.meta.driftBandPct, 5); assert.ok(next.accounts[0].vehicle); assert.equal(next.holdings[0].ticker,'VOO'); assert.equal(next.meta.schemaVersion,7);
});
check('metadata-only legacy files and demo round-trip remain supported', () => {
  assert.equal(A.migrate({meta:{schemaVersion:5}}).holdings.length, 0);
  A.loadDemoData(); assert.equal(A.migrate(JSON.parse(JSON.stringify(A.portfolio))).holdings.length, 13);
});
check('malformed arrays, unsafe properties, duplicate IDs, and orphan holdings rejected', () => {
  for (const p of [[], {}, { meta: {}, accounts: {} }, JSON.parse('{"meta":{},"__proto__":{"x":1}}'),
    { accounts: [{id:'a'}, {id:'a'}], holdings: [] }, {accounts:[],holdings:[{id:'h',accountId:'a'}]},
    { accounts: [{id:'<svg onload=x>'}], holdings: [] }]) assert.throws(() => A.migrate(p), /Invalid portfolio/);
});
check('invalid snapshot money, duplicates, dates, and runaway path counts rejected', () => {
  const base = fresh(); base.accounts.push({id:'a'}); base.holdings.push({id:'h',accountId:'a'});
  for (const value of ['100', -1, Infinity]) { const p = structuredClone(base); p.snapshots=[{date:'2026-01-01',values:[{holdingId:'h',marketValue:value}]}]; assert.throws(() => A.migrate(p)); }
  for (const date of ['2026-02-30', 'bad']) { const p=structuredClone(base);p.snapshots=[{date,values:[]}];assert.throws(() => A.migrate(p)); }
  const p=structuredClone(base);p.snapshots=[{date:'2026-01-01',values:[{holdingId:'h',marketValue:1},{holdingId:'h',marketValue:2}]}];assert.throws(() => A.migrate(p));
  p.snapshots=[];p.retirementSettings.paths=100000000;assert.throws(() => A.migrate(p));
  const badFlag=structuredClone(base);badFlag.holdings[0].longTermHolding='yes';assert.throws(() => A.migrate(badFlag));
});
check('CSV protects text formulas, preserves numeric losses, and escapes CR', () => {
  assert.equal(T.csvEscape('=1+1'), "'=1+1"); assert.equal(T.csvEscape(' \t@SUM(A1)'), "' \t@SUM(A1)");
  assert.equal(T.csvEscape(-12), '-12');assert.equal(T.csvEscape('a\rb'), '"a\rb"');assert.equal(T.csvEscape('a"b'), '"a""b"');
});
async function main() {
  const old = {name:'old.json'};
  picker = {name:'new.json',createWritable:async()=>({write:async()=>{if(writeHook)writeHook();},close:async()=>{}})};
  let p=fresh();T.setState(p,old);writeHook=()=>{p.meta.driftBandPct=9;};
  assert.equal((await A.saveFile(true)).via,'fsa');assert.equal(T.state().dirty,true);checks++;
  T.setState(fresh(),old);writeHook=null;await A.saveFile(true);assert.equal(T.state().dirty,false);assert.equal(T.state().fileHandle,picker);checks++;
  const replacement=fresh();T.setState(fresh(),old);writeHook=()=>T.setState(replacement,old);await A.saveFile(true);assert.equal(T.state().fileHandle,old);assert.equal(T.state().dirty,true);checks++;
  picker={name:'invalid.json',getFile:async()=>({text:async()=>'{broken'})};T.setState(replacement,old);
  assert.equal((await A.openFile()).ok,false);assert.equal(T.state().portfolio,replacement);checks++;
  const pending=T.openFileViaInput();input.oncancel();assert.equal((await pending).aborted,true);assert.equal(input.removed,true);checks++;
  sandbox.location={protocol:'https:'};sandbox.fetch=()=>{throw Error('Unexpected network');};assert.equal((await T.tryAutoload()).loaded,false);checks++;
  assert.equal(downloads,0);
  writeHook=null;
  picker={name:'Retirement.json',createWritable:async()=>({write:async()=>{},close:async()=>{}})};
  T.setState(fresh(),old);
  await A.saveFile(false,'Retirement.json');
  assert.equal(pickerOptions.suggestedName,'Retirement.json');
  assert.equal(T.state().fileName,'Retirement.json');assert.equal(T.state().fileHandle,picker);checks++;
  const beforeName=T.state().fileName;
  window.showSaveFilePicker=async()=>{const e=new Error('cancel');e.name='AbortError';throw e;};
  assert.equal((await A.saveFile(false,'Cancelled.json')).aborted,true);
  assert.equal(T.state().fileName,beforeName);checks++;
  window.showSaveFilePicker=async()=>{throw new Error('Unsupported');};
  await A.saveFile(false,'Downloaded.json');
  assert.equal(input.download,'Downloaded.json');assert.equal(T.state().fileName,'Downloaded.json');
  assert.equal(T.state().fileHandle,null);assert.equal(T.state().persistenceStatus,'download-pending');
  assert.equal(T.state().pendingDownloadSave.name,'Downloaded.json');checks++;
  console.log(`${checks} persistence regression groups passed`);
}
main().catch(e=>{console.error(e);process.exitCode=1;});
