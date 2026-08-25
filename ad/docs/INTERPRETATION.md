# INTERPRETATION.md — the ideal Pri Learning

**Creative platform (one sentence):** *A student who understands can solve a problem they have
never seen; a student who memorised cannot.*

## Reading the repo as intent

The repo is not a coaching app with a nicer coat of paint. Three design decisions reveal what it
wants to be:

1. **It marks reasoning, not answers.** Step Check walks the student's working line by line and
   points at the exact line where the maths breaks — "This is the line where it goes wrong."
   Method marks exist even when the final answer is wrong. The unit of assessment is the *thought*,
   not the output. A factory grades output.
2. **It names misconceptions, not percentages.** The adaptive engine tracks misconception pressure
   ("you keep flipping the sign") and ranks priorities by mastery-gap — a diagnosis of the actual
   gap, where a coaching app posts a rank. This is the brief's "diagnose a student's actual gap,
   not their score," already in shipping code.
3. **It is one student's private instrument.** Everything on-device, the recogniser learns *your*
   hand, your data never leaves the iPad. The opposite of the batch of 400.

## The ideal product the film shows

Take those three decisions to their conclusion. The ideal Pri Learning, at Apple fidelity but in
this repo's own design language (near-black paper, Computer Modern, hairlines, gold):

- **It teaches the idea before the technique.** When a student meets a problem they can't pattern-match,
  the app doesn't produce a formula sheet — it produces the *idea* the problem is built on, shown as
  a living object: the secant sliding into tangency, not "f′(x) = lim…" as dead text. The derivation
  is the interface.
- **It treats one idea as a ladder, not four products.** The same mathematical object — a line
  touching a curve — is a Class 7 slope, a Class 10 circle theorem, a Class 12 derivative, a JEE
  conic tangent, and an Olympiad tangent-line trick. The ideal product surfaces that continuity;
  the film's Act III is that interface.
- **It closes the loop on the student's own ink.** You watch the idea, then you *write* the proof
  by hand, and examiner-style marks land on your handwriting, step by step. (Real capability,
  shown at the moment it means most.)

All interface moments in the film are plausible extensions of `theme.css` v4 — hairline-ruled
cards on near-black paper, small-caps labels, gold used only where the mathematics earns it.
Nothing is fantasy chrome.

## Why this beats a feature tour

The existing 36.4 s reel (marketing/reel) is a strong feature tour: what the product *has*.
This film argues what the product *believes* — India's maths education runs on pattern-recall,
and recall dies on first contact with an unseen problem. The film stages that death (the factory
seizes on "prove eˣ ≥ 1 + x"), then shows understanding resolving it, then shows the same idea
scaling Class 7 → Olympiad, and closes on invitation, not fear. One mathematical object carries
all thirty seconds. The ad practises what the product preaches: one idea, understood deeply,
instead of four hundred memorised.
