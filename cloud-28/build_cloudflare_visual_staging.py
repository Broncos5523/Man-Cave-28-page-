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
import cbb_tournament_view
import page4_patch
from staging_runtime_images import clone_staging_runtimes, rewrite_staging_script_links
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
    # Original live tickers are dynamically imported by approved runtime JS.
    # They must retain their original root URLs and byte-for-byte contents.
    for pattern in ("runtime*","ticker_*_final.mjs"):
        for file in sorted(GOLD.glob(pattern)):
            if file.is_file() and file.suffix.lower() in (".js",".mjs",".css",".json"):
                save_binary(OUT/file.name,file.read_bytes());count+=1
    return count

def board_manifest():
    path=approved.APP/"production"/"boards.json"
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
            '<a href="/staging/boards/'+bid+'" target="_blank" rel="noopener">'
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
            '<div class="note"><strong>28 ORIGINAL BOARDS — CLOUDFLARE STAGING</strong>'
            '<p>All 28 approved layouts and live-data renderers passed automated browser verification '
            'on November 17, 2026. Real Onn TV playback and production controller routing '
            'have NOT been physically verified. '
            'Keep the existing TV receiver address until physical testing and approval.</p>'
            '<p><a href="https://github.com/Broncos5523/Man-Cave-28-page-/blob/cloudflare-batch-results/latest.md" '
            'target="_blank" rel="noopener">View latest independent verification evidence</a></p></div>'
            '<p><a style="background:#19314b;border-color:#4df0bd;color:#fff" href="/staging/player.html?rotate=off">'
            '▶ Open original 28-board rotation preview (30 seconds per page)</a></p>'
            '<p><a href="/staging/tv3.html?rotate=off">Test 32-inch Onn Firebase receiver (read-only assignments)</a></p>'
            '<p><a href="/staging/device-check.html">Check this TV/browser and preview rotation before cutover</a></p>'
            '<section class="grid">'+''.join(links)+'</section></main></body></html>').encode()

def main():
    if not (OUT/"manifest.json").is_file():
        raise RuntimeError("First run the verified Cloudflare static asset build")
    boards,ids=board_manifest()
    static_files=copy_approved_static_files()
    staging_runtime_names,staging_image_helpers=clone_staging_runtimes(OUT)
    staging_runtime_refs=0
    server=ThreadingHTTPServer(("127.0.0.1",0),Handler)
    server.daemon_threads=True
    server.born=time.monotonic()
    threading.Thread(target=server.serve_forever,daemon=True).start()
    base="http://127.0.0.1:"+str(server.server_port)
    try:
        # The Arizona football page is a nested app. Export its original HTTP
        # lifecycle adapters too; raw files omit the rotation bridge. Cloudflare
        # canonicalizes index.html to a directory URL, so adapt that route only.
        for rel in (
            'hosted/page4_arizona_cfb/index.html',
            'hosted/page4_arizona_cfb/_assets/index-BpJce90E.js',
            'hosted/page4_arizona_cfb/_assets/arizona-football-page4-CtvpXjud.js',
        ):
            data=request(base,'/'+rel)
            if rel=='hosted/page4_arizona_cfb/index.html':
                # The approved nested app renders its visual content correctly
                # but does not declare the original player MCBoard lifecycle.
                # Its OUTER wrapper waits for child.MCBoard.ready, so 20s
                # later it signals a false load failure and the rotation stalls.
                # Restore the already-approved production lifecycle module in
                # the nested STAGING delivery only (never in the Gold Master).
                # It confirms actual #root content, image/font readiness and
                # animation frames before announcing ready. No fake signal.
                if b'/production/board-runtime.js' in data or b'__MC_PRODUCTION_BOARD' in data:
                    raise RuntimeError('Arizona nested lifecycle already present; review before exporting')
                head=re.search(rb'<head\b[^>]*>',data,re.I)
                if not head:
                    raise RuntimeError('Arizona nested app lacks expected head anchor')
                bridge=(b'<script>window.__MC_PRODUCTION_BOARD="page4_arizona_cfb";</script>'
                        b'<script src="/staging/board-runtime-ancestor.js"></script>')
                data=data[:head.end()]+bridge+data[head.end():]
            if rel.endswith('index-BpJce90E.js'):
                old=b'"/hosted/page4_arizona_cfb/index.html"'
                if data.count(old)!=1:raise RuntimeError('Arizona nested app route changed')
                data=data.replace(old,b'"/hosted/page4_arizona_cfb/"',1)
            save_binary(OUT/rel,data)
        # Export a staging-only copy of the ORIGINAL readiness bridge. The
        # original bridge hardcodes host=window.top, which becomes GitHub
        # Pages (cross-origin) when the approved Cloudflare player is placed
        # inside the left/right Fire TV receiver iframe. In that layout
        # page2_nfl never marks ready and 30-second rotation stalls.
        # Find the nearest same-origin parent with the ORIGINAL spotlight
        # state/store instead. This does not forge readiness or alter the
        # approved 30-second timer, renderer, assets or original runtime.
        original_bridge=request(base,"/production/board-runtime.js")
        source=b'const host=window.top;'
        if original_bridge.count(source)!=1:
            raise RuntimeError("Original board runtime host anchor changed; review before staging")
        resolver=(b'const host=(()=>{'
                  b'let cursor=window,candidate=window;'
                  b'for(let depth=0;depth<8;depth++){'
                  b'let parent;try{parent=cursor.parent;}catch(e){break;}'
                  b'if(!parent||parent===cursor)break;'
                  b'try{'
                  b'if(parent.MCSpotlightState&&parent.MCStore){'
                  b'if(parent.__MC_PRODUCTION)return parent;'
                  b'if(candidate===window)candidate=parent;'
                  b'}'
                  b'}catch(e){break;}'
                  b'cursor=parent;'
                  b'}return candidate;'
                  b'})();')
        safe_bridge=original_bridge.replace(source,resolver,1)
        save_binary(STAGE/"board-runtime-ancestor.js",safe_bridge)
        for bid in ids:
            response=request(base,"/production/board/"+bid)
            if bid=='page4_fever':
                # Render's existing Python API supports two basketball boards;
                # apply the third binding only in the Cloudflare staging export.
                response=page4_patch.patch_html(bid,response.decode()).encode()
            if bid=="page1_cbb":
                # Render added a 2027 snapshot-only display override. The
                # Cloudflare port must allow the untouched v8l data renderer to
                # select its verified historical recap. Do not mix that override
                # with the byte-identical original runtime copied above.
                override=(cbb_tournament_view.BOOT+cbb_tournament_view.CSS).encode()
                if response.count(override)!=1:
                    raise RuntimeError("CBB transport override anchor changed")
                response=response.replace(override,b"",1)
            # Only STAGING board HTML refers to the nesting-safe copy of
            # the ORIGINAL runtime. The Gold Master and /production asset
            # remain byte-identical; the resolver only changes host selection.
            runtime_ref=b'/production/board-runtime.js'
            runtime_replacement=b'/staging/board-runtime-ancestor.js'
            if bid=='page2_nfl' and response.count(runtime_ref)!=1:
                raise RuntimeError("Page2 NFL original runtime link missing; do not fake readiness")
            if runtime_ref in response:
                response=response.replace(runtime_ref,runtime_replacement)
            # Only staging board HTML uses transport-only runtime clones.
            # Root /runtime*.js (Gold Master originals) remain byte-identical.
            response,used_runtimes=rewrite_staging_script_links(response,staging_runtime_names)
            staging_runtime_refs+=len(used_runtimes)
            # Staging-only network shim runs BEFORE original inline scripts.
            # Original Gold Master stays untouched; fetch operations are
            # redirected solely to our strict same-origin Cloudflare relay.
            if b"data:image/" in response.lower():
                raise RuntimeError("Unoptimized embedded image in "+bid)
            if b"<html" not in response[:2500].lower():
                raise RuntimeError("Invalid approved board HTML: "+bid)
            match=re.search(rb"<head\b[^>]*>",response,flags=re.I)
            if not match:
                raise RuntimeError("Approved board head insertion point missing: "+bid)
            # These are supporting STAGING scripts, never Gold Master edits.
            # Original spotlight-state module is loaded before the board runtime
            # so the existing seven-second activation and resume logic work.
            scripts=(
                b'<script src="/production/spotlight-state.js"></script>'
                b'<script src="/staging/board-standalone-host.js?v=standalone-r1"></script>'
                b'<script src="/staging/espn-fetch-shim.js?v=public-cache-r1"></script>'
            )
            if b'/staging/espn-fetch-shim.js' in response:
                raise RuntimeError("Duplicate Cloudflare preview shim: "+bid)
            response=response[:match.end()]+scripts+response[match.end():]
            save_binary(STAGE/"boards"/(bid+".html"),response)
        if staging_runtime_refs < 20:
            raise RuntimeError("Expected at least 20 staged approved runtime links")
        print("STAGING_ONLY_ESPN_IMAGE_ROUTING",staging_image_helpers,
              "exact helper copies,",staging_runtime_refs,"board script links",flush=True)
        save_binary(OUT/"production"/"spotlight-state.js",(approved.APP/"production"/"spotlight-state.js").read_bytes())
        save_binary(STAGE/"board-standalone-host.js",(HERE/"cloudflare-standalone-board-host.js").read_bytes())
        save_binary(STAGE/"espn-fetch-shim.js",(HERE/"cloudflare-public-feed-shim.js").read_bytes())
        # Export the approved production player into a separate staging URL.
        # Only transport URLs are rewritten, not timing, animation, page order,
        # scoring/stat logic, spotlight state, or the Onn orientation fit.
        player_html=(approved.APP/"production"/"player.html").read_text()
        anchor='<script defer src="/production/player.js"></script>'
        if player_html.count(anchor)!=1:
            raise RuntimeError("Original player HTML changed; cannot stage safely")
        mode_script="""<script>
(function(){
 const q=new URLSearchParams(location.search);
 const rotate=q.get('rotate')||'off';
 window.__MC_ONN_ROTATION__=['cw','ccw','off'].includes(rotate)?rotate:'off';
 window.__MC_TV_FIT__=q.get('fit')==='contain'?'contain':'fill';
 window.__MC_STAGING_ROTATION__=true;
})();
</script>"""
        player_html=player_html.replace(anchor,mode_script+
            '<script src="/staging/local-state.js?v=local-r1"></script>'+
            '<script defer src="/staging/player.js"></script>')
        save_binary(STAGE/"local-state.js",(HERE/"staging-local-state.js").read_bytes())
        # Same existing /staging/player.html address now receives the
        # controller's screens/third assignments. Do not change the URL,
        # player animations, 28-board rotation, or Firebase write permissions.
        # /staging/tv3.html remains a compatible alias for previous links.
        remote=(HERE/"tv3-remote.js").read_text()
        start=remote.find("function report(event,detail){")
        stop=remote.find("window.__MC_TV3_REMOTE__=",start)
        if start<0 or stop<=start:
            raise RuntimeError("Approved TV3 telemetry wrapper changed")
        # No external event reporting in staging; browser-local diagnostic only.
        monitor="""function report(event,detail){
 try{
  var arr=window.__MC_TV3_STAGING_EVENTS__||(window.__MC_TV3_STAGING_EVENTS__=[]);
  arr.push({event:event,detail:String(detail||'').slice(0,90),at:Date.now()});
  if(arr.length>70)arr.shift();
 }catch(e){}
}
"""
        remote=remote[:start]+monitor+remote[stop:]
        old="/production/board/'+encodeURIComponent(desired)+'?tv3=hold"
        replacement="/staging/boards/'+encodeURIComponent(desired)+'?tv3=hold"
        if remote.count(old)!=1:
            raise RuntimeError("TV3 board selection URL changed")
        remote=remote.replace(old,replacement)
        if "app.database().ref('screens/third').on('value'" not in remote:
            raise RuntimeError("Existing TV3 Firebase receiver binding missing")
        if "database().ref('screens/third').set(" in remote:
            raise RuntimeError("TV3 receiver may not write assignments")
        # The controller receiver must run only as a top-level TV browser.
        # Never cause embedded 28-board players on wing TVs to consume the
        # independent Onn screens/third Firebase assignment.
        if remote.count("'use strict';")!=1:
            raise RuntimeError("TV3 receiver top-level guard insertion changed")
        # The 32-inch Onn browser may host the unchanged player URL in a
        # fullscreen app iframe. An unconditional top-window guard silently
        # disables Firebase control there. Exclude only the known GitHub Pages
        # Left/Right wing receiver origin; keep third-TV commands off wings.
        remote=remote.replace("'use strict';",
                              "'use strict';\n"+
                              "if(window.top!==window && (document.referrer||'').indexOf('https://broncos5523.github.io/')===0)return;",1)
        save_binary(STAGE/"tv3-remote.js",remote.encode())
        if player_html.count("</body>")!=1:
            raise RuntimeError("Original player HTML footer changed")
        player_html=player_html.replace("</body>",
            '<script defer src="/staging/tv3-remote.js?v=same-address-r1"></script></body>')
        save_binary(STAGE/"player.html",player_html.encode())
        tv3_html=player_html
        # The owner's fixed ?rotate=ccw receiver URL already orients the TV.
        # Do not overlay an on-screen Rotate tab/menu over approved content.
        # Preserve query-controlled cw/ccw/off and the Firebase receiver.
        # A read-only diagnostic overlay is enabled only when the TV URL
        # explicitly includes ?debug=1. The normal receiver stays clean.
        tv3_html=tv3_html.replace("</body>",
            '<script defer src="/staging/tv3-readonly-diagnostics.js?v=1"></script></body>')
        save_binary(STAGE/"tv3.html",tv3_html.encode())
        save_binary(STAGE/"tv3-readonly-diagnostics.js",
            (HERE/"tv3-readonly-diagnostics.js").read_bytes())
        player_js=request(base,"/production/player.js").decode()
        substitutions=[
            ("'/production/boards.json'","'/staging/boards.json'"),
            ("'/production/api/state'","'/staging/api/state'"),
            ("'/production/api/heartbeat'","'/staging/api/heartbeat'"),
            ("frame.src='/production/board/'+encodeURIComponent(board.id)",
             "frame.src='/staging/boards/'+encodeURIComponent(board.id)")
        ]
        for old,new in substitutions:
            if old not in player_js:
                raise RuntimeError("Original approved player transport anchor changed: "+old)
            player_js=player_js.replace(old,new)
        if "const DUR=30000;" not in player_js:
            raise RuntimeError("Approved 30-second rotation duration changed")
        if "frame.src='/staging/boards/'" not in player_js:
            raise RuntimeError("Original player staging frame transport unresolved")
        save_binary(STAGE/"player.js",player_js.encode())
        save_binary(STAGE/"boards.json",(approved.APP/"production"/"boards.json").read_bytes())
        save_binary(STAGE/"index.html",make_index(boards))
        # A separate diagnostic page checks device/browser readiness in place.
        # It does not access Firebase, send commands, or alter any board.
        save_binary(STAGE/"device-check.html",(HERE/"on-device-check.html").read_bytes())
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
           "mode":"STAGING; AUTOMATED 28/28 VERIFIED 2026-11-17; PHYSICAL ONN UNTESTED",
           "source":"locked original v8l release",
           "boardCount":len(board_out),
           "optimizedBoardBytes":sum(p.stat().st_size for p in board_out),
           "staticSourceFilesCopied":static_files,
           "ids":ids,
           "note":"All 28 board JSON adapters passed 2026-11-17 automated staging/browser verification. Physical Onn and production cutover are not approved.",
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
