# Pri Learning production deployment contract

Pri Learning's learning experience remains offline-first. This document covers the optional production cloud control plane in `server/`.

## Immutable application image

The root `Dockerfile` uses Node 24, builds the React client, installs only production server dependencies, and serves the client plus `/v1` control plane from one image:

```bash
SHA="$(git rev-parse HEAD)"
BUILD_TS="$(git show -s --format=%cI "$SHA")"
docker build \
  --build-arg PRI_RELEASE_SHA="$SHA" \
  --build-arg PRI_BUILD_TIMESTAMP="$BUILD_TS" \
  -t pri-learning .
```

The production image deliberately excludes the legacy `/api` backend and `server/engine/` shims. It ships the `/v1` platform runtime, production server dependencies, the built client, and the shared release metadata only. Exact release identity is required at build time because `.git` is excluded from the image context.

Production configuration belongs in the deployment platform, not the image. Start from `.env.production.example`; never commit real secrets.

## Persistent storage is mandatory

Production startup requires `PRI_PLATFORM_DB` to be an absolute path. Mount persistent storage at `/data` and use:

```text
PRI_PLATFORM_DB=/data/pri-learning-platform.db
```

Missing, relative, and `:memory:` production database paths are rejected before SQLite opens or creates a database file. Run one application process against a given SQLite volume; do not mount the same SQLite file into multiple independently scheduled writers.

## HTTPS and origin

Terminate TLS at the hosting platform or reverse proxy and set `PRI_PUBLIC_ORIGIN` to the exact clean HTTPS browser origin, for example `https://learn.example.com`. The container listens on `PORT` (default `4000`).

## The proxy topology is configuration, not a guess

`PRI_TRUSTED_PROXY_HOPS` is required in production and has no default. It states how many reverse proxies stand between the internet and the process, and it is the number Express uses to derive `req.ip` from `X-Forwarded-For` — the identity the anonymous rate limiters count against.

```text
PRI_TRUSTED_PROXY_HOPS=0   # the process is exposed directly
PRI_TRUSTED_PROXY_HOPS=1   # one load balancer, CDN or platform router (the usual answer)
PRI_TRUSTED_PROXY_HOPS=2   # two, for example Cloudflare in front of a platform router
```

Both wrong answers fail silently, which is why the value is stated rather than assumed:

- **Too high.** The server believes a header the client controls. One socket sending a rotating `X-Forwarded-For` gets a fresh rate-limit identity per request, so the 8-registrations-per-hour and 6-reset-emails-per-hour limits never fire.
- **Too low.** Every request appears to come from the proxy, so all users share one bucket and one busy school rate-limits everyone else.

Count the hops that actually rewrite the header for your deployment, and check the value after any change to the edge: adding a CDN in front of an existing load balancer changes the correct answer from `1` to `2`.

If the count is wrong upward, `server/test/proxy-identity-contract-check.mjs` is the shape of the failure: a spoofed `X-Forwarded-For` creating a second rate bucket.

Verify a live deployment with:

```bash
curl -fsS https://learn.example.com/v1/health
```

A healthy response must identify `pri-learning-platform`, report `storage.persistentDatabase: true`, and include the exact `releaseIdentity` for the running source SHA. Provider readiness fields and release diagnostics expose no credentials, student data or filesystem paths.

## Email, billing and identity

Verification/reset email uses the deployment-only Resend variables in `.env.production.example`. Razorpay and Apple product variables may remain unset until those commercial paths are enabled; once product identifiers are configured, the server fails closed when required provider verification configuration is incomplete.

Google and Apple identity client IDs are deployment configuration. Provider secrets must never enter the client bundle.

The web client shows **Continue with Google** and **Continue with Apple** only when the server names a web client id for that provider (`GET /v1/account/identity/providers`), and only when the page is served from the cloud origin itself:

- `PRI_GOOGLE_CLIENT_IDS` / `PRI_APPLE_CLIENT_IDS` list every audience the token verifier accepts. `PRI_GOOGLE_WEB_CLIENT_ID` (a Google OAuth web client) and `PRI_APPLE_WEB_CLIENT_ID` (an Apple Services ID) name the one the browser uses; each must also appear in its list.
- Google: add `https://<origin>/auth/callback.html` as an authorised redirect URI and `https://<origin>` as an authorised JavaScript origin. The popup uses the OpenID Connect implicit flow (`response_type=id_token`); no client secret is involved.
- Apple: register `<origin>` as a domain and `https://<origin>/v1/account/identity/apple/callback` as a return URL on the Services ID. Apple form-posts its answer there and the server relays it to `/auth/callback.html` as a URL fragment, verifying and storing nothing.
- Every sign-in uses a server-issued single-use nonce. A new account made with a provider carries the same age declaration as the email form, so a child's account still waits for a guardian before it syncs; **Sign in** never creates an account.
- The iPad, iPhone and Android shells do not show these buttons yet. Their sign-in belongs to the OS sheets (AuthenticationServices, Credential Manager), which are not wired. If Google sign-in is ever offered in the iOS app, App Store guideline 4.8 also requires Sign in with Apple there.

## Operational evidence still required

A green container build proves deployability, not that the commercial environment is live. Launch evidence still requires a real persistent volume, public HTTPS/domain, live Resend delivery, live Razorpay webhook/payment validation, App Store/StoreKit sandbox validation, backup/restore exercises, and physical-device QA.

After the public deployment exists, configure the GitHub App Health workflow's `PRI_APP_URL` secret so live-origin health is included in release evidence.
