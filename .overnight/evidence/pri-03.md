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

## Current-main reconciliation
- Recovered uncommitted Checkpoint-2 provider/status work was preserved first in commit ce0f4cfefe370a7e0ec2c6d04cc7573e81ff1e13 and pushed before history changes.
- Fetched live production main explicitly because this crash-recovery clone originally had a single-branch fetchspec.
- Reconciled live main dd5a1da68b971c797845eb6ed28dd9ae72221160 into the PRI-03 branch with a normal merge; no conflicts.
- Post-merge focused sanity: npm run test:platform:handwriting PASS, 53/53 checks.

