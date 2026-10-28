/* The standalone UI keeps financial inputs in memory. Analytics events carry no input values. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), form = $('rs-form');
  const model = globalThis.RetirementSimulatorModel;
  const money = n => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
  const compact = n => new Intl.NumberFormat('en-US', {style:'currency',currency:'USD',notation:'compact',maximumFractionDigits:1}).format(n);
  const percent = n => (100*n).toFixed(1)+'%';
  const escape = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let worker=null, runId=0, result=null, baselineInput=null, dirty=false, started=false, isExample=false;
  const names={currentAge:'Current age',retirementAge:'Retirement age',planThroughAge:'Plan through age',savings:'Retirement savings',monthlyContribution:'Monthly contributions',monthlySpending:'Monthly retirement budget',stocksPct:'Investment mix',socialSecurityMonthly:'Social Security',socialSecurityAge:'Social Security start age',pensionMonthly:'Pension',pensionAge:'Pension start age'};
  const compareKinds={save:'save-more',retire:'retire-later',spend:'spend-less'};
  const compareTitles={save:'Save $250 more each month',retire:'Retire two years later',spend:'Spend up to $250 less each month'};
  function track(name){ if(globalThis.quartermasterAnalytics?.event) globalThis.quartermasterAnalytics.event(name); }
  function values(){ return Object.fromEntries(Object.keys(names).map(k=>[k,form.elements.namedItem(k).value])); }
  function fill(v){ for(const k of Object.keys(names)) if(v[k]!==undefined) form.elements.namedItem(k).value=v[k]; updateMix(); }
  function updateMix(){ const n=Number(form.elements.stocksPct.value); $('rs-mix').textContent=`${n}% stocks / ${100-n}% bonds`; }
  function showError(message){ $('rs-errors').textContent=message; $('rs-errors').hidden=!message; }
  function validate(){
    for(const k of Object.keys(names)) form.elements.namedItem(k).removeAttribute('aria-invalid');
    const v=model.validate(values());
    if(!v.valid){ for(const k of Object.keys(v.errors)){ const el=form.elements.namedItem(k); el?.setAttribute('aria-invalid','true'); if(el?.closest('details'))el.closest('details').open=true; } showError(Object.entries(v.errors).map(([k,e])=>`${names[k]||k}: ${e}`).join(' ')); form.elements.namedItem(Object.keys(v.errors)[0])?.focus(); return null; }
    showError(''); return v.value;
  }
  function busy(on){ $('rs-results').setAttribute('aria-busy',String(on)); $('rs-run').disabled=on; $('rs-cancel').hidden=!on; updateComparisons(on); }
  function updateComparisons(on=false){
    document.querySelectorAll('[data-compare]').forEach(b=>{
      const k=b.dataset.compare,v=baselineInput;
      b.disabled=on||dirty||!v||(k==='save'&&v.currentAge===v.retirementAge)||(k==='retire'&&v.retirementAge+2>=v.planThroughAge)||(k==='spend'&&v.monthlySpending===0);
      b.title=k==='save'&&v&&v.currentAge===v.retirementAge?'Contributions stop once retired.':dirty?'Run again with your updated inputs.':'';
    });
  }
  function cancel(message='Simulation canceled. Your previous results are unchanged.'){
    ++runId; worker?.terminate(); worker=null; busy(false); $('rs-status').textContent=message;
  }
  function request(input,comparison){
    cancel(''); const id=++runId; busy(true); $('rs-status').textContent=comparison?'Comparing the same market paths…':'Exploring 10,000 possible market paths…';
    try { worker=new Worker('/assets/retirement-simulator-worker.js'); }
    catch(e){busy(false);$('rs-status').textContent='The simulator could not start. Reload the page and try again.';return;}
    worker.onerror=()=>{if(id!==runId)return;cancel('The simulator could not finish. Please reload and try again.');};
    worker.onmessage=({data})=>{
      if(id!==runId||data.id!==id)return;
      worker.terminate();worker=null;busy(false);
      if(data.error){$('rs-status').textContent=typeof data.error==='string'?data.error:'Check your inputs and try again.';return;}
      $('rs-status').textContent='';
      if(comparison){ renderComparison(data.result,comparison); track('retirement_comparison'); }
      else {result=data.result;baselineInput={...input};dirty=false;$('rs-stale').hidden=true;renderResult();track('retirement_simulation_complete');}
    };
    worker.postMessage({id,input,comparison:comparison?compareKinds[comparison]:undefined,options:{paths:10000,seed:20261027}});
  }
  function renderResult(){
    const r=result,v=baselineInput;
    $('rs-empty').hidden=true; $('rs-output').hidden=false; $('rs-transfer').hidden=false;
    $('rs-metrics').innerHTML=`<div class="rs-metric"><span>Funding confidence</span><strong>${escape(r.confidence)} <small style="display:inline;font-size:20px;color:inherit">(${percent(r.success)})</small></strong><small>Paths that fund your budget through age ${v.planThroughAge}</small></div><div class="rs-metric"><span>${v.currentAge===v.retirementAge?'Savings today':'Before retirement'}</span><strong>${compact(r.retirementBalance)}</strong><small>${escape(r.retirementBalanceLabel)}${v.currentAge===v.retirementAge?'':` · age ${v.retirementAge-1}`}</small></div><div class="rs-metric"><span>Your timeline</span><strong>${v.retirementAge} → ${v.planThroughAge}</strong><small>Retirement → plan-through age</small></div>`;
    $('rs-comparison').innerHTML=''; document.querySelectorAll('[data-compare]').forEach(b=>b.setAttribute('aria-pressed','false')); updateComparisons(); renderChart(r);
    if(matchMedia('(max-width:800px)').matches)$('rs-results').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});
  }
  function renderComparison(c,kind){
    const b=c.baseline,s=c.scenario,delta=(s.success-b.success)*100;
    document.querySelectorAll('[data-compare]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.compare===kind)));
    $('rs-comparison').innerHTML=`<div class="rs-comparison-card"><strong>${compareTitles[kind]}</strong><p>Funding confidence: ${percent(b.success)} → <b>${percent(s.success)}</b> (${delta>=0?'+':''}${delta.toFixed(1)} percentage points).</p><p>Your baseline chart stays unchanged. This comparison uses the same market paths; it is not a recommendation.</p><button type="button" class="rs-text-button" id="rs-reset-comparison">Clear comparison</button></div>`;
    $('rs-reset-comparison').onclick=()=>{$('rs-comparison').innerHTML='';document.querySelectorAll('[data-compare]').forEach(el=>el.setAttribute('aria-pressed','false'));};
  }
  function renderChart(r){
    const data=r.bands,W=Math.max(280,Math.min(620,$('rs-chart').clientWidth)),H=W<400?280:320,L=52,R=14,T=44,B=38,innerW=W-L-R,innerH=H-T-B;
    const first=data[0].age,last=data[data.length-1].age,max=Math.max(1,...data.map(d=>d.p90));
    const x=a=>L+(a-first)/(last-first)*innerW,y=v=>T+innerH*(1-v/max);
    const path=(key,arr=data)=>arr.map((d,i)=>`${i?'L':'M'}${x(d.age).toFixed(2)},${y(d[key]).toFixed(2)}`).join(' ');
    const area=path('p90')+' '+path('p10',[...data].reverse()).replace(/^M/,'L')+' Z';
    const ageTicks=[first,...Array.from({length:Math.floor(last/10)-Math.floor(first/10)},(_,i)=>(Math.floor(first/10)+i+1)*10).filter(a=>a<last),last];
    const grid=[0,.25,.5,.75,1].map(p=>`<line x1="${L}" x2="${W-R}" y1="${y(max*p)}" y2="${y(max*p)}" stroke="#e5ebee"/><text x="${L-9}" y="${y(max*p)+4}" text-anchor="end" font-size="11" fill="#52616e">${escape(compact(max*p))}</text>`).join('');
    $('rs-chart').innerHTML=`<svg viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="rs-chart-title rs-chart-desc"><title id="rs-chart-title">Projected savings in today’s dollars</title><desc id="rs-chart-desc">Median and middle 80 percent of 10,000 modeled paths. Use the age slider below to read values. Balances are annual year-end; the retirement-age point includes that year’s withdrawal.</desc>${grid}<path d="${area}" fill="#dceaf7"/><path d="${path('p50')}" fill="none" stroke="#0f6493" stroke-width="3"/>${ageTicks.map(a=>`<text x="${x(a)}" y="${H-13}" text-anchor="middle" font-size="11" fill="#52616e">${a}</text>`).join('')}<g id="rs-marker"><line id="rs-marker-line" y1="${T}" y2="${H-B}" stroke="#1e8175" stroke-dasharray="4 3"/><circle id="rs-marker-dot" r="4" fill="#0f6493" stroke="white" stroke-width="2"/><text id="rs-marker-text" x="${L}" y="20" font-size="13" font-weight="600" fill="#153c55"></text></g><rect id="rs-chart-hit" x="${L}" y="${T}" width="${innerW}" height="${innerH}" fill="transparent"/></svg><label class="rs-small" for="rs-chart-age">Explore age <output id="rs-chart-readout"></output></label><input id="rs-chart-age" type="range" min="${first}" max="${last}" value="${r.retirementAge}" aria-label="Explore projection by age" style="width:100%;accent-color:#0f6493"><p class="rs-small">Annual year-end balances. The retirement-age point includes the first year’s spending.</p>`;
    const setAge=age=>{const d=data.reduce((best,row)=>Math.abs(row.age-age)<Math.abs(best.age-age)?row:best,data[0]);$('rs-marker-line').setAttribute('x1',x(d.age));$('rs-marker-line').setAttribute('x2',x(d.age));$('rs-marker-dot').setAttribute('cx',x(d.age));$('rs-marker-dot').setAttribute('cy',y(d.p50));$('rs-marker-text').textContent=`Age ${d.age}${d.age===r.retirementAge?' · retirement':''} — median ${W<400?compact(d.p50):money(d.p50)}`;$('rs-chart-age').value=d.age;$('rs-chart-age').setAttribute('aria-valuetext',`Age ${d.age}, median ${money(d.p50)}`);$('rs-chart-readout').textContent=`${d.age} · median ${money(d.p50)}`;};
    const svg=$('rs-chart').querySelector('svg');
    svg.addEventListener('pointermove',e=>{if(e.pointerType==='touch')return;const b=svg.getBoundingClientRect();setAge(first+(((e.clientX-b.left)/b.width*W)-L)/innerW*(last-first));});
    svg.addEventListener('pointerleave',()=>setAge(r.retirementAge));
    $('rs-chart-age').oninput=e=>setAge(Number(e.target.value)); setAge(r.retirementAge);
  }
  function changed(){ if(worker)cancel('Inputs changed. Run again to update your outlook.'); dirty=!!result; if(dirty)$('rs-comparison').innerHTML=''; $('rs-stale').hidden=!dirty; $('rs-transfer').hidden=dirty||!result; updateComparisons(); updateMix(); if(!started){track('retirement_input_start');started=true;} }
  form.addEventListener('input',()=>{if(isExample){$('rs-example-label').textContent='Edited example — review every input before treating this as your own estimate.';}changed();});
  form.addEventListener('submit',e=>{e.preventDefault();if(!model){showError('The simulator did not load. Please reload this page.');return;}const v=validate();if(v)request(v);});
  $('rs-cancel').onclick=()=>cancel();
  $('rs-example').onclick=()=>{if(!model)return;track('retirement_example');fill(model.defaults);isExample=true;$('rs-example-label').textContent='Example scenario — change these numbers to explore your own.';$('rs-example-label').hidden=false;changed();const v=validate();if(v)request(v);};
  document.querySelectorAll('[data-compare]').forEach(b=>b.onclick=()=>{if(baselineInput&&!dirty)request(baselineInput,b.dataset.compare);});
  $('rs-export').onclick=()=>{const v=validate();if(!v)return;const blob=new Blob([JSON.stringify({format:'quartermaster-retirement-scenario',version:1,input:v},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='retirement-scenario.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  $('rs-import').onchange=async e=>{const file=e.target.files[0];e.target.value='';if(!file)return;try{if(file.size>100000)throw Error('Choose a retirement scenario file smaller than 100 KB.');const parsed=JSON.parse(await file.text());if(parsed.format!=='quartermaster-retirement-scenario'||parsed.version!==1||!model.validate(parsed.input).valid)throw Error('Choose a valid Quartermaster retirement scenario file.');fill(model.validate(parsed.input).value);isExample=false;$('rs-example-label').hidden=true;changed();validate();$('rs-status').textContent='Scenario opened locally. Run it to see updated results.';}catch(err){showError(err.message);}};
  $('rs-transfer').onclick=()=>{const v=validate();if(!v)return;if(typeof globalThis.quartermasterRetirementHandoff!=='function'){showError('Could not transfer assumptions. Use Build my portfolio to start fresh.');return;}const answer=globalThis.quartermasterRetirementHandoff(v);if(answer?.ok===false){showError(answer.error);$('rs-errors').scrollIntoView({block:'center'});}else if(answer?.ok){track('retirement_handoff');}};
  $('rs-build').addEventListener('click',()=>track('retirement_portfolio_click'));
  if(model){const a=model.assumptions;$('rs-assumptions').innerHTML=`<p>Annual real return assumptions: stocks ${a.stockRealReturnPct}%, bonds ${a.bondRealReturnPct}%. Annual volatility: ${a.stockVolatilityPct}% / ${a.bondVolatilityPct}%. Stock/bond correlation: ${a.stockBondCorrelation}. Mix uses US Total Market stocks and US Bonds. High confidence ≥85%; medium ≥70%; low &lt;70%.</p>`;}else{showError('The simulator did not load. Please reload this page.');$('rs-run').disabled=true;}
  let chartWidth=0; if(globalThis.ResizeObserver)new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(result&&Math.abs(width-chartWidth)>5){chartWidth=width;renderChart(result);}}).observe($('rs-chart'));
  updateMix();
})();
