"""Read-only feasibility probe: current basketball ESPN Site athlete records.

Would eliminate reliance on delayed GitHub cron publication if exact regular-
season athlete/team stats are directly available from Cloudflare. No writes.
"""
import urllib.request,urllib.parse,urllib.error,json,datetime
BASE='https://site.api.espn.com'
CF='https://man-cave-28-page.broncos5523.workers.dev'
sports=[('nba','2',2027),('wnba','5',2026),('mens-college-basketball','12',2027)]
def read(url):
 try:
  with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'ManCaveStatsResearch/1.0','Accept':'application/json'}),timeout=15) as r:
   return r.status,json.loads(r.read(2000000))
 except urllib.error.HTTPError as e:return e.code,{'error':e.read(300).decode('utf-8','replace')[:90]}
 except Exception as e:return 'network',{'error':type(e).__name__}
def inspect(league,team,year,route):
 rosterurl=BASE+'/apis/site/v2/sports/basketball/'+league+'/teams/'+team+'/roster?season='+str(year)
 status,roster=read(rosterurl)
 print('SOURCE_ROSTER',json.dumps({'league':league,'status':status,'season':roster.get('season',{}).get('year'),
   'count':len(roster.get('athletes',[]))}),flush=True)
 if status!=200:return
 players=[x for x in roster['athletes'] if str(x.get('id','')).isdigit()][:4]
 for p in players:
  id=p['id']
  target=BASE+'/apis/common/v3/sports/basketball/'+league+'/athletes/'+str(id)+'/stats?season='+str(year)+'&seasontype=2'
  url=target if route=='direct' else CF+'/proxy?url='+urllib.parse.quote(target,safe='')
  code,data=read(url)
  categories=data.get('categories',[]) if isinstance(data,dict) else []
  seasontype=next((f for f in data.get('filters',[]) if f.get('name')=='seasontype'),{}) if isinstance(data,dict) else {}
  row=[{'category':c.get('name'),'names':c.get('names',[])[:9],
    'rows':[{'season':s.get('season',{}).get('year'),
      'teamId':s.get('teamId'),'statsCount':len(s.get('stats',[]))} for s in c.get('statistics',[])[:4]]}
    for c in categories[:3]]
  selected=[(c,s) for c in categories for s in c.get('statistics',[])
    if s.get('season',{}).get('year')==year and str(s.get('teamId'))==team]
  stats=set()
  for c,s in selected:
   stats.update(str(x) for x in c.get('names',[]))
  out={'league':league,'playerId':id,'route':route,'status':code,
   'filtersType':str(seasontype.get('value','')),'categories':len(categories),
   'currentTeamSeasonRows':len(selected),'hasGamesPlayed':'gamesPlayed' in stats,
   'hasAvgPoints':'avgPoints' in stats,
   'hasAvgRebounds':'avgRebounds' in stats,
   'hasAvgAssists':'avgAssists' in stats,
   'hasAvgSteals':'avgSteals' in stats,
   'hasAvgBlocks':'avgBlocks' in stats,
   'hasAvgThree':'avgThreePointFieldGoalsMade' in stats,
   'rows':row}
  print('SITE_BASKETBALL_PLAYER_PROBE',json.dumps(out),flush=True)
  if selected:break

for league,team,year in sports:
 inspect(league,team,year,'direct')
 inspect(league,team,year,'worker-proxy')
