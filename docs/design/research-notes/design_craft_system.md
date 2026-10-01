# Design Craft System for Pri Learning (typography, colour, material, motion, sound/haptics, grid, icons, craft signals)

Scope: craft-level ingredients for an iPad + Apple Pencil, handwriting-first maths app (web too), maths currently rendered via KaTeX, identity "paper notebook x scientific instrument", one teal accent, copper = corrections, indigo dashed = uncertain readings. Research date: 2026-10-02. Research budget was ~17 tool calls; items not verified this session are explicitly flagged as such in Inferences/Gaps.

## 1. Typography for maths + futuristic UI (fonts, licences, KaTeX/MathML 2026, metric matching, Devanagari)

### Takeaway
KaTeX ships its own Computer-Modern-derived fonts (ttf/woff/woff2) and renders math at 1.21x the surrounding text by default, so the cheapest high-impact fix is to tune `.katex { font-size }` to the prose face's x-height rather than swapping the math font. If Pri moves to native MathML Core (Chrome 109+, rendered via OpenType MATH tables), a single OFL OpenType-MATH font (STIX Two Math, Libertinus Math, Lete Sans Math, Fira Math) can be paired with a matching text face; the clean, free, self-hostable UI options are Geist/Geist Mono, Instrument Sans/Serif, Commit Mono, Monaspace and Departure Mono (all SIL OFL 1.1).

### Cited Findings
- KaTeX provides its fonts in ttf, woff and woff2; fonts can be changed by editing `src/styles/fonts.scss`, and Sass variables `$use-ttf`, `$use-woff`, `$use-woff2` let you drop formats (woff2-only is sufficient for modern browsers). — [KaTeX Font docs](https://katex.org/docs/font)
- KaTeX renders math at "1.21x larger font than the surrounding context" by default; override with e.g. `.katex { font-size: 1.1em; }`. The docs do not cover `font-display`. — [KaTeX Font docs](https://katex.org/docs/font)
- MathML Core shipped enabled by default in Chrome 109 (Igalia implementation); it renders per CSS + OpenType MATH table, supports `math-style`, `math-depth`, `math-shift`, `display: math` and `font-family: math`, and is exposed to platform accessibility APIs. — [Igalia: MathML back in Chromium](https://www.igalia.com/2023/01/10/Igalia-Brings-MathML-Back-to-Chromium.html); [Chrome 109 beta](https://developer.chrome.com/blog/chrome-109-beta?hl=es-419); [Frédéric Wang: MathML in Chrome 109](https://frederic-wang.fr//page10)
- STIX Two (released 1 Dec 2016) = STIX2Math.otf plus Text Regular/Italic/Bold/BoldItalic; royalty-free under SIL OFL. — [STIX fonts README (CTAN mirror)](https://mirror.ircam.fr/pub/CTAN/fonts/stix2-otf/README.md); [Overleaf STIX2 intro](https://www.overleaf.com/learn/latex/Articles/OpenType-based_math_typesetting%3A_An_introduction_to_the_STIX2_OpenType_fonts)
- Libertinus Math: SIL OFL 1.1; available via Fontsource for npm self-hosting. — [Wikipedia: Libertinus](https://en.wikipedia.org/wiki/Libertinus); [Fontsource Libertinus Math](https://fontsource.org/fonts/libertinus-math/about)
- Lete Sans Math (Daniel Flipo, a sans OpenType math font): LeteSansMath.otf under SIL OFL 1.1. — [CTAN lete-sans-math](https://ctan.org/tex-archive/fonts/lete-sans-math); [README](https://tug.ctan.org/fonts/lete-sans-math/README.md)
- New Computer Modern: dual licensed GPL3 with font exception and GUST Font License (GFL); includes matching non-Latin alphabets. — [CTAN newcomputermodern](https://www.ctan.org/pkg/newcomputermodern)
- Fira Math is a sans OpenType math font in the Fira family; Garamond-Math is an OTF math font matching EB Garamond. — [CTAN maths fonts topic](https://ctan.org/topic/font-maths); [CTAN Garamond-Math recommendations](https://www.ctan.org/recommendations/garamond-math)
- Geist and Geist Mono (Vercel with Basement Studio) are free/open under SIL OFL; npm package `geist`. — [vercel/geist-font](https://github.com/vercel/geist-font); [vercel.com/font](https://vercel.com/font); [jsDelivr geist package](https://www.jsdelivr.com/package/npm/geist)
- Instrument Sans: variable sans balancing "precision with subtle notes of playfulness", OFL. — [Instrument Sans (RightFont listing)](https://rightfontapp.com/family/instrument+sans)
- Departure Mono (Helena Zhang): pixel-style monospaced, SIL OFL. — [Daring Fireball link](https://daringfireball.net/linked/2024/09/03/departure-mono); [Eryn Wells on Departure Mono](https://erynwells.me/blog/2024/12/departure-mono/)
- Commit Mono: neutral programming typeface, SIL OFL 1.1. — [FreshPorts commit-mono](https://www.freshports.org/x11-fonts/commit-mono)
- Monaspace (GitHub Next): superfamily of five metrics-compatible variable monospace faces (Neon, Argon, Xenon, Radon, Krypton), SIL OFL 1.1. — [CTAN monaspace-otf README](https://tug.ctan.org/fonts/monaspace-otf/README.md); [Arch package](https://www.archlinux.org/packages/extra/any/ttf-monaspace-variable)

### Inferences
- Recommended stack (all self-hostable, open):
  - Prose/UI: Instrument Sans (OFL) or Geist (OFL). Instrument Sans has more "instrument" personality and pairs naturally with Instrument Serif for display headings; Geist is more neutral/technical.
  - Numerals/readouts/telemetry: Geist Mono or Commit Mono with `font-variant-numeric: tabular-nums slashed-zero` for scores, timers, step counters. Departure Mono only for tiny "instrument label" accents (it is pixel art; do not use for body or maths).
  - Maths (KaTeX today): keep KaTeX_Main/KaTeX_Math but set `.katex { font-size: 1.05–1.12em }` empirically so KaTeX x-height matches the UI face; measure by rendering "x" in both and comparing bounding boxes. Ship woff2 only and preload `KaTeX_Main-Regular` and `KaTeX_Math-Italic`.
  - Maths (MathML Core future / native iPad): STIX Two Math + STIX Two Text (serif, closest to textbook convention), or Lete Sans Math / Fira Math if a sans "futuristic" maths voice is wanted. Sans maths is less familiar to students reading exam papers; recommend serif maths as default, sans maths optional.
  - Commercial (not free; avoid unless budget): Söhne (Klim), Neue Haas Unica, ABC Diatype (Dinamo), GT America Mono (Grilli), Berkeley Mono, PP Neue Montreal (Pangram Pangram; free for personal trial only). Not verified this session — licence terms should be checked on foundry sites.
- Devanagari (Hindi): Noto Sans Devanagari / Noto Serif Devanagari (OFL, Google Fonts), Tiro Devanagari Hindi (OFL, Google Fonts), Mukta and Hind (OFL, Google Fonts) are the standard open options; pair Mukta or Noto Sans Devanagari with Instrument Sans/Geist, matching x-height via `size-adjust` in `@font-face`. NOT verified this session.

### Gaps
- Did not verify KaTeX font-swap status in 2026 beyond docs (KaTeX still has no official OpenType-MATH font switching; MathJax 4 supports multiple fonts — unverified).
- Did not verify Fira Math licence directly (believed OFL, from github.com/firamath/firamath — unverified).
- Did not verify Doto, Ndot/Nothing font, JetBrains Mono, Space Mono, Fraunces, Newsreader licences (believed OFL on Google Fonts except Nothing's Ndot, which is proprietary — unverified).
- Safari/WebKit MathML Core conformance state in 2026 not checked.

## 2. Colour: OKLCH/APCA palette construction, mastery ramps, colour-blind-safe states, light/dark parity, P3

### Takeaway
Build every token in OKLCH: hold hue and chroma, step L for ramps, so lightness is perceptually even across teal/copper/indigo; validate text pairs with APCA Lc targets (Lc 75 body, Lc 90 small text, Lc 60 large, Lc 45 non-text) while keeping WCAG 2 AA as the legal floor. Use `@media (color-gamut: p3)` to push chroma on iPad.

### Cited Findings
- OKLCH has perceptual lightness: in HSL "different hues represent different 'real' lightness values", causing accessibility problems; OKLCH keeps L consistent across hues. — [Evil Martians: OKLCH in CSS](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)
- With OKLCH you can "define a formula, choose a few colors, and an entire design system palette is automatically generated." — [Evil Martians](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)
- Syntax `oklch(L C H)`: L 0–1, C typically below 0.37, H 0–360 (red ~20, yellow ~90, green ~140, blue ~220, purple ~320). Example `oklch(0.7 0.1 250)`; raising L to 0.75 keeps the same saturation/hue. — [Evil Martians](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)
- P3 displays show ~30% more colours than sRGB; OKLCH encodes both with the same syntax; wrap P3-only colours in `@media (color-gamut: p3)`. oklch() supported in all latest browsers as of Aug/Sep 2025. — [Evil Martians](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)
- APCA Lc thresholds: body 16px regular Lc 75+; small body 14px Lc 90+; large text 24px+ Lc 60+; non-text UI Lc 45+. Heavier weights lower the requirement. APCA is part of the WCAG 3 draft, not yet a candidate recommendation; WCAG 2 AA remains the legal floor. — [APCA contrast reference (get-design-done)](https://cdn.jsdelivr.net/npm/@hegemonart/get-design-done@1.60.4/reference/contrast-advanced.md); [Myndex apca-introduction](https://github.com/Myndex/apca-introduction)
- Apple's Liquid Glass adoption guide: in controls, use system colours or define custom colours "with light and dark variants, and an increased contrast option for each variant." — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)

### Inferences
- Proposed token set (starting values to be validated with an APCA calculator, not yet measured):
  - Paper (light bg): `oklch(0.975 0.008 85)` (warm off-white); Ink: `oklch(0.24 0.015 250)`.
  - Night paper (dark bg): `oklch(0.18 0.012 250)`; dark ink: `oklch(0.93 0.01 85)`.
  - Teal accent: hue ~190; light mode `oklch(0.55 0.10 190)`, dark mode `oklch(0.72 0.11 190)`; P3 boost `C 0.14` inside `@media (color-gamut: p3)`.
  - Copper correction: hue ~50; `oklch(0.58 0.13 50)` / dark `oklch(0.72 0.12 50)`.
  - Indigo uncertain: hue ~275; `oklch(0.52 0.14 275)` / dark `oklch(0.72 0.12 275)`, always rendered dashed.
  - Mastery ramp: single hue (teal 190) with L from 0.95 → 0.45 in 5 equal steps and C rising 0.02 → 0.11; equal L steps give perceptually even progress; never use a red→green ramp.
- Colour-blind safety: correct/incorrect/uncertain must not rely on hue. Teal vs copper differ in hue AND should differ in L by ≥0.08; add redundant shape coding (tick, copper strike/underline, indigo dashed outline + "?" glyph). Teal/copper (blue-green vs orange) is broadly distinguishable for deutan/protan viewers, unlike red/green — inference, not tested with a simulator.
- Dark-mode parity: keep the same hue and chroma, invert L around ~0.6; reduce chroma slightly in dark mode to avoid vibration.
- "Light as material" without gradient cliché: use a single very low-chroma tonal shift (ΔL 0.01–0.02) between paper and raised surfaces, a 1-device-pixel top highlight line at L+0.04, and grain (section 3) instead of multi-stop colour gradients.

### Gaps
- No colour-blind simulation (Coblis/Sim Daltonism) was run on proposed tokens.
- APCA Lc values for the proposed tokens were not computed this session.
- Display P3 support claims for specific iPad models not verified (all recent iPads are P3 per Apple marketing — unverified).

## 3. Material & depth: Liquid Glass, paper texture, hairlines, elevation

### Takeaway
Apple's own guidance restricts Liquid Glass to the navigation/control layer floating above content, warns against overuse and custom backgrounds on bars, and requires testing with Reduce Transparency/Reduce Motion. For Pri, the worksheet/canvas (content layer) should be matte "paper"; glass only for the floating tool palette and top bar.

### Cited Findings
- Liquid Glass "forms a distinct functional layer for controls and navigation elements" and tab bars/sidebars float in it above content. — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)
- "Don't use Liquid Glass in the content layer" — it creates unnecessary complexity and confusing hierarchy (HIG Materials). — [HIG materials mirror (glama)](https://glama.ai/mcp/servers/@tmaasen/apple-dev-mcp/blob/b82f0efe2115dc4539c83a2374a714a84aeb350a/content/universal/materials.md); [Apple: Liquid Glass overview](https://developer.apple.com/documentation/technologyoverviews/liquid-glass.md)
- "Avoid overusing Liquid Glass effects... Limit these effects to the most important functional elements"; avoid layering Liquid Glass elements on top of each other; reduce custom backgrounds in bars/toolbars (they interfere with the scroll edge effect). — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)
- Test custom elements with accessibility settings that reduce transparency or motion; people can also choose a preferred Liquid Glass look in Settings. — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)
- Use concentric rounded shapes (`ConcentricRectangle`, `rect(corners:isUniform:)`, `UICornerConfiguration`) so nested element radii follow hardware curvature; group custom glass via `GlassEffectContainer` for performance and morphing. — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)
- iPadOS windows resize continuously down to a minimum size (no preset sizes); support arbitrary window sizes; group toolbar items by function, don't mix text and icons within a shared background, label every icon for accessibility. — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)
- `UIDesignRequiresCompatibility` Info.plist key keeps the pre-Liquid-Glass look when building with new SDKs. — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)
- Apple: Liquid Glass is translucent, its colour is informed by surrounding content and adapts between light and dark. — [WWDC25 Meet Liquid Glass notes (Classmethod)](https://dev.classmethod.jp/articles/wwdc25-meet-liquid-glass-liquid-glass/)

### Inferences
- Web equivalent of glass for the tool palette only: `backdrop-filter: blur(20px) saturate(1.4)` over a ~70% opaque paper tint, a 0.5px inner highlight; fall back to opaque surface under `prefers-reduced-transparency: reduce` and `prefers-contrast: more`.
- Paper grain: a tiny tiled SVG `feTurbulence` noise (baseFrequency ~0.8, opacity 0.03–0.05, `mix-blend-mode: multiply` light / `screen` dark) on the canvas only; never on text containers' foreground. Keep it static (no animated grain) to protect battery and reduced-motion users.
- Hairlines on retina: use `0.5px` borders (or `1px / devicePixelRatio`) in a low-contrast ink at ~12–16% opacity; draw ruled notebook lines and graph grids as hairlines aligned to device pixels to look "instrument-precise".
- Elevation without heavy shadows: 3 levels max — (0) paper flat, (1) hairline border + ΔL +0.01, (2) floating palette = glass + one soft shadow (e.g. `0 8px 24px oklch(0 0 0 / 0.08)`). Values are design proposals, not sourced.

### Gaps
- HIG Materials page was read only via a third-party mirror; Apple's own HIG page not fetched directly.
- No published guidance found on paper-grain opacity values; numbers above are craft proposals.

## 4. Motion: springs, durations, interruptibility, feedback motion, View Transitions, reduced motion

### Takeaway
Use springs (duration + bounce mental model) as the default motion primitive: Apple's default is a critically damped spring (response 0.55s, damping 1.0); add small bounce (0.15) only for celebratory/physical moments. Keep UI transitions under 300 ms, animate only transform/opacity, never animate high-frequency actions, and honour reduced motion.

### Cited Findings
- SwiftUI `.default` animation (iOS 17+) = `spring(response: 0.55, dampingFraction: 1.0, blendDuration: 0)`; before iOS 17 it was `easeInOut`. — [Apple: Animation.default](https://developer.apple.com/documentation/swiftui/animation/default.md)
- WWDC23 "Animate with springs": presets `.smooth`, `.snappy`, `.bouncy`; springs parameterised by duration and bounce (range −1.0 to 1.0); examples: no bounce `duration 0.5`, small bounce `duration 0.5, bounce 0.15`, large bounce `duration 0.5, bounce 0.3`; bounce 0 = smooth curve with long tail, >0 overshoots. — [WWDC Notes: Animate with springs](https://wwdcnotes.com/notes/wwdc23/10158); [Apple video](https://developer.apple.com/fr/videos/play/wwdc2023/10158/)
- Material 3 Expressive spring tokens (damping ratio / stiffness): Standard spatial fast 0.9/1400, default 0.9/700, slow 0.9/300; Expressive spatial fast 0.6/800, default 0.8/380, slow 0.8/200; Effects (opacity/colour) fast 1/3800, default 1/1600, slow 1/800 (no bounce on effects). — [material_expressive Flutter package docs](https://pub.dev/documentation/material_expressive/0.8.0/); [motor package](https://pub.dev/packages/motor) (secondary sources reproducing Google tokens)
- Motion (formerly Framer Motion) docs list spring defaults stiffness 1, damping 10, mass 1, bounce 0.25, and tween default duration 0.3s (0.8s with multiple keyframes); default type "dynamic". — [Motion: transitions](https://motion.dev/docs/react-transitions). Note: the stiffness default of 1 conflicts with the widely-cited historical Framer Motion default of stiffness 100 (from memory, unverified) — treat as uncertain and set values explicitly.
- Emil Kowalski: UI animations should usually be shorter than 300 ms; prefer `ease-out` for responsiveness; never animate actions repeated hundreds of times a day (keyboard actions); animate only `transform` and `opacity`; target 60fps; CSS transitions interrupt smoothly mid-animation; use `prefers-reduced-motion: reduce` to substitute simpler animations. — [Emil Kowalski: Great animations](https://emilkowal.ski/ui/great-animations)
- Liquid Glass's fluid morphing animations are modified or removed when users enable reduce-motion settings; test custom animations with these. — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)

### Inferences
- Pri motion token proposal:
  - `motion.ui` (panels, sheets, layout): spring duration 0.35s, bounce 0 (web: Motion `{type:"spring", visualDuration:0.35, bounce:0}`; Android-equivalent ≈ M3 standard spatial default 0.9/700).
  - `motion.feedback.mark` (marking reveal: tick draws in): stroke-dash draw 220–280 ms ease-out, then a 0.15-bounce scale 0.96→1 on the step chip. Copper correction appears with zero bounce (errors should not feel playful).
  - `motion.hint.unlock`: height/opacity reveal, spring 0.4s bounce 0.1; content fades 120 ms after container settles.
  - `motion.effects` (colour/opacity): critically damped, ≤150 ms.
  - Never animate per-stroke ink or per-keystroke events; ink must render with zero added latency.
- Interruptibility: use springs (velocity-preserving) or CSS transitions, not keyframe animations, for anything a student can re-trigger (palette open/close, hint toggle).
- View Transitions API: same-document `document.startViewTransition()` is suitable for question-to-question navigation on web with a 250 ms cross-fade + shared-element morph of the question number; gate behind `prefers-reduced-motion` (falls back to instant swap). Browser support status in 2026 not verified this session.
- Reduced motion: replace movement with ≤100 ms opacity fades; keep marking state changes instantaneous but still visible (colour + glyph).

### Gaps
- View Transitions API support (Safari cross-document, Firefox) in 2026 not verified.
- Exact `.smooth/.snappy/.bouncy` numeric values not retrieved (commonly cited: smooth duration 0.5 bounce 0; snappy bounce ~0.15; bouncy bounce ~0.3 — unverified).
- Motion stiffness default discrepancy unresolved.
- Josh Comeau / Rauno essays not fetched due to budget.

## 5. Sound and haptics

### Takeaway
Apple Pencil Pro supports app-triggered haptics through `UICanvasFeedbackGenerator` (`alignmentOccurred(at:)`, `pathCompleted(at:)`) and SwiftUI `.sensoryFeedback(.alignment / .pathComplete)`; these fit Pri's "snap to grid" and "step recognised" moments. Haptics/sound should be sparse, tied to discrete events, and sound should default off in a classroom product.

### Cited Findings
- `UICanvasFeedbackGenerator` triggers haptics on discrete Pencil-initiated events; `alignmentOccurred(at:)` for snapping to a guide/ruler, `pathCompleted(at:)` for path completion or shape recognition. — [Apple: UICanvasFeedbackGenerator](https://developer.apple.com/documentation/uikit/uicanvasfeedbackgenerator.md); [Apple: Playing haptic feedback in your app (Apple Pencil)](https://developer.apple.com/tutorials/data/documentation/applepencil/playing-haptic-feedback-in-your-app.md)
- SwiftUI equivalent: `sensoryFeedback` modifier with `.alignment` and `.pathComplete`; shown in WWDC24 session 10214. — [WWDC24 10214](https://developer.apple.com/br/videos/play/wwdc2024/10214/)
- Canvas feedback works with Pencil and Magic Keyboard trackpad on iPad, not on iPhone. — [Nutrient: Haptic feedback across iPad and iPhone](https://www.nutrient.io/blog/haptic-feedback-across-ipad-and-iphone/)
- Developer forum discussion exists on Pencil Pro haptic initiation constraints. — [Apple Developer Forums thread 800076](https://developer.apple.com/forums/thread/800076)

### Inferences
- Pri haptic map (Pencil Pro only; no-op elsewhere): `alignment` when a written answer snaps into an answer box / when drawing a straight line snaps to graph grid; `pathComplete` when a handwritten step is recognised and committed. Do NOT fire haptics to signal correct/incorrect — that would leak mark information during writing and conflict with answer-blind handwriting authority; marking feedback should be visual and occur after submission.
- Sound: default OFF; optional "instrument" sound pack of very short (<120 ms), low-amplitude, non-melodic clicks for submit and step-complete; no sound for wrong answers. Respect iOS silent switch (use ambient audio session category).

### Gaps
- Apple HIG "Playing haptics" page and Core Haptics AHAP guidance not fetched.
- No primary sources gathered on Teenage Engineering / Duolingo sound design.
- No evidence gathered on learning effects of sound/haptics for students.

## 6. Grid & layout (iPad size classes, Stage Manager, touch targets, measure, instrument panels)

### Takeaway
iPadOS now resizes windows continuously to a minimum size, so Pri's layout must be fluid (container queries) rather than built for fixed landscape/portrait presets; use split views/sidebars with an inspector column for an "instrument panel" layout.

### Cited Findings
- iPadOS windows "resize fluidly down to a minimum size" instead of preset sizes; support arbitrary window sizes; use split views for fluid column reflow; use layout guides and safe areas. — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)
- Apple recommends sidebar + inspector layouts via `NavigationSplitView` / `.inspector`, and tab bars that adapt into sidebars (`sidebarAdaptable`). — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)
- Lists/forms got larger row height and padding; section headers now title case rather than all caps. — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)

### Inferences
- Grid: 4pt base, 8pt rhythm; type scale proposal (1.2 minor-third from 17pt body, Apple's default body size — unverified this session): 12 / 14 / 17 / 20 / 24 / 29 / 35 / 42. Line-height 1.45 prose, 1.6 for lines containing inline maths.
- Measure: prose 60–70ch; the question stem column 34–40em; display maths centred within the same column; the handwriting canvas full remaining width.
- Instrument panel layout (landscape ≥ ~1000pt): left rail (question list, 72–88pt), centre worksheet column (question + canvas), right inspector (hints, steps, uncertainty readings) collapsible. Portrait/narrow: inspector becomes a bottom sheet. Use CSS container queries on the worksheet, not viewport breakpoints, because of Stage Manager windows.
- Touch targets: ≥44x44pt (Apple HIG standard, not re-verified this session); Pencil-only targets can be smaller visually but keep 44pt hit areas.

### Gaps
- iPad size-class widths and HIG layout/touch-target pages not fetched this session.
- No source gathered on "golden measure" for mathematical text specifically.

## 7. Iconography

### Takeaway
Limited direct research this session; Apple advises standard icons for common actions, accessibility labels on every icon, and not mixing text and icons in grouped toolbar backgrounds.

### Cited Findings
- "Consider representing common actions in toolbars with standard icons instead of text"; "Provide an accessibility label for every icon"; don't mix text and icons across items sharing a background. — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)
- App icons for Liquid Glass: solid filled overlapping semi-transparent shapes in layers; let the system apply masking/blur/highlights; compose in Icon Composer. — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)

### Inferences
- Use SF Symbols on native for system actions (undo/redo/share) so they match Liquid Glass toolbars; on web use one open set (Lucide ISC / Phosphor MIT — licences from memory, unverified) at a single stroke weight matched to the UI font stem (~1.5px at 20px).
- Bespoke set (~12–20 icons) only for Pri-specific concepts, drawn as mathematical glyphs on a 24px grid with 1.5px stroke: ∑ for practice sets, ∫/area for topics, √ for "check", Δ for "what changed", ≈ for "uncertain reading" (paired with the indigo dashed style), ⊢ / ∴ for "solution steps". The repo already has `client/src/components/Icon.jsx` as an entry point.

### Gaps
- No primary sources gathered on how crafted products build bespoke icon sets (e.g. Linear, Things) or on Lucide/Phosphor licence texts.

## 8. Signals that a design is crafted vs AI-generated (checklist)

### Takeaway
No authoritative published checklist was found in this session; the list below is synthesis from the sourced guidance above plus craft heuristics and should be treated as opinion.

### Cited Findings
- Restraint signals in Apple's guidance: limit glass to key functional elements, avoid layering, use concentric radii, use system spacing metrics rather than overrides. — [Apple: Adopting Liquid Glass](https://developer.apple.com/documentation/technologyoverviews/adopting-liquid-glass.md)
- Motion restraint: short (<300 ms), purposeful, not on high-frequency actions, reviewed with fresh eyes. — [Emil Kowalski: Great animations](https://emilkowal.ski/ui/great-animations)
- Perceptually uniform colour via OKLCH rather than ad-hoc HSL. — [Evil Martians](https://evilmartians.com/chronicles/oklch-in-css-why-quit-rgb-hsl)

### Inferences
Crafted signals (aim for these):
- One accent used semantically (teal = action/correct), not decoratively; no purple-to-blue hero gradients.
- Tabular numerals in all changing numbers; numbers don't jitter.
- Concentric corner radii (inner radius = outer radius − padding).
- Optical alignment: maths baselines align with prose baseline; KaTeX size tuned, not left at 1.21em.
- Hairlines on device pixels; consistent single stroke weight across icons.
- Real content in empty states (an actual worked example) rather than generic illustration.
- Motion with physical continuity (springs that preserve velocity on interrupt).
- Domain-specific details: ruled/graph paper grid aligning with the 4pt grid, instrument-style labels (small mono caps-free labels with units).
AI-generic signals (avoid): Inter + rounded-2xl cards + soft drop shadows everywhere; emoji as icons; glassmorphism on content; gradient text; uniform 16px padding regardless of hierarchy; generic "sparkle" AI icons; centred hero with three feature cards; inconsistent icon stroke weights; lorem-style microcopy; red/green-only feedback.

### Gaps
- No empirical research found on user perception of "AI-generated" UI; checklist is heuristic.
