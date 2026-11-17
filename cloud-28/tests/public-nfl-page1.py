#!/usr/bin/env python3
"""Public read-only end-to-end verification; no production assignment changes."""
from urllib.request import Request,urlopen
from urllib.error import HTTPError
import json,time
url="https://man-cave-28-page.broncos5523.workers.dev/api/board/page1_nfl"
found=None
for i in range(6):
    try:
        with urlopen(Request(url,headers={"Accept":"application/json","User-Agent":"ManCavePublicSportsDiagnostic/1.0"}),timeout=20) as r:
            body=r.read(2500000);status=r.status;header=r.headers
        print("PUBLIC_NFL_RESPONSE",i+1,status,"bytes",len(body),"source",header.get("X-Man-Cave-Data-Source"),flush=True)
        result=json.loads(body)
        if status==200 and result.get("board")=="page1_nfl" and result.get("dataState")=="current":
            found=result;break
        print("PUBLIC_NFL_UNREADY",json.dumps(result)[:200],flush=True)
    except HTTPError as e:
        print("PUBLIC_NFL_ATTEMPT",i+1,"HTTP",e.code,e.read(350).decode(errors="replace")[:300],flush=True)
    except Exception as e:
        print("PUBLIC_NFL_ATTEMPT",i+1,type(e).__name__,str(e)[:250],flush=True)
    time.sleep(8)
assert found is not None,"Public Cloudflare NFL Page 1 legacy data route not yet working"
s=found["standings"]
assert found["context"]["sport"]=="nfl"
assert found["context"]["seasonType"]==2
assert found["context"]["year"]==s["season"]["year"]
assert len(s["groups"])==2
assert all(len(x["entries"])==16 for x in s["groups"])
assert sorted(int(t["seed"]) for t in s["groups"][0]["entries"])==list(range(1,17))
assert sorted(int(t["seed"]) for t in s["groups"][1]["entries"])==list(range(1,17))
assert len(found["ticker"]["selected"])>0
assert all(int(event["season"]["year"])==found["context"]["year"] for event in found["ticker"]["selected"])
assert not found.get("awards"),"Do not introduce unverified MVP data"
print("PUBLIC_NFL_PAGE1_VERIFIED",
      "season",found["context"]["year"],
      "AFC",len(s["groups"][0]["entries"]),
      "NFC",len(s["groups"][1]["entries"]),
      "ticker",len(found["ticker"]["selected"]),
      "first",found["ticker"]["selected"][0]["id"],flush=True)
