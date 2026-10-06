"""Research only. Verify staged iShares screener fees against each issuer product page.

Run explicitly with network access; never called by builds or the browser.
Preserves unknowns and disagreements. Cached HTML is kept outside the repository.
"""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import re
import sys
import urllib.request
from html.parser import HTMLParser

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path('/tmp/quartermaster-issuer-audit')


class Product(HTMLParser):
    def __init__(self):
        super().__init__()
        self.fees = None
        self.ticker = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        props = attrs.get('componentprops')
        if not props:
            return
        try:
            data = json.loads(props)
        except ValueError:
            return
        if attrs.get('componentkey') == 'FeeTableV3':
            self.fees = data.get('feeDataPoints')


def verify(item):
    symbol, candidate = item
    url = candidate['source']
    if not url.startswith('https://www.ishares.com/us/products/'):
        return symbol, None
    path = CACHE / (symbol + '.html')
    try:
        if not path.exists():
            req = urllib.request.Request(url, headers={'User-Agent': 'Quartermaster-public-data-audit/1.0'})
            with urllib.request.urlopen(req, timeout=40) as response:
                raw = response.read()
            path.write_bytes(raw)
        raw = path.read_bytes()
        text = raw.decode('utf-8')
        parser = Product()
        parser.feed(text)
        # Check the ticker in the issuer's structured identity, not an incidental mention.
        identities = []
        for block in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', text, re.S):
            graph = json.loads(block)
            for entry in graph.get('@graph', []):
                for identifier in entry.get('identifier', []) if isinstance(entry.get('identifier'), list) else []:
                    if identifier.get('propertyID') == 'ticker':
                        identities.append(identifier.get('value'))
        fees = parser.fees or {}
        evidence = {key: {'label': value.get('label'), 'value': value.get('formattedValue')}
                    for key, value in fees.items()}
        ratio = fees.get('expr', {}).get('formattedValue', '')
        match = re.fullmatch(r'(\d+(?:\.\d+)?)%', ratio)
        gross = float(match[1]) if match else None
        net_raw = next((v.get('formattedValue', '') for v in fees.values()
                        if v.get('label') == 'Net Expense Ratio'), None)
        net_match = re.fullmatch(r'(\d+(?:\.\d+)?)%', net_raw or '')
        net = float(net_match[1]) if net_match else None
        # With equal screener gross/net, independently confirm the published total.
        # Do not infer a waived net fee from gross when the screener differs.
        matched = (symbol in identities and gross == candidate['grossPct'] and
                   (net == candidate['netPct'] if net is not None else
                    candidate['netPct'] == candidate['grossPct']))
        return symbol, {'checkedOn': datetime.date.today().isoformat(),
                        'retrievedOn': datetime.datetime.fromtimestamp(path.stat().st_mtime).date().isoformat(),
                        'source': url, 'comparedGrossPct': candidate['grossPct'],
                        'comparedNetPct': candidate['netPct'],
                        'sourceSHA256': hashlib.sha256(raw).hexdigest(),
                        'identityMatched': symbol in identities,
                        'status': 'matched' if matched else 'needs-review',
                        'feeTable': evidence,
                        'note': 'Product-page comparison with issuer screener. Fiscal year-end is not a fee-effective date.'}
    except Exception as error:
        return symbol, {'status': 'unavailable', 'error': str(error)}


if __name__ == '__main__':
    CACHE.mkdir(exist_ok=True)
    data = json.loads((ROOT / 'data/research/issuer-fee-candidates.json').read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        results = dict((symbol, value) for symbol, value in pool.map(verify, data['entries'].items()) if value)
    output = {'schemaVersion': 1, 'purpose': 'research-only; not a declaration of full fee coverage', 'entries': results}
    (ROOT / 'data/research/ishares-product-verification.json').write_text(json.dumps(output, indent=2) + '\n')
    from collections import Counter
    print(dict(Counter(v['status'] for v in results.values())))
