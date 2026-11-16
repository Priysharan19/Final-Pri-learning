# Open PR and issue disposition register: V1

A snapshot taken on **9 Nov 2026**, against `main` = `63deeb757` (Train 1, #749, merged #744 and
#748 at 14:37 UTC). It covers **74 open pull requests**, #556 to #757. The verdicts are **L9's
proposals**, drawn from each PR's own body and comments, the lane hand-over notes and the
lock map (#686 comment 6721159128). Each claimed port was checked in git: the old head is an
ancestor of the vehicle, or its commits were cherry-picked with `-x`. **This file closes nothing.**
The Director closes, keeps or merges each PR, and an owner ruling is needed wherever §3 says
so. A later train makes this file stale; regenerate it before the freeze
(`docs/release/FREEZE-RUNBOOK.md` §2).

| Verdict | Meaning |
|---|---|
| IN-TRAIN | a current lane, Director or L9 PR that is itself the vehicle to merge |
| PORT into #N | its content was carried into #N; close it once #N merges (see §4 for which close themselves) |
| SUPERSEDED by #N | replaced; its content is redone or no longer needed |
| POST-V1 | deliberately after launch |
| DORMANT | owner default D26: #626, #647 and #681 never merge; their branches are kept |
| DEPENDENCY | a Dependabot bump, handled by L8 (rebase right before its merge) |
| UNCLEAR | no lane claims it; what is missing is named |

**Counts:** IN-TRAIN 30 · PORT 24 · SUPERSEDED 6 · DEPENDENCY 7 · DORMANT 3 · POST-V1 3 ·
UNCLEAR 1.

## 1. Open pull requests

| PR | Title | Lane | Verdict | Reason |
|---|---|---|---|---|
| #556 | build(deps-dev): bump @types/katex from 0.16.7 to 0.16.8 in /ad | Dependabot | DEPENDENCY | @types/katex 0.16.7->0.16.8 in /ad; L8: green on an older base, rebase held for the CI queue, 'rebase each right before its merge' (now 792 commits behind main) |
| #602 | auth: set a first password from Settings for accounts made without one | L2 | SUPERSEDED by #728 | #728: 'its whole diff (3 package.json lines) is 4ae383cb7' (from #715); the feature itself is already on main; none of #602's own commits are carried |
| #615 | release: iOS build 3 + native safe-area insets | L4 | PORT into #737 | Partial: safe-area inset commits c4916716a+bd0697f6a cherry-picked into #737; iOS build-number bump 179bf28c1 NOT ported ('release lane'), bundle commit dropped (D28) |
| #626 | governance(p0): independently gated signed writer dispatcher | D26 | DORMANT | D26: signed-admission programme stays dormant; '#626, #647 and #681 do not merge. Branches are kept.' |
| #647 | Governance: stage isolated shared-lock serialized signer runtime (fail closed) | D26 | DORMANT | Stacked on #626 (base task/p0-governor-dispatch-20261021); named in D26 as do-not-merge; keep branch |
| #655 | Luxury 1/6: design system (C Examiner's Chronograph + A light) | L3 | PORT into #753 | Partial per l3-dispositions (9 Nov): Aurora commit 70026a687 (chrome tokens, materials, Aurora.jsx) ported to task/l3-aurora-skin; chronograph commits + bundle sync SUPERSEDED. CONFLICT: #741 body still says the Aurora commit is POST-V1 |
| #656 | Board mock papers: Pri mock in board format (R4) | L6 | PORT into #742 | #742: 'PORT, adapted. This replaces it' (label, blueprints, title, mock flag); one-free-sample ledger superseded by D19, handwritten mocks by D22; examiner's margin POST-V1 for L1 |
| #659 | Parent weekly report (Premium): honest weekly email + in-app view, double opt-in, RLS | L6 | PORT into #743 | #743: 'PORT. Its final tree is re-homed as one commit'; OFF until counsel (D22); its privacy/label/Data-safety hunks restored to main, L7 adds the text when the flag goes on |
| #660 | Luxury PR5: Settings, sign-in, first open, empty and offline states (direction C) | L3 | PORT into #741 | Partial: offline banner re-implemented in InstrumentBar.jsx with Instrument styling; chronograph sign-in, first-open ceremony and dial SUPERSEDED (rejected direction) |
| #661 | Luxury PR2: shell, Index dial and ⌘K (C), shared-element morph | L3 | SUPERSEDED by #741 | #699 reused its phone-dock idea, the command bar on main covers Cmd-K, dial and morph are chronograph styling; 'maths lookup in Cmd-K' may be re-proposed post-V1 |
| #662 | Mistake notebook + free/Premium split (R4) | L6 | PORT into #740 | #740: 'PORT, adapted. This replaces it' (notebook engine, paywall, StoreKit price fields); its marking cap superseded by D19; inkStore.js + reminders POST-V1; store-doc hunks left to L7 |
| #666 | Accounts backlog: auth email preflight (#218), set-password wiring (#603), pilot summary exp… | L2 | SUPERSEDED by #728 | #218 preflight and #603 wiring carried via #715 into #728; its #141 pilot summary export is POST-V1 ('needs the research and privacy gate and counsel'). GitHub links #666 as closing #141/#603 |
| #667 | content(#408): replace the routine JEE D4 Complex Numbers quadratic form; refuse signed numb… | L1 | PORT into #739 | Via #692: head 5f3dd1fb49 is an ancestor of #739 (verified); base main, so GitHub marks it merged when #739 lands |
| #668 | Luxury 6: Practice surfaces (C) | L3 | SUPERSEDED by #741 | Its legacy-surface inventory was #699's parity checklist; legacy redirects are on main; the direction-C practice skin is rejected |
| #670 | fix(marking, P0): a typed % on a percentage question is the unit; labels must name the asked… | L1 | PORT into #739 | Via #692: head e869fd084e and its four local commits are ancestors of #739 (verified), incl. the photo finalAnswer.js parity (+22 lines, Director-approved cross-lane) |
| #672 | content(#408): JEE D4 forms for the five single-template Class 11 chapters (R4) | L1 | PORT into #739 | Via #692: head 584500706b is an ancestor of #739 (verified); base is #667's branch, so it will NOT auto-close when #739 merges |
| #674 | curriculum(#483): CBSE X/XII answer-blind pilot, review-only and unwired | L5 | PORT into #735 | #735 re-homes it unchanged ('pack and its check are byte-identical'); #735 stays draft until a human CBSE examiner reviews (#483) |
| #675 | [PRI ATLAS] Agent 2 — Knowledge Atlas and exact linear-equations laboratory (prototype) | L3 | POST-V1 | Synthetic ATLAS Agent 2 prototype marked do-not-merge; keep the branch as reference for a post-launch Knowledge Atlas |
| #678 | [DRAFT] PRI ATLAS Agent 3 — Paper + Insight synthetic prototype | L3 | POST-V1 | Synthetic Paper/Insight with simulated marks; 'must never reach main'; reference only |
| #679 | Backlog sweep: #196 handwriting reply contract; #506 leftovers (Sign out everywhere, #300, #… | L2 | SUPERSEDED by #728, #729, #731 | #196 contract in #729 (via #710), Sign out everywhere in #728 (via #709), #300/#490 in #729 (via #711), #292 in #731 (via #706). Not covered: head f2ccab45b merges task/sweep-mac-runner (#227) although its body says #227 is not in the PR |
| #681 | governance(qa): register Ed25519 admission public key via manual bootstrap | D26 | DORMANT | Ed25519 admission public-key bootstrap; D26 names #681 as do-not-merge; keep branch |
| #688 | build(deps): bump the codeql-action group across 1 directory with 2 updates | Dependabot | DEPENDENCY | codeql-action init/analyze 4.39.0->4.39.3; rebased onto 1d3829103 after L8's request (0 behind) |
| #692 | marking(m-finish-10, step 1): land #667, #672 and #670-local; a given percent never sets the… | L1 | PORT into #739 | Unchanged head 5cb0bc861e merged into #739 as 3a2401d01 (verified ancestor); 'Close after this merges' (GitHub will mark it merged) |
| #694 | Public site for prilearning.com, generated from docs/legal, with a wording and link check in CI | L7 | PORT into #733 | All six commits re-homed (6/6 cherry-picks verified) onto #733, stacked on #727; 'can be closed by the Director once this merges' |
| #695 | Learning state: content identity v2, exact legacy reads, monotonic expiry (#689–#691); reade… | L2 | SUPERSEDED by #728, #729, #731 | Identity work in #731 (via #708), #196 in #729, #506 leftovers in #728/#729; its own last comment: 'Superseded by narrow PRs ... can be closed once they land' |
| #698 | Legal notices, labels and counsel pack: explicit review switch, store purchases, honest stat… | L7 | PORT into #727 | All nine commits re-homed (9/9 verified); 'can be closed by the Director once this merges' |
| #699 | One interface on every build (step 1): make the Instrument build correct | L3 | PORT into #741 | All 22 commits cherry-picked -x (22/22 verified); cross-lane hunks reverted and handed over (ios -> #737, docs/legal -> #727); 'Close #699 for this PR' |
| #700 | Content honesty: review labels, marketing scrub, Class 8 original forms, certifier repair, t… | L5 | PORT into #730 | Partial: step 1 re-homed (commit map in #730); output-changing generator edits + CONTENT_VERSION bump sit in a LOCAL-ONLY held commit until L1's train lands; keep #700's branch until that follow-up PR exists |
| #701 | Handwriting gates on the server reader; Gate A capture fidelity; pinned iOS 26/27 lanes; dev… | L4 | PORT into #737 | 14 commits kept at their SHAs (head 65265a050 verified ancestor of #737); base main, so GitHub marks it merged when #737 lands |
| #704 | build(deps): bump the client-minor-and-patch group across 1 directory with 6 updates | Dependabot | DEPENDENCY | client group: katex 0.19.1, pdfjs-dist 6.5.438, react-router-dom, @playwright/test 1.64.1, plugin-react, vite 8.3.6; rebased; L8: if WebKit fails again, re-home the other five onto task/l8-deps-client without Playwright |
| #705 | WebKit e2e: stub-network tours opt into network-visible intercepts (Q3 fix, test-only) | L8 | IN-TRAIN | Lock map gives #705 to L8, which kept it as its own vehicle: main merged in (9edb8440b) and the 28/28 CI pin fix (cc3c74d58) answers Q3/Q4's changes-required; R2 test-only |
| #706 | Tests: reveal/submit race, deletion mid-mark, billing order, consent coverage, cutover and P… | L2 | PORT into #731 | 11/11 commits cherry-picked -x into Train A (verified); #731 itself labels it 'SUPERSEDED by this PR' |
| #707 | Practice: the question picker passes over questions the account has already answered (relaun… | L2 | PORT into #731 | 2/2 commits cherry-picked -x into Train A (verified); #731 labels it 'SUPERSEDED by this PR' |
| #708 | Learning state: content identity v2, exact legacy reads, monotonic expiry (#689 #690 #691) | L2 | PORT into #731 | 5/5 commits cherry-picked -x into Train A (verified); #731 labels it 'SUPERSEDED by this PR' |
| #709 | Account: Sign out everywhere in Settings, bound to the linked account (#481) | L2 | PORT into #728 | 4/5 commits cherry-picked -x into Train B; the iOS bundle resync 824780051 dropped (D28); #728 labels it 'SUPERSEDED by this PR' |
| #710 | Handwriting: the reader's reply is held to its schema and fails closed; #192 authorities pin… | L2 | PORT into #729 | 5/5 commits cherry-picked -x into Train C (verified); #729 labels it 'SUPERSEDED by this PR' |
| #711 | Progress: legacy generator-keyed rows count on dot points and the predicted paper (#300); of… | L2 | PORT into #729 | 4/5 commits cherry-picked -x into Train C; bundle commit 0c2b6858c dropped (D28); #729 labels it 'SUPERSEDED by this PR' |
| #713 | Security: an upload behind an image header must be a PNG, JPEG or WebP by its own bytes | L2 | PORT into #729 | 1/1 commit cherry-picked -x into Train C (verified); #729 labels it 'SUPERSEDED by this PR' |
| #714 | governance: reconcile the manual-authorization verifier with the solo-maintainer policy | unassigned | UNCLEAR | Draft governance text (solo-maintainer section in release-policy.md, pri-manual-authorization.mjs header) 'the owner's to accept'; no lane note, lane PR or the lock map claims it; 4 commits behind main. Missing: an owner and an adopt/close decision |
| #715 | Preflight: auth email is required (#218); the set-password client suite runs in CI (#603) | L2 | PORT into #728 | 2/2 commits cherry-picked -x into Train B (verified); #728 labels it 'SUPERSEDED by this PR' |
| #717 | build(deps): bump the github-actions-core group across 1 directory with 5 updates | Dependabot | DEPENDENCY | github-actions-core: checkout 4.4.0->7.0.1, setup-node 4.4.0->7.1.0, setup-java, upload-artifact 4.6.2->7.0.2, setup-python (major action bumps in workflows); rebased |
| #719 | build(deps): bump @remotion/media-utils from 4.0.535 to 4.0.540 in /ad | Dependabot | DEPENDENCY | @remotion/media-utils 4.0.535->4.0.540 in /ad; green on an older base; rebase right before merge (4 behind) |
| #720 | build(deps): bump express from 4.22.2 to 4.22.3 in /server in the server-minor-and-patch group | Dependabot | DEPENDENCY | express 4.22.2->4.22.3 in /server; rebase requested 8 Nov but not yet done (4 behind main) |
| #721 | build(deps): bump remotion from 4.0.535 to 4.0.540 in /ad | Dependabot | DEPENDENCY | remotion 4.0.535->4.0.540 in /ad; green on an older base; rebase right before merge (4 behind) |
| #723 | Step 14: eliminate false full-credit mathematics decisions (R4; academic hold) | L1 | IN-TRAIN | Marking train 1 (taken over from Lane C). D25 review CHANGES_REQUIRED at f4fd06987; fixes pushed as 021e5ae1d have no recorded re-review. Title/body still say 'academic hold' / 'Status: DRAFT' |
| #726 | security(sanitize): figure scanner can no longer be held for seconds by one crafted tag (Cod… | L8 | IN-TRAIN | Ports local task/c4-sanitize-redos (5823387af, never a PR). D25 APPROVE_WITH_NITS at 0248ef76c; Director held it for the cubic '<a' case; follow-up 378f3f4ab not yet re-reviewed |
| #727 | Legal notices, store disclosures and counsel pack: explicit review switch, store purchases,… | L7 | IN-TRAIN | Re-homes #698 + store-disclosure reconciliation + counsel pack; per L7, the D17 prompt (#737), notices and site (#733) must land in one train |
| #728 | L2 Train B — accounts: Sign out everywhere (#481), auth email preflight (#218), set-password… | L2 | IN-TRAIN | Train B: replaces #709, #715, #602 (and #666's #218/#603 parts) + D3 sign-in check; whichever of #728/#736/#747 lands later regenerates the examiner dossier |
| #729 | L2 Train C — readers and progress: image signatures (#713), reader reply contract (#196), le… | L2 | IN-TRAIN | Train C: replaces #713, #710, #711 (and #679's parts); L2 reports 4/4 required checks green on 4d6e2fcbd |
| #730 | L5 content honesty: past papers off (D23), honest review labels and marketing (D24), certifi… | L5 | IN-TRAIN | Re-homes #700 step 1 + step 2 (typesetting gate, cplx-03 wording); held commit follows after L1's train |
| #731 | L2 Train A — learning state: identity v2 (#689 #690 #691), seen-aware picker, race and resto… | L2 | IN-TRAIN | Train A: replaces #706, #707, #708 (and #695's identity work); says it closes #689/#690/#691 (prose only, not GitHub-linked) |
| #732 | L6 Commercial 1/4: D19/D20 on the server — JEE Advanced content is Premium, twins count, rea… | L6 | IN-TRAIN | Commercial 1/4: D19/D20 server enforcement; #740 is stacked on it |
| #733 | Public site for prilearning.com, generated from docs/legal, with a wording and link check (L… | L7 | IN-TRAIN | Re-homes #694; base is task/l7-legal-notices (#727): retarget to main once #727 merges |
| #734 | test(interface): time a genuine Practice answer-mode switch in all four cases (Step 06, #684) | L8 | IN-TRAIN | Step 06 / #684: genuine Practice mode-switch timing, removes the 196/196 escape; body says five hosted Chromium runs still pending |
| #735 | L5: CBSE X/XII answer-blind pilot, review-only and unwired (#483; #674 re-homed) | L5 | POST-V1 | Review-only, unwired CBSE X/XII pack (#674 unchanged); L5 keeps it a draft that may not merge until a human CBSE examiner reviews it (#483), so it is not in a V1 train |
| #736 | L2 D18 — erase a child's account no guardian stands behind (enforce switch); a guardian can… | L2 | IN-TRAIN | Train D (D18 child erasure, enforce switch); owner confirms D18, counsel sets the period; expected conflicts with #727 recorded |
| #737 | L4: handwriting gates on the server reader (#701 re-homed), D17 permission prompt, phone/tab… | L4 | IN-TRAIN | Re-homes #701 (14 commits at their SHAs) + D17 permission prompt + phone/tablet/finger path + #615 insets port |
| #738 | ops(staging): anonymous rate limits count the Railway edge node, not the client (#653); stag… | L8 | IN-TRAIN | #653 finding (per-edge-node buckets) + #646 auto-deploy evidence. Its sentence 'The PR that closes #653 makes it blocking' makes GitHub link it as closing #653, contrary to its own 'keep #653 open' |
| #739 | Marking train 2: #692 port; D12 method-mark switch, D13 unevaluated answers, D14 units (R4) | L1 | IN-TRAIN | Marking train 2 (stacked on #723): ports #692 (+#667/#670/#672) and adds D12 switch, D13, D14; #752 says the candidate must contain #739 for D12 |
| #740 | L6 Commercial 2/4: the mistake notebook and a compliant Premium screen in both stores (R4, s… | L6 | IN-TRAIN | Commercial 2/4 (stacked on #732): re-homes #662 adapted to D19 |
| #741 | L3: one student interface on every build (D7–D11), #658 offline tabs, Index parity | L3 | IN-TRAIN | Re-homes #699 (22/22) and finishes D7-D11; says it closes release blocker #658 (prose only, not GitHub-linked); its #655 row is stale vs l3-dispositions/#753 |
| #742 | L6 Commercial 3/4: board mocks as typed timed papers — "Pri mock in board format" (R4) | L6 | IN-TRAIN | Commercial 3/4: re-homes #656 as typed timed papers (D22), counted in the one-paper-per-30-days free window (D19) |
| #743 | L6 Commercial 4/4: parent weekly report, finished and OFF until counsel (server switch + bui… | L6 | IN-TRAIN | Commercial 4/4: re-homes #659, OFF until counsel (D22); schema 13->14 (the only open PR touching migrations) |
| #745 | Marking train 3: D15, refuse question banks outside the India covers at the server (R4 while… | L1 | IN-TRAIN | Marking train 3 (stacked on #739, which it contains): D15 refuses 17 legacy India banks at the server |
| #746 | tools+evidence: staging journey proof harness and 1d3829103 baseline (D1 sign-in defect, mai… | L8 | IN-TRAIN | Staging journey proof harness + 1d3829103 baseline (found defect D1, fixed by #747) |
| #747 | L2 — onboarding: an unconfirmed email is a 'Confirm your email' step, not a false guardian d… | L2 | IN-TRAIN | Fixes L8 staging defect D1 (unverified adult shown a false guardian error); edits L3-owned SignUpFlow/onboardingAuthority as the Director assigned |
| #750 | L2 — sign-in and guardian consent proved on Postgres too (otp-sign-in, otp-lifecycle, guardi… | L2 | IN-TRAIN | New proof work: otp-sign-in, otp-lifecycle and guardian-consent on Postgres; PLATFORM ON POSTGRES pin 61->64 (sums with #731/#736 given in body) |
| #751 | L5: Hindi native-speaker review packet (D11), generated, not reviewed | L5 | IN-TRAIN | D11 Hindi native-speaker review packet, generated and explicitly not reviewed (opened by the Director for L5) |
| #752 | L9: production config manifest V1 + opt-in --require-handwriting / --expect-config in verify… | L9 | IN-TRAIN | Production config manifest V1 + opt-in --require-handwriting/--expect-config; names #739 ('the candidate must contain #739' for the D12 switch) and #736 (D18 switch) as prerequisites |
| #753 | L3: Aurora on chrome is the default skin (D7, D9); plain Instrument tokens one line away (D8) | L3 | IN-TRAIN | Aurora on chrome as default skin (D7/D9), D8 fallback one line; stacked on #741 (verified); leaves ~2 kB install headroom; carries #655's Aurora port per l3-dispositions |
| #754 | L9: freeze runbook + recorded freeze rehearsal on 1d3829103 (CANDIDATE 20/21); dossier row 2… | L9 | IN-TRAIN | Freeze runbook + recorded freeze rehearsal on 1d3829103 (CANDIDATE 20/21); dossier row 21 wording fix |
| #755 | L9: pin the pull-request-only concurrency of #748's 13 workflows; "one group per pull reques… | L9 | IN-TRAIN | Pins the pull-request-only concurrency of the 13 workflows #748 changed, with mutation controls; "one group per pull request" wording (R4: workflow comments) |
| #756 | L9: paste-ready configuration for the ten alerts + a 15-minute test (staging drill fires CLI… | L9 | IN-TRAIN | Paste-ready alert configuration and a 15-minute test; a staging drill fires CLIENT_ERROR_SPIKE end to end |
| #757 | fleet: site/** has a primary owner (growth) | Director | IN-TRAIN | Fleet ownership: site/** gets a primary owner (growth) |

Merged since 8 Nov: #744, #748 and #749 (Train 1, `63deeb757`).

## 2. P0, P1 and release-blocker issues

D6 counts zero unresolved P0 and P1 **at the candidate SHA**. None of the vehicles below is
GitHub-linked to its issue ("closes" appears only in prose), so each issue is closed by hand
after its vehicle merges and the fix is on the candidate.

| Issue | What | Closed by | Still needs | Proposed handling at the freeze |
|---|---|---|---|---|
| #680 P0 | the exact checker gives full credit to 197 malformed or unequal answers | #723 (Step 14: 219/219 red-team, 107/107 bounds), then #739; #670 and #692 are ported into #739 | an independent D25 re-review of #723's current head `021e5ae1d` (the review of `f4fd06987` asked for changes). The original 197-case manifest is not recovered, so an exact replay is not possible | close once #723 and #739 are merged and re-reviewed; record that the replay is against the recovered cases only |
| #689 P0 | multi-correct option shuffles break repeat/try content identity | #731 (Train A) | the D25 review of #731's exact head | close by hand after #731 merges |
| #499 P0 | an independent examiner certifies the marking rubric policies | nothing in code. #739's D12 switch keeps method marks off in production until a signed result is named | **a qualified human mathematics examiner** (owner books them; L1 writes the request) | stays open as the dossier's `examiner` gate. The owner rules whether V1 ships with method marks off (D12) while #499 is open; the dossier still requires the gate PASS |
| #386 P0 | the production Postgres cutover is uninitialised | the software is on `main`; Step 24 preparation is L9's cutover PR (`postgres-cutover.md` §5.5, §6, §6a.2b, §7a) | **the owner's D27 Yes on the day**: migrate or start empty, the backup and restore drill, the production variables | closes at the cutover, with the §7a log as evidence |
| #646 P0 | a Railway-wide build pause blocked the staging autodeploy | #738 (closing evidence for staging auto-deploy) | someone with Railway access confirms that the November staging deployments were GitHub-triggered | the Director closes it on that confirmation |
| #690 P1 | multipart case-study identity omits alternative and part figures | #731 | the D25 review of #731 | close by hand after #731 merges |
| #691 P1 | out-of-order repeat/try writes shorten expiry | #731 | the D25 review of #731 | close by hand after #731 merges |
| #451 P1 | the official CBSE 2026–27 competency crosswalk and an independent 1,371-example review | none. The crosswalk is on `main` (#583); the competency maps for X, XI and XII are not started | **an independent human curriculum reviewer** | owner ruling needed: either a V1 gate (it blocks GO), or post-V1 under D24's honest coverage wording, recorded on the issue |
| #408 P1 | JEE Advanced complex numbers: the hardest difficulty was silently downgraded | #739 (the D4 forms, via #692/#667/#672) and #730 (the cplx-03 wording) | **two independent human D4 reviewers and a rights review**; drop "certified" from the issue (D24) | close the code part on merge; the owner rules on the human review (a V1 gate, or post-V1 with an honest label) |
| #395 P1 | rights-gated JEE question-bank intake and server-only answer authority | none ("little for V1"; the Arihant intake is post-V1) | **publisher rights, NTA answer-key pairing, counsel** on the archive transcriptions still in the bundle (D23) | owner ruling: post-V1 under D23 (past papers off), with counsel's answer on the shipped transcriptions |
| #684 P1 | 256 ms Chromium selected-mode input against a 100 ms floor | #734 (Step 06). It found the 256 ms came from a press on the already-active tab; no product latency above 100 ms reproduced | five hosted Chromium runs on #734's head; the D25 review (R4 via `ci.yml`) | close by hand after #734 merges with those runs |
| #658 release-blocker | the Instrument's core tabs must work offline before production | #741 (#699 ported) | an owner or Director ruling on the install-budget ceiling (3269 of 3271 kB after #753) | close by hand after #741 merges |

Related issues the vehicles name:

| Issue | Closed by | Note |
|---|---|---|
| #653 (security) | #738 | **#738's body makes GitHub close #653 on merge** ("The PR that closes #653…"), although #738 says #653 stays open until the probe reads PER-CLIENT. Reword #738's sentence before it merges. `production-config-v1.md` row 6 depends on #653 |
| #196 | #729 (the reply contract, via #710) | the GitHub-linked closers #679 and #695 are superseded; update the issue's ledger markers at close |
| #218 | #728 (the preflight requires the auth-email variables, via #715) | the founder confirms one production sign-up code arrives in an inbox they control |
| #603 | #728 (the set-password suites, via #715) | the issue pins `Pri-Review-Head 2159896bf`, an old #602 head; fix the ledger |

## 3. Decisions this register needs

1. **#714** (a draft solo-maintainer policy, "the owner's to accept") has no lane, note or lock.
   Adopt it into a train or close it.
2. **#655:** `l3-dispositions.md` (9 Nov) ports its Aurora commit into #753, but #741's body
   still calls it POST-V1. One of the two needs correcting.
3. **#723** is marking train 1, but its title still says "academic hold" and its body
   "DRAFT". The fix head `021e5ae1d` has no re-review; #739 and #745 inherit it.
4. **#738** wrongly GitHub-links #653 (see §2).
5. **#679**'s head merges `task/sweep-mac-runner` (#227, the Mac runner), which its body says it
   does not contain. No lane gives #227 a verdict.
6. **#615:** the iOS build-number bump `179bf28c1` was not ported. #737 hands it to the release
   lane, so L9 takes it as a pre-freeze item. It lands in the last train, because a commit during
   the freeze voids the soak (`FREEZE-RUNBOOK.md` §5).
7. **#700:** the rest of its content is only in L5's local held commit and the patch in the
   fleet notes. Keep #700's branch until that follow-up PR exists.
8. **#735** is a draft vehicle that cannot merge before a human CBSE examiner reviews it (#483).
   This register proposes POST-V1; L5 holds it.
9. **#726:** the follow-up head `378f3f4ab` has no D25 re-review.
10. **Wording:** L2 calls #706–#715 "SUPERSEDED", but their commits were cherry-picked with
    `-x`, so this register says PORT.

## 4. How each old PR leaves the list

- **Marked merged by GitHub when the vehicle merges**, because the old head is an ancestor and its
  base is `main`: #667, #670 and #692 (with #739), and #701 (with #737).
- **Closed by hand by the Director after the vehicle merges:** every cherry-picked or adapted
  re-home (#602, #615, #655, #656, #659, #660, #661, #662, #666, #668, #674, #679, #694, #695,
  #698, #699, #700, #706–#711, #713, #715), and #672, whose base is #667's branch.
- **Never merged, branch kept:** #626, #647 and #681 (D26); #675 and #678 (POST-V1 references).
