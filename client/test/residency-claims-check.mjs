// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · nothing says where model processing happens until it is proven
//
// ADR-0002 §10 and plan H7: each regional deployment keeps its own database
// and its own key, but the model provider's processing location is NOT
// verified for either region (docs/operations/ai-budgets-per-region.md, the
// model-path inventory). Storing data with a provider in a region is not
// processing it there. So no student-facing or marketing text may say that a
// student's work, handwriting or data "stays in", "never leaves" or "is
// processed in" India or Australia (or Mumbai or Sydney), in any catalogue
// language, until the provider's terms and a technical confirmation of the
// endpoint both exist — and then by changing this guard on purpose.
//
// What it reads: every string catalogue (client/src/i18n/strings.*.js), the
// app's index.html, every text file under marketing/ and site/, the legal
// notices the app shows (docs/legal) and the store copy (docs/release/store).
// A sentence that names the claim to deny it ("do not read it as saying your
// data is stored in India") is honest and passes; a bare "not" elsewhere in
// the sentence does not excuse a claim.
//
// Section 1 plants claims and honest sentences and proves the guard tells them
// apart, so it cannot pass vacuously. Section 2 runs it over the tree.
//
// Usage: node client/test/residency-claims-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const PLACE = '(?:Indian|India|Australian|Australia|Mumbai|Sydney|New South Wales|NSW)\\b';
const PLACE_HI = '(?:भारत|इंडिया|ऑस्ट्रेलिया|मुंबई|सिडनी)';
// "servers in", "data centres in", "the" — what may sit between the verb and the place.
const WHERE = '(?:in|on|inside|within|at)\\s+(?:the\\s+)?(?:(?:servers?|data\\s+cent(?:re|er)s?|infrastructure|cloud)\\s+(?:in|inside|within)\\s+)?';
const ADVERB = '(?:only\\s+|entirely\\s+|safely\\s+|securely\\s+|locally\\s+|onshore\\s+|always\\s+|right\\s+here\\s+)?';
// Each names one shape of the claim. Case-insensitive; whitespace is any run.
const CLAIMS = [
  // "your work stays in India", "kept only within Australia", "stays on Indian servers"
  new RegExp(`\\b(?:stays?|staying|remains?|remaining|kept|keeps?|keeping)\\s+${ADVERB}${WHERE}${PLACE}`, 'i'),
  // "never leaves India", "does not leave Australia", "never leaves the country"
  new RegExp(`\\b(?:never\\s+(?:leaves?|leaving|left|goes\\s+outside(?:\\s+of)?|goes\\s+beyond)|(?:does\\s+not|doesn't|do\\s+not|don't|will\\s+not|won't|cannot|can't)\\s+leave)\\s+(?:${PLACE}|the\\s+country\\b)`, 'i'),
  // "is processed in India", "processed in Australian data centres", "read on servers in Sydney"
  new RegExp(`\\b(?:processed|processing|analy[sz]ed|read|transcribed|handled|marked)\\s+${ADVERB}${WHERE}${PLACE}`, 'i'),
  // "AI hosted in Australia", "the model is located in India"
  new RegExp(`\\b(?:AI|models?|reader|reading|servers?)\\s+(?:is\\s+|are\\s+)?(?:hosted|located|running|run|based)\\s+${WHERE}${PLACE}`, 'i'),
  // "in-country processing", "stays in-country", "onshore AI"
  /\b(?:in-country|onshore)\s+(?:processing|ai|model|models|reading|marking)\b/i,
  /\b(?:stays?|remains?|kept|processed|handled)\s+(?:in-country|onshore)\b/i,
  // "data residency in Australia", "Data residency: Australia"
  new RegExp(`\\bdata\\s+residency\\s*(?:in|inside|within|:|-|–|—)\\s*${PLACE}`, 'i'),
  // Hindi: "भारत में ही रहता/रहती/रहते", "भारत से बाहर नहीं जाता", "भारत में प्रोसेस"
  new RegExp(`${PLACE_HI}\\s+में\\s+(?:ही\\s+)?(?:रहता|रहती|रहते|रखा\\s+जाता|रखी\\s+जाती|प्रोसेस|संसाधित)`),
  new RegExp(`${PLACE_HI}\\s+से\\s+बाहर\\s+(?:कभी\\s+)?(?:नहीं|न)\\s+(?:जाता|जाती|जाते|भेजा|भेजी)`)
];
// An honest negation names the claim in order to deny it. Only these phrases
// count, and only before the claim in the same sentence: a bare "not" ("Not
// only is it fast, …", "whether or not …") does not excuse a claim.
const NEGATED = /\b(?:do\s+not\s+read\s+it\s+as|never\s+read\s+it\s+as|does\s+not\s+mean|doesn't\s+mean|nothing\s+here\s+says|we\s+do\s+not\s+(?:say|claim)|we\s+don't\s+(?:say|claim)|cannot\s+promise|can't\s+promise|no\s+promise)\b[^.!?\n]*$/i;
// The same in Hindi: "इस रूप में न पढ़ें कि …" (do not read it as), "इसका अर्थ यह नहीं कि …".
const NEGATED_HI = /(?:न\s+पढ़ें|मत\s+पढ़ें|मत\s+समझें|अर्थ\s+यह\s+नहीं)[^।!?\n]*$/;

// A hard-wrapped line is one sentence: single line breaks become spaces, and
// only a blank line (a paragraph) or sentence punctuation ends a sentence.
const unwrap = text => String(text).replace(/\r\n?/g, '\n').replace(/([^\n])\n(?!\n)\s*/g, '$1 ');

/** Every residency claim in `text`, as the sentence it sits in. */
export function residencyClaims(raw) {
  const text = unwrap(raw);
  const found = [];
  for (const pattern of CLAIMS) {
    const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const match of text.matchAll(global)) {
      const before = text.slice(Math.max(0, match.index - 200), match.index);
      const sentenceStart = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n'), before.lastIndexOf('।'));
      const lead = before.slice(sentenceStart + 1);
      // The claim must not itself be a negative one ("never leaves" is the claim).
      if (!/never|not|n't|नहीं/i.test(match[0]) && (NEGATED.test(lead) || NEGATED_HI.test(lead))) continue;
      found.push(match[0]);
    }
  }
  return found;
}

// ── 1 · The guard fails a planted claim and passes honest sentences ─────────
const PLANTED = [
  'Your handwriting stays in India.',
  'Your work never leaves Australia.',
  'Everything you write is processed in Australia.',
  'Pages are read only within India by our AI.',
  'Your data is kept entirely in Mumbai.',
  'Your working does not leave India at any point.',
  'Prithagoras uses in-country processing for every page.',
  'We guarantee data residency in Australia.',
  'आपकी लिखावट भारत में ही रहती है।',
  'आपका डेटा भारत से बाहर नहीं जाता।',
  'आपका काम भारत में प्रोसेस होता है।',
  'Not only is it fast, your handwriting stays in India.',
  'Whether or not you are online, your work stays in India.',
  'Pages are processed in Australian data centres.',
  'Your work is processed on servers in India.',
  'Everything stays on Indian servers.',
  'Your data never leaves the country.',
  'Your handwriting stays in-country.',
  'Read by AI hosted in Australia.',
  'Data residency: Australia.',
  'Your work\nstays in\nIndia, always.'
];
for (const text of PLANTED) ok(residencyClaims(text).length > 0, `the guard fails the planted claim ${JSON.stringify(text)}`);
const HONEST = [
  'OpenAI reads handwriting, photos and (if you turn it on) your working outside India.',
  'Until then, do not read it as saying your data is stored in India.',
  'Our database is planned to move to Supabase in its Mumbai region (ap-south-1).',
  'Your account data is stored there, not in India.',
  'Prithagoras is for students in New South Wales, Australia.',
  'Practise the NSW syllabus in Sydney or anywhere else.',
  'This notice does not mean your work is processed in Australia.',
  'तब तक इसे इस रूप में न पढ़ें कि आपका डेटा भारत में रखा जाता है।',
  'तब तक इसे इस रूप में न\nपढ़ें कि आपका डेटा भारत में रखा जाता है।',
  'Until then, do not read it as saying\nyour data is stored in India.',
  'Our team is based in Australia and India.'
];
for (const text of HONEST) ok(residencyClaims(text).length === 0, `the guard passes the honest sentence ${JSON.stringify(text)} (${residencyClaims(text).join(' | ')})`);

// ── 2 · The tree makes no residency claim ───────────────────────────────────
// docs/legal is imported raw into the app's legal pages (pages/Legal.jsx), and
// docs/release/store is the store listing copy: both are student-facing.
const tracked = execFileSync('git', ['-C', ROOT, 'ls-files', '--', 'client/src/i18n', 'client/index.html', 'marketing', 'site', 'docs/legal', 'docs/release/store'], { encoding: 'utf8' })
  .split('\n').filter(Boolean)
  .filter(path => /\.(?:m?js|jsx|cjs|html?|md|json|txt|svg|xml|css)$/i.test(path))
  // The counsel information pack is a briefing for the owner's lawyers, not
  // text a student or parent reads.
  .filter(path => !path.startsWith('docs/legal/counsel/'))
  .filter(path => !path.startsWith('client/src/i18n/') || /\/strings\.[a-z-]+\.js$/i.test(path) || /\.(?:html?|md|json)$/i.test(path));
ok(tracked.some(p => p === 'client/src/i18n/strings.en.js') && tracked.some(p => p === 'client/src/i18n/strings.hi.js'), 'both string catalogues are read');
ok(tracked.includes('client/index.html'), 'the app\'s index.html is read');
ok(tracked.some(p => p.startsWith('marketing/')) && tracked.some(p => p.startsWith('site/')), 'marketing/ and site/ are read');
ok(tracked.includes('docs/legal/privacy.md') && tracked.includes('docs/legal/privacy.hi.md') && tracked.some(p => p.startsWith('docs/release/store/')), 'the legal notices the app shows and the store copy are read');
let claims = 0;
for (const path of tracked) {
  const found = residencyClaims(readFileSync(join(ROOT, path), 'utf8'));
  claims += found.length;
  ok(found.length === 0, `${path} makes no residency claim (${found.join(' | ')})`);
}

console.log(`Residency claims — ${pass}/${pass + failures.length} checks (${tracked.length} files read, ${claims} claims)`);
if (failures.length) {
  console.log('\nfailures:');
  for (const line of failures) console.log(`  ${line}`);
}
console.log(`\nRESIDENCY CLAIMS (H7): ${failures.length ? 'FAIL' : 'PASS'} — the product says nothing about where model processing happens`);
process.exit(failures.length ? 1 : 0);
