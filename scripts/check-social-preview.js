/* Read-only live check. Does not submit a URL to X or post anything. */
const assert = require('node:assert/strict');
async function checkSocialPreview(address = 'https://realallocation.com/') {
  const pageURL = new URL(address);
  assert.ok(['http:', 'https:'].includes(pageURL.protocol), 'Use an HTTP(S) URL');
  const request = url => fetch(url, { headers: { 'User-Agent': 'Twitterbot/1.0' }, signal: AbortSignal.timeout(20000) });
  const page = await request(pageURL);
  assert.equal(page.status, 200, `Page returned HTTP ${page.status}`);
  const html = await page.text();
  const tags = {};
  for (const tag of html.matchAll(/<meta\b[^>]*>/gi)) {
    const key = tag[0].match(/(?:name|property)="([^"]+)"/i)?.[1];
    const value = tag[0].match(/content="([^"]*)"/i)?.[1];
    if (key) tags[key] = value;
  }
  assert.equal(tags['twitter:card'], 'summary_large_image', 'Missing large-image X card');
  assert.ok(tags['twitter:title'] && tags['twitter:description'], 'Missing title/description');
  assert.ok(tags['twitter:image']?.startsWith('https://'), 'Image must have an absolute HTTPS URL');
  const image = await request(tags['twitter:image']);
  assert.equal(image.status, 200, `Image returned HTTP ${image.status}`);
  assert.match(image.headers.get('content-type') || '', /^image\/png/);
  const bytes = Buffer.from(await image.arrayBuffer());
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'Invalid PNG');
  assert.ok(bytes.length < 5 * 1024 * 1024, 'Image exceeds 5 MB');
  const robots = await request(new URL('/robots.txt', pageURL));
  return { page: page.url, pageStatus: page.status, image: image.url, imageStatus: image.status,
    imageBytes: bytes.length, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20),
    robotsStatus: robots.status, robotsText: await robots.text(),
    limitation: 'This checks responses from this machine using the Twitterbot user agent. It cannot verify X cache state, actual X crawler IP access, or whether the X interface displays a card.' };
}
if (require.main === module) checkSocialPreview(process.argv[2]).then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { checkSocialPreview };
