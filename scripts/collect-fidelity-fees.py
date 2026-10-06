"""Research-only public Fidelity fund fee collector. No portfolio or account data.

Usage: python3 scripts/collect-fidelity-fees.py <downloaded Fidelity overview HTML>
Requires exact issuer-listed CUSIP/ticker links; does not search user holdings.
"""
import concurrent.futures
import datetime
import hashlib
import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = pathlib.Path('/tmp/quartermaster-fidelity-audit')


def collect(item):
    ticker, cusip = item
    url = 'https://fundresearch.fidelity.com/mutual-funds/api/v1/investments/' + cusip + '/summary?funduniverse=retail&documentId=' + cusip
    file = CACHE / (ticker + '.json')
    result = {'source': url, 'cusip': cusip, 'retrievedOn': datetime.date.today().isoformat(), 'status': 'needs-review'}
    try:
        if not file.exists():
            with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': 'Quartermaster-public-data-audit/1.0'}), timeout=30) as response:
                file.write_bytes(response.read())
        raw = file.read_bytes()
        data = json.loads(raw)
        identity = data['fundInformation']['subjectAreaData']
        if identity.get('cusip') != cusip or identity.get('tradingSymbol') != ticker or identity.get('fundFamily') != 'Fidelity Investments':
            raise ValueError('Issuer, ticker, or share-class identity mismatch')
        result['identityMatched'] = True
        details = data['details']['subjectAreaData']
        result['sourceSHA256'] = hashlib.sha256(raw).hexdigest()
        for key, output in [('grossExpenseRatio', 'grossPct'), ('netExpenseRatio', 'netPct')]:
            field = details.get(key, {})
            value = field.get('amount')
            result[output] = float(value) if value is not None else None
            result[output + 'AsOf'] = (datetime.datetime.strptime(field['asOfDate'], '%m/%d/%Y').date().isoformat() if field.get('asOfDate') else None)
        result['status'] = 'candidate'
        result['note'] = 'Issuer overview matches ticker to CUSIP. Prospectus gross/net expense fields used; historical annual expense fields excluded.'
        result['identitySource'] = 'https://www.fidelity.com/mutual-funds/fidelity-funds/overview'
        return ticker, result
    except Exception as error:
        result.update(status='unavailable', error=str(error))
        return ticker, result


if __name__ == '__main__':
    CACHE.mkdir(exist_ok=True)
    html = pathlib.Path(sys.argv[1]).read_text()
    universe = set(json.loads((ROOT / 'data/instrument-audit.json').read_text())['fundUniverse'])
    identities = {ticker: cusip for cusip, ticker in re.findall(r'href="https://fundresearch.fidelity.com/mutual-funds/summary/([A-Z0-9]{9})">([A-Z]{5})</a>', html) if ticker in universe}
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        entries = dict(pool.map(collect, identities.items()))
    (ROOT / 'data/research/fidelity-fee-observations.json').write_text(json.dumps({'schemaVersion': 1, 'status': 'research-only', 'entries': entries}, indent=2) + '\n')
    from collections import Counter
    print(dict(Counter(e['status'] for e in entries.values())))
