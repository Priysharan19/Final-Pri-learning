# Five-feature carousel — Instagram

Seven 4:5 slides covering what the app does: on-device handwriting recognition,
examiner-style marking, boards → JEE Advanced, Class 7–12, and the unlimited bank.

| File | What it is |
|---|---|
| `build.mjs` | Builds the slides. **Edit this, never the generated HTML.** |
| `render.mjs` | Shoots `out/*.png` at 2160×2700 with the client's Playwright Chromium. |
| `slides/*.html` | Generated — one file per slide, 1080×1350. |
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

Every figure on a slide is a measured one and carries its command in `POST.md`. Do not put
a number on a slide that README's "Measured accuracy" block does not carry.
