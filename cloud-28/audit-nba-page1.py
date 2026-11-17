#!/usr/bin/env python3
import re,json,sys,threading,time,urllib.request,urllib.error
sys.path.insert(0,'cloud-28')
import low_bandwidth_server as low
gold=low.approved.original.GOLD
for file in ("runtime_nba_p1_v7z.js","ticker_pro_final.mjs"):
  source=(gold/file).read_text(errors="replace").splitlines()
  print("=== NBA_JS",file,len(source),"lines",flush=True)
  for start,end in ((1,55),(245,279),(335,370),(776,815)):
    print("NBA_JS_BLOCK",file,start,end,flush=True)
    for i in range(start-1,min(end,len(source))):
      if file.endswith(".mjs") and i>60:break
      print("NBA_CODE",file,i+1,source[i][:900],flush=True)
server=low.ThreadingHTTPServer(("127.0.0.1",0),low.Handler);server.daemon_threads=True;server.born=time.monotonic()
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
  with urllib.request.urlopen("http://127.0.0.1:"+str(server.server_port)+"/api/board/page1_nba",timeout=28) as r:d=json.load(r)
  def shape(x,n=0):
    if n>4:return type(x).__name__
    if isinstance(x,list):return {"len":len(x),"first":shape(x[0],n+1) if x else None}
    if isinstance(x,dict):return {k:shape(v,n+1) for k,v in list(x.items())[:22]}
    if isinstance(x,str):return x[:80] if n<2 else "str"
    return x
  print("ORIGINAL_NBA_CONTEXT",json.dumps(d.get("context")),flush=True)
  print("ORIGINAL_NBA_SCHEMA",json.dumps(shape(d))[:16500],flush=True)
  print("ORIGINAL_NBA_STANDINGS",json.dumps([{"name":g.get("name"),"len":len(g.get("entries",[])),
    "first":(g.get("entries") or [None])[0]} for g in d.get("standings",{}).get("groups",[])])[:4700],flush=True)
  print("ORIGINAL_NBA_PLAYOFFS",json.dumps(shape(d.get("playoffs")))[:3200],flush=True)
except Exception as e:print("ORIGINAL_NBA_ERROR",str(e)[:350],flush=True)
finally:server.shutdown()
sources={
  "scoreboard":"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=100",
  "standings2027":"https://site.api.espn.com/apis/v2/sports/basketball/nba/standings?season=2027&seasontype=2"
}
for key,url in sources.items():
  try:
    with urllib.request.urlopen(urllib.request.Request(url,headers={"User-Agent":"ManCaveNBAContractStudy/1.0","Accept":"application/json"}),timeout=18) as r:remote=json.load(r)
    print("REMOTE_NBA",key,"TOP",list(remote),"season",remote.get("season"),flush=True)
    if key=="standings2027":
      print("REMOTE_NBA_STANDINGS",json.dumps([{"name":g.get("name"),"id":g.get("id"),"season":g.get("standings",{}).get("season"),
        "seasonType":g.get("standings",{}).get("seasonType"),"len":len(g.get("standings",{}).get("entries",[])),
        "entry":(g.get("standings",{}).get("entries") or [None])[0]} for g in remote.get("children",[])])[:6700],flush=True)
    else:
      print("REMOTE_NBA_LEAGUE_SEASON",json.dumps(remote.get("leagues",[None])[0].get("season") if remote.get("leagues") else None)[:1100],flush=True)
      print("REMOTE_NBA_FIRST_GAME",json.dumps((remote.get("events") or [None])[0])[:1100],flush=True)
  except Exception as e:print("REMOTE_NBA_ERROR",key,type(e).__name__,str(e)[:250],flush=True)
