"""Current ESPN 2026-27 Draft Watch per-game stats, no last-season fallback."""
from datetime import datetime,timezone
from urllib.request import Request,urlopen
import json,threading,time
_LOCK=threading.Lock()
_CACHE=None
_TS=0
PLAYER_ID='5142731'
TEAM_ID='2305'
def season():
    now=datetime.now(timezone.utc)
    return now.year+1 if now.month>=10 else now.year
def read(url):
    with urlopen(Request(url,headers={'User-Agent':'ManCaveSportsBook-v8l','Accept':'application/json'}),timeout=12) as r:
        return json.load(r)
def fetch():
    year=season()
    url=f'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/teams/{TEAM_ID}/roster?season={year}'
    team=read(url)
    if not any(str(p.get('id'))==PLAYER_ID and p.get('displayName','').lower()=='tyran stokes' for p in team.get('athletes',[])):
        raise RuntimeError('Tyran Stokes not on current Kansas roster')
    url=f'https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/{year}/types/2/athletes/{PLAYER_ID}/statistics/0?lang=en&region=us'
    data=read(url)
    values={s['name']:s.get('value') for c in data.get('splits',{}).get('categories',[]) for s in c.get('stats',[]) if s.get('name')}
    gp=int(float(values.get('gamesPlayed') or 0))
    keys={'PPG':'avgPoints','RPG':'avgRebounds','APG':'avgAssists'}
    stats={k:(round(float(values[v]),1) if gp>0 and values.get(v) is not None else None) for k,v in keys.items()}
    if gp<1 or any(v is None for v in stats.values()):
        raise RuntimeError('ESPN has not published current-season stats')
    return {'source':'ESPN','season':year,'seasonLabel':str(year-1)+'–'+str(year)[-2:],
        'playerId':PLAYER_ID,'name':'Tyran Stokes','team':'Kansas Jayhawks',
        'gamesPlayed':gp,'stats':stats,'dataState':'current',
        'fetchedAt':datetime.now(timezone.utc).isoformat()}
def cached():
    global _CACHE,_TS
    if _CACHE and time.monotonic()-_TS<105:return _CACHE
    with _LOCK:
        if _CACHE and time.monotonic()-_TS<105:return _CACHE
        try:
            data=fetch()
            _CACHE=data;_TS=time.monotonic()
            return data
        except Exception:
            if _CACHE and _CACHE['season']==season():
                return dict(_CACHE,dataState='delayed')
            raise
