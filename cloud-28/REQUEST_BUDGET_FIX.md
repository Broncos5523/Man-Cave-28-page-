# Cloudflare request-budget improvement (staging only)

Cloudflare's 28-board Worker showed 127.88k invocations over a rolling 24-hour period on November 19, 2026, not a per-endpoint breakdown.

Changes: (1) browser-local responses for stateless staging state/heartbeat endpoints; (2) in-flight coalescing and sessionStorage caching for successful public ESPN/NHL/MLB JSON reads before they reach the Worker (live feeds at most 20 seconds old, season stats 90 seconds, other public JSON 35 seconds); (3) extensionless board URLs avoid repeated .html redirects.

The approved 28 visuals, seven-second spotlight and 30-second rotation remain byte-identical to the original Gold Master, as do controller, Firebase, Yahoo, Xfinity and Render. Never cache authenticated requests, writes or errors. No production deployment or account limit change has been made. Validate with node --test cloud-28/tests/request-budget.test.mjs cloud-28/tests/worker-proxy.test.mjs, automated browser staging build, and measured live Worker usage before cutover.
