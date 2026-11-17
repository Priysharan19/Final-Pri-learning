# Mathematical intelligence lab — roadmap

Status: decision record, 18 November 2026. Implementation authority: current `main` and its tests, not this file.

The lab is offline tooling. It measures and hardens the intelligence Pri already has. It never adds production authority: the AI proposes, the deterministic engine decides, and no lab tool sets a mark. This file records which proposed tools were adopted, which were deferred and why, so a later agent does not re-propose them without the evidence that would change the decision.

Read with: `docs/research/README.md`, `MATH_TRUTH_FIRST_BREAK_FORMAL_VERIFICATION_DEEP_DIVE.md`, `EVALUATION_BENCHMARKS_AND_MODEL_RISK.md`, `V7_EMPIRICAL_SCIENCE_AND_BENCHMARK_PROGRAMME.md` (Layer C, the benchmark laboratory) and `RESEARCH_TO_BUILD_V7.md` (dependency gates).

## Adopted now

| Tool | Where | Role | Why now |
|---|---|---|---|
| **SymPy** (BSD) | `tools/math-oracle/` | An independent differential oracle for the engine's equivalence verdicts across both editions' generators. | Its first run found real false credit: calculator displays accepted on exact-value questions, and expression answers that only matched at the published sample points. That is the highest-priority category after security. It costs nothing: Python stays offline, never in the Railway runtime or the client. |
| **Promptfoo** (MIT) | `tools/ai-evals/` (devDependency of that package only) | Evaluation and red-team suites for every model prompt the server sends: tutor, diagnosis, "why this step", handwriting, working, question photo. | `EVALUATION_BENCHMARKS_AND_MODEL_RISK.md` §22 and §25 require a prompt-injection, answer-leakage and policy corpus before any model or prompt change. It costs nothing: it runs locally, offline against recorded fixtures, and live only with the server's own key. |

## Not now

| Tool | Decision | Reason | What would reopen it |
|---|---|---|---|
| **pyBKT** | Deferred | There are about 12 real accounts. A knowledge-tracing benchmark needs held-out learners and items (learner-disjoint, family-held-out validation: `PSYCHOMETRICS_AND_ADAPTIVE_MEASUREMENT.md`). With this little data any fit is noise, and a fitted number would invite an unsupported claim. | Real usage large enough for a learner-disjoint held-out split, with the semantic event contracts (`SEMANTIC_LEARNING_DATA_CONTRACTS.md`) in place. |
| **pyKT** | Later | Same data gate as pyBKT, and deep KT models are further down the model ladder (IRT/BKT baselines first). | After a BKT/IRT baseline exists on real held-out data. |
| **DSPy** | Deferred | DSPy optimises prompts against a metric. Pri has no expert-adjudicated explanation test set yet, so DSPy would optimise towards an unvalidated proxy, the pattern `V7_EVIDENCE_CONTRADICTIONS_BOUNDARY_CONDITIONS.md` warns against. | An expert-adjudicated explanation benchmark (`HUMAN_ADJUDICATION_AND_GOLD_STANDARD.md`), with the promptfoo suites as its regression floor. |
| **Lean 4 / Mathlib** | Research only | Formal proof is stage 5 of the PriMath roadmap (bounded proof families). Pri's live authority is exact arithmetic and algebra; the cost and authoring burden of Lean are not justified by any release-critical decision today. | A bounded proof family the engine must certify, with its own release benchmark. |
| **Z3** | Targeted, later | Useful for specific decidable checks such as inequality and interval reasoning or constraint generation. It is not a general marking oracle, and SymPy already covers the equivalence differential. | A concrete engine contract (for example interval solution sets) where SymPy is `SYMPY_UNABLE` and an SMT check would decide it. |
| **OpenAI Agents SDK** | Not in the release-critical path | Pri's model calls are single, schema-bound requests behind deterministic guards. An agent loop adds autonomy and tool risk (`MODEL_SUPPLY_CHAIN_PROMPT_INJECTION_AGENT_SECURITY_V7.md`) without serving a current decision. | A reviewed need for multi-step tool use that cannot be met by a single guarded call. |
| **Langfuse** | Not now | It is observability, not a release gate. Self-hosting needs a running service and database, which conflicts with the owner's zero-cost rule, and the hosted tier would send learner-adjacent traces to a third party. | A zero-cost deployment path with the privacy review it needs. Until then the promptfoo fixtures and the server's own diagnostics are the evidence. |
| **ts-fsrs** | Benchmark only | Spaced practice belongs to the learn-loop lane. FSRS may be benchmarked offline against the current scheduler, in coordination with that lane, but must not change scheduling without a measured comparison on real retention data. | The learn-loop lane asks for it, and there is retention data to compare against. |

## Rules that bind every lab tool

1. **No production authority.** A lab tool may report, block a release, or add a regression test. It never marks, never schedules and never changes learner state.
2. **No weakened gates.** A finding becomes a deterministic regression test in the existing suites. Thresholds and pins move only when re-derived from real runs.
3. **No fabricated evidence.** Synthetic, generated and fixture evidence is labelled as such. A fixture is never presented as a recorded model output, and a live run that did not happen is reported as pending.
4. **Zero cost.** Local or CI-only, open-source licences (BSD/MIT), no new hosted service and no new runtime dependency.
5. **Both editions.** Every suite runs against Priyabhata and Prithagoras content (ADR-0002).
