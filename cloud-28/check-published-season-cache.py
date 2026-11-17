"""Verify the published GitHub Core cache is the exact fresh, Worker-readable dataset.

No tokens or private data. This runs after the scheduled refresh push; it
checks the unchanged public raw URL that the Cloudflare Worker consumes.
"""
import datetime
import hashlib
import json
import pathlib
import time
import urllib.request

URL = ("https://raw.githubusercontent.com/Broncos5523/"
       "Man-Cave-28-page-/cloudflare-live-data/espn-core-season-cache.json")
MAX_BYTES = 5 * 1024 * 1024
local = pathlib.Path("_current_data/espn-core-season-cache.json").read_bytes()
if len(local) > MAX_BYTES:
    raise SystemExit("Season-cache export exceeds Worker's five-MiB safety limit")
source = json.loads(local)
if source.get("schema") != 1 or not isinstance(source.get("entries"), dict):
    raise SystemExit("Invalid locally generated season-cache schema")
if len(source["entries"]) < 45:
    raise SystemExit("Incomplete locally generated season-cache entries")
stamp = datetime.datetime.fromisoformat(source["generatedAt"].replace("Z", "+00:00"))
if (datetime.datetime.now(datetime.timezone.utc) - stamp).total_seconds() > 900:
    raise SystemExit("Locally generated season-cache data is already too old")
expected_hash = hashlib.sha256(local).hexdigest()

last_error = "not attempted"
for attempt in range(8):
    try:
        req = urllib.request.Request(
            URL, headers={"Accept": "application/json",
                          "User-Agent": "ManCaveSportsBook-PublicCacheCheck/1.0",
                          "Cache-Control": "no-cache"})
        with urllib.request.urlopen(req, timeout=15) as response:
            raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError("Published cache exceeds Worker limit")
        if hashlib.sha256(raw).hexdigest() != expected_hash:
            raise ValueError("GitHub raw edge has not published this exact refresh yet")
        public = json.loads(raw)
        if public.get("schema") != 1 or len(public.get("entries", {})) != len(source["entries"]):
            raise ValueError("Published schema or entry count mismatch")
        print("VERIFIED_PUBLIC_SEASON_CACHE_PUBLISHED",
              len(raw), "bytes,", len(public["entries"]), "entries, exact SHA256",
              expected_hash, flush=True)
        break
    except Exception as error:
        last_error = str(error)
        print("PUBLIC_SEASON_CACHE_PROPAGATING", attempt + 1, last_error[:200],
              flush=True)
        if attempt < 7:
            time.sleep(8)
else:
    raise SystemExit("Public Core feed not confirmed after publish: " + last_error)
