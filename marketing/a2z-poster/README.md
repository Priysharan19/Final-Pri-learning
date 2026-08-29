# A2Z × Pri Learning — free-chocolate counter poster

Print and social artwork for the QR campaign that lands on
`/c/a2z`. Set in the app's own design system ("Dark LaTeX",
`client/src/theme.css`) and typeset in the real Computer Modern the app ships —
the KaTeX woff2 faces, read straight from `client/node_modules/katex` at build
time and inlined as data URIs.

## Files

| File | What it is |
|---|---|
| `build.mjs` | Builds the artboards. Edit this, never the `.dc.html` output. |
| `qr-path.txt` | SVG path for the QR, 41×41 modules, ECC level Q. |
| `Main.dc.html` | A4 counter poster, dark. 794×1123 (96 px/in). |
| `Printed.dc.html` | Same poster in the light tokens — **this is the one to print.** |
| `Square.dc.html` | 1080×1080 social crop. |
| `canvas.json` | Artboard layout for the design canvas. |

## The QR

Encodes `https://adequate-motivation-production-9a2f.up.railway.app/c/a2z` in
byte mode at error-correction level Q (25% recovery), version 6 — 41×41 modules.
It was decoded back to the source URL before shipping, and the *rendered* SVG was
rasterised and compared module-by-module against the source matrix: 1681/1681
exact. At the poster's 270px the module pitch is ~1.74mm, which scans from about
a metre.

The cream panel is not decoration. Scanners expect dark modules on a light
ground, and inverted codes fail on a lot of Android readers — so on a near-black
poster the QR needs its own light panel, with the panel's padding acting as the
required 4-module quiet zone.

## Why a light variant

`theme.css` describes its own light mode as "the same paper, printed", which is
also the answer to two print problems: an A4 flood-fill of `#0a0a09` drinks ink,
and without bleed a dark poster shows a white paper edge. On cream both go away.
Print `Printed.dc.html`; keep the dark one for screens.

## Rebuilding

```
node build.mjs
```

Then re-seed the canvas (see the `design` skill for `seed-canvas.mjs`) with all
three artboards plus `canvas.json`, and republish to the same artifact URL.
