# math-oracle — SymPy differential oracle

Part of the Pri Learning mathematical intelligence lab: offline tooling that
measures the deterministic engine. It adds no production authority. Python is
never added to the Railway runtime or to the client, and nothing here sets a
mark. The engine decides; this oracle checks the engine.

## What it does

1. `driver.mjs dump` draws seeded questions from every authored generator bank
   of both editions (Priyabhata · India banks, Prithagoras · NSW year/stream
   banks) and writes each answer key. Numeric, expression, set and point keys
   are in scope. MCQ, working, ratio and the structured forms have their own
   suites, and the report counts them as out of scope.
2. `oracle.py candidates` writes the answers a student could submit for each
   key:
   - **correct**: the key and its equivalent forms (factorised and expanded,
     single fraction, unsimplified fraction, mixed number, surds, the
     terminating decimal, ± roots in any order, `x = a or x = b`);
   - **slips**: sign, distribute-partial, index off by one or multiplied, a
     dropped term, reciprocal, ×10, a lost ± root, a duplicated root, swapped
     coordinates, differentiated instead of integrated;
   - **integration**: `+ C`, a dropped constant, a specific constant;
   - **approximation**: rounded to 2–12 decimal places;
   - **adversarial**: near-misses at 1e-6, 1e-10 and 1e-13, relative 1e-5,
     tiny extra terms, a removable hole, `+ 0` left unevaluated, and one
     *sampling-aware* adversary that adds a degree-8 polynomial vanishing at the
     engine's published sample points (`SAMPLE_SETS` in `expr.js`).
3. `driver.mjs mark` re-draws each question and records `checkAnswer()`, the
   verdict the server returns.
4. `oracle.py judge` has SymPy decide each pair on its own and classifies the
   result:

| Class | Meaning |
|---|---|
| `FALSE_CREDIT` | The engine accepts and SymPy proves the answer is not equal, beyond any declared tolerance. **This blocks release.** |
| `FALSE_REJECTION` | The engine refuses, SymPy proves the answer equal, and no declared form rule explains the refusal. |
| `SYMPY_UNABLE` | Parse failure, timeout, or a simplification SymPy could neither prove nor disprove. |
| `POLICY_*` / `AGREE_REJECT_POLICY` | A product rule rather than a defect: form demands, approximation bands, domain rules, the constant of integration, and the engine's pinned float-noise and calculator-display allowances. These are listed so they stay visible. |

SymPy proves equality symbolically, or exactly for numbers. Numerical
substitution, at rational points with 40 digits, is used only to *disprove*
equality (see `docs/research/MATH_TRUTH_FIRST_BREAK_FORMAL_VERIFICATION_DEEP_DIVE.md`
§24). In the engine's syntax `log` is base 10 and `e` is Euler's number, and
the oracle parses both the same way.

## Run

```bash
tools/math-oracle/run.sh            # 2 draws → docs/evidence/sympy-oracle-<date>.{md,json}
tools/math-oracle/run.sh 4 /tmp/out # more draws, written somewhere else
ORACLE_STRICT=1 tools/math-oracle/run.sh   # exit 1 on any FALSE_CREDIT
tools/math-oracle/.venv/bin/python -m unittest tools/math-oracle/test_oracle.py   # the oracle's own self-test
```

The first run creates `.venv` (git-ignored) from `requirements.txt`. That file
pins SymPy 1.14.0 and mpmath 1.3.0 (both BSD) by hash. Seeds are fixed
(7000·difficulty + draw, disjoint from `engine-benchmark`), so a commit always
produces the same report.

## What this is not

This is synthetic differential evidence. The candidates are written by rule
from the engine's own generators. No student, handwriting, teacher or human
adjudicator is involved, and no number in a report is an accuracy claim.
`engine-benchmark`, `server/test/selfcheck.mjs` and the marker suites remain
the release gates, and this tool lowers none of them. When the oracle confirms
a false credit, it becomes a deterministic regression test in the JS suites,
with the engine fix on its own reviewed R4 branch.

A CI workflow is deliberately not included. Any `.github/workflows/**` edit is
R4 under `.pri-os/fleet.json`, so an opt-in `workflow_dispatch` job belongs in
its own reviewed change. It must never be one of the four required contexts.
