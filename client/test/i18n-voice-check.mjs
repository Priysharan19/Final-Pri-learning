// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · narration language and the language registry
//
// Pri Explain used to speak every lesson with utterance.lang = 'en-AU' — an
// Australian voice for a student in Lucknow, and an Australian voice reading
// Hindi captions to a student who had switched the app to Hindi. This suite
// holds the replacement:
//
//   1. The voice follows the interface language: en-IN for English, hi-IN for
//      Hindi, falling back to another voice of the same language, then to
//      English, and never to a voice of an unrelated language.
//   2. Maths is spoken as words in the narration language, and the line on the
//      board is never what changes.
//   3. The language table is the only registration: the runtime loaders, the
//      build's chunks and the service worker's on-demand rules are all derived
//      from it, so adding a language cannot half-happen.
//
// Usage: node client/test/i18n-voice-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { pickVoice, speechText } from '../src/explain/speech.js';
import { LANGUAGES, DEFAULT_LANGUAGE, speechTagsOf, pluralCategory } from '../src/i18n/languages.js';
import { CHUNK_GROUPS, ON_DEMAND } from '../vite.config.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = rel => readFileSync(join(ROOT, rel), 'utf8');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const eq = (a, b, label) => ok(JSON.stringify(a) === JSON.stringify(b), `${label} — expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

// ── 1 · Which voice ──────────────────────────────────────────────────────────
const voice = (lang, name = lang, localService = true) => ({ lang, name, localService });
const DEVICE = [voice('en-US'), voice('en-AU'), voice('en-IN'), voice('hi-IN'), voice('fr-FR')];

eq(speechTagsOf('en')[0], 'en-IN', 'English narration asks for Indian English first');
eq(speechTagsOf('hi')[0], 'hi-IN', 'Hindi narration asks for Hindi (India) first');
eq(speechTagsOf('zz')[0], 'en-IN', 'an unknown language is cleaned to English before a voice is chosen');

eq(pickVoice(DEVICE, 'en').voice?.lang, 'en-IN', 'English picks en-IN over en-US and en-AU when the device has it');
eq(pickVoice(DEVICE, 'en').fallback, 'exact', 'and says it was an exact match');
eq(pickVoice(DEVICE, 'hi').voice?.lang, 'hi-IN', 'Hindi picks hi-IN');
eq(pickVoice(DEVICE, 'hi').lang, 'hi-IN', 'and tags the utterance hi-IN');
eq(pickVoice([voice('hi_IN')], 'hi').lang, 'hi-IN', 'an Android-style hi_IN voice still matches, and the tag is normalised');

eq(pickVoice([voice('en-US'), voice('hi')], 'hi').fallback, 'language',
  'with no hi-IN, a Hindi voice of any region is the next choice');
eq(pickVoice([voice('en-US'), voice('hi')], 'hi').voice?.lang, 'hi', 'and it is the Hindi one, not the English one');

const noHindi = pickVoice([voice('en-GB'), voice('fr-FR'), voice('en-IN')], 'hi');
eq(noHindi.fallback, 'english', 'with no Hindi voice at all, Hindi narration falls back to English');
eq(noHindi.voice?.lang, 'en-IN', 'and to Indian English first among the English voices');
eq(pickVoice([voice('fr-FR'), voice('de-DE')], 'hi').voice, null,
  'it never picks a voice of an unrelated language — a French voice reading Hindi is worse than the platform default');
eq(pickVoice([voice('fr-FR')], 'hi').lang, 'hi-IN', 'and in that case still tags the utterance in the language asked for');
eq(pickVoice([], 'hi'), { voice: null, lang: 'hi-IN', fallback: 'none' },
  'before the browser has listed its voices, the tag alone still asks for Hindi');
eq(pickVoice(undefined, 'en').lang, 'en-IN', 'and a missing list is not an error');
eq(pickVoice([voice('en-GB'), voice('en-US')], 'en').voice?.lang, 'en-GB', 'English without en-IN takes the next registered English voice');
eq(pickVoice([voice('hi-IN', 'net', false), voice('hi-IN', 'local', true)], 'hi').voice?.name, 'local',
  'between two equal matches, the on-device voice wins — it still speaks offline');

// ── 2 · How maths is said ────────────────────────────────────────────────────
const SAID = [
  ['x^2 + 5x + 6 = 0', 'x squared plus 5x plus 6 equals 0', 'x का वर्ग धन 5x धन 6 बराबर 0'],
  ['\\frac{3}{4}', '3 divided by 4', '3 बटा 4'],
  ['3/4', '3 divided by 4', '3 बटा 4'],
  ['\\sqrt{49} = 7', 'square root of 49 equals 7', '49 का वर्गमूल बराबर 7'],
  ['x^{5}', 'x to the power of 5', 'x की घात 5'],
  ['(x+1)^3', '(x plus 1) cubed', '(x धन 1) का घन'],
  ['πr²', 'pi r squared', 'पाई r का वर्ग'],
  ['a ≤ b', 'a less than or equal to b', 'a से कम या बराबर b'],
  ['x − 3 ≠ 0', 'x minus 3 not equal to 0', 'x ऋण 3 बराबर नहीं 0'],
  ['2 \\times 3 \\div 6', '2 times 3 divided by 6', '2 गुणा 3 भाग 6'],
  ['$y = -4$', 'y equals minus 4', 'y बराबर ऋण 4'],
  ['∠A = 60°', '∠A equals 60 degrees', '∠A बराबर 60 डिग्री']
];
for (const [maths, english, hindi] of SAID) {
  eq(speechText(maths, 'en'), english, `English says ${maths} in words`);
  eq(speechText(maths, 'hi'), hindi, `Hindi says ${maths} in words`);
}
eq(speechText('a two-step method and/or a check', 'en'), 'a two-step method and/or a check',
  'a hyphen inside a word and a slash between words are prose, not minus and division');
eq(speechText('', 'hi'), '', 'nothing to say is nothing said');
eq(speechText('x^2', 'zz'), 'x squared', 'an unknown language speaks maths in English');

// The player must speak through this module, in the student's language, and
// must not have kept a voice of its own.
const player = read('src/components/PriExplainV5.jsx');
ok(!/en-AU/.test(player), 'Pri Explain no longer hard-codes an Australian voice');
ok(/pickVoice\(window\.speechSynthesis\.getVoices\?\.\(\) \|\| \[\], language\)/.test(player),
  'the player chooses its voice for the interface language');
ok(/speechText\(value, language\)/.test(player), 'and speaks maths in that language');
ok(/const \{ t, language \} = useLanguage\(\)/.test(player), 'and reads the language from the i18n store');
ok(!/function speechText/.test(player), 'the player has no second, English-only copy of the maths-speech rules');
// The board itself is never rewritten: lines are rendered from the scene (or
// its caption key), and speechText is only ever called on what is spoken.
ok(/<MathText text=\{lineOf\(current, lineIndex\)\} \/>/.test(player), 'the board renders the scene line, not the spoken form');
ok(!/<MathText text=\{speechText/.test(player), 'and never the spoken form');

// ── 3 · One registration table ───────────────────────────────────────────────
const translated = LANGUAGES.filter(l => l.id !== DEFAULT_LANGUAGE);
for (const lang of LANGUAGES) {
  ok(typeof lang.id === 'string' && /^[a-z]{2,3}$/.test(lang.id), `${lang.english} has a plain language id`);
  ok(Array.isArray(lang.speech) && lang.speech.length && lang.speech.every(t => /^[a-z]{2,3}-[A-Z]{2}$/.test(t)),
    `${lang.english} registers BCP-47 narration tags`);
  ok(base(lang.speech[0]) === lang.id, `${lang.english}'s first narration tag is in ${lang.english}`);
  ok(['one', 'other'].includes(pluralCategory(1, lang.id)) && ['one', 'other'].includes(pluralCategory(7, lang.id)),
    `${lang.english} has a plural rule`);
}
function base(tag) { return String(tag).split('-')[0]; }
for (const lang of translated) {
  ok(typeof lang.load === 'function', `${lang.english} registers a loader`);
  ok(new RegExp(`import\\('\\./strings\\.${lang.id}\\.js'\\)`).test(read('src/i18n/languages.js')),
    `${lang.english}'s loader is a literal import() the bundler can split`);
  ok(CHUNK_GROUPS.some(g => g.name === `i18n-${lang.id}` && g.test.test(`/repo/client/src/i18n/strings.${lang.id}.js`)),
    `the build emits ${lang.english} as its own chunk, derived from the table`);
  ok(ON_DEMAND.some(([re]) => re.test(`assets/i18n-${lang.id}-AbC123.js`)),
    `and the service worker leaves ${lang.english} out of the install, derived from the table`);
}
ok(!LANGUAGES.find(l => l.id === DEFAULT_LANGUAGE).load, 'English has no loader — it is in the entry and cannot be missing');
eq(CHUNK_GROUPS.filter(g => /^i18n-/.test(g.name) && g.name !== 'i18n-terms').length, translated.length,
  'one translation chunk per registered language, no more and no fewer');
ok(!/strings\.hi\.js/.test(read('vite.config.js')), 'the build config names no language by hand');
ok(!/strings\.hi\.js/.test(read('src/i18n/index.js').replace(/^\s*\/\/.*$/gm, '')), 'nor does the runtime');

const total = pass + failures.length;
if (failures.length) {
  console.error(`I18N VOICE: FAIL — ${failures.length}/${total} checks failed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`I18N VOICE: PASS — ${pass}/${total} checks — narration follows the interface language (en-IN / hi-IN with same-language then English fallback), ${SAID.length} maths forms spoken in both languages, ${LANGUAGES.length} languages registered from one table.`);
