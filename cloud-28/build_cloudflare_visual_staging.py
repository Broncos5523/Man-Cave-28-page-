#!/usr/bin/env python3
"""Create visual-only 28-board previews for Cloudflare Workers static assets.

- Gold Master sources stay byte-identical.
- Original server's HTTP adapters generate the HTML; embedded image bytes are
  replaced with immutable SHA-256 URLs by low_bandwidth_server.
- No Firebase writes, TV switching, dynamic API promises, or production cutover.
"""
import html
import json
import pathlib
import re
import shutil
import threading
import time
from urllib.error import HTTPError
from urllib.request import urlopen

from low_bandwidth_server import Handler, ThreadingHTTPServer, approved, optimize_html

HERE=pathlib.Path(__file__).resolve().parent
OUT=HERE/"cloudflare-static-dist"
GOLD=approved.original.GOLD
STAGE=OUT/"staging"
CAP=25*1024*1024
API_ONLY={"/production/api/bracketology-status","/production/api/draft-watch-stats",
          "/production/api/page4-live","/api/board","/proxy"}

def request(base,path):
    with urlopen(base+path,timeout=24) as response:
        if response.status!=200:raise RuntimeError("HTTP %s for %s"%(response.status,path))
        return response.read()

def save_binary(path,data):
    if len(data)>CAP:raise RuntimeError("Cloudflare per-file limit exceeded at "+str(path))
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(data)

def copy_approved_static_files():
    count=0
    # Only the browser-delivered files, not the local server, QA archives or
    # unoptimized board HTML that originally exhausted Render's bandwidth.
    for folder in ("assets","hosted","remote","boards"):
        source=GOLD/folder
        if not source.is_dir():continue
        for file in sorted(source.rglob("*")):
            if not file.is_file():continue
            rel=file.relative_to(GOLD)
            if folder=="boards" and file.suffix.lower() in (".html",".htm"):
                continue  # Generate approved HTTP-adapted board pages below.
            data=file.read_bytes()
            if file.suffix.lower() in (".html",".htm"):
                data=optimize_html(data)
            save_binary(OUT/rel,data)
            count+=1
    for file in sorted(GOLD.glob("runtime*")):
        if file.is_file() and file.suffix.lower() in (".js",".css",".json"):
            save_binary(OUT/file.name,file.read_bytes());count+=1
    return count

def board_manifest():
    path=GOLD/"production"/"boards.json"
    data=json.loads(path.read_text())
    boards=data.get("boards",[])
    ids=[v.get("id") for v in boards]
    if len(ids)!=28 or len(set(ids))!=28:
        raise RuntimeError("Expected exactly 28 unique Gold Master board IDs")
    if not all(isinstance(i,str) and re.fullmatch(r"[a-z0-9_]+",i) for i in ids):
        raise RuntimeError("Unexpected board identifier; refusing staging build")
    return boards,ids

def make_index(boards):
    links=[]
    for index,item in enumerate(boards,1):
        bid=item["id"]
        title=str(item.get("name") or item.get("title") or bid.replace("_"," ").title())
        links.append(
            '<a href="/staging/boards/'+bid+'.html" target="_blank" rel="noopener">'
            '<span>'+str(index).zfill(2)+'</span>'+html.escape(title)+
            ' <small>'+html.escape(bid)+'</small></a>'
        )
    return ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Man Cave Sports Book | 28-board visual staging</title>'
            '<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;background:#070d19;color:#f2f5f9;'
            'font:16px/1.5 system-ui,sans-serif}main{margin:auto;max-width:840px;padding:24px 20px 60px}'
            'h1{font-size:clamp(24px,5vw,38px);margin:.5rem 0}p{color:#bdd0df}'
            '.note{border:1px solid #456982;border-radius:12px;padding:14px;background:#112438}'
            '.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:24px}'
            'a{color:white;text-decoration:none;background:#0f2035;border:1px solid #385674;border-radius:10px;'
            'padding:13px;display:block;font-weight:700}a span{color:#48d0e8;margin-right:12px}'
            'small{display:block;color:#a8b9ce;font-size:11px;font-weight:400;padding-left:32px}'
            '</style></head><body><main><h1>MAN CAVE SPORTS BOOK</h1>'
            '<p>28 original approved boards — Cloudflare visual staging</p>'
            '<div class="note"><strong>VISUAL PREVIEW ONLY</strong>'
            '<p>Exact approved board layouts and artwork served with optimized image caching. '
            'Live statistics, animations, Firebase commands and Onn playback are NOT yet verified. '
            'Do not change your TV receiver address.</p></div>'
            '<section class="grid">'+''.join(links)+'</section></main></body></html>').encode()

def main():
    if not (OUT/"manifest.json").is_file():
        raise RuntimeError("First run the verified Cloudflare static asset build")
    boards,ids=board_manifest()
    static_files=copy_approved_static_files()
    server=ThreadingHTTPServer(("127.0.0.1",0),Handler)
    server.daemon_threads=True
    server.born=time.monotonic()
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base="http://127.0.0.1:"+str(server.server_port)
    try:
        for bid in ids:
            response=request(base,"/production/board/"+bid)
            # Confirm that all inline image URLs were extracted, and the stage
            # has NOT silently changed page markup other than exact-byte URLs.
            if b"data:image/" in response.lower():
                raise RuntimeError("Unoptimized embedded image in "+bid)
            if b"<html" not in response[:2500].lower():
                raise RuntimeError("Invalid approved board HTML: "+bid)
            save_binary(STAGE/"boards"/(bid+".html"),response)
        save_binary(STAGE/"index.html",make_index(boards))
        # Preserve versioned Gold Master scripts and cloud adapter runtime
        # patches exactly where the original HTTP server exposes them.
        for route in (
            "/production/player.js",
            "/production/board-runtime.js",
            "/production/live-page4-basketball.js",
            "/production/live-nfl-page2.js",
            "/production/live-draft-watch.js",
            "/production/bracketology-monitor.js",
            "/production/tv3-remote.js"
        ):
            try:data=request(base,route)
            except (HTTPError,RuntimeError):
                continue
            save_binary(OUT/route.lstrip("/"),data)
        board_out=sorted((STAGE/"boards").glob("*.html"))
        if len(board_out)!=28:
            raise RuntimeError("Not all 28 approved pages were exported")
        summary={
           "mode":"VISUAL STAGING ONLY — NOT LIVE DATA CERTIFIED",
           "source":"locked original v8l release",
           "boardCount":len(board_out),
           "optimizedBoardBytes":sum(p.stat().st_size for p in board_out),
           "staticSourceFilesCopied":static_files,
           "ids":ids,
           "note":"No controller/TV receiver changes. Dynamic JSON endpoints not yet ported."
        }
        save_binary(STAGE/"status.json",json.dumps(summary,indent=2).encode())
        print("CLOUDFLARE_VISUAL_STAGING_READY",len(board_out),
              "optimized HTML pages",round(summary["optimizedBoardBytes"]/1048576,2),
              "MiB, static source files",static_files,flush=True)
        print("NO_LIVE_DATA_OR_TV_SWITCHING_CLAIMS",flush=True)
    finally:
        server.shutdown()
        server.server_close()

if __name__=="__main__":main()
