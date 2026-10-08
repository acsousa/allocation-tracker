# v14 Quartermaster

## Highlights

- Adds a Drag analyzer with combined annual fund costs and distribution-tax estimates, separate drill-down tables, and explicit fee coverage. Repeated holdings are combined for fund costs.
- Adds a compact holding editor from Check-in, Holdings, and Costs. Edit position inputs in an active Check-in and shared fund expense ratio, yield, and allocation assumptions. Recorded positions remain read-only.
- Expands the offline catalog to 3,624 instruments, including 418 Vanguard and 1,350 Fidelity public tickers/share classes from the audited directories. Accepted expense observations cover 1,995 of 2,104 funds (94.82%). Unknown fees remain unknown.
- Redesigns the Report page and Letter-size PDF with allocation detail nested under rollups, Check-in comparisons, deploy/move/withdraw totals, full costs and taxes, and retirement/college projections using shared chart colors.
- Prepares applicable simulations before printing, defaults screen cost/tax tables to the largest three entries, preserves all rows in print, and suggests `asset review [Check-in date]` for report filenames.
- Standardizes Check-in labels and readable dates, fixes asset-category label inconsistencies, and moves History controls inside their chart panel.
- Fixes historical holding edits carrying assumptions onto a replacement fund and prevents invalid edits from opening a Check-in draft.
- Removes the temporary Retirement simulation block from Plan; simulation controls remain in Outlook.

## Compatibility and limits

Portfolio format v8 preserves shared assumptions and historical holding identity. Existing files migrate on open; v13 cannot reopen files saved in v8 format. Keep the original file if rollback is needed.

Fund fees are dated offline observations, not a live data feed. The dataset does not supply verified tax characterization for every fund. Tax figures remain estimates using current assumptions. Simulations do not separately subtract expense ratios from their existing asset-class return assumptions.

## Release preparation

This release is prepared as a draft. Merge the v14 pull request, then create the `v14` tag on the reviewed main-branch merge commit and publish the draft release titled **v14 Quartermaster**. Do not publish a tag on pre-merge main. Confirm the Cloudflare deployment succeeds and smoke-test the app, file open/save, Costs, and Report on production.
