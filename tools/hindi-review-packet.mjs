#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Hindi review packet (decision D11)
//
// D11 keeps the Hindi interface and requires a native-speaker review before
// release. No such review has ever been recorded (docs/i18n.md, "Translation
// review policy"). This tool writes the packet that review works from, into
// docs/release/hindi-review/:
//
//   README.md          status, scope, how to review, the sign-off table
//   screens/*.md       every catalogue string, English beside Hindi, by screen
//   strings.csv        the same rows as a working sheet with reviewer columns
//   ncert-terms.md     the NCERT term list and where the catalogue uses each term
//   other-sources.md   Hindi a student sees or hears that is not in the catalogue
//   manifest.json      hashes of every source the packet was generated from
//
// It never says a review happened. Every row carries its provenance (the last
// commit that touched the Hindi line, its date, and whether that commit is
// marked as agent-written) and the status "no native-speaker review on record".
//
//   node tools/hindi-review-packet.mjs           regenerate
//   node tools/hindi-review-packet.mjs --check   exit 1 if the packet is stale,
//                                                or if Devanagari appears in a
//                                                source file this tool has not
//                                                classified
//
// Regenerate whenever strings.hi.js or strings.en.js changes, and at the
// release-candidate freeze: the reviewer signs the packet whose catalogue hash
// is in manifest.json, not whatever main holds later.
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'docs/release/hindi-review');
const CHECK = process.argv.includes('--check');
const rel = p => relative(ROOT, p).split('\\').join('/');
const read = p => readFileSync(join(ROOT, p), 'utf8');
const sha256 = text => createHash('sha256').update(text).digest('hex');
const load = async p => import(pathToFileURL(join(ROOT, p)).href);
const DEVANAGARI = /[\u0900-\u097F]/;

const HI_FILE = 'client/src/i18n/strings.hi.js';
const EN_FILE = 'client/src/i18n/strings.en.js';
const STATUS = 'No native-speaker review on record';

// ── Screens ──────────────────────────────────────────────────────────────────
// Every catalogue namespace belongs to exactly one screen group; an unmapped
// namespace stops the tool, so a new screen cannot slip past the packet.
// Tier is the order to review in: P1 consent and account copy first, then the
// release journey, then the rest. P4 is copy for surfaces the V1 decisions
// keep away from students; it is listed so nothing is left out, and reviewed
// last. Check the "not in V1" notes against the release build.
const SCREENS = [
  { id: '01-account-and-consent', title: 'Sign-in, sign-up, guardian consent and account', tier: 'P1',
    ns: ['login', 'signup', 'pw', 'mfa', 'activation', 'accountAction', 'cloudSecurity', 'cloudError', 'deleteRequest', 'guardianPage', 'check'] },
  { id: '02-shell-and-navigation', title: 'App shell, navigation, legal pages and error screens', tier: 'P2',
    ns: ['lang', 'app', 'inst', 'nav', 'common', 'boot', 'errorScreen', 'time', 'difficulty', 'legal', 'gloss', 'charts'] },
  { id: '03-home-and-plan', title: 'Home, study plan, tasks and reminders', tier: 'P2',
    ns: ['home', 'plan', 'reminders', 'tasks', 'inbox', 'review', 'study', 'favorites'] },
  { id: '04-practice-and-answering', title: 'Practice, writing and photo answers, marking and feedback', tier: 'P2',
    ns: ['practice', 'verdict', 'verifiedMarks', 'marks', 'misconception', 'board', 'sym', 'ink', 'photo', 'snap', 'notebook', 'history'] },
  { id: '05-exams', title: 'Timed papers and exam analysis', tier: 'P2',
    ns: ['exams', 'examRoom', 'exam', 'examAnalysis', 'freeCap'] },
  { id: '06-progress-and-placement', title: 'Progress and placement', tier: 'P2', ns: ['progress', 'placement'] },
  { id: '07-notes-and-ncert', title: 'Notes, the NCERT chapter library and explanations', tier: 'P2', ns: ['notes', 'ncert', 'explain'] },
  { id: '08-settings-and-sync', title: 'Settings, account sync and reading consent', tier: 'P2', ns: ['settings', 'cloud'] },
  { id: '09-games', title: 'Rush and match games', tier: 'P3', ns: ['rush', 'match'] },
  { id: '10-not-in-v1', title: 'Surfaces the V1 decisions keep away from students', tier: 'P4',
    ns: ['classes', 'classroom', 'assignment', 'teach', 'tutor', 'calibrate', 'progressAu'] }
];
const NOT_IN_V1 = {
  classes: 'Classes tab hidden from students in the V1 build (D10).',
  classroom: 'Teacher classroom surfaces; hidden with Classes (D10).',
  assignment: 'Classroom assignments; hidden with Classes (D10).',
  teach: 'Teacher-facing tools; hidden with Classes (D10).',
  tutor: 'AI tutor stays off at launch (D4).',
  calibrate: 'Handwriting calibration retired with the on-device readers (D16).',
  progressAu: 'Australian-curriculum progress bands; V1 is India-only (D2, CBSE/NCERT and JEE).'
};
// Copy that decides what leaves the device or what a guardian agrees to. It
// is a legal artefact as well as a translation: counsel reviews it too.
const CONSENT_KEY = /^(settings\.cloud|signup\.(consent|guardian|terms|privacy|age)|guardianPage\.|deleteRequest\.|cloud\.(consent|read|upload|server))/;

const nsScreen = new Map();
for (const s of SCREENS) for (const ns of s.ns) {
  if (nsScreen.has(ns)) throw new Error(`namespace ${ns} is mapped twice`);
  nsScreen.set(ns, s);
}

// ── Provenance from git ─────────────────────────────────────────────────────
// For each line of a file: the commit that last changed it and when. A key's
// provenance is the latest commit across its lines.
function blame(file) {
  const out = execFileSync('git', ['blame', '--line-porcelain', '--', file], { cwd: ROOT, maxBuffer: 256 << 20 }).toString();
  const lines = [];
  let sha = null, time = 0;
  for (const line of out.split('\n')) {
    const head = /^([0-9a-f]{40}) \d+ (\d+)/.exec(line);
    if (head) { sha = head[1]; continue; }
    if (line.startsWith('author-time ')) { time = Number(line.slice(12)); continue; }
    if (line.startsWith('\t')) lines[lines.length] = { sha, time };
  }
  return lines;
}
const commitNotes = new Map();
function agentMarked(sha) {
  if (/^0+$/.test(sha)) return 'uncommitted';
  if (!commitNotes.has(sha)) {
    const body = execFileSync('git', ['show', '-s', '--format=%B', sha], { cwd: ROOT }).toString();
    commitNotes.set(sha, /co-authored-by:[^\n]*(claude|codex|gpt|copilot|gemini|agent)|generated with \[?claude|🤖/i.test(body) ? 'agent-marked' : 'author not recorded');
  }
  return commitNotes.get(sha);
}
// The line range of each top-level 'key': in a catalogue source file.
function keyLines(file) {
  const src = read(file).split('\n');
  const starts = [];
  src.forEach((line, i) => {
    const m = /^\s{2}(['"])([A-Za-z0-9_.-]+)\1\s*:/.exec(line);
    if (m) starts.push([m[2], i]);
  });
  const ranges = new Map();
  starts.forEach(([key, i], n) => {
    let end = n + 1 < starts.length ? starts[n + 1][1] - 1 : src.length - 1;
    while (end > i && /^\s*(\/\/.*)?$/.test(src[end])) end--;
    ranges.set(key, [i, end]);
  });
  return ranges;
}
function provenance(file) {
  const lines = blame(file);
  const ranges = keyLines(file);
  const out = new Map();
  for (const [key, [a, b]] of ranges) {
    let best = lines[a];
    for (let i = a; i <= b; i++) if (lines[i] && lines[i].time > best.time) best = lines[i];
    out.set(key, { sha: best.sha, date: new Date(best.time * 1000).toISOString().slice(0, 10), time: best.time });
  }
  return out;
}

// ── Formatting ───────────────────────────────────────────────────────────────
const text = v => (v && typeof v === 'object' ? Object.entries(v).map(([form, s]) => `${form}: ${s}`).join('\n') : String(v));
// A table cell: pipes escaped, line breaks as <br>. Backslashes are left as
// they are, so LaTeX in a code span reads as the board shows it.
const cell = v => String(v).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
const csvField = v => {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const placeholders = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

// ── Build ────────────────────────────────────────────────────────────────────
const hi = (await load(HI_FILE)).default;
const en = (await load(EN_FILE)).default;
const keys = Object.keys(en);
const missing = keys.filter(k => !(k in hi));
const extra = Object.keys(hi).filter(k => !(k in en));
if (missing.length || extra.length) throw new Error(`catalogues differ: ${missing.length} keys only in English, ${extra.length} only in Hindi`);
for (const k of keys) if (!nsScreen.has(k.split('.')[0])) throw new Error(`namespace ${k.split('.')[0]} (key ${k}) has no screen in SCREENS`);

const hiProv = provenance(HI_FILE);
const enProv = provenance(EN_FILE);
const rows = keys.map(key => {
  const ns = key.split('.')[0];
  const screen = nsScreen.get(ns);
  const h = hiProv.get(key), e = enProv.get(key);
  if (!h || !e) throw new Error(`no source line found for ${key}`);
  const flags = [];
  if (CONSENT_KEY.test(key)) flags.push('consent/legal: counsel reviews too');
  if (e.time > h.time) flags.push('English changed after this Hindi was last edited');
  const enText = text(en[key]), hiText = text(hi[key]);
  if (placeholders(enText) !== placeholders(hiText)) flags.push('placeholders differ from English');
  if (hiText === enText) flags.push('same text as English');
  if (NOT_IN_V1[ns]) flags.push('not in V1');
  return {
    key, ns, screen, tier: CONSENT_KEY.test(key) ? 'P1' : screen.tier, en: enText, hi: hiText,
    sha: h.sha.slice(0, 9), date: h.date, marked: agentMarked(h.sha), flags
  };
});

// ── NCERT terms ──────────────────────────────────────────────────────────────
const TERMS = (await load('client/src/i18n/ncertTerms.js')).default;
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const termRows = TERMS.map(t => {
  const spellings = [t.en, ...(t.also || [])].sort((a, b) => b.length - a.length);
  const re = new RegExp(`\\b(?:${spellings.map(escapeRe).join('|')})\\b`, 'i');
  const using = rows.filter(r => re.test(r.en));
  const uses = using.filter(r => r.hi.includes(t.hi));
  const other = using.filter(r => !r.hi.includes(t.hi));
  return { t, using, uses, other };
});

// ── Other sources a student sees or hears ────────────────────────────────────
// Each is called the way the app calls it, in both languages, so the packet
// shows the actual output rather than a fragment of source.
const guard = await load('client/src/components/photoSubmissionGuard.js');
const grade = await load('client/src/components/authoritativeGrade.js');
const recovery = await load('client/src/components/signedOutInkRecovery.js');
const speech = await load('client/src/explain/speech.js');
const prereq = await load('client/src/engine/prerequisiteSkillsHi.js');
const languages = await load('client/src/i18n/languages.js');
const both = (fn, ...args) => ({ en: fn('en', ...args), hi: fn('hi', ...args) });
const inline = [
  ['client/src/components/photoSubmissionGuard.js', 'pdfReceiptWarning(language, 3)', both(guard.pdfReceiptWarning, 3)],
  ['client/src/components/photoSubmissionGuard.js', 'earlierSubmissionNotice(language, "x = 4", true)', both(guard.earlierSubmissionNotice, 'x = 4', true)],
  ['client/src/components/photoSubmissionGuard.js', 'earlierSubmissionNotice(language, "x = 4", false)', both(guard.earlierSubmissionNotice, 'x = 4', false)],
  ['client/src/components/photoSubmissionGuard.js', 'draftPersistenceWarning(language)', both(guard.draftPersistenceWarning)],
  ['client/src/components/photoSubmissionGuard.js', 'photoSupportedFormats(language)', both(guard.photoSupportedFormats)],
  ['client/src/components/photoSubmissionGuard.js', 'photoAwaitingOnlineReader(language)', both(guard.photoAwaitingOnlineReader)],
  ['client/src/components/photoSubmissionGuard.js', 'pdfReaderNeedsOnlineDownload(language)', both(guard.pdfReaderNeedsOnlineDownload)],
  ['client/src/components/authoritativeGrade.js', 'gradingReceiptMismatch(language)', both(grade.gradingReceiptMismatch)],
  ['client/src/components/authoritativeGrade.js', 'numericalGradeUnavailable(language)', both(grade.numericalGradeUnavailable)]
];
{
  const w = { en: recovery.inkRecoveryWords('en'), hi: recovery.inkRecoveryWords('hi') };
  const flat = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (v && typeof v === 'object' ? flat(v, `${p}${k}.`) : [[`${p}${k}`, v]]));
  const enFlat = new Map(flat(w.en));
  for (const [k, v] of flat(w.hi)) inline.push(['client/src/components/signedOutInkRecovery.js', `inkRecoveryWords(language).${k}`, { en: enFlat.get(k) ?? '(no English entry)', hi: v }]);
}
const SPOKEN = [
  '\\frac{3}{4}', 'x^2', 'x^3', 'x^{5}', '\\sqrt{2}', '3 \\times 4', '6 \\div 2', 'x = 5', 'x + 1', 'x - 1', '\\pm 2',
  'x < 3', 'x > 3', 'x \\le 5', 'x \\ge 5', 'x \\ne 2', '-2 < x \\le 5', '\\pi', '\\theta', '30^\\circ'
];
const spoken = SPOKEN.map(s => ({ latex: s, en: speech.speechText(s, 'en').replace(/\s+/g, ' ').trim(), hi: speech.speechText(s, 'hi').replace(/\s+/g, ' ').trim() }));
const hiLanguage = (languages.LANGUAGES || languages.default || []).find?.(l => l.id === 'hi');

// Files outside the catalogue that contain Devanagari, and why each is in or
// out of the packet. A file not listed here fails --check.
const SOURCES_IN = {
  'client/src/components/photoSubmissionGuard.js': 'photo and PDF answer notices (called above)',
  'client/src/components/authoritativeGrade.js': 'marking-receipt notices (called above)',
  'client/src/components/signedOutInkRecovery.js': 'signed-out handwriting recovery prompts (called above)',
  'client/src/explain/speech.js': 'spoken maths in Hindi narration (sampled above)',
  'client/src/engine/prerequisiteSkillsHi.js': 'prerequisite skill labels on the placement page (all listed)',
  'client/src/i18n/languages.js': 'the language picker label (listed)',
  'client/src/i18n/ncertTerms.js': 'the NCERT term list (ncert-terms.md)',
  'docs/legal/privacy.hi.md': 'Hindi legal notice (listed by hash; lane L7 owns the text)',
  'docs/legal/terms.hi.md': 'Hindi legal notice (listed by hash; lane L7 owns the text)',
  'docs/legal/refund-policy.hi.md': 'Hindi legal notice (listed by hash; lane L7 owns the text)',
  'docs/legal/grievance.hi.md': 'Hindi legal notice (listed by hash; lane L7 owns the text)'
};
const SOURCES_OUT = {
  'client/src/i18n/strings.hi.js': 'the catalogue itself (screens/*.md)',
  'client/src/i18n/strings.en.js': 'the English catalogue; its Devanagari is the language names and glosses shown in the screens tables',
  'client/src/i18n/glossary.js': 'term-matching code for ncertTerms.js; its Devanagari is in comments and search folding',
  'client/src/photo/finalAnswer.js': 'words the answer reader recognises in a student\'s own writing; never displayed',
  'client/src/engine/checker-core.js': 'the rupee abbreviation रु. the answer checker accepts before a number; never displayed',
  'client/src/tutor/captionRule.js': 'number words the tutor caption guard recognises; the tutor is off at launch (D4)',
  'client/src/components/TermGloss.jsx': 'Devanagari only in comments',
  'client/src/pages/Home.jsx': 'Devanagari only in a comment',
  'client/src/pages/SettingsLegacy.jsx': 'Devanagari only in a comment',
  'server/platform/tutor.js': 'tutor prompts; the tutor is off at launch (D4)',
  'server/platform/tutorGuard.js': 'tutor guard word lists; the tutor is off at launch (D4)'
};
function devanagariFiles() {
  const out = [];
  const walk = dir => {
    for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) { walk(p); continue; }
      if (!e.isFile() || !/\.(m?js|jsx|ts|tsx|md|json|html)$/.test(e.name)) continue;
      if (/(^|\/)test(\/|$)|\.test\.m?js$/.test(p)) continue;
      if (DEVANAGARI.test(readFileSync(join(ROOT, p), 'utf8'))) out.push(p);
    }
  };
  for (const d of ['client/src', 'server', 'docs/legal']) if (existsSync(join(ROOT, d))) walk(d);
  return out.sort();
}
const unclassified = devanagariFiles().filter(p => !(p in SOURCES_IN) && !(p in SOURCES_OUT));

const LEGAL = ['privacy', 'terms', 'refund-policy', 'grievance'].map(slug => {
  const enDoc = `docs/legal/${slug}.md`, hiDoc = `docs/legal/${slug}.hi.md`;
  const e = read(enDoc), h = read(hiDoc);
  const heads = s => s.split('\n').filter(l => /^#{1,6}\s/.test(l)).length;
  return { slug, enDoc, hiDoc, enHash: sha256(e).slice(0, 16), hiHash: sha256(h).slice(0, 16), enHeads: heads(e), hiHeads: heads(h), hiChars: h.length };
});

// ── Documents ────────────────────────────────────────────────────────────────
const files = new Map();
const manifest = {
  generator: 'tools/hindi-review-packet.mjs',
  status: STATUS,
  catalogue: { strings: rows.length, hiSha256: sha256(read(HI_FILE)), enSha256: sha256(read(EN_FILE)) },
  sources: Object.fromEntries([...Object.keys(SOURCES_IN), 'client/src/i18n/ncertTerms.js'].filter((p, i, a) => a.indexOf(p) === i).map(p => [p, sha256(read(p)).slice(0, 16)]))
};
const countBy = f => rows.reduce((m, r) => ((m[f(r)] = (m[f(r)] || 0) + 1), m), {});
const tiers = countBy(r => r.tier);
const flagCount = label => rows.filter(r => r.flags.includes(label)).length;
const markedCount = rows.filter(r => r.marked === 'agent-marked').length;

const REVIEW_COLUMNS = '| OK? | Suggested Hindi | Note |';
for (const s of SCREENS) {
  const lines = [];
  const inScreen = rows.filter(r => r.screen === s);
  lines.push(`# ${s.title}`, '');
  lines.push(`Hindi review packet, screen ${s.id.slice(0, 2)}. Status: **${STATUS}.** Review tier ${s.tier}${s.tier === 'P4' ? ' (review last)' : ''}. ${inScreen.length} strings.`, '');
  lines.push('Each row: the English the app shows, the Hindi it shows instead, the last commit that changed the Hindi, and flags. `{name}` is a value the app fills in: keep it exactly as written. `one:` / `other:` are the singular and plural forms. Mark **OK?** with ✓, or write the corrected Hindi.', '');
  for (const ns of s.ns) {
    const nsRows = inScreen.filter(r => r.ns === ns);
    if (!nsRows.length) continue;
    lines.push(`## \`${ns}.*\` (${nsRows.length})`, '');
    if (NOT_IN_V1[ns]) lines.push(`Not in V1: ${NOT_IN_V1[ns]}`, '');
    lines.push(`| Key | English | Hindi | Last Hindi edit | Flags ${REVIEW_COLUMNS}`);
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const r of nsRows) {
      lines.push(`| \`${r.key}\` | ${cell(r.en)} | ${cell(r.hi)} | ${r.date} \`${r.sha}\` (${r.marked}) | ${cell(r.flags.join('; ') || '—')} |  |  |  |`);
    }
    lines.push('');
  }
  files.set(`screens/${s.id}.md`, lines.join('\n'));
}

files.set('strings.csv', [
  ['key', 'screen', 'tier', 'english', 'hindi', 'last_hindi_commit', 'last_hindi_date', 'commit_marking', 'flags', 'status', 'reviewer_ok', 'reviewer_suggested_hindi', 'reviewer_note'].join(','),
  ...rows.map(r => [r.key, r.screen.id, r.tier, r.en, r.hi, r.sha, r.date, r.marked, r.flags.join('; '), STATUS, '', '', ''].map(csvField).join(','))
].join('\n') + '\n');

{
  const lines = [];
  lines.push('# NCERT term list', '');
  lines.push(`Hindi review packet. Status: **${STATUS}.**`, '');
  lines.push('These are the maths terms in `client/src/i18n/ncertTerms.js`. That file holds the NCERT Hindi term the app shows beside an English term when the "Show NCERT Hindi terms" setting is on. Each term carries where it was read: `page` (a rendered page of an NCERT Hindi textbook PDF), `title` (a chapter or section title), or `corpus` with `n`, its count in the extracted text of the sampled chapters (Classes 7–12). None of this has been checked by a person against the printed books.', '');
  lines.push('For each term, the table counts the catalogue strings whose English uses it, and how many of their Hindi translations use the NCERT term. The match is a plain text search, so an inflected form can count as a use, and a string can rightly use another word. Rows in the last column are the ones to read first.', '');
  lines.push('Please check: is the NCERT term right for that class level? Does the interface use it consistently? Where a string uses a different word, is that deliberate?', '');
  lines.push('| English | NCERT Hindi | Source | Strings using the English | Hindi uses the term | Keys where the Hindi does not (first 10) | OK? | Note |');
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const { t, using, uses, other } of termRows) {
    const src = t.src === 'corpus' ? `corpus, n = ${t.n}` : t.n ? `${t.src}, n = ${t.n}` : t.src;
    const also = t.also?.length ? ` (also ${t.also.join(', ')})` : '';
    lines.push(`| ${cell(t.en + also)} | ${cell(t.hi)} | ${src} | ${using.length} | ${uses.length} | ${other.slice(0, 10).map(r => `\`${r.key}\``).join(' ') || '—'} |  |  |`);
  }
  lines.push('', 'Deliberately not translated, because NCERT\'s own Hindi books print them in Latin: sin, cos, tan, lim, log, dx, unit symbols, JEE, NCERT, CBSE (see the head of `ncertTerms.js`).', '');
  files.set('ncert-terms.md', lines.join('\n'));
}

{
  const lines = [];
  lines.push('# Hindi outside the catalogue', '');
  lines.push(`Hindi review packet. Status: **${STATUS}.**`, '');
  lines.push('Hindi a student sees or hears that does not come from `strings.hi.js`. Every function below was called with English and with Hindi, so each pair is what the app actually shows.', '');
  lines.push('## Notices written beside their component', '');
  lines.push('A comment in `photoSubmissionGuard.js` says these notices should move into the parity-checked catalogue. Until they do, they are reviewed here.', '');
  lines.push(`| Source | Call | English | Hindi ${REVIEW_COLUMNS}`, '|---|---|---|---|---|---|---|');
  for (const [file, call, pair] of inline) lines.push(`| \`${file.split('/').pop()}\` | \`${cell(call)}\` | ${cell(pair.en)} | ${cell(pair.hi)} |  |  |  |`);
  lines.push('', '## Spoken maths (Explain narration)', '');
  lines.push('`client/src/explain/speech.js` turns a line of the board into words for the speech engine. Hindi puts a comparison after the number it compares with ("x, 3 से कम है"). Please check that each line sounds like a Hindi-medium maths teacher speaking.', '');
  lines.push(`| Board | Spoken in English | Spoken in Hindi ${REVIEW_COLUMNS}`, '|---|---|---|---|---|---|');
  for (const s of spoken) lines.push(`| \`${cell(s.latex)}\` | ${cell(s.en)} | ${cell(s.hi)} |  |  |  |`);
  // A narration defect found while building this packet, stated for as long
  // as it reproduces: `\ne` is dropped, while `\neq` and ≠ are spoken.
  const ne = spoken.find(s => s.latex === 'x \\ne 2');
  if (ne && !/not equal/.test(ne.en)) {
    lines.push('', `Known defect, found while building this packet and reported to the owner of \`speech.js\`: \`x \\ne 2\` is spoken as "${ne.en}" / "${ne.hi}", so the relation is lost, while \`x \\neq 2\` and \`x ≠ 2\` are spoken correctly. This packet does not fix it.`);
  }
  lines.push('', '## Prerequisite skill labels (placement page)', '');
  lines.push(`\`client/src/engine/prerequisiteSkillsHi.js\`: ${Object.keys(prereq.PREREQ_SKILLS_HI).length} labels.`, '');
  lines.push(`| English | Hindi ${REVIEW_COLUMNS}`, '|---|---|---|---|---|');
  for (const [k, v] of Object.entries(prereq.PREREQ_SKILLS_HI)) lines.push(`| ${cell(k)} | ${cell(v)} |  |  |  |`);
  lines.push('', '## Language picker', '');
  lines.push(`\`client/src/i18n/languages.js\` shows the Hindi option as **${hiLanguage?.label ?? '(not found)'}** (English name: ${hiLanguage?.english ?? '—'}).`, '');
  lines.push('## Legal notices (lane L7)', '');
  lines.push('The four notices are documents, not strings, and lane L7 owns their text (`docs/legal/**`). L7 is rewriting them now, in #727. In each document the English text is the operative version. Review the Hindi against the English of the **same** version: the hashes below identify the version this packet was generated from. Regenerate before review if they no longer match.', '');
  lines.push('| Notice | English | Hindi | English sha256 (first 16) | Hindi sha256 (first 16) | Headings EN / HI | OK? | Note |', '|---|---|---|---|---|---|---|---|');
  for (const l of LEGAL) lines.push(`| ${l.slug} | \`${l.enDoc}\` | \`${l.hiDoc}\` | \`${l.enHash}\` | \`${l.hiHash}\` | ${l.enHeads} / ${l.hiHeads}${l.enHeads === l.hiHeads ? '' : ' ⚠ differ'} |  |  |`);
  lines.push('', '## Files with Devanagari that are not in this packet', '');
  lines.push('| File | Why it is left out |', '|---|---|');
  for (const [p, why] of Object.entries(SOURCES_OUT)) lines.push(`| \`${p}\` | ${cell(why)} |`);
  lines.push('');
  files.set('other-sources.md', lines.join('\n'));
}

{
  const lines = [];
  lines.push('# Hindi review packet (D11)', '');
  lines.push(`**Status: ${STATUS}.** No native speaker has reviewed the Hindi interface, and this packet does not say otherwise. ${markedCount} of the ${rows.length} catalogue strings were last changed in a commit marked as agent-written ("agent-marked"). The other ${rows.length - markedCount} were last changed in commits that do not record who wrote them ("author not recorded"). Neither marking means a person checked the Hindi, so every row is flagged for review.`, '');
  lines.push('Decision D11 (docs/release/V1_DECISIONS_2026-11-01.md) keeps the Hindi switch and requires a native-speaker review before release. `docs/i18n.md` sets the rule: a machine-authored translation is not reviewed until a native speaker who knows the school register has read it on screen.', '');
  lines.push('## What is in the packet', '');
  lines.push(`- \`screens/\`: every one of the **${rows.length}** catalogue strings (\`client/src/i18n/strings.hi.js\` beside \`strings.en.js\`), grouped into ${SCREENS.length} screens.`);
  lines.push('- `strings.csv`: the same rows as a working sheet, with columns for the reviewer.');
  lines.push(`- \`ncert-terms.md\`: the ${TERMS.length} NCERT maths terms and how the catalogue uses each one.`);
  lines.push(`- \`other-sources.md\`: Hindi from outside the catalogue (${inline.length} notices, ${spoken.length} spoken-maths samples, ${Object.keys(prereq.PREREQ_SKILLS_HI).length} skill labels, the language picker) and the four legal notices, identified by hash.`);
  lines.push('- `manifest.json`: hashes of every source this packet was generated from.', '');
  lines.push('| Screen | Tier | Strings |', '|---|---|---|');
  for (const s of SCREENS) lines.push(`| [${s.title}](screens/${s.id}.md) | ${s.tier} | ${rows.filter(r => r.screen === s).length} |`);
  lines.push('');
  lines.push('## Review order', '');
  lines.push(`1. **P1, consent and account (${tiers.P1 || 0} strings).** Sign-in, sign-up, guardian consent, account deletion, and the settings copy that says what leaves the device. ${flagCount('consent/legal: counsel reviews too')} of these are also flagged \`consent/legal\`. They are legal artefacts as well as translations, so counsel reviews them too. The legal notices in \`other-sources.md\` go with this tier.`);
  lines.push(`2. **P2, the release journey (${tiers.P2 || 0} strings).** Home, practice, writing and photo answers, marking and feedback, exams, progress, notes, settings. Read these on screen where you can.`);
  lines.push(`3. **P3, games (${tiers.P3 || 0} strings).**`);
  lines.push(`4. **P4, not in V1 (${tiers.P4 || 0} strings).** Classes, teacher tools, the tutor, calibration and Australian progress. The V1 decisions keep these away from students; they are listed so nothing is left out.`, '');
  lines.push('## Flags', '');
  lines.push(`- **English changed after this Hindi was last edited** (${flagCount('English changed after this Hindi was last edited')} strings): the English line has a later commit than the Hindi. Check that the Hindi still says what the English now says.`);
  lines.push(`- **placeholders differ from English** (${flagCount('placeholders differ from English')}): the \`{name}\` values do not match. Usually that is a bug.`);
  lines.push(`- **same text as English** (${flagCount('same text as English')}): the Hindi string equals the English, such as a proper noun or a symbol. Confirm that is right.`);
  lines.push(`- **consent/legal: counsel reviews too** (${flagCount('consent/legal: counsel reviews too')}).`);
  lines.push(`- Commit marking: ${markedCount} of ${rows.length} strings were last changed in a commit marked as agent-written, and the rest in commits with no author record.`, '');
  lines.push('## What to check', '');
  lines.push('The rules the strings were written to are in the header of `strings.hi.js` and in `docs/i18n.md`. They are proposals for you to confirm, not settled facts:', '');
  lines.push('- The register is आप, with -ें on buttons (सहेजें) and -इए in instructions (ज्ञात कीजिए), as in NCERT Hindi-medium books.');
  lines.push('- Maths terms are NCERT\'s (see `ncert-terms.md`). Proper names stay in Latin script: Pri Learning, NCERT, CBSE, JEE.');
  lines.push('- Numerals are 0–9, not ०–९. Sentences end with ।. A counted noun takes the oblique form before a postposition (10 अंकों में से).');
  lines.push('- Keep every `{name}` placeholder exactly as written. Questions themselves stay in English by design (D11), so only interface text is in scope.', '');
  lines.push('Write findings in `strings.csv` (reviewer columns) or in the OK? / Suggested Hindi / Note columns of the screen files. An agent applies the corrections to `strings.hi.js` in a PR that names you as the source. It does not mark anything reviewed.', '');
  lines.push('## Sign-off', '');
  lines.push('Fill in one row per reviewer when the review is done. A row means that person read the listed scope, at the catalogue hash shown, on screen, and that every correction they asked for has been applied or recorded. Nobody has signed yet.', '');
  lines.push('| Reviewer | Qualification | Scope reviewed | Catalogue sha256 reviewed | Date | Where the signed copy is kept |');
  lines.push('|---|---|---|---|---|---|');
  lines.push('| — not yet reviewed — | Needed: native Hindi speaker who knows the Hindi-medium school register (for example, a teacher of Classes 7–12 mathematics in Hindi medium) | — | — | — | — |');
  lines.push('| — counsel (consent and legal rows only) — | Needed: Indian counsel, as for the English notices | — | — | — | — |', '');
  lines.push('Where the sign-off is kept: the owner records it in this table by a PR, and on the D11 line of the release dossier. The reviewer\'s signed copy (an email or a signed PDF of this packet) is kept by the owner outside this repository, and the table names where. A reviewer\'s name goes in this table only with their consent.', '');
  lines.push('## This packet', '');
  lines.push(`- Generated by \`node tools/hindi-review-packet.mjs\` from the catalogue with sha256 \`${manifest.catalogue.hiSha256}\` (Hindi) and \`${manifest.catalogue.enSha256}\` (English).`);
  lines.push('- `node tools/hindi-review-packet.mjs --check` fails if any file here is older than its sources, or if Devanagari appears in a source file the tool has not classified. Run it at the release-candidate freeze, regenerate, and give the reviewer that version.');
  lines.push('- Other lanes keep editing the catalogue until the freeze, so this packet goes stale whenever they do. It records provenance and does not judge quality: nothing here is evidence that the Hindi is good.', '');
  files.set('README.md', lines.join('\n'));
}
files.set('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

// ── Write or check ───────────────────────────────────────────────────────────
if (unclassified.length) {
  console.log(`HINDI REVIEW PACKET: FAIL — Devanagari in ${unclassified.length} unclassified file(s): ${unclassified.join(', ')}. Add each to SOURCES_IN or SOURCES_OUT with a reason.`);
  process.exit(1);
}
const stale = [];
for (const [name, body] of files) {
  const path = join(OUT, name);
  if (CHECK) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== body) stale.push(name);
  } else {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
  }
}
const summary = `${rows.length} catalogue strings in ${SCREENS.length} screens (P1 ${tiers.P1 || 0}, P2 ${tiers.P2 || 0}, P3 ${tiers.P3 || 0}, P4 ${tiers.P4 || 0}), ${TERMS.length} NCERT terms, ${inline.length} inline notices, ${spoken.length} spoken samples, ${LEGAL.length} legal notices; status: ${STATUS}`;
if (CHECK && stale.length) {
  console.log(`HINDI REVIEW PACKET: FAIL — stale: ${stale.join(', ')}. Run node tools/hindi-review-packet.mjs and commit docs/release/hindi-review/.`);
  process.exit(1);
}
console.log(`HINDI REVIEW PACKET: ${CHECK ? 'PASS (current)' : 'WROTE'} — ${summary}`);
