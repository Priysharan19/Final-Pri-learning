# CRITIQUE.md — self-critique passes

Grading scale: /10 per criterion. Anything below 8 gets rebuilt, not patched.
Criteria: hook strength · typographic craft · motion quality · cinematography
(lens, light, focus, grade) · sound design & dynamic range · reveal craft ·
mathematical honesty · message clarity · restraint · emotional truth.
Head-to-head measuring stick: Apple's iPhone 15 Pro launch film ("Titanium") —
used only as a bar, nothing copied.

## Pass 0 — build-time findings (before the first formal pass)

Issues caught and fixed during construction, logged for honesty:

- **Mix**: the first master's loudest moment was the close (−8.3 dB), not the
  tangent lock (−15.5 dB) — the long VO line talked through the lock and its
  duck suppressed the hit. Split the VO around the lock (gap 11.7–13.2 s),
  boosted the lock cluster, trimmed the close. Now: lock −6.6 dB, close −10.8,
  true near-silence (−49 dB) at 8.0 s, silence by 29.5 s. Verified by
  `scripts/audio-profile.mjs`, not by ear.
- **Grid discipline**: the 15 s cut's edit points sat on a 0.6 s grid against a
  0.5 s musical grid; the gate caught it; the whole cut was retimed (lock 7.0).
- **Hold time**: one 15 s caption held 1.0 s for 5 words; retimed to 1.3 s.
- **Mathematical honesty**: the handwritten proof line referenced g(0) without
  defining g on screen; rewritten to close from the visible idea ("the curve
  never dips below its tangent").
- **Safe zones**: the factory headline at 85 px crossed the 90 px side margin;
  dropped a step and constrained width.

## Pass 1 — full render + contact sheet + five adversarial judges

Method: my own read of the 60-frame contact sheet, plus five independent judge
agents (message/emotion, typographic craft, motion/cinematography, sound
structure from the RMS profile, and a head-to-head against Apple's "Titanium").
Judges saw frames and measured data, not the moving film — grain and micro-drift
are invisible at contact-sheet scale, so "frozen frame" verdicts were re-checked
at full rate before acting.

**Scores (median of judges + self, /10):**
hook 6 · typographic craft 6 · motion 4.5 · cinematography 5.5 · sound 6 ·
reveal craft 6 · mathematical honesty 8 · message clarity 7 · restraint 7.5 ·
emotional truth 6.5. Head-to-head verdict: one shot of eight (the hinge/lock)
would survive in the Titanium reel.

**What was rebuilt (all under 8 → rebuilt, not patched):**
- *Motion/cinematography*: camera drift amplitudes doubled (sub-perceptual at
  feed scale before); factory cards got a raking key, impact shadows, and a
  violent 9 px drop at the seize; ladder gained a constant creep so no hold is
  a dead frame; product panel got perspective, a one-pass light sweep, and the
  panel now writes its ink from 15.9 s with a pen-dot riding the reveal edge.
- *Reveal craft*: the slope chip narrated the approach **and** spoiled the
  answer — it now dies exactly at 12.60 as the resolved equation detonates;
  one text anchor at the payoff; tangent label waits a full second.
- *Sound*: the storyboard's silence finally exists (VO retimed off the seize;
  tail rings out to a −47 dB null at 8.0 s); the double-duck was collapsed;
  pencil-tick foley moved to foreground (post-duck); the ladder now audibly
  escalates; three soft beats land under the hook's word slams.
- *Typography*: caption widows removed with authored line breaks; captions got
  a soft scrim (the tangent stroke ran through the words); the seize card no
  longer breaks its inequality mid-expression; "No ideas." is its own line.
- *Honesty*: "Class 7 · SLOPE" would have handed sceptical parents an error —
  relabelled PROPORTION ("y is always double of x"), which is Class 7 truth.
- *Structure*: the Olympiad station now closes the wound explicitly with a
  "QUESTION 1 · SOLVED" chip mirroring the seize card's kicker.

**Judged and deliberately not changed:**
- "Join the change." stays — the brief mandates it as the closing message.
- The mathfield backdrop stays (reduced) — it is the app's real landing-page
  signature, not decoration.
- The green ✓ chips stay — green is the product's actual marking colour;
  removing it would trade product truth for palette purity.
- No early brand monogram — withholding the reveal to 15 s is the design.
- Storyboard's "One formula for everything." strikethrough beat was never
  built; the two-line "Four hundred formulas. / No ideas." carries the beat
  better. Storyboard updated instead of the film.

## Pass 2 — verification of the rebuild (fresh renders, all gates green)

Every pass-1 rebuild verified on the new contact sheet and probe stills: the
factory reads at feed brightness and jolts at the seize; the sound-off caption
chain is complete; the lock detonates with a single text anchor; the panel is
lit, tilted and *writing* (pen dot on the ink edge); the ladder escalates and
closes the wound with "QUESTION 1 · SOLVED"; captions carry no widows; the mix
verifies (lock −7.0 dB loudest, tail → −47 dB null at 8.0 s, silence by 29.5).
`scripts/check.ts`: **ALL GATES PASS** — including yuv420p after the bt709 flag.

Remaining below 8 after pass 2: motion/cinematography 7.5 (no true 3-D object
rotation; act transitions fade through dark where Apple would cut), emotional
truth 7 (an object film by design — the one human trace is the ink being
written). Pass 3 adds the cheap-but-real cinema: a slow camera roll arc through
the Turn act (the "revolve"), and per-station scale escalation up the ladder.

**Self-grades after pass 2:**
hook 8 · typographic craft 8 · motion 7.5→8 (with pass-3 roll) · cinematography
7.5→8 · sound 8 · reveal craft 8.5 · mathematical honesty 9 · message clarity 8 ·
restraint 8 · emotional truth 7.

## Pass 3 / head-to-head — Apple "Titanium" as the measuring stick

Shot-by-shot, against the discipline (nothing copied):
- **Hook** — survives. Type-first cold opens are a legitimate Apple gesture;
  the gold line under the words is our own promise device. ✓
- **Factory** — survives as *characterisation*: it is deliberately the only
  flat-lit, locked-off act, and the raking key + stamp shadows keep it physical.
  In a straight lighting contest it still loses to aluminium; as an argument it
  doesn't need to win. ✓ (with that caveat recorded)
- **Curve/Hinge/Lock** — the film's case. Lit object, meaningful focus, camera
  arc, earned silence, detonation on the beat. Would not read as the amateur
  shot in the reel. ✓
- **Product/Marked** — much closer after the light sweep, perspective and live
  ink; interior UI type is still smaller than Apple would ever set. Partial.
- **Ladder** — the continuous creep + escalation carries it; individual
  stations held ~1.1 s are information-dense where Apple would give each 3 s
  of air. The film only has 30. Partial — a length problem, not a craft one.
- **Close** — chord lands on the brand, the pill breathes, stillness is now
  alive-still, loop seam authored. ✓
- **Honest verdict**: cut into a Titanium reel, the Turn act belongs; the
  factory and ladder would read as a different (denser, more argumentative)
  school of filmmaking rather than amateur work. That is the film we meant
  to make. Where it still loses: interior-UI type scale, and the absence of
  a physically-simulated ink stroke (Caveat + jitter approximates it).

Final grades: hook 8 · typographic craft 8 · motion 8 · cinematography 8 ·
sound 8 · reveal craft 8.5 · mathematical honesty 9 · message clarity 8 ·
restraint 8 · **emotional truth 7 — the one accepted sub-8**: the brief's own
premise (the mathematics is the hero object) trades human faces for the idea;
within that premise the ink-being-marked is as human as the film gets. Logged
as the weakest thing in HANDOFF.md rather than patched cosmetically.


## Pass 4 — the feature act ("flex all the features", by request)

The 30 s argument film gained what it deliberately withheld: the product's
breadth. Rather than a card montage, THE INSTRUMENT is a depth corridor —
six lit panels fly through the focal plane, one crossing per beat, each a
plausible Dark-LaTeX surface: question bank (the measured 3,44,798), knowledge
map, misconception diagnosis (the anti-factory feature, given the emphasis),
predicted percentile (disclaimed in-frame), Match Mode (rivals labelled
illustrative), criteria-marked mocks — capped by "All of it offline." set
alone as the corridor empties. Master extended 30 → 36 s (house precedent:
the shipped reel is 36.4 s); the 15 s cut stays the tight argument edit.

Verified on the final renders: ALL GATES PASS on the 36 s grid (three new
text beats pixel-linted and contrast-checked); the mix keeps its architecture
(lock still loudest at −7.3 dB; groove under the run; strip-back for the
offline line; silence by 35.5 s). One rebuild inside the pass: the knowledge
map's constellation was too faint at feed scale — nodes/edges brightened to
full gold.

Feature-act self-grades: integration with the argument 8 (the diagnosis panel
keeps the act honest), craft 8 (the corridor is genuinely cinematic; the map
panel is the weakest face), pacing 7.5 (six panels in six beats is dense —
deliberate, but a 45 s cut could let each breathe).
