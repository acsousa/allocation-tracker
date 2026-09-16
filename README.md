# Quartermaster

**Your real allocation, across all your accounts.** Quartermaster is a local-file
portfolio tracker at [realallocation.com](https://realallocation.com).
It combines allocation charts, quarterly reviews, tax estimates, and retirement
and 529 simulations. It does not connect to your bank or execute trades.

## Two files, two jobs

- **`index.html` is the app.** This is the canonical source and website entry
  point. Its JavaScript, styles, and charts are inline; no framework or runtime
  dependencies are needed. Open it directly in a browser to use it offline.
- **Your portfolio `.json` file is your data.** Open it locally at the beginning
  of a session and save it when you finish. Your holdings and balances are never
  uploaded by this release. Keep a backup somewhere you trust.

The hosted website uses Cloudflare Web Analytics for visits and performance.
Portfolio contents are not sent to analytics. The standalone download has no
analytics. Future cloud saving would be optional and would require choosing to
upload data.

## Getting started

1. Choose **Start here**, then **Build my portfolio**.
2. Follow **Accounts → Goals → Holdings**. Start with one account, choose an
   example or custom allocation target (or decide later), and enter holdings.
   Reset to default clears the setup target; the review band remains ±5 points.
3. Choose **Finish setup · view dashboard** to record your first check-in in the
   current session. This does **not** write a file to disk.
4. Explore your allocation, then choose **Save file** before leaving. An amber
   **⚠ Save needed** button means there is unsaved work.
5. Next time, choose **Returning? Open portfolio file** and select your JSON file.
   This reads the file locally; it is not an upload.

Finish an in-progress check-in with **Record check-in** before saving the file.
Chrome/Edge can support saving back to a selected file; browsers without that
capability download a new copy. Keep the latest copy and check where it was saved.
There is no automatic portfolio backup or server recovery.

**Explore the demo** opens a read-only sample portfolio. Navigation and temporary
simulation adjustments are available; account, holding, target, and check-in
edits and portfolio-file saving are blocked. Choose **Start your portfolio** to
enter setup with empty data. Printed demo reports are labeled as sample data.

## Navigation

- **Dashboard:** your current allocation, target comparison, drift, and account
  drill-down. This is the app's landing view after opening a portfolio or setup.
- **Check-in:** enter balances for a dated snapshot, starting from prior values.
- **Review:** compare the latest two check-ins by account. Changes include market
  moves and cash flows, so they are **balance changes, not investment returns**.
  Holdings, Targets, Tax, and History are available here too.
- **Plan:** explore proposed changes based on your inputs and record decisions.
- **Report:** printable allocation summaries and CSV exports.
- **Outlook:** retirement and college simulations with adjustable assumptions.
- **Settings:** accounts, children, tax profile, retirement inputs, and file tools.

The mobile **Navigate** menu selects the main view. **Help** explains the app and
local-file model. The logo returns to the public landing page.

## Cloudflare Pages deployment

The main deployed page is **`index.html`**. Do not rename files by hand or upload
only that file: pricing, privacy, and compatibility URLs need to be deployed too.

### Git-connected Pages project

| Setting | Value |
| --- | --- |
| Framework preset | None |
| Root directory | Repository root |
| Build command | `node scripts/build-site.js` |
| Build output directory | `dist` |
| Production branch | `main` |

Use the feature branch for a preview deployment before merging. This branch is
`codex/new-user-experience`; local changes are not automatically published.

### Manual / Direct Upload

Run:

```bash
node scripts/build-site.js
```

Upload the **contents of `dist/`** as one deployment. Its root should contain:

```text
dist/
  index.html                  # main entry at /
  allocation-tracker.html     # full compatibility copy for old bookmarks
  pricing.html
  privacy.html
  favicon.svg                 # browser tab icon
  404.html                     # visible error page, with a home link
  _headers
  downloads/quartermaster.html # standalone offline copy
```

Keep Cloudflare's existing automatic analytics injection enabled; the default
build does not add a duplicate beacon. Exclude `/downloads/*` from injection.
See [analytics configuration](docs/launch-analytics.md) for manual/disabled modes.

Cloudflare Pages may normalize `/index.html` to `/` and `/pricing.html` to
`/pricing`. The links and fragment routes support this behavior. See
[Cloudflare's serving-pages documentation](https://developers.cloudflare.com/pages/configuration/serving-pages/).

### Blank-page fix and deployment checks

During the September 2026 investigation, production `/` served the app, while
`/allocation-tracker.html` returned **HTTP 404 with an empty body**. Pricing and
logo links still pointed to that missing URL. The in-page Open the app button
worked in the browser test; the missing destination was the reproduced failure.

Public links now use `index.html`, and the build retains the legacy app URL.
The repository's small `allocation-tracker.html` compatibility page redirects to
`index.html`, preserving query parameters and section anchors. **Edit
`index.html`, not this compatibility file.**

After deploying, verify:

- `/` displays the landing page, and **Start here** opens the guide.
- `/pricing` → **Start here** opens the same guide.
- Pricing's section links land on the intended main-page sections.
- `/allocation-tracker.html` still opens the app.
- An unknown URL shows the custom 404 page instead of a blank response.
- Demo navigation works and portfolio edits are blocked.

If an old page remains after deployment, check for custom Cloudflare cache rules
and purge stale cached HTML. Do not use aggressive caching for these HTML pages.

## Local development and verification

```bash
# Build and serve the exact deployment output.
node scripts/build-site.js
python3 -m http.server 8747 --directory dist
# Open http://127.0.0.1:8747/

# Regression suites (no package installation required).
node test/tax-engine.test.js
node test/persistence.test.js
node test/projection-display.test.js
node test/site-build.test.js
node test/onboarding.test.js
```

For direct source development, serve the repository root instead of `dist`.
Rebuild after source edits before testing `dist`. Never use a real portfolio file
for testing; use the demo or a throwaway copy.

### Where to edit copy

- `index.html`: landing page (`renderMarketingLanding`), starter dialog
  (`dialogHTML`, `onboard` case), setup (`renderSetup`), and app text.
- `pricing.html`: introductory offer and planned paid capabilities.
- `privacy.html`: privacy disclosures.

All three pages are self-contained. `dist/` is generated and ignored by Git.

## Roadmap and limitations

Optional cloud saving, review reminders, and ongoing downloadable reports are
**coming soon**. Reports are free during the introductory release; there is no
checkout or download quota yet.

Tax figures use simplified rules and entered assumptions; simulations illustrate
possible outcomes, not forecasts or guarantees. This is a personal tracking and
education tool, not investment, tax, or legal advice.

See the [review summary](docs/review-summary.md),
[financial review](docs/financial-review.md), [UX review](docs/ux-review.md), and
[architecture roadmap](docs/architecture-review.md). Older review documents refer
to the app's former source filename, `allocation-tracker.html`.
