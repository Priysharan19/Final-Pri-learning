# Futuristic-yet-crafted product interfaces: reference catalogue for the Pri Learning redesign

Scope note: research was capped at ~18 tool calls. Primary sources were fetched for Apple Liquid Glass (WWDC25 "Meet Liquid Glass"), Linear, Rauno Freiberg, Emil Kowalski, Benji Taylor / Family, the Nothing and Teenage Engineering design analyses, Territory Studio and the "vibe-coded UI" critique. Several requested references (Daylight, Rabbit r1, Humane, Arc/Dia, Raycast, Things 3, Vercel Geist, iA Writer, Bear, Craft, Readwise Reader, Notion Calendar, Rewind, Lusion, Active Theory, Bruno Simon, Awwwards SOTY, Stripe Press, Destiny/Hades/Death Stranding/Outer Wilds HUDs, oscilloscope/HP calculator metaphors) were NOT verified in this pass. Anything said about them appears only under "Inferences" and is marked as unverified background knowledge, or under "Gaps".

---

## Q1. Which specific techniques make each reference feel futuristic?

### Takeaway
The admired "futuristic" references don't get the feeling from effects. They get it from three things: (1) a **constrained material or medium** (dot-matrix, 1-bit, monochrome, one kind of glass); (2) **light and depth that carry information**, such as glass that only marks the control layer or shadows that change to keep text readable; (3) **motion that follows physics and tells you where things are**: it can be interrupted, it keeps momentum, and its direction is consistent. Typography, usually a display/utility/mono trio, does most of the hierarchy work instead of colour.

### Cited Findings

**Apple Liquid Glass (iOS/iPadOS 26), from WWDC25 "Meet Liquid Glass"**
- Liquid Glass uses real-time "dynamic lensing" to bend and concentrate light. That gives visual separation without fading, and lets elements materialise or dematerialise by changing how much they bend light — [Apple WWDC25 Meet Liquid Glass](https://developer.apple.com/videos/play/wwdc2025/219/)
- Specular highlights respond to geometry and sometimes to device motion. When you touch it, the material "illuminates from within" and the glow spreads onto nearby glass elements — [Apple WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/)
- Adaptive shadows get stronger over text and weaker over light solid backgrounds. Bigger elements get deeper shadows so they read as thicker material — [Apple WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/)
- Two variants, never mixed. **Regular** is adaptive and is the default. **Clear** is permanently more transparent and is only for use over media-rich content with a dimming layer and bold, bright foreground content — [Apple WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/)
- Glass belongs only on the **floating navigation/control layer** (nav bars, tab bars, menus, sidebars). Never put it on the content layer (lists, table views, images). Avoid glass-on-glass; elements on top of glass use fills or vibrancy instead — [Apple WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/)
- Tint selectively, only for the primary action. Tinting everything means nothing stands out; colour should live in the content layer — [Apple WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/)
- Small glass elements flip light/dark depending on what is behind them. Large ones (menus, sidebars) do not flip because that would be distracting. Scroll-edge effects dissolve content under the glass, or switch to dimming over dark content — [Apple WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/)
- Accessibility settings are handled automatically: Reduce Transparency makes the glass frostier; Increase Contrast turns elements mostly black/white with a contrasting border; Reduce Motion lowers effect intensity and turns off elasticity — [Apple WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/)

**Nothing (Phone / Nothing OS)**
- Ndot is a custom dot-matrix display font with every glyph built from circular dots "like a transit departure board". It forms the brand logo — [shadcn.io Nothing DESIGN.md analysis](https://www.shadcn.io/design/nothing); [Nothing Community: Ndot57](https://nothing.community/de/d/104-ndot57-the-nothing-typeface)
- Nothing's web system pairs three fonts. **Ndot** for product names (20–40px), **NType82** at weight 100 for editorial headlines (24–32px), and **Lettera Mono LL** in uppercase for labels, buttons and CTAs (11–14px) — [shadcn.io Nothing analysis](https://www.shadcn.io/design/nothing)
- Palette: pure black #000000, pure white #ffffff, mid-grey #585a5a for secondary text, light grey #e5e7eb for hairlines. Radius 6px for interactive surfaces and 8px for containers; the system avoids pill buttons — [shadcn.io Nothing analysis](https://www.shadcn.io/design/nothing). Caveat: that analysis covers Nothing's marketing website, which it says has "no accent". Nothing OS itself is generally known to use a red accent; that was not verified here.
- In Nothing OS 4.0 the dot-matrix is used "more intentionally, where it can define character rather than compromise readability". In other words, they pulled it back from body text — [nothing.community OS evolution thread](https://nothing.community/d/61774-nothing-os-evolution); [shadcn.io](https://www.shadcn.io/design/nothing)

**Teenage Engineering (OP-1, EP-133)**
- On the OP-1 OLED, wordy parameters and menus are replaced by "imaginative scenes and interactive imagery". Four colour-coded rotary encoders map to on-screen parameters, so screen colour equals hardware knob colour — [CDM](https://cdm.link/teenage-engineerings-op-1-instrument-hands-on-videos-why-its-different/); [Equipboard](https://equipboard.com/posts/the-teenage-engineering-op-1-a-modern-classic)
- EP-133 screen iconography and colour give a "vintage arcade feeling" — [desirabilitylab](https://desirabilitylab.com/backfill/backfill-2023-372-teenage-engineering-op-1)
- TE's marketing site uses two proprietary bitmap fonts (te-20, te-40) at weights 100–300, fine grid lines, and monochrome chrome. Product photography supplies every accent colour — [shadcn.io TE analysis (via search snippet)](https://www.shadcn.io/design/teenage-engineering/raw); [Blake Crosley: TE, constraints as aesthetic](https://blakecrosley.com/de/guides/design/teenage-engineering)

**Playdate (Panic)**
- 1-bit Sharp Memory LCD with no greys and no backlight. Its very small pixel pitch makes it look like newsprint. Tone comes from dithering, so type and images gain halftone texture — [Playdate: Designing for Playdate](https://help.play.date/developer/designing-for-playdate/); [Clip Content](https://clipcontent.substack.com/p/the-playful-design-details-of-the?open=false)
- Panic's guidance is that fonts drawn at 2x still need legibility as the primary concern with very few pixels — [Playdate dev docs](https://help.play.date/developer/designing-for-playdate/)

**Linear**
- The 2024 redesign generated themes in **LCH** (perceptually uniform) rather than HSL. It went from 98 variables per theme to three inputs (base, accent, contrast), and the contrast input produces high-contrast themes automatically — [Linear: How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui)
- **Inter Display** for headings "to add more expression"; regular Inter for body. They deliberately limited how much the brand-blue chrome feeds into colour calculations, for "a more neutral and timeless appearance" — [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)
- They put a lot of work into pixel alignment of labels, icons and buttons, described as subtle but noticeable over long use — [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)
- A later refresh, "a calmer interface for a product in motion", dimmed the sidebar, compacted tabs, cut back icons and softened borders/separators. Not every element should carry equal visual weight — [Linear: Behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh)
- Linear also published "A Linear spin on Liquid Glass" — [Plushcap summary](https://www.plushcap.com/content/linear/blog/linear-a-linear-spin-on-liquid-glass) (not fetched; contents unverified)

**Rauno Freiberg: "Invisible Details of Interaction Design"**
- Interactions should copy real-world properties such as interruptibility. Swiping horizontally is like turning pages; pinching is like grabbing — [rauno.me](https://rauno.me/craft/interaction-design)
- Kinetic physics: thrown gestures keep their momentum and angle. Dynamic Island dismissal bounces instead of snapping — [rauno.me](https://rauno.me/craft/interaction-design)
- Responsive gestures: the object should follow the finger in real time (pinch scales the card live) rather than waiting for a threshold before animating — [rauno.me](https://rauno.me/craft/interaction-design)
- Spatial consistency: the direction of an animation tells you where something lives. Lightweight actions can trigger mid-gesture; destructive actions need the gesture to complete — [rauno.me](https://rauno.me/craft/interaction-design)
- Frequency vs novelty: high-frequency interactions (command menus, context menus) should not animate. Save motion for novel or tactile moments — [rauno.me](https://rauno.me/craft/interaction-design)
- Touch visibility: loupes and enlarged keys show content the finger covers. Implicit input (e.g. Wallet brightening the screen for scanning) anticipates what the user needs — [rauno.me](https://rauno.me/craft/interaction-design)

**Emil Kowalski (Sonner/Vaul author): "Great animations"**
- UI animations should usually be **under 300ms** with **ease-out**, because a fast start reads as a quick response. Use springs for natural motion — [emilkowal.ski](https://emilkowal.ski/ui/great-animations)
- Don't animate keyboard-initiated actions that people repeat "hundreds of times a day". He cites Raycast's no-animation feel as right — [emilkowal.ski](https://emilkowal.ski/ui/great-animations)
- Animate only `transform`/`opacity` at 60fps; animations must be interruptible; respect `prefers-reduced-motion`; motion should "enrich the information on the page" — [emilkowal.ski](https://emilkowal.ski/ui/great-animations)

**Family wallet (Benji Taylor, "Family Values")**
- Principle chain: "You cannot have Delight without Fluidity, and you cannot have Fluidity without Simplicity" — [skills.sh summary of benji.org/family-values](https://skills.sh/cristicretu/family-taste-skill/design-with-taste); [benji.org](https://benji.org/family-values)
- **Dynamic trays**: overlay sheets whose height changes between steps. Each holds one piece of content or one primary action, and they overlay the current view rather than replacing it, so context is kept — [benji.org/family-values](https://benji.org/family-values)
- **Text morphing**: a button label animates "Continue" into "Confirm" by reusing shared letters, which draws attention to a significant step — [benji.org](https://benji.org/family-values)
- **Shared-element transitions**: cards and buttons glide between screens instead of being duplicated. **Directional motion**: tapping a tab on the left makes the transition move left — [benji.org](https://benji.org/family-values)
- **Delight–impact curve**: the less often a feature is used, the more delight it gets (confetti on finishing a backup, sound when trashing). Frequent features get only subtle touches — [benji.org](https://benji.org/family-values)

**Sci-fi film UI (Territory Studio)**
- Territory keeps the "fluff effect" to a minimum and avoids random numbers in backgrounds, so designs stay as "real" as possible — [Pushing Pixels interview, David Sheldon-Hicks](https://www.pushing-pixels.org/2014/08/07/the-craft-of-screen-graphics-and-movie-user-interfaces-interview-with-david-sheldon-hicks-of-territory-studio.html)
- For each film they define a world and a UI language that sets what the technology can and cannot do. Near-future briefs are grounded in military and scientific references with "clean minimal aesthetics" — [Pushing Pixels](https://www.pushing-pixels.org/?p=9769)
- For *The Martian* they reorganised around 100 Mission Control screens so they guide attention rather than dump engineering data. Their schematic/3D work fed into GM/Cadillac LYRIQ in-car displays (3D diagnostics instead of binary warning icons) — [Built In: Sci-fi UI](https://builtin.com/design-ux/sci-fi-ui)

**Games**
- *Mini Metro* (GDC 2017, "When Less Is More", Jamie Churchman): its design language borrows from metro maps and achieves "beauty through elimination". It uses consistent contrast-coloured shapes for station types and pushes peripheral info to the edges, lines on the right and resources on the left — [GDC Vault](https://gdcvault.com/play/1024250/-Mini-Metro-When-Less); [Mechanics of Magic](https://mechanicsofmagic.com/2023/04/22/visual-design-of-games-mini-metro/)
- *Monument Valley* (GDC, "Designing Monument Valley: Less"; Ken Wong): Escher-derived; every screen is a piece of art, with a limited palette and generous white space — [GDC Vault](https://www.gdcvault.com/play/1021380/Designing-Monument-Valley-Less)

### Inferences
- Across Nothing, TE and Playdate, the futuristic feeling comes from an **honest, constrained display medium** (dot-matrix, bitmap, 1-bit dither) used for *identity and numerals*, with a readable face for everything else. For Pri, that suggests a dot-matrix or mono numeral face for scores, timers and question numbers only, never for the maths prompt or explanations.
- Apple, Rauno, Emil and Benji all point the same way: a "futuristic" feel comes from **motion that is physically plausible and spatially honest**, not from glow.
- Unverified background knowledge (no source fetched in this pass; verify before relying on it): Vercel's Geist Sans/Geist Mono; Dynamic Island as a "living" status capsule that morphs shape; Things 3's "Magic Plus" drag button; iA Writer's custom Duo/Quattro fonts and focus mode; Daylight Computer's "Live Paper" monochrome 60fps reflective display with amber-only backlight; the Rabbit r1 orange body + scroll wheel by TE; Humane's laser projection (widely seen as a failure); Destiny's diegetic ghost UI; Death Stranding's chiral/strand UI; Outer Wilds' ship log built as a node graph. Swiss railway clock (Hans Hilfiker, red "lollipop" second hand that pauses at :00) and HP/TI calculator LCD segment numerals are well-known instrument references, but no source was fetched for them here.

### Gaps
- No primary sources fetched for: Arc/Dia, Raycast, Things 3, Vercel Geist, Paco Coursey, Daylight, Rewind/Limitless, Notion Calendar, Readwise Reader, Craft, Bear, iA Writer, Rabbit r1, Humane, Braun/Rams, Apple Pencil Pro UI (squeeze palette, barrel-roll), visionOS HIG, Dynamic Island HIG, GMUNK/Perception (Oblivion, Blade Runner 2049, The Expanse), Lusion, Active Theory, Bruno Simon, Awwwards SOTY 2024–2026, Stripe Sessions/Press, Fonts In Use trends, Alto's Odyssey, Destiny, Hades, Death Stranding, Outer Wilds, oscilloscope/flight-deck/slide-rule metaphors.
- Apple's Liquid Glass technology-overview page returned no body text, so only the WWDC session was used.

---

## Q2. How do they keep it calm and readable?

### Takeaway
Calm comes from **restraint about who gets emphasis**. One accent (or none). Glass and effects only on the control layer. Hierarchy built from type and weight instead of colour. Motion skipped for frequent actions. And every expressive face (dot-matrix, display, glass) is kept off long-form reading text.

### Cited Findings
- Apple: glass is only for the navigation layer, there is no glass-on-glass, and tinting is limited to primary actions. Shadows and light/dark flipping adapt for legibility, and large surfaces deliberately don't flip — [Apple WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/)
- Linear: dimmed sidebar, fewer icons, softer separators, "not every element should carry equal visual weight", restricted brand-blue — [Linear refresh](https://linear.app/now/behind-the-latest-design-refresh); [Linear 2024](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Nothing: hierarchy "through typeface differentiation and scale alone, not color", and dot-matrix limited to where it "can define character rather than compromise readability" — [shadcn.io](https://www.shadcn.io/design/nothing); [nothing.community](https://nothing.community/d/61774-nothing-os-evolution)
- Emil and Rauno: no animation for repeated or keyboard actions; motion is reserved for novel moments — [emilkowal.ski](https://emilkowal.ski/ui/great-animations); [rauno.me](https://rauno.me/craft/interaction-design)
- Family: progressive disclosure, "seeing parts of a room through an open doorway", with one primary action per tray — [benji.org](https://benji.org/family-values)
- Mini Metro: peripheral info pushed to the screen edges and grouped — [Mechanics of Magic](https://mechanicsofmagic.com/2023/04/22/visual-design-of-games-mini-metro/)
- Territory: avoid "fluff" and random numbers. For film, the hierarchy is designed to guide attention — [Pushing Pixels](https://www.pushing-pixels.org/?p=9769); [Built In](https://builtin.com/design-ux/sci-fi-ui)

### Inferences
- For a maths app, the "content layer" is the problem and the student's ink. It should sit on a quiet, opaque, paper-like surface. Any futuristic material (glass, dot-matrix HUD) belongs only to the chrome around it: toolbar, timer, progress, mark readout.
- Linear's three-input LCH theme (base, accent, contrast) fits Pri's existing theme files well, and gives a high-contrast mode almost for free.

### Gaps
- No sourced evidence was found on calm-UI effects for teenage learners specifically.

---

## Q3. What has aged badly or reads as cliché? Including "what makes an interface look AI-generated / vibe-coded in 2025–2026" and "signals of human craft"

### Takeaway
Liquid Glass shows that even Apple's version of light-as-material drew a legibility backlash. Apple added a "Tinted" option in iOS 26.1. The "vibe-coded" look is a recognisable genre built from statistically common defaults: purple-indigo gradients, glow/aurora dark mode, Inter/system fonts, emoji as icons, cards in cards, meaningless status dots, multicolour accent bars. Craft shows up as specific constraints, a coherent motion grammar, pixel alignment, and type-led hierarchy.

### Cited Findings

**Liquid Glass backlash**
- Critics said it added visual noise, hurt outdoor readability and caused "cognitive drag". Ars Technica: it "adds zero information while adding constant motion" — [Gulf News](https://gulfnews.com/technology/companies/apple-yields-tinted-control-in-ios-261-beta-4-tones-down-liquid-glass-after-backlash-1.500315176); [WebDesignerDepot](https://webdesignerdepot.com/how-liquid-design-broke-the-iphone-and-forced-apples-great-reset/)
- Low contrast fails low-vision users, and text over text was singled out — [Infinum](https://infinum.com/blog/apples-ios-26-liquid-glass-sleek-shiny-and-questionably-accessible/)
- Designers interviewed by Wired worried the effects pull attention from content and that small teams would struggle with the complexity — [WebDesignerDepot summary](https://webdesignerdepot.com/how-liquid-design-broke-the-iphone-and-forced-apples-great-reset/)
- Apple added a "Tinted" control in iOS 26.1 beta 4 that tones down the gloss for a flatter, calmer surface — [Gulf News](https://gulfnews.com/technology/companies/apple-yields-tinted-control-in-ios-261-beta-4-tones-down-liquid-glass-after-backlash-1.500315176)

**Vibe-coded / AI-generated tells**
- Seven signs listed by The Fountain Institute. (1) Neon palettes with competing saturated colours. (2) Dark mode with decorative glow or aurora blooms. (3) Emojis as icons, headers and bullets. (4) Purple-to-indigo gradients. (5) Cards within cards, 3–4 levels deep. (6) Multicoloured left accent bars on every block. (7) Status dots that don't map to real states — [Fountain Institute](https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui)
- Their fixes: one dominant colour, one accent and one neutral; build depth through type, contrast and surface levels rather than glow; use a consistent icon system; group with whitespace and proximity; treat colour as a shared resource; map every status dot to a defined state — [Fountain Institute](https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui)
- Common descriptions of generic AI aesthetics: overused fonts (Inter, Roboto, Arial, system), purple gradients on white, predictable layouts. These are "statistical artifacts from the model's training data, the visual equivalent of autocomplete". Glow/aurora dark mode "feels like a genre rather than a design choice" — [search summary of Fountain Institute and agent-skill frontend-design guidance](https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui)
- "That generic purple gradient, the pills and badges, emojis everywhere ... no hierarchy, no breathing room" — [vp0.com](https://vp0.com/blogs/vibe-coding-app-ui-components)

**Signals of human craft (sourced)**
- A specific constraint system chosen on purpose: Nothing's three-face pairing and monochrome; TE's bitmap fonts and grid lines; Playdate's 1-bit dither — [shadcn.io Nothing](https://www.shadcn.io/design/nothing); [Blake Crosley TE](https://blakecrosley.com/de/guides/design/teenage-engineering); [Playdate](https://help.play.date/developer/designing-for-playdate/)
- Perceptual colour systems (LCH) and obsessive alignment work — [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)
- A motion grammar: directional transitions, shared elements, text morphing, a delight budget that scales inversely with frequency — [benji.org](https://benji.org/family-values); [rauno.me](https://rauno.me/craft/interaction-design)
- Interruptible, sub-300ms, transform-only animation with reduced-motion support — [emilkowal.ski](https://emilkowal.ski/ui/great-animations)
- Real data instead of filler. Territory avoids random numbers even in film — [Pushing Pixels](https://www.pushing-pixels.org/?p=9769)

### Inferences
- Other tells worth adding to the AI-look list, from general design-community discourse and not individually sourced here: shadcn/ui default zinc palette with `rounded-xl` cards and soft `shadow-sm`; bento grids used by default; Lucide icons at default stroke everywhere; "sparkle" ✨ icons for AI features; gradient text on headlines; uniform 16–24px padding everywhere with no rhythm; generic 3D blob or isometric illustrations; glassmorphism on content cards rather than chrome; centred hero + three feature cards. Treat these as hypotheses for the report writer, not cited facts.
- Since Liquid Glass is Apple's own glass and drew a public legibility backlash, a learning app should treat translucency as a small, chrome-only accent with an opaque fallback. Never put it behind maths text or handwriting.
- Dot-matrix and mono-numeral looks risk becoming the *next* cliché now that "Nothing-style" analyses circulate as copyable design-system files (e.g. shadcn.io's DESIGN.md pages). Pri should derive its constraint from its own domain (graph paper, compass/protractor, Indian exam answer-sheet margins, calculator LCD) rather than copy Nothing's.

### Gaps
- No sourced HN/X critique threads on Linear-clone aesthetics ("Linear look" fatigue) were fetched.
- No sourced Fonts In Use / Typewolf 2025–2026 trend data (e.g. mono/grotesk pairings, variable fonts).

---

## Q4. The 15 most transferable techniques for a learning app (Pri Learning: maths, iPad + web, ages 12–16, India)

### Takeaway
Use a constrained, domain-specific visual language. Keep effects in the chrome and make the content layer opaque. Use physics-honest motion with a delight budget. Let type lead the hierarchy. Each item below is anchored to a cited source above; the Pri application is inference.

### Cited Findings (anchors)
1. **Two layers: opaque paper content, light chrome on top.** Translucency only on the floating toolbar/timer, never on the problem or ink canvas; no glass-on-glass — [Apple WWDC25](https://developer.apple.com/videos/play/wwdc2025/219/)
2. **One accent, used only for the primary action** (e.g. "Check answer"). Everything else neutral — [Apple tinting guidance](https://developer.apple.com/videos/play/wwdc2025/219/); [Fountain Institute](https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui)
3. **A three-face type system**: a characterful display/numeral face for scores, timers and question numbers (dot-matrix or LCD-style); a highly legible text face for problems; an uppercase mono for labels and metadata — [Nothing analysis](https://www.shadcn.io/design/nothing)
4. **Expressive type only where it doesn't cost readability.** Never dot-matrix in maths prompts — [nothing.community OS 4.0](https://nothing.community/d/61774-nothing-os-evolution)
5. **LCH-generated themes from base, accent and contrast inputs**, giving automatic high-contrast and dark themes — [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)
6. **Unequal visual weight**: dimmed nav/sidebar, softer separators, fewer icons during practice — [Linear refresh](https://linear.app/now/behind-the-latest-design-refresh)
7. **Trays, not page jumps**, for hints, worked steps and the mark explanation. Each tray holds one piece of content and overlays the question so context stays — [benji.org](https://benji.org/family-values)
8. **Text morph on the main button** ("Check" → "Next") to signal state change without new UI — [benji.org](https://benji.org/family-values)
9. **Directional and shared-element motion**: next question slides in from the direction of progress; the progress chip glides rather than re-rendering — [benji.org](https://benji.org/family-values); [rauno.me](https://rauno.me/craft/interaction-design)
10. **Delight budget inversely tied to frequency**: no animation on per-keystroke or per-stroke actions; a richer celebratory moment only for rare milestones such as finishing a chapter or a streak — [benji.org](https://benji.org/family-values); [emilkowal.ski](https://emilkowal.ski/ui/great-animations)
11. **Motion spec**: under 300ms, ease-out or springs, `transform`/`opacity` only, interruptible, `prefers-reduced-motion` respected — [emilkowal.ski](https://emilkowal.ski/ui/great-animations)
12. **Direct manipulation that tracks the finger or pencil in real time** (dragging a fraction bar, graph point or protractor), with momentum, plus a loupe for precise touch — [rauno.me](https://rauno.me/craft/interaction-design)
13. **Instrument-like mapping between control and display**, as with the OP-1's colour-coded encoders matching on-screen parameters. For example, the colour of a variable in an equation matches its slider or graph line — [CDM/Equipboard OP-1](https://equipboard.com/posts/the-teenage-engineering-op-1-a-modern-classic)
14. **No fluff data**: every number, dot and readout on screen is real (accuracy, time, attempts); no decorative status dots — [Territory via Pushing Pixels](https://www.pushing-pixels.org/?p=9769); [Fountain Institute](https://www.thefountaininstitute.com/blog/signs-vibe-coded-ui)
15. **Beauty through elimination plus a map-like diagram language** for progress and curriculum: consistent shapes per topic type, peripheral info at the edges (Mini Metro); a limited palette and generous whitespace (Monument Valley) — [GDC Mini Metro](https://gdcvault.com/play/1024250/-Mini-Metro-When-Less); [Mechanics of Magic](https://mechanicsofmagic.com/2023/04/22/visual-design-of-games-mini-metro/); [GDC Monument Valley](https://www.gdcvault.com/play/1021380/Designing-Monument-Valley-Less)

### Inferences
- A domain-native "futuristic instrument" metaphor for Pri could combine graph-paper hairline grids, calculator-LCD tabular numerals for the HUD, and a single warm accent. That would read as crafted rather than AI-generic, and it avoids copying Nothing or TE directly. This is a design hypothesis, not a sourced finding.
- Accessibility settings should follow Apple's pattern (reduce transparency → opaque; increase contrast → borders; reduce motion → no springs). Students on low-end Android or older iPads in India may also need an effects-off default. That is an assumption to test, not something sourced here.
- Any handwriting or marking UI must keep the "AI proposes, deterministic engine decides" boundary visually clear. Futuristic styling should never make a model suggestion look like a final mark. This comes from project policy (AGENTS.md), not from external research.

### Gaps
- No sourced evidence on what visual styles Indian 12–16-year-olds prefer, or on how sound and haptics affect learning apps.
- Sound design references (TE, Nothing OS sounds, Playdate) were not sourced.
- Specific font recommendations with licensing (e.g. Geist Mono, Departure Mono, JetBrains Mono, Space Grotesk, Söhne, a dot-matrix face) were not verified for licence or Devanagari/Indic coverage.
