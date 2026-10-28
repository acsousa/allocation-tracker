/* Explicit, one-time same-tab transfer. Never store balances, budget or income. */
(() => {
  const key='qm-retirement-setup-v1';
  window.quartermasterRetirementHandoff = input => {
    const {currentAge,retirementAge,planThroughAge,stocksPct}=input;
    if (![currentAge,retirementAge,planThroughAge].every(Number.isInteger) || !Number.isFinite(stocksPct) || currentAge<18 || currentAge>100 || retirementAge<40 || retirementAge>80 || retirementAge<currentAge || planThroughAge<=retirementAge || planThroughAge>110 || stocksPct<0 || stocksPct>100)
      return {ok:false,error:'The full portfolio planner supports retirement ages 40–80. You can still build a portfolio without transferring this estimate.'};
    try {
      sessionStorage.setItem(key,JSON.stringify({version:1,expiresAt:Date.now()+5*60*1000,input:{currentAge,retirementAge,planThroughAge,stocksPct}}));
      window.location.assign('/app/#retirement-start');
      return {ok:true};
    } catch(_) { try{sessionStorage.removeItem(key);}catch(_){} return {ok:false,error:'Your browser blocked the transfer. Build a portfolio without transferring, or enable session storage and try again.'}; }
  };
})();
