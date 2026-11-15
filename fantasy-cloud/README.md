# MAN CAVE SPORTS BOOK — Yahoo Fantasy Cloud (isolated service)

Goal: preserve exact approved V24.8 HTML/artwork and replace its Playwright/Chrome scrape collector with the **official authorized Yahoo Fantasy Sports read-only API**. Host this as a separate Render service. It does **not** change the working 28-page sports player, wrestling player, or LEFT/RIGHT controller.

The original V24.8 ZIP is stored intact as `original-v24.8.zip` and checked using SHA-256 at build. No Yahoo cookies, credentials, Chrome profiles, or tokens belong in GitHub.

## Secure setup

The service starts in an intentionally unconfigured state. Set these **only in Render's environment settings**, NEVER in source code or ChatGPT screenshots:

* `FANTASY_SESSION_SECRET` = long random stable secret (32+ chars)
* `FANTASY_VIEW_PIN` = unique private display unlock passphrase (8+ characters)
* `YAHOO_CLIENT_ID` = newly approved app's Client ID
* `YAHOO_CLIENT_SECRET` = **regenerated** Client Secret; the earlier one appeared in a screenshot
* `YAHOO_REDIRECT_URI` = `https://<fantasy-cloud-service>.onrender.com/oauth/yahoo/callback` (must match Yahoo Developer app)
* `YAHOO_LEAGUE_ID` = private Yahoo league numeric ID
* `FANTASY_REDIS_URL` = persistent private Redis/Key Value endpoint for OAuth refresh-token storage, **with persistence enabled**

The Render service URL is public but league data is not: the unlock page requires the display PIN, and the API returns 401 until unlocked. OAuth tokens are encrypted at rest in Redis with a key derived from `FANTASY_SESSION_SECRET` and never included in logs, JSON responses, or the client-side dashboard.

**Caution:** Render free web instances may sleep/restart. Free Key Value may not provide durable persistence. Do not claim continuous 24/7 service or authorize Yahoo until durable token storage is configured. Use a suitable persistent store if free storage isn't durable.

## OAuth activation

1. Yahoo must finish provisioning access after signed agreement + new Client ID submission.
2. Add the **new cloud callback** URI to your existing Yahoo Developer app (instead of the older 28-board callback).
3. Set Render secrets above, open cloud service from your own device, and unlock.
4. Press "Connect Yahoo" to consent. The callback stores the refresh token encrypted.
5. The collector reads the official scoreboard/standings/roster/player stats every 45 seconds and publishes only validated observed values.

No fabricated win probabilities, projections, starters remaining, or live scores: missing API fields stay missing and data ages are tracked. The original dashboard layout is deliberately unchanged. The app may need source-specific mapping after inspecting the **first authorized API response**. No live access has been proven yet.

## Build & start

Build: `pip install -r fantasy-cloud/requirements.txt && python fantasy-cloud/bootstrap.py && python -m py_compile fantasy-cloud/app.py`

Start: `gunicorn --chdir fantasy-cloud -w 1 --threads 4 --bind 0.0.0.0:$PORT app:app`

Health: `/healthz`. The Yahoo OAuth login and private `/api/data` are protected.
