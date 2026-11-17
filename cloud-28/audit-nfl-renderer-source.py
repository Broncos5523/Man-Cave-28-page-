#!/usr/bin/env python3
import sys,re,json,urllib.request,urllib.error
sys.path.insert(0,'cloud-28')
import low_bandwidth_server as low
root=low.approved.original.GOLD
for name in ['runtime_nfl_p1_v7j.js','runtime_nfl_p2_v7i.js']:
    lines=(root/name).read_text().splitlines()
    ranges=[(156,184),(246,279),(290,337),(629,682),(714,772),(781,815)]
    for a,b in ranges:
        if name.endswith('v7i.js') and a in (290,714):continue
        print("=== RUNTIME_BLOCK",name,a,b,flush=True)
        for i in range(a-1,min(b,len(lines))):
            print("CODE",name,i+1,lines[i][:1100],flush=True)
urls={
'scoreboard':'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=60',
'standings':'https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=2026&seasontype=2',
'standings-alt':'https://site.api.espn.com/apis/v2/sports/football/nfl/standings?season=2026&type=2',
'scoreboard-week':'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?week=11&year=2026&seasontype=2&limit=60'
}
def shape(d,depth=0):
    if depth>4:return type(d).__name__
    if isinstance(d,list):return {'len':len(d),'first':shape(d[0],depth+1) if d else None}
    if isinstance(d,dict):return {k:shape(v,depth+1) for k,v in list(d.items())[:15]}
    if isinstance(d,str):return d[:100] if depth<3 else 'str'
    return d
for name,url in urls.items():
    request=urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'ManCavePublicContractInspection/1.0'})
    try:
        with urllib.request.urlopen(request,timeout=15) as response:d=json.load(response)
        print("REMOTE_ENDPOINT",name,"keys",list(d),"shape",json.dumps(shape(d))[:9800],flush=True)
        if name.startswith('standings'):
            for parent in d.get('children',[])[:2]:
                print("REMOTE_STANDINGS_FIRST",name,json.dumps(parent)[:2600],flush=True)
        if name.startswith('scoreboard'):
            print("REMOTE_SCOREBOARD_LEAGUE",name,json.dumps((d.get('leagues') or [None])[0])[:1600],flush=True)
            print("REMOTE_SCOREBOARD_EVENT",name,json.dumps((d.get('events') or [None])[0])[:2500],flush=True)
    except Exception as e:print("REMOTE_ERROR",name,str(e)[:180],flush=True)
