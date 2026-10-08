# Fund tax source and coverage audit

Reviewed: 2026-10-05. Research only; no new tax defaults enabled by this audit.

**Historical scope:** The counts and issuer mix below describe the fixed 448-symbol universe used on October 5. The October 7 expansion increased the current fund universe to 2,104. A new field must now have at least **1,894 usable records** to exceed 90% coverage, with source and sample validation. No new verified tax fields have been enabled. See `data/issuer-directory-audit.md` for the documented denominator expansion.

## Decision

Do not promote newly collected tax fields to runtime yet. No newly sourced field has demonstrated the required **greater than 90% coverage** across the fixed 448-symbol audit universe. That requires **404 usable records per field**. Existing illustrative assumptions must remain labeled as assumptions; a populated fallback is not verified source coverage.

The expense-ratio collection does not contain qualified-dividend percentages, government-income percentages, distribution character, or comparable income yields. Fee collection coverage cannot establish tax-data coverage.

## Existing data

Counted directly from `data/instruments.json` (`taxAssumptions`) against `data/instrument-audit.json` (`fundUniverse`):

| Existing field | Explicit records in universe | Coverage |
|---|---:|---:|
| Income yield assumption | 35 | 7.81% |
| Qualified dividend percentage assumption | 35 | 7.81% |
| Capital-gain distribution assumption | 35 | 7.81% |
| Government-income percentage assumption | 7 | 1.56% |

There are 36 symbol profiles in total; DJP is outside the fixed 448-symbol universe. The profiles have no per-field source, source tax year, or observation date. Thus **35 is assumption availability, not verified tax coverage**. Other holdings receive asset-class defaults.

The unchanged 448 denominator includes legacy names and non-fund identity dispositions identified in earlier research. Keeping it fixed prevents apparent coverage gains from quietly dropping difficult records. A future denominator revision should be separately documented; non-applicability must be evidenced, not treated as a numeric zero.

## Issuer mix and collection effort

Source-host grouping of the existing fee observations provides this collection-planning proxy, not an independently verified issuer census:

| Source family | Symbols |
|---|---:|
| iShares | 125 |
| Vanguard | 92 |
| State Street | 32 |
| Fidelity, combined retail/institutional hosts | 29 |
| Invesco | 27 |
| Schwab | 22 |
| First Trust | 9 |
| Global X | 9 |
| VanEck | 8 |
| WisdomTree | 8 |
| Other source hosts, including SEC filings | 72 |
| Identity dispositions without fee observations | 15 |
| **Total** | **448** |

Even hypothetical complete tax-field coverage of the first six source families would cover only 327/448 (72.99%). Different legal structures, renamed symbols, and share classes reduce the usefulness of a simple issuer-level assumption. Free sources can support a broader collection project, but the expense download cannot supply these fields automatically.

## Concrete source extraction and correctness samples

Downloaded the official iShares 2025 QDI and government-income PDFs, extracted ticker/percentage rows with `pypdf`, and intersected exact symbols with the audit universe. No extracted data was written into runtime catalogs.

| Source field | Extracted matching symbols | Universe coverage | Shortfall to 404 |
|---|---:|---:|---:|
| 2025 iShares QDI | 119 | 26.56% | 285 |
| 2025 iShares government-source income | 115 | 25.67% | 289 |

These are exact-symbol extraction matches, not completed production validation. Missing rows are unknown, not zero. QDI and government income are distinct fields, so their counts must not be added together.

Sample checks against the official source text:

| Symbol / field | Existing assumption | Official 2025 figure |
|---|---:|---:|
| IVV / QDI | 100% | 95.12% |
| ITOT / QDI | 95% | 92.95% |
| IXUS / QDI | 72% | 61.28% |
| AGG / QDI | 0% | 0.00% |
| AGG / government income | 28% | 40.58% |
| GOVT / government income | 100% | 99.90% |

The [iShares QDI summary](https://www.ishares.com/us/literature/tax-information/2025-ishares-qdi-summary-stamped.pdf) reports calendar-year dividend characterization, subject to holding requirements; it is not a prediction of future distributions. The [government-income table](https://www.ishares.com/us/literature/tax-information/2025-ishares-us-government-source-income-information-stamped.pdf) also identifies funds meeting a quarterly federal-obligation threshold. The samples show that existing assumptions are not equivalent to observed 2025 tax facts; they do not by themselves validate replacement data for the full universe.

## Other trusted free sources

- [iShares 2025 tax kit](https://www.ishares.com/us/library/2025-tax-kit): distribution summary, QDI, government-source income, and state tax-exempt information. These are separate documents with separate denominators.
- [Vanguard year-end QDI](https://investor.vanguard.com/investor-resources-education/taxes/qdi-yearend-qualified-dividend-income): share-class-specific dividend and short-term-gain characterization. [Vanguard government-income information](https://investor.vanguard.com/content/dam/retail/publicsite/en/documents/taxes/usgo-2025.pdf) supplies another historical tax field. Source availability located; full-universe extraction and validation not completed.
- [Fidelity fund tax information](https://www.fidelity.com/tax-information/fidelity-mutual-fund-tax-information): government income, foreign-tax information, municipal income and AMT documents. Fidelity cautions that planning information does not replace the investor's tax statements. Advisor-fund tables must not silently substitute for another share class.

## Model and denominator gaps before integration

1. **Tax year versus forecast:** store `taxYear`, source, and review date per field. A 2025 characterization can inform a labeled planning assumption, not claim to be measured 2026 tax treatment.
2. **Government-income denominator:** the model applies `usGovtPct` within the nonqualified-income slice. Source percentages may instead describe total ordinary dividends. Preserve the source denominator and convert explicitly; do not copy values mechanically. State qualification rules also need to be modeled before presenting state exemption as exact.
3. **Yield:** QDI and government percentages describe composition, not annual income divided by market value. SEC yield, distribution yield, and trailing dividend yield are not interchangeable. Align income period and value denominator before populating `divYield`.
4. **Distribution character:** ordinary dividends, short-term gains, long-term gains, tax-exempt income, return of capital, and qualified REIT dividends require separate treatment. The existing single `capGainDistPct` and boolean REIT flag cannot express every actual source breakdown.
5. **Foreign tax credits:** source foreign taxes paid are not automatically the recoverable credit for every investor. The current flat recovery assumption is not replaced merely by finding a foreign-income percentage.
6. **Wrong tables:** nonresident qualified-interest-income (QII) and corporate dividends-received deductions are not individual QDI. Missing rows and inapplicable instruments require explicit statuses.

## Release gate

Keep the existing tax estimates labeled illustrative and permit user overrides. Before enabling any new bundled tax field, require exact identity/share-class matching, source-year metadata, denominator reconciliation, sample checks across issuer and asset-type groups, and greater than 90% coverage of the current recognized-fund universe (at least 1,894 of 2,104 as of October 7). The original audit threshold was 404 of 448. No broad, complete, verified new tax field was readily available in this audit; further multi-issuer collection is required.
