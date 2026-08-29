# A2Z claim page — redesigned `/c/a2z`

A drop-in replacement for the page the campaign QR lands on, rebuilt in the app's
own design system ("Dark LaTeX", `client/src/theme.css`) so the poster and the
page are recognisably the same object.

## Files

| File | What it is |
|---|---|
| `page.html.part` | The source. Edit this. `__FONTS__` is the font-injection slot. |
| `build.mjs` | Inlines the KaTeX faces and writes the two outputs below. |
| `claim.html` | The whole page as one static document (generated). |
| `claim-template.mjs` | **The deliverable** — `renderClaimPage()`, ESM (generated). |
| `claim-template.cjs` | Same function for a non-ESM server (generated). |
| `claim-preview.html` | Body-only variant, for publishing as an Artifact (generated). |
| `template.test.mjs` | Contract tests for the render function. `node template.test.mjs`. |

The generated files are committed on purpose: `build.mjs` reads the KaTeX faces
from `client/node_modules/katex`, which a fresh clone does not have, so without
them the page would be unobtainable without an `npm install` first.

## Wiring it in

Two lines, whatever serves the route:

```js
import { renderClaimPage } from './claim-template.mjs';

app.get('/c/:campaign', (req, res) => {
  const { message, expiresAt } = issueVerificationMessage(req);   // your existing logic
  res.type('html').send(renderClaimPage({ verificationMessage: message, expiresAt }));
});
```

`verificationMessage` is required and is the exact text the visitor must send.
`expiresAt` is optional. Both are escaped for the context they land in, so a
message containing `</script>` cannot break out — see `template.test.mjs`.
`dmUrl` and `profileUrl` override the Instagram targets and default to the ones
the current page uses.

If you would rather not import anything, `claim.html` is the same page as a flat
document: paste it into your template string and keep whatever line injects the
message into `#verification-message`.

## Server contract

Unchanged from the page it replaces, so this is a swap and nothing else:

- Inject the verification message as the **text** of `#verification-message`.
- The ids the old page used are all still here: `#verification-message`,
  `#copy-open`, `#copy-status`.
- Footer still links `/privacy`, `/data-deletion`, `/terms`.
- The Instagram DM target is the `DM` constant in the inline script.

**Optional, and worth doing:** set `data-expires-at` on `#verification-message`
to an ISO-8601 timestamp and the countdown becomes exact. Without it the page
counts 24 hours from the first time that code was seen on the device, which is
only right if the server issues a fresh code per page load.

### The window is 24 hours, and both halves have to agree

The page's fallback TTL and its label both say 24 hours. That is a promise the
page cannot keep on its own — **the code's real validity is whatever the Railway
route issues**, and the page has no way to see it. If the server still expires
codes in 15 minutes, a visitor is told they have a day and is refused after a
quarter of an hour, which is worse than the old page: it now says something false.

Two ways to make them agree, in order of preference:

1. **Pass `expiresAt`.** The server already knows the real deadline; hand it over
   and the countdown is exact, whatever the window is. Then the page's TTL never
   runs and the two can never drift.
   ```js
   const { message, expiresAt } = issueVerificationMessage(req);
   res.type('html').send(renderClaimPage({ verificationMessage: message, expiresAt }));
   ```
2. **Move the server's expiry to 24 h** wherever the code is minted — the TTL
   constant, the row's `expires_at`, or the cache entry's ttl, depending on how
   codes are stored. The page then matches by coincidence rather than by wiring,
   so if you take this route, do (1) as well.

Whichever you pick, the counter-side check has to accept a day-old code too: a
tick that appears on the page but fails at the till is the same broken promise
one step later.

## What changed, and why

- **Copy cut from ~150 words to ~46.** The identity-binding explanation was
  written at the user; it is now one sentence behind a "Why Instagram?"
  disclosure. The four-step wall became four words: Send · Follow · Return · Tick.
- **One primary action.** The old page had three buttons of near-equal weight.
  There is now a single cream CTA (cream is the primary action in `theme.css`),
  and it changes to whatever the next step actually is.
- **Fixed a real bug.** The old page copied the code and then navigated to
  Instagram after 250ms *regardless of whether the copy succeeded* — landing
  people in a chat with an empty clipboard, and destroying the status message
  that would have told them. It now only hands off on a confirmed copy, and
  otherwise selects the code and says what to do.
- **Progress survives the round trip.** Tapping the CTA is remembered per code
  in `localStorage`, so coming back from Instagram shows step 1 ticked and
  promotes "Follow" to the primary action. All reads/writes are wrapped — the
  page renders correctly when storage throws or is disabled.
- **Live expiry.** "Valid for 24 hours" is a live countdown that, at zero,
  turns the CTA into "Get a new code".
- **Contrast.** Body-level text moved from `--ink-3` (4.5:1 on `--page`, right at
  the AA line) to `--ink-2` (9.0:1). `--ink-3` is kept for the letterspaced
  small-caps labels.

## Payload

`claim.html` is ~118 KiB, almost all of it the three inlined woff2 faces. To slim
it, delete the `@font-face` blocks and serve the files instead:

```css
@font-face{font-family:'KaTeX_Main';src:url(/fonts/KaTeX_Main-Regular.woff2) format('woff2');font-weight:400;font-display:swap}
```

## Previewing

```
node build.mjs
```

`.claude/launch.json` has a `claim` entry that serves this directory on port 4175
(needed over HTTP rather than `file://` for `localStorage` to work).
