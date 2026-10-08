# Vanguard and Fidelity directory audit — October 7, 2026

## Scope and result

U.S. public-ticker ETFs/ETPs and mutual-fund share classes, including publicly listed advisor and institutional shares. This is completeness against the retrieved issuer directories, not a claim about unlisted, foreign or future products. Workplace directories also include legacy/restricted classes; listing does not imply availability to new investors.

| Issuer | Recognized public tickers | ETFs/ETPs | Mutual-fund classes | Accepted fees |
|---|---:|---:|---:|---:|
| Vanguard | 418 | 116 | 302 | 385 (92.1%) |
| Fidelity | 1,350 | 85 | 1,265 | 1,320 (97.8%) |
| Combined | 1,768 | 201 | 1,567 | 1,705 (96.4%) |

Added 1,402 symbols: the catalog grew from 2,222 to 3,624 instruments. Across **all issuers**, the fund denominator is now 2,104, with 1,995 accepted expenses (94.82%) and 2,074 sourced names (98.57%). Unknown and excluded fees remain in the denominator. No missing fee becomes zero.

## Completeness checks

- Vanguard's [investor directory](https://investor.vanguard.com/investment-products/list/all?filters=open) supplied 383 products with fees. Its [workplace directory](https://workplace.vanguard.com/fund-list/) supplied 415 public tickers, adding 35 distinct classes. All 418 union tickers are included. Another 139 non-ticker plan/trust identifiers are explicitly excluded and recorded.
- Fidelity's [institutional ETF directory](https://institutional.fidelity.com/advisors/investment-solutions/performance/fidelity-etfs) supplied 85 ETF/ETP records. Institutional mutual-fund, advisor share-class and money-market directories plus the [retail overview](https://www.fidelity.com/mutual-funds/fidelity-funds/overview) supplied the mutual classes. All 254 retail overview tickers are included in the union.
- The requested Morningstar page rejected automated access. Fidelity's own sources were used instead.
- Ticker/CUSIP conflicts and conflicting duplicate fee observations abort collection. Row counts are checked against the source markup. Raw-response hashes, source URLs, retrieval dates and fee cells are retained in `research/issuer-directory-expansion.json`.

## Accuracy and financial conventions

23 independent fee samples matched exact-CUSIP summaries, Vanguard product pages or Fidelity's published ETF lineup. Evidence is in `research/issuer-directory-sample-checks.json`. Four additional advisor-class retail API lookups were unavailable; these are not counted as successful sample checks. All 647 previously accepted expense ratios retained the same numeric value.

FAAA and FCLO genuinely report zero net expenses under temporary waivers through January 31, 2027. Gross references and prospectus sources are preserved in `research/issuer-directory-waivers.json`; runtime expiry checks stop using the waived fee after that date.

Use net total expenses when available, then issuer total, then eligible gross total. These figures exclude sales loads, advisor charges and account fees. Share classes are separate instruments; no fee is borrowed from another share class.

Existing allocation mappings and tax assumptions are preserved. New mixed, global, sector and unclear funds require a user allocation choice rather than an invented split. No new performance, distribution-yield or tax-character dataset was added: SEC yield and historical returns are not substitutes for taxable distribution assumptions.

## Offline behavior and maintenance

Collection and normalization happen during development. The build embeds the catalog in both hosted and downloadable apps; no issuer request or separate JSON request is required at runtime. Research evidence is not embedded. Updates are deliberate snapshots, not live feeds.

Refresh with `collect-issuer-directories.py`, then `verify-issuer-directory-gaps.py`, then `import-issuer-directories.js`, regenerate `fund-fees.json`, and run the full checks/build. Re-run independent samples and review waiver dates with each refresh. The collector takes a folder of downloaded public source files and their actual retrieval date.

## Remaining unknown fees

These identities are recognized, but no accepted exact-share-class fee was established. They remain visibly unknown.

**Vanguard (33):** VBIIX, VBINX, VBISX, VBMFX, VDVIX, VEDIX, VEDTX, VEIEX, VEXMX, VFFSX, VFINX, VGSIX, VGTSX, VIGRX, VIMSX, VISGX, VISVX, VIVAX, VLACX, VMGIX, VMVIX, VPACX, VRTPX, VSTSX, VTBIX, VTBNX, VTBSX, VTIBX, VTIIX, VTILX, VTIPX, VTISX, VTSMX.

**Fidelity (30):** FCEXX, FCGXX, FCIXX, FCOXX, FCSXX, FCVXX, FCYIX, FDCXX, FDEXX, FDUXX, FERXX, FETXX, FEXXX, FGEXX, FMYXX, FOIXX, FOPXX, FOXXX, FSRXX, FSXXX, FTUXX, FTVXX, FTYXX, FULVX, FYHXX, FYMXX, FYOXX, FZAXX, FZBXX, FZGXX.

