# prilearning.com — the public site

Static pages for `prilearning.com`: home, `/support`, `/privacy`, `/terms`,
`/refunds`, `/delete-account`, the same notices in Hindi under `/hi/…`, a `404`.
No framework, no dependencies, no build on the host, no analytics, no third-party
request of any kind, no web fonts. The app itself lives on `app.prilearning.com`
(V1 decision D5); this site never embeds or proxies it.

## How it is made

| Path | What it is |
|---|---|
| `src/pages.mjs` | The site's own copy (home, support, delete-account, Hindi index, 404). |
| `src/layout.mjs` | The shared shell: header, footer, theme button, language link, metadata. |
| `src/markdown.mjs` | A converter for the fixed Markdown subset `docs/legal` uses. |
| `src/config.mjs` | Origins, routes, the two approved prices, the free-plan limits. |
| `src/styles.css`, `src/theme.js`, `src/favicon.svg` | Copied into the output as they are. |
| `build.mjs` | Renders everything into `public/`. Deterministic: same inputs, same bytes. |
| `vercel.json` | Clean URLs, security headers, redirects from the app's legal routes. |
| `public/` | **Generated and committed.** This is what Vercel serves. |

The notices are not copied into this folder. `/privacy`, `/terms`, `/refunds`, the
grievance section of `/support` and the "what is removed" section of
`/delete-account` are rendered straight from `docs/legal/*.md` and
`docs/legal/*.hi.md`, the same files the app renders, so the site cannot say
something different from the app. The Hindi documents keep their own first
paragraph saying the English governs and that no advocate has reviewed either.

Links inside the notices use the app's routes (`/refund-policy`, `/grievance`,
`/account/delete-request`); `src/config.mjs` maps them onto the site's routes and
`vercel.json` redirects the app's routes too, so a URL from a store listing or an
old email still lands somewhere.

## Regenerating

After any change to `docs/legal/*.md` or anything under `site/src`:

```bash
node site/build.mjs        # rewrites site/public
npm run test:site          # self-test, then the contract against site/public
```

CI runs `npm run test:site` (job *Suites policy and contracts*, and in `npm test`):
`tools/site-markdown.test.mjs` (the converter), then `tools/site-check.test.mjs`
(the self-test), then `tools/site-check.mjs` (the contract against `site/public`).
The contract fails when:

- `site/public` differs from a fresh render, or any page carries a `{{PLACEHOLDER}}`;
- a legal article is not, word for word and in order, the `docs/legal` file its
  `data-source` names (or the H2 sections its `data-sections` lists) — the
  source and the page are reduced to words independently of the converter, and
  a numbered list's ordinals count as words, so a lost line, a swallowed
  number, a changed word or an added sentence all fail at the first word where
  the two part;
- a home-page or support sentence that paraphrases a notice no longer has its
  basis in the notice (`NOTICE_PREMISES` in `tools/site-check.mjs`): "on for a
  signed-in account" needs `privacy.md` to say "on by default", "after you
  agree" is refused while it does, the stroke-image guarantee may not be
  stretched over photographs, "keeps no copy", "48 hours" and "30 days", the
  Data Protection Board and "no standing outside it" each need their sentence,
  "working days" is refused while `grievance.md` gives 48 hours and 30 days,
  and the deletion and support pages may not offer a phone or SMS route while
  `privacy.md` says no sign-in by SMS is offered (D3);
- a `https://prilearning.com/…` URL in the App Store or Play drafts
  (`docs/release/store/*.md`, `app-store-privacy-labels.md`,
  `play-data-safety.md`) is not a page this site publishes, so a renamed route
  fails here before a store reviewer meets a 404;
- the site's own copy uses a banned phrase, states final-answer-only marking
  before the D12 server switch exists on `main`, or gives a price other than
  `₹199` / `₹1,499` in any spelling (`₹`, `Rs`, `INR`, `rupees`);
- a required sentence is missing, any internal link or fragment is broken, an
  hreflang pair is not returned by the other page, a link leaves for a host not
  in `ALLOWED_EXTERNAL_LINKS` (the app, and Apple's refund page that the refund
  policy names), anything loads from another origin, or a page carries an
  inline `style` (the CSP would drop it);
- `vercel.json` stops being a plain static deployment.

`tools/site-check.test.mjs` plants each of those regressions in memory and proves
the check catches it; `tools/site-markdown.test.mjs` pins the converter's subset
and the CommonMark rule that only a bullet or `1.` may interrupt a paragraph, so a
line beginning `2023. The Act applies.` keeps its number as text.

The banned list applies to the site's own words. The bodies of the notices are
owned by `docs/legal` and `client/test/legal-pages-check.mjs`; they are rendered
inside `<article data-source="docs/legal/…">` and excluded from the word scan
(they legitimately say "offline" and "percentile" in negations) — but the
fidelity rule above requires them to be exactly their source, so nothing else
can be placed inside one.

## Headers

`vercel.json` sends a locked Content-Security-Policy (`default-src 'none'`,
`style-src 'self'`, `script-src 'self'`, no `connect-src`), which is why no page
may carry an inline style or script, plus `Referrer-Policy: no-referrer`,
`X-Frame-Options: DENY` and `Strict-Transport-Security: max-age=31536000;
includeSubDomains`. **`includeSubDomains` is a cross-host decision**: once a
browser has seen it on `prilearning.com`, it will refuse plain HTTP to
`app.prilearning.com` and every other subdomain for a year. That is intended —
the app host serves HTTPS only (D5) and nothing under this domain should ever be
plain HTTP — but if any subdomain must ever be reachable over HTTP, remove
`includeSubDomains` before DNS points here. There is no `preload`, so the
decision stays reversible within `max-age`.

## Previewing locally

Any static server with directory indexes works, for example:

```bash
cd site/public && python3 -m http.server 4876
```

Then open `http://127.0.0.1:4876/privacy/` (a bare server needs the trailing
slash; Vercel's `cleanUrls` serves `/privacy`). Light and dark follow the system
setting; the header button overrides it for this browser only, in `localStorage`.

## Deploying to Vercel

Do this once, as a **separate Vercel project** from the app. Nothing in this
folder reads an environment variable, so the project needs no secrets.

1. Vercel dashboard → *Add New… → Project* → import the `Priysharan19/Final-Pri-learning`
   repository (it is already connected to the account).
2. **Root Directory:** `site`. Leave *Include source files outside of the Root
   Directory* at its default; nothing is built, so it does not matter.
3. **Framework Preset:** *Other*. **Build Command:** leave empty (override on,
   value empty). **Output Directory:** `public`. **Install Command:** leave empty
   (override on, value empty). `site/vercel.json` carries the same settings,
   so the dashboard values only need to not contradict it.
4. **Production Branch:** `main`. Every merge to `main` that touches `site/`
   redeploys; preview deployments are made for pull requests.
5. Deploy. Check the preview URL serves `/`, `/support`, `/privacy`, `/terms`,
   `/refunds`, `/delete-account`, `/hi/privacy`, that `/refund-policy` redirects
   to `/refunds`, and that `/does-not-exist` returns the 404 page.
6. **Domains:** add `prilearning.com` and `www.prilearning.com` to this project,
   with `www` redirecting to the apex. Vercel shows the DNS records to set at the
   registrar: an `A` record for the apex (`76.76.21.21`) and a `CNAME` for `www`
   (`cname.vercel-dns.com`); use whatever the dashboard shows at the time, not
   these notes. Do not point `app.prilearning.com` here: that record belongs to
   the app's host (Railway), per D5.
7. After DNS resolves, confirm `https://prilearning.com/privacy` returns 200 with
   a valid certificate (audit-commercial item 18's done-when), then fill
   `<PRI_PUBLIC_ORIGIN>` in `docs/release/store/*.md` with `https://prilearning.com`
   for the privacy, terms and support URLs.

Equivalent CLI, from the repository root, if the dashboard is not to hand:

```bash
vercel link --cwd site                 # choose "create a new project", name it prilearning-site
vercel --cwd site --prod               # deploys site/public as-is
vercel domains add prilearning.com     # then set the DNS records it prints
```

## What is deliberately not here

- No download badges, store links, sign-up form, waitlist or email capture. The
  site says the app is coming soon until it is on sale.
- No screenshots. The maths on the home page is typeset with MathML and labelled
  as an illustration; real product screenshots replace nothing here, they go in
  the store listings.
- No claims beyond the approved wording: coverage is stated as "CBSE / NCERT
  Classes 7 to 12, JEE Main and JEE Advanced. 77 chapters", with the Class 8
  and Class 9 labels, marking "can be wrong", and "not endorsed by NCERT, CBSE
  or NTA". `tools/site-check.mjs` enforces the list.
- No Hindi home page. The Hindi pages are the notices and support, which have a
  Hindi source; marketing copy in Hindi would be unreviewed (D11).
