# Man Cave Sports Book — Cloudflare migration status

Updated: November 17, 2026 (Work continuation)

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
- NFL Page 1 (verified 2026): `https://man-cave-28-page.broncos5523.workers.dev/staging/boards/page1_nfl.html`
- NFL Page 2 (verified 2026 leaders): `https://man-cave-28-page.broncos5523.workers.dev/staging/boards/page2_nfl.html`
- NBA Page 1 (verified 2026–27 standings): `https://man-cave-28-page.broncos5523.workers.dev/staging/boards/page1_nba.html`
- CBB Page 1 (verified current AP25 + labelled 2026 tournament recap): `https://man-cave-28-page.broncos5523.workers.dev/staging/boards/page1_cbb.html`
- NBA Page 2 (verified six player + five team categories): `https://man-cave-28-page.broncos5523.workers.dev/staging/boards/page2_nba.html`

## Proven (real public Cloudflare + Chromium)

1. 28/28 original page HTML renders via HTTP 200; all have original runtime and isolated staging feed shim.
2. 27/28 report MCBoard.ready after two seconds; Arizona Football Page 4 needs longer targeted readiness test.
3. Original 30-second rotation page1_nfl → page2_nfl succeeded; player manifest, local save/heartbeat and original ticker modules served.
4. Original spotlight-state module initializes with its untouched 7-second lifecycle logic.
5. Broncos Page 4 real 2026 season data and ticker visually verified; ESPN roster Core 403 is adapted to validated per-season Site API where available.
6. NFL Page 1 REAL Cloudflare API + Chromium passed November 17: exact 2026 AFC/NFC standings (16+16 NFL teams), 14 ESPN games in ticker, 32 updated team rows, original board ready, zero JS errors. Workflow `check-live-nfl-page1.yml` run 44122660749.
7. NFL Page 2 REAL Cloudflare API + Chromium passed November 17: six original athlete-leader categories, all five exact team leader categories, 2026 year verified, 14 ticker games, athlete headshots, 10.5 fractional sacks, net (not gross) passing yards, 32 team standing records, original 6+5 card DOM updated, zero JS errors. Workflow `check-live-nfl-page2.yml` run 44125082752.
8. NFL Page 2 explicitly excludes NFL.com MVP Tracker: awards are not verified and must NOT be represented as dynamically live. Existing approved visual remains as-is.
9. NBA Page 1 REAL Cloudflare API + Chromium passed November 17: 2026–27 ESPN season (year 2027), 15 teams per conference, 30 original standings rows updated, 5 schedule/ticker games returned, 8 current projected first-round seeds (no outcome claims), zero JavaScript errors. Workflow `check-live-nba-page1.yml` run 44126331898. NBA MVP/actual playoffs NOT migrated.
10. Cloudflare TV3 receiver read an existing Firebase `screens/third` assignment (wrestling). No commands were sent.
11. Mocked Firebase assignments passed board `page4_broncos` hold and return-to-rotation; original approved TV3 command shape unchanged.
12. 720×1280 portrait geometry and 1920×1080 rotated-clockwise landscape full-frame geometry match precisely (no two-pixel drift).
13. All 316 original image assets and original pro/college/NFL ticker ESM modules copied as exact source bytes; no redesign.
14. CBB Page 1 real Cloudflare + Chromium passed in run `44131558488`: all 25 live AP names compared to actual rendered DOM; 365 teams / 32 conferences; 60 regional bracket boxes painted, historical recap label correct, 213 images loaded, zero page JavaScript errors.
15. NBA Page 2 real Cloudflare + Chromium passed in the same run: all six athlete identities/names compared to rendered cards, all five team categories, original images loaded, zero page errors. The run then correctly FAILED on Broncos defense DOM mismatch, so the whole workflow is not marked successful.
16. Verified count: **6 / 28 pages**, **22 remaining**. Award/editorial exclusions remain explicit, including NFL/NBA MVP trackers.

## NOT YET VERIFIED / DO NOT CUT OVER

- The 28-board rotation is **mechanically** functional, but most boards are not **live-data certified**.
- Legacy `/api/board/<id>` dynamic JSON routes **except `page1_nfl`, `page2_nfl`, and `page1_nba`** still return HTTP 404 on Cloudflare. Those three tested routes use strict current ESPN Site data; other routes expose large structured standings/leaders/playoff models and cannot be silently replaced with incomplete scoreboards. Broncos Page 4 uses its separate directly verified ESPN adapter.
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
- Live NBA Page 1 real public/browser proof: `check-live-nba-page1.yml` — successful, run 44126331898
- NBA Page 1 unit/bundle: `test-nba-page1.yml` — 29 passed, zero failed
- NFL Page 2 unit/bundle regression: `test-nfl-page2.yml` — 25 passed, zero failed
- All-board readiness matrix: `audit-28-cloudflare-views.yml` — successful; reported API gaps
- Firebase TV3 mock + rotated Onn fit: `browser-tv3-staging.yml` — successful
- Source/asset/ticker validation: `test-cloudflare-live-relay.yml` — successful

## Next technical work

### November 17 continuation — CBB adapter awaiting deployed browser proof

- Added strict `page1_cbb` original-contract adapter: current ESPN 2027 AP Top 25 (ties allowed), all 32 D-I conferences / 365 current teams, and last-completed 2026 tournament (67 finals / 63 bracket matches), explicitly labelled by the untouched original renderer.
- Confirmed and addressed the audit blocker: full D-I standings are 6,130,969 bytes. An internal server-selected read is bounded to 8 MiB; public `/proxy` remains bounded to 5 MiB. No general proxy expansion.
- Added original live-only / recent-finals / seven-day ticker selection and ten-date scoreboard window for the new route.
- Local regression: 33 passed, zero failed. Original Gold Master source, graphics, timing, controller and Firebase assignments unchanged.
- Added deployed renderer CI with a fresh browser storage context, actual images, DOM-versus-feed comparisons and screenshot artifacts. CBB is **not counted as verified until this passes**.
- Rollback before this continuation: source `5e004e70642cdb77f8ba518f793b19abcf0e8aed`, Cloudflare version `1c59008c-453f-4da1-8b95-2c99e33249ec`.

### Priority adapters — direct-source pipeline tests passed; browser proof pending

- NBA Page 2: exact six original `byathlete` qualified metrics and five original team categories. Direct-source Worker execution returned 200 for ESPN 2027. In particular, the v3 generic leaderboard represents 3-point percentage as a ratio; the original `byathlete/offensive.threePointFieldGoalPct` source returns the correct display percentage (`60.0` at check). No guessed multiplication or units.
- Broncos Page 3 (`page3_broncos`, the actual original board ID): direct-source Worker execution returned 200; 20 games (3 preseason, all 17 regular season), all eight exact original metrics and 32-team ranks. Not-yet-published postseason is empty, not fabricated. Explicit `event.seasonType.type` is carried into the original normalized `season.type` field.
- CBB staging presentation blocker: the static exporter mixed a Render snapshot-only CSS override with the untouched original runtime. The Cloudflare exporter now omits that override so the original Gold Master renderer controls its historical recap. Gold Master files are not edited.
- Local full regression now 35 passed, zero failed. Staging rebuilt: 28 original pages, 316 verified original images, no unreadable packaged image URLs. Still no production receiver, controller or Firebase changes.
- Broncos browser blocker identified: original inline defense updater used `site.web.api.espn.com/common-v3`, while the verified adapter used the reachable `site.api.espn.com/common-v3`. The relay now preserves its exact path/query and JSON contract on the compatible official host; pending browser recheck. No UI workaround or stat fabrication.
- Additional NBA Page 1 contract review found wrong case/stage labels in projected JSON (`First Round`/`East` versus original renderer `first`/`east`). Corrected the DATA contract and original pairing order; no layout change. Recheck bracket DOM before final cutover.

### Remaining Page 1–3 implementation checkpoint — NOT yet browser certified

- Implemented the other 15 original Page 1–3 IDs in strict data adapters. All 15 passed direct-source end-to-end API checks locally after source-specific fixes; Cloudflare/browser proof is pending. This does **not** increase the six-page verified count.
- Preserved 2026 MLB and WNBA offseason context and real series results: MLB requires 11 series and a verified World Series winner; WNBA requires seven series and a verified Finals winner. MLB's date-range query returned HTTP 400. September 25–30 daily queries plus October/November month queries give a complete verified archive without a full-year truncation.
- NHL retains top-three-per-division plus two wildcards in each conference, using verified ESPN standings with the original fixed division map when the NHL endpoint is unavailable. Official NHL standings returned HTTP 429 through the relay during this session; no official-overlay claim.
- NBA/WNBA Page 3 uses original ESPN Core possession/pace statistics, the original rating formulas and all-league ranks. Local source checks returned all six categories; Cloudflare Core access must still pass.
- CFB standings omit numeric losses, but publish exact overall records. The adapter reads the published record string rather than inventing values. FBS top leaders use verified Site v3 league categories because `byathlete` sorting `defensiveinterceptions.interceptions` returned HTTP 400.
- CBB's team-stat pagination advertises 554 records but supplies only 400 rows and no rows on page 2. Twenty-two missing D-I teams are resolved via individually year/type/team-validated Site team statistics. National ranks use all 365 verified D-I teams.
- Isolated staging bridge supplies Arizona CFB Page 3's missing `loadSchedule()` using the verified original API model and existing source render functions. No original HTML/CSS changes.
- Local regression: **40 passed / 0 failed**. Separate browser matrix compares actual leader/stat/record DOM against source payloads, preserves images, records JS errors, and uploads screenshots and per-board results. No receiver addresses, controller code, Firebase commands, Xfinity or Yahoo changes.

Port remaining current-season `/api/board` payload contracts, prioritizing NBA Page 2, CBB and NFL Page 3, keeping exact approved v8l JSON render categories. Four of 28 original pages have verified live data; 24 remain. Current NBA playoffs are seed projections only. Preserve the approved JSON shapes, original animations and 30s/7s timings. Then verify all board pages in Chromium, test Firebase controlled boards on a physical Onn, switch only the 32-inch receiver URL when safe, and finally migrate Xfinity and Yahoo backends off Render separately.

**Rule:** No guessed numeric data, no career total in place of current season, no source design changes, no premature production cutover.
