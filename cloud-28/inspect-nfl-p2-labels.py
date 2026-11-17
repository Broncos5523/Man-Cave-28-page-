#!/usr/bin/env python3
import json,urllib.request,urllib.parse,threading,time,sys
sys.path.insert(0,'cloud-28')
import low_bandwidth_server as low
server=low.ThreadingHTTPServer(('127.0.0.1',0),low.Handler)
server.daemon_threads=True;server.born=time.monotonic()
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
  with urllib.request.urlopen('http://127.0.0.1:'+str(server.server_port)+'/api/board/page2_nfl',timeout=35) as r:
    original=json.load(r)
  print('ORIGINAL_PLAYER_LABELS',json.dumps([{'label':x.get('label'),'name':x.get('name'),'value':x.get('value'),'team':x.get('team',{}).get('name')} for x in original.get('leaders',{}).get('players',[])])[:2400],flush=True)
  print('ORIGINAL_TEAM_PANEL_LABELS',json.dumps([{'label':x.get('label'),'value':x.get('value'),'team':x.get('team',{}).get('name')} for x in original.get('teamPanels',{}).get('leaders',[])])[:2500],flush=True)
  print('ORIGINAL_AWARD_META',json.dumps({k:original.get('awards',{}).get(k) for k in ('season','kind','checkedAt','warning')})[:900],flush=True)
except Exception as e:print('ORIGINAL_FEED_FAIL',str(e)[:220],flush=True)
finally:server.shutdown()
url="https://site.api.espn.com/apis/site/v3/sports/football/nfl/leaders?season=2026&seasontype=2"
with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'ManCaveContractAudit/1.0','Accept':'application/json'}),timeout=20) as r:d=json.load(r)
for cat in d.get('leaders',{}).get('categories',[]):
  if cat.get('name') not in ('passingYards','rushingYards','receivingYards','totalTackles','sacks','interceptions'):continue
  entry=(cat.get('leaders') or [None])[0]
  if not entry:continue
  a=entry.get('athlete') or {}
  print('LEADER_COMPRESSED',cat['name'],json.dumps({
    'name':a.get('displayName'),'id':a.get('id'),'value':entry.get('value'),
    'displayValue':entry.get('displayValue'),
    'headshot':a.get('headshot'),
    'teamId':a.get('teamId'),
    'teams':(a.get('teams') or [])[:1],
    'athleteKeys':list(a.keys()),
    'entryKeys':list(entry.keys())
  })[:2200],flush=True)
