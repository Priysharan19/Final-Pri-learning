# Proposed privacy wording for AI-written marking comments (OWNER TO APPROVE)

Status: **a proposal only. No live legal document, notice or consent sheet has been changed.**
Legal wording is the owner's to approve. **`PRI_FEATURE_LINE_COMMENTS` must not be set to 1 on any site until the owner has approved
the wording below (or different wording) and it is live in `docs/legal/**` and, if the owner decides it, the consent sheet.**

## What the feature sends, and when

Only after the question is resolved, only when the server variable is on, and only for a marked answer that has at least one line the
engine gave a tick or a cross to, the server sends the AI provider (OpenAI, the same provider that reads handwriting):

* the question text (and its mark total);
* the text of each commented line of the student's working (typed text, or the text Pri read from handwriting; never an image);
* for each such line the engine's state and its own one-line reason or note;
* the released worked solution (the steps and the final answer the student is already shown), unless every commented line is an
  arithmetic tick, in which case no solution is sent;
* the edition wording and the language.

It does not send: a name, an email, an account or device id, the marks, the student's history, a handwriting image or photo.
Nothing is sent while a question is open (before it resolves). The comments are stored with the attempt and appear in the account export.

## Is it covered by the existing consent?

**No. It needs its own line.** The current consent sheet ("Before Pri reads your writing", `readerPermission.*` in
`client/src/i18n/strings.en.js`) covers only reading handwriting or a photo. It says "To read your handwriting, Pri's server sends a
picture of it to OpenAI" and, importantly for this feature, "For handwriting, only a picture drawn from your strokes is sent: not the
question, not the answer, not your name." Comments send **the question, the worked solution and the text of the working**, to the same
provider, and they also apply to **typed** answers, which never see that sheet. So the sheet's own sentence ("not the question, not the
answer") would be untrue for comments if they were presented as covered by it. The consent sheet is not changed here.

## Proposed sentences (as added to the privacy notices by the original branch)

### English, India edition (`docs/legal/privacy.md`) and Australia edition (`docs/legal/au/privacy.md`)

> **The comments on your marked working are written by AI.** To write them, your marked working and the question are sent to the same AI provider, OpenAI. The comments explain each line; they never change your marks, which our maths engine decides.

### Hindi (`docs/legal/privacy.hi.md`)

> **आपके जाँचे गए हल की टिप्पणियाँ कृत्रिम बुद्धि लिखती है।** इन्हें लिखने के लिए आपका जाँचा गया हल और प्रश्न उसी कृत्रिम बुद्धि सेवा, OpenAI, को भेजे जाते हैं। टिप्पणियाँ हर पंक्ति को समझाती हैं; वे आपके अंक कभी नहीं बदलतीं, जो हमारा गणित इंजन तय करता है।

### Suggested additions the owner may want (not in the original branch)

* "The worked solution is sent as well, only after a question is finished." (the original sentence omits the solution)
* A retention sentence matching the reader's: "OpenAI is asked not to store it, but says it may keep it for up to 30 days to check for
  misuse, and does not use it to train its models by default." (copy from `readerPermission.keep`; confirm with the provider's terms)
* Whether this needs a separate opt-in, or may sit in the privacy notice alone (a legal decision, for a minor's account especially).

The "not reviewed by a lawyer" banner on the notices stays until counsel has read them.
