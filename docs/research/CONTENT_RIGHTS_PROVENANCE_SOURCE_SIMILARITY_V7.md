# Content Rights, Provenance and Source Similarity V7

Status: V7 operational/legal-research contract
Freshness: 1 October 2026

Important: this document is engineering/research guidance, not legal advice. Commercial release requires current rights/legal review.

## 1. Purpose

Pri needs authoritative curriculum knowledge.

That does not mean Pri automatically has rights to reproduce:

- textbook pages;
- questions;
- diagrams;
- worked solutions;
- translations;
- adaptations;
- exam-bank compilations.

The architecture must separate:

> what is true about the curriculum

from:

> what content Pri is authorized to reproduce commercially.

## 2. NCERT's own online licence is explicitly restrictive

NCERT/ePathshala's online textbook terms state that:

- NCERT is the copyright owner of its e-content;
- users may read/download under the licence;
- distribution is conditioned on no monetary consideration or commercial use;
- sale/rental is restricted;
- adaptation, translation, alteration, summarization and derivative use require specific written permission under the stated licence.

Official source:
https://epathshala.nic.in/wp-content/doc/book/gtextbook/textbook.htm

Another NCERT online textbook notice states that:
- republication is prohibited;
- electronic/print redistribution is prohibited;
- use in digital content packages/software is prohibited;
- linking requires written permission under that notice.

Official:
https://epathshala.nic.in/wp-content/doc/book/btextbook/textbook.htm

### Pri consequence

“Available free on ePathshala” does **not** equal:

“free for Pri to ingest, adapt, translate and resell.”

## 3. NCERT has directly warned commercial publishers

NCERT issued an April 7, 2024 press release warning that entities using NCERT textbook content in commercial publications without copyright permission may face proceedings under the Copyright Act.

Official:
https://www.ncert.nic.in/pdf/announcement/notices/Press_Release_Copyright_Infringement-NCERT.pdf

### Pri consequence

Any product flow involving NCERT text/diagrams/questions must have a rights state before commercial admission.

## 4. Educational exceptions exist, but Pri must not self-declare broad exemption

Section 52 of India's Copyright Act contains exceptions including certain:
- private/research;
- criticism/review;
- teaching/instruction;
- examination;
- accessible-format uses.

Official Copyright Office:
https://copyright.gov.in/Exceptions.aspx

The legal scope and application of these exceptions depends on:
- exact use;
- entity;
- context;
- commerciality;
- amount/substantiality;
- case law.

### Pri rule

Engineering agents do not decide:

> “Section 52 means we can ship this.”

Unclear assets become:
RIGHTS_REVIEW_REQUIRED.

## 5. Rights object is separate from source object

A SourceRecord answers:
- where did this come from?
- what version/date?
- what authority?

A RightsRecord answers:
- who owns it?
- what permission exists?
- what uses are allowed?

Do not merge them.

## 6. Rights status taxonomy

Recommended states:

### PRI_ORIGINAL
Independent Pri-authored content.

### PUBLIC_DOMAIN_CONFIRMED
Legal basis verified.

### LICENSED_COMMERCIAL
Permission/licence covers intended Pri use.

### LICENSED_RESTRICTED
Use permitted only under defined constraints.

### REFERENCE_ONLY
May inform curriculum/facts, but content cannot be reproduced/adapted.

### RIGHTS_UNKNOWN
No verified basis.

### RIGHTS_REVIEW_REQUIRED
Specific legal ambiguity.

### PROHIBITED
Known not permitted for intended use.

Only clearly admitted states can enter production content.

## 7. Rights manifest

For each external asset:

- asset ID;
- source;
- publisher/owner;
- URL/document;
- acquired date;
- content type;
- jurisdiction;
- rights status;
- licence/permission evidence;
- allowed uses;
- commercial use?;
- redistribution?;
- adaptation?;
- translation?;
- attribution requirement;
- expiry/review date;
- reviewer;
- evidence attachment/reference.

This should be machine-readable.

## 8. Curriculum facts versus expression

Generally:
- mathematical facts;
- syllabus facts;
- topic names

are different from copying protected:
- wording;
- selection/arrangement;
- diagrams;
- authored questions;
- explanations.

Pri can align to a curriculum without cloning its textbook.

## 9. Source-to-original-content pipeline

Preferred:

OFFICIAL CURRICULUM FACT
→ semantic KnowledgeComponent
→ Pri QuestionFamily specification
→ independent Pri-authored/generated candidate
→ similarity screening
→ mathematical verification
→ rights admission
→ practice pilot

This reduces dependence on protected expression.

## 10. Generated content does not automatically become clean-room content

An LLM may reproduce or closely imitate source material.

Generation must preserve:
- source context;
- model/prompt;
- retrieval context;
- similarity result.

If a model has been shown a restricted question, a near-copy remains a rights risk.

## 11. Retrieval boundaries

Do not put rights-restricted content into general generation retrieval if the generated outputs may reproduce/adapt it beyond permitted use.

Possible source modes:

### FACT_EXTRACTION_ONLY
Extract curriculum facts/metadata.

### INTERNAL_REVIEW
Human/agent reference; no generated derivative admitted without review.

### GENERATION_ALLOWED
Licence permits derivative/generative use.

### PROHIBITED_FROM_MODEL_CONTEXT
Do not send to model.

## 12. Similarity screening

For generated/adapted item candidates, compare against restricted source corpus using multiple signals:

- exact text overlap;
- n-gram;
- embedding similarity;
- mathematical structure;
- diagram similarity;
- distinctive context/numbers.

A low text overlap does not necessarily mean independent expression.

## 13. Mathematical structure versus protectable expression

Two questions can have:
- same mathematical family;
- different expression.

This is exactly why QuestionFamily should be semantic.

Pri can generate:
- independent instances

from:
- abstract mathematical structure.

Do not preserve:
- distinctive story;
- unique diagram;
- unusual number sequence;
- exact answer choices

without rights basis.

## 14. Thresholds are review tools, not legal rules

A similarity score of:
0.72

does not mean:
legal / illegal.

Use thresholds to route:
- clear independent candidate;
- manual review;
- reject/quarantine.

Legal substantiality is not one cosine threshold.

## 15. Diagram rights

Diagrams can be artistic works.

Safer architecture:
- reconstruct from semantic geometry spec;
- use Pri's own rendering.

Do not screenshot/crop source diagrams unless rights permit.

Semantic facts:
- AB ∥ CD;
- ∠ABC = 40°

can drive a new renderer.

## 16. Translation

Translation can itself be a protected derivative use.

NCERT's e-content licence explicitly addresses adaptation/translation restrictions.

Therefore:
- machine translation is not a rights workaround.

For protected source wording:
do not translate for production without authority.

For Pri-original content:
translation can proceed under Pri's own policy.

## 17. Worked solutions

Official answer:
source-owned expression may be protected.

Pri can often:
- solve mathematics independently;
- create an original explanation.

Record:
PRI_AUTHORED_SOLUTION.

Do not claim:
“official solution”
unless it actually is and use is permitted.

## 18. Exam questions / past papers

For every past-exam corpus record:

- exam body;
- year/session;
- question number;
- source;
- rights owner;
- rights basis;
- permitted display/use;
- transcription status.

Public availability alone is not commercial permission.

This applies to:
- board exams;
- entrance exams;
- trial papers;
- commercial question banks.

## 19. Answer-key linking

Even when Pri has a source question, answer/marking material may have a separate source/right status.

Link by stable provenance.

Do not merge:
- source answer;
- Pri-derived answer;
- Pri worked solution.

## 20. “41-year bank” / historical corpora

A large historical question inventory creates a systematic rights risk because scale itself matters operationally.

Before production integration:

1. classify source owners;
2. identify public/private/commercial publications;
3. determine rights basis;
4. separate metadata from reproduced content;
5. quarantine unknown assets.

Research/extraction completion does not equal release clearance.

## 21. Copyright exception versus product licence

Even if a specific internal research use is lawful:
that does not automatically authorize:
- customer-facing reproduction;
- paid distribution;
- content-pack inclusion;
- translation;
- adaptation.

Engineering should track intended use.

## 22. Content use classes

### U0 — metadata only
Exam/year/question ID.

### U1 — internal research/reference
Not displayed to users.

### U2 — learner display
Question/content visible.

### U3 — adapted/translated
Derivative transformation.

### U4 — downloadable/offline redistribution
Bundled content.

### U5 — commercial marketing/sample
Public promotional use.

A rights basis can allow some but not all.

## 23. Offline packs increase rights implications

Bundling source content into:
- downloaded pack;
- app bundle

can constitute a different distribution mode from:
- linking to official source.

RightsRecord should explicitly allow:
OFFLINE_DISTRIBUTION.

## 24. Link-out

Where appropriate and policy permits:
link to authoritative external content rather than rehosting.

But:
- link stability;
- user experience;
- external privacy

must be considered.

Do not scrape/rehost merely because link-out is inconvenient.

## 25. Attribution is not permission

Giving credit:
- is good practice;
- may be required by licence.

It does not transform unauthorized commercial use into authorized use.

## 26. “Fair use” language

India uses statutory exceptions/fair dealing frameworks, not a generic U.S.-style “fair use” assumption.

Agents should not write:
“this is fair use”
without qualified legal review.

Use:
LEGAL_BASIS_UNVERIFIED.

## 27. Accessible-format exceptions

Indian law contains specific accessible-format provisions for persons with disabilities.

These are important for inclusive access.

But exact eligibility, non-profit conditions and intended use require legal interpretation.

Pri accessibility architecture should:
- preserve semantic math;
- use Pri-original/licensed material where possible;
- seek legal review for protected-source accessible derivatives.

## 28. Content provenance UI

Internal provenance should be rich.

Learner-facing provenance can be concise:

- Official CBSE sample question;
- Pri original;
- Adapted with permission.

Do not falsely imply board endorsement.

## 29. Takedown / correction workflow

Need:

REPORT
→ quarantine if credible
→ investigate
→ remove/replace
→ invalidate content-pack version
→ preserve audit
→ learner evidence mapping review.

If removed item had learner responses:
do not erase learning history blindly.

Map to:
- KnowledgeComponent/Family
while removing protected expression where required.

## 30. Versioned source snapshot

Source terms can change.

Record:
- acquisition date;
- licence version;
- evidence screenshot/document hash where lawful.

Do not assume today's webpage terms governed all historic use.

## 31. Model-training provenance

If Pri ever fine-tunes/train models:

Training corpus needs:
- source;
- rights for training/use;
- data class;
- learner consent/policy where personal data;
- removal capability where required.

Do not treat “we had access” as model-training permission.

## 32. Rights benchmark / CI gate

Automated content gate can fail if:

- rights status missing;
- source missing;
- restricted asset enters offline pack;
- adaptation without allowed flag;
- attribution missing;
- unknown content enters production bank.

This does not replace lawyers.

It prevents known policy violations in engineering.

## 33. Human legal review queue

Route high-risk cases:

- official textbook reproduction;
- large past-paper corpus;
- commercial publisher source;
- translations/adaptations;
- generated near-copy;
- unknown ownership.

Record decision.

## 34. Current NCERT engineering rule

Based on the current official licence/notice:

Default NCERT textbook content state for Pri should be:

REFERENCE_ONLY / RIGHTS_REVIEW_REQUIRED

unless Pri has a specific written commercial permission or other reviewed legal basis.

Use NCERT for:
- curriculum/reference truth

without assuming content-reproduction authority.

## 35. Core decision

Pri should make content provenance a production data structure.

The safe rule is:

> **Know the curriculum deeply, but ship only expression that Pri has a verified right to use. Public availability is evidence of access, not evidence of commercial permission.**
