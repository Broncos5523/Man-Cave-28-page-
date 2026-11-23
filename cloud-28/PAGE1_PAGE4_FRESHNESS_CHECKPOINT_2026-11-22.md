# 28-page board current-data checkpoint — November 22, 2026

## Production state
- Existing URL: https://man-cave-28-page.broncos5523.workers.dev
- Successful 2026-11-22 controlled deployment run: https://github.com/Broncos5523/Man-Cave-28-page-/actions/runs/45083336959
- Active confirmed Cloudflare version at release: `f27dce4c-032a-4459-bd34-6fa8f38357a3`
- Prior production rollback version: `711647a7-f63d-4df1-a8f9-455db32d1070`
- Controller commands through `screens/third`, original TV player URL, approved October 18 v8l artwork, 30-second page rotation were preserved.
- Seven Page 1 APIs returned current-season data. Basketball Page 4 APIs for Celtics/Fever/Arizona CBB returned current roster, six leaders, >3 verified players and freshly checked season data.
- The 2026-11-22 23:29 UTC read-only native browser audit passed Bruins, Red Sox and Arizona CFB Page 4 (including imagery and spotlight). A later Arizona CFB replay at 23:57 UTC failed because no verified source payload arrived within 65 seconds; see season-cache outage below. **Do not claim all Page4 remain continuously current.**

## Broncos Page 4 athlete audit
- Latest read-only workflow: https://github.com/Broncos5523/Man-Cave-28-page-/actions/runs/45085835926
- Browser captured 117 athlete-stat requests: 59 HTTP 200 and 58 HTTP 503; 29 distinct unavailable athlete IDs.
- Direct independent ESPN Site classification for those 29 IDs:
  - 14: previous-year ESPN rows exist, no current-year Denver 2026 regular-season row.
  - 8: ESPN returns categories missing/empty.
  - 7: ESPN individual athlete endpoint HTTP 404.
- Worker intentionally rejects non-current season, non-Broncos data instead of backfilling career numbers. The `DATA DELAYED` label on Broncos Page 4 may occur even when current-season stats for other players render correctly.
- Do not fabricate 0, substitute 2025 statistics, or rewrite the Gold Master to silence the label.

## Core season cache reliability
- The refresh workflow `.github/workflows/refresh-core-season-cache.yml` is configured `*/5 * * * *` but GitHub's actual scheduled execution is delayed irregularly, often beyond the verified 15-minute maximum.
- Before manual refresh, most recent `cloudflare-live-data/espn-core-season-cache.json` generation was at 2026-11-22 23:16 UTC (18:16 ET). Current cache freshness validation correctly fails closed after 900 seconds.
- The existing refresh job was safely re-run at 2026-11-23 00:01 UTC (19:01 ET) and succeeded: current cache commit `6a85aa9c2cc56d351865fd94a5323cf580dd3bcf`. Public publication check succeeded.
- **Persistent gap:** GitHub cron is not a reliable five-minute clock, so Arizona CFB and other Core-dependent board widgets may intermittently lose their verified feed. Do not solve by extending data's `current` label beyond its permitted age.

## ESPN public Site on-demand fallback research
- Audit workflow: https://github.com/Broncos5523/Man-Cave-28-page-/actions/runs/45086274271
- ESPN Site v2 `/teams/12/leaders` returned an empty object. Site v3 `/teams/12/leaders` supplied current season but no leader categories.
- ESPN Site v2 `/teams/12/statistics` supplied verified 2026 team totals, not six individual leaders.
- ESPN Site common v3 individual athlete `/athletes/<id>/stats` returns season rows, but fetching an entire 70+ athlete roster would exceed practical Worker subrequest limits.
- ESPN Site common v3 league `statistics/byathlete` responds with national athletes; `team=12`, `teamId=12`, `teams=12`, `team.id=12`, `teamid=12` filters all demonstrably returned identical national results (not a valid Arizona-only feed). Do not use the national top leader as an Arizona leader.
- Alternative verified fast team-leader source, robust scheduled publication, or another reliable update trigger remains necessary.

## User-visible recheck
- From the existing iPhone controller, send a Page 1 or Page 4 board even if it is already selected. The deployed same-board `updatedAt` resend logic reloads that iframe with a fresh query marker; it does not change the TV browser address.
- Only ask for device screenshot if current values on the physical Onn remain demonstrably wrong.

## Scope safeguard
- Audit commits live on `audit/remaining-page4-native-20261122`; no audit changes were deployed. Preserve Gold Master layout, Firebase assignments and working controller switching.
