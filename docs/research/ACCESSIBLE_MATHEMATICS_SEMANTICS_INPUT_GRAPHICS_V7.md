# Accessible Mathematics Semantics, Input and Graphics V7

Status: V7 accessibility deep dive
Freshness: 1 October 2026

## 1. Purpose

Mathematics accessibility is not equivalent to:

> add alt text.

A mathematics system must preserve:

- mathematical structure;
- navigation;
- editing;
- spatial relations;
- graph meaning;
- assessment validity.

The strongest architecture is:

> one semantic mathematical object with multiple equivalent interaction/rendering pathways.

## 2. Current web-standards direction supports semantic mathematics

MathML 4.0, W3C Working Draft 4 June 2026, explicitly represents both:

- mathematical notation;
- mathematical content.

It also introduces/extends the `intent` mechanism to help assistive technology disambiguate notation for speech and braille.

Source:
https://www.w3.org/TR/mathml4/

### Pri consequence

Do not store equations only as:
- canvas pixels;
- SVG paths;
- image screenshots.

Maintain a semantic expression that can render visually and accessibly.

## 3. Notation and meaning are not identical

A superscript can represent:
- exponent;
- transpose;
- derivative notation;
- label.

MathML 4's `intent` exists partly because assistive technology cannot always infer meaning from presentation syntax.

### Pri consequence

Pri already needs semantic math for:
- verification;
- marking.

Accessibility should reuse the same semantic authority.

This is a major architectural advantage.

## 4. W3C implementation work is still evolving

The W3C Math Working Group's 2026 charter includes:
- MathML 4 implementation;
- screen-reader support;
- intent concept/property work;
- accessibility technique notes.

Source:
https://www.w3.org/Math/Documents/Charter2026.html

### Pri consequence

Do not depend on one browser/screen-reader behavior without testing.

Maintain:
- feature detection;
- fallback;
- browser/AT compatibility matrix.

## 5. Australian accessible-mathematics research is unusually relevant

The 2025–2028 ARC Linkage Project “Accessible Mathematics for Students who are Blind or have Low Vision” targets upper-secondary mathematics.

Its planned workbook supports multiple input/output forms:
- UEB braille;
- LaTeX/text;
- interactive equation editor;
- HTML + MathML;
- speech;
- visual;
- tactile graphics;
- sonification.

Source:
https://www.accessiblemaths.org/

Partners include:
- Monash University;
- NSW/Victorian/Queensland education bodies;
- Vision Australia;
- specialist accessibility educators.

### Pri consequence

The project's architecture independently supports Pri's semantic-multi-view direction.

It is not evidence that Pri's implementation is accessible.

## 6. Co-design is not optional

The Australian project explicitly uses human-centred co-design with:
- blind/low-vision stakeholders;
- educators;
- assistive-technology specialists.

Source:
https://www.accessiblemaths.org/about-us/

### Pri rule

Automated accessibility tests can establish:
- DOM/ARIA regressions.

They cannot establish:
- usable mathematics.

Real assistive-technology user testing is required.

## 7. Equation accessibility has four separate problems

### Reading
Can the learner understand an expression?

### Navigation
Can they move through structure?

### Editing
Can they create/change mathematics?

### Interaction
Can they manipulate/select mathematical objects?

A product can pass reading but fail editing.

Pri benchmarks all four.

## 8. Structural navigation

For expression:

( x + 1 ) / ( x² - 4 )

a learner should be able to navigate:
- numerator;
- denominator;
- factors;
- exponent;
- operator.

Not repeatedly listen to the entire expression.

Semantic tree traversal should expose:
- parent;
- child;
- sibling;
- role.

## 9. Speech needs context

Possible speech:
- “x squared”
- “x to the power two”

For common notation, context can improve naturalness.

But speech must remain unambiguous.

User preferences can control:
- verbosity;
- pauses;
- terminology.

Do not change mathematical meaning.

## 10. Braille

Braille math representation may vary by locale/code.

Pri should not hard-code one spoken label as braille output.

MathML 4 explicitly distinguishes `intent` speech support from braille generation concerns.

### Pri consequence

Use assistive-technology / established conversion layers where possible.

Test with actual users/codes in target markets.

## 11. Accessible equation input

Possible input routes:

- keyboard structured editor;
- LaTeX;
- braille display/input;
- speech/dictation;
- handwriting;
- external AT.

All should resolve to:
- same semantic math object.

Do not create separate “accessible answers” with different grading logic.

## 12. Keyboard structured editing

An accessible equation editor should support:
- insert operator;
- enter/exit numerator;
- enter exponent;
- move across terms;
- delete semantic unit;
- announce current position.

Focus state must be deterministic.

## 13. Speech input

Math dictation needs grammar.

Ambiguous:
“x minus one over x plus one”

Could mean:
- (x-1)/(x+1);
- x - 1/x + 1.

System should:
- display/read back structured parse;
- ask confirmation where ambiguity matters.

## 14. Handwriting and accessibility

Pencil-first UX cannot be the only path.

If algebra is the construct:
motor/vision ability should not determine access.

Provide:
- keyboard;
- speech;
- external AT.

Likewise handwriting recognition errors must not penalize a user whose assistive input has an equivalent semantic form.

## 15. Graph accessibility requires more than one paragraph of alt text

Graphs contain:
- global shape;
- local coordinates;
- trend;
- extrema;
- intercepts;
- asymptotes;
- discontinuities;
- regions.

A static paragraph cannot support every question.

Better:
interactive exploration.

## 16. Graph semantic model

Represent:
- axes/units;
- domain/range;
- function(s);
- key points;
- segments;
- extrema;
- roots;
- discontinuities;
- regions.

Then expose different features according to:
- task;
- learner request;
- assessment policy.

## 17. Sonification is promising but parameter-sensitive

A 2026 study of adaptive sonification for function graphs with visually impaired users found usability depended on auditory-density parameters; excessive sonification reduced perceptual clarity.

Source:
https://www.mdpi.com/2076-3417/16/14/7137

### Pri consequence

“Add sonification” is not a complete solution.

Need:
- user study;
- graph complexity adaptation;
- navigation design.

## 18. Tactile graphics

For geometry/graphs:
tactile output can be valuable.

But ordinary consumer devices may not have:
- refreshable tactile display.

Pri semantic model should support future/export pathways without making tactile hardware a core dependency.

## 19. Diagram semantics

A geometry diagram should expose:

Objects:
- points;
- lines;
- circles;
- angles.

Relations:
- incident;
- parallel;
- perpendicular;
- equal;
- labelled.

Provenance:
- given;
- constructed;
- derived;
- merely visual.

This same model supports:
- accessibility;
- math verification.

## 20. Assessment leakage

This is the critical accessibility problem.

Task:
> determine the x-intercept.

An accessibility layer that automatically says:
> x-intercept is 3

has leaked the answer.

Accessibility transform must know:
- target construct;
- prohibited reveal set.

## 21. Access versus assistance

### Access
Provides equivalent information needed to perceive/manipulate the task.

### Assistance
Provides target mathematical inference.

Example:

Reading:
“the graph crosses the x-axis at x=3”

may be access if:
- sighted student sees labelled intercept directly.

But it may be assistance if:
- locating intercept is what is assessed.

There is no universal rule without task semantics.

## 22. Accommodation metadata

An assessment item should declare:

- construct;
- permitted accessibility views;
- restricted derived facts;
- approved accommodations.

Do not make ad hoc decisions at runtime from visual heuristics.

## 23. Color

Never encode:
- correctness;
- selected family;
- graph identity

by color alone.

Add:
- labels;
- patterns;
- shapes;
- speech.

## 24. Zoom/reflow

At high zoom:
- equations must not clip;
- controls remain reachable;
- key content not hidden horizontally without usable navigation.

Test:
- narrow phone;
- tablet;
- 200%+ zoom.

## 25. Reduced motion

Animations:
- respect reduced-motion preference;
- provide pause/step;
- provide static equivalent.

If motion itself represents mathematical change:
give controllable numerical/semantic state.

## 26. Time

Users with assistive tech may take longer.

Time-on-task differences should not automatically lower learner state.

For timed assessment:
approved accommodations apply.

## 27. First-break feedback

A sighted overlay:
red circle around line 3

needs semantic equivalent:

> “Line 3: the transition from 2x=6 to x=2 is not valid.”

But only if line interpretation is verified.

Make feedback focusable/navigable.

## 28. Pri Worlds

Generated interactive worlds require:
- keyboard control;
- semantic object list;
- equivalent values/relations;
- nonvisual exploration.

A world that requires precise dragging is not fully admitted.

## 29. PairLab

Shared canvas must announce:
- contributor;
- new step;
- edited region;
- AI annotation.

Do not rely on cursor color.

## 30. Accessibility quality levels

### AX0
semantic architecture exists.

### AX1
automated checks.

### AX2
manual keyboard/screen-reader test.

### AX3
specialist review.

### AX4
real blind/low-vision learner task completion.

### AX5
learning/assessment-equivalence evidence.

Do not call AX1 “accessible mathematics proven.”

## 31. Benchmark corpus

Representative:
- simple equation;
- nested fraction;
- radical;
- calculus notation;
- matrix;
- piecewise function;
- graph;
- geometry diagram;
- data table;
- multi-line derivation.

For each:
- read;
- navigate;
- edit;
- answer task.

## 32. Compatibility matrix

Record:
- browser;
- OS;
- screen reader;
- braille display where relevant;
- MathML behavior;
- known issue.

Accessibility can regress with browser/AT updates.

## 33. Accessible content generation

LLM may create:
- alt description.

But generated description must be checked for:
- mathematical accuracy;
- assessment leakage;
- missing relation.

Prefer semantic-to-description generation over image-only guessing.

## 34. Real-user programme

### AX-R1
Screen-reader equation reading/navigation.

### AX-R2
Keyboard answer entry.

### AX-R3
Graph exploration:
semantic list vs sonification vs combined.

### AX-R4
Geometry task.

### AX-R5
Assessment leakage review.

### AX-R6
Pri Worlds nonvisual completion.

Outcome:
task completion, correctness, burden and learner preference.

## 35. Accessibility is a measurement-validity issue

If a blind learner's error arises because:
- representation inaccessible,

Pri should not conclude:
- mathematics weak.

Channel accessibility must be part of evidence confidence.

## 36. Core decision

Pri should build accessibility into the same semantic layer that powers verification.

The rule is:

> **a learner should be able to perceive, navigate, create and reason about the same mathematics through multiple modalities without the accessibility layer quietly changing the mathematical task.**
