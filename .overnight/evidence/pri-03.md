# PRI-03 Handwriting Forensic Diagnosis and Production API Wiring

- Task-start main SHA: `da6a50e05b5f3dc9f52929a0a8c284e940087bc1`
- Working branch: `task/pri-03-handwriting-production-wiring`
- Status: `IN_PROGRESS`
- Checkpoint 0: branch/evidence/state pushed before investigation.
- Checkpoint 1: runtime call graph and live production configuration inspected.

## Forensic Pencil-to-provider call graph

1. `InkSurface.canvasViewDidBeginUsingTool` / `canvasViewDidEndUsingTool` receive PencilKit input.
   - Input: real `PKCanvasView` drawing events.
   - Output: `StrokeCodec.strokes(from: canvas.drawing)`.
   - Physical iPad: yes; this is the release native surface.
2. `InkBridge.inkSurfaceDidChangeStrokes` increments `strokeRevision`, cancels stale recognition, emits `{type:"strokes",strokes}`.
   - JS delivery: `window.__priInkReceive(...)` through WKWebView.
   - Stale reads fail closed by surface epoch + stroke revision.
3. `client/src/ink/native.js` receives strokes and sends `foundationRecognize` / `recognize` requests through `webkit.messageHandlers.priInk`.
   - Output is a coded native reading with request id and engine.
4. `InkAnswer.jsx` publishes local reading first; cloud work is optional and never blocks local ink.
5. Cloud opt-in is `user.cloudHandwriting === true`.
   - Current defect: `cloudReadingEnabled` only checks that generic cloud transport exists, not that handwriting provider is usable.
6. `cloudReader.readWithCloud` calls `cloudRaster.rasterizeInk`.
   - Input: strokes only.
   - Output: tight black-on-white PNG data URL <= 700 kB.
   - No screenshot, question, expected answer, profile, or unrelated context is composited.
7. `cloud.transcribeHandwriting` posts exactly `{image}` to `/v1/handwriting/transcribe`.
   - Native release: `NativeCloudBridge` owns HTTPS cookies/CSRF outside `prilearning://`.
   - Browser: credentialed fetch to configured Pri cloud origin.
8. `server/platform/router.js` mounts `/handwriting` behind origin/CSRF and guardian-consent gates.
9. `createHandwritingRouter` adds session, verified-email and per-account rate-limit enforcement.
10. `validateRequestBody` rejects forbidden and unknown fields; `validateImage` rejects invalid/oversize raster before spend.
11. `consumePaidCall` enforces the shared provider ceiling before any paid call.
12. `handwritingProvider.transcribeHandwriting` sends the raster to the provider using server-only authorization, `store:false`, transcription-only system instructions and strict JSON schema.
13. Provider output is normalized to lines/text/confidence/confirmation state and returned to the client.
14. `InkAnswer.jsx` may supersede only when the cloud read is confident, line-aligned and the student has not manually corrected local glyphs.

## Release/native cloud path
- `WebShell.swift` injects `__PRI_NATIVE_INK__`, `__PRI_NATIVE_CLOUD__`, and `__PRI_NATIVE_CLOUD_CONFIGURED__`.
- It registers real WKScript handlers `priInk` and `priCloud`.
- Release cloud origin comes from signed Info.plist `PRICloudOrigin = $(PRI_CLOUD_ORIGIN)`.
- `NativeCloudBridge` accepts only HTTPS release origins and `/v1/*` paths, keeps cookies in native URLSession storage, and supplies CSRF for mutations.
- A missing/invalid native cloud origin fails closed as `CLOUD_DISABLED`.

## Answer-blind contract

- Server request schema permits only `image` and legacy `requestId`; client currently sends only `image`.
- Forbidden fields explicitly include prompt/question/expected answer/answer/solution/marks/profile/name/email/screenshot/page.
- Provider prompt explicitly says transcribe only; never solve, simplify, repair, complete or correct.
- Provider request uses `store:false`.
- Current official OpenAI docs were checked on 2026-09-30: Responses image input, `text.format` JSON schema, `store:false`, and model IDs `gpt-5.6-terra` / `gpt-5.6-sol` are supported.

## Defects/root causes found

1. **False-positive server readiness:** `GET /v1/handwriting/status` reports `available = key exists`; it does not validate endpoint/model/budget or provider reachability.
2. **Client bypasses handwriting status during recognition:** the question flow checks generic cloud transport availability, so an opted-in client can attempt a known-unusable handwriting route.
3. **Production provider is absent:** Railway production has no `PRI_HANDWRITING_API_KEY` and no handwriting provider/model/timeout/confidence variables.
4. **Production spend config is absent:** Railway production also has no `PRI_PAID_CALLS_PER_HOUR` or `PRI_PAID_CALLS_PER_DAY`.
5. **Production service itself is not currently healthy:** Railway reports the latest `Final-Pri-learning` deployment as failed/removed rather than a live successful deployment.
6. **Fallback failure is silent:** if the primary read is low-confidence and fallback fails, provider code returns the primary result without preserving a coded fallback failure for diagnostics.
7. **Provider 429 and 5xx collapse to one code:** current taxonomy loses the distinction needed for support diagnosis.
8. **Client UI loses server failure detail:** `InkAnswer` keeps only a generic failed cloud state instead of a safe last coded failure/latency/fallback record.

## Existing safety that is already correct

- Authentication required.
- Verified email required for transcription.
- Guardian-consent middleware wraps handwriting route.
- Per-account rate limit: 240/hour.
- Shared paid-call ceiling exists in code and is consumed only after payload/image validation.
- No automatic provider retry loop; fallback is bounded to one second model call.
- Native recognition uses request/revision/surface-epoch stale-result rejection.
- Provider/key never appears in client request schema.

## Physical iPad check

- Apple tooling sees a paired physical iPad Pro 11-inch (4th generation), iPadOS 26.6.1.
- Current state: **unavailable**.
- Xcode reports it must be unlocked/attached or reachable on LAN with Developer Mode.
- A connected M5 iPad entry is a simulator and is not accepted as physical evidence.
- Current gate status: `PHYSICAL_IPAD_BLOCKED_EXTERNAL` until the physical iPad becomes available.

## Live production configuration (values never recorded)

- Railway project: `profound-spontaneity`.
- Service: `Final-Pri-learning`; environment: `production`.
- Safe domain: `final-pri-learning-production.up.railway.app`.
- Handwriting provider credential: ABSENT by variable-name inspection.
- Handwriting model/endpoint/timeout/confidence variables: ABSENT by variable-name inspection.
- Paid provider hour/day ceiling variables: ABSENT by variable-name inspection.
- Secret values were not requested, printed, copied, or persisted.

## Planned PRI-03 repairs (within scope)

- Add fail-closed provider configuration/readiness validation and a bounded non-inference provider probe.
- Make `/v1/handwriting/status` distinguish configured, usable and degraded, with safe coded diagnostics + release SHA.
- Make the client consult handwriting readiness before cloud transcription.
- Persist only payload-free handwriting operational diagnostics (engine, availability, latency, code, fallback, release SHA).
- Extend deterministic server/client/native contracts for failure taxonomy, cancellation, fallback and status truthfulness.
- Keep hybrid arbitration/accuracy redesign out of PRI-03.

## Checkpoint 2 — server/provider/status repair
- Status no longer equates credential presence with readiness.
- Static provider validation covers endpoint scheme/path, model identifiers, timeout and confidence configuration.
- Operational readiness performs a bounded, cached provider/model probe and reports configured/usable/degraded/unavailable without exposing credentials or student data.
- Missing global paid-call hour/day ceilings force status unavailable before provider probing.
- Status includes safe model/fallback/confidence/timeout/failure/latency/release-SHA diagnostics.
- Provider HTTP auth, 429 and 5xx failures are distinct; transport unreachable, cancellation, malformed response and empty response remain coded.
- Low-confidence fallback failure is preserved in the returned safe diagnostics rather than silently discarded.
- Focused verification: npm run test:platform:handwriting PASS — 69/69 checks.

## Checkpoint 3 — client/diagnostics/cloud-wiring repair
- Cloud handwriting now performs a bounded /v1/handwriting/status readiness check before rasterising or transmitting student ink.
- Generic cloud transport availability is no longer sufficient to permit handwriting transmission.
- Status failures/offline behavior fail closed to the existing local/native recogniser.
- Payload-free runtime diagnostics expose only native availability, cloud usability, selected engine, last latency, coded failure, fallback occurrence and release SHA.
- Raw strokes/images are never written to diagnostics.
- Existing native/local path, answer-blind image-only request shape and conservative cloud arbitration remain intact.
- Focused verification: cloud handwriting PASS 52/52; cloud photo PASS 28/28; native bridge PASS.
- Production build was intentionally deferred until after this checkpoint commit because the release identity gate correctly rejects dirty source trees.

## Checkpoint 4 — failure matrix and secret safety
- Deterministic matrix covers: provider absent/invalid config; native bridge unavailable and stale-result rejection; invalid/oversized images; anonymous and unverified-account refusal; per-account rate limit; deployment-wide spend ceiling; provider timeout/unreachable/401/429/5xx; malformed/empty provider responses; low confidence; fallback attempt/failure; cancellation; and offline client readiness failure.
- Answer-blind request enforcement remains covered and passing.
- Focused matrix results: server handwriting 70/70 PASS; spend ceiling 22/22 PASS; cloud handwriting 52/52 PASS; cloud photo 28/28 PASS; native ink bridge PASS.
- Clean committed client build PASS; both tracked iOS web bundles regenerated and `npm run check:ios` PASS (157 files each).
- Secret scans PASS for tracked source, client/dist, both generated native Web resources, and workflow files.
- No provider credential or secret-like `sk-` value is present in client/native artifacts; only server-side configuration owns the credential boundary.

## Checkpoint 5 — production / Railway
- Railway project `profound-spontaneity`, service `Final-Pri-learning`, environment `production` re-verified.
- Service source still points to `Priysharan19/Final-Pri-learning` branch `main`; live main remains `dd5a1da68b971c797845eb6ed28dd9ae72221160`.
- Provider credential remains absent. `PRI_PAID_CALLS_PER_HOUR` and `PRI_PAID_CALLS_PER_DAY` also remain absent; no values were invented.
- Added only architecture-established non-secret variables: endpoint `https://api.openai.com/v1/responses`, primary model `gpt-5.6-terra`, fallback model `gpt-5.6-sol`, timeout `20000`, confidence floor `0.82`.
- Historic active deployment failure was diagnosed from Railway build logs: the image build could not resolve `docs/legal/*.md` during the client build. Current main already contains the repository-side Dockerfile repair (`COPY docs/legal ./docs/legal`).
- The existing Railway GitHub service has not created a deployment from current main; the safe variable update also did not produce a new deployment. Railway's available redeploy action explicitly reuses an existing commit, so it was not used to risk restoring stale production code.
- Public production probes currently return HTTP 404 `Application not found` for both `/v1/health` and `/v1/handwriting/status`.
- Result: `PROVIDER_CREDENTIAL_BLOCKED_EXTERNAL`; paid ceilings require owner budget values; current-production deployment activation is `BLOCKED_EXTERNAL` after diagnosis because the connected service is not deploying latest GitHub main and the available safe connector action cannot deploy a specified current commit without creating/replacing a service.

## Checkpoint 6 — physical iPad
- CoreDevice now sees the paired physical iPad Pro 11-inch (4th generation), iPadOS 26.6.1, but an actual Release destination build fails before compilation because development services require the device to be unlocked.
- Xcode error: the iPad `needs to be unlocked to enable development services`.
- Result remains `PHYSICAL_IPAD_BLOCKED_EXTERNAL`.
- Remaining physical procedure: unlock the paired iPad, keep it attached/available for development, build/install the Release-equivalent PriLearning target, then exercise PencilKit capture → bridge → local/cloud route → production endpoint → provider → returned transcription. Provider-end verification additionally requires the owner-authorized provider credential and paid-call ceilings.


## Current-main reconciliation
- Recovered uncommitted Checkpoint-2 provider/status work was preserved first in commit ce0f4cfefe370a7e0ec2c6d04cc7573e81ff1e13 and pushed before history changes.
- Fetched live production main explicitly because this crash-recovery clone originally had a single-branch fetchspec.
- Reconciled live main dd5a1da68b971c797845eb6ed28dd9ae72221160 into the PRI-03 branch with a normal merge; no conflicts.
- Post-merge focused sanity: npm run test:platform:handwriting PASS, 53/53 checks.

## Checkpoint 7 — fresh exact-candidate verification

- Re-verified live GitHub before final work: main remains dd5a1da68b971c797845eb6ed28dd9ae72221160; PRI-03 remote head at verification start was fc7fccf4112ebf6564ebb850c10a52daa84529a3; branch remains 0 commits behind main.
- Created a genuinely fresh checkout at exact candidate fc7fccf4112ebf6564ebb850c10a52daa84529a3 with no inherited node_modules or client/dist.
- Repository root intentionally has no package-lock.json; root npm ci therefore fails by design. Fresh dependencies were instead installed from the tracked lockfiles with npm ci --prefix server and npm ci --prefix client.
- Fresh-checkout focused verification:
  - npm run test:platform:handwriting — PASS, 70/70.
  - npm run test:handwriting:cloud — PASS, 52/52.
  - npm run build — PASS.
  - npm run check:ios — PASS, both native web bundles match client/dist at 157 files.
  - npm run test:release-authority — PASS; server release identity exactly fc7fccf4112ebf6564ebb850c10a52daa84529a3.
  - node tools/check-client-network-boundary.mjs — PASS, 203 source files scanned and one audited network-opening source.
  - npm run test:ink:bridge — PASS.
  - client/dist/native/workflow secret-artifact scan — PASS: 0 secret-like sk- values, 0 PRI_HANDWRITING_API_KEY, 0 OPENAI_API_KEY in those scopes.
- Local native synthetic self-check is not green on this Mac/Xcode runtime:
  - M5 iPad simulator: 6/10 exact, 93.8% character accuracy.
  - M4 iPad simulator: same 6/10 exact, 93.8% character accuracy.
  - The PRI-03 diff contains no .swift, Package.swift, or Info.plist changes versus main.
  - Exact current main dd5a1da68b971c797845eb6ed28dd9ae72221160 also fails the native self-check path on this Mac/runtime, so this is not evidence of a PRI-03 native-source regression. The protected Native Ink GitHub workflow runs independently on macos-15 and must adjudicate the exact PR head.
- Physical iPad was re-checked: CoreDevice reports the paired iPad Pro 11-inch (4th generation) available, but an actual Release destination build still fails because the device is locked and Xcode cannot enable development services. PHYSICAL_IPAD_BLOCKED_EXTERNAL remains accurate.
- Railway production remains stale/unhealthy and still has no provider credential or paid-call ceilings. An official Railway CLI login was attempted on the Mac to enable exact-candidate upload into the existing service; the browser OAuth flow received no callback and timed out. No stale deployment, replacement service, secret, or invented budget value was created.
- Production /v1/handwriting/status therefore remains unverified against the candidate because production has not been activated.

## Finishing checkpoint — exact production candidate and remaining external blockers

- Live GitHub advanced during finishing. PRI-03 was reconciled with current main `449be4203341a1228c590fada2604f9456b69b50`; generated iOS web bundles were regenerated from the merged source rather than manually conflict-resolved.
- The protected Suites gate failure on earlier head `a4388a35ff95550ab27d9bf228e5737320302842` was an exact-output invariant drift only: the cloud handwriting contract now truthfully passes 52/52 while CI still pinned 42/42. The invariant was updated without weakening coverage or handwriting thresholds.
- Native Ink on `a4388a35ff95550ab27d9bf228e5737320302842` completed PASS. On finishing code head `972443836f21dac587ea51a93693def41eb747c4`, Production Container, Person 2 India + Platform, Pri Agent Fleet Governance, Ink Hybrid, Pri App Health Agent and Ink Structural V4 Live LAN were already PASS while CI and Native Ink were still running.
- Railway authorization is restored. The existing project/service/environment were preserved; no replacement service was created.
- Required handwriting production variables are now all present. Without exposing values, Railway confirms `PRI_HANDWRITING_API_KEY`, `PRI_PAID_CALLS_PER_HOUR`, and `PRI_PAID_CALLS_PER_DAY` are PRESENT_NONEMPTY.
- Railway exact-commit deployment initially exposed a real release-identity build gap: manual exact deployments do not receive `RAILWAY_GIT_COMMIT_SHA` during Docker build. PRI-03 now supports an explicit manual candidate SHA/timestamp while making Railway's own Git SHA authoritative for normal GitHub-triggered deployments. Production runtime-image contract remains PASS 54/54 and security contract PASS 99/99.
- Exact candidate `972443836f21dac587ea51a93693def41eb747c4` now completes the Railway Docker image build successfully.
- The container then fails closed before serving traffic on an unrelated production baseline dependency: `PRI_AUTH_EMAIL_PROVIDER`, `PRI_RESEND_API_KEY`, and `PRI_AUTH_EMAIL_FROM` are ABSENT_OR_EMPTY and startup exits with `AUTH_EMAIL_NOT_CONFIGURED`. No email credential/sender was invented or provisioned as part of PRI-03.
- Consequently `/v1/health` and `/v1/handwriting/status` cannot yet be verified on the candidate, and the bounded live provider route cannot be exercised despite the handwriting credential and ceilings now being configured.
- Physical iPad re-check: iPad Pro (11-inch) (4th generation), iPadOS 26.6.1, Developer Mode enabled, paired/connected. The actual Release destination build still fails because Xcode requires the device to be unlocked to enable development services. This remains `PHYSICAL_IPAD_BLOCKED_EXTERNAL`.
- Final finishing state: software work is complete, but production acceptance is blocked externally by missing production auth-email configuration and the locked physical iPad. PRI-03 is not VERIFIED and PR #239 must not be merged yet.

## Final software repair — install/warm budget

- Exact failing head measured: `4d0dae4208037c1ce6232313b94f030b91919180`.
- Budget before repair:
  - install raw: `1,294,978` bytes.
  - first-visit raw (PRECACHE + WARM): `2,150,101` bytes.
  - first-visit gzip: `817,919` bytes.
  - configured first-visit raw ceiling: `2,150,000` bytes.
  - exact overage: `101` bytes.
- Exact current-main comparison at `449be4203341a1228c590fada2604f9456b69b50`: first-visit raw `2,144,493` bytes. The PRI-03 head was therefore `5,608` bytes larger than current main on the first-visit raw path.
- Asset isolation showed the dominant PRI-03 growth in the warm `cloudReader` chunk (`5,388 -> 10,407`, +`5,019` raw bytes), with a new shared `releaseIdentity` chunk of `1,246` raw bytes. The latter was not new functionality: `main.jsx` already installs release identity onto the runtime global at boot. The extra static import from `InkAnswer.jsx` made the bundler extract that already-bootstrapped helper into a shared first-visit chunk.
- Repair: removed the redundant `InkAnswer.jsx -> platform/releaseIdentity.js` static edge and read the already-installed `__PRI_RELEASE_IDENTITY__` / native release-identity runtime global when recording local handwriting diagnostics. Validation still passes the release SHA through `recordLocalHandwritingDiagnostics`, and cloud readiness continues to record the server release SHA.
- Budget ceiling changed: **NO**.
- Budget after repair:
  - install raw: `1,294,495` bytes.
  - first-visit raw: `2,149,569` bytes.
  - first-visit gzip: `817,622` bytes.
  - headroom below the unchanged raw ceiling: `431` bytes.
  - `npm run test:budget` — PASS, 44/44.
- Focused validation after the repair:
  - `npm run test:handwriting:cloud` — PASS, 52/52.
  - `npm run test:platform:handwriting` — PASS, 70/70.
  - `npm run build` — PASS.
  - `npm run sync:ios` — PASS; both tracked native web bundles regenerated from the repaired client build.
  - `npm run check:ios` — PASS; both native bundles match `client/dist` at 156 files.
  - `node tools/check-client-network-boundary.mjs` — PASS; 203 source files scanned, one audited network-opening source.
  - generated client/native/workflow artifact credential scan — PASS across 516 files: 0 `PRI_HANDWRITING_API_KEY`, 0 `OPENAI_API_KEY`, 0 secret-like `sk-` values.
- The repair does not remove handwriting diagnostics, readiness/failure handling, answer-blind enforcement, offline coverage, or any budget assertion.
