#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the counsel question sheet quotes the build it describes
//
// docs/legal/counsel/QUESTIONS-FOR-COUNSEL.md is what the owner sends to Indian
// counsel. Each section quotes the exact text a student or parent sees and says
// where it lives in the code, so counsel's answer can be applied to the right
// line. A quote that has drifted from its file would have counsel approve words
// the app no longer shows, so this check holds the sheet to the tree:
//
//   · every "**Current text** · `file`" block is, after collapsing whitespace,
//     a passage of that file; with a third field (`key`) it is exactly the
//     string the i18n catalogue holds under that key;
//   · every "**Lives in** · `file` · `text`" names a file that exists and
//     contains that text;
//   · the sheet has a section for each question only counsel can answer: the
//     operator, the DPDP notices, consent and the guardian flow, D17, D18, D22
//     and D23, and each section quotes something and asks something;
//   · the review-switch line states what docs/legal/review-status.json says, so
//     the sheet can never describe a review that has not happened.
//
// Each way of breaking those rules is applied to an in-memory copy on every run.
// It checks that the sheet is faithful to the code; it is not legal advice and
// it is not a review.
//
//   node tools/counsel-pack-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SHEET = 'docs/legal/counsel/QUESTIONS-FOR-COUNSEL.md';
export const REQUIRED_SECTIONS = Object.freeze(['operator', 'DPDP notice', 'consent', 'D17', 'D18', 'D22', 'D23']);

const squash = text => text.replace(/\s+/g, ' ').trim();

/** The value an i18n catalogue line holds for a key, unescaped; null if the key is absent. */
export function catalogueValue(source, key) {
  const line = source.split('\n').find(l => l.trimStart().startsWith(`'${key}':`));
  if (!line) return null;
  const m = line.match(/^\s*'[^']+':\s*(['"])((?:\\.|(?!\1).)*)\1,?\s*$/);
  return m ? m[2].replace(/\\(['"\\])/g, '$1') : null;
}

/** Parses the sheet into sections, each with its quotes, locations and questions. */
export function parseSheet(text) {
  const lines = text.split('\n');
  const sections = [];
  let current = null;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const heading = line.match(/^## \d+\. .*\[([^\]]+)\]\s*$/);
    if (heading) { current = { tag: heading[1], quotes: [], locations: [], asks: 0, pending: 0 }; sections.push(current); continue; }
    if (/^## /.test(line)) { current = null; continue; }
    if (!current) continue;
    const quote = line.match(/^\*\*Current text\*\* · `([^`]+)`(?: · `([^`]+)`)?\s*$/);
    if (quote) {
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === '') j += 1;
      const body = [];
      while (j < lines.length && lines[j].startsWith('>')) { body.push(lines[j].replace(/^> ?/, '')); j += 1; }
      current.quotes.push({ file: quote[1], key: quote[2] || null, text: body.join('\n') });
      i = j - 1;
      continue;
    }
    const where = line.match(/^\*\*Lives in\*\* · `([^`]+)` · `(.+)`\s*$/);
    if (where) { current.locations.push({ file: where[1], text: where[2] }); continue; }
    if (/^\*\*For counsel:\*\*/.test(line)) current.asks += 1;
    if (/^\*\*Not yet in the code:\*\*/.test(line)) current.pending += 1;
  }
  return sections;
}

/** Every way the sheet disagrees with the tree. `readAt(path)` returns a file's text or null. */
export function sheetProblems(text, readAt, reviewStatus) {
  const problems = [];
  const sections = parseSheet(text);
  for (const tag of REQUIRED_SECTIONS) {
    const found = sections.filter(s => s.tag === tag);
    if (found.length !== 1) { problems.push(`the sheet has ${found.length} sections tagged [${tag}], not one`); continue; }
    const [section] = found;
    if (section.quotes.length === 0) problems.push(`[${tag}] quotes no current text`);
    if (section.locations.length === 0) problems.push(`[${tag}] names no place in the code`);
    if (section.asks !== 1) problems.push(`[${tag}] has ${section.asks} "For counsel" lists, not one`);
  }
  for (const section of sections) {
    for (const quote of section.quotes) {
      if (!quote.text.trim()) { problems.push(`[${section.tag}] has an empty quote from ${quote.file}`); continue; }
      const source = readAt(quote.file);
      if (source === null) { problems.push(`[${section.tag}] quotes ${quote.file}, which does not exist`); continue; }
      if (quote.key) {
        const value = catalogueValue(source, quote.key);
        if (value === null) problems.push(`[${section.tag}] quotes key ${quote.key}, which ${quote.file} does not hold`);
        else if (squash(value) !== squash(quote.text)) problems.push(`[${section.tag}] quote of ${quote.key} is not the text ${quote.file} holds`);
      } else if (!squash(source).includes(squash(quote.text))) {
        problems.push(`[${section.tag}] quote from ${quote.file} is not in that file ("${squash(quote.text).slice(0, 60)}…")`);
      }
    }
    for (const where of section.locations) {
      const source = readAt(where.file);
      if (source === null) problems.push(`[${section.tag}] points at ${where.file}, which does not exist`);
      else if (!source.includes(where.text)) problems.push(`[${section.tag}] says ${where.file} contains "${where.text}"; it does not`);
    }
  }
  const switchLine = text.match(/^Review switch at this commit: `reviewed: (true|false)`/m);
  if (!switchLine) problems.push('the sheet does not state the review switch');
  else if ((switchLine[1] === 'true') !== (reviewStatus?.reviewed === true)) {
    problems.push(`the sheet says reviewed: ${switchLine[1]}, but docs/legal/review-status.json says reviewed: ${reviewStatus?.reviewed}`);
  }
  return problems;
}

function main() {
  const readAt = path => (existsSync(join(ROOT, path)) ? readFileSync(join(ROOT, path), 'utf8') : null);
  const sheet = readAt(SHEET);
  const reviewStatus = JSON.parse(readAt('docs/legal/review-status.json'));
  let passed = 0;
  const failures = [];
  const check = (condition, label) => { if (condition) passed += 1; else failures.push(label); };

  check(sheet !== null, `${SHEET} exists`);
  const sections = sheet ? parseSheet(sheet) : [];
  const quotes = sections.reduce((n, s) => n + s.quotes.length, 0);
  const locations = sections.reduce((n, s) => n + s.locations.length, 0);
  const problems = sheet ? sheetProblems(sheet, readAt, reviewStatus) : ['no sheet'];
  check(problems.length === 0, `every quote is the current text, every location exists, every required section is there, and the switch line is true (${problems.join('; ') || `${quotes} quotes, ${locations} locations`})`);
  check(quotes >= REQUIRED_SECTIONS.length && locations >= REQUIRED_SECTIONS.length, `the sheet quotes and locates at least once per section (${quotes} quotes, ${locations} locations)`);

  // A check that cannot fail proves nothing: break the sheet in memory each way.
  const firstQuote = sheet?.match(/^\*\*Current text\*\* · `docs\/legal\/privacy\.md`\s*\n\s*\n> (\S+)/m)?.[1];
  const BREAKAGES = {
    'one word of a notice quote changed': () => sheet.replace(`> ${firstQuote}`, `> ${firstQuote}X`),
    'a catalogue quote no longer equal to its key': () => sheet.replace('> I am this learner’s parent or guardian, and I agree.', '> I am this learner’s parent or guardian.'),
    'a quote from a file that does not exist': () => sheet.replace('**Current text** · `docs/legal/terms.md`', '**Current text** · `docs/legal/terms-old.md`'),
    'a catalogue key that does not exist': () => sheet.replace('`signup.consentAgree`', '`signup.consentAgreed`'),
    'a location whose text is not in the file': () => sheet.replace("`CONSENT_NOTICE_VERSION = '2026-10-22'`", "`CONSENT_NOTICE_VERSION = '2026-11-08'`"),
    'a location in a file that does not exist': () => sheet.replace('`tools/legal-promises.mjs` · `PROMISES`', '`tools/legal-promise.mjs` · `PROMISES`'),
    'the D18 section dropped': () => sheet.replace(/^## 5\. .*\[D18\]\s*$/m, '## 5. Erasure'),
    'a section with nothing quoted': () => sheet.replace(/\*\*Current text\*\* · `docs\/legal\/privacy\.md`\s*\n\s*\n> - \*\*Email delivery\*\*[\s\S]*?\n\n/, ''),
    'the sheet claiming a review': () => sheet.replace('Review switch at this commit: `reviewed: false`', 'Review switch at this commit: `reviewed: true`')
  };
  for (const [breakage, apply] of Object.entries(BREAKAGES)) {
    const broken = sheet ? apply() : '';
    check(broken !== sheet && sheetProblems(broken, readAt, reviewStatus).length > 0, `the check catches: ${breakage}`);
  }
  check(sheet && sheetProblems(sheet, readAt, { ...reviewStatus, reviewed: true }).length > 0,
    'the check catches: review-status.json set to reviewed while the sheet says it is not');

  const total = passed + failures.length;
  if (failures.length) {
    for (const failure of failures) console.error(`  ✗ ${failure}`);
    console.error(`COUNSEL QUESTIONS: FAIL — ${passed}/${total} checks`);
    process.exit(1);
  }
  console.log(`COUNSEL QUESTIONS: PASS — ${passed}/${total} checks — ${sections.length} sections, ${quotes} quotes and ${locations} code locations match the tree; not legal advice and not a review.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
