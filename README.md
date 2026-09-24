# Quartermaster

**Your real allocation, across all your accounts.** Quartermaster is a local-file
portfolio tracker at [realallocation.com](https://realallocation.com).
It combines allocation charts, quarterly reviews, tax estimates, and retirement
and 529 simulations. It does not connect to your bank or execute trades.

See [product context](docs/product-context.md) for the durable product purpose,
privacy commitments, planning direction, and desktop/mobile requirement.

## Separate public site and local app

- **`index.html` is the public landing page.** It stays lightweight and links to
  the dedicated app at `/app/`.
- **`app.html` is the application source.** Its JavaScript, styles, and charts
  are inline; no framework or runtime dependencies are needed. The build emits
  it at `dist/app/index.html` and as the self-contained offline download.
- **`scripts/marketing-shell.js`, `assets/marketing.css`, and
  `assets/marketing.js` are the shared public
  shell.** The build uses them to keep the landing, pricing, and privacy headers,
  footers, width, navigation, and interaction patterns synchronized.
- **Your portfolio `.json` file is your data.** Open it locally at the beginning
  of a session and save it when you finish. Your holdings and balances are never
  uploaded by this release. Keep a backup somewhere you trust.

The hosted website uses Google Analytics (GA4, `G-MM26T8RTHV`) for usage
measurement and Cloudflare Web Analytics for visits and performance. The Google
tag is immediately after `<head>` on the main, pricing, and privacy pages; the
build removes it from the standalone download. Hosted app views and selected workflow events are configured in `site-analytics.js`;
only the production HTTPS domains send these events. See
[analytics setup](docs/launch-analytics.md#google-analytics-4) for reporting configuration.
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
5. Next time, choose **Open an existing portfolio file** in the landing guide and
   select your JSON file. The app opens it directly without a second picker. This
   reads the file locally; it is not an upload.

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

## Cloudflare Workers deployment

The main deployed page is the lightweight **`index.html`** landing page; the app
is emitted at **`/app/`**. Do not upload individual files: pricing, privacy,
shared assets, the app, and compatibility URLs must be deployed together.

### Git-connected Worker

| Setting | Value |
| --- | --- |
| Git repository | `acsousa/allocation-tracker` |
| Root directory | `/` |
| Build command | `node scripts/build-site.js` |
| Deploy command | `npx wrangler deploy --assets ./dist` |
| Version command | `npx wrangler versions upload --assets ./dist` |
| Production branch | `main` |

Workers Builds runs the build command first, then Wrangler uploads only the
generated `dist` assets. The checked-in `wrangler.jsonc` identifies the existing
Worker and gives both production and preview commands the same asset and routing
configuration. Use a feature branch for preview deployments before merging;
production deploys from `main`.

This setup uses Cloudflare's free static-asset hosting and GitHub Actions' free
allowance for public repositories; it does not require a database, server-side
function, paid API, or paid market-data feed. Wrangler is pinned in
`package-lock.json` so Cloudflare and local builds use the same deploy tooling.

In Cloudflare, enable **SSL/TLS → Edge Certificates → Always Use HTTPS**. The
site also sends an HSTS header after a browser reaches HTTPS, but the dashboard
toggle is what redirects an initial plain-HTTP request. Keep automatic analytics
enabled and exclude `/downloads/*` so the standalone file remains tracker-free.

In GitHub, protect `main` and require the **Verify static site / verify** status
check before merge. Keep the existing feature-branch → pull request → squash
merge workflow; Cloudflare should deploy production only from `main`.

### Manual / Direct Upload

Run:

```bash
node scripts/build-site.js
```

Upload the **contents of `dist/`** as one deployment. Its root should contain:

```text
dist/
  index.html                   # lightweight public landing at /
  app/index.html               # portfolio application at /app/
  allocation-tracker.html      # compatibility redirect for old bookmarks
  pricing.html
  privacy.html
  assets/marketing.css         # shared public-page layout and interactions
  favicon.svg                 # browser tab icon
  404.html                     # visible error page, with a home link
  _headers
  downloads/quartermaster.html # standalone offline copy
```

Keep Cloudflare's existing automatic analytics injection enabled; the default
build does not add a duplicate beacon. Exclude `/downloads/*` from injection.
See [analytics configuration](docs/launch-analytics.md) for manual/disabled modes.

Cloudflare Workers static assets may normalize `/index.html` to `/` and
`/pricing.html` to `/pricing`. The links and fragment routes support the default
`auto-trailing-slash` behavior. See
[Cloudflare's HTML handling documentation](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/).

### Blank-page fix and deployment checks

During the September 2026 investigation, production `/` served the app, while
`/allocation-tracker.html` returned **HTTP 404 with an empty body**. Pricing and
logo links still pointed to that missing URL. The in-page Open the app button
worked in the browser test; the missing destination was the reproduced failure.

The public Start Here guide sends a chosen action to `/app/`; a bare hosted
`/app/` visit returns to that guide. The standalone download opens the same
guide in place. The repository's small
`allocation-tracker.html` compatibility page redirects there while preserving
query parameters and app anchors.

After deploying, verify:

- `/` displays the landing page, and **Start here** opens the guide without leaving it.
- **Build my portfolio** enters `/app/#setup` directly; demo links enter their requested app view.
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

# Exact regression and build check used by GitHub Actions.
npm ci
npm run check
```

For direct source development, serve the repository root instead of `dist`.
Rebuild after source edits before testing `dist`. Never use a real portfolio file
for testing; use the demo or a throwaway copy.

### Where to edit copy

- `index.html`: public landing content.
- `app.html`: starter dialog (`dialogHTML`, `onboard` case), setup
  (`renderSetup`), and application text.
- `pricing.html`: introductory offer and planned paid capabilities.
- `privacy.html`: privacy disclosures.
- `scripts/marketing-shell.js`: shared public navigation and footer markup.
- `assets/marketing.css`: shared public layout, width, and interaction styles.
- `assets/marketing.js`: landing-page Start Here dialog behavior.

`dist/` is generated and ignored by Git. Use the built output when reviewing
public-page chrome because the shared shell is applied at build time.

## Roadmap and limitations

Optional cloud saving, review reminders, and ongoing downloadable reports are
**coming soon**. Reports are free during the introductory release; there is no
checkout or download quota yet.

A future release may add an automatic, device-local browser recovery copy to
reduce accidental loss between file saves. It should show separate timestamps
for the browser recovery copy and the user-owned portfolio file, offer recovery
rather than silently replacing a file, and provide a way to clear local recovery
data. Browser recovery is not a backup and does not replace the portable file as
the durable source of truth.

Tax figures use simplified rules and entered assumptions; simulations illustrate
possible outcomes, not forecasts or guarantees. This is a personal tracking and
education tool, not investment, tax, or legal advice.

See the [review summary](docs/review-summary.md),
[financial review](docs/financial-review.md), [UX review](docs/ux-review.md), and
[architecture roadmap](docs/architecture-review.md). Older review documents refer
to the app's former source filename, `allocation-tracker.html`.
