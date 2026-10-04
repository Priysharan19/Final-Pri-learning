# Accessible Mathematics Interaction Architecture

Status: **research-to-product contract**.  
Freshness: **1 October 2026**.

## 1. Accessibility is not a text alternative

Mathematics is structured, spatial and interactive.

An accessible system must preserve:
- semantic structure;
- navigability;
- mathematical relations;
- equivalent task intent.

Flattening an equation, graph or diagram into a paragraph can destroy the mathematics.

## 2. Semantic source of truth

Canonical mathematical objects should render into multiple views:

```text
SEMANTIC MATH OBJECT
→ visual notation
→ MathML
→ speech
→ braille
→ keyboard navigation
→ tactile / sonification where supported
```

Do not create each accessibility representation independently from screenshots.

## 3. MathML 4 direction

MathML 4 adds `intent` annotations aimed at helping assistive technologies generate better speech while preserving braille behavior.

W3C Working Draft:
https://www.w3.org/TR/mathml4/

The 2026 Math Working Group roadmap includes:
- `intent` concept work;
- screen-reader implementations;
- accessibility technique notes;
- MathML Core test/implementation work.

Source:
https://www.w3.org/Math/Documents/Charter2026.html

Research implication:
Pri's semantic layer aligns with the direction of web mathematics accessibility.

## 4. Equation navigation

Support navigation by semantic unit:

- equation side;
- term;
- factor;
- numerator;
- denominator;
- exponent;
- base;
- radicand;
- function argument;
- matrix row/column;
- derivative/integral bounds.

A screen reader should not be forced to consume an entire long expression linearly every time.

## 5. Editing

Accessible input should support, where practical:

- keyboard equation editing;
- LaTeX/text;
- structured editor;
- braille input;
- dictation with confirmation;
- external assistive technologies.

All representations map back to the same math object.

## 6. Graphs

A graph is more than alt text.

Accessible graph exploration can include:

- domain/range;
- axes;
- intercepts;
- extrema;
- discontinuities;
- monotonic intervals;
- asymptotes;
- selected coordinates;
- region/area;
- tangent/gradient.

## 7. Sonification

2025–26 research continues to investigate graph sonification and tactile/haptic access.

Examples:
https://doi.org/10.5445/IR/1000186056
https://www.mdpi.com/2076-3417/16/14/7137

These establish promising modalities, not one universal optimal sonification.

Pri should treat sonification as a tested accessibility view, not a novelty feature.

## 8. Accessible Maths Australia precedent

The 2025–2028 Accessible Mathematics for Students who are Blind or have Low Vision project is building a shared digital workbook with multiple input/output representations including:
- braille;
- LaTeX;
- HTML + MathML;
- speech;
- visual output;
- tactile graphics;
- sonification.

Source:
https://www.accessiblemaths.org/

This supports Pri's strategy of one semantic workspace with multiple views.

## 9. Diagrams

Represent:
- objects;
- coordinates;
- incidence;
- equality;
- parallel/perpendicular;
- labels;
- givens;
- derived facts.

Distinguish:
- visually suggested;
- stated;
- proved.

Do not say an angle is right because the picture looks right.

## 10. Assessment leakage

Accessibility cannot silently reveal the target answer.

Examples:

- graph-description task asks learner to identify turning point:
  do not announce turning point automatically.

- derivative interpretation task:
  reading the expression aloud is access;
  supplying derivative is assistance.

Accessibility mode needs awareness of construct/rubric.

## 11. Motor accessibility

Alternative input can preserve the construct:
- larger targets;
- keyboard;
- switch control;
- reduced precision drawing where drawing precision is not assessed.

Do not require Apple Pencil dexterity to demonstrate algebra.

## 12. Reduced motion

Animations should:
- have equivalent static state;
- respect reduced-motion settings;
- not hide mathematical content.

If motion itself represents a mathematical variable, provide an equivalent controllable representation.

## 13. Color

Never encode correctness/mathematical categories by color alone.

Use:
- text;
- shape;
- symbol;
- pattern;
- semantic label.

## 14. Zoom/reflow

Math UI must tolerate:
- large text;
- browser zoom;
- reflow;
- narrow screens.

Avoid clipping equation meaning or hiding controls.

## 15. Accessible first-break feedback

When marking a handwritten/typed derivation:
- identify line semantically;
- announce status;
- make correction location navigable;
- do not rely solely on visual overlay.

## 16. Teacher/classroom accessibility

Teacher action cards should be:
- keyboard navigable;
- screen-reader coherent;
- not dependent on dense visual dashboards.

## 17. Co-design

Accessibility cannot be validated solely by engineers.

Use:
- users who are blind/low vision;
- assistive-technology experts;
- teachers;
- accessibility specialists.

Automated checks are necessary but insufficient.

## 18. Evidence levels

### A0
semantic contract exists.

### A1
automated accessibility tests.

### A2
screen-reader/keyboard manual verification.

### A3
real assistive-technology user testing.

### A4
task-completion evidence on real mathematics.

Do not claim A4 from axe/WCAG automation alone.

## 19. Accessibility benchmark

For representative math objects:

- speech correctness;
- semantic navigation;
- edit round-trip;
- keyboard completion;
- focus;
- state update announcement;
- assessment leakage;
- graph/diagram equivalence;
- mobile/desktop;
- reduced motion;
- zoom.

## 20. Core rule

> **The same mathematics should remain mathematically usable when sight, color, precise touch or a particular input device is unavailable.**
