# Edition brands: owner decision record

- **Status:** decided 13 November 2026 (owner, relayed by the CTO session). Two items are still open (below).
- **Implemented by:** plan mission E4 (`client/edition.config.mjs` identity, `client/brand/`, `tools/brand/`).
- **Context:** ADR-0002, one platform with two editions. Pri Learning is the company and the technology, and never the student-facing product name.
- **Design record:** brand board artifact https://claude.ai/artifact/EFEZaocRjzqVPqPkVScZES (private to the owner).

## Decided

1. **Direction A, "Prime", for both editions.**
   - Each wordmark is the edition name in Instrument Sans at weight 600, tracking −0.028em, outlined to paths.
   - The red prime from the approved P′ mark sits beside the P exactly as it does on the mark. At 20 px and below the prime is drawn 1.25× larger.
   - The company line is "by Pri Learning". It appears on sign-in, sign-up, About, the email footer, the store's seller field and marketing footers, and never in the app header bar.
2. **Icon counter cuts.** The approved P′ is unchanged. Each edition adds one filled shape inside the P's counter, in its accent colour:
   - **Priyabhata:** the bow and string (jyā). Āryabhaṭa's *ardha-jyā* is the origin of the word "sine".
   - **Prithagoras:** the right-angle square, the condition of Pythagoras's theorem.
   - In single-colour uses the cut is inset 3 units, so it stays separate from the P.
3. **Accents.**

   | Edition | Accent | Light | Dark |
   |---|---|---|---|
   | Priyabhata | Peacock teal | `#0A6670` | `#6CC3C9` |
   | Prithagoras | Wattle gold | `#7D5A00` | `#E0B44A` |

   - **Contrast:** both pass WCAG AA for normal text on every Instrument surface, in both themes. On `--in-base` the ratios are 6.01 and 8.52 for peacock, and 5.67 and 8.94 for wattle.
   - **Where the accent goes:** the icon cut, the email header rule and marketing links.
   - **Where it never goes:** marks or verdicts, charts, the prime, focus rings, or large fills.
4. **Hindi name:** प्रियभट, with one ट, following आर्यभट. The prime belongs to the Latin P only. Hindi screens keep the Latin wordmark in the header and use प्रियभट in running text.
5. **Aurora is out of scope.** The Aurora skin's violet chrome is unchanged by this decision.

## Open

6. **Pronunciation of "Pri" in Prithagoras.** Should it be "pree-THAG-uh-ruhs", matching Priyabhata ("pree-yuh-BHAH-tuh") and the company, or "pry-THAG-uh-ruhs", which is how Australians will read it by analogy with Pythagoras? Decide before any voice-over or ad.
7. **Trademark clearance.** No exact conflict was found in a web search. That search covered the open web, the App Store, Google Play, ABN Lookup and domains on 13 November 2026. The trademark registers themselves could not be read automatically:
   - IP India (OTP and CAPTCHA)
   - IP Australia (results load only with JavaScript)
   - the WIPO Global Brand Database (CAPTCHA)

   An Indian and an Australian trademark attorney must clear both names in Nice classes 9, 16, 41 and 42 before filing or launch.
   - **Highest legal risk:** Prithagoras against existing "Pythagoras" marks in education.
   - **Reputational risk:** Priyabhata plays on the name of a national figure. Avoid any wording or imagery that implies an official or government link (Emblems and Names Act 1950, Schedule entry 7). This is research, not legal advice.

## Not decided here

- Store names. "Priyabhata: Maths Practice" and "Prithagoras: HSC Maths" are placeholders.
- Domains and email sender addresses.
- Bundle identifiers and native display names (ADR-0002 open question 3).
- Whether `prithagoras-web` adopts this system now.

## Amendment, 14 November 2026: the edition light on the Aurora chrome

Approved by the owner on 13 November 2026 as Lit Instrument D1, D3 and D6 (`docs/design/lit-instrument-decision.md`, PR #UIPR). This section widens the **places** the edition accent may appear, and nothing else; the decision above is otherwise unchanged. Point 5 above ("Aurora is out of scope") is superseded: Aurora's violet is retired.

- **Allowed consumers:** `BrandMark.jsx` (the cut) and `client/src/instrument/aurora.css`, only in the current-place selectors (the current tab's rule, the current bottom-bar and More item, the Continue edge, the selected chapter's number, the selected palette row), the one light pool, and `.pri-working`, the working indicator (D6: "what is live").
- **Still never:** marks, verdicts, readings, charts and plots, the prime, focus rings, text on content surfaces, and solid fills. The pool is a radial wash of at most 10% and is not a fill, and the selected palette row's wash is at most 16%. Focus rings are ink (`--in-tx`) everywhere (D2).
- `client/test/brand-usage-check.mjs` enforces this with a selector allowlist for `aurora.css` and a ban on the token inside any `outline`, `:focus` or `:focus-visible` rule and in any `background` that is not a `color-mix` of 16% or less, the pool's wash, or a 2 px current-place rule.

