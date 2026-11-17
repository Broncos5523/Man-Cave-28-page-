#!/usr/bin/env python3
"""Read-only public-source inspection for migration of v8l /api/board routes.

GitHub Actions only; prints bounded excerpts of approved release files and
shape-only JSON samples. No secrets, accounts, or Firebase access.
"""
import json
import pathlib
import re
import threading
import time
import sys
from urllib.request import urlopen
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parent))
import low_bandwidth_server as low
original=low.approved.original
base=low.approved.APP

print("=== ORIGINAL_PRODUCTION_SERVER ===",flush=True)
source=(base/"production_server.py").read_text(errors="replace").splitlines()
for i,line in enumerate(source,1):
    if i<=260 or any(k in line for k in ("def do_GET","def adapt_board","api/board","def respond")):
        print("ORIGINAL",i,line[:230],flush=True)
print("=== ORIGINAL_PY_MODULES ===",flush=True)
for p in sorted(base.glob("*.py")):
    print("MODULE",p.name,p.stat().st_size,flush=True)
for p in sorted((original.GOLD/"runtime.css",original.GOLD/"runtime_nfl_p4_v7s.js",original.GOLD/"runtime_nfl_p1_v7a.js")):
    if p.is_file():
        print("=== RUNTIME",p.name,"===",flush=True)
        for i,line in enumerate(p.read_text(errors="replace").splitlines(),1):
            if i<=45 or re.search(r"/api/board|/api/|fetch\(|json|\\.players|\\.leaders|\\.ticker|\\.teams|\\.mvp",line,re.I):
                print("RUNTIME",p.name,i,line[:260],flush=True)
print("=== BOARD INLINE ENDPOINTS ===",flush=True)
for bid in ("page4_broncos","page1_nfl","page2_nfl","page3_broncos","page4_celtics","page1_nba","page4_bruins"):
    p=original.GOLD/"boards"/(bid+".html")
    if not p.is_file():continue
    txt=p.read_text(errors="replace")
    print("HTML",bid,"bytes",len(txt),"API_ENDPOINTS",
        sorted(set(re.findall(r"/(?:api|production/api)/[a-zA-Z0-9_\-/?=.&]+",txt)))[:40],flush=True)
print("=== LOCAL API SHAPE PROBES ===",flush=True)
server=low.ThreadingHTTPServer(("127.0.0.1",0),low.Handler)
server.daemon_threads=True
server.born=time.monotonic()
threading.Thread(target=server.serve_forever,daemon=True).start()
host="http://127.0.0.1:"+str(server.server_port)
def shape(val,depth=0):
    if depth>3:return type(val).__name__
    if isinstance(val,dict):return {k:shape(v,depth+1) for k,v in list(val.items())[:12]}
    if isinstance(val,list):return {"length":len(val),"first":shape(val[0],depth+1) if val else None}
    if isinstance(val,str):return val[:80] if depth<2 else "str"
    return val
try:
    for bid in ("page4_broncos","page1_nfl","page2_nfl","page3_broncos","page4_celtics","page1_nba","page4_bruins"):
        route="/api/board/"+bid
        try:
            with urlopen(host+route,timeout=18) as r:
                data=r.read()
                try: parsed=json.loads(data)
                except:parsed={"nonJson":data[:100].decode(errors="replace")}
                print("API",route,"status",r.status,"bytes",len(data),
                    "SHAPE",json.dumps(shape(parsed),separators=(",",":"))[:3000],flush=True)
        except Exception as e:
            print("API",route,"ERROR",str(e)[:250],flush=True)
finally:
    server.shutdown()
    server.server_close()
