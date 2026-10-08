# v14 validation — October 7, 2026

## Automated checks

`npm run check` passed after all review fixes. This runs 14 test files and builds the public site and self-contained offline app. Coverage includes fee/source normalization, issuer directories, holding editor, instruments, analytics privacy, tax engine, persistence/migrations, projection presentation, reports, static builds, onboarding, savings/growth, and landing/demo consistency.

The final holding-editor suite includes 29 regression groups; the tax engine includes 194 cases. `npm run audit:funds` and `git diff --check` also passed.

## Independent reviews

- UI/UX: six main views at 320, 390, 768, 1024, and 1440px; no page-level horizontal overflow or JavaScript page errors. Verified modal background lock, internal scrolling, Escape, top-three toggles, print rows, and report filename. Confirmed the Plan simulation block is absent.
- Financial modeling: reconciled fee coverage and basis counts, cost and tax totals/denominators, shared assumptions, historical positions, sheltered treatment, report values, and simulation scope. No calculation blocker found.
- Engineering: reviewed file compatibility, identity transitions, mutation validation, offline/static build and print lifecycle. Fixed two confirmed editor defects before the final suite.

## Bugs fixed during review

1. Starting a Check-in from an older holding could copy the old fund's assumptions onto its current replacement. Transfers now require matching instrument identity; obsolete allocation edits are rejected.
2. Invalid fee/yield inputs could create a draft before failing validation. Inputs now validate before draft creation/view changes.

Regression tests cover both failures. Historical tax-data audit counts are explicitly historical; current coverage gates use the expanded universe.

## Browser and print checks

- Full 10,000-path retirement and college preparation before print; concurrent print clicks yield one print; simulation errors block printing.
- Shared page-intro styles across 16 views and embedded offline fonts.
- Letter-size normal/light and dark reports: 7 pages. Long-label/many-account stress report: 12 pages. Automated horizontal bounds checks passed; retirement page visually inspected.
- Report print title uses the selected Check-in date and restores the app title afterward.

Checks used demo/synthetic portfolios. Browser checks ran in local Chrome; native Save PDF dialogs on every browser/OS were not exhaustively tested. Production deployment smoke testing remains a post-merge step. Offline fund data is dated observation data, not live validation of every issuer value.
