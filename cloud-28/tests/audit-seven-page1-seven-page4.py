"""Read-only audit of all 7 Page 1 sources and all 7 Page 4 delivery types.

No writes, no auth, no controller commands. Samples just the existing public
Worker routes, public GitHub ESPN season cache, and declared HTML JS resources.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from urllib.request import urlopen, Request
from urllib.error import HTTPError
import json
import re
import time

HOST="https://man-cave-28-page.broncos5523.workers.dev"
CACHE="https://raw.githubusercontent.com/Broncos5523/Man-Cave-28-page-/cloudflare-live-data/espn-core-season-cache.json"
page1=['page1_nfl','page1_nba','page1_nhl','page1_mlb','page1_wnba','page1_cfb','page1_cbb']
page4=['page4_broncos','page4_celtics','page4_bruins','page4_redsox','page4_fever','page4_arizona_cfb','page4_arizona_cbb']
probes=[(b,'/api/board/'+b,'boardApi') for b in page1]
probes += [(b,'/production/api/page4-live?board='+b,'page4Live') for b in ['page4_celtics','page4_fever','page4_arizona_cbb']]
probes += [(b,'/staging/boards/'+b,'staticBoard') for b in page4]
probes += [('season-cache',CACHE,'seasonCache')]
def one(item):
  board,path,kind=item
  url=path if kind=='seasonCache' else HOST+path
  if kind in ('boardApi','page4Live'):url+=('&' if '?' in url else '?')+'audit=read-only-20261122'
  req=Request(url,headers={
    'Accept':'application/json, text/html;q=0.8',
    'User-Agent':'ManCavePublicDataAudit/1.0',
    'Cache-Control':'no-cache'})
  try:
    with urlopen(req,timeout=30) as res:
      code=res.status
      raw=res.read((4 if kind=='seasonCache' else 3)*1024*1024+1)
      headers=res.headers
  except HTTPError as e:
    code=e.code
    headers=e.headers
    raw=e.read(2000)
  except Exception as e:
    return dict(board=board,kind=kind,http='network-error',exception=type(e).__name__,detail=str(e)[:130])
  out={'board':board,'kind':kind,'http':code,'bytes':len(raw),
    'sourceHeader':headers.get('X-Man-Cave-Data-Source',''),
    'cacheHeader':headers.get('Cache-Control',''),
    'age':headers.get('Age',''),
    'contract':headers.get('X-Man-Cave-Contract','')}
  if kind=='staticBoard':
    src=raw.decode('utf-8','replace')
    out['hasFetchShim']='/staging/espn-fetch-shim.js' in src
    out['hasLivePage4Adapter']='/production/live-page4-basketball.js' in src
    out['staticSampleYears']=sorted(set(re.findall(r'\b20(?:25|26|27)\b',src)))[:4]
    out['scriptSrcs']=re.findall(r'<script[^>]+src=["\']([^"\']+)',src,re.I)[:15]
    return out
  if len(raw)>4*1024*1024:
    out['error']='JSON oversized'
    return out
  try:data=json.loads(raw)
  except Exception:
    out['error']='non-json-response'
    return out
  if kind=='seasonCache':
    stamp=data.get('generatedAt')
    age=(datetime.now(timezone.utc)-datetime.fromisoformat(stamp.replace('Z','+00:00'))).total_seconds() if stamp else None
    out.update(generatedAt=stamp,ageSeconds=int(age) if age is not None else None,
       entries=len(data.get('entries',{})),seasons=data.get('seasons',{}),schema=data.get('schema'))
    return out
  if not isinstance(data,dict):
    out['error']='JSON shape not object'
    return out
  out.update(
    ok=data.get('ok'),error=data.get('error'),detail=str(data.get('detail',''))[:180],
    dataState=data.get('dataState'),
    context=data.get('context'),
    fetchedAt=data.get('fetchedAt'),
    updatedAt=data.get('updatedAt'),
    season=data.get('season'),
    seasonLabel=data.get('seasonLabel'),
    verifiedPlayers=data.get('verifiedPlayers'),
    sourceCount=len(data.get('sources',[])),
    standingsCount=sum(len(g.get('entries',[])) for g in data.get('standings',{}).get('groups',[])),
    tickerCount=len(data.get('ticker',{}).get('selected',[])),
    leadersCount=len(data.get('leaders',[])) if isinstance(data.get('leaders'),list) else 0)
  return out

print('FRESHNESS_AUDIT_CLOCK',datetime.now(timezone.utc).isoformat(),flush=True)
with ThreadPoolExecutor(max_workers=4) as executor:
  results=list(executor.map(one,probes))
for row in results:
  print('PAGE1_PAGE4_FRESHNESS',json.dumps(row,sort_keys=True),flush=True)
page1ok=sum(r['http']==200 and r.get('dataState')=='current' for r in results if r['kind']=='boardApi')
page4ok=sum(r['http']==200 and r.get('dataState')=='current' for r in results if r['kind']=='page4Live')
print('FRESHNESS_SUMMARY',json.dumps(dict(page1Current=page1ok,page1Total=7,
 page4BasketballCurrent=page4ok,page4BasketballTotal=3,
 otherPage4NeedBrowserInspection=4,checkedAt=datetime.now(timezone.utc).isoformat())),flush=True)
