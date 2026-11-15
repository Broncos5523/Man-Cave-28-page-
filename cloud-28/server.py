#!/usr/bin/env python3
"""Browser/cloud adapter; original 28 approved board files remain byte-identical."""
import json,os,sys,time
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from http.server import ThreadingHTTPServer

HERE=Path(__file__).resolve().parent
APP=HERE/"source"/"MAN_CAVE_28_BOARD_FINAL_PRODUCTION_v1"
if not (APP/"production_server.py").is_file():
    raise SystemExit("Approved archive unavailable. The cloud build must first run prepare.py.")
sys.path.insert(0,str(APP))
import production_server as original
os.chdir(original.GOLD)

ORIGINAL_FIT="function fit(){const w=Math.min(innerWidth,innerHeight*9/16),h=w*16/9;Object.assign(stage.style,{width:w+'px',height:h+'px',left:(innerWidth-w)/2+'px',top:(innerHeight-h)/2+'px'});}"
NEW_FIT="""function fit(){const mode=window.__MC_ONN_ROTATION__||'off';
if(mode!=='off'&&innerWidth>innerHeight){
const w=Math.min(innerHeight,innerWidth*9/16),h=w*16/9;
Object.assign(stage.style,{width:w+'px',height:h+'px',left:'50%',top:'50%',transformOrigin:'center center',transform:'translate(-50%,-50%) rotate('+(mode==='ccw'?'-90':'90')+'deg)'});
}else{const w=Math.min(innerWidth,innerHeight*9/16),h=w*16/9;Object.assign(stage.style,{width:w+'px',height:h+'px',left:(innerWidth-w)/2+'px',top:(innerHeight-h)/2+'px',transform:'none',transformOrigin:'center center'});}}"""
MENU='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Man Cave Sports Book — Onn TV</title>
<style>body{margin:0;min-height:100vh;background:#07111c;color:white;font-family:Arial;text-align:center}main{margin:auto;max-width:850px;padding:6vh 5vw}
h2{color:#f1c76b;letter-spacing:.17em}h1{font-size:clamp(30px,6vw,60px)}a{display:block;padding:22px 12px;border:2px solid #cfb372;border-radius:12px;margin:20px 0;background:#183049;color:white;text-decoration:none;font-size:clamp(18px,2.8vw,32px);font-weight:bold}p{color:#b7cada}</style>
</head><body><main><h2>MAN CAVE SPORTS BOOK</h2><h1>28 APPROVED TEAM BOARDS</h1><p>Choose the orientation that makes your Onn TV upright.</p>
<a href="/?rotate=cw">ROTATE CLOCKWISE 90°</a><a href="/?rotate=ccw">ROTATE COUNTERCLOCKWISE 90°</a><a href="/?rotate=off">ALREADY PORTRAIT / NO ROTATION</a>
<p>Original v8l design · 30 seconds per page · 7-second player spotlights</p></main></body></html>'''

class Handler(original.Handler):
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
        if path=="/production/api/state":
            # Spotlight persistence is browser-local, never shared across public visitors.
            return self.reply('{"spots":{},"playback":{}}',"application/json")
        if path=="/" and parse_qs(p.query).get("rotate"):
            choice=parse_qs(p.query).get("rotate",["off"])[0]
            if choice not in ("cw","ccw","off"):choice="off"
            html=(APP/"production"/"player.html").read_text()
            anchor='<script defer src="/production/player.js"></script>'
            if html.count(anchor)!=1:return self.reply("Approved player anchor changed",status=500)
            html=html.replace(anchor,"<script>window.__MC_ONN_ROTATION__="+json.dumps(choice)+";</script>"+anchor)
            return self.reply(html,"text/html; charset=utf-8")
        if path=="/production/player.js":
            js=(APP/"production"/"player.js").read_text()
            if js.count(ORIGINAL_FIT)!=1:return self.reply("Approved fit anchor changed",status=500)
            return self.reply(js.replace(ORIGINAL_FIT,NEW_FIT),"application/javascript")
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
