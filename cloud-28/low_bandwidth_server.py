#!/usr/bin/env python3
"""EXPERIMENTAL low-bandwidth sidecar for the approved v8l board server.

Original 742-item verified release and all original board HTML remain untouched.
On each response, extract base64 data:image URLs into immutable same-origin assets.
This preserves exact image bytes and original layout while allowing browser caching.
Not the active Render start command: cloud-28/server.py remains production.
"""
import base64
import binascii
import hashlib
import mimetypes
import os
import re
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote

import importlib.util
import sys

# Load cloud adapter under a unique name. The approved Gold Master has its own
# module called "server"; importing cloud-28/server.py as "server" would shadow
# that original module and create a circular import.
_adapter_path=Path(__file__).with_name("server.py")
_spec=importlib.util.spec_from_file_location("man_cave_cloud_adapter",_adapter_path)
approved=importlib.util.module_from_spec(_spec)
sys.modules[_spec.name]=approved
_spec.loader.exec_module(approved)

ORIGIN_ROOT = approved.original.GOLD
ASSET_ROOT = Path(__file__).resolve().parent / "_inline_asset_cache"
ASSET_ROOT.mkdir(parents=True, exist_ok=True)
MIME_EXT = {
    "png": "png", "jpeg": "jpg", "jpg": "jpg", "webp": "webp",
    "gif": "gif", "svg+xml": "svg", "avif": "avif", "bmp": "bmp"
}
INLINE_RE = re.compile(
    rb"data:image/(png|jpeg|jpg|webp|gif|svg\+xml|avif|bmp);base64,([A-Za-z0-9+/=]+)",
    re.I
)
FILE_RE = re.compile(r"^/cdn-inline/([a-f0-9]{64})\.(png|jpg|webp|gif|svg|avif|bmp)$")
MIMES = {"svg": "image/svg+xml", "jpg": "image/jpeg", "png": "image/png",
         "webp": "image/webp", "gif": "image/gif", "avif": "image/avif",
         "bmp": "image/bmp"}
STATS = {"decoded": 0, "replacements": 0, "errors": 0}

def optimize_html(raw: bytes) -> bytes:
    """Only replace actual image data URLs. No visual markup or JS changes."""
    if b"data:image/" not in raw.lower():
        return raw
    def sub(match):
        kind=match.group(1).decode("ascii").lower()
        ext=MIME_EXT[kind]
        encoded=match.group(2)
        try:
            image=base64.b64decode(encoded,validate=True)
            if not image: raise ValueError("empty embedded image")
        except (ValueError, binascii.Error):
            STATS["errors"]+=1
            return match.group(0)    # Never break unrecognized/invalid originals
        digest=hashlib.sha256(image).hexdigest()
        filename=ASSET_ROOT / (digest+"."+ext)
        if not filename.is_file():
            try:
                with filename.open("xb") as f: f.write(image)
                STATS["decoded"]+=len(image)
            except FileExistsError:
                pass
        STATS["replacements"]+=1
        return ("/cdn-inline/"+digest+"."+ext).encode("ascii")
    return INLINE_RE.sub(sub,raw)

def prime_approved_assets():
    """Populate image cache at start, so cached HTML survives server restarts."""
    total=0
    html_files=sorted(ORIGIN_ROOT.rglob("*.html"))
    for p in html_files:
        try:
            content=p.read_bytes()
        except OSError:
            continue
        total+=1
        optimize_html(content)
    print("Low-bandwidth sidecar ready:",
          total, "approved HTML pages checked;",
          len(list(ASSET_ROOT.iterdir())), "unique original images;",
          round(STATS["decoded"]/1048576,1), "MiB of image assets;",
          STATS["errors"], "unreadable image URLs",flush=True)
    if STATS["errors"]:
        raise RuntimeError("Some embedded images failed extraction; refusing experimental startup")

class Handler(approved.Handler):
    """Derive from working production handler; override delivery only."""

    def reply(self,body,ct="text/plain; charset=utf-8",status=200):
        path=urlsplit(self.path).path
        if self.command=="GET" and status==200 and path.startswith("/production/board/") and ct.startswith("text/html"):
            body=optimize_html(body.encode("utf-8") if isinstance(body,str) else body)
        return super().reply(body,ct,status)

    def respond(self,body,*args,**kwargs):
        # Most original Gold Master pages use production_server.Handler.respond()
        # rather than the cloud adapter's reply(). Both paths must be optimized.
        path=urlsplit(self.path).path
        if self.command=="GET" and path.startswith("/production/board/"):
            body=optimize_html(body.encode("utf-8") if isinstance(body,str) else body)
        return super().respond(body,*args,**kwargs)

    def do_GET(self):
        path=unquote(urlsplit(self.path).path)
        asset=FILE_RE.fullmatch(path)
        if asset:
            digest,ext=asset.groups()
            file=ASSET_ROOT/(digest+"."+ext)
            if not file.is_file():return self.reply("Image unavailable",status=404)
            # Path is exact digest + allowlisted extension, preventing traversal.
            return self.reply(file.read_bytes(),MIMES[ext])
        if path.startswith("/cdn-inline/"):
            return self.reply("Invalid image path",status=404)
        return super().do_GET()

    def send_response(self,code,message=None):
        self._mc_code=code
        return super().send_response(code,message)

    def end_headers(self):
        # Parent reply() always writes no-store. Remove conflicting Cache-Control
        # so the client actually uses immutable caching on extracted images.
        path=unquote(urlsplit(self.path).path)
        status=getattr(self,"_mc_code",200)
        cache="no-store"
        if self.command=="GET" and status==200:
            if FILE_RE.fullmatch(path):
                cache="public, max-age=31536000, immutable"
            elif path.startswith(("/assets/","/hosted/","/boards/","/remote/")) and path.lower().endswith(
                (".png",".jpeg",".jpg",".webp",".gif",".avif",".svg",".woff",".woff2",".ttf")
            ):
                cache="public, max-age=604800"
            elif path.startswith("/production/board/") and path.rsplit("/",1)[-1] not in (
                "page4_celtics","page4_arizona_cbb","page4_bruins",
                "page2_nfl","page2_cbb","page1_cbb"
            ):
                cache="public, max-age=1800"
        # BaseHTTPRequestHandler sends its headers using this buffer.
        self._headers_buffer=[
            item for item in getattr(self,"_headers_buffer",[])
            if not item.lower().startswith(b"cache-control:")
        ]
        self.send_header("Cache-Control",cache)
        return SimpleHTTPRequestHandler.end_headers(self)

if __name__=="__main__":
    prime_approved_assets()
    service=ThreadingHTTPServer(("0.0.0.0",int(os.environ.get("PORT","8767"))),Handler)
    service.daemon_threads=True
    service.allow_reuse_address=True
    print("Man Cave low-bandwidth v8l DELIVERY TEST ONLY; original graphics unchanged",flush=True)
    try:service.serve_forever()
    except KeyboardInterrupt:pass
    finally:service.server_close()
