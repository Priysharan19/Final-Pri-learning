# Five-feature carousel — Instagram

One all-in-one 4:5 slide, plus a seven-slide carousel, covering what the app does: handwriting read by Pri's
server, automatic marking of the final answer by Pri's engine, three tracks from boards to JEE Advanced,
Classes 7–12 (77 chapters), and generated practice. Copy revised 2 November 2026 under owner decision D24;
`client/test/marketing-claims-check.mjs` holds and enforces the retired phrases.

| File | What it is |
|---|---|
| `build.mjs` | Builds the slides. **Edit this, never the generated HTML.** |
| `render.mjs` | Shoots `out/*.png` at 2160×2700 with the client's Playwright Chromium. |
| `slides/00-all-in-one.html` | Generated — **the single-image version**: all five features on one slide. |
| `slides/*.html` | Generated — one file per carousel slide, 1080×1350. |
| `preview.html` | Generated — all seven at 40% to check the set as a set. |
| `POST.md` | Caption, hashtags, alt text, upload spec and the claims checklist. |
| `out/` | Rendered PNGs (git-ignored — rebuild them). |

```bash
node build.mjs && node render.mjs
```

Type is the real Computer Modern the app ships (KaTeX woff2 faces read from
`client/node_modules/katex` and inlined as data URIs), so a slide renders with no network.
Colours come from `client/src/theme.css` v4 "Dark LaTeX", same as the reel and the A2Z
poster. The student's ink uses whatever script face the render machine has — Caveat is the
reel's hand but lives on a font host, so locally `Bradley Hand` is what lands.

The only figure on a slide is the chapter count, which is `IN_CURRICULUM`'s. Do not put a
number on a slide that CI does not measure, and never an accuracy figure.
