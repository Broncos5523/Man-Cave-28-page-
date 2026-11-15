#!/usr/bin/env python3
"""Browser/cloud adapter; original 28 approved board files remain byte-identical."""
import json,os,sys,time
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

HERE=Path(__file__).resolve().parent
APP=HERE/"source"/"MAN_CAVE_28_BOARD_FINAL_PRODUCTION_v1"
if not (APP/"production_server.py").is_file():
    raise SystemExit("Approved archive unavailable. The cloud build must first run prepare.py.")
sys.path.insert(0,str(APP))
import production_server as original
import live_page4_current as page4_live
import page4_patch
import draft_watch_live
import bracketology_source
import cbb_tournament_view
os.chdir(original.GOLD)

ORIGINAL_FIT="function fit(){const w=Math.min(innerWidth,innerHeight*9/16),h=w*16/9;Object.assign(stage.style,{width:w+'px',height:h+'px',left:(innerWidth-w)/2+'px',top:(innerHeight-h)/2+'px'});}"
NEW_FIT="""function fit(){
const mode=window.__MC_ONN_ROTATION__||'off';
const fill=window.__MC_TV_FIT__!=='contain';
const rotated=mode!=='off'&&innerWidth>innerHeight;
const viewWidth=rotated?innerHeight:innerWidth;
const viewHeight=rotated?innerWidth:innerHeight;
const w=Math.min(viewWidth,viewHeight*9/16),h=w*16/9;
const scaleX=fill?viewWidth/w:1,scaleY=fill?viewHeight/h:1;
const angle=rotated?' rotate('+(mode==='ccw'?'-90':'90')+'deg)':'';
Object.assign(stage.style,{
 width:w+'px',height:h+'px',left:'50%',top:'50%',
 transformOrigin:'center center',
 transform:'translate(-50%,-50%)'+angle+' scale('+scaleX.toFixed(5)+','+scaleY.toFixed(5)+')'
});
window.__MC_ONN_FIT_REPORT__={mode:mode,fill:fill,rotated:rotated,viewport:[innerWidth,innerHeight],
  board:[w,h],scale:[scaleX,scaleY]};
} }"""
NHL_FETCH_SHIM = """<script>
(function(){
 const original=window.fetch.bind(window);
 window.fetch=function(resource,options){
   const raw=typeof resource==='string'?resource:(resource&&resource.url)||'';
   if(/^https?:\/\//i.test(raw)){
     try{
       const host=new URL(raw).hostname.toLowerCase();
       if(host==='api-web.nhle.com'||host==='api.nhle.com'){
         return original('/proxy?url='+encodeURIComponent(raw),options);
       }
     }catch(e){}
   }
   return original(resource,options);
 };
 window.__MC_NHL_SAME_ORIGIN__=true;
})();
</script>"""
MENU='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Man Cave Sports Book — Onn TV</title>
<style>body{margin:0;min-height:100vh;background:#07111c;color:white;font-family:Arial;text-align:center}main{margin:auto;max-width:850px;padding:6vh 5vw}
h2{color:#f1c76b;letter-spacing:.17em}h1{font-size:clamp(30px,6vw,60px)}a{display:block;padding:22px 12px;border:2px solid #cfb372;border-radius:12px;margin:20px 0;background:#183049;color:white;text-decoration:none;font-size:clamp(18px,2.8vw,32px);font-weight:bold}p{color:#b7cada}</style>
</head><body><main><h2>MAN CAVE SPORTS BOOK</h2><h1>28 APPROVED TEAM BOARDS</h1><p>Choose the orientation that makes your Onn TV upright.</p>
<a href="/?rotate=cw">ROTATE CLOCKWISE 90°</a><a href="/?rotate=ccw">ROTATE COUNTERCLOCKWISE 90°</a><a href="/?rotate=off">ALREADY PORTRAIT / NO ROTATION</a>
<p>Original v8l design · 30 seconds per page · 7-second player spotlights</p></main></body></html>'''

class Handler(original.Handler):
    def end_headers(self):
        # The immutable, checksum-verified board HTML can be cached for a day
        # so each Onn rotation doesn't re-download 200MB of approved artwork.
        # Live scoreboard/API requests remain uncached.
        path=urlsplit(self.path).path
        immutable=(path.startswith(('/production/board/','/hosted/','/boards/','/remote/'))
                   or path in ('/production/spotlight-state.js','/production/board-runtime.js'))
        # Modified only in transit; never let a stale on-stick copy of the
        # repaired basketball boards or NFL Page 2 persist for 24 hours.
        if path in ('/production/board/page4_celtics','/production/board/page4_arizona_cbb',
                    '/production/board/page4_bruins','/production/board/page2_nfl',
                    '/production/board/page2_cbb','/production/board/page1_cbb'):
            immutable=False
        if self.command=='GET' and immutable:
            self.send_header('Cache-Control','public, max-age=86400')
            self.send_header('X-Content-Type-Options','nosniff')
            return SimpleHTTPRequestHandler.end_headers(self)
        return super().end_headers()
    def reply(self,body,ct="text/plain; charset=utf-8",status=200):
        if isinstance(body,str):body=body.encode()
        self.send_response(status)
        self.send_header("Content-Type",ct)
        self.send_header("Content-Length",str(len(body)))
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.end_headers()
        try:self.wfile.write(body)
        except (BrokenPipeError,ConnectionResetError):pass
    def do_GET(self):
        p=urlsplit(self.path);path=p.path
        if path=="/healthz":
            return self.reply('{"ok":true,"boards":28,"mode":"cloud"}',"application/json")
        if path in ("/onn","/onn/") or (path=="/" and not parse_qs(p.query).get("rotate")):
            return self.reply(MENU,"text/html; charset=utf-8")
        # Original approved v8l boards use these versioned root-level runtime
        # scripts to update ALL league/team pages from /api/board/<id>.
        # Earlier cloud allowlist accidentally returned 404 for every script,
        # leaving October snapshot HTML visible indefinitely.
        if path=="/runtime.css":
            file=original.GOLD/"runtime.css"
            return self.reply(file.read_bytes(),"text/css; charset=utf-8")
        if path.startswith("/runtime_") and path.endswith(".js"):
            import re
            if not re.fullmatch(r"/runtime_[a-zA-Z0-9_-]+\.js",path):
                return self.reply("Invalid runtime path",status=404)
            file=original.GOLD/path.lstrip("/")
            if not file.is_file():
                return self.reply("Runtime script not found",status=404)
            if path=="/runtime_cbb_p1_v7k.js" and parse_qs(p.query).get("board",[""])[0]=="page1_cbb":
                source=cbb_tournament_view.patch_runtime(file.read_text(encoding="utf-8"))
                return self.reply(source,"application/javascript; charset=utf-8")
            return self.reply(file.read_bytes(),"application/javascript; charset=utf-8")
        if path=="/production/api/bracketology-status":
            try:
                return self.reply(json.dumps(bracketology_source.cached(),separators=(',',':')),"application/json")
            except Exception as e:
                print("ESPN Bracketology metadata check unavailable:",type(e).__name__,str(e)[:160],flush=True)
                return self.reply('{"status":"unavailable","completeProjectedBracket":false}',"application/json",503)
        if path=="/production/bracketology-monitor.js":
            return self.reply((HERE/"bracketology-monitor.js").read_bytes(),"application/javascript")
        if path=="/production/api/draft-watch-stats":
            try:
                return self.reply(json.dumps(draft_watch_live.cached(),separators=(',',':')),"application/json")
            except Exception as e:
                print("Draft Watch current-season ESPN unavailable:",type(e).__name__,str(e)[:150],flush=True)
                return self.reply('{"error":"Current-season player statistics unavailable"}',"application/json",503)
        if path=="/production/live-draft-watch.js":
            return self.reply((HERE/"live-draft-watch.js").read_bytes(),"application/javascript")
        if path=="/production/api/page4-live":
            board=parse_qs(p.query).get("board",[""])[0]
            if board not in page4_live.TEAMS:
                return self.reply('{"error":"Unknown board"}',"application/json",404)
            try:
                data=page4_live.cached(board)
                return self.reply(json.dumps(data,separators=(',',':')),"application/json")
            except Exception as e:
                print("Current-season Page 4 data unavailable:",board,type(e).__name__,str(e)[:140],flush=True)
                return self.reply('{"error":"Current-season ESPN feed temporarily unavailable"}',"application/json",503)
        if path=="/production/live-nfl-page2.js":
            return self.reply((HERE/"live-nfl-page2.js").read_bytes(),"application/javascript")
        if path=="/production/live-page4-basketball.js":
            return self.reply((HERE/"live-page4-basketball.js").read_bytes(),"application/javascript")
        if path.startswith("/production/board/"):
            bid=path.rsplit("/",1)[-1]
            if bid in page4_live.TEAMS or bid in ('page4_bruins','page2_cbb','page1_cbb'):
                try:
                    html=original.adapt_board(original.BY_ID[bid])
                    if bid in page4_live.TEAMS:
                        html=page4_patch.patch_html(bid,html)
                    elif bid=='page4_bruins':
                        if html.count('<head>')!=1:raise RuntimeError('Approved Bruins head anchor changed')
                        html=html.replace('<head>','<head>'+NHL_FETCH_SHIM,1)
                    elif bid=='page2_cbb':
                        if html.count('</body>')!=1:raise RuntimeError('Approved Draft Watch body anchor changed')
                        html=html.replace('</body>','<script defer src="/production/live-draft-watch.js?v=20261115-1"></script></body>',1)
                    elif bid=='page1_cbb':
                        html=cbb_tournament_view.patch_html(html)
                        if html.count('</body>')!=1:raise RuntimeError('Approved NCAA bracketology monitor body anchor changed')
                        html=html.replace('</body>','<script defer src="/production/bracketology-monitor.js?v=20261115-1"></script></body>',1)
                    return self.reply(html,"text/html; charset=utf-8")
                except Exception as e:
                    print("Page 4 cloud data-only adapter error:",bid,str(e)[:200],flush=True)
                    return self.reply("Page 4 repair temporarily unavailable","text/plain",500)
        if path=="/production/api/state":
            # Spotlight persistence is browser-local, never shared across public visitors.
            return self.reply('{"spots":{},"playback":{}}',"application/json")
        if path=="/" and parse_qs(p.query).get("rotate"):
            choice=parse_qs(p.query).get("rotate",["off"])[0]
            if choice not in ("cw","ccw","off"):choice="off"
            html=(APP/"production"/"player.html").read_text()
            anchor='<script defer src="/production/player.js"></script>'
            if html.count(anchor)!=1:return self.reply("Approved player anchor changed",status=500)
            fitmode=parse_qs(p.query).get("fit",["fill"])[0]
            if fitmode not in ("fill","contain"):fitmode="fill"
            html=html.replace(anchor,"<script>window.__MC_ONN_ROTATION__="+json.dumps(choice)+";window.__MC_TV_FIT__="+json.dumps(fitmode)+";</script>"+anchor)
            return self.reply(html,"text/html; charset=utf-8")
        if path=="/production/player.js":
            js=(APP/"production"/"player.js").read_text()
            if js.count(ORIGINAL_FIT)!=1:return self.reply("Approved fit anchor changed",status=500)
            js=js.replace(ORIGINAL_FIT,NEW_FIT)
            # Versioned frames prevent the prior 24h browser cache from
            # retaining the old stat-only Page 4 HTML. Other boards unchanged.
            frame_marker="frame.src='/production/board/'+encodeURIComponent(board.id);"
            if js.count(frame_marker)!=1:
                return self.reply("Approved player frame source changed",status=500)
            js=js.replace(frame_marker,"frame.src='/production/board/'+encodeURIComponent(board.id)+(['page4_celtics','page4_arizona_cbb','page4_bruins','page2_nfl','page2_cbb','page1_cbb'].includes(board.id)?'?stats=20261115-v5':'');")
            return self.reply(js,"application/javascript")
        allowed=path in ("/production","/production/","/production/boards.json","/production/api/health","/production/diagnostics","/review","/proxy")
        allowed=allowed or path.startswith(("/api/board/","/production/board/","/hosted/","/boards/","/remote/"))
        allowed=allowed or (path.startswith("/production/") and path.lower().endswith((".html",".js",".json",".css")))
        if not allowed:return self.reply("Not found",status=404)
        # The original local server verifies Host=localhost; adapt internally
        # only after authorizing paths, retaining its identical data and render code.
        if self.headers.get("Host"):self.headers.replace_header("Host","127.0.0.1")
        else:self.headers["Host"]="127.0.0.1"
        return super().do_GET()
    def do_POST(self):
        path=urlsplit(self.path).path
        if path not in ("/production/api/state","/production/api/heartbeat"):
            return self.reply("Not found",status=404)
        origin=self.headers.get("Origin","")
        if origin:
            h=urlsplit(origin)
            request_host=self.headers.get("Host","").split(":")[0]
            if h.hostname!=request_host and h.hostname not in ("localhost","127.0.0.1"):
                return self.reply("Origin mismatch",status=403)
        try:
            size=int(self.headers.get("Content-Length","0"))
            if size<=0 or size>250000:return self.reply("Invalid size",status=400)
            self.rfile.read(size)
        except (ValueError,OSError):return self.reply("Invalid data",status=400)
        # Acknowledge approved player state writes; localStorage is source of truth.
        return self.reply('{"ok":true}',"application/json")
    def log_message(self,fmt,*args):
        if args and str(args[1] if len(args)>1 else "").startswith(("4","5")):
            print("HTTP",self.command,urlsplit(self.path).path,*args[:2],flush=True)

class Server(ThreadingHTTPServer):
    daemon_threads=True
    allow_reuse_address=True

if __name__=="__main__":
    server=Server(("0.0.0.0",int(os.environ.get("PORT","8767"))),Handler)
    server.born=time.monotonic()
    print("Man Cave approved v8l player — cloud adapter ready",flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
