# Pri Ink Sets lifecycle release evidence

Release lane: `product/india-native-ink-truth`

This record documents the product-path regression fixed before release. It is evidence metadata only; it is not a claim of unseen-writer production accuracy.

## Failure class

A native recognition response could outlive the writing surface that created it. Because web-side fusion previously read the mutable global latest-stroke buffer, a delayed response from the previous question could be fused against strokes from a newly mounted question. This matched the observed calculus-looking recognition appearing on a Sets question.

## Product fix

- snapshot strokes for every native recognition request
- bind requests to a writing-surface generation and invalidate them across mount/unmount/clear boundaries
- fuse a native response only against the request's own stroke snapshot
- infer Sets notation only from the visible prompt, never the expected answer or mark scheme
- support braces, commas, visible set identifiers, union and intersection in the Sets recognition language
- prevent calculus-like output with no set/list evidence from becoming authoritative consensus on a Sets question
- preserve native set punctuation through hybrid fusion
- keep context repairs confidence-capped and never rewrite one digit into another

## Integration evidence

The Sets/native handwriting lane was merged with `main` commit `22396b9f369e9b536c7ce79b6885ee62cd2872eb` (Pri Explain V2). Generated SwiftPM web bundles were rebuilt from the merged source rather than hand-resolved.

Dedicated integration run `33072611980` completed successfully with:

- `client/test/ink-set-notation-check.mjs`
- `client/test/native-ink-arbitration-check.mjs`
- `client/test/ink-hybrid-check.mjs`
- `client/test/ink-real-page-stability-check.mjs`
- `client/test/pri-explain-check.mjs`
- production client build
- iOS bundle sync and exact bundle check

Integrated source commit: `a3ac7b51606d2c09536fe6bc7c381bb54ea73e4c`.

## Evidence boundary

Pri Ink still requires the V17 multi-writer real Apple Pencil corpus and writer-disjoint evaluation before any production-grade unseen-writer accuracy claim is justified.
