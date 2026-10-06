# Offline instrument catalog audit

## October 5 follow-up

**Identity enrichment is enabled; expenses and automatic allocation splits are not complete.**

- 418/448 sourced names (93.3%) now pass the field gate. Names appear during holding
  entry and fill an empty name on newly added/imported holdings. Existing names
  and saved holdings are untouched. Sources: Nasdaq listing directory, iShares
  product table, Vanguard product-list structured data, Fidelity fund list, and
  the OCC SPLG/SPYM notice.
- 30 ticker/name pairs were checked across equity, bond, international, money-market,
  ETF and mutual-fund examples. The sample and missing symbols are in the JSON audit.
  This verifies names, not all legacy classifications.
- FZILX now requires classification review because its issuer explicitly includes
  both developed and emerging markets. This brings the review list to 11 funds.
- 125 iShares gross/net fee candidates were acquired (27.9% of the full universe),
  with source URLs and retrieval date. They remain **research-only**, outside both
  builds. Three individual issuer pages (IVV, ACWI, IXUS) were compared to the table;
  this is not the 30-record, cross-issuer sample needed for release. Fee-effective
  dates are absent from the table. Net and gross fees are stored separately.
- SEC identifier download and Schwab downloads returned access-denied pages.
  Vanguard supplied identities but no fee table in the downloaded product list.
  State Street rendered a client-side template, not a usable bulk table.
- ACWI and IXUS issuer geography/sector tables were inspected. They do not directly
  supply all 14 Quartermaster asset-class weights (including US size classes).
  No automatic split passed validation; existing user splits and illustrative
  US-total assumptions remain. No percentage was inferred from a fund name.
- `npm run audit:funds` reports counts and missing symbols; the build enforces
  >90% for enabled names and rejects unapproved expense/split fields. All 448
  candidate records remain in the denominator. At least 404 usable entries per
  field are needed.

The following October 2 section records the earlier extraction baseline; its
performance numbers predate the addition of fund names.


Reviewed October 2, 2026. Baseline: commit
`5e09b4064fb90922d26330997d1b6d77c7ab5da4` (v12).

## Shipped result

- One editable source, `data/instruments.json`, replacing two overlapping maps.
- All 1,966 original ticker strings retained; SPYM and SPTM added (1,968 total).
- VMBS corrected from US mid-cap equities to US bonds.
- Ten mixed-exposure funds require a user choice rather than a false single-class
  classification: FZIPX, VT, VTWAX, ACWI, VXUS, IXUS, BNDW, BLOK, BKCH, DAPP.
- Existing portfolio classifications, custom compositions, balances, and overrides
  are not migrated to new catalog defaults. Users can explicitly edit them.
- Existing tax-profile values retained; SPYM receives SPLG's existing illustrative
  assumptions. Bundled profiles now carry an estimate indicator in the tax table.
- Both hosted and downloadable HTML embed the same validated, compact catalog.
  There is no runtime JSON request, market API, credential, or remote ticker lookup.

Null classification means known but requiring review, not a missing value to fill
with a guessed exposure. The holding dialog explains the issue. Users can choose
a class, then click the holding's class label to enter a look-through split. CSV
imports assign unresolved entries to Other and display a review reminder. The
user's explicit ticker mapping always takes priority.

## Coverage and completeness

The old source's claim about covering “~90% of retail holdings” was not measured;
it has been removed. Catalog size is not market coverage or proof of accuracy.

The [Nasdaq traded-symbol directory](https://www.nasdaqtrader.com/dynamic/SymDir/nasdaqtraded.txt)
snapshot dated October 2 matched 1,858 of 1,966 original symbol strings, including
354 with ETF=Y. Excluding obvious cash/crypto placeholders and spelling aliases
leaves 92 unmatched candidates. Keep these in the denominator until individually
resolved, even though some may be discontinued securities or equities. The list
includes 79 five-letter mutual-fund candidates, including money-market funds;
a ticker suffix alone is not proof of fund identity.

The conservative field-coverage denominator is therefore **448 symbol records**:
354 listed ETF/ETP flags + 92 unresolved candidates + SPYM + SPTM. This deliberately
counts old SPLG and current SPYM separately, because both remain recognized input
strings. The machine-readable audit stores every included/excluded symbol and the
listing snapshot's SHA-256. This is a conservative candidate universe, not a
claim that all 448 are verified, currently active ETFs or mutual funds.

| Candidate addition | Result | Decision |
| --- | --- | --- |
| Fund names | Listing supplies identities for 354 original ETF/ETP symbols; mutual-fund and old-symbol reconciliation incomplete | Omit the name feature |
| Expense ratios | No complete, dated, share-class-specific dataset acquired and validated | Omit |
| Historical returns | No complete, consistently dated, dividend-reinvested and split-adjusted dataset acquired and validated | Omit |
| Exact look-through weights | No complete set of dated weights acquired and validated | Omit; retain user-entered splits |

No new financial field is enabled. This does **not** establish that commercial
providers lack coverage; it means coverage and correctness have not been proven
for an acquired offline snapshot. Missing values are not zero.

The 36 bundled tax profiles are pre-existing modeling assumptions (35 original,
plus SPYM sharing SPLG's assumptions), not new verified financial information.
Their partial coverage is not presented as satisfying the new >90% requirement.
The 82/13/5 US total-market split also remains an illustrative default, not current
measured weights for every fund. Wash-sale groups are review heuristics, not a
legal determination of which securities are substantially identical.

## Source checks and corrections

These are **targeted checks of 13 symbols**, selected for suspicious mappings,
mixed exposures, and missing symbols. They are not a statistically representative
accuracy certification for the entire legacy catalog. Sources and before/after
values are also recorded in `data/instrument-audit.json`.

| Symbols | Checked finding and action | Primary source |
| --- | --- | --- |
| VMBS | Mortgage-backed US bonds; correct class | [Vanguard](https://advisors.vanguard.com/investments/products/vmbs/vanguard-mortgage-backed-securities-etf) |
| FZIPX | Mid/small US equities, not emerging markets; require split review | [Fidelity](https://www.fidelity.com/mutual-funds/investing-ideas/index-funds) |
| VT, VTWAX | Global equities include the US; require split review | [VT](https://advisors.vanguard.com/investments/products/vt/vanguard-total-world-stock-etf), [VTWAX](https://advisors.vanguard.com/investments/products/vtwax/vanguard-total-world-stock-index-fund-admiral-shares) |
| ACWI | Global developed/emerging equities; require split review | [BlackRock](https://www.blackrock.com/us/individual/products/239600/ACWI) |
| VXUS, IXUS | Developed and emerging international equities; require split review | [Vanguard](https://advisors.vanguard.com/investments/products/vxus/vanguard-total-international-stock-etf), [iShares](https://www.ishares.com/us/products/244048/ishares-core-msci-total-international-stock-etf) |
| BNDW | US and non-US bonds; require split review | [Vanguard](https://advisors.vanguard.com/investments/products/bndw/vanguard-total-world-bond-etf) |
| BLOK, BKCH, DAPP | Company equities, not direct cryptocurrency; require split review | [Amplify](https://amplifyetfs.com/blok/), [Global X](https://www.globalxetfs.com/funds/bkch/), [VanEck](https://www.vaneck.com/us/en/investments/digital-transformation-etf-dapp) |
| SPYM | SPLG's new symbol effective October 31, 2025; add while retaining SPLG | [OCC notice](https://infomemo.theocc.com/infomemos?number=57498) |
| SPTM | Broad US large/mid/small stocks; add missing classification, using the existing illustrative US total-market split | [State Street](https://www.ssga.com/us/en/individual/etfs/state-street-spdr-portfolio-sp-1500-composite-stock-market-etf-sptm) |

Remaining legacy entries are best-effort classifications. Stock-size memberships,
discontinued symbols, ambiguous labels such as CASH, and other mixed funds still
need issuer-level review. Do not advertise the whole catalog as verified. The
Nasdaq listing check verifies symbol presence and ETF flag, not asset exposure.

## Fee gap reconciliation — October 5, 2026

The revised review export replaces ambiguous blank fee cells with `Not collected`.
This never means zero. The only zero-expense observations in the combined research
set are FZIPX, FZROX and FZILX, backed by their issuer records.

The audit now combines the original candidates, Fidelity observations and
`data/research/issuer-gap-fee-observations.json`. The latter adds 88 symbols.
Across the unchanged 448-row review universe:

- 426 rows have a gross, net or published total-expense observation (95.1%).
- 7 more have separately labeled sponsor fees, for 433 fee observations (96.7%).
- 6 rows are individual company equities, not funds: AVB, EQR, HLX, LEG, STEL, WBS.
- 6 are renamed tickers: GXG, JKD, NUSI, PUTW, SPLG, VMOT.
- 2 are merged funds: VPGDX, VTXVX. ROOF was liquidated.

All 448 rows are accounted for, but this is **not 100% verified-current expense
ratio coverage**. Identity dispositions are stored with primary sources in
`data/research/fund-identity-resolutions.json`; no successor fee is silently
substituted and no saved holding is migrated. Current successor fees still need
their own dated checks before an alias-aware fee feature is released.

The additional research distinguishes sponsor fees, management components and
adjusted expenses from gross/net totals. SEC prospectuses resolve the BITX
management-versus-total discrepancy and ETHW website conflict. WEAT's advertised
net figure matches a break-even calculation after interest income, so only its
issuer-published gross ratio is retained. WTMF, PONAX and dated USCF observations
retain explicit review flags. Source document dates are not fee-effective dates.

The export includes each source and caveat. Existing iShares checks provide 119
product-page matches; the cross-issuer verification and freshness gate remains
incomplete. Fees remain research-only and are not shipped into app calculations.

## Other sources considered

- [SEC series/class information](https://www.sec.gov/data-research/sec-markets-data/investment-company-series-class-information): useful for identities and share-class reconciliation. CSV download returned HTTP 403 during this audit; no unverified replacement imported.
- [SEC risk/return data](https://www.sec.gov/data-research/sec-markets-data/mutual-fund-prospectus-riskreturn-summary-data-sets): promising offline foundation, but requires dated filing, share-class, fee-waiver, and reporting-period normalization before coverage can be asserted.
- [Fidelity fund list](https://www.fidelity.com/mutual-funds/fidelity-funds/overview), [Schwab product list](https://www.schwabassetmanagement.com/product-finder?producttype=mf), and issuer prospectuses: useful spot-check sources, not a completed cross-provider dataset.
- [Nasdaq Fund Network](https://nasdaqtrader.com/Trader.aspx?id=symbollookup): fund data has licensing restrictions. No NFN dataset was bundled.
- Commercial APIs remain possible future sources, subject to actual coverage tests and permission to redistribute an offline snapshot. No account, paid API, or live dependency added.

## Rules before enabling another field

1. Reconcile the full recognized fund universe, including legacy symbols and exact
   share classes. Do not shrink the denominator to a conveniently covered issuer.
2. Require **more than 90%** usable, sourced values per field: for 448 records,
   at least **404**. Exactly 90% fails. Zero counts only when the source says zero.
3. Store source, as-of date, unit, and meaning. Distinguish net from gross fees;
   annualized from cumulative returns; price from total return; and missing from
   insufficient operating history. Apply the same definition and dates consistently.
4. Spot-check at least 30 records across issuers and fund types against primary
   sources, plus every outlier and renamed/share-class edge case. Resolve sample
   discrepancies before release; document exclusions and coverage separately.
5. Extend schema validation and regression tests before allowing the field. The
   current build rejects unapproved record fields, including expense ratios.
6. Keep audit/source metadata in the repository, not in runtime payloads unless
   needed by the UI. Test hosted and offline outputs; never add live lookups as
   an implicit fallback.

## Performance and verification

One local Node 26 run: 30 measured iterations after warmup, identical VM harness,
100,000 ticker lookups per iteration. This is an engine microbenchmark, not a
browser paint, network, or mobile performance guarantee.

| Measurement | Before | After |
| --- | ---: | ---: |
| Compiled app HTML, bytes | 616,604 | 612,122 |
| Gzip, bytes | 165,546 | 163,960 |
| Median warm script initialization | 0.502 ms | 0.501 ms |
| Median 100,000 lookups | 42.42 ms | 32.80 ms |

Extraction adds no runtime network request. Removing duplicate maps reduces the
compiled HTML size; one direct map lookup replaces two map probes. Timing varies
by device and run, but this run found no regression.

Regression tests check the complete legacy mapping against a baseline digest,
allow only the documented changes, preserve saved holdings/compositions/snapshots,
verify user overrides and tax-estimate labels, reject malformed catalog data,
escape embedded script text, and execute both compiled outputs. Existing
financial-model, persistence, onboarding, analytics, and site-build tests also run
under `npm run check`.
