# Standalone retirement calculator prototype

Development branch: `codex/standalone-retirement-prototype`.

Run `npm run dev`, then visit http://127.0.0.1:8747/retirement-calculator.html.
The public landing page links to the calculator in its header, hero and goals section.
Development uses port 8747 consistently. Serve `dist`, not the source directory.

## Scope

- Six basic inputs (annual contributions and retirement budget); optional lifespan, Social Security and pension inputs.
- 10,000 simulated paths, with the same projection core extracted from `app.html`
  at build time. No separate copy of the financial calculation logic.
- A worker keeps the page responsive. Comparisons use the same random seed.
- Individual, simplified model in today's dollars. Tax calculations, fund fees,
  account access rules and survivor benefits are excluded. The spending budget
  must include an allowance for taxes and expenses. Optional pension and Social
  Security income maintain purchasing power under this model.
- Example, comparisons, keyboard chart exploration, local scenario download.
- Explicit portfolio handoff preserves all calculator inputs in retirement settings.
  Ages, goal mix, budget and income assumptions prefill setup. Savings remain a
  reference total until actual holdings are entered; contributions are retained
  as household savings and must be split into model account types in Outlook.
  Setup flags the tax-inclusive budget for review because the full model adds tax.
  Social Security benefits are converted to the full model’s FRA basis so the
  claiming-age adjustment is not applied twice.
- No automatic financial-input persistence or input values sent to analytics.
  The optional handoff uses a one-time session record with a five-minute expiry;
  the destination removes it before processing. Downloaded scenarios are separate
  from portfolio files.
- Landing-page cost section now explains fund expenses alongside tax drag.

## Validation

`npm run check` runs the full regression suite and production build, including
new engine, handoff, analytics allowlist and generated-page checks.

Browser checks exercised blank-form validation, example and personal scenarios,
comparisons, cancellation, changed-input warnings, local download/import, mobile
layout, and portfolio handoff with no fabricated accounts/holdings. Same-origin
worker behavior was tested with the generated hosted content-security policy.

Independent AI reviews covered financial calculations, senior UI/UX and simulated
first-time use. Finance checks included exact zero-return cash flows, benefit
start timing, depletion boundaries and comparison repeatability. UI checks
covered widths of 320, 390, 768 and 1440 pixels. Review-discovered example startup,
hidden import and stale validation errors were fixed and retested.

These reviews do not constitute review by licensed professionals or an actual
human participant. Human usability testing remains a follow-up.

## Suggested acceptance test

1. Open the landing page and choose **Try retirement calculator**.
2. Try the example, then enter your own numbers and run it.
3. Compare saving more, retiring later and spending less.
4. Download a scenario to retain a reference copy; the standalone import control is removed.
5. Choose **Start building your entire portfolio** and verify portfolio onboarding starts with
   the saved calculator inputs, without manufactured accounts or balances.
6. Repeat on a phone. Check that the simplified assumptions are clear enough.

The calculator is labeled as a preview. Production deployment status is managed by the hosting pipeline after changes reach main.
