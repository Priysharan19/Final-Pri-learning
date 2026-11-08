# Parent weekly report: what counsel is asked to review before it is switched on

Status: **OFF** (owner default D22). The parent weekly report is finished in code (`server/platform/parentReport.js`, `client/src/parent/`) and stays off until Indian counsel has reviewed email about minors.

## What "off" means

- **Server.** `/v1/parent-report/*` is not mounted unless the deployment sets `PRI_PARENT_REPORT=on`; every path answers 404. No recipient address can be collected and no confirmation email can be sent. The hourly job does not start unless `PRI_PARENT_REPORT=on` and `PRI_PARENT_REPORT_EMAILS=on` are both set, and email is configured.
- **Device.** The "For parents" screen, its nav entry and the emailed confirm/stop page exist only in a build made with `PRI_FEATURE_PARENT_REPORT=1`. A production build has it off.
- **Data.** The two tables, `parent_report_links` and `parent_report_sends` (schema 14), exist and stay empty. They are under Row-Level Security, deleted with the account, and listed in the account export.
- **Disclosures.** The published privacy notice (`docs/legal/privacy.md`, `privacy.hi.md`), the App Store privacy labels and the Play data-safety form do **not** describe the report, because nothing happens. The wording below is applied to them only when the report is switched on.

`server/test/parent-report-check.mjs` and `client/test/parent-report-ui-check.mjs` prove the off state and, with the switch on, everything below.

## What counsel is asked to confirm

1. A **separate, specific consent** for the weekly report (double opt-in by the recipient), rather than a widened account notice. For an under-18 account, the only address that can be linked is the guardian whose account consent is `given`. It is re-checked at confirmation and before every send, and a withdrawal stops the link for good.
2. The **confirmation email**: subject "Confirm weekly Pri Learning reports"; body in `parentReportConfirmMessage` (`server/platform/parentReport.js`). It says what the report contains, that it never includes answers, handwriting or photos, that every report can be stopped, that the link lasts 7 days, and that doing nothing means nothing is sent.
3. The **weekly email** (`parentReportEmailMessage`). It contains aggregate counts, percentages and chapter names only, and never question text, answers, ink, photos or the child's name. It carries an RFC 8058 one-click unsubscribe that needs no sign-in.
4. Whether the report is **Premium**. The code gates it on the existing `advanced-analytics` capability, as #659 did. D19 does not list it, so the owner decides when it is switched on.
5. The **notice and disclosure changes** below, to be published before the switch is turned on.
6. The **in-app copy**, in English and Hindi:
   - `parent.emailHint`: "They get one email asking them to confirm. Reports start only after they do, and every report has a link to stop them."
   - `parentEmail.confirmLead`: "Confirm that you want a weekly report of the maths practice on this Pri Learning account. It never includes answers, handwriting or photos."

## Proposed notice and disclosure changes (from #659, not yet published)

These are the lines #659 added to the privacy notice (English and Hindi), the App Store privacy labels and the Play data-safety form. Each is given as it would read once added.

```text
- **साप्ताहिक रिपोर्ट के लिए किसी अभिभावक का ईमेल पता**, केवल तब जब आप (या आपके
  अभिभावक) प्रीमियम खाते पर इसे माँगें। उस पते पर हम पुष्टि माँगने वाला एक ईमेल
  भेजते हैं, और पुष्टि होने तक कुछ और नहीं। 18 वर्ष से कम आयु के खाते के लिए यह
  केवल वही अभिभावक हो सकता है जिसने खाते की पुष्टि की थी। हम पता, उसकी पुष्टि या
  रोके जाने का समय, और किन हफ़्तों में रिपोर्ट भेजी गई — यह रखते हैं। रिपोर्ट हर बार
  आपके जाँचे गए उत्तरों से बनाई जाती है और रखी नहीं जाती: उसमें होता है कि कितने
  प्रश्नों के उत्तर दिए और जाँचे गए, कितने दिन, कम से कम कितने मिनट, मिले अंकों का
  हिस्सा, कौन से अध्याय अच्छे रहे या दोबारा देखने लायक हैं, पहले की कितनी ग़लतियाँ
  सुधारी गईं, और अगले हफ़्ते की एक छोटी योजना। इसमें कभी आपके उत्तर, हल, लिखावट,
  फ़ोटो या आपका नाम नहीं होता। हर रिपोर्ट में एक लिंक होता है जो बिना साइन-इन किए
  उन्हें तुरंत बंद कर देता है, और आप ऐप में भी उन्हें बंद कर सकते हैं।
- **ईमेल भेजने की सेवा**, सत्यापन के लिंक, पासवर्ड रीसेट के लिंक, एक बार काम
  आने वाले कोड और, यदि किसी अभिभावक ने माँगी हो, ऊपर बताई गई साप्ताहिक रिपोर्ट के लिए, और **एसएमएस भेजने की सेवा**, मोबाइल नंबर पर भेजे जाने वाले
  की सदस्यता और जमा किया गया काम, सदस्यता का जुड़ाव, आपकी टेलीमेट्री, किसी भी
  अभिभावक का विवरण और साप्ताहिक रिपोर्ट का कोई पता और भेजे गए हफ़्तों का रिकॉर्ड हट जाता है। उसके बाद आपके ईमेल पते से एक नया, खाली खाता बनाया
- **A parent's email address for the weekly report**, only if you (or your
  parent) ask for it on a Premium account. We send that address one email
  asking them to confirm, and nothing else until they do. For an account of
  someone under 18 it can only be the parent or guardian who confirmed the
  account. We keep the address, whether and when it was confirmed or stopped,
  and which weeks a report was sent. The report itself is worked out from your
  marked answers each time and is not stored: it says how many questions were
  answered and marked, on how many days, at least how many minutes, the share
  of marks earned, which chapters went well or need another look, how many
  earlier mistakes were put right, and a short plan for the next week. It never
  includes your answers, working, handwriting, photos, or your name. Every
  report has a link that stops them at once without signing in, and you can
  stop them yourself in the app.
- **Email delivery** for verification links, password reset links, one-time
  codes and, if a parent asked for it, the weekly report described above, and **SMS delivery** for one-time codes sent to a mobile number. The
  link, your telemetry, any guardian's details and any weekly-report address
  and its record of sent weeks. Your email address can then
| **Contact Info → Email Address** | Yes | `EmailAddress` | Resend (email delivery), for links and codes | `accounts.js`; `authDelivery.js`; `otpEmail.js`. Includes a guardian's email for a child's account (`guardianConsent.js`), and a parent's email for the Premium weekly report (`parentReport.js`, `parent_report_links`; double opt-in; Resend delivers the confirmation and the weekly report). |
| **Other Data** | Yes | `OtherDataTypes` (**added**) | Guardian email/phone → the delivery provider; the weekly report's aggregate summary → the email provider (Resend), to the confirmed parent only | The "18 or older" declaration (`accounts.age_basis`), class and track, the guardian-consent record (method, notice version, times), and the parent weekly report's link state and per-week send ledger (`parent_report_links`, `parent_report_sends`: status, times, skip reason, provider message id). The report itself is computed from existing graded-attempt rows and not stored. **No new Apple data type**: the report adds a recipient Email Address (already ticked) and derives everything else from Other Usage Data (already ticked). |
| **Personal info → Email address** | Yes (unless the account signed up by phone) | Yes — email delivery provider (Resend) | Required (email or phone) | Account management; Fraud prevention, security, and compliance | `accounts.js`; `authDelivery.js`; `otpEmail.js`. A guardian's email for a child's account, and a parent's email for the Premium weekly report (`parentReport.js`; double opt-in, optional). A new-device sign-in notice goes to the account's own address through the same Resend account (`sessionAlerts.js`, `securityEmail.js`); the notice carries no address, token, link or code. |
| **Personal info → Other info** | Yes, from every account (the "18 or older" declaration, class and track); plus, for an under-18 account, the guardian-consent record | Guardian email/phone with the delivery provider (child accounts only) | Age declaration, class and track: required for every account. Consent record: required for a child's account | App functionality (age gate, which maths to set, guardian confirmation) | `accounts.age_basis` (a registration with no age decision is refused, `AGE_DECLARATION_REQUIRED`); class/track in the synced profile (`syncWorker.js safeProfile`); the consent record (`guardianConsent.js`); the parent weekly report's link state and per-week send ledger (`parent_report_links`, `parent_report_sends`). Matches the Apple "Other Data" row. |
| **App activity → Other actions** | Yes | Yes — Resend (email delivery), only for a Premium account whose parent confirmed the weekly report: an aggregate weekly summary derived from these records (counts, percentages, chapter names; no answers, ink or photos), as the OpenAI rows declare their provider | Required to be marked | App functionality | Graded-attempt records (`learning_events` kind `graded-attempt`) kept until deletion; exam papers and results (`exams.js`, 5-year record TTL, deleted with the account). |
| Resend | Address + message for links and codes; to a confirmed parent only, the weekly report (aggregate counts, percentages and chapter names — no answers, ink, photos or the child's name) | US provider (sending domain `mail.prilearning.com`) | `authDelivery.js`, `otpEmail.js` | `PRI_AUTH_EMAIL_PROVIDER` |
```

## After counsel's review

1. Apply the reviewed wording to the four documents above, and to the store forms in App Store Connect and Play Console.
2. Set `PRI_PARENT_REPORT=on` (and `PRI_PARENT_REPORT_EMAILS=on` for the weekly sends) on the deployment, and build the apps with `PRI_FEATURE_PARENT_REPORT=1`.
3. Record the review, the owner's Yes and the date in `docs/release/V1_DECISIONS_2026-11-01.md` (D22).
