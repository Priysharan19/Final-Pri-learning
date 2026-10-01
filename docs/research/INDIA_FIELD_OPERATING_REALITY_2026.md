# India Field Operating Reality — 2026 Evidence and Research Plan

Status: **operating-context research + field-validation plan**.  
Freshness: **1 October 2026**.  
Scope: India, with particular relevance to school-age mathematics learners.  
Important: national/rural statistics are context, not proof of Pri's target-user distribution.

## 1. Why this document exists

“India-first” cannot mean:

- translate the web app;
- assume every learner has a private smartphone;
- assume broadband coverage means usable access;
- assume digital familiarity means educational digital fluency;
- assume one successful urban pilot represents India.

Pri's architecture should be robust to constraints that are common enough to matter even before Pri has its own field dataset.

Then Pri must replace broad assumptions with measured target-cohort evidence.

## 2. Rural adolescent device/access evidence

ASER 2024 is a large rural household survey covering more than 650,000 children across more than 600 districts, 26 states and 2 Union Territories.

Official source:
https://asercentre.org/wp-content/uploads/2022/12/ASER-2024-National-findings.pdf

For rural 14–16-year-olds, ASER 2024 reports approximately:

- nearly 90% have a smartphone in the household;
- 82.2% report knowing how to use a smartphone;
- among smartphone users, 57% used it for an educational activity in the previous week;
- 76% used it for social media;
- personal ownership is substantially lower than household access;
- reported ownership differs by gender: 36.2% boys vs 26.9% girls;
- availability of a smartphone to complete ASER digital tasks was 70.2% for boys vs 62.2% for girls.

Research interpretation:

**household smartphone access is not equivalent to private, continuously available student access.**

Shared-device behavior is therefore a first-class design case, not an edge case.

## 3. School digital infrastructure

UDISE+ 2024–25 official statistics report, nationally:

- total schools: 1,471,473;
- schools with computer facility: 951,868;
- schools with functional pedagogical computers: 852,684;
- schools with internet facility: 933,987.

Official source:
https://dashboard.udiseplus.gov.in/report2025/static/media/UDISE%2B2024_25_Booklet_existing.118ba29d4773e6372f72.pdf

These correspond to roughly:

- **64.7%** with computer facility;
- **57.9%** with functional pedagogical computers;
- **63.5%** with internet.

These are infrastructure counts, not proof of reliable classroom bandwidth, device-to-student ratio, teacher use or home access.

Pri implication:

Do not architect classroom dependency around guaranteed school connectivity.

## 4. Coverage is not device ownership

GSMA reporting in 2026 highlights the distinction between mobile-network coverage and actual internet-enabled-device ownership/use. Its India analysis estimates hundreds of millions of people still lack an internet-enabled device and identifies handset affordability as a persistent barrier.

Source:
https://www.gsma.com/solutions-and-impact/connectivity-for-good/mobile-for-development/blog/how-jio-is-improving-handset-affordability-and-access-for-the-underserved-in-india/

Use with caution:

- GSMA is an industry source;
- population figures are contextual, not Pri-user estimates;
- it reinforces the architectural distinction between network availability and usable personal device access.

## 5. DIKSHA as operating-context evidence

India's official DIKSHA platform supports patterns consistent with this environment:

- guest/anonymous use;
- content download;
- offline use;
- QR-linked textbook workflows;
- multilingual access.

Official:
https://diksha.gov.in/help/getting-started/diksha-mobile-app/index.html

This does not prove Pri should clone DIKSHA.

It shows that offline, guest, QR and multilingual flows are not speculative India requirements.

## 6. Product consequences now

### Device is not identity

Never infer learner identity from a device.

A household phone may belong to:

- parent;
- sibling;
- multiple students;
- school/teacher.

Local state must be profile-scoped.

### Account is not required for first value

Where legal/product policy permits, allow useful guest learning.

Registration failure should not make basic practice disappear.

### Network is an enhancement, not the learning-loop authority

For supported content:

```text
question
→ attempt
→ local capture
→ local/deterministic mark
→ bounded repair
→ learner state/event
→ next action
```

should remain useful offline.

Cloud AI can enrich rather than own the basic loop.

### Sync must assume long interruption

Queue semantics must tolerate:

- hours/days offline;
- duplicate retry;
- app termination;
- account switch;
- clock drift;
- partial upload;
- server conflict.

### Content packs must be resumable

A 95% download is not a valid pack.

Require:

- manifest;
- hash/integrity;
- version;
- resumable chunks;
- storage budget;
- safe eviction;
- no false “downloaded” state.

## 7. Low-end device strategy

Define explicit target tiers after field measurement.

Example research tiers, not final product requirements:

### Tier A

Entry/budget Android:
- limited RAM/storage;
- older supported Android;
- constrained CPU;
- metered network.

### Tier B

Current mid-range Android.

### Tier C

iPad/iPhone or higher-end device with richer on-device capability.

Core mathematics should degrade by **capability**, not by correctness.

Never make lower-tier devices receive lower mathematical truth standards.

Possible degradation:

- fewer animations;
- deferred large assets;
- local deterministic instead of cloud-generative explanation;
- lighter recognition path;
- downloaded packs.

## 8. Performance measures that matter

On real target devices record:

- install/update bytes;
- first useful screen;
- question-ready latency;
- input latency;
- mark-ready latency;
- offline start latency;
- memory peak;
- storage growth per 100/1000 attempts;
- battery cost;
- mobile data per session;
- content-pack size;
- interrupted-download recovery;
- sync backlog processing;
- thermal degradation for long sessions.

Desktop Lighthouse alone is not field evidence.

## 9. Shared-device privacy benchmark

Scenario:

1. Student A works offline.
2. A logs out.
3. Student B uses same device offline.
4. Network reconnects later.

Prove:

- A's questions/history/ink do not appear to B;
- B does not inherit A's learner state;
- queued A events remain owned by A;
- B's events cannot be uploaded as A;
- private asset URLs/caches are isolated;
- guardian/teacher links do not bleed;
- account deletion does not resurrect data from stale queue.

This should be a permanent adversarial test.

## 10. Guest-to-account migration benchmark

Test:

- one guest → new account;
- guest already partially synced elsewhere;
- account has existing history;
- migration interrupted;
- migration repeated;
- two siblings accidentally choose same guest profile;
- user cancels halfway.

Required properties:

- explicit preview of what moves;
- idempotence;
- no history theft;
- conflict strategy;
- rollback/recovery;
- audit event.

## 11. Language reality

“Hindi mode” is not enough.

Field research should record, for a legitimate product purpose:

- home/familiar language;
- language of instruction;
- assessment language;
- preferred explanation language;
- official math terminology familiarity;
- comfort with code-switching.

Do not infer all of these from geography.

A learner may want:

- English question;
- Hindi explanation;
- English mathematical terms;
- bilingual summary.

That is a bridge pattern, not inconsistent UX.

## 12. Mathematics terminology

Maintain an authoritative terminology layer separate from free translation.

For each term:

- semantic concept ID;
- official source wording;
- English term;
- approved target-language term;
- transliteration if useful;
- aliases;
- dangerous ambiguity;
- symbol convention;
- curriculum/version.

LLM translation cannot become curriculum terminology authority.

## 13. Educational vs social smartphone use

ASER's gap between educational activity and social-media use matters because:

**ability to use a smartphone is not equivalent to ability to use an educational workflow independently.**

Pri should test:

- onboarding comprehension;
- account/profile selection;
- download status;
- sync understanding;
- handwriting/camera workflow;
- interpretation of feedback;
- privacy expectations.

“Digitally native” is not a valid usability assumption.

## 14. Field-research programme

### Phase F0 — instrumented internal/device lab

Build repeatable low-end/offline/shared-device tests.

No student-efficacy claim.

### Phase F1 — contextual interviews/usability

Sample across meaningful diversity:

- board/class;
- language pathway;
- urban/peri-urban/rural where relevant;
- device tier;
- shared/personal device;
- connectivity pattern;
- school/coaching/self-study context.

Measure behaviors, not only preferences.

### Phase F2 — small descriptive pilot

Measure:

- onboarding completion;
- useful offline completion;
- sync failures;
- device performance;
- language switching;
- support needs;
- input-method failures.

No national generalization.

### Phase F3 — mechanism experiments

Only after reliability.

Examples:

- bilingual bridge;
- PMR intervention;
- offline pack defaults.

### Phase F4 — multisite efficacy

Only after mechanism safety/benefit is established.

Report actual population and context.

## 15. Field-study data minimization

Collect a field only if it answers a defined question.

Examples:

- device model is useful for performance;
- shared-device status is useful for privacy/usability;
- connectivity class is useful for offline design.

Do not collect:

- broad demographics;
- precise location;
- sensitive traits

merely because they might be analytically interesting.

Where subgroup reliability requires sensitive data, establish legal/ethical purpose and governance first.

## 16. Child-data legal boundary

India's final Digital Personal Data Protection Rules were notified in November 2025 with staged commencement.

Official:
https://www.meity.gov.in/data-protection-framework

Product/legal implications must be checked against:

- the Act;
- final Rules;
- effective dates;
- applicable exemptions;
- current government notifications;
- qualified legal review.

A research summary cannot decide whether a specific Pri processing operation is legally permitted.

Architecture consequence:

consent/purpose/retention/provider rules must be **versioned and supersedable**, not hard-coded globally.

## 17. Content rights

Availability from NCERT/CBSE is not automatic commercial reproduction authority.

Keep:

- curriculum truth;
- reference source;
- reproduced content;
- derivative content;
- Pri-authored content

as separate rights states.

A India growth strategy must not create a content-rights debt.

## 18. Economics and bandwidth

Before cloud-heavy tutoring is a default, measure:

- requests per learning minute;
- bytes per question;
- cloud inference cost per active learner;
- retry cost under poor links;
- upload size for handwriting/photo;
- cache hit/offline completion.

A feature that works beautifully on Wi-Fi but consumes unacceptable mobile data is not India-ready.

## 19. What Pri must learn from its own users

National datasets cannot answer:

1. What fraction of target Pri students share a device?
2. For how many hours/day is it actually available?
3. How often is usable connectivity interrupted?
4. How much storage can the app reasonably occupy?
5. Which workflows are abandoned because of data/latency?
6. What explanation/assessment language combinations are wanted?
7. Which age/class cohorts can manage guest/account migration unaided?
8. Which cloud features are valuable enough to justify connectivity?
9. Which device classes fail handwriting/graph interactions?
10. What parent/teacher workflows govern access?

These are high-priority Pri field questions.

## 20. Release evidence matrix

Do not use one “India ready” flag.

Report separately:

- offline core: proven/unproven;
- shared-device isolation: proven/unproven;
- low-end Android performance: device evidence;
- Hindi/bilingual semantic parity: benchmark;
- content-pack reliability: benchmark;
- guest migration: benchmark;
- cloud data cost: measured;
- target-cohort usability: field evidence;
- learning efficacy: experimental evidence.

## 21. Core rule

> **Design for unreliable access and shared control by default, then let Pri's own field evidence—not assumptions about India—determine where the product can safely become richer.**
