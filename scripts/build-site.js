/* Build the hosted site while preserving the standalone, tracker-free HTML app.
   CF_WEB_ANALYTICS_TOKEN is a public site identifier, never an API credential. */
const fs = require('node:fs');
const path = require('node:path');
const { applyMarketingShell } = require('./marketing-shell');
const publicPages = [
  ['index.html', ''],
  ['pricing.html', 'pricing'],
  ['privacy.html', 'privacy'],
];
const root = path.join(__dirname, '..');

function analyticsMarkup(token) {
  if (!token) return '';
  if (!/^[a-f0-9]{32}$/i.test(token)) throw new Error('CF_WEB_ANALYTICS_TOKEN must be the 32-character public site token from the Cloudflare beacon snippet.');
  return `\n<!-- Hosted build only; no portfolio data or custom events are sent. -->
<script>
(() => {
  if (location.protocol !== 'https:' || !['realallocation.com', 'www.realallocation.com'].includes(location.hostname)) return;
  // Manual installation only. Disable Cloudflare auto-injection to avoid duplicates.
  if (document.querySelector('script[data-cf-beacon], script[src*="cloudflareinsights.com/beacon"]')) return;
  const beacon = document.createElement('script');
  beacon.type = 'module';
  beacon.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  beacon.setAttribute('data-cf-beacon', '${JSON.stringify({ token })}');
  document.head.appendChild(beacon);
})();
</script>\n`;
}
function buildSite(output = path.join(root, 'dist'), token = process.env.CF_WEB_ANALYTICS_TOKEN || '', mode = process.env.CF_ANALYTICS_MODE || 'automatic') {
  if (!['automatic', 'manual', 'disabled'].includes(mode)) throw new Error('CF_ANALYTICS_MODE must be automatic, manual, or disabled.');
  if (mode === 'manual' && !token.trim()) throw new Error('Manual analytics requires CF_WEB_ANALYTICS_TOKEN.');
  const analytics = mode === 'manual' ? analyticsMarkup(token.trim()) : '';
  // A deployment should contain only files from this build. Removing the
  // generated directory prevents retired assets from surviving a later deploy.
  fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  const write = (name, text) => {
    const dest = path.join(output, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, text);
  };
  write('site-analytics.js', fs.readFileSync(path.join(root, 'site-analytics.js'), 'utf8'));
  write('favicon.svg', fs.readFileSync(path.join(root, 'favicon.svg'), 'utf8'));
  write('assets/marketing.css', fs.readFileSync(path.join(root, 'assets', 'marketing.css'), 'utf8'));
  write('assets/marketing.js', fs.readFileSync(path.join(root, 'assets', 'marketing.js'), 'utf8'));
  const productImages = ['quartermaster-review.png', 'quartermaster-history.png'];
  for (const name of productImages) write('assets/' + name, fs.readFileSync(path.join(root, 'assets', name)));
  const hostedIcons = (html, prefix = '') => html.replace(/<link rel="icon"[^>]*>/g, `<link rel="icon" type="image/svg+xml" href="${prefix}favicon.svg">`);
  for (const [name, current] of publicPages) {
    const html = applyMarketingShell(fs.readFileSync(path.join(root, name), 'utf8'), current);
    write(name, hostedIcons(html).replace('</body>', analytics + '</body>'));
  }
  const app = fs.readFileSync(path.join(root, 'app.html'), 'utf8');
  const hostedApp = hostedIcons(app, '/').replace('src="site-analytics.js"', 'src="/site-analytics.js"');
  write('app/index.html', hostedApp.replace('</body>', analytics + '</body>'));
  // Stable legacy URL, plus a downloadable copy with no injected analytics.
  write('allocation-tracker.html', fs.readFileSync(path.join(root, 'allocation-tracker.html'), 'utf8'));
  const offlineApp = productImages.reduce((html, name) => html.replaceAll(`assets/${name}`, `data:image/png;base64,${fs.readFileSync(path.join(root, 'assets', name)).toString('base64')}`), app);
  write('downloads/quartermaster.html', offlineApp.replace(/<!-- Google tag \(gtag\.js\) -->[\s\S]*?<!-- End Google tag -->\n?/, '').replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; worker-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'">`));
  const notFound = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Page not found — Quartermaster</title><link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/assets/marketing.css"></head><body><a class="skip" href="#main">Skip to main content</a><div class="marketing-page"><!-- MARKETING_HEADER --><main id="main" class="landing-main"><section class="landing-section" style="min-height:58vh;display:grid;place-content:center;text-align:center;"><div><div class="eyebrow" style="--eyebrow:#45bfae">404</div><h1 style="margin:18px 0 12px;">That page isn’t here.</h1><p class="landing-section-copy" style="margin:0 auto 24px;">The address may have changed, or the link may be incomplete.</p><a class="landing-action primary" href="/">Return to Quartermaster</a></div></section></main><!-- MARKETING_FOOTER --></div></body></html>`;
  write('404.html', applyMarketingShell(notFound));
  write('_headers', `/*
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Strict-Transport-Security: max-age=86400
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://*.google-analytics.com https://cloudflareinsights.com; worker-src blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  Cache-Control: public, max-age=0, must-revalidate
/downloads/*
  Cache-Control: public, max-age=0, must-revalidate, no-transform
  Content-Disposition: attachment; filename="quartermaster.html"
  Content-Security-Policy: default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; worker-src blob:; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
`);
  // An explicit 404 avoids Pages' default SPA fallback turning typos into home views.
  return { output, analyticsMode: mode, analyticsEnabled: mode !== 'disabled' };
}
if (require.main === module) {
  const result = buildSite();
  console.log(`Built ${result.output}. Analytics ${result.analyticsMode === 'automatic' ? 'automatic: Cloudflare injects the beacon in production; exclude downloads and preview hosts in its rules' : result.analyticsEnabled ? 'manual (production HTTPS host only)' : 'disabled in build (also disable Cloudflare auto-injection)'}.`);
}
module.exports = { buildSite, analyticsMarkup };
