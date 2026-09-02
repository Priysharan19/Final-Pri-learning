# Person 1 handoff

Primary deterministic gate:

```bash
node client/test/person1-intelligence-loop-check.mjs
```

Primary empirical handwriting gates:

```bash
npm run test:ink:corpus:strict
node client/test/ink-release-evidence-gate.mjs
npm run test:real
npm run test:ink:native
```

Release rule: deterministic software gates may be green while real-Pencil evidence is still insufficient. In that state the software implementation is ready for measured validation, but Pri Ink is not yet entitled to an arbitrary-real-handwriting production accuracy claim.
