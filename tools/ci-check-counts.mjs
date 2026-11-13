#!/usr/bin/env node
// CI CHECK COUNTS — the exact output pins of .github/workflows/ci.yml, kept in
// one checked-in manifest (ci/check-counts.json) instead of ~300 hand-written
// `grep -Fq 'X: PASS — N/N checks' some.log` lines.
//
// Each manifest GROUP is one contiguous block of pins that ci.yml used to grep
// against one log in one job; ci.yml now runs, in exactly that place,
//
//   node tools/ci-check-counts.mjs verify <group>
//
// and the step fails unless EVERY pin of the group holds against the log, with
// the same meaning the grep had:
//   { "has": S }                       grep -Fq S log        (a line contains S)
//   { "re": R }                        grep -Eq R log        (a line matches R)
//   { "has"|"re": …, "count": N, "op": "eq"|"ge" }
//                                      test "$(grep -c … log)" -eq|-ge N
// A suite that ran fewer checks prints another count (the pin fails); a suite
// that did not run prints nothing (the pin fails). tools/ci-runner-policy-check.mjs
// proves every group is verified exactly once, in its own job, by a line that
// cannot be skipped; `retire-check` (run in "Suites policy and contracts")
// proves no pin left the manifest relative to the base commit unless a
// `retired` record names it with a reason.
//
// Train resolution is "regenerate", not hand-merging greps:
//   node tools/ci-check-counts.mjs regen --log suites.log --group suites/suites.log
//   node tools/ci-check-counts.mjs regen --from-run <actions run id>   (gh, every job log)
//   node tools/ci-check-counts.mjs merge %O %A %B                      (git merge driver)
// regen only re-reads numbers in pins that already exist: it never adds or
// drops a pin, never changes a literal 0, keeps every N/N pin an N/N pin, and
// refuses to lower a number without --allow-decrease. CI re-verifies exactly,
// so a wrong regeneration can never pass.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MANIFEST = path.join(ROOT, 'ci', 'check-counts.json');

// ── pins ─────────────────────────────────────────────────────────────────────
const lines = text => text.split('\n');
const ownProps = (o, keys) => Object.keys(o).every(k => keys.includes(k));
const PIN_KEYS = ['has', 're', 'count', 'op', 'note'];

/** Why a pin is malformed (empty when it is well formed). */
export function pinProblems(pin) {
  const out = [];
  if (!pin || typeof pin !== 'object' || Array.isArray(pin)) return ['a pin is an object'];
  if (!ownProps(pin, PIN_KEYS)) out.push(`unknown key in ${JSON.stringify(pin)}`);
  const kinds = ['has', 're'].filter(k => k in pin);
  if (kinds.length !== 1) out.push(`a pin has exactly one of "has" or "re": ${JSON.stringify(pin)}`);
  const value = pin.has ?? pin.re;
  if (typeof value !== 'string' || !value.trim() || value.includes('\n')) out.push(`a pin's text is one non-empty line: ${JSON.stringify(pin)}`);
  if ('re' in pin) { try { new RegExp(pin.re); } catch (e) { out.push(`bad regular expression ${JSON.stringify(pin.re)}: ${e.message}`); } }
  if ('count' in pin || 'op' in pin) {
    if (!Number.isInteger(pin.count) || pin.count < 0) out.push(`count is a whole number: ${JSON.stringify(pin)}`);
    if (!['eq', 'ge'].includes(pin.op)) out.push(`op is "eq" or "ge": ${JSON.stringify(pin)}`);
  }
  if ('note' in pin && typeof pin.note !== 'string') out.push('a note is text');
  return out;
}

/** Lines of `text` the pin's pattern matches (grep's line semantics). */
export function matchingLines(pin, text) {
  if ('has' in pin) return lines(text).filter(line => line.includes(pin.has));
  const re = new RegExp(pin.re);
  return lines(text).filter(line => re.test(line));
}

/** Whether one pin holds against a log's text. */
export function pinHolds(pin, text) {
  const n = matchingLines(pin, text).length;
  if (!('count' in pin)) return n >= 1;
  return pin.op === 'eq' ? n === pin.count : n >= pin.count;
}

// ── numbers inside a pin: what regen may re-read ───────────────────────────────
// A digit run is a re-readable measurement unless it is a literal 0 (a "0 of N
// wrong answers marked correct" or "0 inconsistent" is the invariant, not a
// count), follows a letter, underscore or ^ (V1, D13, Q1_, 10^8), or, in a
// regular expression, sits inside […] or {…} or after a backslash.
function numberSpans(source, isRegex) {
  const spans = [];
  let bracket = false; let brace = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (isRegex) {
      if (ch === '\\') { i += 1; continue; }
      if (bracket) { if (ch === ']') bracket = false; continue; }
      if (brace) { if (ch === '}') brace = false; continue; }
      if (ch === '[') { bracket = true; continue; }
      if (ch === '{') { brace = true; continue; }
    }
    if (!/[0-9]/.test(ch)) continue;
    let j = i;
    while (j < source.length && /[0-9]/.test(source[j])) j += 1;
    // A decimal (2.98) is one measurement in a literal pin; in a regex "." is a metacharacter.
    if (!isRegex && source[j] === '.' && /[0-9]/.test(source[j + 1] || '')) {
      j += 1;
      while (j < source.length && /[0-9]/.test(source[j])) j += 1;
    }
    const before = i > 0 ? source[i - 1] : '';
    const after = j < source.length ? source[j] : '';
    const digits = source.slice(i, j);
    const glued = /[A-Za-z_^.]/.test(before) || /[A-Za-z_^]/.test(after);
    if (digits !== '0' && !glued) spans.push({ start: i, end: j, digits });
    i = j - 1;
  }
  return spans;
}

const escapeRe = s => s.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&');

/** The pin's identity across count changes: its text with re-readable numbers as #. */
export function shapeOf(pin) {
  const source = pin.has ?? pin.re;
  const spans = numberSpans(source, 're' in pin);
  let out = ''; let at = 0;
  for (const s of spans) { out += source.slice(at, s.start) + '#'; at = s.end; }
  return `${'re' in pin ? 're' : 'has'}:${out + source.slice(at)}`;
}

/**
 * A regular expression that finds the pin's line with every re-readable number
 * captured. An "N/N" pair stays an equal pair (a back-reference), so regen can
 * never turn a full pass into a partial one.
 */
function finder(pin) {
  const isRegex = 're' in pin;
  const source = pin.has ?? pin.re;
  const spans = numberSpans(source, isRegex);
  let pattern = ''; let at = 0; const groups = []; let captures = isRegex ? countGroups(source) : 0;
  for (const [k, s] of spans.entries()) {
    const lit = source.slice(at, s.start);
    pattern += isRegex ? lit : escapeRe(lit);
    const prev = spans[k - 1];
    const pairedWithPrev = prev && source.slice(prev.end, s.start) === '/' && prev.digits === s.digits && groups.length && groups[groups.length - 1].span === prev;
    if (pairedWithPrev) {
      pattern += `\\${groups[groups.length - 1].index}`;
      groups.push({ span: s, index: groups[groups.length - 1].index, paired: true });
    } else {
      captures += 1;
      // Bounded on both sides, so ".*" before a capture can never leave it the last digit of a number.
      pattern += '(?<![0-9.])([0-9]+(?:\\.[0-9]+)?)(?![0-9])';
      groups.push({ span: s, index: captures, paired: false });
    }
    at = s.end;
  }
  const tail = source.slice(at);
  pattern += isRegex ? tail : escapeRe(tail);
  // In a regex pin, captures the pin itself declares come first; ours are numbered after them.
  if (isRegex) {
    // Renumber: the pin's own groups keep their numbers only if ours follow them in the text,
    // which is not guaranteed; refuse regen for regex pins with their own groups and numbers.
    if (countGroups(source) && spans.length) return null;
  }
  return { re: new RegExp(pattern), groups, spans, source };
}
function countGroups(source) {
  let n = 0; let bracket = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '\\') { i += 1; continue; }
    if (bracket) { if (ch === ']') bracket = false; continue; }
    if (ch === '[') { bracket = true; continue; }
    if (ch === '(' && source[i + 1] !== '?') n += 1;
  }
  return n;
}

/**
 * Re-read one pin's numbers from `text`. Returns { pin, changed, error }.
 * The pin keeps its text; only its re-readable numbers (and an "eq" count) move.
 */
export function regenPin(pin, text, { allowDecrease = false, after = -1 } = {}) {
  const f = finder(pin);
  if (!f) {
    // A regex with its own groups (([0-9]+)/\1) is re-read by hand; while it holds, it is kept.
    if (pinHolds(pin, text)) return { pin, changed: false, error: null, at: lines(text).findIndex(line => matchingLines(pin, line).length) };
    return { pin, changed: false, error: `${JSON.stringify(pin.re)} has its own capture groups and numbers and no longer holds; edit it by hand` };
  }
  const found = []; // { out, at } in log order
  for (const [at, line] of lines(text).entries()) {
    const m = line.match(f.re);
    if (!m) continue;
    let out = ''; let from = 0;
    for (const g of f.groups) { out += f.source.slice(from, g.span.start) + m[g.index]; from = g.span.end; }
    found.push({ out: out + f.source.slice(from), at });
  }
  const current = f.source;
  const distinct = [...new Set(found.map(x => x.out))];
  const firstAfter = list => list.find(x => x.at > after) || list[0];
  let pick;
  if (found.some(x => x.out === current)) pick = firstAfter(found.filter(x => x.out === current));
  else if (distinct.length === 1) pick = firstAfter(found);
  else if (!found.length) return { pin, changed: false, error: `no line of the log has the shape of ${JSON.stringify(current)}: the suite did not run, or its summary line changed (retire the pin with a reason, or edit it by hand)` };
  // Several suites print the same shape (one "E2E SUITE PASSED — N/N" per tour): take the first
  // one after the line the previous pin of the group matched, i.e. the tour whose flow titles
  // were pinned just before it. CI then verifies the result exactly.
  else if (after >= 0 && found.some(x => x.at > after)) pick = found.find(x => x.at > after);
  else return { pin, changed: false, error: `${distinct.length} different lines have the shape of ${JSON.stringify(current)} (${distinct.slice(0, 6).map(s => JSON.stringify(s)).join(', ')}); regenerate this group from its own log with --log, or edit the pin by hand` };
  const next = pick.out;
  const fresh = { ...pin, ['has' in pin ? 'has' : 're']: next };
  if ('count' in pin && pin.op === 'eq') fresh.count = matchingLines(fresh, text).length;
  // Never lower a measurement silently.
  if (!allowDecrease && next !== current) {
    const nf = numberSpans(next, 're' in pin);
    for (const [k, s] of f.spans.entries()) {
      if (nf[k] && Number(nf[k].digits) < Number(s.digits)) {
        return { pin, changed: false, error: `${JSON.stringify(current)} → ${JSON.stringify(next)} lowers ${s.digits} to ${nf[k].digits}; a suite that runs fewer checks is a dropped check. Re-run with --allow-decrease only if the review accepts the reason, and say it in the pin's note` };
      }
    }
  }
  if (!allowDecrease && 'count' in pin && pin.op === 'eq' && fresh.count < pin.count) {
    return { pin, changed: false, error: `${JSON.stringify(current)} is printed ${fresh.count} times, the manifest says ${pin.count}; pass --allow-decrease to accept fewer` };
  }
  if ('count' in pin && !pinHolds(fresh, text)) return { pin, changed: false, error: `${JSON.stringify(next)} appears ${matchingLines(fresh, text).length} times, below the floor of ${pin.count}` };
  return { pin: fresh, changed: JSON.stringify(fresh) !== JSON.stringify(pin), error: null, at: pick.at };
}

// ── the manifest ───────────────────────────────────────────────────────────────
/** Why a manifest is malformed (empty when it is well formed). */
export function manifestProblems(m) {
  const out = [];
  if (!m || m.version !== 1) return ['the manifest is version 1'];
  if (!m.groups || typeof m.groups !== 'object') return ['the manifest has groups'];
  for (const [id, g] of Object.entries(m.groups)) {
    if (!/^[a-z0-9-]+\/[A-Za-z0-9._-]+\.log(#[0-9]+)?$/.test(id)) out.push(`group id "${id}" is <job>/<log>[#n]`);
    if (!g || g.job !== id.split('/')[0] || g.log !== id.split('/')[1].replace(/#[0-9]+$/, '')) out.push(`group "${id}" names its own job and log`);
    if (!Array.isArray(g?.pins) || !g.pins.length) { out.push(`group "${id}" has pins`); continue; }
    const texts = new Set();
    for (const pin of g.pins) {
      out.push(...pinProblems(pin).map(p => `${id}: ${p}`));
      const key = JSON.stringify({ ...pin, note: undefined });
      if (texts.has(key)) out.push(`${id}: the pin ${pin.has ?? pin.re} is listed twice`);
      texts.add(key);
    }
  }
  if (!Array.isArray(m.retired)) out.push('the manifest has a retired list');
  for (const r of m.retired || []) {
    if (!r || typeof r.group !== 'string' || typeof r.shape !== 'string' || typeof r.reason !== 'string' || r.reason.trim().length < 10) out.push(`a retired record names group, shape and a reason: ${JSON.stringify(r)}`);
  }
  return out;
}

export function loadManifest(file = MANIFEST) {
  const m = JSON.parse(readFileSync(file, 'utf8'));
  const problems = manifestProblems(m);
  if (problems.length) throw new Error(`${path.relative(ROOT, file)} is malformed:\n  ${problems.join('\n  ')}`);
  return m;
}

/** One pin per line, so a count change is a one-line diff and git can merge neighbours. */
export function serialize(m) {
  const out = ['{', `  "version": 1,`];
  if (m.about) out.push(`  "about": ${JSON.stringify(m.about)},`);
  out.push('  "groups": {');
  const ids = Object.keys(m.groups);
  for (const [gi, id] of ids.entries()) {
    const g = m.groups[id];
    out.push(`    ${JSON.stringify(id)}: {`);
    out.push(`      "job": ${JSON.stringify(g.job)},`);
    out.push(`      "log": ${JSON.stringify(g.log)},`);
    out.push('      "pins": [');
    for (const [pi, pin] of g.pins.entries()) {
      const ordered = {};
      for (const k of PIN_KEYS) if (k in pin) ordered[k] = pin[k];
      out.push(`        ${JSON.stringify(ordered)}${pi < g.pins.length - 1 ? ',' : ''}`);
    }
    out.push('      ]');
    out.push(`    }${gi < ids.length - 1 ? ',' : ''}`);
  }
  out.push('  },');
  out.push('  "retired": [');
  for (const [ri, r] of (m.retired || []).entries()) out.push(`    ${JSON.stringify({ group: r.group, shape: r.shape, reason: r.reason })}${ri < m.retired.length - 1 ? ',' : ''}`);
  out.push('  ]');
  out.push('}');
  return out.join('\n') + '\n';
}

/** Verify one group against a log's text: { ok, lines: [report lines] }. */
export function verifyGroup(manifest, id, text) {
  const g = manifest.groups[id];
  if (!g) return { ok: false, report: [`no group "${id}" in ci/check-counts.json`] };
  const report = [];
  let held = 0;
  for (const pin of g.pins) {
    if (pinHolds(pin, text)) { held += 1; continue; }
    const kind = 'has' in pin ? 'line containing' : 'line matching';
    const want = 'count' in pin ? `${pin.op === 'eq' ? 'exactly' : 'at least'} ${pin.count} ${kind}` : `a ${kind}`;
    report.push(`  ✗ ${want} ${JSON.stringify(pin.has ?? pin.re)} (found ${matchingLines(pin, text).length})`);
    const f = finder(pin);
    if (f) {
      const loose = new RegExp(f.re.source.replace(/\\[0-9]+/g, '([0-9]+)'));
      const near = lines(text).filter(line => loose.test(line)).slice(0, 3);
      for (const line of near) report.push(`      this run printed: ${line.trim().slice(0, 300)}`);
      if (!near.length) report.push('      nothing of that shape was printed: the suite did not run, or its summary changed');
    }
  }
  report.unshift(`${held === g.pins.length ? 'CHECK COUNTS: PASS' : 'CHECK COUNTS: FAIL'} — ${id}: ${held}/${g.pins.length} pins hold against ${g.log}`);
  return { ok: held === g.pins.length, report };
}

/** Pins of `base` missing from `head` with no retired record: [{ group, shape }]. */
export function unannouncedRemovals(base, head) {
  // A multiset: several pins of one group can share a shape (one "E2E SUITE PASSED — N/N" per tour),
  // so the head must keep as many of each (group, shape) as the base had, less those retired.
  const tally = manifest => {
    const t = new Map();
    for (const [id, g] of Object.entries(manifest.groups)) for (const pin of g.pins) {
      const key = `${id}\u0000${shapeOf(pin)}`;
      t.set(key, (t.get(key) || 0) + 1);
    }
    return t;
  };
  const before = tally(base); const now = tally(head);
  const retired = new Map();
  for (const r of head.retired || []) { const key = `${r.group}\u0000${r.shape}`; retired.set(key, (retired.get(key) || 0) + 1); }
  const baseRetired = new Map();
  for (const r of base.retired || []) { const key = `${r.group}\u0000${r.shape}`; baseRetired.set(key, (baseRetired.get(key) || 0) + 1); }
  const missing = [];
  for (const [key, n] of before) {
    const newlyRetired = (retired.get(key) || 0) - (baseRetired.get(key) || 0);
    const short = n - (now.get(key) || 0) - Math.max(0, newlyRetired);
    const [group, shape] = key.split('\u0000');
    for (let i = 0; i < short; i += 1) missing.push({ group, shape });
  }
  // A retired record is never removed either: the history of what stopped being pinned stays.
  for (const [key, n] of baseRetired) {
    const [group, shape] = key.split('\u0000');
    for (let i = (retired.get(key) || 0); i < n; i += 1) missing.push({ group, shape, retiredRecord: true });
  }
  return missing;
}

/** Regenerate the numbers of the named groups (all when none) from `text`. */
export function regen(manifest, text, { groups = null, allowDecrease = false } = {}) {
  const next = JSON.parse(JSON.stringify(manifest));
  const errors = []; const changes = [];
  for (const id of groups || Object.keys(next.groups)) {
    const g = next.groups[id];
    if (!g) { errors.push(`no group "${id}"`); continue; }
    let after = -1;
    g.pins = g.pins.map(pin => {
      const r = regenPin(pin, text, { allowDecrease, after });
      if (!r.error) after = r.at;
      if (r.error) errors.push(`${id}: ${r.error}`);
      else if (r.changed) changes.push(`${id}: ${JSON.stringify(pin.has ?? pin.re)}${'count' in pin ? `×${pin.count}` : ''} → ${JSON.stringify(r.pin.has ?? r.pin.re)}${'count' in r.pin ? `×${r.pin.count}` : ''}`);
      return r.pin;
    });
  }
  return { manifest: next, errors, changes };
}

// ── three-way merge, one pin at a time (a git merge driver) ─────────────────────
// A pin's merge identity is its shape and which occurrence of that shape it is in its group.
const keyed = (id, pins) => { const seen = new Map(); return pins.map(pin => { const s = shapeOf(pin); const k = (seen.get(s) || 0) + 1; seen.set(s, k); return { key: `${id}\u0000${s}\u0000${k}`, pin }; }); };
function mergeLists(baseList, ourList, theirList, keyOf, label, conflicts) {
  const index = list => new Map(list.map(x => [keyOf(x), x]));
  const b = index(baseList); const o = index(ourList); const t = index(theirList);
  const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
  const out = [];
  const decide = key => {
    const [bv, ov, tv] = [b.get(key), o.get(key), t.get(key)];
    if (same(ov, tv)) return ov;
    if (same(ov, bv)) return tv;   // only theirs changed (or removed, or added)
    if (same(tv, bv)) return ov;   // only ours changed
    conflicts.push(`${label}: both sides changed ${key.replace(/\u0000/g, ' ')} (ours ${JSON.stringify(ov)}, theirs ${JSON.stringify(tv)})`);
    return ov;
  };
  const seen = new Set();
  // Ours' order, with theirs-only additions placed after the item they follow in theirs.
  const theirsAfter = new Map();
  let prev = null;
  for (const x of theirList) { const k = keyOf(x); if (!o.has(k) && !b.has(k)) { const list = theirsAfter.get(prev) || []; list.push(k); theirsAfter.set(prev, list); } prev = k; }
  const emitAdditions = after => { for (const k of theirsAfter.get(after) || []) { if (seen.has(k)) continue; seen.add(k); const v = decide(k); if (v !== undefined) out.push(v); } };
  emitAdditions(null);
  for (const x of ourList) {
    const k = keyOf(x); if (seen.has(k)) continue; seen.add(k);
    const v = decide(k); if (v !== undefined) out.push(v);
    emitAdditions(k);
  }
  for (const k of t.keys()) if (!seen.has(k)) { seen.add(k); const v = decide(k); if (v !== undefined) out.push(v); }
  return out;
}

/** { manifest, conflicts } — the per-pin three-way merge of base, ours and theirs. */
export function merge3(base, ours, theirs) {
  const conflicts = [];
  const groupIds = mergeLists(Object.keys(base.groups), Object.keys(ours.groups), Object.keys(theirs.groups), x => x, 'groups', []);
  const groups = {};
  for (const id of groupIds) {
    const pick = m => keyed(id, m.groups[id] ? m.groups[id].pins : []);
    const pins = mergeLists(pick(base), pick(ours), pick(theirs), x => x.key, id, conflicts).map(x => x.pin);
    const meta = ours.groups[id] || theirs.groups[id];
    if (pins.length) groups[id] = { job: meta.job, log: meta.log, pins };
  }
  const retiredKey = r => `${r.group}\u0000${r.shape}`;
  const retired = mergeLists(base.retired || [], ours.retired || [], theirs.retired || [], retiredKey, 'retired', conflicts);
  return { manifest: { version: 1, about: ours.about ?? theirs.about, groups, retired }, conflicts };
}

// ── command line ───────────────────────────────────────────────────────────────
function argValue(args, name) {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
}

function runLogText(runId, repo) {
  const args = ['run', 'view', String(runId), '--log'];
  if (repo) args.push('--repo', repo);
  const raw = execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 1 << 30 });
  // "<job>\t<step>\t<timestamp> <text>" → "<text>"
  return raw.split('\n').map(line => {
    const parts = line.split('\t');
    const rest = parts.length >= 3 ? parts.slice(2).join('\t') : line;
    return rest.replace(/^﻿?\d{4}-\d{2}-\d{2}T[0-9:.]+Z ?/, '');
  }).join('\n');
}

function main(argv) {
  const [command, ...args] = argv;
  const file = argValue(args, '--manifest') ? path.resolve(argValue(args, '--manifest')) : MANIFEST;
  if (command === 'verify') {
    const id = args.find(a => !a.startsWith('--') && a !== argValue(args, '--manifest') && a !== argValue(args, '--log'));
    const manifest = loadManifest(file);
    if (!id || !manifest.groups[id]) { console.error(`verify needs a group of ${path.relative(ROOT, file)} (got ${JSON.stringify(id)})`); return 2; }
    const log = argValue(args, '--log') || manifest.groups[id].log;
    if (!existsSync(log)) { console.error(`CHECK COUNTS: FAIL — ${id}: ${log} does not exist (the step that writes it did not run)`); return 1; }
    const { ok, report } = verifyGroup(manifest, id, readFileSync(log, 'utf8'));
    (ok ? console.log : console.error)(report.join('\n'));
    if (!ok) console.error(`Regenerate with: node tools/ci-check-counts.mjs regen --group '${id}' --log ${manifest.groups[id].log}   (or --from-run <run id>); never by deleting a pin.`);
    return ok ? 0 : 1;
  }
  if (command === 'regen') {
    const manifest = loadManifest(file);
    const groupArg = args.flatMap((a, i) => a === '--group' ? [args[i + 1]] : []);
    let text;
    if (argValue(args, '--from-run')) text = runLogText(argValue(args, '--from-run'), argValue(args, '--repo'));
    else if (args.includes('--log')) text = args.flatMap((a, i) => a === '--log' ? [readFileSync(args[i + 1], 'utf8')] : []).join('\n');
    else { console.error('regen needs --log FILE (repeatable) or --from-run RUN_ID'); return 2; }
    const { manifest: next, errors, changes } = regen(manifest, text, { groups: groupArg.length ? groupArg : null, allowDecrease: args.includes('--allow-decrease') });
    for (const c of changes) console.log(`  ↻ ${c}`);
    if (errors.length) {
      for (const e of errors) console.error(`  ✗ ${e}`);
      console.error(`CHECK COUNTS REGEN: FAIL — ${errors.length} pin(s) could not be re-read; nothing was written`);
      return 1;
    }
    writeFileSync(file, serialize(next));
    console.log(`CHECK COUNTS REGEN: PASS — ${changes.length} pin(s) updated in ${path.relative(ROOT, file)}`);
    return 0;
  }
  if (command === 'retire-check') {
    const head = loadManifest(file);
    const sha = (argValue(args, '--base-sha') || '').trim();
    let baseText = null;
    if (argValue(args, '--base-file')) baseText = readFileSync(argValue(args, '--base-file'), 'utf8');
    else if (/^[0-9a-f]{40}$/.test(sha) && !/^0+$/.test(sha)) {
      try { execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' }); } catch { execFileSync('git', ['fetch', '--no-tags', '--depth=1', 'origin', sha], { stdio: 'inherit' }); }
      try { baseText = execFileSync('git', ['show', `${sha}:ci/check-counts.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch { baseText = null; }
      if (baseText === null) { console.log(`CHECK COUNTS RETIRE: PASS — the base ${sha.slice(0, 12)} has no ci/check-counts.json yet (this change introduces it)`); return 0; }
    } else {
      console.log(`CHECK COUNTS RETIRE: PASS — no base commit for this event (${sha || 'none'}); nothing to compare`);
      return 0;
    }
    const base = JSON.parse(baseText);
    const missing = unannouncedRemovals(base, head);
    if (missing.length) {
      for (const r of missing) console.error(`  ✗ ${r.retiredRecord ? 'retired record removed' : 'pin removed without a retired record'}: ${r.group} ${r.shape}`);
      console.error(`CHECK COUNTS RETIRE: FAIL — ${missing.length} pin(s) left the manifest unannounced. A pin that stops being checked needs { "group", "shape", "reason" } in "retired".`);
      return 1;
    }
    const pins = Object.values(head.groups).reduce((n, g) => n + g.pins.length, 0);
    console.log(`CHECK COUNTS RETIRE: PASS — every pin of the base manifest is still pinned or retired with a reason (${pins} pins in ${Object.keys(head.groups).length} groups, ${head.retired.length} retired)`);
    return 0;
  }
  if (command === 'merge') {
    const [o, a, b] = args;
    const parse = f => JSON.parse(readFileSync(f, 'utf8'));
    let merged;
    try { merged = merge3(parse(o), parse(a), parse(b)); } catch (e) { console.error(`check-counts merge driver: ${e.message}`); return 1; }
    writeFileSync(a, serialize(merged.manifest));
    if (merged.conflicts.length) {
      for (const c of merged.conflicts) console.error(`  ✗ ${c}`);
      console.error('check-counts merge: both sides changed the same pin; ours was kept. Regenerate the manifest on the merged tree (regen --log/--from-run), then git add it.');
      return 1;
    }
    return 0;
  }
  if (command === 'validate') {
    const m = loadManifest(file);
    const pins = Object.values(m.groups).reduce((n, g) => n + g.pins.length, 0);
    console.log(`CHECK COUNTS MANIFEST: PASS — ${pins} pins in ${Object.keys(m.groups).length} groups, ${m.retired.length} retired`);
    return 0;
  }
  console.error('usage: ci-check-counts.mjs verify <group> [--log FILE] | regen (--log FILE… | --from-run ID) [--group G…] [--allow-decrease] | retire-check (--base-sha SHA | --base-file FILE) | merge BASE OURS THEIRS | validate');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
