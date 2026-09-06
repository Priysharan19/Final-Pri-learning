#!/usr/bin/env node
// Which placeholders in the legal templates are still unfilled, and therefore
// what stands between the repository and a store submission.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'legal');
const files = readdirSync(DIR).filter(f => f.endsWith('.md') && f !== 'README.md').sort();
const all = new Map();

for (const file of files) {
  const text = readFileSync(join(DIR, file), 'utf8');
  const found = [...new Set(text.match(/\{\{[A-Z_]+\}\}/g) || [])].sort();
  console.log(`${file.padEnd(20)} ${found.length ? found.join(' ') : 'complete'}`);
  for (const key of found) all.set(key, (all.get(key) || 0) + 1);
}

console.log('');
if (!all.size) {
  console.log('LEGAL TEMPLATES: every placeholder is filled. A lawyer must still review them before publishing.');
} else {
  console.log(`LEGAL TEMPLATES: ${all.size} placeholder${all.size === 1 ? '' : 's'} still to fill across ${files.length} documents.`);
  for (const [key, n] of [...all].sort()) console.log(`  ${key} — used in ${n} document${n === 1 ? '' : 's'}`);
  console.log('\nThe app shows a "not yet reviewed" banner on any page that still has one.');
}
