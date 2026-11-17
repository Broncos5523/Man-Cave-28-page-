"""Read-only validation of the exact public ESPN Core fallback used by Cloudflare.

Prints concise facts, not personal tokens or full player data. This is a
freshness/readability gate, not a substitute for the 28 browser renderer checks.
"""
import datetime
import hashlib
import json
import urllib.request

URL = ("https://raw.githubusercontent.com/Broncos5523/"
       "Man-Cave-28-page-/cloudflare-live-data/espn-core-season-cache.json")
NOW = datetime.datetime.now(datetime.timezone.utc)
CAP = 5 * 1024 * 1024

request = urllib.request.Request(
    URL, headers={"Accept": "application/json",
                  "User-Agent": "ManCaveSportsBook-CacheAudit/1.0"})
with urllib.request.urlopen(request, timeout=25) as response:
    raw = response.read(CAP + 1)
if len(raw) > CAP:
    raise SystemExit("FAIL: public cache exceeds Worker 5 MiB limit")

payload = json.loads(raw)
if payload.get("schema") != 1 or not isinstance(payload.get("entries"), dict):
    raise SystemExit("FAIL: invalid public Core cache schema")
if len(payload["entries"]) < 45:
    raise SystemExit("FAIL: fewer than 45 required NBA/WNBA teams in public cache")

ages = []
for key, entry in payload["entries"].items():
    stamp = datetime.datetime.fromisoformat(entry["fetchedAt"].replace("Z", "+00:00"))
    seconds = (NOW - stamp).total_seconds()
    if seconds < -60 or seconds > 900:
        raise SystemExit("FAIL: public entry not verified fresh: " + key)
    if not entry.get("sourceUrl") or not isinstance(entry.get("data"), dict):
        raise SystemExit("FAIL: missing source/JSON for " + key)
    ages.append(seconds)

nba = [p for p in payload["entries"] if "/leagues/nba/" in p and
       "/types/2/teams/" in p and p.endswith("/statistics")]
wnba = [p for p in payload["entries"] if "/leagues/wnba/" in p and
        "/types/2/teams/" in p and p.endswith("/statistics")]
if len(nba) != 30 or len(wnba) != 15:
    raise SystemExit("FAIL: incomplete current NBA/WNBA advanced team set")
print("PUBLIC_CORE_SOURCE_VALID",
      "entries", len(ages), "NBA", len(nba), "WNBA", len(wnba),
      "oldest_seconds", int(max(ages)), "bytes", len(raw),
      "sha256", hashlib.sha256(raw).hexdigest(), flush=True)
