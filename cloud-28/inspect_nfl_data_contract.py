#!/usr/bin/env python3
"""Safe source contract extraction; logs only structure and snippets from Gold Master."""
from pathlib import Path
from urllib.request import urlopen
import re,json,sys,threading,time
sys.path.insert(0,'cloud-28')
import low_bandwidth_server as low
gold=low.approved.original.GOLD
for name in ['runtime_nfl_p1_v7j.js','runtime_nfl_p2_v7i.js','runtime.js','ticker_nfl_final.mjs']:
    p=gold/name
    s=p.read_text(errors="replace")
    lines=s.splitlines()
    print("=== ORIGINAL_JS",name,"BYTES",len(s),"LINES",len(lines),"===",flush=True)
    for i,l in enumerate(lines):
        if any(needle in l for needle in ('api/board','function ','data.','payload.','response.','json.','fetch(')):
            print(f'JS {name}:{i+1} {l[:600]}',flush=True)
            for nearby in range(i+1,min(i+3,len(lines))):
                if len(lines[nearby])<320:print(f'CONTEXT {name}:{nearby+1} {lines[nearby]}',flush=True)
server=low.ThreadingHTTPServer(('127.0.0.1',0),low.Handler)
server.daemon_threads=True
server.born=time.monotonic()
threading.Thread(target=server.serve_forever,daemon=True).start()
base='http://127.0.0.1:'+str(server.server_port)
def shape(v,depth=0):
    if depth>4:return type(v).__name__
    if isinstance(v,dict):return {k:shape(x,depth+1) for k,x in list(v.items())[:28]}
    if isinstance(v,list):return {'len':len(v),'first':shape(v[0],depth+1) if v else None}
    if isinstance(v,str):return v[:140] if depth<=1 else 'str'
    return v
for id in ['page1_nfl','page2_nfl']:
    try:
        with urlopen(base+'/api/board/'+id,timeout=25) as r:
            d=json.load(r)
        print('=== API_SHAPE',id,json.dumps(shape(d),separators=(',',':'))[:18000],flush=True)
        for k in ['context','ticker','standings','teamPanels','leaders','awards','playoffs','postseason','warnings']:
            if k in d:
                data=d[k]
                if k in ('context','warnings'):print('API_SAMPLE',id,k,json.dumps(data,default=str)[:1700],flush=True)
                elif k=='ticker':
                    print('API_SAMPLE',id,k,'keys',list(data),'firstevent',json.dumps(data.get('events',[None])[0],default=str)[:2200],flush=True)
                elif k=='standings':
                    group=data.get('groups',[{}])[0]
                    print('API_SAMPLE',id,k,'firstgroup',json.dumps({a:b for a,b in group.items() if a!='entries'})[:1000],'firstentry',json.dumps(group.get('entries',[None])[0],default=str)[:2500],flush=True)
                else:print('API_SAMPLE',id,k,json.dumps(shape(data),default=str)[:2600],flush=True)
    except Exception as e:print('API_ERROR',id,type(e).__name__,str(e)[:500],flush=True)
server.shutdown()
