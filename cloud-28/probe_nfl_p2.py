#!/usr/bin/env python3
import json,urllib.request,urllib.parse,urllib.error
ROOT="https://man-cave-28-page.broncos5523.workers.dev"
probes={
"league-leaders-site":"https://site.api.espn.com/apis/site/v3/sports/football/nfl/leaders?season=2026&seasontype=2",
"league-leaders-web":"https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byathlete?season=2026&seasontype=2&limit=100",
"team-stats-web":"https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byteam?season=2026&seasontype=2&limit=100",
"team-stats-site":"https://site.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byteam?season=2026&seasontype=2&limit=100",
"denver-team-stats":"https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/7/statistics?season=2026",
"league-leaders-alt":"https://site.api.espn.com/apis/site/v2/sports/football/nfl/leaders?season=2026&seasontype=2"
}
def shape(d,depth=0):
    if depth>4:return type(d).__name__
    if isinstance(d,dict):return {k:shape(v,depth+1) for k,v in list(d.items())[:19]}
    if isinstance(d,list):return {"length":len(d),"first":shape(d[0],depth+1) if d else None}
    if isinstance(d,str):return d[:75] if depth<=2 else 'str'
    return d
for name,url in probes.items():
    for place,source in (('direct',url),('cloudflare',ROOT+'/proxy?url='+urllib.parse.quote(url,safe=''))):
        try:
            request=urllib.request.Request(source,headers={"Accept":"application/json","User-Agent":"ManCavePublicSportsDiagnostic/1.0"})
            with urllib.request.urlopen(request,timeout=14) as r:
                b=r.read(3500000);d=json.loads(b);code=r.status
            print('NFL_P2_SOURCE',name,place,'HTTP',code,'BYTES',len(b),'KEYS',list(d)[:23] if isinstance(d,dict) else type(d).__name__,
                  'SHAPE',json.dumps(shape(d))[:2700],flush=True)
            for key in ('categories','leaders','athletes','statistics','teams'):
                if isinstance(d,dict) and isinstance(d.get(key),list) and d[key]:
                    print('NFL_P2_FIRST',name,place,key,json.dumps(d[key][0])[:1700],flush=True)
        except urllib.error.HTTPError as e:
            print('NFL_P2_FAIL',name,place,e.code,e.read(150).decode(errors='replace')[:150],flush=True)
        except Exception as e:
            print('NFL_P2_FAIL',name,place,type(e).__name__,str(e)[:150],flush=True)
