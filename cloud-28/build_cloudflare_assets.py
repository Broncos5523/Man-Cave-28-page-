#!/usr/bin/env python3
"""Build exact-image-byte Cloudflare Pages static asset deployment from locked v8l.

Static asset staging ONLY. Does not replace live dynamic player or Xfinity/Yahoo.
Run after: python cloud-28/prepare.py
Cloudflare Pages build command:
  python cloud-28/prepare.py && python cloud-28/build_cloudflare_assets.py
Output directory: cloud-28/cloudflare-static-dist
"""
import hashlib
import json
import shutil
from pathlib import Path
from low_bandwidth_server import prime_approved_assets, ASSET_ROOT

HERE=Path(__file__).resolve().parent
OUT=HERE/"cloudflare-static-dist"
IMAGE_OUT=OUT/"cdn-inline"
CAP=25*1024*1024
def main():
    prime_approved_assets()
    if OUT.exists():shutil.rmtree(OUT)
    IMAGE_OUT.mkdir(parents=True)
    files=sorted(p for p in ASSET_ROOT.iterdir() if p.is_file())
    if len(files)<300:
        raise RuntimeError("Expected original approved image inventory (>=300 assets)")
    entries=[]
    for p in files:
        blob=p.read_bytes()
        digest=p.name.split(".",1)[0]
        if hashlib.sha256(blob).hexdigest()!=digest:
            raise RuntimeError("Original image checksum mismatch: "+p.name)
        if len(blob)>CAP:
            raise RuntimeError("Individual static asset exceeds Cloudflare 25 MiB: "+p.name)
        shutil.copyfile(p,IMAGE_OUT/p.name)
        entries.append({"path":"/cdn-inline/"+p.name,"bytes":len(blob),"sha256":digest})
    manifest={
        "name":"Man Cave Sports Book original v8l image CDN (staging)",
        "original_release_sha256":"e6651aa3db2dae42f38d693f1e6690de7009a0a6e34ed6ee0bc2a26cabbeed3f",
        "assetCount":len(entries),
        "totalBytes":sum(e["bytes"] for e in entries),
        "status":"static-image-staging-only; original boards and dynamic APIs not hosted here",
        "assets":entries,
    }
    (OUT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
    (OUT/"_headers").write_text(
        "/cdn-inline/*\n  Cache-Control: public, max-age=31536000, immutable\n"
        "/manifest.json\n  Cache-Control: no-cache\n"
    )
    (OUT/"index.html").write_text(
        "<!doctype html><html lang='en'><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>Man Cave Sports Book - Asset Staging</title>"
        "<body style='font:16px system-ui;background:#080f1c;color:#eee;padding:2rem'>"
        "<h1>Man Cave Sports Book</h1>"
        "<p>Static artwork staging verified. This is not the live 28-board player.</p>"
        "<p>Original approved board designs, TV receivers, and game data services remain unchanged.</p>"
        "</body></html>"
    )
    print("CLOUDFLARE_STATIC_READY",len(entries),"assets",
          round(manifest["totalBytes"]/1048576,2),"MiB")
    print("OUTPUT_DIRECTORY",OUT.as_posix())
    print("NO_PRODUCTION_URL_OR_CONTROLLER_CHANGES")
if __name__=="__main__":
    main()
