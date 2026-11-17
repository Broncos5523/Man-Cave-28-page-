#!/usr/bin/env python3
"""Public NFL Page 2 end-to-end contract check. No writes or TV commands."""
import urllib.request, urllib.error, json, time
base="https://man-cave-28-page.broncos5523.workers.dev"
url=base+"/api/board/page2_nfl"
data=None
for i in range(9):
    try:
        with urllib.request.urlopen(
            urllib.request.Request(url,headers={"Accept":"application/json","User-Agent":"ManCavePublicSportsDiagnostic/1.0"}),
            timeout=24) as r:
            raw=r.read(5000000)
            incoming=json.loads(raw)
            print("PUBLIC_NFL_P2_ATTEMPT",i+1,"HTTP",r.status,"BYTES",len(raw),"SOURCE",r.headers.get("X-Man-Cave-Data-Source"),flush=True)
            if r.status==200 and incoming.get("board")=="page2_nfl" and incoming.get("dataState")=="current":
                data=incoming
                break
            print("PUBLIC_NFL_P2_ERROR",json.dumps(incoming)[:260],flush=True)
    except urllib.error.HTTPError as e:
        print("PUBLIC_NFL_P2_HTTP",i+1,e.code,e.read(350).decode(errors="replace")[:220],flush=True)
    except Exception as e:
        print("PUBLIC_NFL_P2_FAILURE",i+1,type(e).__name__,str(e)[:250],flush=True)
    time.sleep(8)
assert data is not None,"Current live NFL Page 2 Cloudflare JSON route is unverified"
assert data["context"]["sport"]=="nfl" and data["context"]["seasonType"]==2
assert data["context"]["year"]==2026
assert len(data["standings"]["groups"])==2
assert all(len(g["entries"])==16 for g in data["standings"]["groups"])
assert len(data["ticker"]["selected"])>0
players=data["leaders"]["players"]
teams=data["teamPanels"]["leaders"]
expectedPlayers=["RUSHING YARDS","PASSING YARDS","SACKS","RECEIVING YARDS","PASSING TOUCHDOWNS","INTERCEPTIONS"]
expectedTeams=["PASSING OFFENSE","RUSHING OFFENSE","TEAM SACKS","INTERCEPTIONS","PASSING TDS"]
assert [p["label"] for p in players]==expectedPlayers
assert [t["label"] for t in teams]==expectedTeams
assert all(p.get("id") and p.get("team",{}).get("id") and p.get("headshot") and p.get("season")==2026 for p in players)
assert all(t.get("team",{}).get("name") and t.get("value") for t in teams)
sacks=next(p for p in players if p["label"]=="SACKS")
assert isinstance(sacks["number"],(int,float)) and sacks["number"]>0
assert sacks["value"]!="10" or sacks["number"]==10,"Fractional sacks incorrectly truncated"
assert "awards" not in data,"Do not fabricate verified NFL.com MVP Tracker data"
assert "NFL.com MVP Tracker" in data["migration"]["excluded"]
print("PUBLIC_NFL_P2_VERIFIED",json.dumps({
 "season":data["context"]["year"],
 "games":len(data["ticker"]["selected"]),
 "players":[[p["label"],p["name"],p["value"],p["team"]["name"]] for p in players],
 "teams":[[t["label"],t["team"]["name"],t["value"]] for t in teams],
 "excluded":data["migration"]["excluded"]
}),flush=True)
