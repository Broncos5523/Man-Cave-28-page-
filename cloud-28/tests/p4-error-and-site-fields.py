"""Read only: inspect source-verification failure reasons and ESPN composite 3PM averages."""
import datetime,json,urllib.request,urllib.error,urllib.parse
NOW=datetime.datetime.now(datetime.timezone.utc)
worker="https://man-cave-28-page.broncos5523.workers.dev"
site="https://site.api.espn.com"
def get(url):
    req=urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"ManCaveStatsFreshnessReadOnly/1.0"})
    try:
        with urllib.request.urlopen(req,timeout=25) as f:return f.status,json.load(f)
    except urllib.error.HTTPError as ex:
        try:detail=json.load(ex)
        except:detail={}
        return ex.code,detail
for id in ["page4_celtics","page4_fever","page4_arizona_cbb"]:
    code,body=get(worker+"/production/api/page4-live?board="+id)
    print("P4_API_CONTRACT",json.dumps({"id":id,"status":code,"reason":body.get("error"),
      "detail":str(body.get("detail",""))[:280],"season":body.get("season"),
      "updatedAt":body.get("updatedAt"),"players":body.get("verifiedPlayers")},sort_keys=True),flush=True)
for league,pid,year,team in [("nba","4433188",2027,"2"),("wnba","3142255",2026,"5"),
                             ("mens-college-basketball","5351296",2027,"12")]:
    endpoint=f"{site}/apis/common/v3/sports/basketball/{league}/athletes/{pid}/stats?season={year}&seasontype=2"
    code,body=get(worker+"/proxy?url="+urllib.parse.quote(endpoint,safe=""))
    rows=[]
    for c in body.get("categories",[]):
        names=c.get("names") or []
        for row in c.get("statistics",[]):
            if int(row.get("season",{}).get("year",0))!=year or str(row.get("teamId"))!=team:continue
            vals=row.get("stats",[])
            selected={}
            for name in ("gamesPlayed","avgPoints","avgRebounds","avgAssists","avgSteals",
              "avgBlocks","avgThreePointFieldGoalsMade","avgThreePointFieldGoalsMade-avgThreePointFieldGoalsAttempted"):
                if name in names and names.index(name)<len(vals):
                    selected[name]=vals[names.index(name)]
            rows.append({"category":c.get("name"),"values":selected})
    print("ESPN_SITE_P4_VALUES",json.dumps({"league":league,"id":pid,"status":code,
      "season":year,"team":team,"rows":rows},sort_keys=True),flush=True)
