# Railway proxy identity: whose address the anonymous rate limiters count (#653)

In production mode the server sets Express `trust proxy` to `PRI_TRUSTED_PROXY_HOPS` (`server/app.js`, `server/platform/config.js`). Every anonymous rate limiter keys on `req.ip`: register 8/h, login 12/15 min, OTP request 20/h, password reset 6/h, and the content routes. `docs/security/accepted-risks.md` R-4 says these limits are only as good as that number.

- **Too many hops:** a client sends its own `X-Forwarded-For` and gets a fresh bucket per request, so no limiter fires.
- **Too few hops:** `req.ip` is a proxy's address, and every user behind that proxy shares one bucket. A few users can then lock everyone else out of sign-in.

## Measurement, 8 November 2026 (staging only, read-only)

Origin `https://pri-learning-staging-staging.up.railway.app`, release `1d3829103`. Production was not probed and no Railway variable was read: the Railway CLI on this machine is logged out.

Method: anonymous `GET /v1/content/published-index` (limit 60 a minute per identity), one new connection per request. Two response headers identify where each request was counted:
- `RateLimit-Reset`: a bucket's window opens at its first request, so this value identifies the bucket.
- `x-hikari-trace`: which Railway edge node carried the request.

| Probe | Result |
|---|---|
| 30 requests interleaved with 30 calls to a public what-is-my-IP service | **20 distinct client egress addresses** (this client's VPN/NAT rotates per connection), but only **6 buckets, exactly one per edge node** (`sin1.462z`, `sin1.98a6`, `sin1.d1nj`, `sin1.hs0s`, `sin1.nzn2`, `sin1.tr00`) |
| `tools/verify-deployment-proxy.mjs` (24 plain + 8 forged requests) | `PROXY IDENTITY: PER-EDGE-NODE — 6 edge nodes, 6 buckets, one bucket per node` |
| Forged `X-Forwarded-For` with 1, 2 and 3 entries, and forged `X-Real-IP` | Never a bucket of its own: each landed in its edge node's bucket |

**Finding:** on staging, `req.ip` follows the Railway edge node, not the client. Spoofing is closed: Railway's edge overwrites caller-supplied `X-Forwarded-For`/`X-Real-IP`. But the limits are shared by everyone routed through the same edge node. So the configured `PRI_TRUSTED_PROXY_HOPS` does not match the real chain for this purpose.

If production has the same value (the cutover checklist uses `1` for both), the effect at launch is this: all anonymous sign-in, registration and OTP traffic through one Singapore edge node shares one bucket. Twelve login attempts in 15 minutes from anyone on that node would refuse the next one for everyone on it. This was **not measured on production**.

## Why the right value is not yet known

Railway states that the hop count is not fixed and publishes no proxy address ranges. It also tracks a 2026 bug where an edge/CDN layer puts its own address into `X-Forwarded-For`/`X-Real-IP`. Two explanations fit the measurement:
1. The app sees `X-Forwarded-For: <client>, <edge>` and the value is one too low. Raising it by one makes `req.ip` the client. Because the edge overwrites caller-supplied headers, a forged header still cannot reach the app through the public edge (only private-network callers, which are our own services, could forge it).
2. The edge writes its own address where the client's belongs. No hop count fixes that, and the limiter identity has to change in code (L2 platform + security, R4).

## What the owner (or anyone with Railway access) does

1. On `pri-learning-staging`, record `PRI_TRUSTED_PROXY_HOPS` (name and value only), e.g. `railway variables --service pri-learning-staging | grep PRI_TRUSTED_PROXY_HOPS`.
2. On staging only, set it to that value + 1. Railway redeploys.
3. Check the effect from a fixed address. The Release Staging Proof now runs `tools/verify-deployment-proxy.mjs` after every main merge, as an advisory step whose verdict appears in the run summary and the `staging-proof-<run>` artifact. Or run it from any shell with a stable public address:

   ```bash
   node tools/verify-deployment-proxy.mjs --origin https://pri-learning-staging-staging.up.railway.app
   ```

   - `PER-CLIENT` (exit 0): fixed. Record the value here and on #653, then set production to the same value as part of the production cutover (owner action; production is not touched by this lane).
   - `PER-EDGE-NODE` (exit 1) at value + 1 as well: explanation 2. Put staging back to the recorded value and open an L2/security change that keys anonymous limits on the edge-set client address.
   - `SPOOFABLE` (exit 1): put staging back to the recorded value at once.
   - `INCONCLUSIVE` (exit 2): the client's own address changed between connections (a VPN or carrier NAT), or only one edge node answered. Run it from a fixed address.
4. Once a value gives `PER-CLIENT`, make the advisory step blocking (remove the `exit 0`) in the PR that closes #653.

Production remains untouched until the owner's cutover. Never read production variables or logs from a lane session.
