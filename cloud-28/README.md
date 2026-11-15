# MAN CAVE SPORTS BOOK — Computer-free Onn TV migration

**Status: source archive not publicly hosted or deployed.** Do not claim a live URL yet.

The files in this directory implement a Python web-service adapter around the **unchanged** 2026-10-18 approved 28-board production archive. All 28 routes were validated against the original archive on a local server; Onn physical-hardware playback and multi-hour reliability are not yet proven.

* Original production SHA-256: `e6651aa3db2dae42f38d693f1e6690de7009a0a6e34ed6ee0bc2a26cabbeed3f`.
* 28 original board routes, 30 seconds per board, 7-second player spotlights.
* Cloud-specific changes are injected in transit; the original HTML, CSS, scripts, and images remain unchanged.
* An Onn TV browser opens the future HTTPS service's `/onn/` menu and selects CW, CCW, or no rotation.
* Spotlight progress is kept in the Onn TV browser's `localStorage`, not shared on the public server.
* **Do not place credentials in the Git repository.**

Deployment:

1. Provide the *approved archive ZIP* to Render as an authorized private build asset or an explicitly user-approved public archive URL (environment key `MANCAVE_SOURCE_ARCHIVE_URL`). The current archive is private in Google Drive. Do not change its permissions without authorization.
2. Run `cd cloud-28 && python prepare.py` during build and `cd cloud-28 && python server.py` on service start. Use Python runtime; requires no pip dependencies.
3. Configure Render's Python web service on Free (for a test; idle cold starts and ephemeral filesystem apply) or an appropriate paid plan for always-on operation.
4. Verify `/healthz`, `/onn/`, all 28 `/production/board/*` endpoints, score/ticker refreshing, and the actual Onn browser rotation.
5. Do not change the approved LEFT/RIGHT Game Wall during this migration.

**Remaining dependency:** packaging the 209 MB approved source archive in a way that Render can fetch at build time while honoring its current private status. This is the only blocker before the first public deploy.
