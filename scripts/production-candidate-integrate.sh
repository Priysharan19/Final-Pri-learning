#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
START_SHA="$(git rev-parse HEAD)"
CLASS10_REF="origin/india/class10-ncert-full-integration"
AUTH_REF="origin/feature/auth-email-delivery-links"

git config user.name "Pri Learning Release Automation"
git config user.email "actions@users.noreply.github.com"
git fetch origin india/class10-ncert-full-integration feature/auth-email-delivery-links

# A push of the finished product commit retriggers the lightweight workflow.
# Detect that state and do nothing instead of attempting a second integration.
if git merge-base --is-ancestor "$CLASS10_REF" HEAD && git merge-base --is-ancestor "$AUTH_REF" HEAD; then
  echo "Production product slices are already integrated at $(git rev-parse --short HEAD)."
  exit 0
fi

allowed_conflict() {
  case "$1" in
    .github/workflows/*|client/src/engine/ncert/class10-2026-27-production.js|client/src/pages/Classes.jsx|client/test/india-class10-current-source-check.mjs|client/test/india-practice-availability-check.mjs)
      return 0 ;;
    *) return 1 ;;
  esac
}

# ---------------------------------------------------------------------------
# 1. Integrate the complete Class X source/mastery branch without accepting its
#    older collapsed curriculum shape or allowing it to rewrite release CI.
# ---------------------------------------------------------------------------
set +e
git merge --no-ff --no-commit "$CLASS10_REF"
MERGE_STATUS=$?
set -e
if [ "$MERGE_STATUS" -ne 0 ]; then
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    if ! allowed_conflict "$path"; then
      echo "::error::Unexpected Class 10 merge conflict: $path"
      git merge --abort || true
      exit 1
    fi
  done < <(git diff --name-only --diff-filter=U)
fi

# Workflow policy remains owned by the hardened release branch. Restoring it
# before the merge commit also means the Actions token never pushes workflow
# changes, which GitHub correctly forbids without the workflows permission.
git checkout "$START_SHA" -- .github/workflows

# Keep the newer cloud/classroom Classes surface and add the bundled Class X
# mastery library beside it.
git checkout --ours client/src/pages/Classes.jsx 2>/dev/null || git checkout "$START_SHA" -- client/src/pages/Classes.jsx
python - <<'PY'
from pathlib import Path
p = Path('client/src/pages/Classes.jsx')
s = p.read_text()
needle = "import AssignmentInboxPanel from '../components/AssignmentInboxPanel.jsx';\n"
assert needle in s, 'newer Classes surface no longer contains AssignmentInboxPanel import'
if "Class10NCERTLibrary" not in s:
    s = s.replace(needle, needle + "import Class10NCERTLibrary from '../components/Class10NCERTLibrary.jsx';\n")
needle = "      <AssignmentInboxPanel />\n"
assert needle in s, 'newer Classes surface no longer renders AssignmentInboxPanel'
if "<Class10NCERTLibrary />" not in s:
    s = s.replace(needle, needle + "\n      {Number(user.year) === 10 && <Class10NCERTLibrary />}\n")
p.write_text(s)
PY

# Keep the stricter four-outcome source truth from the foundation branch, then
# earn 14/14 coverage by adding exact reviewed forms instead of collapsing the
# syllabus claims.
git checkout "$START_SHA" -- client/src/engine/ncert/class10-2026-27-production.js
python - <<'PY'
from pathlib import Path
p = Path('client/src/engine/ncert/class10-2026-27-production.js')
s = p.read_text()

def replace_chapter(chapter_id, block):
    global s
    start = s.index(f"  chapter('{chapter_id}'")
    marker = "\n\n  chapter("
    end = s.find(marker, start + 1)
    if end < 0:
        end = s.index("\n]);", start)
    s = s[:start] + block.rstrip() + s[end:]

replace_chapter('c10-real-numbers', r'''  chapter('c10-real-numbers', [
    'Apply the Fundamental Theorem of Arithmetic and prime factorisation to integer problems',
    'Prove irrationality results such as √2, √3 and √5 by contradiction'
  ], [
    // Legacy D1/D4 explicitly teach Euclid/remainder forms. Only D2/D3 count
    // for the current FTA outcome; irrationality has its own proof generator.
    cover('c10-real-numbers', [0], [2, 3]),
    cover('c10-irrationality-proofs', [1], [1, 2, 3, 4])
  ], true),''')

replace_chapter('c10-polynomials', r'''  chapter('c10-polynomials', [
    'Find zeroes of a polynomial graphically and algebraically',
    'Relate the zeroes of a quadratic polynomial to its coefficients'
  ], [
    cover('c10-polynomial-zeroes', [0], [1, 2]),
    cover('c10-polynomial-zeroes', [1], [3, 4])
  ], true),''')

replace_chapter('c10-pair-linear-equations', r'''  chapter('c10-pair-linear-equations', [
    'Solve a pair of linear equations graphically and decide consistency or inconsistency',
    'Use algebraic conditions to determine the number of solutions of a pair of linear equations',
    'Solve a pair of linear equations by substitution and elimination',
    'Model and solve simple situational problems using a pair of linear equations'
  ], [
    cover('c10-linear-graphs', [0], [1, 2, 3, 4]),
    cover('c10-linear-solution-conditions', [1], [1, 2, 3, 4]),
    cover('y10-simeq', [2], [1, 2, 3]),
    cover('y10-simeq', [3], [4])
  ], true),''')

replace_chapter('c10-quadratic-equations', r'''  chapter('c10-quadratic-equations', [
    'Solve real-root quadratic equations by factorisation',
    'Solve real-root quadratic equations using the quadratic formula',
    'Use the discriminant to classify the nature of the roots',
    'Formulate and solve situational problems leading to a quadratic equation'
  ], [
    cover('y10-quadratics', [0], [1, 3]),
    cover('y10-quadratics', [1], [4]),
    cover('c10-quadratic-discriminant', [2], [1, 2, 3, 4]),
    cover('c10-quadratic-context', [3], [1, 2, 3, 4])
  ], true),''')

replace_chapter('c10-triangles', r'''  chapter('c10-triangles', [
    'Prove and apply the Basic Proportionality Theorem and its converse',
    'Establish and apply the prescribed similarity criteria for triangles'
  ], [
    cover('c10-triangles-current', [0], [1, 2]),
    cover('c10-triangles-current', [1], [3, 4])
  ], true),''')

replace_chapter('c10-trigonometry', r'''  chapter('c10-trigonometry', [
    'Use trigonometric ratios of an acute angle in a right triangle',
    'Use the exact trigonometric values at 30°, 45° and 60°',
    'Motivate the trigonometric ratios defined at 0° and 90° and relate the trigonometric ratios',
    'Prove and apply simple identities based on sin²A + cos²A = 1'
  ], [
    cover('c10-trigonometry-current', [0], [1]),
    cover('c10-trigonometry-current', [1], [2]),
    cover('c10-trig-boundary-relations', [2], [1, 2, 3, 4]),
    cover('c10-trigonometry-current', [3], [3, 4])
  ], true),''')

replace_chapter('c10-trig-applications', r'''  chapter('c10-trig-applications', [
    'Solve heights-and-distances problems using 30°, 45° and 60° angles of elevation or depression with no more than two right triangles'
  ], [
    cover('c10-trig-applications-current', [0], [1, 2, 3, 4])
  ], true),''')

replace_chapter('c10-surface-volume', r'''  chapter('c10-surface-volume', [
    'Find surface areas of combinations of two prescribed solids',
    'Find volumes of combinations of two prescribed solids'
  ], [
    cover('c10-surface-area-combo', [0], [1, 2, 3, 4]),
    cover('c10-surface-volume-combo', [1], [1, 2])
  ], true),''')

s = s.replace('// Current Class X source shape. A missing `covers` entry is intentional evidence\n// of a product gap, not an invitation to route to the nearest generic generator.\n',
              '// Current Class X source shape. Production readiness is earned by exact,\n// source-bounded generators for every declared outcome.\n')
p.write_text(s)
PY

# Three source outcomes deliberately kept separate from the older Class10 branch
# need dedicated question forms.
cat > client/src/engine/generators/india-class10-production-gaps.js <<'EOF'
import { ri, rc, mcq } from '../qhelpers.js';

const SOLUTION_LABELS = Object.freeze({
  unique: 'Exactly one solution',
  none: 'No solution',
  infinite: 'Infinitely many solutions'
});

const equation = ([a, b, c]) => `$${a}x+${b}y=${c}$`;

function linearFixture(rng, kind) {
  const a = ri(rng, 1, 5), b = ri(rng, 1, 5), c = ri(rng, 2, 10), k = ri(rng, 2, 4);
  const first = [a, b, c];
  if (kind === 'unique') return { first, second: [a * k, b * k + 1, c * k] };
  if (kind === 'none') return { first, second: [a * k, b * k, c * k + 1] };
  return { first, second: [a * k, b * k, c * k] };
}

export function currentLinearSolutionConditions(rng, diff) {
  const kind = diff === 1 ? 'unique' : diff === 2 ? 'none' : diff === 3 ? 'infinite' : rc(rng, ['unique', 'none', 'infinite']);
  const { first, second } = linearFixture(rng, kind);
  const [a1, b1, c1] = first, [a2, b2, c2] = second;
  const correct = SOLUTION_LABELS[kind];
  const distractors = Object.values(SOLUTION_LABELS)
    .filter(text => text !== correct)
    .map(text => ({ text, why: 'Compare the Class X coefficient ratios before deciding the number of solutions.' }));
  distractors.push({ text: 'The coefficients are insufficient', why: 'The coefficient-ratio conditions determine the solution count directly.' });
  const m = mcq(rng, correct, distractors);
  const comparison = kind === 'unique'
    ? `$\\dfrac{a_1}{a_2}\\ne\\dfrac{b_1}{b_2}$`
    : kind === 'none'
      ? `$\\dfrac{a_1}{a_2}=\\dfrac{b_1}{b_2}\\ne\\dfrac{c_1}{c_2}$`
      : `$\\dfrac{a_1}{a_2}=\\dfrac{b_1}{b_2}=\\dfrac{c_1}{c_2}$`;
  return {
    prompt: `Without drawing a graph, use the algebraic coefficient conditions to determine the number of solutions of ${equation(first)} and ${equation(second)}.`,
    answerType: 'mcq',
    answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps },
    mcqOptions: m.options,
    hints: ['Compare $a_1/a_2$, $b_1/b_2$ and, when needed, $c_1/c_2$.', comparison, `This condition gives: ${correct}.`],
    steps: [
      { h: 'Identify coefficients', d: `$a_1=${a1}, b_1=${b1}, c_1=${c1};\\;a_2=${a2}, b_2=${b2}, c_2=${c2}$.` },
      { h: 'Compare the ratios', d: comparison },
      { h: 'Classify the pair', d: correct }
    ],
    dotpoint: 1,
    solutionCondition: kind
  };
}

function polynomialText(b, c) {
  const bx = b === 0 ? '' : ` ${b > 0 ? '+' : '-'} ${Math.abs(b)}x`;
  const cc = c === 0 ? '' : ` ${c > 0 ? '+' : '-'} ${Math.abs(c)}`;
  return `x^2${bx}${cc}`;
}

function discriminantFixture(rng, kind) {
  if (kind === 'positive') {
    const r1 = ri(rng, 1, 5), r2 = r1 + ri(rng, 1, 4);
    const b = -(r1 + r2), c = r1 * r2;
    return { b, c, D: b * b - 4 * c };
  }
  if (kind === 'zero') {
    const r = ri(rng, 1, 6), b = -2 * r, c = r * r;
    return { b, c, D: 0 };
  }
  const m = ri(rng, 1, 5), t = ri(rng, 1, 5), b = -2 * m, c = m * m + t;
  return { b, c, D: -4 * t };
}

export function currentQuadraticDiscriminant(rng, diff) {
  const kind = diff === 1 ? 'positive' : diff === 2 ? 'zero' : diff === 3 ? 'negative' : rc(rng, ['positive', 'zero', 'negative']);
  const { b, c, D } = discriminantFixture(rng, kind);
  const correct = kind === 'positive' ? 'Two distinct real roots' : kind === 'zero' ? 'Two equal real roots' : 'No real roots';
  const pool = [
    { text: 'Two distinct real roots', why: 'This requires a positive discriminant.' },
    { text: 'Two equal real roots', why: 'This requires discriminant zero.' },
    { text: 'No real roots', why: 'This occurs when the discriminant is negative.' },
    { text: 'The nature of the roots cannot be determined', why: 'The sign of the discriminant determines the nature of the roots.' }
  ].filter(option => option.text !== correct);
  const m = mcq(rng, correct, pool);
  return {
    prompt: `For $${polynomialText(b, c)}=0$, use the discriminant to determine the nature of the roots.`,
    answerType: 'mcq',
    answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps },
    mcqOptions: m.options,
    hints: ['$D=b^2-4ac$.', `Here $a=1$, $b=${b}$ and $c=${c}$.`, `$D=${D}$, so use its sign to classify the roots.`],
    steps: [
      { h: 'Write the discriminant', d: '$D=b^2-4ac$' },
      { h: 'Substitute', d: `$D=(${b})^2-4(1)(${c})=${D}$` },
      { h: 'Classify', d: correct }
    ],
    dotpoint: 2,
    discriminant: D,
    rootNature: kind
  };
}

const BOUNDARY_SCENARIOS = Object.freeze([
  {
    skill: 'sin-zero',
    prompt: 'Which boundary-angle value is correct?',
    correct: '$\\sin0^\\circ=0$',
    distractors: ['$\\sin0^\\circ=1$', '$\\sin0^\\circ=\\frac12$', '$\\sin0^\\circ$ is undefined']
  },
  {
    skill: 'cos-ninety',
    prompt: 'Which boundary-angle value is correct?',
    correct: '$\\cos90^\\circ=0$',
    distractors: ['$\\cos90^\\circ=1$', '$\\cos90^\\circ=\\frac12$', '$\\cos90^\\circ$ is undefined']
  },
  {
    skill: 'tangent-boundary',
    prompt: 'Which statement about tangent at the boundary angles is correct?',
    correct: '$\\tan0^\\circ=0$ and $\\tan90^\\circ$ is undefined',
    distractors: [
      '$\\tan0^\\circ=1$ and $\\tan90^\\circ$ is undefined',
      '$\\tan0^\\circ=0$ and $\\tan90^\\circ=0$',
      '$\\tan0^\\circ$ is undefined and $\\tan90^\\circ=0$'
    ]
  },
  {
    skill: 'ratio-relation',
    prompt: 'Which identity correctly relates the three basic trigonometric ratios for an acute angle $A$?',
    correct: '$\\tan A=\\dfrac{\\sin A}{\\cos A}$',
    distractors: [
      '$\\tan A=\\dfrac{\\cos A}{\\sin A}$',
      '$\\tan A=\\sin A\\cos A$',
      '$\\tan A=\\dfrac{1}{\\sin A\\cos A}$'
    ]
  }
]);

export function currentTrigBoundaryRelations(rng, diff) {
  const scenario = BOUNDARY_SCENARIOS[Math.max(0, Math.min(3, diff - 1))];
  const m = mcq(rng, scenario.correct, scenario.distractors.map(text => ({
    text,
    why: 'Check the Class X boundary-value table and the definition $\\tan A=\\sin A/\\cos A$.'
  })));
  return {
    prompt: scenario.prompt,
    answerType: 'mcq',
    answer: { correctIndex: m.correctIndex, optionTraps: m.optionTraps },
    mcqOptions: m.options,
    hints: [
      'Use only the 0°/90° boundary values and the basic right-triangle ratio relationships.',
      '$\\sin0^\\circ=0,\\;\\cos0^\\circ=1,\\;\\sin90^\\circ=1,\\;\\cos90^\\circ=0$.'
    ],
    steps: [
      { h: 'Recall the boundary values', d: '$\\sin0^\\circ=0,\\;\\cos0^\\circ=1,\\;\\sin90^\\circ=1,\\;\\cos90^\\circ=0$.' },
      { h: 'Relate the ratios', d: '$\\tan A=\\dfrac{\\sin A}{\\cos A}$ whenever $\\cos A\\ne0$.' },
      { h: 'Choose the valid statement', d: scenario.correct }
    ],
    dotpoint: 2,
    boundarySkill: scenario.skill
  };
}
EOF

python - <<'PY'
from pathlib import Path

# Wire the three exact forms into the Class X bank itself.
p = Path('client/src/engine/generators/india-class10.js')
s = p.read_text()
needle = "import { currentClass10Trigonometry, currentClass10TrigApplications } from './india-class10-trigonometry.js';\n"
assert needle in s
if 'india-class10-production-gaps.js' not in s:
    s = s.replace(needle, needle + "import { currentLinearSolutionConditions, currentQuadraticDiscriminant, currentTrigBoundaryRelations } from './india-class10-production-gaps.js';\n")
for needle, line in [
    ("  'c10-linear-graphs': currentLinearPairGraphs,\n", "  'c10-linear-solution-conditions': currentLinearSolutionConditions,\n"),
    ("  'c10-quadratic-context': currentQuadraticContext,\n", "  'c10-quadratic-discriminant': currentQuadraticDiscriminant,\n"),
    ("  'c10-trigonometry-current': currentClass10Trigonometry,\n", "  'c10-trig-boundary-relations': currentTrigBoundaryRelations,\n")
]:
    assert needle in s
    if line not in s:
        s = s.replace(needle, needle + line)
p.write_text(s)

# The lazy resolver is explicit; a generator that is not listed here is not a
# production generator even if its function exists.
p = Path('client/src/engine/generators/index.js')
s = p.read_text()
needle = "  'c10-linear-graphs': 'india-class10',\n"
assert needle in s
for line in [
    "  'c10-linear-solution-conditions': 'india-class10',\n",
    "  'c10-quadratic-discriminant': 'india-class10',\n",
    "  'c10-trig-boundary-relations': 'india-class10',\n"
]:
    if line not in s:
        s = s.replace(needle, needle + line)
        needle = line
p.write_text(s)

# Contextual quadratics are the fourth strict source outcome, not the collapsed
# third outcome from the older branch.
p = Path('client/src/engine/generators/india-class10-quadratic-context.js')
s = p.read_text()
assert 'return { ...q, dotpoint: 2 };' in s
p.write_text(s.replace('return { ...q, dotpoint: 2 };', 'return { ...q, dotpoint: 3 };'))

# Identity forms are the fourth strict trigonometry outcome. Exact-angle forms
# remain dot point 1 (the second outcome), so only identity tags move.
p = Path('client/src/engine/generators/india-class10-trigonometry.js')
s = p.read_text()
old = "      dotpoint: 2,\n      trigSkill: 'pythagorean-identity-application'"
assert old in s
s = s.replace(old, "      dotpoint: 3,\n      trigSkill: 'pythagorean-identity-application'")
old = "    dotpoint: 2,\n    trigSkill: 'identity-proof-step'"
assert old in s
s = s.replace(old, "    dotpoint: 3,\n    trigSkill: 'identity-proof-step'")
p.write_text(s)

# Align the focused tests with those strict source ordinals.
p = Path('client/test/india-class10-quadratic-context-current-check.mjs')
s = p.read_text()
assert 'assert.equal(q.dotpoint, 2,' in s
p.write_text(s.replace('assert.equal(q.dotpoint, 2,', 'assert.equal(q.dotpoint, 3,'))

p = Path('client/test/india-class10-trigonometry-current-check.mjs')
s = p.read_text()
old = "    } else if (diff === 3) {\n      assert.equal(q.dotpoint, 2);"
assert old in s
s = s.replace(old, "    } else if (diff === 3) {\n      assert.equal(q.dotpoint, 3);")
old = "    } else {\n      assert.equal(q.dotpoint, 2);"
assert old in s
s = s.replace(old, "    } else {\n      assert.equal(q.dotpoint, 3);")
p.write_text(s)
PY

cat > client/test/india-class10-production-gap-check.mjs <<'EOF'
import assert from 'node:assert/strict';
import { makeRng } from '../src/engine/qhelpers.js';
import { bankOf } from '../src/engine/generators/index.js';
import { indiaClass10 } from '../src/engine/generators/india-class10.js';
import {
  currentLinearSolutionConditions,
  currentQuadraticDiscriminant,
  currentTrigBoundaryRelations
} from '../src/engine/generators/india-class10-production-gaps.js';

const registry = [
  ['c10-linear-solution-conditions', currentLinearSolutionConditions],
  ['c10-quadratic-discriminant', currentQuadraticDiscriminant],
  ['c10-trig-boundary-relations', currentTrigBoundaryRelations]
];
for (const [id, fn] of registry) {
  assert.equal(bankOf(id), 'india-class10', `${id} must resolve through the Class 10 lazy bank`);
  assert.equal(indiaClass10[id], fn, `${id} must resolve to the reviewed production form`);
}

const linearKinds = new Set(), rootKinds = new Set(), boundarySkills = new Set();
for (let seed = 1; seed <= 48; seed++) {
  for (let diff = 1; diff <= 4; diff++) {
    const linear = currentLinearSolutionConditions(makeRng(seed * 3011 + diff), diff);
    assert.equal(linear.dotpoint, 1);
    assert.equal(linear.answerType, 'mcq');
    assert.equal(linear.mcqOptions.length, 4);
    assert.ok(linear.steps.length >= 3 && linear.hints.length >= 3);
    assert.match(linear.prompt, /algebraic coefficient conditions/i);
    linearKinds.add(linear.solutionCondition);

    const quad = currentQuadraticDiscriminant(makeRng(seed * 3023 + diff), diff);
    assert.equal(quad.dotpoint, 2);
    assert.equal(quad.answerType, 'mcq');
    assert.equal(quad.mcqOptions.length, 4);
    assert.ok(Number.isFinite(quad.discriminant));
    if (quad.rootNature === 'positive') assert.ok(quad.discriminant > 0);
    if (quad.rootNature === 'zero') assert.equal(quad.discriminant, 0);
    if (quad.rootNature === 'negative') assert.ok(quad.discriminant < 0);
    assert.match([quad.prompt, ...quad.hints, ...quad.steps.flatMap(x => [x.h, x.d])].join(' '), /discriminant|b\^2-4ac/i);
    rootKinds.add(quad.rootNature);

    const trig = currentTrigBoundaryRelations(makeRng(seed * 3037 + diff), diff);
    assert.equal(trig.dotpoint, 2);
    assert.equal(trig.answerType, 'mcq');
    assert.equal(trig.mcqOptions.length, 4);
    assert.ok(trig.steps.length >= 3 && trig.hints.length >= 2);
    const all = [trig.prompt, ...trig.hints, ...trig.steps.flatMap(x => [x.h, x.d])].join(' ');
    assert.match(all, /0\^?°|90\^?°|tan A|sin A|cos A/i);
    assert.ok(!/radian|unit circle|quadrant|180°|270°|360°/i.test(all));
    boundarySkills.add(trig.boundarySkill);
  }
}
assert.deepEqual([...linearKinds].sort(), ['infinite', 'none', 'unique']);
assert.deepEqual([...rootKinds].sort(), ['negative', 'positive', 'zero']);
assert.deepEqual([...boundarySkills].sort(), ['cos-ninety', 'ratio-relation', 'sin-zero', 'tangent-boundary']);
console.log('PASS — separated Class X algebraic-solution, discriminant and 0°/90° outcomes have dedicated bounded generators.');
EOF

cat > client/test/india-class10-current-source-check.mjs <<'EOF'
import assert from 'node:assert/strict';
import { IN_CURRICULUM, uncoveredDotpoints } from '../src/engine/curriculum-in.js';
import { CBSE_CLASS10_2026_27_CHAPTERS, CBSE_CLASS10_2026_27_REVIEWED_IDS, CBSE_CLASS10_2026_27_SOURCE } from '../src/engine/ncert/class10-2026-27-production.js';
import { INDIA_CONTENT_QUALITY, INDIA_RELEASE_STATE, indiaProductionStatus } from '../src/engine/indiaProductionMeta.js';

const group = IN_CURRICULUM.find(row => row.grade === 10);
assert.ok(group);
assert.equal(group.chapters.length, 14);
assert.equal(CBSE_CLASS10_2026_27_CHAPTERS.length, 14);
assert.equal(CBSE_CLASS10_2026_27_SOURCE.curriculumVersion, 'CBSE-2026-27');
assert.equal(CBSE_CLASS10_2026_27_SOURCE.reviewedAt, '2026-09-03');
assert.deepEqual(CBSE_CLASS10_2026_27_SOURCE.constraints.heightsAndDistancesAnglesDeg, [30, 45, 60]);
assert.equal(CBSE_CLASS10_2026_27_SOURCE.constraints.heightsAndDistancesMaxRightTriangles, 2);
assert.deepEqual(CBSE_CLASS10_2026_27_SOURCE.constraints.circleSegmentCentralAnglesDeg, [60, 90, 120]);
assert.ok(CBSE_CLASS10_2026_27_SOURCE.legacyExcludedOutcomes.some(x => /Euclid/i.test(x)));
assert.ok(CBSE_CLASS10_2026_27_SOURCE.legacyExcludedOutcomes.some(x => /recasting|melting/i.test(x)));
assert.ok(CBSE_CLASS10_2026_27_SOURCE.legacyExcludedOutcomes.some(x => /ogive|cumulative/i.test(x)));

const sourceById = Object.fromEntries(CBSE_CLASS10_2026_27_CHAPTERS.map(ch => [ch.id, ch]));
assert.equal(sourceById['c10-pair-linear-equations'].dotpoints.length, 4);
assert.match(sourceById['c10-pair-linear-equations'].dotpoints[1], /algebraic conditions/i);
assert.equal(sourceById['c10-quadratic-equations'].dotpoints.length, 4);
assert.match(sourceById['c10-quadratic-equations'].dotpoints[2], /discriminant/i);
assert.equal(sourceById['c10-trigonometry'].dotpoints.length, 4);
assert.match(sourceById['c10-trigonometry'].dotpoints[2], /0° and 90°/);

assert.equal(CBSE_CLASS10_2026_27_REVIEWED_IDS.size, 14);
for (const chapter of group.chapters) {
  const status = indiaProductionStatus(chapter, 10);
  assert.deepEqual(uncoveredDotpoints(chapter), [], `${chapter.id}: every current source outcome must have exact practice`);
  assert.equal(status.quality, INDIA_CONTENT_QUALITY.REVIEWED_MAPPING, `${chapter.id}: source-reviewed mapping`);
  assert.equal(status.releaseState, INDIA_RELEASE_STATE.REVIEWED);
  assert.equal(status.sourceReviewed, true);
  assert.equal(status.generatorComplete, true);
}

assert.deepEqual(sourceById['c10-pair-linear-equations'].covers, [
  { gen: 'c10-linear-graphs', dp: [0], diff: [1, 2, 3, 4] },
  { gen: 'c10-linear-solution-conditions', dp: [1], diff: [1, 2, 3, 4] },
  { gen: 'y10-simeq', dp: [2], diff: [1, 2, 3] },
  { gen: 'y10-simeq', dp: [3], diff: [4] }
]);
assert.deepEqual(sourceById['c10-quadratic-equations'].covers, [
  { gen: 'y10-quadratics', dp: [0], diff: [1, 3] },
  { gen: 'y10-quadratics', dp: [1], diff: [4] },
  { gen: 'c10-quadratic-discriminant', dp: [2], diff: [1, 2, 3, 4] },
  { gen: 'c10-quadratic-context', dp: [3], diff: [1, 2, 3, 4] }
]);
assert.deepEqual(sourceById['c10-trigonometry'].covers, [
  { gen: 'c10-trigonometry-current', dp: [0], diff: [1] },
  { gen: 'c10-trigonometry-current', dp: [1], diff: [2] },
  { gen: 'c10-trig-boundary-relations', dp: [2], diff: [1, 2, 3, 4] },
  { gen: 'c10-trigonometry-current', dp: [3], diff: [3, 4] }
]);
assert.deepEqual(sourceById['c10-surface-volume'].covers, [
  { gen: 'c10-surface-area-combo', dp: [0], diff: [1, 2, 3, 4] },
  { gen: 'c10-surface-volume-combo', dp: [1], diff: [1, 2] }
]);
const allCovers = CBSE_CLASS10_2026_27_CHAPTERS.flatMap(ch => ch.covers);
assert.equal(allCovers.some(c => c.gen === 'y10-trig'), false);
assert.equal(allCovers.some(c => c.gen === 'y10-similarity'), false);
assert.equal(sourceById['c10-surface-volume'].covers.find(c => c.gen === 'c10-surface-volume-combo').diff.some(d => d >= 3), false);
assert.equal(sourceById['c10-statistics'].covers.some(c => c.diff.includes(4)), false);
console.log('PASS — Class 10 2026–27 source truth is 14/14 reviewed without collapsing distinct current outcomes.');
EOF

cat > client/test/india-practice-availability-check.mjs <<'EOF'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { practiceTargetAvailable, topicAvailability } from '../src/engine/curriculumAvailability.js';

const grade10 = IN_CURRICULUM.find(group => group.grade === 10);
assert.ok(grade10);
function decorated(source) {
  return {
    ...source,
    dotpoints: source.dotpoints.map((text, ordinal) => ({
      text,
      generated: (source.covers || []).some(cover => cover.dp.includes(ordinal) && (cover.diff || []).length > 0)
    }))
  };
}
for (const source of grade10.chapters) {
  const chapter = decorated(source);
  const state = topicAvailability(chapter);
  assert.equal(state.complete, true, `${chapter.id}: every current outcome should be authored`);
  assert.equal(state.selectable, true, `${chapter.id}: reviewed chapter should be selectable`);
  assert.equal(state.available, state.total);
  for (let i = 0; i < chapter.dotpoints.length; i++) {
    assert.equal(practiceTargetAvailable(chapter, i), true, `${chapter.id} dot point ${i + 1}`);
  }
}
const home = readFileSync(new URL('../src/pages/Home.jsx', import.meta.url), 'utf8');
assert.ok(home.includes("from '../engine/curriculumAvailability.js'"));
assert.ok(home.includes('Coming soon'), 'incomplete curriculum outside reviewed Class X must still fail closed');
assert.ok(home.includes('Question forms coming soon'));
assert.ok(home.includes('disabled={!available}'));
assert.ok(home.includes('disabled={impossibleTarget}'));
console.log('PASS — every current Class X target is selectable while incomplete curriculum elsewhere still fails closed.');
EOF

# Resolve/record the Class10 merge only after product files and tests express the
# stricter source truth. No workflow file differs from the first parent.
git add -A
if git diff --name-only --diff-filter=U | grep -q .; then
  echo "::error::Unresolved Class 10 conflicts remain"
  git diff --name-only --diff-filter=U
  exit 1
fi
git commit -m "feat(class10): integrate complete source mastery with strict current outcomes"

# ---------------------------------------------------------------------------
# 2. Integrate account verification/reset email delivery. Again, workflow policy
#    is restored before the merge commit so the push is product-only.
# ---------------------------------------------------------------------------
PRE_AUTH_SHA="$(git rev-parse HEAD)"
set +e
git merge --no-ff --no-commit "$AUTH_REF"
AUTH_STATUS=$?
set -e
if [ "$AUTH_STATUS" -ne 0 ]; then
  while IFS= read -r path; do
    [ -z "$path" ] && continue
    case "$path" in
      .github/workflows/*) ;;
      *)
        echo "::error::Unexpected auth merge conflict: $path"
        git merge --abort || true
        exit 1 ;;
    esac
  done < <(git diff --name-only --diff-filter=U)
fi
git checkout "$PRE_AUTH_SHA" -- .github/workflows
git add -A
if git diff --name-only --diff-filter=U | grep -q .; then
  echo "::error::Unresolved auth conflicts remain"
  git diff --name-only --diff-filter=U
  exit 1
fi
git commit -m "feat(auth): integrate secure verification and reset email delivery"

# ---------------------------------------------------------------------------
# 3. Validate the combined candidate. These are direct commands, so no persistent
#    CI workflow modification is required to prove the release candidate.
# ---------------------------------------------------------------------------
npm ci --prefix client
npm ci --prefix server

node client/test/india-class10-current-source-check.mjs
node client/test/india-class10-production-gap-check.mjs
node client/test/india-class10-polynomial-current-check.mjs
node client/test/india-class10-triangles-current-check.mjs
node client/test/india-class10-irrationality-current-check.mjs
node client/test/india-class10-linear-graphs-current-check.mjs
node client/test/india-class10-quadratic-context-current-check.mjs
node client/test/india-class10-surface-combo-current-check.mjs
node client/test/india-class10-trigonometry-current-check.mjs
node client/test/ncert-class10-full-book-check.mjs
node client/test/class10-ncert-product-check.mjs
node client/test/india-practice-availability-check.mjs
node client/test/india-production-meta-check.mjs
node client/test/india-check.mjs

node server/test/auth-delivery-worker-check.mjs
node server/test/auth-delivery-config-check.mjs
node client/test/account-action-boundary-check.mjs

node client/test/classroom-product-check.mjs
node client/test/assignment-staff-product-check.mjs
node client/test/cloud-session-refresh-check.mjs
node server/test/platform-sync-pagination-check.mjs
node server/test/platform-schema-check.mjs
node server/test/platform-migration-check.mjs
node server/test/account-lifecycle-contract-check.mjs
node server/test/razorpay-billing-check.mjs
node server/test/apple-billing-check.mjs

npm test
(cd client && npx playwright install --with-deps chromium)
npm run test:e2e
npm run test:a11y
npm run build
npm run sync:ios
npm run check:ios

# The helper has done its job. Deleting a non-workflow helper is allowed; the
# lightweight workflow remains byte-for-byte unchanged in the pushed tree.
rm -f scripts/production-candidate-integrate.sh
git add -A
git commit -m "chore(release): synchronize validated production candidate" || true

git push origin HEAD:release/production-candidate-2026-09-03
