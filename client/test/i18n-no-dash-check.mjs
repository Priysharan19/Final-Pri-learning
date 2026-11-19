// ───────────────────────────────────────────────────────────
// Pri Learning · no em dash in interface copy
//
// The owner's rule: copy carries no em dash (—) and no en dash used as a
// sentence dash. Write a colon, a comma, a full stop and a new sentence, or
// brackets, whichever reads naturally. An en dash is allowed only inside a
// numeric range ("7–12", "2026–27"), which is checked here as a digit on both
// sides, or a letter-and-bracket range such as "(a)–({last})".
//
// Every interface string in the English, Hindi and Prithagoras (en-AU)
// catalogues is checked, including each plural form. The allowlist starts
// empty; a string may be added to it only with a reason a reviewer accepts.
//
// Usage: node client/test/i18n-no-dash-check.mjs
// ───────────────────────────────────────────────────────────
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'vite';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';
import { AU_STRINGS } from '../src/i18n/strings.au.js';

// 'catalogue:key' -> reason. Empty on purpose.
const ALLOWLIST = new Map([]);

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

const EM = '—';
const EN = '–';
// an en dash between two numbers (a letter may prefix the second, as in "D1–D4"), or between a closing letter/bracket and an
// opening bracket as in "(a)–(c)", is a range, not a sentence dash.

function* strings(value, path) {
  if (typeof value === 'string') yield [path, value];
  else if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) yield* strings(v, `${path}.${k}`);
}

const catalogues = { en, hi, au: AU_STRINGS };
let total = 0;
for (const [name, table] of Object.entries(catalogues)) {
  for (const [key, value] of Object.entries(table)) {
    for (const [path, text] of strings(value, key)) {
      total++;
      if (ALLOWLIST.has(`${name}:${key}`)) continue;
      ok(!text.includes(EM), `${name}:${path} contains an em dash: ${text.slice(0, 90)}`);
      const stripped = text.split(EN).length > 1 ? text.replace(/(?<=[0-9}\)])–(?=[A-Za-z]?[0-9{\(])/g, '') : text;
      ok(!stripped.includes(EN), `${name}:${path} uses an en dash outside a numeric range: ${text.slice(0, 90)}`);
    }
  }
}
ok(total > 4000, `the check reached the catalogues (${total} strings)`);
ok(ALLOWLIST.size === 0 || [...ALLOWLIST.values()].every(r => typeof r === 'string' && r.length > 20), 'every allowlist entry carries a reason');

// ── Messages the server sends a person (server/platform/*.js) ─────────────────────────────────────────────────────────
// A string literal or template fragment in the platform that carries an em dash is copy a student, parent or teacher can
// read, so it follows the same rule. Comments are not scanned. Each entry says why a dash stays; the match is by file and
// by a fragment of the text, never by file alone unless the whole file is a prompt that is never shown.
const SERVER_ALLOW = [
  ['authDelivery.js', 'account is confirmed — keep this email', 'an email subject that tools/deployment-contract.test.mjs and tools/staging-journey-mail.mjs classify by its exact text (linkKindOfSubject); the matcher and the subject change together in a mail-copy change'],
  ['resourceCatalog.js', '100-Mark Practice Examination', 'the title of a third-party paper, the identity that server/test/resources-check.mjs and the desk import fixture match on'],
  ['experiments.js', 'changed after it was frozen', 'a developer message from the experiment registry lock check, never shown to a learner'],
  ['pdfLite.js', '—', 'the empty-cell glyph in a generated PDF table, not a sentence'],
  ['questionPhotoProvider.js', '', 'instructions to the reading model and its catalogue listing, never shown to a person'],
  ['tutorProvider.js', '', 'instructions to the tutor model, never shown to a person'],
  ['workingProvider.js', '', 'instructions to the working-check model, never shown to a person']
];
const platformDir = fileURLToPath(new URL('../../server/platform/', import.meta.url));
const walk = (n, f) => { if (!n || typeof n !== 'object') return; if (Array.isArray(n)) { n.forEach(x => walk(x, f)); return; } if (n.type) f(n); for (const k in n) if (k !== 'parent') walk(n[k], f); };
let serverScanned = 0;
for (const name of readdirSync(platformDir).filter(f => f.endsWith('.js'))) {
  const src = readFileSync(platformDir + name, 'utf8');
  if (!src.includes(EM)) { serverScanned++; continue; }
  const ast = parseAst(src, { lang: 'js' });
  walk(ast, n => {
    if ((n.type !== 'Literal' && n.type !== 'TemplateElement') || n.regex) return;
    const text = src.slice(n.start, n.end);
    if (!text.includes(EM)) return;
    const allowed = SERVER_ALLOW.some(([file, needle]) => file === name && text.includes(needle));
    ok(allowed, `server/platform/${name}:${src.slice(0, n.start).split('\n').length} sends text with an em dash: ${text.replace(/\s+/g, ' ').slice(0, 90)}`);
  });
  serverScanned++;
}
ok(serverScanned > 40, `the server scan reached the platform files (${serverScanned})`);
ok(SERVER_ALLOW.every(([, , why]) => why.length > 25), 'every server allowlist entry carries a reason');

if (failures.length) {
  console.error(`I18N NO DASH: FAIL — ${failures.length} problem(s)\n${failures.slice(0, 40).map(f => '  ' + f).join('\n')}`);
  process.exit(1);
}
console.log(`I18N NO DASH: PASS — ${pass}/${pass} checks — ${total} interface strings across English, Hindi and Prithagoras carry no em dash and no sentence en dash; the catalogue allowlist is ${ALLOWLIST.size === 0 ? 'empty' : ALLOWLIST.size + ' long'}; ${serverScanned} server platform files send no em dash outside ${SERVER_ALLOW.length} reasoned entries.`);
