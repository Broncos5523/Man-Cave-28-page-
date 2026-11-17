#!/usr/bin/env python3
import urllib.request,json
base="https://site.api.espn.com"
headers={"User-Agent":"ManCaveSportsExactStatProof/1.0","Accept":"application/json"}
def get(url):
  with urllib.request.urlopen(urllib.request.Request(url,headers=headers),timeout=18) as r:return json.load(r)
d=get(base+"/apis/common/v3/sports/football/nfl/statistics/byteam?season=2026&seasontype=2&limit=100")
maps={c["name"]:c["names"] for c in d["categories"]}
settings=[
  ("PASSING OFFENSE","passing",0,"passingYardsPerGame"),
  ("RUSHING OFFENSE","rushing",0,"rushingYardsPerGame"),
  ("TEAM SACKS","passing",1,"sacks"),
  ("INTERCEPTIONS","defensiveinterceptions",1,"interceptions"),
  ("PASSING TDS","passing",0,"passingTouchdowns")
]
print("TEAM_STATS_SEASON",d["requestedSeason"]["year"],d["requestedSeason"]["type"]["type"],flush=True)
for label,cat,which,key in settings:
  vals=[]
  for team in d["teams"]:
    groups=[c for c in team["categories"] if c["name"]==cat]
    if len(groups)<=which or key not in maps[cat]:continue
    pos=maps[cat].index(key);row=groups[which]
    val=row.get("values",[]);tot=row.get("totals",[])
    if len(val)<=pos:continue
    vals.append((float(val[pos]),team["team"]["displayName"],tot[pos] if len(tot)>pos else None))
  vals.sort(reverse=True)
  print("TEAM_METRIC",label,"count",len(vals),"top",vals[:3],flush=True)
leader=get(base+"/apis/site/v3/sports/football/nfl/leaders?season=2026&seasontype=2")
for cat in leader["leaders"]["categories"]:
  if cat["name"] not in ("passingYards","rushingYards","receivingYards","sacks","passingTouchdowns","interceptions"):continue
  top=cat["leaders"][0]
  team=top.get("team") or {}
  teams=top.get("teams") or []
  print("PLAYER_TEAM",cat["name"],"id",top["athlete"]["id"],"entryTeam",json.dumps(team)[:1600],"entryTeams",json.dumps(teams[:1])[:800],flush=True)
