# India, Multilingual, Offline and Content Rights Architecture

## 1. India is not “web app, translated”

The India product must treat as normal:
- intermittent connectivity;
- offline downloads;
- shared devices;
- guest/low-friction entry;
- multilingual explanation;
- English-assessment transfer;
- QR/physical-book workflows;
- curriculum/source versioning;
- content-right restrictions.

Official DIKSHA behavior itself reflects multilingual, offline, guest/shared-device and QR-linked learning realities.

Source:
https://diksha.gov.in/

Do not copy DIKSHA features blindly. Use this as operating-context evidence.

## 2. Multilingual mathematical authority

Canonical object:
mathematical semantics.

Language rendering is downstream.

Maintain a versioned terminology authority:
- concept ID;
- official English term;
- Hindi term;
- curriculum/source wording;
- acceptable synonyms;
- transliteration if useful;
- dangerous false friends;
- symbol conventions;
- grade/curriculum/version.

A general LLM does not silently decide official mathematical terminology.

## 3. National curriculum context

The National Curriculum Framework for School Education emphasizes multilingual educational capacity and familiar/home-language use.

Official:
https://www.education.gov.in/sites/upload_files/mhrd/files/ncf_2023.pdf

Research supports careful bilingual/translanguaging use, but effects depend on proficiency/context.

Sources:
https://doi.org/10.1080/14790718.2026.2575061
https://doi.org/10.1007/s11858-024-01603-0

Pri implication:
Use bilingual rendering as a bridge, not a permanent replacement for assessment-language competence.

## 4. Bilingual repair

For learners whose exam language is English, a high-value pattern can be:

- preserve original English problem;
- explain difficult reasoning in familiar language where useful;
- keep official English mathematical terms visible;
- fade bridge language as independent English-form competence grows;
- verify transfer on English-form items.

Do not translate away the construct being assessed.

Example:
If interpreting a word problem in English is itself part of the construct, full translation changes the assessment.

## 5. Code-switched working

Student explanations may mix languages while symbols remain standard.

Marking pipeline should:
1. preserve original response;
2. identify mathematical claims;
3. normalize terminology;
4. verify mathematics;
5. treat language quality separately unless language is mark-bearing.

Do not infer weak mathematics from weak English without further evidence.

## 6. Shared-device threat model

On a shared phone/tablet:

Student A logs out.
Student B logs in.
The network is offline.
Queued writes remain.

Pri must prove:
- no work leakage;
- no learner-state inheritance;
- no outbox mixing;
- no guardian/teacher link bleed;
- no cached private URL reuse;
- no account-deletion resurrection after sync.

Every local artifact/event must bind to:
- local profile/account/guest identity;
- encryption/key scope where relevant;
- curriculum/content version;
- sync owner.

## 7. Guest continuity

Where policy permits, allow useful learning without fragile registration.

Guest state can include:
- syllabus choice;
- downloaded content;
- attempts;
- lightweight local learner evidence.

On account creation:
- explicit migration;
- show what will move;
- idempotent merge;
- conflict handling;
- rollback/recovery.

Never silently merge two learner histories.

## 8. Offline core

For locally supported classes:

question
-> attempt
-> capture
-> local/deterministic verification
-> bounded repair
-> retry
-> event ledger
-> queued sync.

Cloud-only generative enrichment can degrade gracefully.

Do not advertise a feature as offline-first if its useful learning loop disappears without network.

## 9. Content packs

A pack should be:
- versioned;
- integrity checked;
- resumable;
- curriculum scoped.

Manifest can include:
- curriculum/version;
- question families;
- verified solutions;
- terminology;
- visuals;
- policy;
- size/hash/signature.

Partial/corrupt pack must not present as complete.

## 10. Sync semantics

Use operation IDs/idempotency.

On reconnect:
- preserve ordering where needed;
- deduplicate events;
- detect conflicts;
- avoid double-counting mastery;
- distinguish server-authoritative changes;
- retain source artifacts until confirmed under retention policy.

Do not trust device wall-clock alone for security/evidence ordering.

## 11. Low-end device / bandwidth evidence

Measure on real target devices:
- cold start;
- ink latency;
- question-ready latency;
- mark-ready latency;
- storage growth;
- memory pressure;
- battery/network use;
- content download interruption/recovery.

Simulator/desktop performance is not T4 device evidence.

## 12. Curriculum/version authority

Curriculum data must carry:
- jurisdiction/board;
- class/course;
- syllabus version;
- cohort/effective period;
- source URL/document;
- acquisition date;
- concept IDs;
- migration mapping.

Old learner evidence remains attached to its original curriculum version.

Do not silently relabel evidence when a syllabus changes.

## 13. Rights are separate from curriculum truth

Five distinct things:

1. curriculum fact;
2. source used as reference;
3. reproduced text/diagram/question;
4. derivative/adapted content;
5. Pri-authored independent content.

Each needs a rights analysis.

## 14. NCERT rights

NCERT has explicitly warned about unauthorized commercial reproduction of textbook content.

Official:
https://www.ncert.nic.in/pdf/announcement/notices/Press_Release_Copyright_Infringement-NCERT.pdf

ePathshala/NCERT online textbook access terms impose copyright/redistribution/commercial restrictions.

Official:
https://epathshala.nic.in/

Therefore:
public/downloadable != commercial reuse authority.

## 15. CBSE rights

CBSE publishes a copyright policy with permission/attribution boundaries and separation of third-party materials.

Official:
https://results.cbse.nic.in/copyright-policy/

## 16. Rights manifest

Every external content object should record:
- source;
- owner/publisher;
- URL/document/version;
- acquisition date;
- content type;
- rights basis;
- allowed uses;
- commercial status;
- derivative status;
- redistribution;
- attribution;
- review date;
- evidence artifact/reviewer.

If unknown:
REFERENCE_ONLY / RIGHTS_UNKNOWN.

Never silently promote to commercial-authorized.

## 17. Generated content provenance

Generated item should preserve:
- construct/family;
- source context used;
- model/prompt version;
- similarity fingerprint;
- rights state;
- solution verification;
- admission status.

Run similarity checks against restricted source material to reduce accidental reproduction.

## 18. India efficacy

Do not infer national efficacy from:
- small pilot;
- one city;
- one school type;
- one device class;
- one language pathway.

Evidence ladder:

Tier 0 — descriptive pilot.
Tier 1 — mechanism randomized experiments.
Tier 2 — broader/multisite replication.
Tier 3 — independent/external efficacy where feasible.

Claims must name the actual population/outcome.

## 19. Required India field questions

Measure directly in target users:
- connectivity/intermittency;
- shared-device prevalence;
- storage constraints;
- language preference vs assessment language;
- teacher/guardian workflows;
- content-pack size tolerance;
- cloud-feature value;
- offline failure patterns.

National averages are context, not a substitute for Pri's population.

## 20. Core rule

Pri India should be architected so:
- network unreliability does not erase learning continuity;
- shared devices do not erase privacy;
- language support does not erase mathematical meaning;
- official content access does not erase copyright boundaries.
