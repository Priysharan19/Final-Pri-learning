import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = name => readFileSync(new URL(`../.github/workflows/${name}`, import.meta.url), 'utf8');

const ci = read('ci.yml');
const person2 = read('person2-india-platform.yml');
const durability = read('data-durability.yml');
const person1 = read('person1-intelligence.yml');
const jee = read('jee-question-department.yml');
const hybrid = read('ink-hybrid.yml');
const nativeInk = read('native-ink.yml');
const nativeJourney27 = read('native-journey-ios27.yml');
const buildInk = read('build-ink-v3-test-model.yml');
const appHealth = read('app-health-agent.yml');

function bounded(name, source, group) {
  assert.match(source, new RegExp(`group:\\s*${group}-\\$\\{\\{ github\\.ref \\}\\}`),
    `${name} must group superseded runs by the PR/branch ref`);
  assert.match(source, /cancel-in-progress:\s*true/,
    `${name} must cancel older heads because only the latest head can merge`);
}

bounded('CI', ci, 'ci');
bounded('Person 2', person2, 'person2-india-platform');
bounded('Data Durability', durability, 'data-durability');
bounded('Person 1', person1, 'person1-intelligence');
bounded('JEE Question Department', jee, 'jee-question-department');
bounded('Ink Hybrid', hybrid, 'ink-hybrid');
bounded('Native Ink', nativeInk, 'native-ink');
bounded('Native Journey iOS 27', nativeJourney27, 'native-journey-ios27');
// One repository-wide group let two Dependabot PRs rebased in the same minute
// cancel each other's run (#462 was cancelled ten times); the key carries the ref.
bounded('Build Ink V3 Test Model', buildInk, 'ink-v3-test-model');

for (const [name, source] of [['CI', ci], ['Person 2', person2], ['Ink Hybrid', hybrid], ['Native Ink', nativeInk], ['Native Journey iOS 27', nativeJourney27]]) {
  assert.match(source, /workflow_dispatch:/, `${name} must retain an explicit manual validation path`);
  assert.match(source, /push:\s*\n\s+branches:\s*\[main\]/,
    `${name} feature branches must validate through pull_request instead of a duplicate push run`);
}

// Native Ink (iOS 26) and Native Journey iOS 27 are the two macOS lanes
// (3-core hosted runners, 60-minute jobs). A push + pull_request pair cost two
// macOS jobs per PR commit and saturated the queue on 2026-10-17, starving Pri
// App Health's macOS job on main.
assert.doesNotMatch(nativeInk, /push:\s*\n\s+paths:/,
  'Native Ink must never return to an unfiltered feature-branch push run');
assert.doesNotMatch(nativeJourney27, /push:\s*\n\s+paths:/,
  'Native Journey iOS 27 must never return to an unfiltered feature-branch push run');

// Every macOS lane NAMES its Xcode and its iOS simulator runtime and asserts
// them before building, on a hosted image, never on the trusted Mac runner.
// #676 went unseen because the lane took "the newest runtime installed": a
// runner-image change could move a gate to another iOS without anyone
// deciding to. scripts/simulator-fleet.mjs refuses an unpinned run on CI.
for (const [name, source, image, xcode, runtime] of [
  ['Native Ink', nativeInk, 'macos-26', '26.6', '26.5'],
  ['Native Journey iOS 27', nativeJourney27, 'xcode-27', '27.1', '27.0']
]) {
  assert.match(source, new RegExp(`runs-on: ${image}\\n`), `${name} runs on the hosted ${image} image`);
  assert.doesNotMatch(source, /pri-learning-mac-trusted-manual/, `${name} never allocates the trusted Mac runner`);
  assert.match(source, new RegExp(`PRI_SIM_RUNTIME: '${xcode.split('.')[0] === '27' ? '27\\.0' : runtime.replace('.', '\\.')}'`), `${name} names its iOS simulator runtime (${runtime})`);
  assert.match(source, new RegExp(`DEVELOPER_DIR: /Applications/Xcode_${xcode.replace('.', '\\.')}\\.app/Contents/Developer`), `${name} names its Xcode (${xcode})`);
  assert.match(source, /xcodebuild -version \| tee xcode-version\.txt/, `${name} asserts the Xcode version before building`);
  assert.match(source, /xcrun simctl list runtimes \| tee runtimes\.txt/, `${name} asserts the simulator runtime before building`);
  assert.match(source, /node scripts\/ci-provision-simulators\.mjs --boot ipad/, `${name} provisions simulators through the pinned provisioner`);
  assert.match(source, /e\.simulator\.runtimePinned !== true/, `${name} refuses evidence that did not run on the pinned runtime`);
  assert.doesNotMatch(source, /newest runtime/i, `${name} does not describe itself as running on the newest runtime`);
}
const appHealthNative = appHealth.match(/\n  native:\n([\s\S]*?)(?=\n  [a-z][a-z0-9-]*:\n|$)/)?.[1] || '';
assert.match(appHealthNative, /runs-on: macos-26\n/, 'Pri App Health native job runs on the hosted macos-26 image');
assert.match(appHealthNative, /PRI_SIM_RUNTIME: '26\.5'/, 'Pri App Health native job names its iOS simulator runtime');

// Main's own health evidence is never dropped: seven consecutive main runs were
// cancelled by the next merge while the macOS job waited for a runner, and the
// consolidated report then failed with no native artifact. A newer head still
// supersedes a pull-request run.
assert.match(appHealth, /group:\s*pri-app-health-\$\{\{ github\.ref \}\}/,
  'Pri App Health Agent must group runs by ref');
assert.match(appHealth, /cancel-in-progress:\s*\$\{\{ github\.ref != 'refs\/heads\/main' \}\}/,
  'Pri App Health Agent must not cancel an in-progress run on main');

// Thirteen workflows that had no concurrency group (#748) now give pull-request
// runs one group per pull request (github.ref is refs/pull/<n>/merge there), so a
// newer push supersedes the queued or running check; every other run (a push, a
// manual dispatch) is keyed by its own run id. A pull-request group can therefore
// never cancel, or replace while pending, a run on main, and main runs never
// replace each other. The block must be the file's ONLY concurrency key in any
// literal form (a job-level one keyed on github.ref would bring the hazard back);
// the triggers keep GitHub's default pull_request types (a merged pull request's
// `closed` run has github.ref = refs/heads/main); and concurrency groups are
// repository-wide and case-insensitive, so no other workflow may produce a group
// with one of these prefixes, and a group this check cannot read fails closed.
export const PR_SUPERSEDED_ONLY = Object.freeze([
  ['kalp-01-design-system.yml', 'kalp-01'],
  ['kalp-02-information-architecture.yml', 'kalp-02'],
  ['kalp-03-onboarding-profile.yml', 'kalp-03'],
  ['kalp-04-home-command-centre.yml', 'kalp-04'],
  ['pri-reason.yml', 'pri-reason'],
  ['promotions.yml', 'promotions'],
  ['ink-physical-evidence.yml', 'ink-physical-evidence'],
  ['ink-physical-study.yml', 'ink-physical-study'],
  ['ink-production-evidence-capture.yml', 'ink-production-evidence-capture'],
  ['ink-structural-v4-candidate.yml', 'ink-structural-v4-candidate'],
  ['ink-structural-v4-contextual-glyphs.yml', 'ink-structural-v4-contextual-glyphs'],
  ['ink-structural-v4-group-relations.yml', 'ink-structural-v4-group-relations'],
  ['ink-writer-generalization.yml', 'ink-writer-generalization']
]);
// Any mention of a key, block or one-line, quoted or not, in a flow mapping too.
const yamlKey = name => new RegExp(`(^|[{,\\s])["']?${name}["']?\\s*:`, 'gm');
const CONCURRENCY_KEY = yamlKey('concurrency');
const TYPES_KEY = yamlKey('types');
// Every uses: key, block or flow, with the rest of its line.
const USES_KEY = /(^|[{,\s])["']?uses["']?[ \t]*:([^\n]*)/gm;
// Plain YAML only. The checks below read a workflow's text with regular expressions, and YAML can
// spell a key or a value in ways those cannot follow: double-quoted escapes and line continuations,
// explicit "? key" entries, anchors, aliases, tags and merge keys. GitHub decodes them, so a
// workflow that uses any of them OUTSIDE its block scalars (run: scripts and the like, which YAML
// reads as plain text) is not read at all: a pinned workflow is refused and any other workflow's
// group is unreadable, so both fail closed. Comments are kept in the structure, so nothing after a
// quoted # can hide; a block scalar is blanked from the column of the key that owns it.
export function structureText(source) {
  const out = [];
  let blockIndent = -1;
  for (const line of source.split('\n')) {
    const indent = line.match(/^ */)[0].length;
    if (blockIndent >= 0) {
      if (line.trim() === '' || indent > blockIndent) { out.push(''); continue; }
      blockIndent = -1;
    }
    const text = line.replace(/\$\{\{.*?\}\}/g, 'EXPR');
    out.push(text);
    const bare = text.replace(/[ \t]+#.*$/, '');
    const keyed = bare.match(/^([ \t]*(?:-[ \t]+)*)[^\s#][^\n]*:[ \t]*[|>][-+0-9]*[ \t]*$/);
    const itemed = bare.match(/^([ \t]*(?:-[ \t]+)*)-[ \t]+[|>][-+0-9]*[ \t]*$/);
    if (keyed) blockIndent = keyed[1].length;
    else if (itemed) blockIndent = itemed[1].length;
  }
  return out.join('\n');
}
const NON_CANONICAL = Object.freeze([
  [/\\/, 'a backslash (an escape or a line continuation)'],
  [/^[ \t]*(?:-[ \t]+)*\?(?:[ \t]|$)|[{,[][ \t]*\?[ \t]/m, 'an explicit key (? key)'],
  [/(?:^[ \t]*(?:-[ \t]+)*|:[ \t]+|[{,[][ \t]*)[&*][^\s,[\]{}]/m, 'an anchor or alias'],
  [/(?:^[ \t]*(?:-[ \t]+)*|:[ \t]+|[{,[][ \t]*)![^\s=]/m, 'a tag'],
  [/(^|[\s{,])<<[ \t]*:/m, 'a merge key (<<:)']
]);
/** The YAML forms outside block scalars that this check cannot read (empty for plain YAML). */
export function nonCanonical(source) {
  const text = structureText(source);
  return NON_CANONICAL.filter(([pattern]) => pattern.test(text)).map(([, what]) => what);
}
/** Why a workflow's concurrency is not the pull-request-only pattern (empty when it is). */
export function prSupersededOnlyProblems(source, prefix) {
  if (source.includes('\r')) return ['the workflow must use LF line endings'];
  const odd = nonCanonical(source);
  if (odd.length) return [`a pinned workflow must be plain YAML: ${odd.join(', ')} outside a run: script cannot be read by this check, so it fails closed`];
  const keys = [...source.matchAll(CONCURRENCY_KEY)].length;
  const lines = source.split('\n');
  const at = lines.findIndex(line => line === 'concurrency:');
  if (keys !== 1 || at < 0) return [`needs exactly one concurrency key, a top-level block written "concurrency:" alone on its line (found ${keys} concurrency key${keys === 1 ? '' : 's'}${at < 0 ? ', none of them that block' : ''})`];
  const block = [];
  for (let i = at + 1; i < lines.length && !/^\S/.test(lines[i]); i += 1) block.push(lines[i]);
  while (block.length && block.at(-1) === '') block.pop();
  const group = `  group: ${prefix}-\${{ github.event_name == 'pull_request' && github.ref || github.run_id }}`;
  const cancel = "  cancel-in-progress: ${{ github.event_name == 'pull_request' }}";
  const problems = [];
  for (const line of block) {
    if (line !== group && line !== cancel && !/^  # /.test(line)) problems.push(`unexpected line in the concurrency block: ${JSON.stringify(line)} (only comments, the group and cancel-in-progress, two-space indented)`);
  }
  if (block.filter(line => line === group).length !== 1) problems.push(`group must be exactly "${group.trim()}": only a pull_request run is keyed by its ref; every other run by its own run id`);
  if (block.filter(line => line === cancel).length !== 1) problems.push(`cancel-in-progress must be exactly "${cancel.trim()}"`);
  const comment = block.filter(line => /^  # /.test(line)).map(line => line.slice(4)).join(' ');
  if (!/one group per pull request/.test(comment) || /one group per branch/.test(comment)) problems.push('the comment must say "one group per pull request" (github.ref of a pull_request run is refs/pull/<n>/merge, not the branch)');
  // A reusable workflow (a job's uses: …/.github/workflows/…, in this repository or another) brings
  // its own concurrency group into the run, outside this file's guard: the pinned workflows call
  // none. A step's action (./.github/actions/…, owner/action@sha) carries no concurrency. A uses:
  // value this cannot read on its own line fails closed.
  for (const match of source.matchAll(USES_KEY)) {
    const raw = match[2].replace(/[ \t]+#.*$/, '').trim();
    const value = raw.replace(/^(["'])(.*?)\1.*$/, '$2').replace(/[,}\]].*$/, '').trim();
    if (!value || /^[|>&*!]/.test(value)) problems.push(`a uses: value this check cannot read (${JSON.stringify(raw || 'nothing on its line')}) fails closed`);
    else if (/\.github\/workflows\//i.test(value)) problems.push(`a pinned workflow must not call a reusable workflow (uses: ${value}): its own concurrency group would escape this check`);
  }
  // Callable, a pinned workflow would run inside another workflow's run, with that run's event and ref.
  if (/\bworkflow_call\b/.test(source.split('\n').filter(line => !/^\s*#/.test(line)).join('\n'))) problems.push('a pinned workflow must not be callable (on: workflow_call): a caller\'s pull_request run would bring its own ref into this group');
  // A merged pull request's `closed` run has github.ref = refs/heads/main: it would share one group
  // with every other such run. The pattern holds only with GitHub's default pull_request types.
  if ([...source.matchAll(TYPES_KEY)].length) problems.push('the triggers must keep GitHub\'s default pull_request types (no types: key): a closed pull request runs with github.ref = refs/heads/main');
  return problems;
}
/**
 * Every concurrency group a workflow can produce, lower-cased with quotes removed and
 * ${{ github.workflow }} resolved from name:. A group this cannot read as a plain one-line
 * value (a block scalar, an anchor, alias or tag, a value on the next line, format()) is
 * returned as `unreadable` rather than guessed at.
 */
export function groupLiterals(source) {
  const unreadable = [...nonCanonical(source)];
  // name: a plain value up to a " #" comment, or a quoted value.
  const nameRaw = (source.match(/^name:[ \t]*(.*)$/m) || [])[1];
  const nameText = nameRaw === undefined ? '' : nameRaw.trim();
  const quotedName = nameText.match(/^(["'])(.*?)\1/);
  const name = quotedName ? quotedName[2] : nameText.replace(/\s+#.*$/, '').trim();
  const EXPR = /^\$\{\{\s*github\.workflow\s*\}\}/;
  // In a reusable workflow, github.workflow is the CALLING workflow's name: it cannot be read here.
  const reusable = /(^|[{,\s])["']?workflow_call["']?\s*:|^on:\s*\[?[^\n]*\bworkflow_call\b/m.test(source);
  const readable = value => value && !/^[>|{&!*]/.test(value) && !/\bformat\s*\(/.test(value)
    // A group that starts with an expression is readable only when it is github.workflow and the name is.
    && (!/^\$\{\{/.test(value) || (EXPR.test(value) && name && !/^[>|&!*]/.test(name) && !reusable))
    && !(reusable && /\$\{\{\s*github\.workflow\s*\}\}/.test(value));
  const values = [];
  const take = raw => {
    const value = String(raw || '').trim().replace(/^(["'])(.*)\1$/, '$2').replace(/^["']/, '');
    // A flow sequence is never a concurrency group (GitHub needs a string): it is a
    // matrix key that happens to be called group (ci.yml's browser groups).
    if (value.startsWith('[')) return;
    if (!readable(value)) { unreadable.push(value || '(empty)'); return; }
    values.push(value.replace(/\$\{\{\s*github\.workflow\s*\}\}/g, name).toLowerCase());
  };
  // A value runs to the end of the line or to a " #" comment; ${{ … }} is kept whole.
  const VALUE = String.raw`((?:\$\{\{[^}]*\}\}|[^#\n])*)`;
  for (const m of source.matchAll(new RegExp(String.raw`^[ \t]*["']?group["']?[ \t]*:[ \t]*` + VALUE, 'gm'))) take(m[1]);
  // A group inside a flow mapping, wherever the mapping starts; its value ends at , or } outside ${{ … }}.
  for (const m of source.matchAll(/[{,][ \t]*["']?group["']?[ \t]*:[ \t]*((?:\$\{\{[^}]*\}\}|[^,}\n])*)/g)) take(m[1]);
  const lines = source.split('\n');
  for (const [index, line] of lines.entries()) {
    const m = line.match(new RegExp(String.raw`(?:^|[{, \t])["']?concurrency["']?[ \t]*:[ \t]*` + VALUE));
    if (!m) continue;
    const value = m[1].trim();
    if (value.startsWith('{')) continue; // its group is read by the flow-mapping pass above
    if (value) { take(value); continue; }
    // No value on the key's line: the next content line is either the block (a key: line, read
    // above, or a flow mapping) or a plain scalar continuing the value, which is the group itself.
    const indent = line.match(/^[ \t]*/)[0].length;
    const next = lines.slice(index + 1).find(l => l.trim() && !l.trim().startsWith('#'));
    if (!next || next.match(/^[ \t]*/)[0].length <= indent) { unreadable.push('(empty)'); continue; }
    const content = next.trim();
    if (/^["']?[A-Za-z0-9_-]+["']?[ \t]*:/.test(content) || content.startsWith('{')) continue;
    take(content.replace(/\s+#.*$/, ''));
  }
  return { values, unreadable };
}
/** The pinned prefix another workflow's group could collide with ({ prefix, literal }), or null. */
export function prefixCollision(source, prefixes) {
  const { values, unreadable } = groupLiterals(source);
  if (unreadable.length) return { prefix: '(unreadable)', literal: unreadable[0] };
  for (const value of values) {
    const hit = prefixes.find(prefix => value.startsWith(`${prefix.toLowerCase()}-`));
    if (hit) return { prefix: hit, literal: value };
    // The literal text may be a shorter piece of a pinned "<prefix>-" that the first expression
    // completes (ink-${{ matrix.lane }}-… can become ink-physical-evidence-…). Only an expression
    // whose expansion is known can rule that out: github.ref starts "refs/", run ids are digits,
    // SHAs from GitHub are hex. Anything else (matrix, inputs, even one named like a SHA, since a
    // dispatch input is free text; vars, head_ref…) fails closed.
    const at = value.indexOf('${{');
    if (at < 0) continue;
    const head = value.slice(0, at);
    const expr = (value.slice(at).match(/^\$\{\{\s*([^}]*?)\s*\}\}/) || [])[1] || '';
    for (const prefix of prefixes) {
      const pinned = `${prefix.toLowerCase()}-`;
      if (!pinned.startsWith(head) || pinned === head) continue;
      const next = pinned.slice(head.length);
      const known = /^github\.ref$/.test(expr) ? next.startsWith('refs/') || 'refs/'.startsWith(next)
        : /^github\.(run_id|run_number|run_attempt)$/.test(expr) ? /^[0-9]/.test(next)
          : /^(github\.sha|github\.event\.workflow_run\.head_sha)(\s*\|\|\s*github\.sha)*$/.test(expr) ? /^[0-9a-f]/.test(next)
            : null;
      if (known === null || known === true) return { prefix, literal: value, completes: true };
    }
  }
  return null;
}
{
  const prefixes = PR_SUPERSEDED_ONLY.map(([, prefix]) => prefix);
  assert.equal(new Set(prefixes.map(p => p.toLowerCase())).size, prefixes.length, 'the pull-request-only concurrency prefixes are distinct');
  for (const a of prefixes) for (const b of prefixes) if (a !== b) assert.ok(!`${b}-`.toLowerCase().startsWith(`${a}-`.toLowerCase()), `the prefix ${b} does not start with ${a}-, so their groups can never meet`);
  for (const [file, prefix] of PR_SUPERSEDED_ONLY) {
    assert.deepEqual(prSupersededOnlyProblems(read(file), prefix), [], `${file}: pull-request runs share one group per pull request; runs on main and dispatched runs are never cancelled or replaced`);
  }
  // Repository-wide, case-insensitive groups: no other workflow produces a group with one of these prefixes.
  const workflowDir = new URL('../.github/workflows/', import.meta.url);
  const pinned = new Set(PR_SUPERSEDED_ONLY.map(([file]) => file));
  for (const name of readdirSync(workflowDir).filter(n => /\.ya?ml$/.test(n) && !pinned.has(n))) {
    const hit = prefixCollision(read(name), prefixes);
    assert.equal(hit, null, hit?.prefix === '(unreadable)'
      ? `${name}: its concurrency group "${hit.literal}" cannot be read; write it as a plain one-line value so it can be checked against the pull-request-only prefixes`
      : hit?.completes
        ? `${name}: its concurrency group "${hit.literal}" could expand into the group of the pull-request-only workflow "${hit.prefix}" (an expression completes its prefix); start the group with text no pinned prefix begins with`
        : `${name}: its concurrency group "${hit?.literal}" would share a group with the pull-request-only workflow "${hit?.prefix}"`);
  }
  // Mutation controls: the dangerous variants are refused, not merely absent today.
  const good = read(PR_SUPERSEDED_ONLY[6][0]); // ink-physical-evidence.yml: it also runs on push to main
  const prefix = PR_SUPERSEDED_ONLY[6][1];
  const job = (s, text) => s.replace(/\njobs:\n(  [A-Za-z0-9_-]+:\n)/, `\njobs:\n$1${text}`);
  for (const [name, mutate] of [
    ['a group keyed on github.ref for every event (a pending main run would be replaced by the next)', s => s.replace(/  group: .*\n/, `  group: ${prefix}-\${{ github.ref }}\n`)],
    ['a group keyed on the branch name (github.head_ref)', s => s.replace(/  group: .*\n/, `  group: ${prefix}-\${{ github.head_ref || github.run_id }}\n`)],
    ['cancel-in-progress for every event', s => s.replace(/  cancel-in-progress: .*\n/, '  cancel-in-progress: true\n')],
    ['no run-id fallback', s => s.replace(/ \|\| github\.run_id/, '')],
    ['the "one group per branch" wording', s => s.replace('one group per pull request', 'one group per branch')],
    ['a third setting in the block', s => s.replace(/(  cancel-in-progress: .*\n)/, '$1  queue: max\n')],
    ['a continuation line in the block', s => s.replace(/(  group: .*)\n/, '$1\n    || true\n')],
    ['a pull_request trigger with type closed', s => s.replace(/pull_request:\n/, 'pull_request:\n    types: [opened, synchronize, closed]\n')],
    ['a types list with a commented closed item', s => s.replace(/pull_request:\n/, 'pull_request:\n    types:\n      - closed  # post-merge\n')],
    ['a quoted closed type', s => s.replace(/pull_request:\n/, "pull_request:\n    types:\n      - 'closed'\n")],
    ['a types flow list split over lines', s => s.replace(/pull_request:\n/, 'pull_request:\n    types: [opened,\n      closed]\n')],
    ['a types flow list on the next line', s => s.replace(/pull_request:\n/, 'pull_request:\n    types:\n      [closed]\n')],
    ['a pull_request flow mapping with types', s => s.replace(/  pull_request:\n/, '  pull_request: { types: [closed] }\n  pull_request_review:\n')],
    ['CRLF line endings', s => s.replace(/\n/g, '\r\n')],
    ['a job-level block', s => job(s, `    concurrency:\n      group: ${prefix}-\${{ github.ref }}\n`)],
    ['a job-level one-line form', s => job(s, `    concurrency: ${prefix}-\${{ github.ref }}\n`)],
    ['a job-level flow form', s => job(s, `    concurrency: { group: "${prefix}-\${{ github.ref }}", cancel-in-progress: true }\n`)],
    ['a job-level block with a trailing comment', s => job(s, `    concurrency: # main runs\n      group: ${prefix}-\${{ github.ref }}\n`)],
    ['a job-level block with an anchor', s => job(s, `    concurrency: &jc\n      group: ${prefix}-\${{ github.ref }}\n`)],
    ['a job-level quoted key', s => job(s, `    "concurrency":\n      group: ${prefix}-\${{ github.ref }}\n`)],
    ['a top-level key with a trailing comment', s => s.replace(/^concurrency:$/m, 'concurrency: # pinned')],
    ['a top-level one-line form instead of the block', s => s.replace(/^concurrency:\n(?:  .*\n)+/m, `concurrency: ${prefix}-\${{ github.ref }}\n`)],
    ['a job that calls a local reusable workflow', s => job(s, `    uses: ./.github/workflows/shared.yml\n`)],
    ['a job that calls a reusable workflow in another repository', s => job(s, `    uses: example-org/shared-workflows/.github/workflows/report.yml@0123456789abcdef0123456789abcdef01234567 # v2.1.0\n`)],
    ['a job that calls this repository\'s reusable workflow by its full path', s => job(s, `    uses: Priysharan19/Final-Pri-learning/.github/workflows/promotions-report.yml@0123456789abcdef0123456789abcdef01234567\n`)],
    ['a quoted reusable-workflow call', s => job(s, `    uses: 'example-org/shared/.github/workflows/report.yml@v1'\n`)],
    ['a reusable-workflow call in a flow mapping', s => s.replace(/\njobs:\n/, '\njobs:\n  report: { uses: example-org/shared/.github/workflows/report.yml@v1, secrets: inherit }\n')],
    ['a uses: value on the next line', s => job(s, `    uses:\n      example-org/shared/.github/workflows/report.yml@v1\n`)],
    ['a uses: value as a block scalar', s => job(s, `    uses: >-\n      example-org/shared/.github/workflows/report.yml@v1\n`)],
    ['an on: workflow_call trigger', s => s.replace(/^on:\n/m, 'on:\n  workflow_call:\n')],
    ['a quoted workflow_call trigger', s => s.replace(/^on:\n/m, 'on:\n  "workflow_call": {}\n')],
    // Sixth review: forms YAML decodes into the ones refused above.
    ['a uses key written with an escape', s => job(s, `    "u\\x73es": example-org/shared/.github/workflows/report.yml@v1\n`)],
    ['a reusable-workflow path with an escaped slash', s => job(s, `    uses: "example-org/shared/.github\\x2Fworkflows/report.yml@v1"\n`)],
    ['a reusable-workflow path with a \\/ escape', s => job(s, `    uses: "example-org/shared/.github\\/workflows/report.yml@v1"\n`)],
    ['a reusable-workflow path split by a double-quoted line continuation', s => job(s, `    uses: "example-org/shared/.github/\\\n      workflows/report.yml@v1"\n`)],
    ['an explicit ? uses key', s => job(s, `    ? uses\n    : example-org/shared/.github/workflows/report.yml@v1\n`)],
    ['a workflow_call trigger written with an escape', s => s.replace(/^on:\n/m, 'on:\n  "workflow\\x5Fcall": {}\n')],
    ['a job-level concurrency key written with an escape', s => job(s, `    "con\\x63urrency":\n      group: ${prefix}-\${{ github.ref }}\n`)],
    ['a job-level concurrency key written with a \\u escape', s => job(s, `    "con\\u0063urrency": ${prefix}-\${{ github.ref }}\n`)],
    ['an explicit ? concurrency key', s => job(s, `    ? concurrency\n    : ${prefix}-\${{ github.ref }}\n`)],
    ['a types key written with an escape', s => s.replace(/pull_request:\n/, 'pull_request:\n    "t\\x79pes": [closed]\n')],
    ['an explicit ? types key', s => s.replace(/pull_request:\n/, 'pull_request:\n    ? types\n    : [closed]\n')],
    ['a key written as an alias', s => job(s, `    env: { K: &k uses }\n    *k : example-org/shared/.github/workflows/report.yml@v1\n`)],
    // Seventh review: a backslash ending a comment or a plain value, explicit keys with comments or block-scalar keys, tags and anchors on keys.
    ['a job-level concurrency after a comment ending in a backslash', s => job(s, `    # see C:\\\n    concurrency: ${prefix}-\${{ github.ref }}\n`)],
    ['a job-level concurrency after a plain value ending in a backslash', s => job(s, `    env:\n      P: C:\\\n    concurrency: ${prefix}-\${{ github.ref }}\n`)],
    ['a reusable-workflow call after a comment ending in a backslash', s => job(s, `    # C:\\\n    uses: example-org/shared/.github/workflows/report.yml@v1\n`)],
    ['an explicit ? concurrency key with a comment', s => job(s, `    ? concurrency # c\n    : ${prefix}-\${{ github.ref }}\n`)],
    ['an explicit ? uses key with a comment line before its value', s => job(s, `    ? uses\n    # note\n    : example-org/shared/.github/workflows/report.yml@v1\n`)],
    ['an explicit block-scalar uses key', s => job(s, `    ? |-\n      uses\n    : example-org/shared/.github/workflows/report.yml@v1\n`)],
    ['a tag on a job-level concurrency key', s => job(s, `    !!str concurrency: ${prefix}-\${{ github.ref }}\n`)],
    ['an anchor on a uses key', s => job(s, `    &u uses: example-org/shared/.github/workflows/report.yml@v1\n`)],
    ['an alias key whose anchor name starts with a dot', s => job(s, `    env: { K: &.k uses }\n    *.k : example-org/shared/.github/workflows/report.yml@v1\n`)],
    ['a merge key', s => job(s, `    <<: { concurrency: ${prefix}-\${{ github.ref }} }\n`)]
  ]) {
    const mutated = mutate(good);
    assert.notEqual(mutated, good, `the mutation "${name}" applies`);
    assert.ok(prSupersededOnlyProblems(mutated, prefix).length > 0, `the policy refuses ${name}`);
  }
  // A step's own action carries no concurrency: a local action is not a reusable workflow.
  const withLocalAction = good.replace(/(\n      - uses: actions\/setup-node@[^\n]*\n)/, '$1      - uses: ./.github/actions/setup-pri\n');
  assert.notEqual(withLocalAction, good, 'the local-action control applies');
  assert.deepEqual(prSupersededOnlyProblems(withLocalAction, prefix), [], 'a step that uses a local action (./.github/actions/…) is not a reusable-workflow call');
  // Block scalars are text to YAML and are skipped; the keys beside them are not.
  assert.deepEqual(nonCanonical('      - run: |\n          echo "a && b" \\\n            *.md\n        env: { A: 1 }\n'), [], 'a run: script may hold backslashes, && and globs');
  assert.deepEqual(nonCanonical('      - run: |\n          echo hi\n        env: { A: *alias }\n'), ['an anchor or alias'], 'a key beside a run: script, at the column of run:, is still read');
  assert.deepEqual(nonCanonical('x: { a: "x #", b: *alias }\n'), ['an anchor or alias'], 'a quoted # never hides the rest of a flow mapping');
  assert.deepEqual(nonCanonical("on:\n  schedule:\n    - cron: '*/5 * * * *'\njobs:\n  a:\n    if: github.event_name == 'push' && github.ref == 'refs/heads/main'\n    steps:\n      - run: npm ci && npm test\n"), [], 'quoted cron stars and && inside a value are plain text');
  for (const [name, other] of [
    ['an unquoted group', `name: Other\nconcurrency:\n  group: ${prefix}-\${{ github.ref }}\n`],
    ['a single-quoted group', `name: Other\nconcurrency:\n  group: '${prefix}-\${{ github.ref }}'\n`],
    ['a double-quoted group', `name: Other\nconcurrency:\n  group: "${prefix}-\${{ github.ref }}"\n`],
    ['a group differing only in case', `name: Other\nconcurrency:\n  group: ${prefix.toUpperCase()}-\${{ github.ref }}\n`],
    ['a one-line concurrency', `name: Other\nconcurrency: ${prefix}-\${{ github.ref }}\n`],
    ['a job-level one-line concurrency', `name: Other\njobs:\n  a:\n    concurrency: ${prefix}-\${{ github.ref }}\n`],
    ['a group built from github.workflow', `name: ${prefix}\nconcurrency:\n  group: \${{ github.workflow }}-\${{ github.ref }}\n`],
    ['a group built from a quoted github.workflow name', `name: "${prefix}"\nconcurrency:\n  group: \${{ github.workflow }}-\${{ github.ref }}\n`],
    ['a flow-mapping concurrency', `name: Other\nconcurrency: { group: ${prefix}-\${{ github.ref }}, cancel-in-progress: true }\n`],
    ['a job-level flow-mapping concurrency', `name: Other\njobs:\n  a:\n    concurrency: { group: '${prefix}-\${{ github.ref }}' }\n`],
    ['a flow mapping on the line after its key', `name: Other\nconcurrency:\n  { group: ${prefix}-\${{ github.ref }}, cancel-in-progress: true }\n`],
    ['a one-line concurrency with a trailing comment', `name: Other\nconcurrency: ${prefix}-\${{ github.ref }}  # one run per ref\n`],
    ['a job-level quoted one-line concurrency with a trailing comment', `name: Other\njobs:\n  a:\n    concurrency: '${prefix}-\${{ github.ref }}' # note\n`],
    ['a group with a trailing comment', `name: Other\nconcurrency:\n  group: ${prefix}-\${{ github.ref }} # note\n`],
    ['a concurrency value on the next line', `name: Other\nconcurrency:\n  ${prefix}-\${{ github.ref }}\n`],
    ['a flow-mapping group built from github.workflow', `name: ${prefix}\nconcurrency: { group: "\${{ github.workflow }}-\${{ github.ref }}" }\n`],
    ['a github.workflow group whose name: carries a comment', `name: ${prefix} # copied\nconcurrency:\n  group: \${{ github.workflow }}-\${{ github.ref }}\n`]
  ]) {
    assert.ok(prefixCollision(other, prefixes)?.prefix === prefix, `another workflow cannot share a pinned group through ${name}`);
  }
  for (const [name, other] of [
    ['a folded block-scalar group', `name: Other\nconcurrency:\n  group: >-\n    ${prefix}-\${{ github.ref }}\n`],
    ['a literal block-scalar group', `name: Other\nconcurrency:\n  group: |-\n    ${prefix}-\${{ github.ref }}\n`],
    ['a group value on the next line', `name: Other\nconcurrency:\n  group:\n    ${prefix}-\${{ github.ref }}\n`],
    ['an anchored group', `name: Other\nconcurrency:\n  group: &g ${prefix}-\${{ github.ref }}\n`],
    ['a tagged group', `name: Other\nconcurrency:\n  group: !!str ${prefix}-\${{ github.ref }}\n`],
    ['a group built with format()', `name: Other\nconcurrency:\n  group: \${{ format('{0}-{1}', '${prefix}', github.ref) }}\n`],
    ['a github.workflow group with an unreadable name', `name: >-\n  ${prefix}\nconcurrency:\n  group: \${{ github.workflow }}-\${{ github.ref }}\n`],
    ['a group starting with another expression', `name: Other\nconcurrency:\n  group: \${{ matrix.lane }}-\${{ github.ref }}\n`],
    ['a quoted group starting with another expression', `name: Other\nconcurrency:\n  group: '\${{ matrix.lane }}-\${{ github.ref }}'\n`],
    ['a github.workflow group in a reusable workflow (the caller names it)', `name: Shared\non:\n  workflow_call:\nconcurrency:\n  group: \${{ github.workflow }}-\${{ github.ref }}\n`],
    ['a concurrency key with nothing under it', `name: Other\nconcurrency:\njobs: {}\n`],
    ['a concurrency key written as an alias', `name: Other\nenv: { K: &c concurrency }\n*c : ${prefix}-\${{ github.ref }}\n`],
    // Sixth and seventh reviews: forms GitHub decodes but a regular expression cannot follow are not read at all.
    ['a group with an escaped hyphen', `name: Other\nconcurrency:\n  group: "${prefix}\\x2D\${{ github.ref }}"\n`],
    ['a group split by a double-quoted line continuation', `name: Other\nconcurrency:\n  group: "ink-\\\n    physical-evidence-\${{ github.ref }}"\n`],
    ['a group key written with an escape', `name: Other\nconcurrency:\n  "gr\\x6Fup": ${prefix}-\${{ github.ref }}\n`],
    ['an explicit ? group key', `name: Other\nconcurrency:\n  ? group\n  : ${prefix}-\${{ github.ref }}\n`],
    ['a one-line concurrency key written with an escape', `name: Other\n"con\\x63urrency": ${prefix}-\${{ github.ref }}\n`],
    ['a group written with a \\U escape', `name: Other\nconcurrency:\n  group: "${prefix}\\U0000002D\${{ github.ref }}"\n`],
    ['a group key after a comment that ends in a backslash', `name: Other\nconcurrency:\n  # see C:\\\n  group: ${prefix}-\${{ github.ref }}\n`],
    ['an explicit ? concurrency key with a comment', `name: Other\n? concurrency # c\n: ${prefix}-\${{ github.ref }}\n`],
    ['an explicit key indicator alone on its line', `name: Other\n?\n  concurrency\n: ${prefix}-\${{ github.ref }}\n`],
    ['an explicit block-scalar key', `name: Other\nconcurrency:\n  ? |-\n    group\n  : ${prefix}-\${{ github.ref }}\n`],
    ['a tag on the group key after another key', `name: Other\nconcurrency:\n  cancel-in-progress: false\n  !!str group: '${prefix}-\${{ github.ref }}'\n`],
    ['an anchor on the group key after another key', `name: Other\nconcurrency:\n  cancel-in-progress: false\n  &g group: ${prefix}-\${{ github.ref }}\n`],
    ['an anchor on the group key in a flow mapping', `name: Other\nconcurrency: { &a group: '${prefix}-\${{ github.ref }}' }\n`],
    ['a tag on the group key in a flow mapping', `name: Other\nconcurrency: { !!str group: '${prefix}-\${{ github.ref }}' }\n`],
    ['an explicit group key in a flow mapping', `name: Other\nconcurrency: { ? group : '${prefix}-\${{ github.ref }}' }\n`],
    ['an alias key whose anchor name starts with a dot', `name: Other\nenv: { K: &.c concurrency }\n*.c : ${prefix}-\${{ github.ref }}\n`],
    ['a merge key bringing in a concurrency mapping', `name: Other\nx: &m { concurrency: ${prefix}-\${{ github.ref }} }\njobs:\n  a:\n    <<: *m\n`]
  ]) {
    assert.equal(prefixCollision(other, prefixes)?.prefix, '(unreadable)', `a group the check cannot read fails closed: ${name}`);
  }
  assert.equal(prefixCollision(`name: Other\nconcurrency:\n  group: ${prefix}x-\${{ github.ref }}\n`, prefixes), null, 'a different prefix that merely starts the same is not a collision');
  // An expression that can complete a pinned prefix fails closed; a known expansion that cannot does not.
  for (const [name, group] of [
    ['a matrix value completing ink-physical-evidence', 'ink-${{ matrix.lane }}-${{ github.ref }}'],
    ['an input completing a kalp gate', 'kalp-${{ inputs.gate }}-${{ github.ref }}'],
    ['a variable completing pri-reason', 'pri-${{ vars.lane }}-${{ github.ref }}'],
    ['github.head_ref after a piece of a prefix', 'promo${{ github.head_ref }}'],
    ['a dispatch input named like a SHA (free text, not hex)', 'pri-${{ inputs.release_sha }}'],
    ['a SHA input behind the workflow_run SHA', 'pri-${{ github.event.workflow_run.head_sha || inputs.candidate_sha }}']
  ]) assert.ok(prefixCollision(`name: Other\nconcurrency:\n  group: ${group}\n`, prefixes)?.completes === true, `another workflow cannot reach a pinned group through ${name}`);
  for (const [name, group] of [
    ['ink-structural-v4-${{ github.ref }} (a real workflow: refs/ never completes -candidate-)', 'ink-structural-v4-${{ github.ref }}'],
    ['a run id after a piece of a prefix', 'ink-physical-${{ github.run_id }}'],
    ['a SHA after a piece of a prefix', 'pri-${{ github.sha }}']
  ]) assert.equal(prefixCollision(`name: Other\nconcurrency:\n  group: ${group}\n`, prefixes), null, `a known expansion that cannot complete a pinned prefix passes: ${name}`);
}

assert.match(hybrid, /pull_request:\s*\n\s+paths:/,
  'Ink Hybrid must be path-scoped on pull requests');
assert.match(hybrid, /'client\/src\/ink\/\*\*'/,
  'Ink Hybrid must cover all handwriting runtime modules');
for (const test of [
  'ink-personal-metric-check.mjs',
  'ink-hybrid-check.mjs',
  'ink-trig-context.mjs',
  'inkcheck-context.mjs'
]) {
  assert.ok(hybrid.includes(test), `Ink Hybrid path scope/invocation lost ${test}`);
}
assert.doesNotMatch(hybrid, /run:\s*npm run/,
  'Ink Hybrid must invoke its four owned tests directly so unrelated package.json metadata cannot trigger it');

// Full CI and Person 2 were the largest queue multipliers: every feature branch
// push used to create a push run in addition to the PR run, and neither workflow
// cancelled superseded PR heads. Keep the production rule explicit.
assert.doesNotMatch(ci, /push:\s*\n\s+pull_request:/,
  'CI must never return to unfiltered feature-branch push execution');
assert.doesNotMatch(person2, /-\s+'india\/\*\*'/,
  'Person 2 push branches must not duplicate India feature-branch PR validation');

// CI fans its two slowest gates out across runners (suites by
// tools/ci-suite-shard.mjs, browser suites by flow group and engine). The
// branch-protection check names must stay on aggregate jobs that run always(),
// fail unless every shard succeeded, and then run the invariant blocks against
// the combined shard logs, so a skipped or cancelled shard can never read as a
// passed required check.
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
function job(id) {
  const m = ci.match(new RegExp(`\\n  ${id}:\\n([\\s\\S]*?)(?=\\n  [a-z][a-z0-9-]*:\\n|$)`));
  assert.ok(m, `CI must keep the ${id} job`);
  return m[1];
}
for (const [id, name] of [
  ['suites', 'Suites, coverage and accuracy gates'],
  ['browser', 'Browser suites (end-to-end and accessibility)'],
  ['build', 'Client build and offline-first boundary'],
  ['platform', 'Production account, sync and commercial schema']
]) {
  assert.equal(ci.split(`\n    name: ${name}\n`).length - 1, 1, `exactly one CI job is the required check "${name}"`);
  assert.match(job(id), new RegExp(`^    name: ${name.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}\\n`), `the ${id} job carries the required check name "${name}"`);
}
for (const [id, shards] of [['suites', ['suites-shard', 'suites-contracts']], ['browser', ['browser-shard']]]) {
  const body = job(id);
  assert.match(body, new RegExp(`\\n    needs: \\[${shards.join(', ')}\\]\\n`), `${id} must need ${shards.join(', ')}`);
  assert.match(body, /\n    if: always\(\)\n/, `${id} must run always() so a failed or skipped shard fails the required check`);
  for (const shard of shards) {
    const env = shard.toUpperCase().replace(/-/g, '_') + '_RESULT';
    assert.ok(body.includes(`${env}: \${{ needs.${shard}.result }}`) && body.includes(`test "$${env}" = success`),
      `${id} must fail unless ${shard} succeeded`);
  }
}
const suiteShards = job('suites-shard');
assert.match(suiteShards, /shard: \[1, 2, 3, 4\]/, 'the suite matrix is shards 1..4');
assert.match(suiteShards, /node tools\/ci-suite-shard\.mjs --of=4 --shard=\$\{\{ matrix\.shard \}\} --manifest=suite-shard\.json 2>&1 \| tee suites\.log/,
  'each suite shard runs its share of npm test and writes a manifest');
assert.match(job('suites'), /test "\$\(ls -d suite-shards\/suites-shard-\* \| wc -l\)" -eq 4\n\s+node tools\/ci-suite-shard\.mjs --verify --of=4 /,
  'the suites gate proves all four manifests together completed every npm test suite exactly once');
assert.match(job('suites'), /- name: Exact coverage invariants\n/, 'the suites gate keeps the exact coverage invariants');
assert.match(job('browser'), /- name: Browser coverage invariants\n/, 'the browser gate keeps the browser coverage invariants');
// Every command of npm run test:e2e runs, in its order, in the browser groups.
const e2eChain = pkg.scripts['test:e2e'].split('&&').map(s => s.trim());
const browserCommands = [...job('browser-shard').matchAll(/^\s+((?:node|npm run) \S.*?) 2>&1 \| tee -a browser\.log$/gm)].map(m => m[1]);
const at = browserCommands.indexOf(e2eChain[0]);
assert.ok(at >= 0 && e2eChain.every((cmd, i) => browserCommands[at + i] === cmd),
  'the browser groups must run every command of npm run test:e2e, in order (update ci.yml when test:e2e changes)');
// The tours CI adds beyond test:e2e (both engines, the photo page, ink canvas
// loss, and the platform tours repeated on tour-ai-tutor.js's build).
for (const cmd of [
  'npm run test:a11y', 'npm run test:boot',
  'node client/test/tour-cloud-platform.js --no-build',
  'node client/test/tour-admin-cms-platform.js --no-build',
  'node client/test/tour-admin-independent-review.js --no-build',
  'node client/test/tour-responsive-matrix.js --no-build',
  'node client/test/tour-responsive-matrix.js --no-build --browser=webkit',
  'node client/test/tour-iphone-layout.js --no-build',
  'node client/test/tour-iphone-layout.js --no-build --browser=webkit',
  'node client/test/tour-activation-gate.js --no-build --browser=webkit',
  'node client/test/tour-photo-answer.js --no-build',
  'node client/test/ink-canvas-loss-browser-check.mjs'
]) {
  const expected = e2eChain.filter(c => c === cmd).length + 1;
  assert.equal(browserCommands.filter(c => c === cmd).length,
    cmd.startsWith('npm run') ? 1 : expected, `the browser groups must run ${cmd} as the single job did`);
}
const groups = (job('browser-shard').match(/group: \[([^\]]+)\]/) || [])[1]?.split(',').map(s => s.trim()) || [];
assert.ok(groups.length >= 2, 'the browser matrix names its groups');
for (const g of groups) {
  assert.ok(job('browser-shard').includes(`\n            ${g})\n`), `browser group ${g} has commands`);
}
assert.match(job('browser'), new RegExp(`for group in ${groups.join(' ')}; do[\\s\\S]*?-eq ${groups.length}\\n`),
  'the browser gate combines exactly one log from every group');


// ── Lane CI (docs/release/ci-lanes.md) ───────────────────────────────────────
// A lane pull request (any head that is not task/train-*) runs the four required
// contexts and every security, marking, data, evidence and governance gate; the
// heavy workflows run on task/train-* pull requests, on main and on dispatch, and
// Main Integrity refuses a merge from anything but a train, so every workflow
// still runs on the exact head that merges. A job skipped by an if: reports
// "skipped", which branch protection reads as passing: so no lane-gated job may
// ever carry a required context's name, and ci.yml (which holds all four) may
// never be lane-gated. Every workflow with a pull_request trigger is classified
// here, so a new one fails until someone decides.
export const LANE_CONDITION = "github.event_name != 'pull_request' || startsWith(github.head_ref, 'task/train-')";
export const REQUIRED_CONTEXTS = Object.freeze([
  'Suites, coverage and accuracy gates',
  'Production account, sync and commercial schema',
  'Browser suites (end-to-end and accessibility)',
  'Client build and offline-first boundary'
]);
export const LANE_GATED = Object.freeze({
  'android-shell.yml': 'Android emulator matrix (4 profiles) and Gradle build; the shell CSP and store policy stay in CI suites-contracts',
  'app-health-agent.yml': 'mounted-app health audit, browser evidence and macOS native shell; runs nightly and on main too',
  'kalp-01-design-system.yml': 'design-system browser journey and visual evidence',
  'kalp-02-information-architecture.yml': 'navigation browser regression',
  'kalp-03-onboarding-profile.yml': 'onboarding browser journey (the account gate itself is in the required browser suites)',
  'kalp-04-home-command-centre.yml': 'home browser journey',
  'native-ink.yml': 'macOS iOS 26 simulator lane (40-60 min)',
  'native-journey-ios27.yml': 'macOS iOS 27 simulator lane (45-60 min)',
  'ink-hybrid.yml': 'on-device ink recognizer metrics; answer-blindness is pinned in the required platform job',
  'ink-foundation.yml': 'ink model tooling and training contract (Python)',
  'ink-corpus-evidence.yml': 'ink corpus campaign planning (Python)',
  'ink-structural-v4.yml': 'structural ink model contract (Python)',
  'ink-structural-v4-candidate.yml': 'structural model factorial (Python, research)',
  'ink-structural-v4-joint.yml': 'structural joint decoder (Python, research)',
  'ink-structural-v4-synthetic.yml': 'structural synthetic pretraining contract (Python, research)',
  'ink-structural-v4-component-validity.yml': 'structural component validity (Python, research)',
  'ink-structural-v4-contextual-glyphs.yml': 'structural glyph fusion (Python, research)',
  'ink-structural-v4-group-relations.yml': 'structural group relations (Python, research)',
  'ink-structural-v4-live-lan.yml': 'developer LAN structural inference',
  'ink-writer-generalization.yml': 'V17 writer-generalization smoke (Python)',
  'build-ink-v3-test-model.yml': 'V3 test-model training and Core ML export (macOS)',
  'jee-question-department.yml': 'JEE question pipeline (the India suites and marking sweeps run in the required suites job)'
});
export const LANE_EVERYWHERE = Object.freeze({
  'ci.yml': 'the four required contexts (and the Postgres restore rehearsal)',
  'codeql.yml': 'security: code scanning',
  'pri-agent-governance.yml': 'governance: mission ledger, R-class and independent-review markers',
  'pri-agent-concurrency.yml': 'governance: writer admission contract',
  'pri-agent-concurrency-adversarial.yml': 'governance: adversarial admission',
  'deployment-image.yml': 'security and data: production container headers, persistent storage and release identity',
  'data-durability.yml': 'data loss: backup restore rollback',
  'person1-intelligence.yml': 'marking and handwriting authority contract',
  'person2-india-platform.yml': 'entitlement, sync, account-link and session boundaries',
  'pri-reason.yml': 'mathematical reasoning safety (marking)',
  'promotions.yml': 'commercial: one-time reward integrity',
  'ink-physical-evidence.yml': 'evidence honesty: no manufactured physical evidence',
  'ink-physical-study.yml': 'evidence honesty: physical study allocation',
  'ink-production-evidence-capture.yml': 'evidence honesty: production evidence capture'
});

const jobBlocks = source => {
  const lines = source.split('\n');
  const start = lines.indexOf('jobs:');
  const out = [];
  if (start < 0) return out;
  let current = null;
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line) && !line.startsWith('#')) break;
    const header = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (header) { current = { id: header[1], lines: [] }; out.push(current); continue; }
    if (current) current.lines.push(line);
  }
  return out;
};
const triggerBlock = (source, key) => {
  const on = source.match(/\non:\n([\s\S]*?)(?=\n\S)/)?.[1] || '';
  const m = on.match(new RegExp(`(^|\\n)  ${key}:[^\\n]*\\n((?:    [^\\n]*\\n|\\s*\\n)*)`));
  return m ? m[2] : null;
};
const hasPullRequest = source => /\non:\n(?:  [^\n]*\n|\s*\n|    [^\n]*\n|      [^\n]*\n)*?  pull_request:/.test(source) || /^on:\s*\[[^\]]*\bpull_request\b/m.test(source);

/** Why the lane split does not hold for this set of workflow sources ({ file: text }). */
export function laneProblems(sources) {
  const problems = [];
  const gatedExpr = LANE_CONDITION;
  for (const [file, source] of Object.entries(sources)) {
    const gated = file in LANE_GATED; const everywhere = file in LANE_EVERYWHERE;
    if (gated && everywhere) problems.push(`${file} is classified twice`);
    if (hasPullRequest(source) && !gated && !everywhere) problems.push(`${file} runs on pull_request but is not classified in LANE_GATED or LANE_EVERYWHERE (tools/ci-runner-policy-check.mjs, docs/release/ci-lanes.md)`);
    const jobs = jobBlocks(source);
    const names = jobs.map(j => (j.lines.find(l => /^    name: /.test(l)) || '').replace(/^    name: /, '').trim().replace(/^(["'])(.*)\1$/, '$2'));
    if (gated) {
      if (!jobs.length) problems.push(`${file}: no jobs found`);
      for (const job of jobs) {
        const ifs = job.lines.filter(l => /^    if:/.test(l));
        const value = ifs.length === 1 ? ifs[0].replace(/^    if:\s*/, '').trim() : null;
        const okIf = value === gatedExpr || (value && value.startsWith(`(${gatedExpr}) && (`) && value.endsWith(')'));
        if (!okIf) problems.push(`${file}: job ${job.id} must carry exactly one "if: ${gatedExpr}" (or "(${gatedExpr}) && (…)")`);
      }
      for (const name of names) if (REQUIRED_CONTEXTS.some(ctx => name === ctx)) problems.push(`${file}: a lane-gated job is named "${name}", a required context; a skipped job would read as passing`);
      if (!triggerBlock(source, 'workflow_dispatch') && !/\n  workflow_dispatch:/.test(source)) problems.push(`${file}: a lane-gated workflow keeps a manual dispatch`);
      const push = triggerBlock(source, 'push');
      if (push === null) problems.push(`${file}: a lane-gated workflow runs on push to main`);
      else if (!/^    branches: \[main\]$/m.test(push)) problems.push(`${file}: its push trigger is main only (a feature-branch push would bypass the lane split)`);
      const pr = triggerBlock(source, 'pull_request');
      if (pr && /types\s*:/.test(pr)) problems.push(`${file}: keep GitHub's default pull_request types`);
    } else if (everywhere) {
      if (/startsWith\(github\.head_ref/.test(source) || /task\/train-/.test(source)) problems.push(`${file}: runs on every pull request (${LANE_EVERYWHERE[file]}) and must not branch on the head ref`);
    }
  }
  for (const file of [...Object.keys(LANE_GATED), ...Object.keys(LANE_EVERYWHERE)]) if (!(file in sources)) problems.push(`${file} is classified but does not exist`);
  // The required contexts are ci.yml's and nobody else's.
  for (const [file, source] of Object.entries(sources)) {
    if (file === 'ci.yml') continue;
    for (const ctx of REQUIRED_CONTEXTS) if (source.includes(`name: ${ctx}\n`)) problems.push(`${file}: names a job "${ctx}"; only ci.yml may carry a required context`);
  }
  return problems;
}
{
  const workflowDir = new URL('../.github/workflows/', import.meta.url);
  const sources = Object.fromEntries(readdirSync(workflowDir).filter(n => /\.ya?ml$/.test(n)).map(n => [n, read(n)]));
  assert.deepEqual(laneProblems(sources), [], 'lane pull requests run the required contexts and the always-on gates; the heavy workflows run on trains, main and dispatch');
  assert.ok(Object.keys(LANE_EVERYWHERE).includes('ci.yml') && Object.keys(LANE_EVERYWHERE).includes('codeql.yml'), 'CI and CodeQL run on every pull request');
  for (const ctx of REQUIRED_CONTEXTS) assert.equal(ci.split(`\n    name: ${ctx}\n`).length - 1, 1, `ci.yml carries the required context "${ctx}" once`);
  assert.doesNotMatch(ci, /head_ref|task\/train-/, 'ci.yml (the required contexts) is never lane-gated');
  assert.match(sources['main-integrity.yml'], /if \[\[ "\$head_ref" != task\/train-\* \]\]; then\n[^\n]*::error::[^\n]*\n\s+exit 1/, 'Main Integrity refuses a main commit that did not arrive through a task/train-* pull request');
  // Mutation controls: each way the split could silently weaken is refused.
  const gatedFile = 'android-shell.yml';
  const mutate = (file, fn) => ({ ...sources, [file]: fn(sources[file]) });
  for (const [name, next] of [
    ['a gated job without its if:', mutate(gatedFile, s => s.replace(/\n    if: github\.event_name != 'pull_request' \|\| startsWith\(github\.head_ref, 'task\/train-'\)\n/, '\n'))],
    ['a gated job whose if: is widened', mutate(gatedFile, s => s.replace("startsWith(github.head_ref, 'task/train-')", "startsWith(github.head_ref, 'task/')"))],
    ['a gated workflow with a second if: on a job', mutate(gatedFile, s => s.replace(/(\n    if: github[^\n]*\n)/, '$1    if: true\n'))],
    ['a required context name on a gated job', mutate(gatedFile, s => s.replace('name: Gradle build, lint, unit tests and web parity', 'name: Client build and offline-first boundary'))],
    ['a gated workflow pushed from every branch', mutate(gatedFile, s => s.replace(/\n  push:\n    branches: \[main\]\n/, '\n  push:\n'))],
    ['a gated workflow with no manual dispatch', mutate(gatedFile, s => s.replace(/\n  workflow_dispatch:\n/, '\n'))],
    ['a lane gate in ci.yml', mutate('ci.yml', s => s.replace(/\n  platform:\n/, `\n  platform:\n    if: ${LANE_CONDITION}\n`))],
    ['a lane gate in CodeQL', mutate('codeql.yml', s => s.replace(/\njobs:\n(  [A-Za-z0-9_-]+:\n)/, `\njobs:\n$1    if: ${LANE_CONDITION}\n`))],
    ['a new pull_request workflow nobody classified', { ...sources, 'new-gate.yml': 'name: New\non:\n  pull_request:\npermissions:\n  contents: read\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: true\n' }],
    ['a classified workflow that was deleted', (() => { const s = { ...sources }; delete s['promotions.yml']; return s; })()]
  ]) {
    assert.ok(laneProblems(next).length > 0, `the lane policy refuses ${name}`);
  }
}

// ── Check-count manifest (ci/check-counts.json) ──────────────────────────────
// The exact output pins moved out of ci.yml into one manifest. Every group is
// verified exactly once, inside its own job, by a bare command line (no `|| true`,
// no `if`, never under continue-on-error), and ci.yml keeps no inline pin against
// a log, so the manifest is the one place a count lives.
{
  const manifest = JSON.parse(readFileSync(new URL('../ci/check-counts.json', import.meta.url), 'utf8'));
  const calls = new Map();
  const lines = ci.split('\n');
  let jobId = null; let inJobs = false; let step = null;
  for (const [i, line] of lines.entries()) {
    if (line === 'jobs:') { inJobs = true; continue; }
    const header = inJobs && line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (header) { jobId = header[1]; step = null; continue; }
    if (/^      - /.test(line)) step = { start: i };
    if (step && /^        continue-on-error:/.test(line)) step.continueOnError = true;
    const m = line.match(/node tools\/ci-check-counts\.mjs verify (\S+)/);
    if (!m) continue;
    assert.match(line, /^ +node tools\/ci-check-counts\.mjs verify \S+$/, `ci.yml:${i + 1}: a verify call stands alone on its line (no || true, no condition)`);
    const list = calls.get(m[1]) || []; list.push({ job: jobId, line: i + 1, step }); calls.set(m[1], list);
  }
  for (const [id, group] of Object.entries(manifest.groups)) {
    const at = calls.get(id) || [];
    assert.equal(at.length, 1, `ci/check-counts.json group ${id} is verified exactly once in ci.yml (found ${at.length})`);
    assert.equal(at[0].job, group.job, `group ${id} is verified in its own job ${group.job}`);
  }
  // continue-on-error on the step would turn a failed verify into a pass; checked over the whole step text.
  for (const [id, at] of calls) {
    assert.ok(id in manifest.groups, `ci.yml verifies ${id}, which ci/check-counts.json does not have`);
    const stepText = lines.slice(at[0].step.start, at[0].line).join('\n');
    assert.doesNotMatch(stepText, /continue-on-error:\s*true/, `the step verifying ${id} is not continue-on-error`);
  }
  const inline = lines.filter(l => /^\s*(?:grep -[EF]q|test "\$\(grep -[EF]?c) .*\.log\)?"?(?: -(?:eq|ge) [0-9]+)?$/.test(l));
  assert.deepEqual(inline, [], 'ci.yml keeps no inline output pin against a log: pins live in ci/check-counts.json');
  const contracts = job('suites-contracts');
  assert.match(contracts, /node tools\/ci-check-counts\.mjs validate\n\s+node tools\/ci-check-counts\.test\.mjs\n\s+node tools\/ci-check-counts\.mjs retire-check --base-sha "\$BASE_SHA"\n/, 'Suites policy and contracts validates the manifest, runs its negative tests and the retire check');
  assert.match(contracts, /BASE_SHA: \$\{\{ github\.event\.pull_request\.base\.sha \|\| github\.event\.before \}\}/, 'the retire check compares against the pull request base (or the previous main)');
  // Negative control: dropping a verify line, or verifying in the wrong job, is visible to this check.
  const anyId = Object.keys(manifest.groups)[0];
  assert.ok(!ci.replace(`node tools/ci-check-counts.mjs verify ${anyId}\n`, '\n').includes(`verify ${anyId}\n`), 'the negative control removes a verify line');
}

console.log('PASS — lane pull requests run the four required contexts and every security, marking, data, evidence and governance gate while the heavy workflows run on trains, main and dispatch; every check-count group is verified once in its own job; release workflows keep only authoritative heads, avoid duplicate feature-branch push runs (both pinned macOS lanes included), never cancel main\'s health evidence, key Build Ink V3 by ref, and scope Ink Hybrid to handwriting changes; the sharded suites and browser gates keep their required check names, fail on any unsuccessful shard and run every npm test and test:e2e suite.');
