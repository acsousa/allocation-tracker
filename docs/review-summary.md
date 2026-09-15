# Quartermaster review — September 15, 2026

## Outcome

Pulled GitHub `main` at commit `3b3fce0385b765563655a30448ddf941831f43bc` into this workspace. Three specialist agents reviewed financial calculations, UX/UI, and web architecture. Their changes and integration fixes are applied locally. The intended audience is US individual investors; a future paid product would offer saved portfolios and/or subscriptions.

The application remains a single offline HTML file with no runtime dependencies. The existing visual direction is retained, with responsive and accessibility improvements. No hosted storage or billing service has been added.

## Principal findings and fixes

| Area | Material changes |
| --- | --- |
| Financial engine | Corrected withdrawal cash conservation and tax gross-up, prior-year RMD balance handling, capital-gain deduction treatment, Social Security taxable-benefit calculation, and projection return conventions. Added regressions for uncovered cases. See the financial report for precise scope and assumptions. |
| Interpretation | Replaced misleading “most likely”/“full range” descriptions with median/percentile terminology; removed the claim that P10 guarantees a minimum outcome. Distinguished the constant-return projection from the simulated median. Fixed future-dollar chart units while adjusting spending. |
| Data integrity | Validated core imported portfolio shapes, references, dates and balances; preserved edits during asynchronous saves; made migrations non-mutating; fixed CSV formula injection and file-picker error/cancellation behavior. |
| UX and trust | Added document semantics, keyboard navigation, form associations, accessible modal focus behavior, mobile layouts, and stronger contrast. Removed fictitious security headers and network monitoring, and qualified illustrative marketing figures. |
| Product architecture | Documented a staged route from local-file persistence to optional authenticated portfolio storage and subscriptions, with server-side ownership and entitlement checks. |

## Evidence

- Baseline financial suite: **132 passed** before changes.
- Final financial suite: **153 passed, 0 failed**.
- Persistence suite: **11 regression groups passed**.
- Projection-display suite: **7 checks passed**.
- Integrated demo browser smoke: Overview, Plan, Report, retirement and college planning render. Updated retirement projection produced no browser console errors.
- Designer's Chrome checks at **390px and 1440px**: no whole-page horizontal overflow; keyboard activation and modal focus containment/restoration passed.
- Syntax and whitespace checks included in final verification.
- Validation used synthetic/demo data, not personal portfolio files.

Run the automated suites with:

```bash
node test/tax-engine.test.js
node test/persistence.test.js
node test/projection-display.test.js
```

## Remaining priorities

1. **Financial model boundaries:** this remains a simplified planning model, not a complete tax return or independently certified financial calculation product. Read the financial review's remaining assumptions before relying on early-retirement or account-specific tax outputs.
2. **Responsive calculations:** the Monte Carlo engine still runs synchronously. A representative local Node probe took about 1.8 seconds for 5,000 paths across 51 years; mobile performance needs profiling. Move calculation work to a cancellable Web Worker.
3. **Complete contracts and browser coverage:** expand the partial import validator into a full versioned schema; add more historical-file fixtures, fuzz tests, Safari/Firefox file-save coverage, screen-reader testing, and print/PDF checks.
4. **Paid-product foundations:** separate source modules while building the same single-file artifact; introduce a storage interface and revision control; then add authenticated cloud persistence, cross-user isolation tests, and server-authoritative billing entitlements.

## Detailed reports

- [Financial review](financial-review.md)
- [UX/UI review](ux-review.md)
- [Architecture and paid-product roadmap](architecture-review.md)
- [Updated desktop screenshot](review-desktop.png)
