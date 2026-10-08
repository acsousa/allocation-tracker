"""Parse downloaded PUBLIC issuer directories; no live runtime fetch or portfolio input.
Usage: python3 scripts/collect-issuer-directories.py /path/to/downloads YYYY-MM-DD
Raw response hashes and source cells are retained for audit; unknown fees stay unknown.
"""
import sys,json,re,html,hashlib,pathlib,collections
BASE=pathlib.Path(sys.argv[1]);DATE=sys.argv[2];ROOT=pathlib.Path(__file__).resolve().parent.parent
VG='https://investor.vanguard.com/investment-products/list/funddetail/all'
FD='https://institutional.fidelity.com'
entries={};sources=[];conflicts=[]
def clean(s):return ' '.join(html.unescape(re.sub('<[^>]*>',' ',s)).split())
def read(name,url):
 raw=(BASE/name).read_bytes();sources.append({'file':name,'url':url,'retrievedOn':DATE,'sha256':hashlib.sha256(raw).hexdigest()});return raw.decode('utf-8-sig')
def add(t,row):
 if not re.fullmatch('[A-Z]{2,5}',t):raise ValueError('Not a public ticker: '+t)
 old=entries.get(t)
 if old:
  if old.get('cusip') and row.get('cusip') and old['cusip']!=row['cusip']:raise ValueError('CUSIP collision '+t)
  if old.get('fee') and row.get('fee') and old['fee']!=row['fee']:conflicts.append({'symbol':t,'prior':old['fee'],'next':row['fee']})
  old['directories']=sorted(set(old['directories']+[row['directory']]))
  return
 row['directories']=[row['directory']];entries[t]=row
v=json.loads(read('vanguard.json',VG));assert v['size']==len(v['fund']['entity'])
for e in v['fund']['entity']:
 p=e['profile'];t=p['ticker'];assert p['isInternalFund'] and (p['isETF'] or p['isMutualFund'])
 add(t,{'issuer':'Vanguard','name':p['longName'],'cusip':p['cusip'],'kind':'etf' if p['isETF'] else 'mutual-fund','directory':'Vanguard investor','source':VG,'productSource':f"https://investor.vanguard.com/investment-products/{'etfs' if p['isETF'] else 'mutual-funds'}/profile/{t}",'category':p['customizedStyle'],'flags':{k:b for k,b in p['fundFact'].items() if b},'fee':{'expenseRatioPct':float(p['expenseRatio']),'asOf':p['expenseRatioAsOfDate'][:10]},'sourceFields':{'expenseRatio':p['expenseRatio'],'expenseRatioAsOfDate':p['expenseRatioAsOfDate']}})
# Workplace directory includes restricted legacy share classes not in the retail screener.
url='https://workplace.vanguard.com/fund-list/'
s=read('vanguard-workplace.html',url);work=[]
def walk(x):
 if isinstance(x,dict):
  if x.get('tickerSymbol'):work.append(x)
  for v in x.values():walk(v)
 elif isinstance(x,list):
  for v in x:walk(v)
for raw in re.findall(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>',s,re.S):walk(json.loads(raw))
excluded=[]
for x in work:
 t=x['tickerSymbol']
 if not re.fullmatch('[A-Z]{2,5}',t):excluded.append({'symbol':t,'name':x['name'],'reason':'non-public-ticker trust/plan identifier'});continue
 add(t,{'issuer':'Vanguard','name':x['name'],'kind':'etf' if 'ETF' in x['name'] else 'mutual-fund','directory':'Vanguard workplace','source':url,'productSource':x['url'],'category':x['description']})
# Server-rendered Fidelity tables identify fee cells by ID, not column position.
for path in sorted(BASE.glob('fidelity-*.html')):
 n=path.name
 if n not in ['fidelity-all.html','fidelity-advisor.html','fidelity-money.html'] and not re.fullmatch('fidelity-advisor-[0-9]+.html',n):continue
 if n=='fidelity-all.html':url=FD+'/app/tabbed/avgannualreturns/FIIS_PP_SP34_DPL6_AVG.html?navId=324&productLineId=6&tab=avgannualreturns'
 elif n=='fidelity-money.html':url=FD+'/app/tabbed/dailypricing/FIIS_PP_SP28_DPL3.html?tab=dailypricing&productLineId=3&navId=325&previousDay=true'
 else:
  cls=re.search(r'-(\d+)\.html',n);cls=cls[1] if cls else '10'
  url=FD+f'/app/tabbed/avgannualreturns/FIIS_PP_SP34_DPL2_AVG.html?assetClassID=0&navId=320&productLineId=2&shareClassId={cls}SC&tab=avgannualreturns'
 s=read(n,url);count=0
 for tr in re.findall(r'<tr\b[^>]*>(.*?)</tr>',s,re.S):
  q=re.search(r'<quick-view\b[^>]*fund-no="([^"]+)"[^>]*fund-symbol="([^"]+)"',tr)
  if not q:continue
  id,t=q.groups();name=re.search(r'<a href="(/app/fund/(?:sasid|item)/details/[^\"]+)"[^>]*>(.*?)</a>',tr,re.S);cusip=re.search(r'id="spanCusip([A-Z0-9]{9})"',tr)
  if not name or not cusip:raise ValueError('Missing fund identity '+t)
  cat=re.search(r'<td[^>]*id="tdMorningstarCat[^\"]*"[^>]*>(.*?)</td>',tr,re.S)
  er=re.search(r'<td[^>]*id="expenseRatio[^\"]*"[^>]*>(.*?)</td>',tr,re.S)
  ratio=re.findall(r'(\d+(?:\.\d+)?)\s*%',clean(er[1])) if er else []
  row={'issuer':'Fidelity','name':clean(name[2]),'cusip':cusip[1],'kind':'mutual-fund','directory':n,'source':url,'productSource':FD+name[1],'category':clean(cat[1]) if cat else ('Money Market' if n=='fidelity-money.html' else ''),'sourceFields':{'expenseRatioCell':clean(er[1]) if er else None}}
  if len(ratio)==2:row['fee']={'grossPct':float(ratio[0]),'netPct':float(ratio[1])}
  elif ratio:raise ValueError('Ambiguous gross/net cell '+t+': '+str(ratio))
  add(t,row);count+=1
 sources[-1]['rowCount']=count
 assert count==len(set(re.findall('fund-symbol="([^"]+)"',s))),n
# Retail list is an independent completeness denominator; record missing IDs for lookup.
s=read('fidelity-mutual.html','https://www.fidelity.com/mutual-funds/fidelity-funds/overview')
retail={t:c for c,t in re.findall(r'summary/([A-Z0-9]{9})">([A-Z]{5})</a>',s)}
for t,c in retail.items():
 if t in entries:continue
 # exact name immediately before its CUSIP link
 end=s.index('>'+t+'</a>');start=s.rfind('\n',0,end);name=clean(s[start:end].split('(<a')[0])
 add(t,{'issuer':'Fidelity','name':name,'cusip':c,'kind':'mutual-fund','directory':'Fidelity retail','source':sources[-1]['url'],'productSource':'https://fundresearch.fidelity.com/mutual-funds/summary/'+c,'category':''})
u=FD+'/ifcf/exchange-traded-funds';etfs=json.loads(read('fidelity-etfs.json',u));assert isinstance(etfs,list)
for x in etfs:
 t=x['tradingSymbol'];fee=float(x['netExpenseRatioPercentage']);r={'issuer':'Fidelity','name':x['legalName'],'kind':'etf','directory':'Fidelity ETFs/ETPs','source':u,'productSource':'https://digital.fidelity.com/prgw/digital/research/quote/dashboard/summary?symbol='+t,'category':x['assetClass'],'sourceFields':{'netExpenseRatioPercentage':x['netExpenseRatioPercentage']}}
 if fee>0:r['fee']={'netPct':fee}
 else:r['reviewNote']='Zero net expense in ETF feed requires prospectus/waiver confirmation; do not assume free.'
 add(t,r)
assert not conflicts,conflicts
out={'schemaVersion':1,'retrievedOn':DATE,'scope':'US public-ticker ETFs/ETPs and mutual fund share classes in the named issuer directories. Not a global issuer universe.','sources':sources,'excludedNonTicker':excluded,'entries':dict(sorted(entries.items()))}
(ROOT/'data/research/issuer-directory-expansion.json').write_text(json.dumps(out,indent=2)+'\n')
print('Issuer counts',dict(collections.Counter(r['issuer'] for r in entries.values())),'fees',sum('fee' in r for r in entries.values()),'total',len(entries),'non-ticker exclusions',len(excluded))
print('Missing fee',[(t,r['name']) for t,r in entries.items() if 'fee' not in r])
