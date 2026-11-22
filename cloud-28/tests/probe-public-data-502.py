"""Bounded public ESPN Core and MLB schedule error diagnosis (read-only).
No writes, auth, retry loops, or sensitive headers; at most 4 requests.
"""
from urllib import request,error,parse
from datetime import date
import json
import re
import time

preview="https://img-source-man-cave-28-page.broncos5523.workers.dev"
targets=[
 ("espn_core_nfl_team_season_stats",
  "https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/teams/3/statistics"),
 ("mlb_public_schedule",
  "https://statsapi.mlb.com/api/v1/schedule?sportId=1&date=2026-11-22"),
]
for label,upstream in targets:
    for route,url in [
      ("direct-from-github-runner",upstream),
      ("isolated-cloudflare-proxy",preview+"/proxy?url="+parse.quote(upstream,safe=""))
    ]:
        req=request.Request(url,headers={
            "User-Agent":"ManCavePublicDataReadOnly/1.0",
            "Accept":"application/json, text/plain;q=0.9"
        })
        try:
            with request.urlopen(req,timeout=12) as response:
                status=response.status
                typ=response.headers.get("Content-Type","")
                content=response.read(300).decode("utf-8","replace")
        except error.HTTPError as exc:
            status=exc.code
            typ=exc.headers.get("Content-Type","")
            content=exc.read(300).decode("utf-8","replace")
        except Exception as exc:
            status="network-exception"
            typ=""
            content=type(exc).__name__
        # Do not print untrusted HTML or raw upstream content into Actions logs.
        msg="unspecified"
        try:
            parsed=json.loads(content)
            if isinstance(parsed,dict):
                msg=str(parsed.get("error") or parsed.get("message") or parsed.get("status") or "")[:120]
        except Exception:
            msg="non-json-body" if typ else "no-http-response"
        print("PUBLIC_DATA_PROBE",json.dumps({
          "target":label,"route":route,"status":status,
          "mime":typ.split(";")[0],"errorSummary":msg},sort_keys=True),flush=True)
