#!/usr/bin/env python3
import re, json, pathlib, urllib.request, urllib.error, sys
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
import low_bandwidth_server as low
root=low.approved.original.GOLD
b=(root/"boards/page4_broncos.html").read_text(errors="replace")
b=re.sub(r"data:image/(?:png|jpe?g|webp|gif|svg\+xml|avif|bmp);base64,[A-Za-z0-9+/=]+","[ORIGINAL_IMAGE]",b,flags=re.I)
lines=b.splitlines()
print("=== APPROVED NFL BOARD LIVE STAT FUNCTIONS ===",flush=True)
keywords=["function flattenStats(","function normalizePlayerStats(","function leaderSeasonValues(","async function fetchPlayerStats(","async function fetchSpotlightSeasonStats(","async function roster(","async function refreshLeaders("]
for keyword in keywords:
  for ix,line in enumerate(lines):
    if keyword in line:
      print("SOURCE",keyword,"LINE",ix+1,flush=True)
      for j in range(ix,min(ix+19,len(lines))):
        print("L",j+1,lines[j][:1100],flush=True)
      break
def read(url):
    try:
      with urllib.request.urlopen(urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"ManCaveStatsCompatibilityProof/1.0"}),timeout=15) as r:
        return r.status,json.loads(r.read())
    except urllib.error.HTTPError as e:
      return e.code,{"error":e.read(250).decode(errors="replace")}
ident="4426338"
urls=[
("2026-site",f"https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{ident}/stats?season=2026"),
("2025-site",f"https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/{ident}/stats?season=2025"),
("2026-core",f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/{ident}/statistics/0?lang=en&region=us"),
("2026-core-untyped",f"https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/{ident}/statistics?lang=en&region=us"),
]
for name,url in urls:
  status,d=read(url)
  print("RESPONSE",name,"HTTP",status,"keys",list(d)[:18],flush=True)
  print("META",name,"filters",json.dumps(d.get("filters"))[:1900],"teams",json.dumps(d.get("teams"))[:650],flush=True)
  if name.endswith("-site"):
    cats=d.get("categories",[])
    for c in cats[:6]:
      sample={"name":c.get("name"),"displayName":c.get("displayName"),
              "names":c.get("names",[])[:16],"labels":c.get("labels",[])[:16],
              "totals":str(c.get("totals",[]))[:500],"statistics":str(c.get("statistics",[]))[:500]}
      print("SITE_CATEGORY",name,json.dumps(sample)[:2100],flush=True)
  else:
    splits=d.get("splits",{})
    print("CORE_META",name,"season",d.get("season"),"ref",d.get("$ref"),"splitKeys",list(splits)[:10] if isinstance(splits,dict) else None,flush=True)
    cats=splits.get("categories",[]) if isinstance(splits,dict) else []
    for c in cats[:4]:
      print("CORE_CATEGORY",name,c.get("name"),"stats",json.dumps(c.get("stats",[]))[:900],flush=True)
