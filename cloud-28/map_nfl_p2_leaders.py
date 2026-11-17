#!/usr/bin/env python3
import json,urllib.request,sys,re
sys.path.insert(0,'cloud-28')
import low_bandwidth_server as low
base="https://site.api.espn.com"
urls={
"league":base+"/apis/site/v3/sports/football/nfl/leaders?season=2026&seasontype=2",
"team":base+"/apis/common/v3/sports/football/nfl/statistics/byteam?season=2026&seasontype=2&limit=100"
}
for name,url in urls.items():
    with urllib.request.urlopen(urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'ManCaveContractAudit/1.0'}),timeout=16) as r:d=json.load(r)
    season=d.get('requestedSeason',{})
    print('SEASON',name,season.get('year'),season.get('type',{}).get('type'),flush=True)
    if name=='league':
        for cat in d['leaders']['categories']:
            leaders=cat.get('leaders',[])
            print('LEAGUE_CAT',cat.get('name'),cat.get('displayName'),'ABBR',cat.get('abbreviation'),'COUNT',len(leaders),'FIRST',json.dumps(leaders[0] if leaders else {})[:2400],flush=True)
    else:
        print('TEAM_CATEGORIES',json.dumps([{'name':c.get('name'),'statNames':c.get('names')} for c in d.get('categories',[])])[:6800],flush=True)
        for first in d.get('teams',[])[:2]:
            print('TEAM_ROW',first['team']['displayName'],json.dumps([{
                'name':c.get('name'),'values':c.get('values',[])[:10],
                'totals':c.get('totals',[])[:10],'ranks':c.get('ranks',[])[:10]
            } for c in first.get('categories',[])])[:5800],flush=True)
# Exact approved Page 2 card labels, not guesses.
p=low.approved.original.GOLD/'remote/page2_nfl'
if p.exists():
    s=p.read_text(errors='replace')
    s=re.sub(r'data:image/[^\s"\x27]+','[image]',s)
    for expr in [r'<[^>]+class="[^"]*leader-kicker[^"]*"[^>]*>[^<]{1,80}',
                 r'<[^>]+class="[^"]*team-cat[^"]*"[^>]*>[^<]{1,80}',
                 r'<[^>]+class="[^"]*tlabel[^"]*"[^>]*>[^<]{1,80}']:
        print('HTML_MATCH',expr,re.findall(expr,s,re.I)[:16],flush=True)
else:print('APPROVED_REMOTE_IS_DIRECTORY_OR_VIRTUAL',flush=True)
