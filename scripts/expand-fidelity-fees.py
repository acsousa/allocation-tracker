"""Research-only exact-share-class Fidelity expansion. Does not touch portfolio data."""
import concurrent.futures, importlib.util, json, pathlib, re, html, sys
ROOT=pathlib.Path(__file__).resolve().parent.parent
spec=importlib.util.spec_from_file_location('collector',ROOT/'scripts/collect-fidelity-fees.py')
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
mod.CACHE.mkdir(exist_ok=True)
source=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/qm-fidelity.html').read_text()
identities={ticker:cusip for cusip,ticker in re.findall(r'href="https://fundresearch.fidelity.com/mutual-funds/summary/([A-Z0-9]{9})">([A-Z]{5})</a>',source)}
entries={}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for ticker,row in pool.map(mod.collect,identities.items()):
  if row.get('status')=='candidate':
   raw=json.loads((mod.CACHE/(ticker+'.json')).read_text())['fundInformation']['subjectAreaData']
   row['name']=html.unescape(re.sub('<[^>]+>','',raw['legalName']))
   row['issuerAssetClass']=raw.get('mstarAssetClass',{}).get('name')
   row['issuerCategory']=raw.get('mstarCategory',{}).get('name')
  if not row.get('name'):
   end=source.index('>'+ticker+'</a>'); start=source.rfind('\n',0,end)
   row['name']=html.unescape(re.sub('<[^>]+>','',source[start:end].split('(<a')[0])).strip()
   row['identitySource']='https://www.fidelity.com/mutual-funds/fidelity-funds/overview'
  entries[ticker]=row
  if len(entries)%25==0:print('Collected',len(entries),flush=True)
(ROOT/'data/research/fidelity-expanded-fees.json').write_text(json.dumps({'schemaVersion':1,'status':'issuer-observations; normalization required','entries':entries},indent=2)+'\n')
print('Candidate',sum(r['status']=='candidate' for r in entries.values()),'of',len(entries),flush=True)
