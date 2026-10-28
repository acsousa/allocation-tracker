/* Explicit, one-time same-tab transfer. Transfer validated inputs only after the user chooses to build a portfolio. */
(() => {
  const key='qm-retirement-setup-v1';
  window.quartermasterRetirementHandoff = input => {
    const {currentAge,retirementAge,planThroughAge,stocksPct}=input;
    if (![currentAge,retirementAge,planThroughAge].every(Number.isInteger) || !Number.isFinite(stocksPct) || currentAge<18 || currentAge>100 || retirementAge<40 || retirementAge>80 || retirementAge<currentAge || planThroughAge<=retirementAge || planThroughAge>110 || stocksPct<0 || stocksPct>100)
      return {ok:false,error:'The full portfolio planner supports retirement ages 40–80. You can still build a portfolio without transferring this estimate.'};
    const values={currentAge,retirementAge,planThroughAge,stocksPct};
    for(const k of ['savings','monthlyContribution','monthlySpending','socialSecurityMonthly','socialSecurityAge','pensionMonthly','pensionAge']) {
      const n=input[k];
      if(!Number.isFinite(n)||n<0||n>10000000)return {ok:false,error:'Please check your financial inputs before continuing.'};
      values[k]=n;
    }
    if(!Number.isInteger(values.socialSecurityAge)||values.socialSecurityAge<62||values.socialSecurityAge>70||!Number.isInteger(values.pensionAge)||values.pensionAge<18||values.pensionAge>110||values.monthlySpending*12>10000000)return {ok:false,error:'Please check your income ages and annual budget before continuing.'};
    try {
      sessionStorage.setItem(key,JSON.stringify({version:2,expiresAt:Date.now()+5*60*1000,input:values}));
      window.location.assign('/app/#retirement-start');
      return {ok:true};
    } catch(_) { try{sessionStorage.removeItem(key);}catch(_){} return {ok:false,error:'Your browser blocked the transfer. Build a portfolio without transferring, or enable session storage and try again.'}; }
  };
})();
