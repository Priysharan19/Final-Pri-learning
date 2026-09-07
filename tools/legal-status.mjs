#!/usr/bin/env node
// Which placeholders in the legal templates are still unfilled, and therefore
// what stands between the repository and a store submission.
//
// Every notice exists twice — `privacy.md` and `privacy.hi.md` — because the
// DPDP Act's section 5(3) gives a data principal the right to read it in
// English or in a language of the Eighth Schedule. Both languages are listed
// here, and a placeholder is counted once per document it appears in, in
// either of them: `{{OWNER_LEGAL_NAME}}` has to be filled in eight places, not
// four, and a status tool that quietly reported four would let half the
// published text ship as a template.
//
// The two languages must carry the SAME placeholders. One fill serves both
// only if they do, so a document whose Hindi has drifted from its English is
// reported by name and the tool exits non-zero — that is a mistake to fix
// before filling anything, not after.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'legal');
const files = readdirSync(DIR).filter(f => f.endsWith('.md') && f !== 'README.md').sort();

/** `privacy.hi.md` → { slug: 'privacy', lang: 'hi' }; `privacy.md` → 'en'. */
const identify = (file) => {
  const parts = file.replace(/\.md$/, '').split('.');
  return { slug: parts[0], lang: parts[1] || 'en' };
};

const documents = new Map();                       // slug → lang → placeholders
const all = new Map();                             // placeholder → documents using it

for (const file of files) {
  const { slug, lang } = identify(file);
  const text = readFileSync(join(DIR, file), 'utf8');
  const found = [...new Set(text.match(/\{\{[A-Z_]+\}\}/g) || [])].sort();
  if (!documents.has(slug)) documents.set(slug, new Map());
  documents.get(slug).set(lang, found);
  console.log(`${file.padEnd(24)} ${found.length ? found.join(' ') : 'complete'}`);
  for (const key of found) all.set(key, (all.get(key) || 0) + 1);
}

// A notice with no translation, or a translation carrying a different set, is
// reported before the counts: the counts are only meaningful once it is one
// document in two languages rather than two documents.
const drift = [];
for (const [slug, byLang] of [...documents].sort()) {
  const english = byLang.get('en');
  if (!english) { drift.push(`${slug}: there is a translation but no English original`); continue; }
  for (const lang of ['hi']) {
    const other = byLang.get(lang);
    if (!other) { drift.push(`${slug}: no ${lang} translation — ${slug}.${lang}.md is missing`); continue; }
    const missing = english.filter(k => !other.includes(k));
    const extra = other.filter(k => !english.includes(k));
    if (missing.length) drift.push(`${slug}.${lang}.md is missing ${missing.join(' ')}`);
    if (extra.length) drift.push(`${slug}.${lang}.md has ${extra.join(' ')}, which the English does not`);
  }
}

console.log('');
if (drift.length) {
  console.log('LEGAL TEMPLATES: the languages disagree about what has to be filled.');
  for (const line of drift) console.log(`  · ${line}`);
  console.log('\nFix that first: one fill is meant to serve both languages.');
  process.exit(1);
}

const languages = new Set([...documents.values()].flatMap(byLang => [...byLang.keys()]));
const scope = `${documents.size} notices in ${languages.size} languages (${files.length} documents)`;

if (!all.size) {
  console.log(`LEGAL TEMPLATES: every placeholder is filled across ${scope}. A lawyer must still review them — in both languages — before publishing.`);
} else {
  console.log(`LEGAL TEMPLATES: ${all.size} placeholder${all.size === 1 ? '' : 's'} still to fill across ${scope}.`);
  for (const [key, n] of [...all].sort()) console.log(`  ${key} — used in ${n} document${n === 1 ? '' : 's'}`);
  console.log('\nThe app shows a "not yet reviewed" banner on any page that still has one, in whichever language it is being read in.');
}
