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

## Pass 1

(pending — filled after the first full render + contact sheet review)

## Pass 2

(pending)

## Pass 3 / head-to-head

(pending)
