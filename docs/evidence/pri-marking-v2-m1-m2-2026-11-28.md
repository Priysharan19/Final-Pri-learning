# Pri Marking V2 M1/M2: evidence and limits

2026-11-28 Australia/Sydney. Tracking #1143. Protected-main baseline
98367e93e8a02ae47b36789b59c4929c29fcd4af. Founder-directed manual task lane.
R4 independent review and exact-head CI required. No production activation.

## Reproduction
Exact generator identity gen:y12-random-var:d1:s29731 matches the reported
question. The actual server marker and marked-page model initially reported
1/1 with statuses ok,note,note,ok,ok. After the scoped repair they reported
1/1, all five lines checked, no first break and an answer line at index 4.
The original live red cross/four unchecked lines did not reproduce using
the supplied text. Original redacted recognition payload (both text/TeX,
line gaps, build identity and question identity) remains needed.

Root cause of reproduced coverage gap: absent stepCheck metadata causes
generic arithmetic verification; E(X) parses as multiplication rather than
the expectation operator. Generic proof overlays cannot repair the gap.
The cloud gate excludes correct final answers and existing local breaks,
merge cannot challenge local determinations and discards no-break cloud
results, and workingProvider asks for empty explanations on ordinary correct
lines. Legacy normalization also converts second breaks to carried-correct
and marks all subsequent correct lines carried. The client-supplied working
request is not tied to a server-owned submission. These cloud limitations
remain unchanged in this candidate.

## Repair
Exact rational affine expectation verifier scoped to the specific generated
prompt family. Mathematical context comes from the question's given mean,
not its answer key or authored solution. Unsupported nonlinear expressions
abstain. Dual text/TeX readings must agree semantically; contradictory readings
reset the continuation chain. Existing server answer marks are preserved;
no method partial, no board/method-scheme changes. Existing teacher display
gets the linearity phrase and explanation. Generic proof overlays cannot
override this domain's abstentions. No consent, credential, storage, route,
regional deployment or AI configuration changes.

## Local execution and evidence
Separate authorized Mac clone, Node v24.19.0; no paid traffic. Focused founder
regression initially failed and subsequently passed. Additional safety cases:
9 passed, dual-reading cases: 4 passed, synthetic integer oracle sweep:
1,000 passed (500 true, 500 false). This narrow synthetic development set
is NOT the independently moderated 1,000-submission held-out M7 benchmark.
Equation rewrite 85, inequality statement ticks 20, marked-page model 55,
honesty 87, teacher page 208, step explanations 110, cloud working client 47,
working branches 33, method marks readiness 94 passed; saved real reports
matched. Method readiness compared 6,898 off-path pages identically, with
zero method mark lowered. Initial teacher test identified missing general
sentence; fixed and rerun. Method readiness first lacked KaTeX; existing
dependency installation was linked into the isolated clone for successful run.

Full annotation gate measured 5,592 applicable units (1,131 generated forms,
4,461 bank parts), 173 MCQ not applicable; 362 full, 2,216 true-only,
3,014 uncovered. Previously 361 full, 2,217 true-only. Gate FAILED because
gen:y12-random-var:d1:3e68b86 became fully covered and its baseline and
summary were stale. No newly uncovered unit reported. The prescribed
regeneration ran on Mac and files appeared modified, but device connectivity
failed before output/diff verification and publishing. Do not weaken the
ratchet or claim a pass. Regenerate with node tools/annotation-coverage.mjs
--write and rerun the full gate plus --ratchet-only --base-sha against main.

The GitHub draft branch was reconstructed through the connector from the
executed source changes after the device stopped responding. Local test
results apply to the local candidate, NOT certified exact GitHub head.
No byte-for-byte comparison was available; exact-head CI and baseline
refresh are blocking. No device screenshots or authenticated physical
handwriting end-to-end tests were obtained.

## Next lanes
M1 exact incident reproduction incomplete; M2 scoped repair candidate only.
M3/M4: evolve existing provider using server-owned submission binding,
strict versioned structured proposals, detailed correct-step explanations,
independent proof/abstention, and no automatic conversion of independent
errors to carried credit. AI cannot change authoritative marks. M5: reuse
existing spatial annotation layer. M6-M10 require curriculum moderation,
independently held-out benchmark, privacy and cost verification, staging
and independent release certification. No inference of broad mathematical
accuracy from the synthetic fixtures.

Official API catalog checked 2026-11-28: gpt-6.2-sol (USD 2 input/10 output)
and gpt-6.2-astra (USD 8 input/40 output), per million tokens standard.
Sources https://developers.openai.com/api/docs/models and
https://developers.openai.com/api/docs/pricing. Project entitlement and
actual provider quality, cost, latency unverified. Paid calls: 0; expenditure
USD 0.00. Proposed USD 20 development allocation not approved. No production
credentials or data residency claims. Rollback via reviewed revert; no migration.
