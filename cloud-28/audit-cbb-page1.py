#!/usr/bin/env python3
"""Read only CBB Page1 immutable v8l feed + public 2026-27 ESPN API probe."""
import sys,threading,time,re,json,urllib.request,urllib.parse,urllib.error
sys.path.insert(0,"cloud-28")
import low_bandwidth_server as low
app=low.approved.APP; gold=low.approved.original.GOLD
def shape(v,level=0):
    if level>4:return type(v).__name__
    if isinstance(v,dict):return {k:shape(x,level+1) for k,x in list(v.items())[:30]}
    if isinstance(v,list):return {"length":len(v),"first":shape(v[0],level+1) if v else None}
    if isinstance(v,str):return v[:115] if level<=1 else "str"
    return v
server=low.ThreadingHTTPServer(("127.0.0.1",0),low.Handler)
server.daemon_threads=True;server.born=time.monotonic()
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
    url="http://127.0.0.1:"+str(server.server_port)+"/api/board/page1_cbb"
    try:
        with urllib.request.urlopen(url,timeout=27) as r:
            b=r.read(7000000);data=json.loads(b)
        print("CBB_ORIGINAL_BYTES",len(b),"KEYS",list(data),flush=True)
        print("CBB_ORIGINAL_SHAPE",json.dumps(shape(data))[:12500],flush=True)
        for name in ("context","standings","ticker","playoffs","tournament","bracket","rankings","awards","postseason","leaders","teamPanels","schedule","warnings"):
            v=data.get(name)
            if v is None:continue
            print("CBB_ORIGINAL_SECTION",name,json.dumps(shape(v))[:4200],flush=True)
        for g in (data.get("standings",{}).get("groups") or [])[:4]:
            print("CBB_ORIGINAL_GROUP",g.get("name"),"entries",len(g.get("entries",[])),"first",json.dumps(shape((g.get("entries") or [{}])[0]))[:1800],flush=True)
    except Exception as e:print("CBB_ORIGINAL_ERROR",type(e).__name__,str(e)[:380],flush=True)
finally:server.shutdown()
runtime=(gold/"runtime_nfl_p1_v7j.js")
if runtime.is_file():
    lines=runtime.read_text(errors="replace").splitlines()
    for a,b in ((470,633),(775,810)):
        print("CBB_ORIGINAL_RUNTIME_BLOCK",a,b,flush=True)
        for i in range(a-1,min(b,len(lines))):
            if "cbb" in lines[i].lower() or "college" in lines[i].lower() or i in range(776,808):
                print("CBB_RUNTIME",i+1,lines[i][:350],flush=True)
urls={
    "standings":"https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/standings?season=2027&seasontype=2",
    "scoreboard":"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?limit=100&dates=20261117",
    "rankings":"https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/rankings?season=2027&seasontype=2"
}
for name,url in urls.items():
    for route,src in (("direct",url),("cloudflare","https://man-cave-28-page.broncos5523.workers.dev/proxy?url="+urllib.parse.quote(url,safe=""))):
        try:
            req=urllib.request.Request(src,headers={"Accept":"application/json","User-Agent":"ManCaveCBBDiagnostics/1.0"})
            with urllib.request.urlopen(req,timeout=18) as r:
                b=r.read(8000000);d=json.loads(b)
            print("CBB_REMOTE",name,route,len(b),json.dumps(shape(d))[:3600],flush=True)
            if name=="standings":
                print("CBB_REMOTE_GROUP_COUNTS",name,route,len(d.get("children",[])),[(x.get("name"),len(x.get("standings",{}).get("entries",[]))) for x in d.get("children",[])][:50],flush=True)
        except urllib.error.HTTPError as e:print("CBB_REMOTE_FAIL",name,route,"HTTP",e.code,e.read(110).decode(errors="replace"),flush=True)
        except Exception as e:print("CBB_REMOTE_FAIL",name,route,type(e).__name__,str(e)[:220],flush=True)
