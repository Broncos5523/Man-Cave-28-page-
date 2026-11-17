"""Read-only proof against the actual public Cloudflare deployment."""
import json,time,urllib.request,urllib.error
HOST='https://man-cave-28-page.broncos5523.workers.dev'
def read(path):
    req=urllib.request.Request(HOST+path,headers={'Accept':'application/json','User-Agent':'ManCavePublicSportsDiagnostic/1.0'})
    with urllib.request.urlopen(req,timeout=35) as r:return r.read(5000000)
for attempt in range(30):
    try:
        health=json.loads(read('/migration-api/health'))
        assert health.get('adapterRevision')=='priority-r2','Waiting for matching Worker revision'
        for board in ('page1_cbb','page2_nba','page3_broncos'):
            data=json.loads(read('/api/board/'+board))
            assert data['board']==board and data['dataState']=='current'
            print('PUBLIC_CONTRACT_READY',board,data['context']['year'],flush=True)
        html=read('/staging/boards/page1_cbb.html').decode()
        assert 'mc-cloud-2027-watch-fit' not in html,'Waiting for original-renderer static build'
        break
    except urllib.error.HTTPError as e:
        print('PUBLIC_HTTP',attempt,e.code,e.read(250).decode(errors='replace'),flush=True)
    except Exception as e:print('PUBLIC_WAIT',attempt,type(e).__name__,str(e)[:250],flush=True)
    time.sleep(10)
else:raise SystemExit('Public priority deployment not verified')
