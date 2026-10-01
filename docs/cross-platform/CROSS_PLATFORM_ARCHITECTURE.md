# Cross-Platform Architecture (CP-01)

- **Status:** Authoritative plan for iPad, iPhone, Android phone and Android tablet.
- **Evidence identity:**
  - Initial audit baseline: `main` @ `421f1ff1bbea6ed8014a2ad8f6fa2b24a149c73a` (2026-10-01 UTC).
  - Revalidated against `main` @ `83bde98a6fde5dd595c52c0f201ad339147a8dcd` (async store / Supabase Postgres, PRs #244 and #247); every cited fact still holds.
  - Final CP-01 candidate: the head of PR #250 at merge.
- **Scope:** the audit and the architecture decision. It does not implement CP-02 onward. See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
- **Subordinate to:** [authoritative-architecture.md](../architecture/authoritative-architecture.md) and [ADR-0001](../architecture/adr-0001-online-first-runtime.md). Where this document talks about runtime authority (data, hosting, AI providers), those documents govern.
- **Machine check:** `client/test/cross-platform-architecture-check.mjs` (wired into `npm run test:contracts`).

## 1. Decision

Pri Learning ships as **one shared product core** (the React/Vite client in `client/src`, plus the `/v1` server in `server/`), hosted inside **thin native shells**. The shells add capabilities that a web view cannot provide on its own.

```
                ┌───────────────────────────────────────────────┐
                │ Shared product core — client/src (React/Vite)  │
                │  routing · local engine & marking · curriculum │
                │  adaptive · progress · UI · i18n · sync worker │
                │  cloud client (cloudTransport) · entitlements  │
                │          ▲ platform-neutral contract ▲         │
                │      client/src/platform/native/* (CP-02)      │
                └───────┬──────────────┬──────────────┬─────────┘
                        │              │              │
          ┌─────────────▼───┐  ┌───────▼────────┐  ┌──▼──────────────┐
          │ Apple shell      │  │ Android shell  │  │ Browser / PWA   │
          │ ios/PriLearning  │  │ android/ (CP-06)│  │ (no shell)      │
          │ .swiftpm         │  │ Kotlin+WebView  │  │ fallbacks only  │
          │ WKWebView +      │  │ AssetLoader +   │  │ fetch+cookies,  │
          │ PencilKit, Vision│  │ Play Billing,   │  │ canvas ink,     │
          │ StoreKit 2, URL- │  │ OkHttp cloud,   │  │ <input file>,   │
          │ Session cloud,   │  │ PhotoPicker,    │  │ <a download>    │
          │ share sheet      │  │ Share Intent    │  │                 │
          └─────────┬────────┘  └───────┬────────┘  └──┬──────────────┘
                    └────────── HTTPS /v1 (one server, one auth model) ┘
```

What this means in practice:

- **No second product.** Swift and Kotlin hold no curriculum, marking, adaptive, progress or entitlement logic. "AI proposes, the deterministic engine decides" stays inside the shared JavaScript engine on every platform.
- **No React Native or Flutter rewrite.** The same `client/dist` build is bundled into every shell, as `scripts/sync-ios.mjs` already does for Apple.
- **The Apple shell is kept and extended.** It is not replaced. PencilKit ink, the Vision photo reader, StoreKit 2 and the native cloud cookie jar are regression-protected iPad behaviour.
- **One platform-neutral contract** replaces direct `window.webkit.messageHandlers.*` access across the app (CP-02). Product code asks "can this host draw stylus ink?" and never asks "is this iOS?".

## 2. Exact current architecture (verified, not assumed)

| Claim in the brief | Verified? | Evidence |
|---|---|---|
| The product client is React/Vite | Yes | `client/package.json` (react 18, vite 8, react-router-dom 7), `client/vite.config.js` |
| The native Apple package lives under `ios/` | Yes | `ios/PriLearning.swiftpm` is canonical. `ios/PriLearning 2.swiftpm` is a compatibility copy whose Swift, `Package.swift` and `Resources/Web` are identical (only `RELEASE.md` differs). `ios/PriLearning.swiftpm.zip` is a **stale** 2026-08-23 snapshot without the cloud, billing or photo bridges. |
| The Apple shell hosts the bundled client in WKWebView | Yes | `ios/PriLearning.swiftpm/WebShell.swift` loads `prilearning://app/` through `LocalSchemeHandler.swift`, using the persistent `WKWebsiteDataStore.default()` |
| `Package.swift` declares `.pad` and `.phone` | Yes | `ios/PriLearning.swiftpm/Package.swift`, `supportedDeviceFamilies: [.pad, .phone]`, iOS 16.0 minimum. The CP-01 audit's one-off simulator build produced an `Info.plist` with `UIDeviceFamily = [1, 2]`; that is synthetic evidence, not in CI, and the source `Info.plist` does not set the key. |
| Native bridges | Yes, five | `priInk` (PencilKit and the on-device recogniser), `priPhoto` (Vision OCR), `priBilling` (StoreKit 2), `priCloud` (URLSession `/v1` with a native cookie jar), `priShare` (UIActivityViewController). In addition, `<a download>`/blob navigations become a `WKDownload`, are written to a temp file and are opened in the share sheet (`WebShell.swift` download delegate). There are **no** lifecycle, storage, haptics or deep-link bridges. |
| React holds Apple/WebKit assumptions | Yes | Detection is scattered across 10+ modules (section 3) |
| The cloud backend is reusable by every client | **Partly** | The `/v1` auth, sync, AI and entitlements are client-agnostic. The **origin guard only exempts `X-Pri-Client: ios-native-v1`** (`server/platform/security.js`). There is **no Google Play verifier** (`server/platform/billing.js` returns `BILLING_PROVIDER_NOT_CONFIGURED`), and `/v1/health` hard-codes `google: false` (`server/platform/router.js`). |

### 2.1 Runtime layers today

1. **The shell** (Swift, 6,995 lines across 26 tracked files). Most of it is the on-device ink recogniser stack under `ios/PriLearning.swiftpm/Ink/`. The shell itself is `WebShell.swift`, `LocalSchemeHandler.swift`, `NativeCloudBridge.swift`, `StoreKitBillingBridge.swift`, `PhotoOCR.swift` and `ReleaseIdentity.swift`.
2. **The web runtime** is `client/dist`, served from the custom origin `prilearning://app`. React Router uses `BrowserRouter`. It works only because the scheme handler returns `index.html` for extensionless paths.
3. **The local learning backend** (`client/src/api.js` → `client/src/local/gateway.js` → `client/src/local/backend.js`) runs in process against IndexedDB `pri-learning` v4 (18 object stores, AES-sealed per-profile stores; `client/src/local/idb.js`) plus a second database, `pri-ink-personal` v1 (`client/src/ink/personal.js`). **Both are keyed to the bundled origin.** It never touches the network.
4. **The cloud client** (`client/src/platform/cloudTransport.js`) is the only module allowed to perform network I/O. That rule is enforced by `tools/check-client-network-boundary.mjs`. Browsers use `fetch` with cookies and a CSRF header. The Apple shell uses the `priCloud` bridge, so cookies never reach JavaScript.
5. **The server** (`server/app.js` → `/v1` `server/platform/router.js`) uses cookie sessions only (no bearer tokens) and double-submit CSRF. It has a single allowed browser origin and **no CORS**. OpenAI keys stay on the server only.

### 2.2 Native-to-JavaScript protocols today (inconsistent)

| Bridge | JS → native | Native → JS | Request id | Timeout (JS) | Errors |
|---|---|---|---|---|---|
| `priInk` | `postMessage({op,…})` | global `window.__priInkReceive` | incrementing int | 8 s / 14 s | never rejects; empty reading with an engine suffix |
| `priPhoto` | `postMessage({reqId,dataURL})` | global `window.__priPhotoReceive` | incrementing int | 12 s | `{ok:false,error}` causes a reject |
| `priBilling` | `postMessage({id,action,…})` | `CustomEvent pri:native-billing-response` / `-update` | UUID | 30 s to 5 min | `{code,message}` |
| `priCloud` | `postMessage({id,action,…})` | `CustomEvent pri:native-cloud-response` | `native-<uuid>` | 12 to 60 s, plus a `cancel` message | `{code,message}` |
| `priShare` | `postMessage({filename,content})` | none (fire and forget) | none | none | silent |
| `WKDownload` (implicit) | `<a download>` / blob navigation | share sheet when the download finishes | none | none | silent on failure |

None of the bridges carries a protocol version. Detection happens once at module load (`client/src/ink/InkAnswer.jsx`, `client/src/ink/Calibrate.jsx`). The Swift handlers check neither `frameInfo.isMainFrame` nor the security origin, and the flag script is injected with `forMainFrameOnly: false`. CP-02 closes both gaps.

## 3. Apple/WebKit assumptions inside shared JavaScript (to be abstracted)

| Location | Assumption |
|---|---|
| `client/src/ink/native.js` | `window.webkit.messageHandlers.priInk` and `__PRI_NATIVE_INK__` |
| `client/src/ink/personal.js`, `client/dev/devStructural.js` | `__PRI_NATIVE_INK__` flag only |
| `client/src/native/photo.js` | `messageHandlers.priPhoto` and `__PRI_NATIVE_PHOTO__` |
| `client/src/platform/nativeBilling.js` | `messageHandlers.priBilling`. StoreKit-shaped: `appAccountToken`, "App Store" copy |
| `client/src/platform/cloudTransport.js` | `messageHandlers.priCloud`, `__PRI_NATIVE_CLOUD__` and `__PRI_NATIVE_CLOUD_CONFIGURED__` |
| `client/src/lib/files.js`, `client/src/components/InkPhysicalEvidenceSession.jsx` | `messageHandlers.priShare` |
| `client/src/main.jsx`, `client/src/local/offlineWarm.js`, `client/src/local/backend.js`, `client/src/components/CloudAccountPanel.jsx`, `client/src/pages/SettingsLegacy.jsx` | `__PRI_NATIVE__` is read as "the iOS app" (no service worker, persisted storage, no web checkout, iPad install copy) |
| `client/src/components/CloudAccountPanel.jsx` | "native shell" is treated as "Apple purchase UI" |
| `client/src/ink/InkAnswer.jsx`, `client/src/i18n/strings.en.js` | User copy says "Apple Pencil", "full-screen iPad experience" |
| `client/src/ink/native.js` | Clip geometry hard-codes `.topbar` / `.sidebar` and `window.innerWidth/innerHeight` |
| `client/src/ink/interactionGuard.js` | WebKit-only `-webkit-touch-callout` / `-webkit-user-drag` guards (harmless on Chromium, but untested there) |

**Browser-only assumptions:** the service worker precache and warm-up (disabled under native), `navigator.storage.persist`, `window.print()` as the only PDF path (`client/src/pages/Exams.jsx`, `client/src/pages/ProgressLegacy.jsx`, `client/src/pages/Teach.jsx`), `<a download>` exports (`client/src/components/CloudAccountSecurity.jsx` has no native branch and relies on the shell's implicit `WKDownload` path; it revokes the blob URL on the next tick, a possible race with WebKit reading the blob, which is unverified on device), and `navigator.onLine` with no `online`/`offline` listeners.

## 4. The platform-neutral contract (target for CP-02)

### 4.1 Placement and naming

The contract lives at `client/src/platform/native/` (CP-02 creates it). The evidence for this placement: `client/src/platform/` already owns cloud transport, billing and entitlements. The five existing bridges map one to one onto capabilities, so the names stay close to the brief:

```
priNative.host        // handshake: protocol, shell version, release, capability table; host.diagnostics (OS identity, logs only)
priNative.ink         // stylus/finger native ink surface + on-device recognition
priNative.photo       // pick/capture image → bytes; optional on-device OCR
priNative.billing     // store products, purchase, restore, finish (opaque signed proofs)
priNative.cloud       // /v1 HTTPS with native cookie jar
priNative.share       // share/export a file (text or binary); share.print → system print
priNative.files       // import a file (picker) — browser keeps <input type=file>
priNative.lifecycle   // foreground/background/memory-warning/back-button events
priNative.storage     // persistence status + export of diagnostics (no learning data)
priNative.device      // form-factor hints the CSS cannot know (stylus present, safe-area source)
```

`device` deliberately carries **no** idiom or OS-sniffing API. Layout comes from CSS/viewport (see [FORM_FACTOR_SPEC.md](FORM_FACTOR_SPEC.md)). `device` reports only facts the page cannot measure, such as "a stylus has been paired or seen", "the shell already applies safe-area insets" and "a hardware back button exists".

### 4.2 Handshake and capability detection

The shell injects one non-writable object at document start, main frame only. On Apple this is a `WKUserScript` with `forMainFrameOnly: true`. On Android it is `WebViewCompat.addDocumentStartJavaScript` with the origin rule, gated on `WebViewFeature.DOCUMENT_START_SCRIPT`. If that feature is unsupported, the shell fails closed and offers no native capabilities.

```js
Object.defineProperty(window, '__PRI_HOST__', { writable: false, configurable: false, value: Object.freeze({
  protocol: 1,                       // envelope protocol (integer; bumped only on a breaking envelope change)
  // NO `platform` key: OS identity is available only through the `host.diagnostics` op,
  // for logs and support, so product code cannot branch on it.
  shell: { version: '4.0', build: '2', id: 'com.prilearning.app' },
  release: { /* the bundled release.json (schemaVersion 1), same object as __PRI_NATIVE_RELEASE_IDENTITY__ */ },
  capabilities: {                    // absent key ⇒ unsupported
    ink:       { versions: [1], stylus: true, finger: true, recognizer: 'pri-foundation' },
    photo:     { versions: [1], capture: true, library: true, ocr: true },
    billing:   { versions: [1], store: 'app-store' | 'play' }, // selects store copy/SDK flow only, never layout or logic
    cloud:     { versions: [1], configured: true },
    share:     { versions: [1], binary: true, print: true },
    files:     { versions: [1] },
    lifecycle: { versions: [1], backButton: false },
    storage:   { versions: [1], durable: true },
    device:    { versions: [1], stylusSeen: false, safeAreaApplied: true },
  },
}) });
```

Rules:

- **Capabilities, not OS identity.** `priNative.has('billing')` reads only `__PRI_HOST__.capabilities`. It is evaluated lazily on every call, never cached at module scope, which fixes the import-time `NATIVE_INK` constant. From CP-02, the architecture check fails any read of `host.diagnostics` / OS identity outside `client/src/platform/native/`.
- **No host.** When `__PRI_HOST__` is absent, `priNative` is a browser host and every capability resolves to its web fallback, or to `UNSUPPORTED`.
- **Protocol negotiation.** JavaScript accepts a host whose `protocol` ≤ its own `MAX_PROTOCOL`. If `protocol > MAX_PROTOCOL`, JavaScript treats the host as a browser host (no native capabilities) and records `PROTOCOL_UNSUPPORTED` in diagnostics. It never crashes and never guesses. Every envelope's `v` must equal the negotiated `protocol`; a mismatch is `BAD_REQUEST`.
- **Capability negotiation.** Each capability advertises every version it still serves (`versions: [1, 2]`). JavaScript uses the highest version common to both sides; if there is none, the capability is unsupported. A shell can add v2 while still serving v1, so it never has to remove a capability to evolve it. Because `client/dist` is bundled inside the shell they normally ship together. Negotiation exists for staged rollouts, the LAN dev server and any future over-the-air web update.
- **Hints, not authority.** Page script can read, but cannot replace, `__PRI_HOST__`. Even so, its flags are *hints* for UI. Native code independently rejects any request for a capability or version it did not advertise (`UNSUPPORTED`), and validates every request on its own. No capability flag grants entitlement, identity or access.
- **Migration from the legacy bridges.**
  - During CP-02 the Apple shell keeps injecting the legacy `__PRI_NATIVE_*__` flags *and* `__PRI_HOST__`.
  - For each capability, the adapter uses **exactly one** transport: `priBridge` when the capability is advertised in `__PRI_HOST__`, otherwise the legacy handler, never both. A purchase or cloud mutation therefore cannot be sent twice.
  - The legacy handlers get the same main-frame and origin checks in CP-02.
  - Legacy flags and handlers are deleted only after one released Apple build has shipped `__PRI_HOST__`.

### 4.3 Envelope

One transport and one dispatcher per host:

| Direction | Apple | Android |
|---|---|---|
| JS → native | `window.webkit.messageHandlers.priBridge.postMessage(envelope)` | `priBridge.postMessage(JSON)`, an object injected by `WebViewCompat.addWebMessageListener` with allowed-origin rule `https://appassets.androidplatform.net` (only when `WebViewFeature.isFeatureSupported(WEB_MESSAGE_LISTENER)`; otherwise the shell **fails closed** and offers no native capabilities) |
| native → JS | `evaluateJavaScript("window.__priNativeReceive(…)")` | `JavaScriptReplyProxy.postMessage(JSON)`, routed to the same `__priNativeReceive` |

```ts
// JS → native request
{ v: 1, id: string /* uuid, ≤120 */, cap: 'billing', op: 'purchase', payload: {...}, timeoutMs?: number }
// native → JS response (exactly one per request, unless the request was cancelled and native drops it)
{ v: 1, id, ok: true,  result: {...} }
{ v: 1, id, ok: false, error: { code: PriNativeErrorCode, message: string, retryable: boolean, detail?: { providerCode?: string } } }
// JS → native cancel (gets no response of its own)
{ v: 1, id: newId, cap, op: 'cancel', payload: { target: id } }
// native → JS request (native asks JS something and needs an answer, e.g. Android Back)
{ v: 1, id, req: 'lifecycle.backRequested', payload: {} }     // JS answers with { v, id, ok: true, result: { handled } }
// native → JS event (one-way)
{ v: 1, event: 'billing.transactionUpdated' | 'ink.strokes' | 'lifecycle.state' | ..., seq: number, payload: {...} }
```

**Error codes (closed set):** `UNSUPPORTED`, `BAD_REQUEST`, `TIMEOUT`, `CANCELLED`, `USER_CANCELLED`, `PERMISSION_DENIED`, `UNAVAILABLE` (offline, store unavailable, cloud not configured), `TOO_LARGE`, `PROVIDER_ERROR`, `UNVERIFIED`, `INTERNAL`.
- JavaScript maps any code outside this set to `INTERNAL`.
- Existing provider codes such as `STOREKIT_TRANSACTION_UNVERIFIED` and `CLOUD_NETWORK_ERROR` are kept in `detail.providerCode`, so current tests and telemetry keep their meaning.

**Async, timeout and cancellation:**

- Every call returns a Promise and accepts `{ signal: AbortSignal, timeoutMs }`.
- **JavaScript owns the timeout.** On timeout or abort, JavaScript rejects with `TIMEOUT` or `CANCELLED` and sends `cancel`.
- **Native clamps** `timeoutMs` to a per-op maximum and never times out *before* JavaScript. A native-side timeout replies `TIMEOUT`.
- On `cancel`, native either replies to the *target* with `CANCELLED` or drops it; `cancel` itself gets no response.
- **Not cancellable once committed:** `billing.purchase` cannot be cancelled after the store sheet is shown, and a cloud request cannot be cancelled after it has been sent. For these, cancellation only stops JavaScript waiting.
- The per-op defaults match today's values: ink read 8 s / 14 s, photo 12 s, cloud 12 s (25 s for handwriting, 35 s for working), billing 30 s to 5 min.
- **Late replies are never silently lost when they carry value.**
  - A late `billing.purchase` / `billing.restore` result is re-emitted as a `billing.transactionUpdated` event. Native never finishes or acknowledges a transaction until the server has accepted it. A paid transaction therefore survives a JavaScript timeout and is replayed by the store on next launch.
  - Every cloud mutation carries an `Idempotency-Key` on both shells, as the Apple bridge already sends. Retrying after a timeout is therefore safe, even if the late reply was dropped.
  - Other late replies (reads, ink, photo) are dropped.
- **Duplicates and limits.**
  - A request whose `id` is already in flight is `BAD_REQUEST`.
  - At most 32 in-flight requests per capability; beyond that, `UNAVAILABLE` with `retryable: true`.
  - Envelopes are capped at 1 MB (8 MB for `photo` payloads), otherwise `TOO_LARGE`. The cloud bridge keeps its own 1 MB / 2 MB caps.
- **Ink is the exception that never rejects.** `ink.recognize` keeps today's "resolve with an empty reading tagged with the failure reason" semantics, because `client/src/ink/InkAnswer.jsx` consensus depends on it. The failure is reported in `reading.error.code`, which uses the same closed error set.

**Events and reloads:**

- **Subscribing.** Events are delivered through `priNative.on(event, fn) → unsubscribe`. The ink stroke stream, billing transaction updates and lifecycle state are events, not responses. Each event carries a per-document monotonically increasing `seq`.
- **`host.ready`.** JavaScript sends `host.ready` once its subscribers are installed. Native buffers `billing.*` events until then and delivers them in order. Ephemeral events (`ink.strokes`, `lifecycle.state`) are not buffered; their latest state can be re-queried.
- **Reloads.** Any main-frame navigation or reload cancels every in-flight native request: native drops their replies. After the new document's `host.ready`, native re-delivers undelivered `billing.*` events.
- **Lifecycle state.** A lifecycle `state` event (`active` | `inactive` | `background`) supplements, and never replaces, `visibilitychange`. The drafts flush in `client/src/components/drafts.js` keeps working in browsers.
- **Native questions to JavaScript** (Android Back) use the native → JS *request* form above. If JavaScript does not reply within 300 ms, native treats the request as unhandled.

### 4.4 Security boundaries (non-negotiable)

1. **Origin and frame pinning.** Native handlers accept messages only from the main frame of the bundled origin: `prilearning://app` on Apple, `https://appassets.androidplatform.net` on Android. Apple checks `message.frameInfo.isMainFrame` and `securityOrigin`. Android passes the origin rule to `addWebMessageListener` and **never** uses `addJavascriptInterface`.
2. **Navigation lockdown.** Remote `http(s)` navigation leaves the web view for the system browser, as the Apple shell already does. No remote page can ever reach `priBridge`.
3. **Cloud bridge allowlist** (as `ios/PriLearning.swiftpm/NativeCloudBridge.swift` already enforces): `/v1/` paths only, at most 200 characters, no `..`, `?` or `#`. Methods GET, POST, PATCH and DELETE. Requests capped at 1 MB and responses at 2 MB. HTTPS only in release builds. The cloud origin comes from build configuration, never from the page.
4. **Cookies never cross into JavaScript.** The native jar holds `pri_cloud_session`. Native code copies `pri_csrf` into `X-Pri-CSRF`. On Android the jar is persisted in app-private storage, encrypted with an Android Keystore key.
5. **No secrets in any shell.** OpenAI, Supabase service-role, Razorpay, Apple root and Play service-account credentials live only in server environment variables. The machine check scans `ios/` (including the shipped web bundle) and, once it exists, `android/` for secret patterns.
6. **Entitlement authority stays server-side.** The shells return *opaque signed proofs* (an Apple JWS `signedTransaction`, a Play `purchaseToken`). JavaScript forwards them to `/v1/billing/*`. Only the server verifies them and grants entitlement. Shells finish or acknowledge a transaction **only after** the server accepts it, which is the current Apple behaviour and also the Play behaviour. (Local *enforcement* of Premium is a separate open issue; see §5 risk 5.)
7. **Answer-blind handwriting.** Ink and photo payloads sent to native recognisers or the cloud never include expected answers or solutions.
   - This is unchanged from `client/src/ink/cloudWorking.js` / `client/src/ink/cloudReader.js`.
   - From CP-02, `ink.*` and `photo.*` payloads use a **schema allowlist**: strokes, image bytes, and context derived only from the public prompt text.
   - A contract test fails if any payload key or value contains the question's expected answer, solution or mark.
8. **Payload validation in both directions.**
   - Native validates types and sizes before acting.
   - JavaScript validates every reply against a per-op reply schema (`client/src/platform/native/envelope.js`, CP-02). A non-conforming reply becomes `INTERNAL`, and readings are clamped to expected types and lengths.
   - A compromised or outdated shell is still untrusted input to the marker, and the deterministic engine remains the only mark authority.

### 4.5 Testability

- `client/src/platform/native/` ships a `createFakeHost({capabilities, handlers})` test double. It installs `__PRI_HOST__` and a scripted `priBridge`, so every capability is unit-testable in Node, the same way `client/test/native-ink-check.mjs` and `client/test/photo-ocr-bridge-check.mjs` already fake the WebKit handlers.
- Contract tests run the **same** envelope fixtures against the JavaScript adapter, the Swift shell (an XCTest target or the `--bridge-selfcheck` launch argument) and the Kotlin shell (a JVM unit test plus an instrumented WebView test).
- The CP-01 architecture check ratchets direct `messageHandlers` access down to an allowlist. CP-02 must shrink that allowlist to the contract module alone.

## 5. Known architectural risks found by this audit

| # | Risk | Severity | Owner / task |
|---|---|---|---|
| 1 | **The bundled origin is the data key.** Changing `prilearning://app` (Apple) or `https://appassets.androidplatform.net` (Android) orphans `pri-learning` and `pri-ink-personal` IndexedDB data and localStorage | Data loss | reliability / guarded by the CP-01 check |
| 2 | Bridge handlers accept messages from any frame; flags are injected into subframes | Medium (remote navigation is blocked, so this is defence in depth) | ios-native / CP-02 |
| 3 | Server origin guard exempts only `ios-native-v1`, so an Android native client is refused unless it impersonates iOS | Blocks Android | platform + security / CP-07 |
| 4 | No Google Play verifier and no RTDN handling; `google: false` hard-coded | Blocks Android billing | commercial / CP-08 |
| 5 | Premium enforcement reads an **unsigned** cached entitlement snapshot from IndexedDB (`client/src/local/entitlementGate.js`). Grants are server-authoritative, but no server route checks Premium. The same weakness exists on every platform. | Medium, commercial | commercial + security, tracked separately (not a CP task) |
| 6 | iPhone native ink defaults to Pencil-only (`ios/PriLearning.swiftpm/Ink/InkSurface.swift`), so an iPhone student cannot draw until they find the Finger toggle | Blocks iPhone | handwriting / CP-04 |
| 7 | The CI native build targets only iPad simulators (`scripts/ink-native-check.mjs`) | iPhone regressions are invisible | ios-native / CP-04 |
| 8 | Account export (`client/src/components/CloudAccountSecurity.jsx`) relies on the implicit `WKDownload` path and revokes its blob URL on the next tick (possible race; unverified on device) | Unverified | platform / CP-02 |
| 9 | `ios/PriLearning.swiftpm.zip` is a stale snapshot without the cloud, billing or photo bridges | Confusing artefact | ios-native / CP-04 cleanup |
| 10 | Native package drift gate (`scripts/check-native-package-sync.mjs`) checks only Swift and `Package.swift`; `Info.plist` and `Resources/Models` are ungated (`Resources/Web` is gated by `npm run check:ios`) | Copies can diverge | ios-native / CP-04 |
| 11 | No `android/` ownership rule in `.pri-os/fleet.json`, so Android paths would be unowned | Governance | qa-release / CP-06 |
| 12 | The landing copy and README still describe "offline-first, cloud optional", which ADR-0001 supersedes | Copy accuracy | student-experience (out of CP scope) |

## 6. What stays where

| Concern | Shared core (JS/server) | Shell (Swift/Kotlin) |
|---|---|---|
| Curriculum, generators, marking, Step Check, adaptive, progress | ✅ only here | ❌ never |
| Handwriting recognition (on-device JS, cloud vision) | ✅ | Optional accelerator (PencilKit + the Core ML foundation model on Apple; none on Android until CP-09 proves one) |
| Native ink capture surface | API contract | ✅ PencilKit (Apple). Android uses web canvas ink first (section 5 of [ANDROID_ARCHITECTURE.md](ANDROID_ARCHITECTURE.md)) |
| Cloud session cookies | ❌ never visible | ✅ native jar |
| Purchase UI and store SDK | Paywall UI, product copy | ✅ StoreKit 2 / Play Billing |
| Purchase verification and entitlement | ✅ server only | ❌ never |
| Layout and form factor | ✅ CSS/viewport | Safe-area and system-bar plumbing only |
