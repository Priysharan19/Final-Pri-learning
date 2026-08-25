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

## Pass 2

(pending)

## Pass 3 / head-to-head

(pending)
