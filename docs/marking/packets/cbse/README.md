# CBSE (Priyabhata) — method-mark rubric certification

> **Not yet reviewed by a human examiner.** This packet is a review request generated from the code. Nothing in it is academically approved, and no examiner has seen or signed it.

Tracking: #499. Dossier: [`docs/marking/order14-examiner-certification-dossier.md`](../../order14-examiner-certification-dossier.md). Dossier digest: `c9273217523bbca9570ca77254b43d2f72d9e1159ef19d41ceae8e15b993efc1`.

## Cover letter

Dear examiner,

Pri Learning is a mathematics practice platform. Its marks are decided by a deterministic engine on our server, never by an AI model. Today it pays marks for the final answer only. We are asking an independent, qualified CBSE mathematics examiner (Class X–XII board-examination marking experience), who did not write or commission this code to review the rules the engine applies, so that we can either keep them as they are or correct them, and so that partial (method) marks are only ever paid on rules a qualified human has approved.

We are not asking you to endorse the product, and we will not describe your review as approval by any board or authority.

## What is being asked

1. Whether each method rubric (generator × level) below awards the marks a CBSE examiner would award, stage by stage, including first-error and error-carried-forward behaviour.
2. A ruling on the two open policy calls (A and B) and the Class XI least-value scheme.
3. Whether each bank fits the current CBSE syllabus.

## How the marking works (plain language)

- The server issues every question and keeps its key. A student's answer is checked by deterministic code on the server, only online and only for a signed-in account.
- **Final-answer marking (live today):** a right final answer, in any form the engine proves equal to the key, earns the question's marks; anything else earns none. Working is read and shown back as feedback, never marked.
- **Method marks (off today):** for questions with a step plan, the engine can check each line of working and award stages, capped at one mark below the question's marks for a wrong final answer. This stays off until a complete, signed decision for this jurisdiction exists in the repository and the owner switches it on.

## What is in this packet

| File | What it is |
|---|---|
| [`../../order14-examiner-certification-dossier.md`](../../order14-examiner-certification-dossier.md) | The dossier: every rubric and policy, and the digest you sign. |
| [`worked-cases.md`](worked-cases.md) | For each item, a sample question and the engine's verdict on a correct, alternative, common-wrong and partial answer. |
| [`decision-form.md`](decision-form.md) | One line per item for your verdict. |
| [`independence-statement.md`](independence-statement.md) | Independence and conflict statement to sign. |
| [`items.json`](items.json) | The same item list, for the platform's verifier. |

## How to return it

1. Complete and sign the decision form and the independence statement (paper or a signed PDF).
2. Send them to the Pri Learning owner directly — not by pull request or issue comment.
3. The owner keeps the signed original and records where it is held. A Pri engineer transcribes it into a JSON record; the verifier refuses the record unless it names your qualification, independence, date and a verdict for every item, at exactly the digest above.
4. If the code changes after you sign, the digest changes and your signature no longer applies to it. You will be asked to review the difference.

**Certification status: PENDING. Approved by: nobody.**
