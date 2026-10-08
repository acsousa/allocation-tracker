# Offline fund-fee normalization — October 7, 2026

## Result

1,995 of the expanded **2,104-symbol fund universe** have an accepted total-expense observation: **94.82%**. Accepted records comprise 1,530 issuer net totals, 406 issuer-published total expense ratios, and 59 gross totals where no waiver is recorded. Before the latest directory expansion this was 647/702 (92.17%). This is an offline observation dataset, not a guarantee that every published fee remains current.

The October 7 expansion recognizes 1,768 Vanguard/Fidelity public tickers and adds 1,402 symbols. See [directory completeness and sample audit](issuer-directory-audit.md). The following describes the earlier October 5 expansion.

The catalog expanded from 1,968 to 2,222 recognized symbols (+254). All 254 unique Fidelity issuer-directory ticker/CUSIP pairs are represented in the expanded universe, including nine API failures retained as unknown, rather than dropping missing fees from the denominator. 245 Fidelity API responses pass exact issuer, ticker and CUSIP checks; each uses prospectus `netExpenseRatio` / `grossExpenseRatio` fields, not historical annual expenses or yields. Six Vanguard mutual share classes and the BLV ETF were verified against their exact fund-ID fact sheets. Additional portfolio-priority issuer observations are in `portfolio-fee-observations.json`.

New mixed-geography, sector or unclear investment classifications remain null and require a user class/split choice. Knowing the issuer fee does not establish a precise allocation split. EAD, GOF and VCX retain issuer identity but no usable annual fee estimate because their closed-end fund disclosures use NAV/average-net-asset denominators. Their ratios cannot safely be multiplied by a holding’s exchange market value.

`fund-fees.json` contains one number per exact symbol plus internal provenance; `scripts/fund-fees.js` regenerates it from the research files. It does not substitute successor symbols, other share classes, direct cryptocurrency, sponsor-only charges, adjusted expenses that exclude investment costs, or income-offset break-even figures. A 529 account's investment-option fees must not be inferred solely from an underlying fund ticker.

## Acceptance rules

1. Use net total operating expenses when available; otherwise use an issuer total expense ratio; otherwise gross total expenses only without a recorded waiver.
2. Reject records marked needs-review, failed issuer-product verification, unresolved or retired identities, impossible net/gross relationships, missing sources, and future dates.
3. Carry issuer waiver expiry dates, including dates in the separately stored iShares product verification. Exclude already expired waivers even when the observed net equals gross: reconfirm the issuer rather than guessing continuation.
4. Reject dated source documents more than 366 days old pending a refresh. A recent download does not make an old document current.
5. Preserve a genuine zero. Missing is unknown, never zero.
6. Missing effective dates remain null. `reviewedOn` records the issuer-observation retrieval date; `asOf` is used only where provided as a fee date. Document dates and months remain separate. Current issuer net figures without a disclosed expiry remain observations as of retrieval, not guarantees of an indefinite waiver.
7. Runtime use must reject a stored waiver once its end date passes. The build is intentionally reproducible against the documented review date, not silently refreshed by the user's clock.

The JSON `excluded` map lists every excluded symbol and reason. Gross fallback is a labeled estimate before any unrecorded waiver, not a relabeling as net. A single displayed ratio can simplify the UI, but the provenance must retain this distinction.

## Sample checks

Primary-source samples checked October 5, 2026, covering all three selected bases and a real zero:

- VTI: issuer expense ratio **0.03%** matches the exact ETF entry. [Vanguard](https://advisors.vanguard.com/investments/products/vti/vanguard-total-stock-market-etf)
- FZROX: **0%**, exact Fidelity ZERO Total Market Index Fund, matches the saved prospectus net field and issuer zero-fee statement. [Fidelity](https://www.fidelity.com/mutual-funds/investing-ideas/index-funds)
- SPY: gross expense ratio **0.0945%**, matches the exact ETF and CUSIP 78462F103. [State Street](https://www.ssga.com/us/en/intermediary/etfs/state-street-spdr-sp-500-etf-trust-spy)

This sample confirms the normalization conventions; it is not a new independent live verification of every normalized observation. The underlying research files retain source URLs, issuer-table identity checks, and document hashes where collected. Additional problematic records remain unknown rather than being filled for coverage.

## Expansion sample review

- VSCPX Institutional Plus: **0.02%**, exact ticker and fee date April 28, 2026 in fund sheet F1861; matches the [issuer product page](https://advisors.vanguard.com/investments/products/vscpx/vanguard-small-cap-index-fund-institutional-plus-shares).
- NAESX Investor: **0.17%**, not the VSCPX Institutional Plus fee; exact ticker and April 28, 2026 fee date in F0048.
- VQNPX Investor **0.40%** (June 29, 2026), VVIAX Admiral **0.05%**, VSIAX Admiral **0.07%**, VTMGX Admiral **0.05%** (April 28, 2026). BLV ETF **0.03%** in its June 30, 2026 document; fee-effective date unspecified.
- FCNTX: **0.74%** issuer prospectus gross/net, dated February 28, 2026; API CUSIP 316071109 agrees with the [issuer full profile](https://fundresearch.fidelity.com/mutual-funds/view-all/316071109).
- FDKVX Freedom 2060: API CUSIP 315793729, **0.68%** gross/net dated May 30, 2026; distinguished from Fidelity Freedom Index 2060 FDKLX. This is an exact issuer API check, not an independent second fee source.

Percentage units were checked: an API amount of 0.74 means 0.74%, not 74% or 0.0074%. Genuine zero expense funds remain zero. Nine unresolved Fidelity API symbols are FULVX, FCYIX, FIRMX, FIRQX, FIRSX, FIRVX, FIXRX, FMRAX, FMRTX. They remain recognized from the issuer directory with no automatic fee.
