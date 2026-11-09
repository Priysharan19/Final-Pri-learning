// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · marketing and store copy make no claim the product cannot keep
//
// The carousel, the reel and the ad sold a product that no longer exists: "100%
// offline", "no upload, no account", "marked like an examiner", a predicted
// percentile, 3,44,798 questions, 98.4% recognition, ₹999 a month and an
// Olympiad track (audit items 11 and 17; owner decision D24, 1 Nov 2026).
// AGENTS.md bars syllabus-complete, accuracy and superiority claims outright.
//
// This suite is the list of retired phrases, each with the reason it is
// retired, and it fails when any of them comes back into:
//
//   · marketing/   (carousel, reel, A2Z poster and claim page)
//   · ad/docs, ad/src, ad/README.md and the caption files under ad/out
//   · promotions/  (the A2Z service and its Meta review pack)
//   · docs/release/store/*.md (the App Store and Play listings)
//   · the app's own catalogues, client/src/i18n/strings.{en,hi}.js, for the
//     phrases that are also false inside the product.
//
// Rendered binaries (PNG, MP4, WAV) are not scanned: they are rebuilt from the
// sources scanned here, and the posting kits say which renders are stale.
// ─────────────────────────────────────────────────────────────────────────────
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

// [pattern, why it is retired]. Case-insensitive unless the pattern says otherwise.
const MARKETING = [
  [/100%\s*offline/i, 'grading is online-only (ADR-0001); nothing is 100% offline'],
  [/\ball (?:of it )?offline\b/i, 'grading is online-only'],
  [/\b(?:works|fully|entirely|completely) offline\b/i, 'grading is online-only'],
  // "no upload evidence" (a release note about store-upload signing, not ink) is not the claim.
  [/\bno upload\b(?!\s+evidence\b)/i, 'ink is sent to the server reader; the claim described the retired on-device design'],
  [/\bno account\b/i, 'checking answers needs an account'],
  [/\bon the ipad itself\b/i, 'reading and marking are not on the device'],
  [/\bgenerated on[- ]device\b/i, 'questions are issued by the server'],
  [/\ball on[- ]device\b/i, 'the retired on-device design'],
  [/\bon device, no\b/i, 'the retired on-device design'],
  [/\blike an? (?:real )?examiner\b/i, 'no examiner has certified any rubric (#499 open); AGENTS.md bars superiority claims'],
  [/\bexaminer[- ](?:style|grade)\b/i, 'no examiner has certified any rubric'],
  [/\bstep marks, like\b/i, 'method marks are off in production until the examiner review (D12)'],
  [/\bpercentile\b/i, 'the app does not convert practice into a percentile or rank, and says so'],
  [/\bcalibrated to jee\b/i, 'nothing is calibrated to JEE Main'],
  [/\bmark predictor\b/i, 'there is no mark predictor; the app shows a mark estimate over practised parts only'],
  [/\brank predict/i, 'the app does not predict a rank'],
  [/\bevery ncert chapter\b/i, 'Class 9 has 8 of 15 chapters and Class 8 follows the earlier book'],
  [/\bevery chapter\b/i, 'coverage wording ruled out by D24'],
  [/\bevery topic\b/i, 'coverage wording ruled out by D24'],
  [/\ball of it, mapped\b/i, 'coverage wording ruled out by D24'],
  [/\ball of it on your\b/i, 'coverage and on-device wording ruled out by D24'],
  [/\bmaps all of class\b/i, 'coverage wording ruled out by D24'],
  [/\bcomplete syllabus\b|\bfull syllabus\b|\bsyllabus[- ]complete\b/i, 'AGENTS.md bars syllabus-complete claims'],
  [/\bsyllabus[- ]aligned\b/i, 'wording ruled out by D24'],
  [/\bsource[- ]reviewed\b|\bsource[- ]audited\b|\bindependently verified\b/i, 'no human reviewer has signed any chapter'],
  [/\b(?:examiner|board|cbse|nta|ncert)[- ]certified\b|\bcertified (?:content|questions|accurate|syllabus|marking)\b/i, 'nothing is certified by an external body'],
  [/\bofficial (?:syllabus|content|questions|partner|app|marking)\b/i, 'wording ruled out by D24 (describing a published paper as official is allowed)'],
  [/(?<!frame-)\baccurate\b|\baccuracy\b/i, 'no accuracy claim without a real-writer study'],
  [/\bhardest\b/i, 'wording ruled out by D24'],
  [/\bunlimited (?:questions|practice)\b/i, 'the free tier is capped and the pool is finite; say what Premium removes'],
  [/\bnever runs? out\b|\bdoes not run out\b|\bnot run out\b/i, 'a quantity claim D24 rules out; small pools do repeat'],
  [/\bit never runs out\b/i, 'a quantity claim D24 rules out'],
  [/₹\s?999\b|\b999\s?(?:\/|a |per )month\b|\bnine ninety nine\b/i, 'the approved prices are ₹199 and ₹1,499 (D19)'],
  [/\bsave ₹|\bsave rs\.? ?[0-9]/i, 'no price comparison with coaching'],
  [/big-brand coaching|two-year jee classroom programme/i, 'no price comparison with coaching'],
  [/\bthree lakh\b|\blakh questions\b|\b3,?44,?798\b/i, 'no question count (D24)'],
  [/\b252\s*\/\s*252\b|\b252 dot points\b/i, 'the dot-point count is stale and coverage means a generator exists'],
  [/\b98\.4\s?%|\b94\.5\s?%|\bheld-out writer/i, 'a simulated-writer figure for a reader that no longer marks; no accuracy claim'],
  [/\bolympiad\b/i, 'Olympiad is outside V1 and flagged off for new profiles'],
  [/\bclass 9[–-]12\b/i, 'the product is Classes 7–12'],
  [/\bfollows the ncert syllabus\b/i, 'too strong for Classes 8, 9, 11 and 12 as shipped'],
  [/\bcriteria marking\b/i, 'method marks are off in production until the examiner review (D12)']
];

// Inside the app the same phrases are false; the ones below are the ones that
// can appear in interface copy, plus the review claims. A string that mentions
// a phrase only to deny it is allowlisted by key with its reason.
const APP = [
  [/\bsource[- ]reviewed\b|\bsource[- ]audited\b|\bindependently verified\b|\brelease audit\b/i, 'no human reviewer has signed any chapter'],
  [/\blike an? (?:real )?examiner\b|\bexaminer[- ]grade\b/i, 'no examiner has certified any rubric'],
  [/\bevery chapter\b|\bevery topic\b|\bcomplete syllabus\b|\bfull syllabus\b|\bsyllabus[- ]aligned\b/i, 'coverage wording ruled out by D24'],
  [/\bmark predictor\b|\bcalibrated to jee\b|\bpredicted percentile\b|\bpercentile predict/i, 'the app does not predict a percentile, rank or mark'],
  [/\bunlimited questions\b/i, 'the pool is finite; say what Premium removes'],
  [/\bgenerated on[- ]device\b/i, 'questions are issued by the server'],
  [/₹\s?999\b/, 'the approved prices are ₹199 and ₹1,499']
];
const APP_ALLOW = new Map([
  ['verifiedMarks.finalAccepted', 'denies that every line was independently verified'],
  ['progress.honesty', 'denies the percentile and rank prediction']
]);

const TEXT = new Set(['.md', '.mjs', '.js', '.jsx', '.ts', '.tsx', '.html', '.json', '.cjs', '.srt', '.txt', '.css']);
const SKIP_DIRS = new Set(['node_modules', 'out', 'export', 'assets', 'public', '.git']);
const SKIP_FILES = new Set(['package-lock.json']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) || SKIP_FILES.has(name)) continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) yield* walk(full);
    else if (TEXT.has(extname(name))) yield full;
  }
}

const roots = ['marketing', 'ad/docs', 'ad/src', 'promotions', 'docs/release/store'];
const files = roots.flatMap(r => [...walk(join(ROOT, r))]);
files.push(join(ROOT, 'ad/README.md'), join(ROOT, 'ad/out/captions.srt'), join(ROOT, 'ad/out/captions-15.srt'));
ok(files.length > 40, `scanned ${files.length} marketing, ad, promotion and store files`);

// A line that names a retired phrase only to rule it out, deny it or record
// that it was withdrawn is not a claim: the posting kits list what must not be
// said, and the ad's design notes record the old copy they replaced.
const DENIAL = /\b(?:no|not|never|nothing|none|do not|does not|don't|cannot|without|instead of|retired|ruled out|bars?|may not|must not|withdrawn|withdraw|outside|invented|older?|earlier|used to|stale|replaced|predate|revised)\b/i;
// Prose wraps, so the denial may sit at the end of the previous line.
function claims(lines, i, pattern) {
  const line = lines[i];
  const m = pattern.exec(line);
  if (!m) return false;
  const before = (i > 0 ? lines[i - 1] + ' ' : '') + line.slice(0, m.index);
  return !DENIAL.test(before);
}

for (const file of files) {
  const rel = relative(ROOT, file);
  const text = readFileSync(file, 'utf8');
  for (const [pattern, why] of MARKETING) {
    const lines = text.split('\n');
    const hit = lines.findIndex((_, i) => claims(lines, i, pattern));
    ok(hit === -1, `${rel}:${hit + 1} carries a retired claim ${pattern} — ${why}: ${lines[hit]?.trim().slice(0, 100)}`);
  }
}

// Both app catalogues, value by value.
for (const [name, rel] of [['strings.en.js', 'client/src/i18n/strings.en.js'], ['strings.hi.js', 'client/src/i18n/strings.hi.js']]) {
  const catalogue = (await import(join(ROOT, rel))).default;
  const entries = [];
  for (const [key, value] of Object.entries(catalogue)) {
    if (typeof value === 'string') entries.push([key, value]);
    else if (value && typeof value === 'object') for (const v of Object.values(value)) if (typeof v === 'string') entries.push([key, v]);
  }
  ok(entries.length > 1000, `${name}: ${entries.length} values loaded`);
  for (const [pattern, why] of APP) {
    const hits = entries.filter(([key, value]) => pattern.test(value) && !APP_ALLOW.has(key)).map(([key]) => key);
    ok(hits.length === 0, `${name}: ${hits.slice(0, 6).join(', ')} carries ${pattern} — ${why}`);
  }
}

// The store descriptions carry the approved wording and the two honest notes.
for (const rel of ['docs/release/store/app-store-listing.md', 'docs/release/store/play-listing.md']) {
  const text = readFileSync(join(ROOT, rel), 'utf8');
  ok(/maths practice for CBSE \/ NCERT Classes 7 to 12, JEE Main and JEE Advanced/i.test(text), `${rel} states the approved scope wording`);
  ok(/8 of the 15 chapters in the CBSE 2026–27 list/.test(text), `${rel} carries the Class 9 note`);
  ok(/follows the earlier NCERT book/.test(text), `${rel} carries the Class 8 note`);
  ok(/Marking is automatic and can be wrong/.test(text), `${rel} says marking is automatic and can be wrong`);
  ok(/not endorsed\s+by, affiliated with or approved by NCERT, CBSE, the NTA/i.test(text.replace(/\n> ?/g, ' ')), `${rel} carries the non-endorsement line`);
}

// The chapter count the copy quotes is the curriculum's.
{
  const { IN_CURRICULUM } = await import(join(ROOT, 'client/src/engine/curriculum-in.js'));
  const chapters = IN_CURRICULUM.reduce((n, g) => n + g.chapters.length, 0);
  const carousel = readFileSync(join(ROOT, 'marketing/feature-carousel/build.mjs'), 'utf8');
  ok(carousel.includes(`${chapters} chapters`), `the carousel quotes the live chapter count (${chapters})`);
  for (const rel of ['docs/release/store/app-store-listing.md', 'docs/release/store/play-listing.md']) {
    ok(readFileSync(join(ROOT, rel), 'utf8').includes(`${chapters} chapters`), `${rel} quotes the live chapter count (${chapters})`);
  }
  const grade9 = IN_CURRICULUM.find(g => g.grade === 9);
  ok(grade9.chapters.length === 8, `the "8 of the 15" note is true: Class 9 has ${grade9.chapters.length} live chapters`);
}

const total = pass + failures.length;
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`MARKETING CLAIMS: FAIL — ${pass}/${total} checks`);
  process.exit(1);
}
console.log(`MARKETING CLAIMS: PASS — ${pass}/${total} checks — ${files.length} marketing, ad, promotion and store files and both app catalogues carry none of the ${MARKETING.length} retired claims`);
