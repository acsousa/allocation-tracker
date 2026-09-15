const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { buildSite, analyticsMarkup } = require('../scripts/build-site');
const pages = ['pricing.html', 'privacy.html'];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'quartermaster-site-'));
let checks = 0;
function check(name, fn) { fn(); checks++; console.log('✓ ' + name); }
try {
  check('automatic mode leaves beacon injection to Cloudflare', () => {
    const result = buildSite(tmp, '', 'automatic');
    assert.equal(result.analyticsMode, 'automatic');
    assert.ok(!fs.readFileSync(path.join(tmp, 'index.html'), 'utf8').includes('beacon.min.js'));
    const headers = fs.readFileSync(path.join(tmp, '_headers'), 'utf8');
    assert.ok(!headers.split('/downloads/*')[0].includes('no-transform'));
    assert.ok(headers.split('/downloads/*')[1].includes('no-transform'));
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
  check('pricing uses direct email drafts and no interest routes', () => {
    const html = fs.readFileSync(path.join(tmp, 'pricing.html'), 'utf8');
    assert.match(html, /Get more information/);
    assert.match(html, /mailto:hello@realallocation.com\?subject=/);
    assert.ok(!html.includes('interest/'));
    assert.ok(!html.includes('<form'));
    assert.ok(!fs.existsSync(path.join(tmp, 'interest')));
  });
  check('root pricing is self-contained and available without a build', () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'pricing.html'), 'utf8');
    assert.match(html, /<style>/);
    assert.ok(!html.includes('rel="stylesheet"'));
    assert.match(html, /allocation-tracker.html/);
  });
  check('standalone download contains no beacon and blocks network execution', () => {
    const html = fs.readFileSync(path.join(tmp, 'downloads/quartermaster.html'), 'utf8');
    assert.ok(!html.includes('beacon.min.js'));
    assert.match(html, /http-equiv="Content-Security-Policy"/);
    assert.match(html, /connect-src 'none'; script-src 'unsafe-inline'/);
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
    for (const name of ['index.html', 'pricing.html', 'privacy.html']) {
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
