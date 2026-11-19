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

if (failures.length) {
  console.error(`I18N NO DASH: FAIL — ${failures.length} problem(s)\n${failures.slice(0, 40).map(f => '  ' + f).join('\n')}`);
  process.exit(1);
}
console.log(`I18N NO DASH: PASS — ${pass}/${pass} checks — ${total} interface strings across English, Hindi and Prithagoras carry no em dash and no sentence en dash; the allowlist is ${ALLOWLIST.size === 0 ? 'empty' : ALLOWLIST.size + ' long'}.`);
