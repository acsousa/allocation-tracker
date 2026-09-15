# Financial review — September 15, 2026

## Scope and conclusion

Reviewed the portfolio allocation, tax drag, tax-location recommendations, retirement cash-flow simulation, Social Security, contribution guidance and college projection code. This is an engineering review using financial analytical standards, not a licensed CPA/CFA opinion or certification. The intended audience is primarily US individual investors. This remains a scenario-planning tool, not a tax-return calculator or individualized recommendation engine.

## Fixed defects

| Finding | Correction / evidence |
|---|---|
| RMDs included current-year returns in their calculation base. | Use the prior year-end balance. A $100,000 balance entering age 75 produces $4,065.04 before considering this year's return. |
| Stochastic median differed from deterministic geometric return. | Lognormal growth is now `exp(log(1 + mu) + sigma*z) - 1`; at zero normal shock it exactly matches deterministic growth. |
| Six gross-up iterations could materially underfund spending while reporting success. | Converge the withdrawal/tax calculation to sub-cent precision and calculate shortfall from cash actually available after final taxes. |
| Pension/SS income above expenses disappeared; excess RMD cash was inconsistently reported. | Save all after-tax surplus to taxable assets with matching cost basis; cash and asset totals reconcile. |
| Standard deduction could not offset capital gains when ordinary income was low. | Apply unused deduction to gains before calculating the capital-gains rate stack. |
| Every SS benefit was treated as 85% federally taxable. | Use regular-benefit combined-income formula, with filing-status thresholds, 50% tier and 85% maximum; update model disclosure. |
| Survivor simulation retained joint NIIT threshold. | Use single-filer NIIT threshold in survivor years. |
| A plan paying every bill solely from guaranteed income was marked unsuccessful if ending investments were zero. | Success means no modeled spending shortfall; a positive residual estate is not required. |
| Nominal/real input conversion used simple subtraction and mislabeled nominal returns as “net.” | Use exact geometric conversion `(1+nominal)/(1+inflation)-1`; preserve stored real-rate semantics and correct labels. |
| Contribution guidance separately granted the full IRS limit to every IRA / 401(k). | Aggregate YTD contributions and shared headroom by vehicle. Because account ownership is absent, use one conservative base limit per vehicle and explicitly require owner/eligibility verification. |
| MA 2026 surtax threshold and SSA second bend point were wrong. | Correct to $1,107,750 and $7,749 respectively. |
| Washington note described obsolete single 7% capital-gains rate. | Correct the note to tiered 7% / 9.9% and explicitly identify this as unmodeled tax. |
| An already-enrolled child could never be fully funded because the entry/current-year tuition payment was skipped but all program years were required for success. | Include current-year unpaid tuition, assess remaining college years, and label the assumption. |
| College chart described age-18 post-tuition assets as money arriving at college and guaranteed a peak at age 17. | Explain post-tuition balances and remove the unsupported peak assertion. |
| Report allocation tables omitted completely absent target classes. | Render the union of actual and target classes; zero holdings now show their underweight drift. |

## Verification

`node test/tax-engine.test.js`: **153 passed, 0 failed** at financial-review handoff. Added regressions cover SS threshold tiers, tax-exempt interest in the formula, geometric median consistency, deduction use, cash conservation, high-tax gross-up, final-tax shortfalls, RMD prior-year balance, income-only success, shared IRA limits, MA/SSA constants, current-year college tuition, remaining college years and absent target classes.

The existing tests cover federal bracket examples, capital-gain stacking, state exemption assumptions, deterministic growth, covariance, repeatable Monte Carlo, contribution limits, tax location, import parsing and college projections. Passing tests establish these invariants; they do not validate every possible tax circumstance.

## Authoritative verification

- [IRS RMD guidance](https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-required-minimum-distributions-rmds): previous calendar year-end balance and distribution-period method.
- [IRS Publication 915](https://www.irs.gov/publications/p915): Social Security combined-income calculation and filing-status treatment. The implemented method is the regular-benefit case, excluding special elections and unusual exclusions.
- [IRS capital gains topic](https://www.irs.gov/taxtopics/tc409) and [Publication 17](https://www.irs.gov/publications/p17): taxable-income treatment and standard deduction.
- [IRS 2026 inflation adjustments](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill): federal ordinary brackets and standard deductions checked.
- [IRS IRA contribution limits](https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-ira-contribution-limits): annual limit is shared across traditional and Roth IRAs; eligibility/income conditions also apply.
- [IRS multiple-plan deferral guidance](https://www.irs.gov/retirement-plans/how-much-salary-can-you-defer-if-youre-eligible-for-more-than-one-retirement-plan): individual elective-deferral limits span plans.
- [Massachusetts surtax guidance](https://www.mass.gov/info-details/massachusetts-4-surtax-on-taxable-income): 2026 threshold $1,107,750.
- [SSA bend-point table](https://www.ssa.gov/oact/COLA/bendpoints.html): 2026 PIA bend points $1,286 and $7,749.
- [Washington Department of Revenue](https://dor.wa.gov/forms-publications/publications-subject/special-notices/new-tiered-rates-washingtons-capital-gains-tax): tiered capital-gains rates apply from 2025.

## Material limitations and next priorities

1. **State taxes are approximations, not 50-state calculations.** Bundled state rates are largely labeled 2025 top marginal rates, not household effective rates or comprehensive 2026 rules. Washington gains tax, state-specific exclusions, state SS phaseouts, local tax and state treatment of Treasury fund income are not fully modeled. Treasury fund exemption eligibility can differ from simply multiplying the fund's Treasury percentage.
2. **Roth/HSA access assumptions can overstate usable cash.** The engine treats Roth balances and the HSA bucket as available tax-free without tracking Roth contribution basis, five-year rules, conversion ordering, qualified HSA expenses or nonqualified-distribution tax. Pre-tax early-withdrawal penalty exceptions are not modeled. “Sheltered” means no current annual tax drag, not that all eventual withdrawals are exempt.
3. **Fixed statutory thresholds versus real dollars.** NIIT and SS nominal statutory thresholds are held constant inside a real-dollar simulation. That effectively inflation-indexes them and can understate future taxation. Federal indexed brackets are also held constant in real terms. Legislative changes are not forecast.
4. **Household demographics are simplified.** Both spouses' SS begins at the primary claim age; the model does not fully implement survivor benefit replacement/reduction or spouse-specific RMDs. `rmdStartAge` still uses 73 for every pre-1960 cohort, missing historic 70½/72 commencement rules; inherited accounts and the younger-spouse joint-life exception are not covered. Projections begin at the next annual step, so retirement's current partial year is not modeled.
5. **Roth conversion estimates remain approximate.** Tax funding from taxable assets does not fully solve incremental realized-gain/NIIT costs, and proportional scaling of a conversion when cash is short is not an exact progressive-tax solution. Conversions are an optional deterministic comparison, not the baseline Monte Carlo strategy. Medicare IRMAA and ACA subsidy effects are omitted.
6. **Tax drag is an estimate.** Dividend yields/distribution mixes are bundled assumptions, not live current tax facts. Foreign tax credit is a simplified fraction, QBI eligibility/limitations are not exhaustively modeled, income bands use representative values, and wash-clone groupings indicate possible risk rather than an IRS ruling that two ETFs are substantially identical. Holding period and specific lots are absent. Taxable retirement years omit ongoing dividend/distribution drag distinct from realized gains.
7. **Basis and losses.** Withdrawal calculations use average aggregate basis, not lot identification, and do not model capital-loss carryforwards. Starting unknown basis uses a documented approximation. Loss-position basis depletion needs a fuller lot/basis model before tax precision can be claimed.
8. **Contribution eligibility remains outside scope.** Shared caps prevent multiple-account over-allocation but may underallocate for spouses. Owner identity, compensation, employer match/YTD contributions, direct Roth income eligibility, deductibility, HSA coverage and catch-ups need structured inputs. “Max out” retirement settings are illustrative ceilings, not eligibility determinations.
9. **Economic assumptions are not forecasts.** The return/correlation defaults have not been independently calibrated to current capital-market research. Lognormal log-return volatility, no fat tails, a blended portfolio return and no per-bucket allocation are substantial simplifications. The weighted geometric return does not capture every portfolio rebalancing effect. No guarantee follows from Monte Carlo success percentages.
10. **College timing.** Current-year tuition is assumed unpaid for an already-enrolled child. Earlier years are excluded. Qualified 529 expense restrictions, tax on nonqualified withdrawals, aid interactions and tuition-specific inflation are not implemented.

Before positioning this as a paid financial planning product, prioritize explicit account ownership and tax-lot/basis inputs, a versioned jurisdiction-aware tax engine, independent actuarial/tax validation, and clearer separation between illustrative scenarios and actionable contribution/trade recommendations.
