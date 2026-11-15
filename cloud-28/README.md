# MAN CAVE SPORTS BOOK — 28-board Onn TV cloud player

## Current deployment

- **Production web URL:** https://man-cave-28-board-player.onrender.com/onn/
- **Render free web service:** `srv-dbsi62ec6qcc7398bkf0` in Virginia.
- **GitHub repository:** https://github.com/Broncos5523/Man-Cave-28-page-
- **Render autoDeploy:** Disabled. Deploy explicitly only after tested changes.
- **Onn TV SSL caveat:** User's TV Bro on an Onn TV stick reported ERR_SSL_VERSION_OR_CIPHER_MISMATCH for the Render subdomain, despite the same TV browser loading `render.com` and GitHub Pages, and the iPhone loading Render. This device/browser connectivity problem is **not resolved**. Do not imply successful physical Onn playback.

## Approved source and reproducible builds

- Original locked v8l archive, October 18, 2026; SHA-256: `e6651aa3db2dae42f38d693f1e6690de7009a0a6e34ed6ee0bc2a26cabbeed3f`.
- The owner explicitly authorized public GitHub publication of the archive.
- **Permanent source asset:** https://github.com/Broncos5523/Man-Cave-28-page-/releases/download/approved-v8l-20261018/approved-v8l.zip
- `python cloud-28/prepare.py` downloads this permanent Release and requires a matching full archive SHA-256 before extraction of all 742 original approved entries.
- The original approved HTML/CSS/graphics are not edited. Runtime-specific changes are made to cloud responses only.
- Host via `python cloud-28/server.py`. Python standard library only.

## Live feed fixes (November 15, 2026)

- Restored the 21 original versioned Page 1–3 runtime JavaScript files (`/runtime_*.js`) and the `/runtime.css` file. Previously, cloud routing returned 404 and the static October snapshots stayed visible.
- The approved rotation is 28 pages, 30 seconds/page (~14 minutes). Player spotlight rotation is seven seconds.
- NBA Boston and college basketball Arizona Page 4: cloud data-only adaptation with ESPN 2026–27 roster-scoped player averages and current-season team leaders; 90-second client refresh and 105-second server cache. Approved spotlight players are not reselected.
- NHL Bruins Page 4: same-origin proxy adaptation for NHL requests otherwise blocked by CORS.
- NCAA CBB Page 2 Draft Watch: verified ESPN 2026–27 Tyran Stokes Kansas season averages (at last test 15.3 PPG, 7.3 RPG, 2.3 APG across three games). `/production/api/draft-watch-stats` verifies current roster and averages; client refreshes every 90 seconds and reapplies stats after original renders. Existing name, artwork, draft projection, and layout unchanged.
- NCAA CBB Page 1 Bracketology: `/production/api/bracketology-status` checks ESPN official 2027 article metadata at most once per 21 hours while the service is in use, with a no-visual-change client monitor on Page 1. **This is metadata monitoring only.** ESPN's accessible public endpoints do NOT expose a reliably verifiable full 76-team field, so the existing 2026 historical four-region recap stays in place. Do not label it as a 2027 ESPN projection or claim that the bracket itself automatically updates.

## Verification and known limits

- Render hosted health, all 28 original board routes, and all 21 Page 1–3 runtime scripts tested HTTP 200.
- Current-season ESPN feed samples checked for all seven sports. Upstream latency/outages can temporarily delay refreshes.
- Page 4 Boston/Arizona live endpoints verified returning 2027 season data. Real-world headshot, row layout, and 14-minute uninterrupted Onn TV playback still require physical testing.
- Render free can spin down after inactivity and has bandwidth/runtime limitations.
- **TV Bro SSL error on Onn remains outstanding**; do not conflate with the live-data pipeline.
- Other Game Wall LEFT/RIGHT repositories are not part of this service and must remain unchanged during 28-board work.

## Recovery

1. Check public `/healthz`, `/production/boards.json` (28 boards), `/runtime_cbb_p1_v7k.js` (HTTP 200), `/production/api/draft-watch-stats`, and `/production/api/bracketology-status`.
2. In Render, open the service deployment history; recover a known-good deployment if a patch fails.
3. The verified source asset is permanent, so redeployments no longer depend on expiring private connector links.
4. Keep the previously approved 28-board source intact and make only cloud-adapter modifications.
