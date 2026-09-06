# Legal pages

These four documents are **templates**, not legal advice, and the app renders
them with a banner saying so. Every `{{PLACEHOLDER}}` must be completed, and the
whole set reviewed by a lawyer qualified in Indian law, before the banner is
removed and the app is offered to the public.

| File | Route | Required by |
|---|---|---|
| `privacy.md` | `/privacy` | Apple App Store, Google Play, Razorpay onboarding, and India's Digital Personal Data Protection Act 2023 |
| `terms.md` | `/terms` | Apple App Store, Razorpay onboarding |
| `refund-policy.md` | `/refund-policy` | Razorpay onboarding; Apple handles its own refunds |
| `grievance.md` | `/grievance` | The DPDP Act's requirement to publish a grievance contact |

## Completing them

Fill in every placeholder:

```
{{OWNER_LEGAL_NAME}}       the entity that will hold the data and take the money
{{OWNER_ADDRESS}}          its registered address
{{GRIEVANCE_OFFICER_NAME}} a named person
{{GRIEVANCE_OFFICER_EMAIL}} a monitored mailbox
{{SUPPORT_EMAIL}}          where a customer writes about their subscription
{{PUBLIC_ORIGIN}}          e.g. https://learn.example.com
```

`node tools/legal-status.mjs` lists which placeholders are still unfilled, and
`client/test/legal-pages-check.mjs` fails if a page is missing, if a route does
not render one, or if the "not yet reviewed" banner has been removed while
placeholders remain.

## What the code does, which the text must match

The privacy notice describes real behaviour, and these are the facts it rests
on. If the code changes, the notice is wrong until it is changed too.

- The learning engine runs on the device. Questions, handwriting recognition and
  marking need no network.
- A cloud account is optional. Without one, nothing leaves the device except
  files the person exports themselves.
- With an account, what syncs is listed in `client/src/platform/syncContract.js`.
- Handwriting strokes are not uploaded by the shipped app.
- Telemetry is allow-listed and retained for 90 days
  (`server/platform/telemetry.js`).
- Password-protected profiles are encrypted at rest on the device; profiles
  without a password are not. Both limits are documented in
  `client/src/local/idb.js` and `client/src/local/auth.js`.
