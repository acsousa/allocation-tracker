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
  write('downloads/quartermaster.html', offlineApp.replace(/<!-- Google tag \(gtag\.js\) -->[\s\S]*?<!-- End Google tag -->\n?/, '').replace('<head>', `<head>\n<meta http-equiv="Content-Security-Policy" content="connect-src 'none'; script-src 'unsafe-inline'; object-src 'none'; base-uri 'none'">`));
  write('404.html', '<!doctype html><html lang="en"><meta charset="utf-8"><title>Page not found — Quartermaster</title><h1>Page not found</h1><a href="/">Return to Quartermaster</a></html>');
  // Retire only the generated directories from the previous launch build.
  for (const name of ['pricing', 'privacy', 'interest']) fs.rmSync(path.join(output, name), { recursive: true, force: true });
  fs.rmSync(path.join(output, 'site.css'), { force: true });
  write('_headers', `/*
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
  Cache-Control: public, max-age=0, must-revalidate
/downloads/*
  Cache-Control: public, max-age=0, must-revalidate, no-transform
  Content-Disposition: attachment; filename="quartermaster.html"
  Content-Security-Policy: connect-src 'none'; script-src 'unsafe-inline'; object-src 'none'; base-uri 'none'
`);
  // An explicit 404 avoids Pages' default SPA fallback turning typos into home views.
  return { output, analyticsMode: mode, analyticsEnabled: mode !== 'disabled' };
}
if (require.main === module) {
  const result = buildSite();
  console.log(`Built ${result.output}. Analytics ${result.analyticsMode === 'automatic' ? 'automatic: Cloudflare injects the beacon in production; exclude downloads and preview hosts in its rules' : result.analyticsEnabled ? 'manual (production HTTPS host only)' : 'disabled in build (also disable Cloudflare auto-injection)'}.`);
}
module.exports = { buildSite, analyticsMarkup };
