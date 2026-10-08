"""Optional exact-CUSIP fee-gap verification after collect-issuer-directories.py."""
import importlib.util,pathlib,json,concurrent.futures,datetime
ROOT=pathlib.Path(__file__).resolve().parent.parent;p=ROOT/'data/research/issuer-directory-expansion.json';d=json.loads(p.read_text())
s=importlib.util.spec_from_file_location('f',ROOT/'scripts/collect-fidelity-fees.py');f=importlib.util.module_from_spec(s);s.loader.exec_module(f);f.CACHE=pathlib.Path('/tmp/qm-issuer-expansion')/('fidelity-gaps-'+d['retrievedOn']);f.CACHE.mkdir(exist_ok=True)
items=[(t,r['cusip']) for t,r in d['entries'].items() if r['issuer']=='Fidelity' and 'fee' not in r and r.get('cusip')]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for t,r in pool.map(f.collect,items):
  d['entries'][t]['verification']=r
  if r.get('status')=='candidate':d['entries'][t]['fee']={k:r[k] for k in ['grossPct','netPct','grossPctAsOf','netPctAsOf'] if r.get(k) is not None}
  print(t,r['status'],flush=True)
p.write_text(json.dumps(d,indent=2)+'\n')
