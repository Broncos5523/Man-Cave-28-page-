# Man Cave Sports Book — Cloudflare migration status

Updated: November 17, 2026, 1:48 PM Eastern

## CURRENT CHECKPOINT — ALL 28 ORIGINAL BOARD RENDERERS VERIFIED IN CLOUDFLARE STAGING

**Automated staging verification: 28/28 original boards PASS.** Evidence: one-shot GitHub Actions run
[44150844101](https://github.com/Broncos5523/Man-Cave-28-page-/actions/runs/44150844101),
source revision `32dbf196623e898a9ea39785345683b746e0dcb4`, checked
November 17, 2026 at 18:48:53 UTC (1:48 PM Eastern). Exact published acceptance
matrix: [latest.json](https://github.com/Broncos5523/Man-Cave-28-page-/blob/cloudflare-batch-results/latest.json)
and [phone-friendly report](https://github.com/Broncos5523/Man-Cave-28-page-/blob/cloudflare-batch-results/latest.md).

- **All four original pages of every sport passed original browser rendering checks.**
  This is current ESPN/official-source payload compared against the *rendered*
  original DOM, not merely an HTTP 200 or generic screenshot. NHL record
  formatting and the three college-board fallback cache assumptions were
  specifically reverified without changing the Gold Master.
- **All 13 independent browser suites PASSED**, including all 28 initial
  pages; three parallel five-board renderer groups; priority CBB/NBA/Broncos
  pages; NBA, NFL and Broncos baselines; all six additional Page 4 player
  boards, original spotlight rotation, approved 30-second player rotation,
  and a **mock/read-only** Firebase 32-inch TV controller/hold/return test.
- **Current-season ESPN Core publication PASSED**: 161 validated records were
  published from a GitHub runner and the strict fresh public source gate passed.
  Cloudflare's exact Worker revision was confirmed. Original data adapter
  unit/contract tests and Worker bundling PASSED.
- **Production remains UNCHANGED.** No approved October 18 v8l Gold Master
  files, controller design, Firebase command/TV assignments, Xfinity bridge,
  Yahoo Fantasy service or physical TV URLs were changed.
- **Critical remaining cutover gate:** these are automated Chromium/staging
  results, **not** physical Onn/Fire TV playback verification. Test rotation,
  dedicated selection/manual hold/return, original imagery, sound/overscan,
  long-session stability, and iPhone controller routing on the actual
  32-inch Onn before approving a production TV address change. Do not
  retire Render until physical verification and explicit owner approval.
- **Known source exceptions remain intentional:** NFL.com MVP Tracker,
  NBA MVP editorial tracker and an entire current 2027 bracketology projected
  field are NOT verified live sources. Approved fallback artwork and clearly
  labelled historical recap remain; no fabricated awards/brackets.
- **Separately pending:** Yahoo fantasy API and Xfinity control bridge
  services remain outside this board migration and have not been cut over.

| Original sport / team | Page 1 | Page 2 | Page 3 | Page 4 |
|---|---|---|---|---|
| NFL / Broncos | PASS | PASS | PASS | PASS |
| NBA / Celtics | PASS | PASS | PASS | PASS |
| NHL / Bruins | PASS | PASS | PASS | PASS |
| MLB / Red Sox | PASS | PASS | PASS | PASS |
| WNBA / Fever | PASS | PASS | PASS | PASS |
| NCAA Football / Arizona | PASS | PASS | PASS | PASS |
| NCAA Basketball / Arizona | PASS | PASS | PASS | PASS |

## Historical development snapshot — superseded

Everything below was written at the previous 12:46 PM checkpoint, when
17/28 were browser-verified. Previous **pending** labels and blocker wording
below are retained as historical development evidence, **not current status**.

## Production safety and locked baseline

- Original approved October 18 v8l Gold Master ZIP SHA256: `e6651aa3db2dae42f38d693f1e6690de7009a0a6e34ed6ee0bc2a26cabbeed3f`. Original source files are unchanged.
- Approved layouts, assets, fonts, colors, board order, 30-second rotation and seven-second spotlights remain locked.
- Existing controller repository `Broncos5523/left-right-`, controller appearance, Firebase command structure and TV assignments are unchanged. No production receiver address has been replaced.
- Xfinity and Yahoo Fantasy remain separate services and have not been modified.
- Staging: https://man-cave-28-page.broncos5523.workers.dev/staging/
- Rotation: https://man-cave-28-page.broncos5523.workers.dev/staging/player.html?rotate=off
- Receiver test: https://man-cave-28-page.broncos5523.workers.dev/staging/tv3.html?rotate=off

## Verified count: 17 of 28 stat/data pages; 11 remain

“Verified” means current-season data reached the original renderer in Chromium, with actual DOM comparisons, original imagery and no page JavaScript errors. It does not claim that unsupported editorial/award projections are live. Those exclusions remain below. A successful API response alone is not counted.

| Sport | Page 1 | Page 2 | Page 3 | Page 4 |
|---|---|---|---|---|
| NFL / Broncos | VERIFIED | VERIFIED stats; MVP excluded | VERIFIED | VERIFIED |
| NBA / Celtics | VERIFIED standings; bracket recheck pending | VERIFIED stats; MVP excluded | Pending Core source bridge | Pending new player adapter |
| NHL / Bruins | Pending corrected record-format assertion | VERIFIED | VERIFIED | Pending source/browser audit |
| MLB / Red Sox | VERIFIED | VERIFIED stats | VERIFIED | Pending browser audit |
| WNBA / Fever | VERIFIED | VERIFIED stats | Pending Core source bridge | Pending source/browser audit |
| NCAA Football / Arizona | VERIFIED | VERIFIED stats | VERIFIED | Pending iframe/source audit |
| NCAA Basketball / Arizona | VERIFIED AP + labelled recap | Pending Worker request-limit recheck | Pending Worker request-limit recheck | Pending new player adapter |

## Browser and deployment evidence

- Prior verified baselines: Broncos Page 4; NFL Page 1 run `44122660749`; NFL Page 2 run `44125082752`; NBA Page 1 run `44126331898`.
- Priority renderer workflow `44135949767` PASSED for CBB Page 1, NBA Page 2 and Broncos Page 3.
- CBB Page 1: 25 current AP teams (including a real tied rank), 32 conferences / 365 D-I teams, 67 verified 2026 tournament finals producing 63 bracket matches, 60 regional match boxes actually painted, correct historical label, original images loaded.
- NBA Page 2: six qualified athlete identities/names/values and five original team categories. Correct `byathlete` percentage units are preserved. The generic v3 leaderboard's 0.6 ratio is not substituted for the original 60.0 display.
- Broncos Page 3: 20 real games (3 preseason + all 17 regular season), original record/last-five/next-game panels and all eight original team metrics/ranks. The existing defense formatter displays 355 rather than 355.0; browser verification now compares actual numeric values and ranks without changing the approved formatter.
- Remaining renderer matrix run `44135949860`: 10 of 15 PASSED. Passed: `page1_mlb`, `page1_wnba`, `page1_cfb`, `page2_nhl`, `page2_mlb`, `page2_wnba`, `page2_cfb`, `page3_bruins`, `page3_redsox`, `page3_arizona_cfb`. The workflow as a whole FAILED and is not reported as fully successful.
- That matrix captured per-board results and original-page screenshots as `remaining-board-renderer-evidence`.
- Latest deployed implementation before the next checkpoint: source `460f33dab0198bbdf48d9630c308f514aae7ccd3`; Cloudflare version `26dd6f29-34b1-497a-91da-a5249d5bb5fa` (successful Git build).
- All 28 HTML pages and 316 original image assets build successfully. Earlier rotation, standalone spotlight lifecycle, read-only Firebase receiver, mocked manual hold/return and portrait/rotated geometry proofs remain documented by their existing workflows.

## Exact remaining blockers and implemented corrections awaiting deployment

1. **NBA/WNBA advanced statistics:** ESPN Core works from the existing GitHub runner but returns HTTP 403 from Cloudflare. A compact, public current-season feed is implemented on a separate `cloudflare-live-data` branch, refreshed by a standard GitHub runner every five minutes. Each record preserves source values, original season/type/subject references and its real source check time. The Worker refuses entries older than 15 minutes, future timestamps, wrong years, wrong types or wrong subjects. No scores or schedules use this fallback. The original advanced-team server cache was 15 minutes. Initial publication and actual Cloudflare/browser proof are pending.
2. **College basketball Worker quota:** both remaining CBB board APIs returned `Too many subrequests by single Worker invocation`. The per-source Cache API reads/writes were consuming the invocation allowance. Internal data reads now cache only the assembled board payload, while public proxy reads retain their existing cache. All 365 teams are still included; no categories were removed.
3. **CBB source pagination:** ESPN advertises 554 team records but supplies 400 rows and an empty second page. Twenty-two missing D-I schools are recovered from individually year/type/team-validated Site team statistics. Local complete Worker execution returned 200 with six leaders and 365 teams.
4. **NHL Page 1 test formatting:** the actual 32 displayed records matched, but the test compared them with ESPN strings that additionally include `, NN PTS`. The assertion now matches the original renderer's documented removal of that suffix. No displayed data/design changes; rerun pending.
5. **NBA Page 1 bracket contract:** corrected data keys from `First Round`/`East` to original renderer `first`/`east`, and restored original pair ordering. A bracket-specific DOM check is still required before cutover.
6. **Celtics/Arizona CBB Page 4:** exact original `/production/api/page4-live` payload adapter implemented. Local real-source checks: Celtics 16/17 roster players with verified appearances; Arizona 14/16. Six original team-leader categories verified for each. Approved spotlight players/artwork are unchanged. Unavailable player stats are null/dashes; career/prior-season numbers are not substituted.
7. **Draft Watch:** exact Kansas roster identity and current regular-season per-game endpoint implemented for Tyran Stokes. Cloudflare/browser proof pending.
8. **Bracketology:** metadata-only original article monitor is ported. No full projected field is exposed by the verified interface, so no live projected bracket is claimed. The original labelled 2026 tournament recap remains.
9. **Other Page 4 boards:** Bruins official NHL requests returned HTTP 429 through Cloudflare during audit. Red Sox, Fever and Arizona football require targeted original-renderer/source checks. Arizona football Page 4 needs a full iframe readiness test.

## Source and compatibility corrections already made

- CBB standings are 6,130,969 bytes: internal fixed-source reads allow up to 8 MiB, while public `/proxy` remains limited to 5 MiB JSON.
- The exporter no longer mixes Render's 2027 snapshot-only override with the untouched original CBB recap runtime.
- Original ESPN common-v3 web-host reads use the contract-compatible reachable Site host. Path/query and JSON are preserved.
- CFB numeric losses are omitted by the source; the adapter reads the provider's exact overall record string. All 138 FBS teams are preserved.
- CFB `byathlete` interception sorting returns HTTP 400. The verified Site v3 FBS league leaderboard provides all six exact original categories, including fractional sacks formatting.
- MLB's range-form scoreboard returns HTTP 400. September 25–30 daily reads plus October/November month reads recover all 11 real series and a verified World Series winner. WNBA requires seven real series and a verified Finals winner.
- NHL seeding preserves three teams per division plus two conference wildcards, with verified ESPN standings and the original division map when the official overlay is unavailable.
- Arizona football Page 3's missing `loadSchedule()` is supplied only in the staging transport shim, using verified games and its existing render functions. Its browser check passed.

## Current checks

- Full local unit/contract suite: **45 passed, zero failed**.
- Real collected Core records: **154 exact season/type/subject contracts validated**; 47 teams. The sample is development evidence, not a published or perpetually-current feed.
- Existing source/image builds and relevant regression workflows pass. New source refresh, Page 4 and updated complete renderer checks must run after the next commit.

## November 17 continuation from standard ChatGPT (after Work quota)

- Resumed at the actual 17/28 browser-verified checkpoint; **no additional boards are counted as verified by the following commits**.
- Commit `9c53275e1e28d5cfaf7a96ced71fafa16337d1cf`: hardened native NHL/MLB/Arizona Page 4 browser polling to report malformed upstream JSON as a captured test failure instead of an uncaught polling exception. Original board pages and data were not changed.
- Commits `17eb1faa78884529e59662eea2babda4f9719009` and `acb3fddc911b4418e3c444115522390700164905`: added a post-publication check to the existing scheduled Core refresh workflow. Each refresh must publish the exact generated bytes to the existing public raw GitHub URL, under the Worker's 5 MiB limit, with a current schema/timestamp; otherwise the refresh action reports a failure.
- **Not yet claimed:** fresh GitHub Actions results from the new verification changes, 11 remaining renderer passes, Cloudflare physical Onn testing, or production cutover.
- Commit `52684719ccc4f46d32acb3b2bb849e074943f251`: refreshed the 15-board original renderer test against the current staging revision, capturing failed upstream route/status diagnostics. The existing verification workflow is configured to run on this file change. **Do not count extra verified boards until its browser result is inspected.**
- Next: review the scheduled Core publication and latest native/remaining renderer workflow results, fix any actual source/DOM failures, and update the verified board matrix only from end-to-end browser evidence.

## Unsupported information and cutover gate

- NFL.com MVP Tracker, NBA MVP editorial tracker, other unsupported award projections and the full 2027 ESPN Bracketology field are not represented as verified live feeds. Approved fallback visuals remain; do not invent predictions, results or statistics.
- Physical Onn playback has NOT been verified. Previous Onn Render SSL failure is not resolved by desktop/browser tests alone.
- Do not change TV addresses/Firebase assignments or retire Render until all required data/render checks, individual controller selections, automatic/manual playback and physical Onn verification pass.

## Rollback

Before this continuation: source `5e004e70642cdb77f8ba518f793b19abcf0e8aed`, Cloudflare version `1c59008c-453f-4da1-8b95-2c99e33249ec`.

Latest deployed checkpoint above is also available in Git history/Cloudflare deployment history. Revert adapter commits or roll back the existing Worker version; never alter Gold Master files or production TV assignments to recover a staging test.
