# Public pages and Cloudflare analytics

## Simple deployment

The source app and public pages are ordinary static files:

- `index.html` — the lightweight public landing page.
- `app.html` — the canonical application source, emitted at `/app/`.
- `pricing.html` — plans and upcoming features; all **Get more information** buttons open feature-specific email drafts to hello@realallocation.com.
- `privacy.html` — local portfolio processing and hosted analytics explained.
- `scripts/marketing-shell.js` and `assets/marketing.css` — the shared public header, footer, width, and interaction styling.

Review the generated `dist/` output because the shared public shell is applied at build time. The app's existing unsaved-change warning remains active when leaving a modified portfolio.

Run `node scripts/build-site.js` and publish `dist/`. It emits the public pages, the app at `app/index.html`, a compatibility redirect, and an isolated standalone app download. No runtime dependencies or application server are required. Previous generated interest-page routes are removed on rebuilding.

## What is available

Local portfolio tracking, financial scenario tools and introductory report downloads remain available free. Cloud saving, quarterly/annual reminders and ongoing report access are labeled **coming soon**. No price, checkout, report quota or subscription is implemented.

The email buttons use `mailto:` with a static subject/body. They open the visitor's email app, which must be configured; the visitor chooses whether to send. No automatic message, waitlist subscription or portfolio upload occurs. The contact address is also shown so visitors can compose manually.

## Cloudflare

The user confirmed automatic Web Analytics injection is already enabled. The default build adds **no second Cloudflare beacon**. Google Analytics is configured separately below. Keep the existing production injection enabled for the public pages.

Cloudflare can count visits to `/pricing.html`. It cannot directly count these email-button clicks or confirm whether a draft was sent. Incoming emails provide the stronger interest signal. Pageview counts can include repeat visits and exclude blocked analytics; they are not unique votes or a user-level conversion funnel.

If publishing the generated download, exclude `/downloads/*` and preview hosts from Cloudflare injection rules. The generated download has no analytics code, uses `Cache-Control: no-transform` and attachment disposition, and includes a policy blocking external scripts and network connections. Verify edge behavior after deployment.

For the Git-connected Cloudflare Worker, use `node scripts/build-site.js` as the build command, `npx wrangler deploy --assets ./dist` as the production deploy command, and `npx wrangler versions upload --assets ./dist` for non-production versions. Wrangler uploads the generated `dist` directory, including its `_headers` rules. Other static hosts must apply equivalent download headers when using that build.

Only if auto-injection is disabled later, `CF_ANALYTICS_MODE=manual` and the public `CF_WEB_ANALYTICS_TOKEN` can add a production-host-only beacon. Do not combine manual and automatic installation. `CF_ANALYTICS_MODE=disabled` omits manual code but does not turn off Cloudflare's edge injection.

Sources: [Cloudflare setup](https://developers.cloudflare.com/web-analytics/get-started/), [rules](https://developers.cloudflare.com/web-analytics/configuration-options/rules/), [custom-event limitations](https://developers.cloudflare.com/web-analytics/faq/).

## Validation

Run `node test/site-build.test.js` for standalone page availability, internal links, direct mailto behavior, analytics modes and offline isolation. Existing financial, persistence and display tests remain applicable. Actual production analytics ingestion must be checked after deployment by visiting the pricing page, leaving it, and checking the page path in Cloudflare Web Analytics.

## Product recommendations

Keep portable portfolio JSON export available independently of report pricing. For a future paid release, prioritize cloud saving with version history/recovery, explicit opt-in reminder cadence and unsubscribe controls. Define report pricing and the introductory offer's end before adding billing. No paid-feature service is implied to be active today.

### Entry-point compatibility

Edit `index.html` for landing content and `app.html` for the application. Public
start links use `/#start`. The root `allocation-tracker.html` is only a
compatibility redirect for older links and preserves their query and app anchor.
Deploy the whole `dist/` folder, including the public pages and `404.html`.


## Google Analytics 4

Deploy `site-analytics.js` alongside the HTML pages (the build copies it into `dist/`).
The Google tag remains in the head. Configuration disables its automatic initial
pageview; the shared module sends one initial view and subsequent virtual app
views, deduplicated across redraws. App paths such as `/app/dashboard` are reporting
labels, not actual server routes. Setup steps use `/app/setup/accounts`, `/goals`,
and `/holdings`. Do not create a second GA4 installation in Tag Manager or Cloudflare.

Only HTTPS `realallocation.com` and `www.realallocation.com` send these events.
Localhost and preview hosts do not configure GA4. The standalone build removes
both the Google bootstrap and the analytics script reference. Portfolio data,
filenames, DOM text and user input are never passed to this event API. Only fixed
allowlisted labels are accepted. Google Signals and advertising personalization
are disabled in the configuration.

### Google settings after deployment

1. Admin → Data streams → web stream → Enhanced measurement → Page views →
   advanced settings: turn OFF **Page changes based on browser history events**.
   This avoids overlapping Google's automatic history tracking with our explicit
   virtual pageviews. Leave basic pageview measurement enabled; code controls sends.
2. Leave form interactions and site search off for this financial app. Outbound
   link clicks and scrolling can remain enabled.
3. Admin → Custom definitions: create event-scoped dimensions for `view_name`,
   `portfolio_mode`, `step_name`, `save_method`, `report_format`, and `feature`.
   These make event parameters usable in regular reports and explorations.
4. Admin → Events: mark `setup_complete`, `checkin_complete`, and
   `paid_interest_click` as key events once received.
5. Realtime shows incoming activity. Standard reports/custom dimensions can take
   24–48 hours. Use Pages and screens for views and Explore → Funnel exploration
   for onboarding. Filter `portfolio_mode` to `personal` for real app usage.

### Events

- `page_view`: initial public page or changed app screen; includes `view_name` and `portfolio_mode`.
- `start_here_click`: landing start button or public link to onboarding.
- `demo_start`: sample portfolio actually loaded.
- `setup_step_view`: accounts, goals or holdings shown.
- `setup_complete`: first setup successfully recorded.
- `portfolio_open_click`: open-file button selected.
- `portfolio_open_success`: validated file loaded, including browser-authorized reopening.
- `portfolio_save_click`: save reminder opened.
- `portfolio_save_success`: file written (`file_write`) or download initiated (`download_initiated`). Browsers cannot confirm the latter reached disk.
- `checkin_complete`: subsequent check-in successfully recorded.
- `report_download`: CSV download initiated; no snapshot dates or contents included.
- `report_print_click`: print dialog requested; not proof of a printed/saved PDF.
- `paid_interest_click`: pricing email draft requested; not proof an email was sent.

Tag Assistant is optional and used only for verification. For detailed testing,
connect the production site with Tag Assistant and inspect GA4 DebugView. Test
setup, demo, tab changes, a canceled save, a completed save, file loading and
pricing clicks. Re-rendering the same view must not add another pageview; canceling
a save must not emit success. Do not enable debug mode globally for all visitors.

Run `node test/analytics.test.js` plus persistence, onboarding and site-build tests.
