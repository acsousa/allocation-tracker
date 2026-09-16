# Public pages and Cloudflare analytics

## Simple deployment

The source app and public pages are ordinary, self-contained HTML files:

- `index.html` — the canonical app and landing page, including retirement/529 simulation introduction.
- `pricing.html` — plans and upcoming features; all **Get more information** buttons open feature-specific email drafts to hello@realallocation.com.
- `privacy.html` — local portfolio processing and hosted analytics explained.

Keep these files alongside one another. They work directly from the local server without a build: `/` (or `/index.html`), `/pricing.html`, `/privacy.html`. Pricing uses the same Quartermaster brand, navigation style, colors and header treatment as the landing page. Pricing links navigate in the same tab. The app's existing unsaved-change warning remains active when leaving a modified portfolio.

For the existing generated deployment workflow, run `node scripts/build-site.js` and publish `dist/`. It copies those pages, provides both `index.html` and `allocation-tracker.html`, and creates an isolated standalone app download. No runtime dependencies or application server are required. Previous generated interest-page routes are removed on rebuilding.

## What is available

Local portfolio tracking, financial scenario tools and introductory report downloads remain available free. Cloud saving, quarterly/annual reminders and ongoing report access are labeled **coming soon**. No price, checkout, report quota or subscription is implemented.

The email buttons use `mailto:` with a static subject/body. They open the visitor's email app, which must be configured; the visitor chooses whether to send. No automatic message, waitlist subscription or portfolio upload occurs. The contact address is also shown so visitors can compose manually.

## Cloudflare

The user confirmed automatic Web Analytics injection is already enabled. The default build adds **no second tracker**. Keep the existing production injection enabled for the public pages.

Cloudflare can count visits to `/pricing.html`. It cannot directly count these email-button clicks or confirm whether a draft was sent. Incoming emails provide the stronger interest signal. Pageview counts can include repeat visits and exclude blocked analytics; they are not unique votes or a user-level conversion funnel.

If publishing the generated download, exclude `/downloads/*` and preview hosts from Cloudflare injection rules. The generated download has no analytics code, uses `Cache-Control: no-transform` and attachment disposition, and includes a policy blocking external scripts and network connections. Verify edge behavior after deployment.

For Cloudflare Pages, the optional build command is `node scripts/build-site.js`, with output directory `dist`. Other static hosts must apply equivalent download headers when using that build. Hosting settings were not changed here.

Only if auto-injection is disabled later, `CF_ANALYTICS_MODE=manual` and the public `CF_WEB_ANALYTICS_TOKEN` can add a production-host-only beacon. Do not combine manual and automatic installation. `CF_ANALYTICS_MODE=disabled` omits manual code but does not turn off Cloudflare's edge injection.

Sources: [Cloudflare setup](https://developers.cloudflare.com/web-analytics/get-started/), [rules](https://developers.cloudflare.com/web-analytics/configuration-options/rules/), [custom-event limitations](https://developers.cloudflare.com/web-analytics/faq/).

## Validation

Run `node test/site-build.test.js` for standalone page availability, internal links, direct mailto behavior, analytics modes and offline isolation. Existing financial, persistence and display tests remain applicable. Actual production analytics ingestion must be checked after deployment by visiting the pricing page, leaving it, and checking the page path in Cloudflare Web Analytics.

## Product recommendations

Keep portable portfolio JSON export available independently of report pricing. For a future paid release, prioritize cloud saving with version history/recovery, explicit opt-in reminder cadence and unsubscribe controls. Define report pricing and the introductory offer's end before adding billing. No paid-feature service is implied to be active today.

### Entry-point compatibility

Edit `index.html`; do not manually rename it for deployment. Public navigation uses
`index.html` and `index.html#start`. The root `allocation-tracker.html` is only a
compatibility redirect for local/older links. The build emits a full app at the
legacy URL too, preserving old bookmarks without depending on a redirect.
Deploy the whole `dist/` folder, including the public pages and `404.html`.
