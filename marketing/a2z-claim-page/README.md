# A2Z claim page — redesigned `/c/a2z`

A drop-in replacement for the page the campaign QR lands on, rebuilt in the app's
own design system ("Dark LaTeX", `client/src/theme.css`) so the poster and the
page are recognisably the same object.

## Files

| File | What it is |
|---|---|
| `page.html.part` | The source. Edit this. `__FONTS__` is the font-injection slot. |
| `build.mjs` | Inlines the KaTeX faces and writes the two outputs below. |
| `claim.html` | **The deliverable** — a complete document to serve at `GET /c/a2z`. |
| `claim-preview.html` | Body-only variant, for publishing as an Artifact (generated). |

## Server contract

Unchanged from the page it replaces, so this is a template swap and nothing else:

- Inject the verification message as the **text** of `#verification-message`.
- The ids the old page used are all still here: `#verification-message`,
  `#copy-open`, `#copy-status`.
- Footer still links `/privacy`, `/data-deletion`, `/terms`.
- The Instagram DM target is the `DM` constant in the inline script.

**Optional, and worth doing:** set `data-expires-at` on `#verification-message`
to an ISO-8601 timestamp and the countdown becomes exact. Without it the page
counts 15 minutes from the first time that code was seen on the device, which is
only right if the server issues a fresh code per page load.

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
- **Live expiry.** "Valid for about 15 minutes" is now a countdown that, at zero,
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
