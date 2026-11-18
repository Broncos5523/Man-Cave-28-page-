# MAN CAVE SPORTS BOOK — Private Yahoo Fantasy on Cloudflare (STAGING)

**Status (Nov 18, 2026):** Code and dry-run checks are staged. **Not deployed, not connected to Yahoo after approval.** No approved V24.8 design, 28-page Gold Master, controller, Firebase TV assignment, or production URL has been modified.

## Why this is separate
- The existing public `man-cave-28-page` Cloudflare Worker is not suitable for private Yahoo data or OAuth secrets.
- This uses an isolated Worker named **man-cave-fantasy-cloud**, with SQLite-backed Durable Object storage for single-writer Yahoo token refresh.
- Original V24.8 `templates/dashboard.html` and all three assets are copied **byte-identically** from SHA-256 checked `fantasy-cloud/original-v24.8.zip`; no CSS/HTML/artwork changes.
- No bearer token, Client Secret, refresh token, or private league data is committed to GitHub or sent to the browser as auth credentials.

## Deployment gates (iPhone-friendly)
1. **Verify GitHub staging tests.** Workflow `Verify private Yahoo Fantasy Cloudflare staging` runs contract tests, exact V24.8 byte comparisons and Wrangler dry-run only.
2. **Provision Worker via manual GitHub Action only if approved.** Workflow `Deploy isolated private Fantasy Worker` requires repository Actions secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. Use a Cloudflare token scoped to only the relevant account's Workers resources, stored in GitHub Secrets, **not in a chat or screenshot**. The workflow does not deploy automatically.
3. **In Cloudflare > Workers & Pages > man-cave-fantasy-cloud > Settings > Variables and Secrets**, add these encrypted Worker secrets, never public vars or GitHub files:
   - `FANTASY_SESSION_SECRET`: stable random 32+ character secret, new for Cloudflare
   - `FANTASY_VIEW_PIN`: unique 8+ character private unlock passphrase
   - `YAHOO_CLIENT_ID`: approved Yahoo Client ID (Consumer Key)
   - `YAHOO_CLIENT_SECRET`: current Yahoo Client Secret (regenerate if exposed)
   - `YAHOO_LEAGUE_ID`: numeric private league ID
   - `PUBLIC_BASE_URL`: actual final Worker origin, e.g. `https://man-cave-fantasy-cloud.<your-subdomain>.workers.dev`
   - Optional `YAHOO_GAME_KEY` (defaults to `nfl`)
4. **Yahoo Developer:** exact callback `PUBLIC_BASE_URL/oauth/yahoo/callback`. An application created before Fantasy Sports permission was enabled may need replacing. If Yahoo requires a new app, create one with Fantasy Sports Read, submit the new Client ID via [Yahoo's confirmation form](https://sports.yahoo.com/developer/application-confirmation/), wait for their provisioning, then add new credentials in the private Worker settings.
5. On your **iPhone**, open `PUBLIC_BASE_URL/setup`, unlock, press **Connect Yahoo Fantasy**. This uses the official Yahoo authorization flow. If already connected, the button becomes **Reconnect Yahoo Fantasy**.
6. Inspect `/api/status` while unlocked (no credentials in the response). Verify `connected: true` and `data_age_seconds` under 150 before displaying fantasy scores or connecting the controller.
7. **Do not change any physical TV URL or controller assignment** until live league data is tested with the exact original 12-team board.

## Refresh and privacy contracts
- Cron performs a read-only scoreboard refresh at most once per minute and rotates 3 team rosters per minute; standings refresh at most once per 10 minutes.
- Scores use only Yahoo responses; empty/malformed/incomplete matchups are rejected, and snapshots older than 150 seconds are not presented as live.
- Yahoo OAuth tokens are AES-GCM encrypted at rest within the private Durable Object with a key derived from `FANTASY_SESSION_SECRET`. Changing that secret requires a new Yahoo consent flow.
- Browser session is an HttpOnly/Secure/SameSite=Lax HMAC-authenticated cookie; the original dashboard and assets are blocked until unlocked.
- The API returns the previously approved V24.8 dashboard JSON structure. Data mapping requires verification using the *first authorized Yahoo response*. The site does **not** fabricate projections, win probability, or fantasy score values.
- Browser private data access is never exposed via an unauthenticated or permissive CORS endpoint.

## Known limitations
- No post-approval Yahoo call has been possible: existing Render fantasy service is suspended for billing.
- Cloudflare account management/deployment and private Yahoo Developer credentials are not available to this chat. The above initial deployment / secret additions require account-owner action.
- The approved V24.8 HTML may expect other legacy endpoints or assets besides the four archived source files. Inspect actual device rendering after deployment before promising complete UI functionality.
- Cron timing and Yahoo API propagation delay are not the same as truly instantaneous score availability.
