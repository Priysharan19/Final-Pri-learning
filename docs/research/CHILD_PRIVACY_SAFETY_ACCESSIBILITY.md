# Child Privacy, Safety, Equity and Accessibility

## 1. Child policy must be versioned

Pri spans jurisdictions whose child-data obligations differ and change over time.

Do not build a global permanent boolean:
guardianConsent = true/false.

Policy dimensions should include:
- jurisdiction;
- policy/version;
- effective dates;
- age band;
- user role;
- purpose;
- data class;
- processing basis;
- consent requirement;
- guardian verification;
- provider allow-list;
- retention;
- research/analytics;
- personalization;
- visibility;
- marketing/tracking prohibition.

## 2. India DPDP

India notified the final Digital Personal Data Protection Rules in November 2025, with staged commencement.

Official framework:
https://www.meity.gov.in/data-protection-framework
https://egazette.nic.in/

Child-data requirements include special protections and consent-related obligations subject to the Act/Rules and commencement schedule.

Release code/policy must consult current official effective dates and qualified legal review.

A research document is not legal sign-off.

## 3. Australia Children's Online Privacy Code

The OAIC published a draft Children's Online Privacy Code in 2026, with finalisation due in December 2026.

Official:
https://www.oaic.gov.au/privacy/privacy-legislation/the-privacy-act/childrens-online-privacy-code

As of this research date, draft details are not final obligations.

Architecture must be supersedable.

## 4. Separate permissions

Do not bundle:
- account creation/required processing;
- optional analytics;
- experimentation/research;
- cloud AI processing;
- guardian visibility;
- teacher visibility;
- marketing;
- external sharing.

Consent to use Pri is not consent to every downstream purpose.

## 5. Guardian authority vs visibility

A guardian may be authorized to provide required consent without automatically receiving:
- every wrong answer;
- every hint;
- every handwritten page;
- every confidence response;
- private tutor transcript.

Visibility is a separate policy.

## 6. Guardian product boundary

Meta-analytic evidence distinguishes supportive parental involvement from intrusive involvement.

Sources:
https://doi.org/10.3389/fpsyg.2024.1463359
https://pmc.ncbi.nlm.nih.gov/articles/PMC10373934/

Prefer:
- high-level goals;
- topic progress;
- broad consistency;
- supportive next action.

Avoid:
- minute-by-minute monitoring;
- opaque risk score;
- every mistake/hint;
- shame-based alerts.

Measure student autonomy/help honesty as guardrails.

## 7. Relational safety

Pri can be:
- warm;
- patient;
- encouraging;
- playful.

Pri must not optimize for:
- emotional exclusivity;
- secrecy;
- romance;
- neediness;
- guilt for leaving;
- “only I understand you” dynamics;
- endless companionship.

Australian eSafety and UNICEF 2026 work highlights child risks around AI companions, disclosure, manipulation and dependency.

Sources:
https://www.esafety.gov.au/research/ai-chatbots-and-companions
https://www.esafety.gov.au/industry/tech-trends-and-challenges/ai-companions
https://www.unicef.org/innocenti/reports/ai-companions-and-children

## 8. No covert emotion/attention surveillance

Reject default:
- webcam emotion recognition;
- voice-emotion scoring;
- attention detection;
- covert boredom/stress inference.

These are weak educational proxies with high privacy/cultural validity risk.

Prefer:
- optional self-report;
- task evidence;
- explicit learner request;
- teacher/student input.

Do not infer clinical diagnosis.

## 9. Data minimization

For every datum:
- purpose;
- retention;
- access;
- model/training use;
- deletion;
- lawful/consent basis.

If a less-sensitive verified derivative supports the same learning decision, prefer it.

## 10. Long-horizon memory classes

M0 transient interaction state.
M1 raw artifact.
M2 verified semantic learning event.
M3 derived learner inference.
M4 bounded personal/conversational context.

The system should have:
a long memory for learning evidence and a short memory for unnecessary personal exhaust.

Product-learning memory != ML research/training consent.

## 11. Deletion/withdrawal

Deletion/guardian withdrawal must propagate to:
- primary records;
- derived learner state;
- offline queues/copies;
- cached private assets;
- model/research datasets according to commitments;
- backups under documented lifecycle.

Deleting one profile row is insufficient.

## 12. Equity and subgroup reliability

Average performance can hide harmful lower-tail failure.

For critical systems evaluate:
- calibration;
- false-correct/false-wrong;
- recognition error;
- progression error;
- intervention harm;

by operational slices where lawful and meaningful:
- prior performance;
- language;
- device/input modality;
- accessibility path;
- assistance level;
- curriculum;
- time horizon.

Do not collect sensitive demographics without a clear governed purpose.

## 13. Measurement fairness

Separate mathematical ability from measurement-channel difficulty.

Potential confounds:
- language load;
- handwriting recognition;
- visual/motor burden;
- device interaction;
- unfamiliar cultural context.

When an item behaves differently, investigate whether the measurement channel—not the mathematics—caused it.

## 14. Semantic accessibility

Accessibility starts from structured mathematical semantics.

Standards/research:
https://www.w3.org/TR/mathml-core/
https://www.w3.org/TR/mathml4/
https://www.w3.org/Math/Documents/Charter2026.html
https://accessiblemaths.org/

Canonical objects:
- expression tree;
- equation relations;
- graph structure;
- diagram constraints;
- table structure;
- proof/derivation relationships.

Render to:
- visual math;
- screen reader;
- keyboard navigation;
- text/LaTeX;
- braille where supported;
- structural graph description;
- tactile/sonification where appropriate.

## 15. Equation navigation

Allow semantic traversal:
- numerator;
- denominator;
- exponent;
- radicand;
- function argument;
- matrix row/column;
- equation sides;
- nested subexpressions.

Avoid flat unreadable token streams.

## 16. Graph accessibility

Graph alternatives should expose appropriate structural features such as:
- axes/domain/range;
- intercepts;
- extrema;
- discontinuities;
- monotonic intervals;
- asymptotes;
- marked points/regions.

Assessment mode must not reveal the answer when the graph feature itself is being assessed.

## 17. Diagram accessibility

Represent:
- points/objects;
- givens;
- incidences;
- labels;
- declared equalities;
- derived claims.

Keep “looks like” separate from “given/proved.”

## 18. Accommodation vs assistance

An accommodation that removes:
- motor;
- visual;
- auditory;
- navigation;
- input burden

does not automatically contaminate mathematical mastery.

Mastery credit changes only when the tool supplies target reasoning.

Example:
read expression aloud = access.
announce derivative when differentiation is target = mathematical assistance.

## 19. Testing

Critical math UI should test:
- semantic structure;
- keyboard reachability;
- focus order;
- accessible labels;
- color-independent meaning;
- reduced motion;
- zoom/reflow;
- screen-reader-safe updates;
- assessment leakage.

Physical assistive-technology testing remains real-world evidence and must not be fabricated.

## 20. Child red-team

Test attempts to:
- induce secrecy/exclusivity;
- obtain sensitive information;
- bypass guardian/assessment policy;
- manipulate streak/engagement;
- create romantic/dependency role-play;
- evade provider-routing restrictions;
- reveal another profile's data.

Safety must be part of release evidence, not a policy page only.
