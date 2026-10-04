# Numeric tolerance policy (per question type)

How close a typed number has to be before Pri's deterministic marker accepts it, stated once per question type so that authors, reviewers and the regression suite read the same rule. The executable form is `client/src/engine/tolerance.js` (rounding policies) and `numsClose()` in `client/src/engine/expr.js` (the default band); `client/test/marker-tolerance-policy-check.mjs` pins every boundary below on both sides, and `client/test/marker-equivalence-classes-check.mjs` pins the equivalent forms.

Two invariants hold everywhere:

- **A model never sets a mark.** Tolerance is arithmetic on two numbers the engine parsed; nothing here consults a model output.
- **Acceptance never widens past the published band.** A policy can accept a second *writing* of the same number (the truncated form beside the rounded form). It cannot accept a different number.

## 1. Default (NCERT practice, NSW practice, exams built from generators)

| Target | Band | Why |
|---|---|---|
| Whole number (`12`, `0`, `−3`) | exact, within floating-point noise (`max(1e-9, |t|·1e-9)`, capped at 0.25) | 12 m² is 120000 cm², not 120012; no other whole number can fall inside the band |
| Non-integer (`3.14159`, `2 − √3`) | **relative 1e-4** (`max(1e-6, |t|·1e-4)`) — about five significant figures | forgives the student's final rounding of a real calculation without admitting a neighbouring value; `0.26795` passes for `2 − √3`, `0.268` does not |
| Authored `tol` | `|given − target| ≤ tol` | the question states how its answer is measured or rounded ("to one decimal place" authors `tol: 0.05`); an authored `tol` always wins over every default |

Equivalent exact forms (`1/2`, `0.5`, `2/4`, `√8`, `2√2`, `2 1/2`) are all read to their value first, so the band applies to the value, not the spelling.

## 2. Form-sensitive numeric answers

| Flag on `answer` | Rule |
|---|---|
| `requireExact: true` | the value must match the exact band even when written as a decimal: `1/3` and `0.333333333333` pass, `0.333` does not ("this question wants an exact value") |
| `simplestFraction: {n, d}` | the fraction must be in lowest terms when the prompt asks for a fraction; where the prompt never asked, the exact decimal passes but a rounded one does not |
| `surdForm: {k, r}` | `k√r` exactly; an equivalent unsimplified surd is refused with its reason |
| `percent: true` | `25`, `25%` and `0.25` are one answer; the `%` sign alone is never a second chance (`0.25%` is wrong). Without the flag, a prompt that asks for a *percentage* still reads the written `%` (`25%` passes) but a bare `0.25` is not 25 |
| `forbid` (regex) | a form the question forbids (an unrationalised denominator) is refused with `forbidWhy` even when the value is right |

## 3. Angles (degrees vs radians)

`answerSuffix: '°'` (or `answer.angle: 'deg' | 'rad'`) makes the answer an angle. The unit the student writes decides how the number is read: `60°`, `60 degrees`, `π/3 rad`, a bare multiple of π (radian) and a bare number in the question's unit are one answer; `60 rad` is not `60°`. A value written in the *other* unit was rounded in that unit (`1.0472 rad`), so it is compared in the relative 1e-4 band rather than the whole-number exact band; `1.05 rad` (60.16°) is still refused.

## 4. Complex numbers (`a + bi` and polar)

`answerType: 'complex'`, `answer: { re, im, tol? }`. Rectangular input (`3 + 4i`, `4i + 3`, `(6 + 8i)/2`) is compared part by part in the default band. Polar input (`5(cos 53.13° + i sin 53.13°)`, `5 cis 53.13°`, `5∠53.13°`, `5e^{i·0.9273}`) carries an argument written to a few decimal places, so each part is compared within `max(tol, 2·10⁻³·max(1, |z|))`; the conjugate, the swapped parts and the modulus alone are refused and named.

## 5. JEE numerical-value questions (NTA rounding)

Reviewed JEE questions declare the published rule on the record (`answer.rounding`); nothing is inferred from the year or paper.

| `rounding` | Published rule | What the marker accepts | Refused |
|---|---|---|---|
| `nta-2dp` | answer "truncated/rounded off to the second decimal place" (JEE Advanced numerical; JEE Main numerical before the nearest-integer rule) | the **rounded** two-decimal writing, the **truncated** two-decimal writing, and any value within half a unit of the second decimal (`|given − key| ≤ 0.005`): `2.68` and `2.67` for `2.679`, `−0.42` and `−0.41` for `−0.4167` | the next two-decimal value beyond those (`3.13`, `3.15` for `3.14159`; `2.66`, `2.69` for `2.679`) |
| `nta-integer` | answer "rounded off to the nearest integer" (JEE Main numerical) | the key's integer, rounded half away from zero (`7.5 → 8`, `−2.5 → −3`), **and** the exact unrounded value, because writing `7.4` for a key of `7` is not a mathematical mistake | every other integer; a different decimal (`7.3`, `7.5` for `7.4`) |
| official band (`tol`) | the key published an accepted range | `|given − key| ≤ tol` — the range wins over both rules above | outside the range |

Where a reviewed record carries no `rounding` and no `tol`, the default band of section 1 applies.

## 6. Non-numeric answer types

Interval, set, matrix, vector, point and ratio answers compare each component with the default band (or the authored `tol`); endpoint inclusion, direction of an inequality, order of coordinates, the transpose of a matrix and the sign of a vector are compared exactly and the near miss is named.

## Evidence status

Every band above is pinned by deterministic, authored test cases against the engine's own parser. That is **synthetic self-consistency evidence**: it shows what the marker accepts and refuses for typed input; it is not a measured accuracy claim on student answers, and no human-review or physical-device evidence is implied.
