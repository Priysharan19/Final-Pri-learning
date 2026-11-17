# ai-evals — AI red-team (promptfoo)

Part of the Pri Learning mathematical intelligence lab. These suites evaluate
every model prompt the server sends, together with the deterministic guards
that sit between a model and a student. They run as offline tooling:
`promptfoo` (MIT) is a devDependency of this package only. It is never a
dependency of `client/` or `server/`, and nothing here marks. The AI proposes;
the deterministic engine decides.

## What runs

There is one provider, `providers/pri-server.mjs`, and it calls the **real
server modules** rather than copies of them:

| Surface | Server code exercised |
|---|---|
| `tutor` | `validateTutorRequest` → `askTutorModel` (the exact request body and the parse path) → `buildGuard` + `leakedExpressions` → what `tutor.js` `help()` would show the student: the model's message, or the authored hint after two guarded attempts |
| `handwriting` | `transcribeHandwriting`, with a fetch that records the body the reading service would receive |
| `tutor-prompts` | `systemInstructions(level)` for every level |
| `file` | a shipped source or copy file, for contract checks |

The five suites:

1. **answer-blind-handwriting**: the transcription request carries the rules, one fixed sentence and the image, and nothing else. The function and its one call site take no question, answer or marks.
2. **child-safety**: no secrecy, no relational claims, and a distress message gets a calm reply with support lines (`CHILD_AI_SAFETY_PRIVACY_RELATIONAL_BOUNDARIES_V7.md` §5, §14, §15).
3. **prompt-injection**: student text stays out of the system prompt and sits under an untrusted-data label. A reply that obeyed an injection is withheld, and the exam context is refused.
4. **no-marks-ai-label**: no prompt lets the model mark, no reply claims marks, and a model-written reply is labelled as AI-written (§17).
5. **hint-no-giveaway**: a hint never states the final answer or the next result, in any form (digits, words, arithmetic, ranges, Devanagari). Both editions are covered.

Case kinds are part of each description. **CONTRACT** checks a static property
of what ships. **GUARD-GAP** asks whether anything deterministic would stop a
given unsafe reply before the student sees it. **LIVE** and **MODEL-GRADED**
cases need the real model. Every other case is deterministic.

## Modes

- **Fixture** (`npm run eval`) makes no network call and needs no key. Where a
  case needs a model reply, it uses a fixture from `fixtures/`, run through the
  same parse and guard path a live reply takes. **Every fixture is marked
  `"provenance": "SYNTHETIC"`.** It is a hand-written reply that tests what the
  guard and the assertions do with it. It is never a recorded model output, and
  a fixture result says nothing about how the live model behaves.
- **Live** (`npm run eval:live -- --grader <provider>`) calls the real provider
  through the same server code. It reads the server's own key from the
  environment as `PRI_HANDWRITING_API_KEY`, the same name Railway uses, and
  never writes the key anywhere. `suites/live-model-graded.yaml` adds
  `llm-rubric` cases. Those are a second model's opinion, labelled
  MODEL-GRADED, and they never replace a deterministic assertion. Handwriting
  red-team *images* (injection written in ink) are still to be made; the live
  handwriting cases use the 1×1 image.

```bash
(cd server && npm ci)            # the provider imports the server's modules
cd tools/ai-evals && npm ci
npm run eval                     # fixture mode → results/fixture.json
node report.mjs results/fixture.json --out=../../docs/evidence/ai-redteam-$(date +%F).md
```

Telemetry, update checks and sharing are switched off in the npm scripts
(`PROMPTFOO_DISABLE_TELEMETRY=1`, `PROMPTFOO_DISABLE_UPDATE=1`, `--no-share`).
`results/` is git-ignored.

## Reading a failure

A failing case is a finding, not a broken test. Do not edit an assertion to
make it pass. Fix the server, the prompt or the copy in a reviewed change, then
re-run. A prompt change is a model-admission change
(`EVALUATION_BENCHMARKS_AND_MODEL_RISK.md` §21–22), and a child-safety copy
change needs the owner's safety and legal sign-off.
