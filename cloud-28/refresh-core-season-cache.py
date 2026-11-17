"""Refresh public ESPN regular-season stats where Worker egress is rejected.

Run on the existing public repository's standard GitHub runner. No credentials,
private data, generated statistics or TV commands enter this JSON dataset.
"""
import concurrent.futures,datetime,json,pathlib,re,math,urllib.request,urllib.parse
NOW=datetime.datetime.now(datetime.timezone.utc)
BASE='https://sports.core.api.espn.com/v2/sports/'
def read(url):
    with urllib.request.urlopen(urllib.request.Request(url,headers={'Accept':'application/json','User-Agent':'ManCaveSportsBook-v8l'}),timeout=14) as r:
        return json.load(r)
def athletes(data):
    found=[]
    for entry in data.get('athletes',[]):
        if entry.get('id'):found.append(entry)
        else:found.extend(entry.get('items',[]))
    return found
jobs={}
required_teams=set()
seasons={}
for sport,league,team in [('basketball','nba','2'),('basketball','wnba','5'),
                         ('basketball','mens-college-basketball','12'),('football','college-football','12')]:
    path=sport+'/'+league
    score=read('https://site.api.espn.com/apis/site/v2/sports/'+path+'/scoreboard?limit=1')
    season=(score.get('leagues') or [{}])[0].get('season') or score.get('season') or {}
    year=int(season['year']);typ=season.get('type');typ=int(typ.get('type',typ.get('id')) if isinstance(typ,dict) else typ)
    start=datetime.datetime.fromisoformat(season['startDate'].replace('Z','+00:00'))
    stats_year=year-1 if typ==1 or NOW<start else year
    seasons[league]=stats_year
    root=BASE+sport+'/leagues/'+league+'/seasons/'+str(stats_year)+'/types/2/'
    # All league teams are necessary for original NBA/WNBA advanced-stat ranks.
    if league in ('nba','wnba'):
        standings=read('https://site.api.espn.com/apis/v2/sports/'+path+'/standings?season='+str(stats_year)+'&seasontype=2')
        ids=[str(e['team']['id']) for g in standings['children'] for e in g.get('standings',{}).get('entries',[])]
        if len(set(ids))!=(30 if league=='nba' else 15):raise RuntimeError('Incomplete current league standings')
    else:ids=[team]
    for tid in ids:
        url=root+'teams/'+tid+'/statistics';jobs[url]=(stats_year,'team')
        if league in ('nba','wnba'):required_teams.add(urllib.parse.urlsplit(url).path)
    roster=read('https://site.api.espn.com/apis/site/v2/sports/'+path+'/teams/'+team+'/roster?season='+str(stats_year))
    if int(roster.get('season',{}).get('year',0))!=stats_year:raise RuntimeError('Roster year mismatch')
    for athlete in athletes(roster):
        pid=str(athlete.get('id',''))
        if pid.isdigit():jobs[root+'athletes/'+pid+'/statistics/0?lang=en&region=us']=(stats_year,'athlete')
# The locked Draft Watch must also have its exact Kansas player, season and type.
y=seasons['mens-college-basketball']
jobs[BASE+'basketball/leagues/mens-college-basketball/seasons/'+str(y)+'/types/2/athletes/5142731/statistics/0?lang=en&region=us']=(y,'athlete')
def collect(item):
    url,(year,kind)=item
    try:
        data=read(url)
        if '/seasons/'+str(year)+'?' not in str(data.get('season',{}).get('$ref','')):raise ValueError('wrong season')
        if '/seasons/'+str(year)+'/types/2?' not in str(data.get('seasonType',{}).get('$ref','')):raise ValueError('wrong season type')
        categories=data.get('splits',{}).get('categories')
        if not isinstance(categories,list):raise ValueError('no regular season categories')
        identity=urllib.parse.urlsplit(data.get('$ref','')).path.rstrip('/').removesuffix('/0')
        requested=urllib.parse.urlsplit(url).path.rstrip('/').removesuffix('/0')
        if identity!=requested:raise ValueError('wrong subject')
        # Preserve genuine numeric fields and ranks, removing redundant glossary
        # descriptions. The source values/display strings are never recomputed.
        copied=[]
        for category in categories:
            stats=[{k:v for k,v in s.items() if k in ('name','value','displayValue','rank','rankDisplayValue','percentile')}
                   for s in category.get('stats',[]) if s.get('name') and isinstance(s.get('value'),(int,float)) and math.isfinite(s['value'])]
            copied.append({'name':category.get('name',''),'stats':stats})
        compact={k:data[k] for k in ('$ref','season','seasonType','team','athlete') if k in data}
        compact['splits']={'id':data.get('splits',{}).get('id','0'),'name':'Regular Season','categories':copied}
        key=urllib.parse.urlsplit(url).path
        return key,{'sourceUrl':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'data':compact}
    except Exception as exc:
        print('SOURCE_NOT_PUBLISHED',urllib.parse.urlsplit(url).path,type(exc).__name__,str(exc)[:100],flush=True)
        return None
with concurrent.futures.ThreadPoolExecutor(max_workers=10) as pool:
    entries=dict(x for x in pool.map(collect,jobs.items()) if x)
# Preserve the Arizona native team's exact leader and seasonal identity JSON.
# These cannot be replaced with career totals or guessed player selections.
cfb_root=BASE+'football/leagues/college-football/seasons/'+str(seasons['college-football'])
leader_url=cfb_root+'/types/2/teams/12/leaders?lang=en&region=us'
try:
    leaders=read(leader_url)
    if urllib.parse.urlsplit(leaders.get('$ref','')).path!=urllib.parse.urlsplit(leader_url).path:raise ValueError('CFB leader subject mismatch')
    categories=leaders.get('categories',[])
    if not {'passingLeader','rushingLeader','receivingLeader','totalTackles','sacks','interceptions'}<=set(c.get('name') for c in categories):raise ValueError('CFB leader categories missing')
    def save_public(url,data):
        entries[urllib.parse.urlsplit(url).path]={'sourceUrl':url,'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'data':data}
    save_public(leader_url,leaders)
    refs={p['athlete']['$ref'].replace('http:','https:',1) for c in categories for p in c.get('leaders',[])[:1] if p.get('athlete',{}).get('$ref')}
    for url in refs:
        if not url.startswith(cfb_root+'/athletes/'):raise ValueError('CFB leader athlete year mismatch')
        data=read(url)
        if urllib.parse.urlsplit(data.get('$ref','')).path!=urllib.parse.urlsplit(url).path:raise ValueError('CFB athlete subject mismatch')
        if '/seasons/'+str(seasons['college-football'])+'/teams/12?' not in data.get('team',{}).get('$ref',''):raise ValueError('CFB leader team mismatch')
        save_public(url,{k:data[k] for k in ('$ref','id','displayName','position','team','jersey','headshot') if k in data})
except Exception as exc:print('CFB_TEAM_LEADERS_NOT_VERIFIED',type(exc).__name__,str(exc)[:140],flush=True)
team_count=sum('/teams/' in k for k in entries)
missing=required_teams-set(entries)
if missing:raise SystemExit('Current NBA/WNBA advanced-stat cache incomplete; refusing publication: '+str(sorted(missing)[:3]))
out=pathlib.Path('_current_data');out.mkdir(exist_ok=True)
payload={'schema':1,'generatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'seasons':seasons,'entries':entries,'note':'Verified public ESPN regular-season stats. Each entry expires after 15 minutes.'}
(out/'espn-core-season-cache.json').write_text(json.dumps(payload,separators=(',',':')),encoding='utf-8')
print('VERIFIED_PUBLIC_SEASON_CACHE',len(entries),'entries',team_count,'teams',flush=True)
