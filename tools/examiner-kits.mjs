#!/usr/bin/env node
// Pri Learning · examiner kit zips
//
// One zip per jurisdiction, built from the committed packet, dossier and review page:
//   · the packet (README, decision form, independence statement, items.json, worked cases)
//   · the dossier the packet is pinned to
//   · the offline review page (docs/marking/review/<jurisdiction>.html)
//   · a KIT.txt listing every file with its SHA-256 and the dossier digest
//
// The AI pre-review (docs/marking/prereview/) is deliberately NOT in a kit: an examiner
// must form their own view, so nothing from it may anchor them. The kit signs, approves
// and certifies nothing; only a real, independent, qualified examiner can.
//
//   node tools/examiner-kits.mjs [outDir]   # default artifacts/examiner-kits
//   node tools/examiner-kits.mjs --list      # print what each kit holds, write nothing
import { readFileSync, mkdirSync, rmSync, existsSync, writeFileSync, copyFileSync, utimesSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const KITS = [
  { id: 'nsw-hsc', packet: 'hsc', name: 'Prithagoras-NSW-HSC-examiner-kit' },
  { id: 'cbse', packet: 'cbse', name: 'Priyabhata-CBSE-examiner-kit' }
];
const sha = b => createHash('sha256').update(b).digest('hex');

export function kitFiles(kit) {
  const p = JSON.parse(readFileSync(join(ROOT, 'docs/marking/packets', kit.packet, 'items.json'), 'utf8'));
  const dir = `docs/marking/packets/${kit.packet}`;
  return [
    ...['README.md', 'decision-form.md', 'independence-statement.md', 'items.json', 'worked-cases.md'].map(f => `${dir}/${f}`),
    p.dossier,
    `docs/marking/review/${kit.id}.html`,
    'docs/marking/certifications/schema.json'
  ];
}

const args = process.argv.slice(2);
if (import.meta.url === `file://${process.argv[1]}`) {
  const list = args.includes('--list');
  const out = resolve(ROOT, args.find(a => !a.startsWith('--')) || 'artifacts/examiner-kits');
  for (const kit of KITS) {
    const files = kitFiles(kit);
    for (const f of files) if (/prereview/.test(f)) throw new Error(`the AI pre-review must not be in a kit: ${f}`);
    const missing = files.filter(f => !existsSync(join(ROOT, f)));
    if (missing.length) { console.error(`EXAMINER KIT ${kit.id}: FAIL — missing ${missing.join(', ')}`); process.exit(1); }
    if (list) { console.log(`${kit.name}\n  ${files.join('\n  ')}`); continue; }
    const stage = join(out, kit.name);
    rmSync(stage, { recursive: true, force: true });
    const stamp = new Date('2026-01-01T00:00:00Z');   // fixed, so the zip bytes depend only on the content
    const lines = [];
    for (const f of files) {
      const dest = join(stage, f);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(join(ROOT, f), dest);
      utimesSync(dest, stamp, stamp);
      lines.push(`${sha(readFileSync(join(ROOT, f)))}  ${f}`);
    }
    const p = JSON.parse(readFileSync(join(ROOT, 'docs/marking/packets', kit.packet, 'items.json'), 'utf8'));
    writeFileSync(join(stage, 'KIT.txt'), `${kit.name}\nStatus: not yet reviewed by a human examiner. This kit signs, approves and certifies nothing.\nDossier digest: ${p.dossierDigest}\nItems: ${p.items.length}\n\n${lines.join('\n')}\n`);
    utimesSync(join(stage, 'KIT.txt'), stamp, stamp);
    const zip = join(out, `${kit.name}.zip`);
    rmSync(zip, { force: true });
    const all = [];
    (function walk(d, rel) { for (const e of readdirSync(d, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) { const r = rel ? `${rel}/${e.name}` : e.name; e.isDirectory() ? walk(join(d, e.name), r) : all.push(r); } })(stage, '');
    execFileSync('zip', ['-X', '-q', zip, ...all], { cwd: stage });
    rmSync(stage, { recursive: true, force: true });
    console.log(`EXAMINER KIT ${kit.id}: ${zip} (${all.length} files, ${p.items.length} items) sha256 ${sha(readFileSync(zip)).slice(0, 16)}`);
  }
}
