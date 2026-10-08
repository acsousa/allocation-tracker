/* Shared holding editor. Model validation and event handling live in app.html. */
function holdingEditorHTML(d) {
  const original = portfolio.holdings.find(x => x.id === d.hid);
  const h = original ? {...original,...(d.baseHolding || {}),...(d.values || {})} : null;
  if (!h) return '<div class="dialog-title">Holding unavailable</div><p>This holding could not be found.</p><div class="dialog-actions"><button class="btn btn-secondary" data-act="close-dialog">Close</button></div>';
  const v = d.values || {}, edits = d.assumptions || {}, inherited = editorInheritedAssumptions(d) || {};
  const account = accountById(h.accountId), disabled = d.draft ? '' : ' disabled';
  const text = x => x == null ? '' : String(x);
  const positionField = (key, label, options = {}) => `<div class="field"><label for="he-${key}">${label}</label><input class="input${options.numeric ? ' tnum' : ''}" id="he-${key}" data-act="he-input" data-field="${key}" value="${esc(text(v[key]))}"${options.numeric ? ' inputmode="decimal"' : ''}${disabled}${options.placeholder ? ` placeholder="${esc(options.placeholder)}"` : ''}></div>`;
  const optionHTML = (option, selected) => { const val = Array.isArray(option) ? option[0] : typeof option === 'object' ? option.value : option; const label = Array.isArray(option) ? option[1] : typeof option === 'object' ? option.label : option; return `<option value="${esc(text(val))}"${String(selected) === String(val) ? ' selected' : ''}>${esc(text(label))}</option>`; };
  const assumptionField = (key, label, help) => {
    const value = edits[key], isSet = value !== undefined && value !== null && value !== '';
    const fallback = inherited[key], known = fallback !== undefined && fallback !== null && fallback !== '';
    const id = `he-a-${key}`;
    return `<div class="field he-assumption-field"><div class="he-field-label"><label for="${id}">${label}</label><button type="button" class="he-reset" data-act="he-reset" data-field="${key}" aria-label="Reset ${label} to default"${isSet ? '' : ' disabled'}>Reset</button></div><input class="input tnum" id="${id}" data-act="he-assumption" data-field="${key}" aria-describedby="${id}-help" inputmode="decimal" data-inherited="${isSet ? 'false' : 'true'}" value="${esc(isSet ? text(value) : known ? text(fallback) : '')}" placeholder="Unknown"><span id="${id}-help" class="he-field-hint">${!isSet && known ? `${key === 'expenseRatio' ? 'Issuer default' : 'Model default'}. ` : ''}${help}</span></div>`;
  };
  return `<div class="dialog-title">Edit holding <span class="he-title-ticker">${esc(h.ticker || '')}</span></div>
    <p class="he-subtitle">${esc(account?.name || 'Account')}</p>
    ${d.identityNotice ? `<p class="he-section-note">${esc(d.identityNotice)}</p>` : ''}
    ${d.error ? `<div class="he-error" id="he-error" role="alert" tabindex="-1">${esc(d.error)}</div>` : ''}
    ${d.draft ? '<section class="he-section" aria-labelledby="he-position-title"><h3 id="he-position-title">Position details</h3>' : '<details class="he-section he-details he-position-readonly"><summary id="he-position-title">Position details · read-only</summary>'}
      ${d.draft ? '<p class="he-section-note">Updates apply to your current check-in.</p>' : `<div class="he-readonly"><p>Recorded check-ins are read-only${d.snapshotDate ? ` · ${esc(d.snapshotDate)}` : ''}.</p><button type="button" class="btn btn-secondary btn-sm" data-act="he-start-checkin" data-hid="${esc(h.id)}">${ui.checkin ? 'Resume check-in to edit' : 'Start check-in to edit'}</button></div>`}
      <div class="he-grid">${positionField('ticker','Ticker')}${positionField('name','Holding name')}
        <div class="field"><label for="he-accountId">Account</label><select class="input" id="he-accountId" data-act="he-input" data-field="accountId"${disabled}>${portfolio.accounts.filter(a => a.status !== 'archived' || a.id === v.accountId).map(a => optionHTML({value:a.id,label:a.name},v.accountId)).join('')}</select></div>

        ${cryptoSymbol(v.ticker) || directCryptoSymbol(v.ticker) ? `<div class="field"><label for="he-instrumentKind">Instrument identity</label><select class="input" id="he-instrumentKind" data-act="he-input" data-field="instrumentKind"${disabled}>${[{value:'',label:'Use ticker identity'},{value:'etf',label:'Exchange-traded fund (ETF)'},{value:'direct-crypto',label:'Cryptocurrency held directly'}].map(o => optionHTML(o,v.instrumentKind || '')).join('')}</select></div>` : ''}
        ${positionField('marketValue','Market value ($)',{numeric:true})}${positionField('costBasis','Total cost basis ($)',{numeric:true,placeholder:'Unknown'})}
      </div>
      <label class="he-checkbox" for="he-longTermHolding"><input type="checkbox" id="he-longTermHolding" data-act="he-input" data-field="longTermHolding"${v.longTermHolding === true || v.longTermHolding === 'true' ? ' checked' : ''}${disabled}>Held longer than one year</label>
    ${d.draft ? '</section>' : '</details>'}
    <section class="he-section" aria-labelledby="he-assumptions-title"><h3 id="he-assumptions-title">Fund details</h3>
      <p class="he-section-note">Applies to all holdings of ${esc(h.ticker || 'this fund')}.</p>
      <div class="he-grid">${h.instrumentKind === 'direct-crypto' || directCryptoSymbol(h.ticker) ? '' : assumptionField('expenseRatio','Expense ratio (%)','Annual fund cost. Enter 0.20 for 0.20%.')}${assumptionField('divYield','Income yield (%)','Annual dividends and interest, not total return.')}</div>
    </section>
    ${holdingAllocationHTML(d,h)}
    <div class="dialog-actions he-actions"><button type="button" class="btn btn-secondary" data-act="close-dialog">Cancel</button><button type="button" class="btn btn-primary" data-act="he-apply">Apply changes</button></div>`;
}

function holdingAllocationHTML(d,h) {
 const comp=d.allocationEdited?d.values.composition:(compositionOf(h)||{});
 const sum=Object.values(comp||{}).reduce((n,v)=>n+(Number(v)||0),0);
 return `<details class="he-section he-details he-allocation"${d.allocationOpen?' open':''}><summary>Fund allocation details</summary><div class="he-allocation-body">
 <p class="he-section-note">Choose one class or split the fund across classes.${d.draft?'':' Changes will go into a check-in; recorded history stays unchanged.'}</p>
 <div class="field"><label for="he-assetClass">Single asset class</label><select class="input" id="he-assetClass" data-act="he-allocation-class">${sum>0?'<option value="" selected disabled>Split allocation</option>':''}${TAXONOMY.detail.map(c=>`<option value="${esc(c.id)}"${sum===0&&d.values.assetClass===c.id?' selected':''}>${esc(c.label)}</option>`).join('')}</select><span class="he-field-hint">Choosing a class clears the split.</span></div>
 <div class="he-field-label"><span class="he-allocation-label">Or split across classes (%)</span><span id="he-allocation-total" class="he-field-hint" role="status">Total ${sum}%</span></div>
 <div class="he-presets" aria-label="Allocation presets">${[['90/10','90/10'],['80/20','80/20'],['60/40','60/40'],['three-fund','Three-fund'],['us-total','US Total'],['clear','Clear']].map(([id,label])=>`<button type="button" class="btn btn-sm btn-secondary" data-act="he-allocation-preset" data-preset="${id}">${label}</button>`).join('')}</div>
 <div class="he-allocation-grid">${TAXONOMY.detail.map(c=>`<div class="he-allocation-row"><span class="swatch" style="background:${detailColor(c.id)}" aria-hidden="true"></span><label for="he-split-${c.id}">${esc(c.label)}</label><input class="input tnum" id="he-split-${c.id}" data-act="he-allocation-input" data-field="${c.id}" aria-label="${esc(c.label)} percent" inputmode="decimal" value="${esc(comp?.[c.id]??'')}" placeholder="0"></div>`).join('')}</div>
 <p class="he-field-hint">Split weights must total 100%. Leave all blank to use the single asset class.</p>
 </div></details>`;
}
