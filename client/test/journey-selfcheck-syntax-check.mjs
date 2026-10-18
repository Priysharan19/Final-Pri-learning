// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the iOS journey harness parses, and photoDraft names its
// sub-step.
//
// ios/PriLearning.swiftpm/JourneySelfCheck.swift carries the simulator journey
// as JavaScript inside Swift string literals, composed by concatenation
// (`helpers + cardHelpers + """…"""`). A syntax slip there used to surface only
// inside a 60-minute macOS job. This check pulls every literal out of both
// mirrored packages, composes each program the way Swift does, and asks node
// to parse it — no Mac needed.
//
// It also pins the photoDraft step's diagnostics (three October 2026 runs said
// only "timed out at thumbnail", the page header and nothing else): the test
// canvas's PNG must be checked before it becomes a File, the file input must
// be re-checked after the encode, each sub-step must be labelled, the
// thumbnail wait must report what the attach pipeline shows, and its 20 s
// budget is neither raised nor lowered.
//
// It checks itself first: a non-raw literal's escapes are read once, left to
// right, the way Swift reads them (see `unescapeSwift`).
//
// Run on its own:  node client/test/journey-selfcheck-syntax-check.mjs
//                  node client/test/journey-selfcheck-syntax-check.mjs <file.swift>…
// ─────────────────────────────────────────────────────────────────────────────
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILES = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ['ios/PriLearning.swiftpm/JourneySelfCheck.swift', 'ios/PriLearning 2.swiftpm/JourneySelfCheck.swift'].map(f => path.join(ROOT, f));

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

/** Swift's single-character escapes (a backslash before a newline joins the lines). */
const SWIFT_ESCAPES = { '\\': '\\', '"': '"', "'": "'", n: '\n', t: '\t', r: '\r', 0: '\0', '\n': '' };

/**
 * The text a non-raw Swift string literal denotes. One pass, left to right:
 * every backslash sequence is consumed exactly once and its replacement is
 * never scanned again, so `\\"` is `\"` (a backslash, then a quote) — never `"`.
 * Interpolation cannot be composed off-device and an unknown escape would not
 * compile in Swift, so both are errors here rather than silently kept.
 */
export function unescapeSwift(name, body) {
  return body.replace(/\\(?:u\{([0-9A-Fa-f]{1,8})\}|([\s\S]))/g, (seq, hex, esc) => {
    if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
    if (esc === '(') throw new Error(`${name}: string interpolation \\( cannot be composed off-device`);
    if (esc === undefined || !Object.hasOwn(SWIFT_ESCAPES, esc)) throw new Error(`${name}: unknown Swift escape ${JSON.stringify(seq)}`);
    return SWIFT_ESCAPES[esc];
  });
}

/**
 * Every `private static let <name> = [<part> + …] """…"""` literal: its name,
 * the literals it is prefixed with, and its text with Swift's escapes applied
 * (a raw `#"""` literal has none).
 */
export function extractLiterals(swift) {
  const re = /private static let (\w+)\s*=\s*([^\n]*?)(#?)"""\n([\s\S]*?)\n[ \t]*"""(#?)/g;
  const literals = new Map();
  let m;
  while ((m = re.exec(swift))) {
    const [, name, prefix, rawOpen, body, rawClose] = m;
    if (rawOpen !== rawClose) throw new Error(`${name}: raw string delimiters do not match`);
    const parts = prefix.split('+').map(s => s.trim()).filter(Boolean);
    const text = rawOpen ? body : unescapeSwift(name, body);
    literals.set(name, { parts, text });
  }
  return literals;
}

/** The JavaScript Swift hands the page for `name`: its parts, then its own text. */
export function compose(literals, name) {
  const literal = literals.get(name);
  if (!literal) throw new Error(`no literal named ${name}`);
  return literal.parts.map(part => compose(literals, part)).concat(literal.text).join('\n');
}

// ── the harness reads Swift escapes the way Swift does, once ─────────────────
// Regression for the sequential `replace(/\\\\/g).replace(/\\"/g)` this check
// first shipped with (CodeQL js/double-escaping): its first pass turned `\\"`
// into `\"`, which its second pass then read as an escaped quote. A journey that
// ended a JS string with a backslash would have been "parsed" as something else.
{
  const sample = [
    'private static let plain = """',
    '  s(/\\\\s+/, "\\\\"", \'\\n\', "\\t\\u{41}");',
    '  """',
    'private static let raw = #"""',
    '  r(/\\\\s+/, "\\\\"", \'\\n\');',
    '  """#',
    'private static let both = plain + raw + """',
    '  b();',
    '  """'
  ].join('\n');
  const lits = extractLiterals(sample);
  ok(lits.get('plain')?.text === '  s(/\\s+/, "\\"", \'\n\', "\tA");',
    'a non-raw literal: `\\\\` is one backslash, `\\\\"` is a backslash then a quote, `\\n` `\\t` `\\u{…}` are the characters they name');
  ok(lits.get('raw')?.text === '  r(/\\\\s+/, "\\\\"", \'\\n\');',
    'a raw #""" literal is kept byte for byte');
  ok(compose(lits, 'both') === [lits.get('plain').text, lits.get('raw').text, '  b();'].join('\n'),
    'a literal composed from parts is their texts in order, each on its own line');
  let interpolation = null;
  try { unescapeSwift('x', 'a \\(value) b'); } catch (e) { interpolation = e; }
  ok(/interpolation/.test(interpolation?.message || ''), 'string interpolation is refused, not kept as text');
  let unknown = null;
  try { unescapeSwift('x', 'a \\q b'); } catch (e) { unknown = e; }
  ok(/unknown Swift escape/.test(unknown?.message || ''), 'an escape Swift would not compile is refused');
  ok(unescapeSwift('x', 'one \\\ntwo') === 'one two', 'a backslash before a newline joins the lines');
}

const scratch = mkdtempSync(path.join(tmpdir(), 'pri-journey-js-'));
for (const file of FILES) {
  const label = path.relative(ROOT, file);
  const swift = readFileSync(file, 'utf8');
  const literals = extractLiterals(swift);
  ok(literals.size >= 15, `${label}: the journey's literals are found (${literals.size})`);
  for (const name of literals.keys()) {
    // Each program runs as the body of an async function (callAsyncJavaScript).
    const program = `(async function journey_${name}() {\n${compose(literals, name)}\n})`;
    const p = path.join(scratch, `${path.basename(path.dirname(file))}-${name}.js`);
    writeFileSync(p, program);
    const r = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8' });
    ok(r.status === 0, `${label}: ${name} parses as JavaScript\n${(r.stderr || '').split('\n').slice(0, 6).join('\n')}`);
  }

  // ── photoDraft names its sub-step ─────────────────────────────────────────
  const first = literals.get('firstLaunch')?.text || '';
  const stepAt = first.indexOf("await step('photoDraft'");
  const stepEnd = first.indexOf("await step('noCheckOffered'", stepAt);
  const photo = stepAt >= 0 && stepEnd > stepAt ? first.slice(stepAt, stepEnd) : '';
  ok(photo.length > 0, `${label}: the photoDraft step is in the first launch`);
  ok(/at = 'blob';[\s\S]*?if \(!blob \|\| !blob\.size\) throw new Error\(/.test(photo),
    `${label}: photoDraft throws when the test canvas encodes no PNG or an empty one, before building a File`);
  ok(/at = 'input';[\s\S]*?isConnected[\s\S]*?input\.dispatchEvent\(new Event\('change'/.test(photo),
    `${label}: photoDraft re-checks that the file input is still on the page after the await, before dispatching change`);
  ok(/at = 'canvas'/.test(photo) && /at = 'thumbnail'/.test(photo) && /at = 'unread'/.test(photo),
    `${label}: photoDraft labels its canvas, thumbnail and status sub-steps`);
  const thumbnailWaits = photo.match(/waitFor\(\(\) => vis\(q\('\.photo-attach \.photo-thumb img'\)\), (\d+)\)/g) || [];
  ok(thumbnailWaits.length === 1 && /, 20000\)$/.test(thumbnailWaits[0]),
    `${label}: the thumbnail wait keeps its 20 s budget, neither raised nor lowered (${thumbnailWaits.join(' | ') || 'no wait found'})`);
  ok(/at = 'thumbnail';\s*\n\s*try \{ await waitFor\([^\n]*20000\); \}\s*\n\s*catch \(e\) \{ throw new Error\('no thumbnail for a ' \+ blob\.size \+ '-byte PNG: ' \+ where\(\)\); \}/.test(photo),
    `${label}: a missing thumbnail reports the attach pipeline's state, not the page header`);
  ok(/const where = \(\) =>[\s\S]*?cardMode\(\)[\s\S]*?\.photo-attach \[role=status\][\s\S]*?document\.visibilityState[\s\S]*?Date\.now\(\) - t0/.test(photo),
    `${label}: the diagnostic names the card mode, the status text, the page visibility and the elapsed time`);
  ok(/const shown = Date\.now\(\) - t0;/.test(photo) && /thumbnail in ' \+ shown \+ ' ms/.test(photo),
    `${label}: a passing step records how long the thumbnail took, so the 20 s claim can be measured`);
  ok(/if \(nativeReads\) throw new Error/.test(photo) && /assertUnmarked\('photo'\)/.test(photo) && /an unread photo can be submitted/.test(photo),
    `${label}: the step's own assertions are unchanged — no on-device read, no mark, no submit`);
}
rmSync(scratch, { recursive: true, force: true });

const total = pass + failures.length;
if (failures.length) {
  console.log(`JOURNEY HARNESS: FAIL — ${failures.length} of ${total} checks failed\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`JOURNEY HARNESS: PASS — ${pass}/${total} checks — every journey literal parses in ${FILES.length} package(s) and photoDraft names the sub-step that stalls.`);
