const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { buildSite, analyticsMarkup } = require('../scripts/build-site');
const pages = ['index.html', 'pricing.html', 'privacy.html'];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'quartermaster-site-'));
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('✓ ' + name); }
try {
  check('automatic mode leaves beacon injection to Cloudflare', () => {
    fs.writeFileSync(path.join(tmp, 'retired-file.txt'), 'must not survive');
    const result = buildSite(tmp, '', 'automatic');
    assert.equal(result.analyticsMode, 'automatic');
    assert.ok(!fs.readFileSync(path.join(tmp, 'index.html'), 'utf8').includes('beacon.min.js'));
    const headers = fs.readFileSync(path.join(tmp, '_headers'), 'utf8');
    assert.ok(!headers.split('/downloads/*')[0].includes('no-transform'));
    assert.ok(headers.split('/downloads/*')[1].includes('no-transform'));
    assert.ok(!fs.existsSync(path.join(tmp, 'retired-file.txt')));
    assert.match(headers, /Strict-Transport-Security: max-age=86400/);
    assert.match(headers, /X-Frame-Options: DENY/);
    assert.match(headers, /Permissions-Policy:/);
    assert.match(headers, /worker-src blob:/);
    assert.match(headers, /frame-ancestors 'none'/);
  });
  check('landing and app are separate, with a stable legacy redirect', () => {
    const index = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
    const app = fs.readFileSync(path.join(tmp, 'app', 'index.html'), 'utf8');
    assert.match(index, /class="landing-hero"/);
    assert.ok(!index.includes('window.__AAT__'));
    assert.match(app, /window\.__AAT__/);
    assert.ok(index.length < app.length / 3, 'the public landing should be substantially lighter than the app');
    assert.match(fs.readFileSync(path.join(tmp, 'allocation-tracker.html'), 'utf8'), /new URL\('app\/'/);
    for (const page of pages) assert.ok(!fs.readFileSync(path.join(tmp, page), 'utf8').includes('href="allocation-tracker.html'));
    assert.match(fs.readFileSync(path.join(tmp, '404.html'), 'utf8'), /href="\/"/);
  });
  check('source compatibility redirect preserves section and query', () => {
    const alias = fs.readFileSync(path.join(__dirname, '..', 'allocation-tracker.html'), 'utf8');
    let destination;
    const location = {href:'https://example.com/allocation-tracker.html?preview=1#start',search:'?preview=1',hash:'#start',replace(url){destination=url;}};
    vm.runInNewContext(alias.match(/<script>([\s\S]*?)<\/script>/)[1], {URL, location});
    assert.equal(destination, 'https://example.com/app/?preview=1#start');
  });
  check('hosted pages include the official brand and landing assets and offline copy embeds them', () => {
    for (const name of ['quartermaster-mark.png', 'quartermaster-mark-dark.png', 'quartermaster-lockup.png', 'quartermaster-lockup-dark.png', 'quartermaster-history-detail.png', 'quartermaster-phone.png']) {
      const asset = fs.readFileSync(path.join(tmp, 'assets', name));
      assert.equal(asset.subarray(1, 4).toString(), 'PNG');
    }
    const lockup = fs.readFileSync(path.join(tmp, 'assets', 'quartermaster-lockup.png'));
    const mark = fs.readFileSync(path.join(tmp, 'assets', 'quartermaster-mark.png'));
    assert.deepEqual([lockup.readUInt32BE(16), lockup.readUInt32BE(20)], [1273, 240]);
    assert.deepEqual([mark.readUInt32BE(16), mark.readUInt32BE(20)], [900, 900]);
    for (const name of ['index.html', 'app/index.html', 'pricing.html', 'privacy.html']) {
      const html = fs.readFileSync(path.join(tmp, name), 'utf8');
      assert.equal((html.match(/rel="icon"/g) || []).length, 1);
      assert.match(html, /href="\/assets\/quartermaster-mark.png"/);
    }
    const offline = fs.readFileSync(path.join(tmp, 'downloads/quartermaster.html'), 'utf8');
    assert.match(offline, /href="data:image\/png;base64,/);
    assert.match(offline, /class="qm-logo-dark" src="data:image\/png;base64,/);
    assert.ok(!offline.includes('assets/quartermaster-'));
    for (const name of ['Barlow-Regular.ttf', 'Barlow-SemiBold.ttf', 'BarlowCondensed-SemiBold.ttf', 'BarlowCondensed-Bold.ttf', 'IBMPlexMono-Regular.ttf', 'IBMPlexMono-Medium.ttf', 'OFL-Barlow.txt', 'OFL-IBMPlexMono.txt']) {
      assert.ok(fs.statSync(path.join(tmp, 'assets', 'fonts', name)).size > 100, `font asset ${name}`);
    }
  });
  check('every marketing page has working local navigation', () => {
    for (const name of pages) {
      const html = fs.readFileSync(path.join(tmp, name), 'utf8');
      for (const [, href] of html.matchAll(/href="([^"]+)"/g)) {
        if (/^(https?:|mailto:|data:image\/svg\+xml,|#)/.test(href)) continue;
        const pathname = href.split(/[?#]/)[0];
        const target = pathname.startsWith('/') ? path.join(tmp, pathname.slice(1)) : path.resolve(tmp, path.dirname(name), pathname);
        assert.ok(fs.existsSync(target), `${name} -> ${href} must exist`);
        if (fs.statSync(target).isDirectory()) assert.ok(fs.existsSync(path.join(target, 'index.html')));
      }
    }
  });
  check('public section links resolve and launch actions open the landing guide', () => {
    const source = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
    for (const page of ['pricing.html', 'privacy.html']) {
      const html = fs.readFileSync(path.join(tmp, page), 'utf8');
      for (const [, id] of html.matchAll(/href="\/#(lp-[a-z-]+)"/g)) {
        assert.ok(source.includes('id="' + id + '"'), page + ' section ' + id);
      }
      assert.match(html, /href="\/#start">Start here/);
    }
    assert.match(fs.readFileSync(path.join(tmp, 'pricing.html'), 'utf8'), /href="\/#start"/);
  });
  check('public pages share one header and footer source', () => {
    const built = pages.map(name => fs.readFileSync(path.join(tmp, name), 'utf8'));
    const header = html => html.match(/<header class="marketing-header">[\s\S]*?<\/header>/)[0].replace(/ aria-current="page"/g, '');
    const footer = html => html.match(/<footer class="marketing-footer">[\s\S]*?<\/footer>/)[0].replace(/ aria-current="page"/g, '');
    assert.equal(new Set(built.map(header)).size, 1);
    assert.equal(new Set(built.map(footer)).size, 1);
    for (const html of built) {
      assert.ok(!footer(html).includes('Pricing'));
      assert.match(html, /href="assets\/marketing.css"/);
      assert.match(header(html), /class="marketing-brand-lockup" src="assets\/quartermaster-lockup.png"/);
      assert.match(header(html), /class="marketing-brand-mark" src="assets\/quartermaster-mark.png"/);
    }
  });
  check('landing tells one audited four-part story with accessible motion and a local start dialog', () => {
    const html = fs.readFileSync(path.join(tmp, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(tmp, 'assets', 'marketing.css'), 'utf8');
    const interactions = fs.readFileSync(path.join(tmp, 'assets', 'marketing.js'), 'utf8');
    assert.match(css, /@keyframes qm-grid-pass/);
    assert.match(css, /prefers-reduced-motion:reduce/);
    assert.match(css, /\.qm-motion \[data-reveal\]/);
    assert.match(css, /\.marketing-open:hover\s*\{[^}]*translateY\(-2px\)/);
    assert.match(html, /src="assets\/marketing.js"/);
    assert.match(html, /class="hero-field"/);
    assert.match(html, /Built for US investors with multiple accounts/);
    for (const id of ['lp-whole', 'lp-tax', 'lp-goals', 'lp-decisions', 'lp-privacy']) assert.match(html, new RegExp(`id="${id}"`));
    assert.match(html, /id="lp-privacy" class="privacy-section" data-story="privacy"/);
    assert.ok(!html.includes('story-rail'));
    assert.match(html, /data-focus-ring="1"/);
    assert.match(html, /href="\/app\/#demo\/dashboard"/);
    assert.match(html, /href="\/app\/#demo\/review\/tax"/);
    assert.match(html, /href="\/app\/#demo\/outlook"/);
    assert.match(html, /\$265,000/);
    assert.match(html, /\$360<span>\/ year<\/span>/);
    assert.match(html, /\$1\.95M/);
    assert.match(html, /<strong>87%<\/strong>/);
    assert.ok(!html.includes('6 accounts'));
    assert.ok(!/guided demo/i.test(html));
    assert.match(html, /id="start-dialog" hidden/);
    assert.match(html, /href="\/app\/#setup">Build my portfolio/);
    assert.match(html, /href="\/app\/#open" data-open-portfolio/);
    assert.match(html, /<ol class="start-dialog-steps">/);
    assert.match(html, /Your work is protected/);
    assert.match(interactions, /const openDialog = \(\) =>/);
    assert.match(interactions, /document\.body\.appendChild\(backdrop\)/);
    assert.match(interactions, /new IntersectionObserver/);
    assert.match(interactions, /rootMargin: '-45% 0px -50% 0px'/);
    assert.match(interactions, /const focusY = \(window\.innerHeight \|\| 800\) \* \.475/);
    assert.match(interactions, /\.value-strip > \[data-reveal\]/);
    assert.match(interactions, /loadValues\.forEach\(value => value\.classList\.add\('is-in'\)\)/);
    assert.match(interactions, /lockedUntil = Date\.now\(\) \+ 4000/);
    assert.match(html, /class="value-strip"[^>]*data-reveal-group/);
    assert.equal((html.match(/class="value-signpost[^\"]*" data-reveal/g) || []).length, 4);
    assert.match(interactions, /sessionStorage\.setItem\(portfolioHandoffKey/);
    assert.match(interactions, /input\.accept = '\.json,application\/json'/);
    assert.match(html, /No affiliate commissions · no products to sell · no custody or trading/);
    assert.match(css, /@font-face \{ font-family:"Barlow"/);
    assert.match(css, /\.story-heading \{ max-width:1180px;[^}]*text-align:left/);
    assert.match(css, /\.history-detail \{[^}]*z-index:1/);
    assert.match(css, /\.phone-detail \{[^}]*z-index:2/);
    assert.ok(!html.includes('<span>Unsaved</span>'));
    assert.match(css, /\.marketing-page \{[^}]*overflow:visible/);
    assert.match(css, /\.marketing-header \{ position:sticky;top:0;z-index:60/);
    assert.match(css, /\.marketing-nav \.marketing-link\[aria-current="page"\],\.marketing-nav \.marketing-link\[aria-current="location"\] \{ color:var\(--blue\);font-weight:600/);
    assert.match(css, /\.tax-flow \{[^}]*align-items:stretch/);
    assert.match(css, /\.cadence-steps \{ display:grid;grid-template-columns:repeat\(4/);
    for (const [, heading] of html.matchAll(/(<header class="story-heading"[\s\S]*?<\/header>)/g)) assert.ok(!heading.includes('<p>'));
  });
  check('dedicated app entry stays simple with one graphic and three actions', () => {
    const app = fs.readFileSync(path.join(tmp, 'app', 'index.html'), 'utf8');
    assert.match(app, /class="view app-entry"/);
    assert.match(app, /class="app-entry-orbit"/);
    assert.match(app, /<h1>Quartermaster<\/h1>/);
    assert.match(app, />Start here<\/button>/);
    assert.match(app, />Explore demo<\/button>/);
    assert.match(app, />Return to landing page<\/a>/);
    assert.ok(!app.includes('app-entry-signal app-entry-signal-one'));
    assert.match(app, /@keyframes app-entry-float/);
    assert.match(app, /@keyframes app-entry-orbit-spin/);
    assert.match(app, /logoMark\(132\)/);
    assert.match(app, /logoLockup\(42\)/);
    assert.match(app, /logoMark\(40\)/);
    assert.match(app, /--qm-logo-size\) \* 5\.304167/);
    assert.match(app, /\.filebar \.brand,[^}]*color:var\(--color-text\);text-decoration:none/);
    assert.match(app, /isHostedAppEntry\(\) && !window\.location\.hash/);
    assert.match(app, /case 'openfile':\s+body = renderOpenFile\(\)/);
    assert.match(app, /function consumeLandingPortfolio\(\)/);
    assert.match(app, /storage\.removeItem\(LANDING_FILE_HANDOFF_KEY\)/);
  });
  check('pricing uses direct email drafts and no interest routes', () => {
    const html = fs.readFileSync(path.join(tmp, 'pricing.html'), 'utf8');
    assert.match(html, /Get more information/);
    assert.match(html, /mailto:hello@realallocation.com\?subject=/);
    assert.ok(!html.includes('interest/'));
    assert.ok(!html.includes('<form'));
    assert.ok(!fs.existsSync(path.join(tmp, 'interest')));
  });
  check('built pricing includes shared styles and launches the shared guide', () => {
    const html = fs.readFileSync(path.join(tmp, 'pricing.html'), 'utf8');
    assert.match(html, /<style>/);
    assert.match(html, /href="assets\/marketing.css"/);
    assert.match(html, /href="\/#start"/);
  });
  check('pricing keeps four clarity cards in one desktop row', () => {
    const html = fs.readFileSync(path.join(tmp, 'pricing.html'), 'utf8');
    assert.match(html, /\.features\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)\}/);
    assert.match(html, /href="\/#lp-whole">Whole portfolio<\/a>/);
  });
  check('Google tag appears once immediately after head on hosted pages only', () => {
    for (const name of ['index.html', 'app/index.html', 'pricing.html', 'privacy.html']) {
      const html = fs.readFileSync(path.join(tmp, name), 'utf8');
      assert.match(html, /<head>\n<!-- Google tag \(gtag\.js\) -->/);
      assert.equal(html.split('https://www.googletagmanager.com/gtag/js?id=G-MM26T8RTHV').length - 1, 1);
    }
    const offline = fs.readFileSync(path.join(tmp, 'downloads/quartermaster.html'), 'utf8');
    assert.ok(!offline.includes('googletagmanager.com'));
    assert.ok(!offline.includes('G-MM26T8RTHV'));
    assert.ok(!offline.includes('src="site-analytics.js"'));
    assert.ok(fs.existsSync(path.join(tmp, 'site-analytics.js')));
  });
  check('standalone download contains no beacon and blocks network execution', () => {
    const html = fs.readFileSync(path.join(tmp, 'downloads/quartermaster.html'), 'utf8');
    assert.ok(!html.includes('beacon.min.js'));
    assert.match(html, /http-equiv="Content-Security-Policy"/);
    assert.match(html, /default-src 'none'/);
    assert.match(html, /connect-src 'none'/);
    assert.match(html, /worker-src blob:/);
    assert.match(html, /frame-ancestors 'none'/);
  });
  check('manual mode validates its public token and refuses missing config', () => {
    assert.throws(() => buildSite(tmp, '', 'manual'), /requires/);
    assert.throws(() => analyticsMarkup("bad'payload"), /32-character/);
    assert.throws(() => buildSite(tmp, '', 'unknown'), /CF_ANALYTICS_MODE/);
  });
  const token = '0123456789abcdef0123456789abcdef';
  const script = analyticsMarkup(token).match(/<script>([\s\S]*?)<\/script>/)[1];
  function load(protocol, hostname, existing = false) {
    const inserted = [];
    vm.runInNewContext(script, { location: { protocol, hostname }, document: {
      querySelector: () => existing ? {} : null,
      createElement: () => ({ setAttribute(key, value) { this[key] = value; } }),
      head: { appendChild(node) { inserted.push(node); } }
    } });
    return inserted;
  }
  check('manual analytics runs only on exact production HTTPS hosts', () => {
    assert.equal(load('https:', 'realallocation.com').length, 1);
    assert.equal(load('https:', 'www.realallocation.com').length, 1);
    for (const host of ['localhost', '127.0.0.1', 'preview.pages.dev', 'evilrealallocation.com']) assert.equal(load('https:', host).length, 0);
    assert.equal(load('file:', '').length, 0);
    assert.equal(load('http:', 'realallocation.com').length, 0);
    assert.equal(load('https:', 'realallocation.com', true).length, 0);
    assert.deepEqual(JSON.parse(load('https:', 'realallocation.com')[0]['data-cf-beacon']), { token });
  });
  check('manual build adds one loader to hosted pages and none to download', () => {
    buildSite(tmp, token, 'manual');
    for (const name of ['index.html', 'app/index.html', 'pricing.html', 'privacy.html']) {
      const html = fs.readFileSync(path.join(tmp, name), 'utf8');
      assert.equal(html.split('<!-- Hosted build only;').length - 1, 1);
    }
    assert.ok(!fs.readFileSync(path.join(tmp, 'downloads/quartermaster.html'), 'utf8').includes('beacon.min.js'));
  });
  check('disabled build removes previously generated manual loaders', () => {
    buildSite(tmp, token, 'disabled');
    assert.ok(!fs.readFileSync(path.join(tmp, 'index.html'), 'utf8').includes('beacon.min.js'));
  });
} finally { fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(`${checks} site-build regression groups passed`);
