"""ESPN current-season stats for locked Page 4 NBA and CBB.
Use the approved spotlight roster. Never substitute previous-season stats.
"""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from urllib.request import Request, urlopen
import json, threading, time

TEAMS={'page4_celtics':('nba','2'),'page4_arizona_cbb':('mens-college-basketball','12')}
FIELDS={'PTS':'avgPoints','REB':'avgRebounds','AST':'avgAssists','STL':'avgSteals','BLK':'avgBlocks','3PM':'avgThreePointFieldGoalsMade'}
LEADERS=[('avgPoints','POINTS','PPG'),('avgRebounds','REBOUNDS','RPG'),('avgAssists','ASSISTS','APG'),('avgSteals','STEALS','SPG'),('avgBlocks','BLOCKS','BPG'),('avgThreePointFieldGoalsMade','3-POINTERS','3PM/G')]
_CACHE={}
_LOCKS={key:threading.Lock() for key in TEAMS}

def season_year():
    now=datetime.now(timezone.utc)
    return now.year+1 if now.month>=10 else now.year

def get_json(url,timeout=10):
    with urlopen(Request(url,headers={'User-Agent':'ManCaveSportsBook-v8l','Accept':'application/json'}),timeout=timeout) as res:
        return json.load(res)

def fetch_athlete(player,league,season):
    pid=str(player['id'])
    url=f'https://sports.core.api.espn.com/v2/sports/basketball/leagues/{league}/seasons/{season}/types/2/athletes/{pid}/statistics/0?lang=en&region=us'
    try:
        d=get_json(url)
        values={stat['name']:stat.get('value') for section in d.get('splits',{}).get('categories',[]) for stat in section.get('stats',[]) if stat.get('name')}
        gp=int(float(values.get('gamesPlayed') or 0))
        player['gamesPlayed']=max(0,gp)
        player['stats']={label:(float(values[key]) if gp>0 and values.get(key) is not None else None) for label,key in FIELDS.items()}
    except Exception:
        player['gamesPlayed']=0
        player['stats']={label:None for label in FIELDS}
    return player

def build(board):
    if board not in TEAMS:raise ValueError('Unrecognized Page 4 board')
    league,team=TEAMS[board];season=season_year()
    url=f'https://site.api.espn.com/apis/site/v2/sports/basketball/{league}/teams/{team}/roster?season={season}'
    d=get_json(url)
    roster=d.get('athletes') or []
    if not isinstance(roster,list) or len(roster)<10:raise RuntimeError('Current team roster unavailable')
    players=[]
    for athlete in roster:
        if not athlete.get('id') or not athlete.get('displayName'):continue
        position=athlete.get('position') or {}
        shot=athlete.get('headshot') or {}
        players.append({'id':str(athlete['id']),'name':athlete['displayName'],
            'pos':position.get('abbreviation','') if isinstance(position,dict) else '',
            'headshot':shot.get('href','') if isinstance(shot,dict) else '',
            'gamesPlayed':0,'stats':{}})
    with ThreadPoolExecutor(max_workers=10) as pool:
        tasks={pool.submit(fetch_athlete,p,league,season):p['id'] for p in players}
        found={tasks[f]:f.result() for f in as_completed(tasks)}
    players=[found[p['id']] for p in players]
    current=[p for p in players if p['gamesPlayed']>0]
    if len(current)<3:raise RuntimeError('Insufficient verified 2026-27 appearances')
    leaders=[]
    for key,cat,unit in LEADERS:
        label=next(k for k,v in FIELDS.items() if v==key)
        eligible=[p for p in current if p['stats'].get(label) is not None]
        winner=max(eligible,key=lambda p:p['stats'][label]) if eligible else None
        leaders.append({'key':key,'cat':cat,'unit':unit,
            'id':winner['id'] if winner else '',
            'name':winner['name'] if winner else 'NOT AVAILABLE',
            'pos':winner['pos'] if winner else '',
            'value':f"{winner['stats'][label]:.1f}" if winner else '—'})
    return {'board':board,'season':season,'seasonLabel':f'{season-1}–{str(season)[-2:]}',
        'updatedAt':datetime.now(timezone.utc).isoformat(),'roster':players,
        'leaders':leaders,'verifiedPlayers':len(current),'dataState':'current'}

def cached(board,ttl=105):
    if board not in TEAMS:raise ValueError('Unrecognized Page 4 board')
    prev=_CACHE.get(board)
    if prev and time.monotonic()-prev[0]<ttl:return prev[1]
    with _LOCKS[board]:
        prev=_CACHE.get(board)
        if prev and time.monotonic()-prev[0]<ttl:return prev[1]
        try:
            value=build(board)
            _CACHE[board]=(time.monotonic(),value)
            return value
        except Exception as e:
            if prev:
                result=dict(prev[1]);result['dataState']='delayed';result['warning']=str(e)
                return result
            raise
