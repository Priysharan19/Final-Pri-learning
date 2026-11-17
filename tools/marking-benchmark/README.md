# marking-benchmark

This is offline lab tooling. It compares Pri's deterministic marking engine with frontier LLM graders on worked solutions, with SymPy as ground truth. It sets no marks and is never part of the client or server runtime.

- `corpus/*.jsonl`: worked solutions (see the schema in any line).
- `truth.py`: SymPy decides each line (run with `tools/math-oracle/.venv/bin/python`).
- `run.mjs`: runs the engine (`stepCheck`) and, optionally, LLM graders, then scores everything. Its output goes to `results/report.json`.

```bash
cd tools/marking-benchmark && npm ci
node run.mjs --engine-only
ANTHROPIC_API_KEY=… node run.mjs --models=fable,opus --reruns=3 --rerun-sample=30   # key from Keychain, never committed
```

The report is in `docs/evidence/marking-benchmark-<date>.md`.
