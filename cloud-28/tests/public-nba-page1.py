#!/usr/bin/env python3
"""Verify real 2026-27 NBA Page1 Cloudflare API, no writes."""
from urllib.request import Request,urlopen
from urllib.error import HTTPError
import json,time
host="https://man-cave-28-page.broncos5523.workers.dev"
target=host+"/api/board/page1_nba"
feed=None
for attempt in range(9):
    try:
        with urlopen(Request(target,headers={"Accept":"application/json",
                 "User-Agent":"ManCavePublicSportsDiagnostic/1.0"}),timeout=25) as response:
            body=response.read(3200000)
            d=json.loads(body)
            print("PUBLIC_NBA_ATTEMPT",attempt+1,response.status,"bytes",len(body),
                  "source",response.headers.get("X-Man-Cave-Data-Source"),flush=True)
            if response.status==200 and d.get("board")=="page1_nba" and d.get("dataState")=="current":
                feed=d;break
            print("PUBLIC_NBA_NOT_READY",json.dumps(d)[:250],flush=True)
    except HTTPError as e:
        print("PUBLIC_NBA_HTTP",attempt+1,e.code,e.read(320).decode(errors="replace")[:250],flush=True)
    except Exception as e:
        print("PUBLIC_NBA_FAIL",attempt+1,type(e).__name__,str(e)[:250],flush=True)
    time.sleep(7)
assert feed is not None,"NBA Page1 live public API not confirmed"
assert feed["context"]["year"]==2027
assert feed["context"]["label"]=="2026–27"
assert feed["context"]["seasonType"]==2
groups=feed["standings"]["groups"]
assert len(groups)==2
assert {g["name"] for g in groups}=={"Eastern Conference","Western Conference"}
assert all(len(g["entries"])==15 for g in groups)
assert all(sorted(t["seed"] for t in g["entries"])==list(range(1,16)) for g in groups)
assert len(feed["ticker"]["selected"])>0
assert all(e["season"]["year"]==2027 and e["season"]["type"]==2 for e in feed["ticker"]["selected"])
assert feed["playoffs"]["kind"]=="projection" and len(feed["playoffs"]["matches"])==8
assert all(m.get("winner") is None for m in feed["playoffs"]["matches"])
assert not feed.get("awards"),"Do not invent NBA MVP awards"
print("PUBLIC_NBA_PAGE1_VERIFIED",json.dumps({
  "year":2027,"eastern":len(groups[0]["entries"]),"western":len(groups[1]["entries"]),
  "ticker":len(feed["ticker"]["selected"]),
  "first":feed["ticker"]["selected"][0]["id"],
  "projectionMatches":len(feed["playoffs"]["matches"]),
  "provenance":feed.get("migration")
}),flush=True)
