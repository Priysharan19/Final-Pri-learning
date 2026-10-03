# Pen, Ink & Notebook App Interaction Design: Patterns for Pri Learning's iPad + Apple Pencil Maths Answer Canvas

Research date: 2026-10-02. Researcher budget was about 25 tool calls, so coverage is uneven. Facts with a citation were checked against a fetched page or search result in this session. Statements marked **[BK]** come from the researcher's background knowledge (training data up to 2025/26) and were **not** re-verified this session. The report writer should treat [BK] as leads to verify, not as citable facts. Info dated before 2025 is marked **(older)**.

## Q1. Catalogue: what the leading pen/ink products actually do (per product)

### Takeaway
On Apple platforms, the 2024–2026 standard is: the system owns the Pencil gestures (squeeze, barrel roll, hover, double tap, an undo slider, haptics), PencilKit provides a customisable tool picker, and "intelligent ink" (Math Notes, Smart Script) writes machine output back *in the user's own handwriting style*. Third-party apps add an AI layer (Goodnotes Math Assistance, Notability Learn, MyScript math conversion) on top of the same ink. Research labs (Ink & Switch) found that explicit, user-triggered recognition beats continuous background recognition for reliability and trust.

### Cited Findings

**Apple Math Notes (iPadOS 18+, (2024), still current in iPadOS 26)**
- Math Notes solves a written expression as soon as you write "=". It supports variables (e.g. `dinner = $42` … `dinner + movies + dessert =`) and graphs, offered through an "Insert Graph" option when you tap the equals sign. It works with handwriting via Apple Pencil — [Stuff.tv explainer](https://www.stuff.tv/features/what-are-apples-math-notes-the-number-solving-iphone-and-ipad-feature-explained); [Macworld](https://www.macworld.com/article/2362395/ipados-18-calculator-math-notes-apple-pencil-handwriting-equations.html)
- Results are shown in an imitation of the user's own handwriting, and ML is used to make Pencil writing clearer — [Stuff.tv](https://stuff.tv/?p=936474); [MacRumors iOS 18 Notes guide](https://macrumors.com/guide/ios-18-notes-app)
- Apple PM Ty Jordan's framing: "You just write math like on a piece of paper and like magic, it just gives you the answer." — [MacTrast interview write-up](https://www.mactrast.com/2024/07/apple-managers-talk-about-ipados-18-math-notes-and-smart-script-features-in-ipados-18/amp/)
- [BK] Results appear in a distinct tint (yellow/orange-ish) next to the "=". A "Math Results" setting offers Insert Results / Suggest Results / Off; in Suggest mode you tap the ghost result to accept it. Expressions that can't be evaluated get a dotted/red underline you can tap. Variables and numbers in typed notes can be scrubbed like sliders. *Apple Support pages did not render for the fetcher, so these details are unverified.*

**Apple Notes Smart Script (iPadOS 18+, (2024))**
- Smart Script refines your handwriting as you write ("as soon as you start writing words, it refines your handwriting"). It also spell-checks handwriting, reflows text when you tap-and-hold with the Pencil to move words, and can paste typed text "as your own handwritten text right in the middle of a paragraph" — [MacTrast](https://www.mactrast.com/2024/07/apple-managers-talk-about-ipados-18-math-notes-and-smart-script-features-in-ipados-18/amp/)
- [BK] Scratching out words with the Pencil erases them (scratch-to-erase, carried over from Scribble). Users can turn Smart Script's "auto-refine" off in Settings.

**Apple Pencil Pro + PencilKit (WWDC24 session 10214, "Squeeze the most out of Apple Pencil" (2024); APIs still current)**
- **Squeeze**: there is a device-global preference `UIPencilInteraction.preferredSqueezeAction`; `.showContextualPalette` shows the tool picker near the hover location. Apps receive squeezes via `UIPencilInteractionDelegate pencilInteraction(_:didReceiveSqueeze:)` or SwiftUI `onPencilSqueeze`. Apple's guidance: "Treat squeeze as a single gesture that performs a discrete action." — [WWDC24 10214](https://developer.apple.com/videos/play/wwdc2024/10214/)
- **Hover pose** arrives with double tap and squeeze: location, z-offset, azimuth, altitude, roll. PKToolPicker uses it to position itself at the Pencil location, and custom palettes should do the same (`squeeze.hoverPose?.location ?? default`) — [WWDC24 10214](https://developer.apple.com/videos/play/wwdc2024/10214/); [UIPencilHoverPose docs](https://developer.apple.com/documentation/uikit/uipencilhoverpose.md)
- **Barrel roll**: available on UITouch and the hover recogniser. It drives marker and fountain-pen stroke angle in PKCanvasView. Guidance: "Use barrel roll angle for providing input to drawn strokes, rather than controlling user interface elements"; add roll and azimuth together and fall back on devices without roll. Roll is estimated first and then refined over Bluetooth, so use `touchesEstimatedPropertiesUpdated` — [WWDC24 10214](https://developer.apple.com/videos/play/wwdc2024/10214/)
- **Haptics**: `UICanvasFeedbackGenerator` provides `.alignmentOccurred(at:)` (snap to guide) and `.pathCompleted(at:)` (stroke snaps to a clean shape). In SwiftUI these are `.sensoryFeedback(.alignment)` and `.sensoryFeedback(.pathComplete)`. All UIFeedbackGenerators now take a view and a point, so haptics are *located* — [WWDC24 10214](https://developer.apple.com/videos/play/wwdc2024/10214/)
- **Undo slider**: with Pencil Pro squeeze, you get a built-in multi-step undo/redo slider. Long-pressing the undo button also opens it. No code is needed if you use PKToolPicker — [WWDC24 10214](https://developer.apple.com/videos/play/wwdc2024/10214/)
- **Tool picker customisation (iOS 18)**: `PKToolPicker(toolItems:)` sets the order and set of ink, eraser, lasso, ruler, scribble and custom items. You can include several tools of the same type (e.g. two pen colours, "great for an app offering an annotation experience"). `setAccessoryUIBarButtonItem` adds a trailing canvas action, which is hidden when the picker is minimised. `PKToolPickerCustomItem` takes an image closure for non-PencilKit tools — [WWDC24 10214](https://developer.apple.com/videos/play/wwdc2024/10214/)
- **iPadOS 26 (2025)**: adds a **reed pen** (a calligraphy tool with angle presets) to PencilKit. It is available in Notes, Preview, Freeform, Journal and Markup, and to third-party PencilKit apps. Custom tool-picker items come to macOS 26. The ink "content version 4" introduced the reed pen — [AppleInsider](https://appleinsider.com/articles/25/06/18/the-ipados-26-reed-pen-tool-is-a-great-calligraphy-addition); [TechRadar](https://www.techradar.com/tablets/ipad/ipados-26-public-beta-added-a-new-pencil-tool-and-now-im-obsessed-with-learning-calligraphy); [PencilKit skill summary (tessl)](https://tessl.io/registry/dpearson2699/swift-ios-skills/3.6.1/files/skills/pencilkit/SKILL.md)
- The monoline (uniform-width), fountain pen, watercolour and crayon inks came in iPadOS 17 (older, 2023) — [tessl PencilKit summary](https://tessl.io/registry/dpearson2699/swift-ios-skills/3.6.1/files/skills/pencilkit/SKILL.md)

**Goodnotes 6 (launched Aug 2023 (older); still the current major version per available sources)**
- AI Spellcheck "instantly corrects handwritten typos in a user's own handwriting". Word Complete suggests completions. The handwriting AI learns the user's style. At launch it covered English, Spanish, German and Dutch spellcheck — [THE Journal](https://thejournal.com/Articles/2023/08/29/Goodnotes-6-Debuts-with-AI-Handwriting-Features-AI-Math-Help.aspx); [AlternativeTo](https://alternativeto.net/news/2023/8/goodnotes-6-is-the-app-s-largest-update-yet-featuring-new-ai-powered-handwriting-capabilities-and-official-versions-for-windows-android-and-the-web/)
- **AI Math Assistance** "can detect incorrect math equations". It ships with interactive exam-prep materials (SAT etc.) that have built-in hints — [THE Journal](https://thejournal.com/Articles/2023/08/29/Goodnotes-6-Debuts-with-AI-Handwriting-Features-AI-Math-Help.aspx)
- [BK] Math Assistance shows a subtle coloured underline/marker under a wrong line, which the user taps for a hint. Spellcheck shows a dotted underline, and a tap swaps in the correction rendered in the user's handwriting. *Unverified.*

**Notability (Ginger Labs)**
- In 2025 Notability added AI summaries, quizzes, flashcards, fill-in-the-blanks and chat ("Learn"), generated from notes, PDFs, recordings **and handwritten notes** — [Notability Learn help](https://support.gingerlabs.com/hc/en-us/articles/8073483239834-Notability-Learn); [Wikipedia](https://en.wikipedia.org/wiki/Notability_(application))
- Notability supports handwriting search plus handwriting and math conversion to typed text — [Wikipedia](https://en.wikipedia.org/wiki/Notability_(application))

**MyScript (Nebo, now renamed MyScript Notes; MyScript Math / Calculator)**
- Nebo has been renamed "MyScript Notes". You lasso handwritten math and convert it, edit it with the pen, convert again, and paste it as LaTeX — [MyScript help](https://help.myscript.com/math/overview/handwriting-experience/)
- **Scratch-out gesture**: scribble over content with the pen and it is removed without switching tools. Nebo/MyScript Notes also supports this. The **conversion preview** gives live recognition feedback and word suggestions — [MyScript help](https://help.myscript.com/math/overview/handwriting-experience/); [MyScript SDK](https://myscript.com/sdk)
- [BK] Nebo shows a small live "recognition bar" of typed text above the paragraph being written, without replacing the ink, and a double tap converts. MyScript Calculator (older) shows the result live in typeset next to the ink and re-solves as you edit. Its pen gestures include scratch-out = erase, vertical line = break/join and loop/underline = select. *Unverified in this session.*

**Microsoft OneNote Math Assistant**
- Flow: in Draw, write the equation, **lasso it**, tap Math, and a side **Math Assistant pane** opens with the solution and a "Show steps" option. A "Generate Quiz" option creates practice problems, though it is temporarily unavailable per Microsoft. Requires Microsoft 365 Education/Enterprise — [Microsoft Support](https://support.microsoft.com/en-us/office/solve-math-equations-with-math-assistant-in-onenote-1b37bb8d-ecd1-40d7-8d0f-5e6e46547441); [Create equations with ink](https://support.microsoft.com/en-us/education/onenote/create-math-equations-using-ink-or-text-with-math-assistant-in-onenote)
- [BK] The pane shows the recognised equation typeset at the top so the user can fix misreads before solving. This is an explicit "confirm what I read" step.

**Samsung Notes Math Solver (One UI 8, 2025)**
- Solves handwritten (S Pen) or typed equations with Galaxy AI. It first shipped on large screens and S-Pen phones (S25 Ultra, Z Fold 7), and expansion with One UI 8.5 is *rumoured* — [Samsung India support](https://www.samsung.com/in/support/mobile-devices/how-to-use-maths-solver-feature-in-notes-on-galaxy-devices/); [Android Authority](https://www.androidauthority.com/samsung-notes-one-ui-8-changes-3564222/); [PhoneArena (rumour)](https://www.phonearena.com/news/one-ui-8.5-may-bring-this-clever-samsung-notes-trick-to-more-galaxy-phones_id176430)
- Note Assist provides summaries, auto-formatting, spellcheck and translation — [Samsung US support](https://ushl.samsung.com/us/support/answer/ANS10000941)

**Mathpix Snip**
- Mathpix shows a **confidence level** for each recognition (added in v1.1, older). In document conversion it is "designed not to guess when confidence is low": low-confidence regions are embedded as cropped images instead of LaTeX — [Softpedia changelog](https://mac.softpedia.com/progChangelog/Mathpix-snipping-tool-Changelog-142777.html); [arXiv 2406.17859 grading study](https://arxiv.org/pdf/2406.17859)
- It moved to vision-transformer recognition, with large gains on graduate-level handwriting — [Mathpix blog](https://mathpix.com/blog/snip-bugfixes-handwriting-recognition-improvements)

**tldraw (Make Real, tldraw computer, agents)**
- Make Real (Nov 2023, older) flow: sketch a wireframe → press a button → a model (GPT-4V at the time) returns working HTML that sits *on the canvas* → you annotate the output to iterate in a conversational loop. This is only possible because any React component can live on the canvas — [tldraw Substack](https://tldraw.substack.com/p/make-real-the-story-so-far); [GitNation talk](https://gitnation.com/contents/make-real-tldraws-accidental-ai-play)
- tldraw computer (2024/25, with Google) runs branching, repeatable natural-language workflows as connected canvas components. Later "fairies" are multi-agent helpers working on the canvas — [AI Engineer 2025](https://www.ai.engineer/talks/1C2TdPkj6aQ-tldraw-computer); [AI Engineer Europe 2026](https://www.ai.engineer/talks/sPUjIBH5Cwg-agents-on-canvas-in-tldraw)

**Ink & Switch (Inkbase, Crosscut, lab notes)**
- **Inkbase**: an iPad programmable sketchbook in which ink strokes are live reactive objects. It used bottom-up heuristics plus the $1 Unistroke recogniser. Key lesson: "explicit tagging combined with implicit recognition" worked better than continuous background recognition, because recognition "introduces unreliability and user frustration". Selection used a **quasi-mode**: hold two fingers while using the pen. "The fidelity of the tool you use should match the maturity of the idea you're working with." Spatial queries were essential, while "fuzzy" containment of hand-drawn marks stayed unsolved — [Inkbase essay](https://www.inkandswitch.com/inkbase/)
- **Crosscut**: a stylus + tablet tool for "drawing dynamic models of your thoughts", with programming that "lives right inside your sketches" — [Crosscut](https://www.inkandswitch.com/crosscut/)
- The Programmable Ink lab notes cover "Wrapper Latency", "Sketchy Feel", "Pseudo-mode", "Selection Gestures", "Informal Ink Augmentation" and "Ink Deformation" — [Ink & Switch lab notes index](https://www.inkandswitch.com/ink/notes/all/)

**Teacher/examiner marking (Cambridge/OCR, RM Assessor, Gradescope)**
- Online marking uses "stamps and annotations as a shorthand" to explain marking decisions to supervising examiners. A tick marks a correct point and incorrect answers are often not annotated. Annotations include tick, tick + BOD (benefit of doubt) and cross. "There is no direct relationship between ticks and marks." RM Assessor counts tick uses and shows the total beneath the tick tool in its toolbar, and has a highlighter tool — [search summary of Cambridge/OCR annotation guidance](https://help.cambridgeinternational.org/hc/en-gb/articles/29568000061202-What-do-the-annotations-on-copies-of-scripts-mean); [OCR understanding script annotations](https://ocr-live-prd95.cambridgeassessment.org.uk/administration/cambridge-nationals/post-results/access-to-scripts/understanding-script-annotations) (the Cambridge page returned 403 to the fetcher; content comes from search snippets)
- Cambridge Assessment research looks at how annotations on returned scripts affect students — [Cambridge Assessment paper](https://www.cambridgeassessment.org.uk/Images/472480-towards-an-understanding-of-the-impact-of-annotations-on-returned-exam-scripts.pdf)
- Gradescope: rubric-based grading with rubrics that can be adjusted mid-grading ([BK] changes apply retroactively to graded work). **AI-assisted answer groups** cluster similar handwritten answers for the instructor to *review and confirm*. It explicitly does not use generative AI — [Turnitin Gradescope](https://www.turnitin.ca/products/gradescope/); [Apporto explainer](https://www.apporto.com/gradescopes-ai-assisted-grading-explained); [UMass](https://www.umass.edu/ideas/news/revolutionize-your-grading-workflow-gradescope)
- [BK] Maths mark-scheme codes: **M1** = method mark, **A1** = accuracy mark (depends on the M mark), **B1** = independent mark, **ft / √** = follow-through, **dep** = dependent, **SC** = special case, **cao** = correct answer only, **isw** = ignore subsequent working, **oe** = or equivalent, **^** = omission, **SEEN** = page seen, **BOD** = benefit of doubt. The marks are written at the right margin next to the line that earns them. *Verify against an actual Cambridge/Edexcel mark scheme PDF, e.g. [Cambridge 2023 MS](https://cambridgeinternational.org/Images/592744-november-2023-mark-scheme-paper-21.pdf).*

### Inferences
- Apple's direction (results in the user's handwriting style, refine-as-you-write, located haptics, palette at the pen tip) sets the bar students will compare Pri against on iPad.
- Every serious maths tool (OneNote, MyScript, Mathpix) includes a step that exposes the *recognised form* before or alongside the result. Apple Math Notes is the exception: it skips this step and relies on "magic", which suits arithmetic but is risky for marking.

### Gaps
- Could not fetch Apple HIG "Apple Pencil and Scribble" (the page body didn't render) or Apple Support Math Notes pages. Exact Math Notes result colour, settings and error UI are [BK] only.
- No 2025–2026 source found on Goodnotes' current AI maths UI (the "Goodnotes AI" rebrand and any Learn features are unverified). Concepts, Muse, Freeform, Excalidraw, Craft, Fermat, Bret Victor, Andy Matuschak, MIT/Stanford pen-math research and RM Assessor UI screenshots were not researched due to budget.
- Whether iPadOS 26 changed Math Notes or Smart Script behaviour was not confirmed.

## Q2. What makes ink feel "alive" and premium (latency, texture, pressure, sound/haptics)?

### Takeaway
Perceived quality is set first by latency. Users can tell about 1 ms from 2 ms when dragging, but only about 7 ms from 40 ms when scribbling. Inking-latency perception is around 50 ms and is anchored to the visible pen and hand, not the gap between nib and ink. After latency come pressure, tilt and roll-responsive strokes and *located* haptics at meaningful moments (snap, shape completion), never haptics on every stroke.

### Cited Findings
- Stylus psychophysics (University of Alberta / Microsoft, 2014 (older but still the standard reference)): with a 1 ms prototype (HPSS), participants told apart about 1 vs 2 ms when dragging and about 7 vs 40 ms when scribbling — [Annett et al. CHI 2014](https://webdocs.cs.ualberta.ca/~wfb/publications/C-2014-SIGCHI-Latency.pdf)
- Latency perception while inking is worse (~50 ms) than for non-inking tasks (~2–7 ms). Perception depends on a visual referent such as the hand or stylus, not on nib-to-ink distance — [Annett et al. GI 2014](https://webdocs.cs.ualberta.ca/%7Ewfb/publications/C-2014-GI-Latency.pdf); [GI proceedings](https://graphicsinterface.org/proceedings/gi2014/gi2014-22/)
- Ink & Switch names latency in software stacks ("Slow Software", "Wrapper Latency") as a core problem for digital ink — [Slow Software](https://inkandswitch.com/slow-software/); [lab notes index](https://www.inkandswitch.com/ink/notes/all/)
- Inkbase notes paper's advantage of "remarkably low latency" pens and treats preserving the "natural grain" of loose ink as a design goal — [Inkbase](https://www.inkandswitch.com/inkbase/)
- Apple's haptic model is sparse and semantic: `alignment` when snapping to a guide and `pathComplete` when a stroke snaps to a shape, both delivered at a point in the view — [WWDC24 10214](https://developer.apple.com/videos/play/wwdc2024/10214/)
- Barrel roll belongs to stroke rendering (angled nibs), not UI control — [WWDC24 10214](https://developer.apple.com/videos/play/wwdc2024/10214/)
- iPadOS 26's reed pen shows Apple is still investing in "ink character" tools — [AppleInsider](https://appleinsider.com/articles/25/06/18/the-ipados-26-reed-pen-tool-is-a-great-calligraphy-addition)

### Inferences
- For a WebView/PWA canvas, predicted touches and coalesced pointer events are the levers that matter. [BK] On the web these are `pointerrawupdate`, `getCoalescedEvents()`, `getPredictedEvents()` and a desynchronised low-latency canvas context. PencilKit natively gets Apple's prediction pipeline (~9 ms on ProMotion iPad Pro per Apple marketing, [BK]). Rendering ink through a React state update per point would push latency well past the ~50 ms inking threshold.
- A haptic "tick" when a line's step is accepted would be a premium touch, but only on Pencil Pro and only for discrete events. Maths feedback should never buzz on every stroke.
- Paper texture and ruled/grid lines: [BK] Goodnotes and Notability offer paper templates (ruled, squared, dotted, Cornell), and maths students mostly prefer squared/dotted grids. For line-by-line working, faint horizontal rules spaced to handwriting height help segment lines for recognition, which is a functional reason beyond aesthetics.

### Gaps
- No current (2025–26) measured end-to-end latency figures for Goodnotes, Notability or web canvases on iPad were found.
- Sound design (e.g. pencil-scratch audio) was not researched. No cited evidence exists for or against it.

## Q3. Best ways to show "what the machine read" without breaking flow

### Takeaway
There are three proven tiers: (a) **ambient/quiet**: ink stays primary and a small recognised-text strip or ghost is shown near it (MyScript preview, Apple Suggest Results [BK]); (b) **on demand**: lasso → convert/solve, with the recognised form shown first (OneNote pane, MyScript lasso-convert); (c) **write-back in the user's own hand**: Smart Script, Goodnotes spellcheck, Math Notes results. Ink & Switch's evidence favours explicit triggers over continuous background recognition.

### Cited Findings
- MyScript's conversion preview gives "live recognition feedback and word suggestions" while the original ink stays in place. Lasso-convert is explicit — [MyScript help](https://help.myscript.com/math/overview/handwriting-experience/)
- OneNote's flow is lasso → Math → side pane → Show steps. It is user-initiated and the recognised content lives in a separate pane, so the ink is untouched — [Microsoft Support](https://support.microsoft.com/en-us/office/solve-math-equations-with-math-assistant-in-onenote-1b37bb8d-ecd1-40d7-8d0f-5e6e46547441)
- Apple writes results back in the user's handwriting style next to the "=" — [Stuff.tv](https://stuff.tv/?p=936474)
- Smart Script and Goodnotes Spellcheck correct inside the user's own handwriting — [MacTrast](https://www.mactrast.com/2024/07/apple-managers-talk-about-ipados-18-math-notes-and-smart-script-features-in-ipados-18/amp/); [THE Journal](https://thejournal.com/Articles/2023/08/29/Goodnotes-6-Debuts-with-AI-Handwriting-Features-AI-Math-Help.aspx)
- Inkbase: "explicit tagging combined with implicit recognition" beat continuous background recognition, which brought unreliability and frustration — [Inkbase](https://www.inkandswitch.com/inkbase/)
- tldraw Make Real puts machine output *on the same canvas* as the sketch, and the user annotates it to correct it — [tldraw Substack](https://tldraw.substack.com/p/make-real-the-story-so-far)

### Inferences
- For Pri, a per-line "reading" chip works well: a faint typeset rendering (e.g. KaTeX) right-aligned in the line's gutter, appearing after a short pause (~600–1000 ms idle, [BK] heuristic). The student can tap it to correct. This is the MyScript preview adapted to line-by-line maths.
- Do **not** write marks or "corrections" back in the student's handwriting style. In assessment this blurs authorship and would conflict with Pri's answer-blind handwriting authority invariant (see AGENTS.md). Machine output must look visibly different from student ink.
- The transcription must be shown *before* marking, so the student can confirm what was read. This separates "misread" from "wrong maths", the same way OneNote's pane does.

### Gaps
- No published usability data was found comparing ambient vs on-demand recognition display for maths.

## Q4. How to show uncertainty in recognition

### Takeaway
The strongest documented pattern is to **refuse to guess**: Mathpix keeps low-confidence regions as images rather than emitting wrong LaTeX, and exposes a confidence level. Gradescope's AI only *suggests* groups for a human to confirm. Few consumer note apps show uncertainty at all, so this is an open design space.

### Cited Findings
- Mathpix exposes a recognition confidence level and doesn't guess at low confidence, embedding a cropped image instead — [Softpedia changelog](https://mac.softpedia.com/progChangelog/Mathpix-snipping-tool-Changelog-142777.html); [arXiv 2406.17859](https://arxiv.org/pdf/2406.17859)
- Gradescope's AI suggests answer groups, and instructors review, adjust and confirm them — [Apporto](https://www.apporto.com/gradescopes-ai-assisted-grading-explained); [Turnitin](https://www.turnitin.ca/products/gradescope/)
- MyScript shows alternative candidates ("word suggestions") in its preview — [MyScript help](https://help.myscript.com/math/overview/handwriting-experience/)
- Inkbase: recognition errors cause frustration, so it paired explicit tagging with implicit recognition — [Inkbase](https://www.inkandswitch.com/inkbase/)

### Inferences
- Pri should use three states per recognised token or line: **confident** (plain typeset), **ambiguous** (token shown with a dotted underline; a tap shows 2–3 alternatives such as `5 / s`, `x / ×`, `1 / l / 7`), and **unreadable** (shown as "?" plus a "rewrite this bit" nudge, never a guessed mark). This is an inference from Mathpix's refuse-to-guess and MyScript's alternatives.
- **Never mark a step as wrong when the recognition of that step is below threshold.** Show "I couldn't read this clearly" instead. This keeps transcription uncertainty separate from mathematical error, which is required to avoid false "wrong" marks (a critical category in AGENTS.md).
- Avoid numeric confidence percentages for students. Use plain-language states instead (inference; no source compares the two).

### Gaps
- No academic study on uncertainty visualisation in handwritten maths recognition was retrieved in this session.

## Q5. How to place feedback on/near ink elegantly (incl. examiner conventions)

### Takeaway
Real examiners use a compact, line-anchored grammar: a tick at the point of credit, crosses sparingly, and mark codes (M1/A1/B1/ft) in the right margin aligned to the line, with no relationship between tick count and marks. Digital tools mirror this with stamps, a margin and counters (RM Assessor) or a side pane (OneNote, Gradescope rubric). The ink itself is never overwritten.

### Cited Findings
- Stamps and annotations act as a shorthand. A tick means correct, tick + BOD gives benefit of doubt, a cross means incorrect, and incorrect answers are often not annotated. Ticks don't map to marks. RM Assessor shows the tick count under the tool — [Cambridge/OCR annotation guidance (search summary)](https://help.cambridgeinternational.org/hc/en-gb/articles/29568000061202-What-do-the-annotations-on-copies-of-scripts-mean); [OCR](https://ocr-live-prd95.cambridgeassessment.org.uk/administration/cambridge-nationals/post-results/access-to-scripts/understanding-script-annotations)
- Annotations on returned scripts affect how students interpret feedback, and Cambridge Assessment has studied this — [Cambridge Assessment](https://www.cambridgeassessment.org.uk/Images/472480-towards-an-understanding-of-the-impact-of-annotations-on-returned-exam-scripts.pdf)
- OneNote places help in a side pane rather than on the ink — [Microsoft Support](https://support.microsoft.com/en-us/office/solve-math-equations-with-math-assistant-in-onenote-1b37bb8d-ecd1-40d7-8d0f-5e6e46547441)
- Goodnotes Math Assistance flags incorrect equations, and exam-prep content has built-in hints — [THE Journal](https://thejournal.com/Articles/2023/08/29/Goodnotes-6-Debuts-with-AI-Handwriting-Features-AI-Math-Help.aspx)
- Inkbase found small reactive annotations (highlighting, constraint visualisation) "enhanced understanding without automating away user agency" — [Inkbase](https://www.inkandswitch.com/inkbase/)

### Inferences
- **Margin rail**: a right-hand feedback rail aligned to each written line, showing ✓, M1/A1 (or student-friendly "method ✓ / answer ✓"), and "?" for unread lines. This mirrors examiner conventions students will see in real papers.
- **Anchor, don't cover**: feedback marks sit in the gutter or just after the line's end, and a tap expands to a hint card that pops *away* from the writing hand (left of the line for right-handers). The student's ink is never recoloured or overwritten. At most, a soft highlight is drawn *under* the erroneous token.
- **Follow-through**: show "ft" when a later step is credited despite an earlier error. This teaches that working matters, which is the pedagogical reason M-marks exist.
- **Timing**: show quiet per-line "read" state live, but hold ✓/✗ judgement until the student pauses or taps "check". Live red crosses mid-thought are discouraging and break flow (inference from the "explicit trigger" lesson).

### Gaps
- RM Assessor's actual toolbar layout and Gradescope's annotation canvas were not captured visually.

## Q6. Toolbar layout: iPad landscape vs portrait, one-hand use

### Takeaway
Apple's own model (2024+) moves tools to the Pencil: squeeze shows a contextual palette *at the hover point*, double tap swaps tools, a built-in undo slider exists, and the PKToolPicker can be minimised and reordered. The fixed toolbar is shrinking toward a minimal, movable palette.

### Cited Findings
- The contextual palette appears at `squeeze.hoverPose.location`, and PKToolPicker positions itself at the Pencil — [WWDC24 10214](https://developer.apple.com/videos/play/wwdc2024/10214/)
- Squeeze is a single discrete action whose behaviour the user chooses globally — [WWDC24 10214](https://developer.apple.com/videos/play/wwdc2024/10214/)
- The undo slider comes via squeeze or a long press on undo — [WWDC24 10214](https://developer.apple.com/videos/play/wwdc2024/10214/)
- The tool picker accepts a curated, reordered tool list (e.g. two pen colours) plus an accessory button, which hides when minimised — [WWDC24 10214](https://developer.apple.com/videos/play/wwdc2024/10214/)
- Inkbase's two-finger quasi-mode let the non-dominant hand switch to selection without a toolbar trip — [Inkbase](https://www.inkandswitch.com/inkbase/)

### Inferences
- **Portrait** (paper-like, best for line-by-line working): use a slim top bar with question, timer and "check", plus a floating minimal pen palette (pen, eraser, lasso, undo) that docks to the edge opposite the writing hand.
- **Landscape**: put the question/prompt in a left column and the canvas on the right, with the feedback rail on the canvas's right edge. Tools go in a vertical strip on the non-dominant-hand side.
- **One hand**: the non-dominant hand gets two-finger tap = undo and three-finger tap = redo ([BK] Goodnotes/Procreate convention), and finger drag scrolls. The Pencil alone writes, so finger touches never ink by default (PencilKit `drawingPolicy = .pencilOnly`, [BK]). This is also the core of palm rejection.
- Provide a left/right-handed setting so feedback popovers and the palette avoid the writing hand.

### Gaps
- Apple HIG text on handedness and palm rejection could not be fetched.

## Q7. The 15 best transferable patterns for a maths-answer canvas, and anti-patterns

### Takeaway
Combine paper-grade ink (low latency, Pencil-only drawing, scratch-to-erase, undo slider) with a *visibly separate* machine layer. That layer reads each line quietly, shows what it read, asks rather than guesses when unsure, and marks in the margin with examiner-style codes only after the student pauses or asks.

### Cited Findings
(The patterns below are grounded in the sources cited in Q1–Q6. Citations here point to the strongest source for each.)
1. **Ink-first, Pencil-only drawing; fingers scroll and undo** — [Inkbase quasi-mode](https://www.inkandswitch.com/inkbase/)
2. **Latency budget well under ~50 ms for inking; render strokes off the main UI path** — [Annett et al. GI 2014](https://webdocs.cs.ualberta.ca/%7Ewfb/publications/C-2014-GI-Latency.pdf)
3. **Scratch-out to erase without switching tools** — [MyScript](https://help.myscript.com/math/overview/handwriting-experience/)
4. **Squeeze → contextual palette at the pen tip; double tap → eraser toggle** — [WWDC24](https://developer.apple.com/videos/play/wwdc2024/10214/)
5. **Multi-step undo slider (squeeze or long-press undo)** — [WWDC24](https://developer.apple.com/videos/play/wwdc2024/10214/)
6. **Curated tool picker: 2 pen colours (working vs rough), eraser, lasso, nothing else** — [WWDC24](https://developer.apple.com/videos/play/wwdc2024/10214/)
7. **Live "what I read" preview per line, ink untouched** — [MyScript preview](https://help.myscript.com/math/overview/handwriting-experience/)
8. **Confirm-the-reading before judging (recognised form shown first)** — [OneNote Math Assistant](https://support.microsoft.com/en-us/office/solve-math-equations-with-math-assistant-in-onenote-1b37bb8d-ecd1-40d7-8d0f-5e6e46547441)
9. **Refuse to guess at low confidence; show "?" and ask for a rewrite** — [Mathpix behaviour](https://arxiv.org/pdf/2406.17859)
10. **Tap-to-pick alternatives for ambiguous symbols** — [MyScript suggestions](https://help.myscript.com/math/overview/handwriting-experience/)
11. **Explicit/pause-triggered judgement rather than continuous red marks** — [Inkbase](https://www.inkandswitch.com/inkbase/)
12. **Margin-rail feedback aligned to lines using examiner grammar (✓, M1/A1, ft, BOD)** — [Cambridge/OCR annotations](https://ocr-live-prd95.cambridgeassessment.org.uk/administration/cambridge-nationals/post-results/access-to-scripts/understanding-script-annotations)
13. **Located, sparse haptics for discrete events (line accepted / snapped)** — [WWDC24 UICanvasFeedbackGenerator](https://developer.apple.com/videos/play/wwdc2024/10214/)
14. **Machine output lives on the same canvas but is visually distinct and annotatable** — [tldraw Make Real](https://tldraw.substack.com/p/make-real-the-story-so-far)
15. **Hints escalate on tap (nudge → hint → step), like Goodnotes exam-prep hints and OneNote "Show steps"** — [THE Journal](https://thejournal.com/Articles/2023/08/29/Goodnotes-6-Debuts-with-AI-Handwriting-Features-AI-Math-Help.aspx); [Microsoft Support](https://support.microsoft.com/en-us/office/solve-math-equations-with-math-assistant-in-onenote-1b37bb8d-ecd1-40d7-8d0f-5e6e46547441)

**Anti-patterns**
- **Continuous background recognition that reflows or acts on half-written ink** — the Inkbase finding on frustration — [Inkbase](https://www.inkandswitch.com/inkbase/)
- **Guessing low-confidence symbols and then marking them** — contrast with Mathpix — [arXiv 2406.17859](https://arxiv.org/pdf/2406.17859)
- **Using barrel roll or squeeze for continuous UI control, or overloading squeeze** — Apple guidance — [WWDC24](https://developer.apple.com/videos/play/wwdc2024/10214/)
- **Equating tick count with score** — examiners say ticks do not map to marks — [Cambridge/OCR](https://help.cambridgeinternational.org/hc/en-gb/articles/29568000061202-What-do-the-annotations-on-copies-of-scripts-mean)
- **Fully automated AI grading without human or deterministic confirmation** — Gradescope keeps the instructor confirming — [Apporto](https://www.apporto.com/gradescopes-ai-assisted-grading-explained)

### Inferences
- Further anti-patterns (inference/[BK]): auto-"beautifying" or replacing a student's handwriting in an answer canvas (authorship and assessment integrity); solving the problem for the student the moment they write "=" (Math Notes-style instant answers undermine assessment, so that mode should be off in exam/practice contexts); red full-line strike-throughs on student ink; feedback popovers that land under the writing hand; heavy fixed toolbars that eat vertical space in portrait; haptics or sound on every stroke; modal "convert" dialogs mid-working; numeric confidence percentages shown to children.
- For Pri specifically: the deterministic engine decides marks and the AI only proposes transcription (AGENTS.md invariant). So the UI must make the *transcription* the thing the student confirms, and the *mark* the thing the engine owns. This maps directly onto patterns 7–12.

### Gaps
- No controlled study was found that compares live vs deferred step feedback for handwritten maths on tablets. Recommendation 11 rests on the Inkbase qualitative finding plus inference.
- Concepts, Muse, Freeform, Excalidraw, Craft, Fermat, Bret Victor's and Andy Matuschak's writing, and CHI/UIST pen-math papers (e.g. MathPad², Hands-On Math, older) were not covered within budget. They are worth a follow-up pass, especially Hands-On Math (CHI 2010, Zeleznik et al.) and MathPaper/MathPad² (LaViola), for gesture vocabularies for maths ink.
