# Man Cave Sports Book — Cloudflare migration status

Updated: November 17, 2026 (11:23 AM America/New_York)

## Locked baseline

- Original approved v8l 28-board Gold Master remains unchanged.
- Existing iPhone Game Center V44/V45 remains unchanged in `Broncos5523/left-right-`.
- Current production Onn / Render URLs **have not been replaced**.
- No GitHub controller-side Firebase assignments were changed.
- Cloudflare Worker: `man-cave-28-page.broncos5523.workers.dev`.

## Public staging URLs

- Board index: `https://man-cave-28-page.broncos5523.workers.dev/staging/`
- Approved original 30-second player: `https://man-cave-28-page.broncos5523.workers.dev/staging/player.html?rotate=off`
- Cloudflare Firebase TV3 RECEIVER TEST: `https://man-cave-28-page.broncos5523.workers.dev/staging/tv3.html?rotate=off`
- Broncos Page 4 (verified live): `https://man-cave-28-page.broncos5523.workers.dev/staging/boards/page4_broncos.html`

## Proven (real public Cloudflare + Chromium)

1. 28/28 original page HTML renders via HTTP 200; all have original runtime and isolated staging feed shim.
2. 27/28 report MCBoard.ready after two seconds; Arizona Football Page 4 needs longer targeted readiness test.
3. Original 30-second rotation page1_nfl → page2_nfl succeeded; player manifest, local save/heartbeat and original ticker modules served.
4. Original spotlight-state module initializes with its untouched 7-second lifecycle logic.
5. Broncos Page 4 real 2026 season data and ticker visually verified; ESPN roster Core 403 is adapted to validated per-season Site API where available.
6. NFL Page 1 REAL Cloudflare API + Chromium passed November 17: exact 2026 AFC/NFC standings (16+16 NFL teams), 14 ESPN games in ticker, 32 updated team rows, original board ready, zero JS errors. Workflow `check-live-nfl-page1.yml` run 44122660749.
7. NFL Page 2 REAL Cloudflare API + Chromium passed November 17: six original athlete-leader categories, all five exact team leader categories, 2026 year verified, 14 ticker games, athlete headshots, 10.5 fractional sacks, net (not gross) passing yards, 32 team standing records, original 6+5 card DOM updated, zero JS errors. Workflow `check-live-nfl-page2.yml` run 44125082752.
8. NFL Page 2 explicitly excludes NFL.com MVP Tracker: awards are not verified and must NOT be represented as dynamically live. Existing approved visual remains as-is.
9. Cloudflare TV3 receiver read an existing Firebase `screens/third` assignment (wrestling). No commands were sent.
10. Mocked Firebase assignments passed board `page4_broncos` hold and return-to-rotation; original approved TV3 command shape unchanged.
11. 720×1280 portrait geometry and 1920×1080 rotated-clockwise landscape full-frame geometry match precisely (no two-pixel drift).
12. All 316 original image assets and original pro/college/NFL ticker ESM modules copied as exact source bytes; no redesign.

## NOT YET VERIFIED / DO NOT CUT OVER

- The 28-board rotation is **mechanically** functional, but most boards are not **live-data certified**.
- Legacy `/api/board/<id>` dynamic JSON routes **except `page1_nfl` and `page2_nfl`** still return HTTP 404 on Cloudflare. Those two verified NFL routes use strict current ESPN Site scoreboard/standings and athlete/team-leader data; other routes expose large structured ESPN season/ticker/standings/leaders/playoff models and cannot be silently replaced with incomplete scoreboards.
- Additional specialized endpoints pending: `/production/api/page4-live`, `/production/api/draft-watch-stats`, `/production/api/bracketology-status`; some upstream ESPN Core feeds fail 403 through Cloudflare.
- Arizona CFB Page 3 reported a `loadSchedule is not defined` JavaScript error in browser audit; Arizona CFB Page 4 was not ready within two-second audit.
- Broncos Page 4 some individual athletes can legitimately return no verified current-year stats (no career fallback).
- The Xfinity control bridge and Yahoo fantasy cloud backends remain on suspended Render; their secure credentials have not migrated.
- The approved iPhone controller still displays a Render link for the old 28-board Onn player. Do not edit the approved controller or change any physical TV address until API parity and actual Onn testing pass.

## Workflows

- Original rotation/browser proof: `browser-rotation-staging.yml` — successful
- Live Broncos browser proof: `browser-broncos-staging.yml` — successful
- Live NFL Page 1 real public/browser proof: `check-live-nfl-page1.yml` — successful, run 44122660749
- Live NFL Page 2 real public/browser proof: `check-live-nfl-page2.yml` — successful, run 44125082752
- NFL Page 2 unit/bundle regression: `test-nfl-page2.yml` — 25 passed, zero failed
- All-board readiness matrix: `audit-28-cloudflare-views.yml` — successful; reported API gaps
- Firebase TV3 mock + rotated Onn fit: `browser-tv3-staging.yml` — successful
- Source/asset/ticker validation: `test-cloudflare-live-relay.yml` — successful

## Next technical work

Port remaining current-season `/api/board` payload contracts, prioritizing NBA and CBB, then NFL Page 3, keeping exact approved v8l JSON render categories. Preserve the approved JSON shapes, original animations and 30s/7s timings. Then verify all board pages in Chromium, test Firebase controlled boards on a physical Onn, switch only the 32-inch receiver URL when safe, and finally migrate Xfinity and Yahoo backends off Render separately.

**Rule:** No guessed numeric data, no career total in place of current season, no source design changes, no premature production cutover.
