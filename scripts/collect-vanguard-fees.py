"""Research-only extraction of issuer fact sheets; never run by app builds.

Uses the fund IDs from the previously downloaded issuer directory.
Fact-sheet observations remain candidates until date/label and share-class review.
"""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import re
import urllib.request
from pypdf import PdfReader

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path('/tmp/quartermaster-vanguard-audit')


def collect(record):
    ticker = record['symbol']
    fund_id = record['identitySource'].rsplit('/', 1)[-1]
    url = 'https://workplace.vanguard.com/assets/corp/fund_communications/pdf_publish/us-products/fact-sheet/F' + fund_id + '.pdf'
    target = CACHE / (ticker + '.pdf')
    result = {'source': url, 'retrievedOn': datetime.date.today().isoformat(), 'status': 'needs-review'}
    try:
        if not target.exists():
            request = urllib.request.Request(url, headers={'User-Agent': 'Quartermaster-public-data-audit/1.0'})
            with urllib.request.urlopen(request, timeout=35) as response:
                target.write_bytes(response.read())
        reader = PdfReader(target)
        text = '\n'.join(page.extract_text() for page in reader.pages)
        (CACHE / (ticker + '.txt')).write_text(text)
        result['sourceSHA256'] = hashlib.sha256(target.read_bytes()).hexdigest()
        result['identityMatched'] = bool(re.search(r'\b' + re.escape(ticker) + r'\b', text))
        # Limit to fund-facts block so performance returns cannot become expenses.
        section = re.search(r'Fund facts(.*?)Investment objective', text, re.S)
        if section:
            block = section[1]
            result['fundFacts'] = ' '.join(block.split())
            fee = re.search(r'Expense ratio\s+as of\s+(\d{2}/\d{2}/\d{2})', block)
            # Extract only when the total-assets value immediately precedes the expense percent.
            value = re.search(r'\$[\d,]+\s*MM\s+(\d+(?:\.\d+)?)\s*%', block)
            if fee and value and result['identityMatched']:
                result.update(expenseRatioPct=float(value[1]), asOf=datetime.datetime.strptime(fee[1], '%m/%d/%y').date().isoformat(), status='candidate')
        else:
            quick = re.search(r'Quick facts(.*?)Trading information', text, re.S)
            if quick:
                value = re.search(r'Expense ratio\s*\d?\s+(\d+(?:\.\d+)?)%', quick[1])
                doc_date = re.search(r'As of ([A-Z][a-z]+ \d{1,2}, \d{4})', text)
                result['fundFacts'] = ' '.join(quick[1].split())
                if value and doc_date and result['identityMatched']:
                    result.update(expenseRatioPct=float(value[1]), asOf=None,
                                  documentDate=datetime.datetime.strptime(doc_date[1], '%B %d, %Y').date().isoformat(),
                                  status='candidate', note='Fact-sheet expense ratio; document date is not a fee-effective date.')
        return ticker, result
    except Exception as error:
        result.update(status='unavailable', error=str(error))
        return ticker, result


if __name__ == '__main__':
    CACHE.mkdir(exist_ok=True)
    records = json.loads((ROOT / 'data/instruments.json').read_text())['instruments']
    records = [r for r in records if r.get('identitySource', '').startswith('https://workplace.vanguard.com/investments/product-details/fund/')]
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        entries = dict(pool.map(collect, records))
    (ROOT / 'data/research/vanguard-fact-sheets.json').write_text(json.dumps({'schemaVersion': 1, 'status': 'research-only', 'entries': entries}, indent=2) + '\n')
    from collections import Counter
    print(dict(Counter(e['status'] for e in entries.values())))
