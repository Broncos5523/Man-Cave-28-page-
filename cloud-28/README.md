# MAN CAVE SPORTS BOOK — Onn TV computer-free cloud player

## LIVE — November 14, 2026 (Eastern)

**Verified public Onn start page:** https://man-cave-28-board-player.onrender.com/onn/

**Service:** Render free Python web service `srv-dbsi62ec6qcc7398bkf0`, deployed successfully as `dep-dbsi6o5g1s2s73f904mg`.

**GitHub repository:** https://github.com/Broncos5523/Man-Cave-28-page-

**Original source:** immutable approved October 18 v8l production package. SHA-256:
`e6651aa3db2dae42f38d693f1e6690de7009a0a6e34ed6ee0bc2a26cabbeed3f`.
All six archive pieces downloaded privately through temporary connector download links, checked against each part SHA and the whole ZIP SHA, and extracted unchanged during deployment. Archive approved source files were not modified.

## Verified cloud checks

- Render deployment status **live**, health endpoint HTTP 200.
- Public `/onn/` start menu HTTP 200 with clockwise / counterclockwise / no-rotation selection.
- `/production/boards.json` HTTP 200, exactly **28** board IDs; 30,000 ms rotation slots.
- **28/28** original board pages returned HTTP 200, including all five special Page 2 routes and the large Page 4 pages.
- Production player and spotlight scripts loaded via HTTP 200.
- Live ESPN adapter data: NBA, NFL, CFB, NHL, MLB, WNBA and CBB sample feeds returned HTTP 200 with current-season contexts. CBB had one 23-second timeout before a rapid successful retry. Do not interpret these checks as continuous uptime guarantees.
- Cloud browser rotation state uses the Onn browser's local storage; viewer states are not shared globally.
- Previous 28-board Windows package and LEFT/RIGHT controller were not modified.

## Physical Onn stick setup

1. Open an Android TV browser on the Onn stick (TV Bro or your existing browser).
2. Navigate to https://man-cave-28-board-player.onrender.com/onn/
3. Select clockwise, counterclockwise or already portrait, depending on the TV mount.
4. Run in full screen. The approved player rotates all 28 pages automatically, 30 seconds each (~14 minutes), with the original 7-second player spotlight logic.
5. Watch one full cycle and confirm the heavy pages don't freeze the Onn browser.

**No Windows computer is required** to serve this Render-hosted version.

## Operational limits and critical recovery warning

- This first release is hosted on **Render Free**. Idle spin-down/cold start and free-tier bandwidth/runtime limits may affect responsiveness; Onn browser performance and a complete rotation still require physical testing.
- **CRITICAL: the six source URLs used during initial build are temporary signed links and expire.** The deployed application continues running from its successfully built image, but **a rebuild or new deployment will fail after those links expire** unless you repeat an authorized archive-source transfer or establish durable GitHub-hosted assets. `autoDeploy=no` prevents pushes from automatically triggering a rebuild. Do **not** trigger a redeploy just to refresh files.
- There may be slow upstream fetches. CBB was slow once and succeeded on retry.
- Source files and approved layout are locked; any future improvements should alter the cloud adapter only, preserving the original SHA.
- The 28-board controller preview is a separate non-operational selector; this hosted page is the real 28-board TV player, but not yet integrated with Game Wall Firebase assignment controls.
