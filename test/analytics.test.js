const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const code = fs.readFileSync(require('node:path').join(__dirname, '../site-analytics.js'), 'utf8');
function load(host = 'realallocation.com', protocol = 'https:', pathname = '/index.html') {
  const calls = [], listeners = {};
  const window = {gtag: (...args) => calls.push(args)};
  vm.runInNewContext(code, {window, location: {hostname:host, protocol, origin:protocol+'//'+host, pathname}, document:{addEventListener:(name, fn)=>{listeners[name]=fn;}}});
  return {calls, listeners, analytics: window.quartermasterAnalytics};
}
for (const [host, protocol] of [['localhost','http:'], ['127.0.0.1','https:'], ['preview.pages.dev','https:'], ['realallocation.com','http:'], ['', 'file:']]) {
  const r=load(host,protocol); assert.equal(r.analytics,undefined); assert.equal(r.calls.length,0);
}
const r=load(), a=r.analytics;
assert.equal(r.calls[0][2].send_page_view,false);
a.view('dashboard','personal'); a.view('dashboard','personal');
let events=()=>r.calls.filter(c=>c[0]==='event');
assert.equal(events().filter(c=>c[1]==='page_view').length,1);
a.view('review','personal'); a.view('dashboard','personal');
assert.equal(events().filter(c=>c[1]==='page_view').length,3);
a.view('setup','personal',1); a.view('setup','personal',1); a.view('setup','personal',2);
assert.equal(events().filter(c=>c[1]==='setup_step_view').length,2);
a.event('portfolio_save_success',{save_method:'download_initiated', filename:'SECRET.json',balance:12345,portfolio_mode:'private name'});
const sent=events().at(-1)[2];assert.equal(sent.save_method,'download_initiated');assert.ok(!JSON.stringify(sent).includes('SECRET'));assert.ok(!('balance' in sent));assert.equal(sent.portfolio_mode,'personal');
const count=r.calls.length;a.event('private_name');a.view('SECRET');assert.equal(r.calls.length,count);
a.view('dashboard','demo');assert.equal(events().at(-1)[2].portfolio_mode,'demo');
const pricing=load('realallocation.com','https:','/pricing.html');pricing.listeners.DOMContentLoaded();
assert.equal(pricing.calls.at(-1)[2].page_location,'https://realallocation.com/pricing.html');
pricing.listeners.click({target:{closest:()=>({dataset:{analyticsEvent:'paid_interest_click',analyticsFeature:'reports'}})}});
assert.equal(pricing.calls.at(-1)[1],'paid_interest_click');assert.equal(pricing.calls.at(-1)[2].feature,'reports');
console.log('Analytics checks passed: production hosts, deduplication, setup steps, payload allowlist, demo labeling and pricing clicks.');
