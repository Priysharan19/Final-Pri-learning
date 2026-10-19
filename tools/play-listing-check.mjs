#!/usr/bin/env node
// Truth and policy check for the Google Play listing draft.
//
//   node tools/play-listing-check.mjs
//
// Parses docs/release/store/play-listing.md §1, checks Play's length limits,
// metadata policy and Pri's truthfulness rules, cross-checks prices against the
// approved prices in docs/release/PRI_V1_RELEASE_SCOPE.md, and checks the
// generated graphics (tools/play-graphics.mjs). Exits 1 on any failure.
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const listing = readFileSync(join(root, 'docs/release/store/play-listing.md'), 'utf8');
const scope = readFileSync(join(root, 'docs/release/PRI_V1_RELEASE_SCOPE.md'), 'utf8');

const results = [];
const check = (name, ok, detail = '') => results.push({ name, ok: Boolean(ok), detail });

// --- parse §1 -----------------------------------------------------------------
const s1 = listing.split(/^## 1\. /m)[1]?.split(/^## 2\. /m)[0] ?? '';
const field = (label) => s1.match(new RegExp(`\\|\\s*${label}\\s*\\|\\s*\\d+\\s*\\|\\s*\`([^\`]+)\``))?.[1];
const name = field('App name');
const short = field('Short description');
const fullLines = s1.split('\n').filter((l) => l.startsWith('>')).map((l) => l.replace(/^>\s?/, ''));
// Rejoin wrapped markdown lines into paragraphs, as the text would be pasted into Play.
const full = fullLines.join('\n').replace(/([^\n])\n(?=[^\n])/g, (m, a, offset, str) => {
  const next = str.slice(offset + 2).split('\n')[0];
  const prev = str.slice(0, offset + 1).split('\n').pop();
  return isLabel(prev) || isLabel(next) || /^•/.test(next) ? `${a}\n` : `${a} `;
}).trim();
function isLabel(l) { return /^[A-Z][A-Z ]+$/.test(l.trim()); }

check('§1 parsed (name, short, full description)', name && short && full.length > 0);
const len = (s) => [...(s ?? '')].length;
check('app name ≤ 30 characters', len(name) <= 30, `${len(name)}`);
check('short description ≤ 80 characters', len(short) <= 80, `${len(short)}`);
check('full description ≤ 4000 characters', len(full) <= 4000, `${len(full)}`);

// --- metadata policy ----------------------------------------------------------
const banned = /\b(best|top|free|number one)\b|#1/i;
check('no banned words in title (best, #1, top, free, number one)', !banned.test(name), name);
check('no ranking/price-promotion words in short description', !banned.test(short), short);
const emoji = /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}]/u;
check('no emoji in name, short or full description', ![name, short, full].some((t) => emoji.test(t)));
const labels = new Set(['WRITE THE WAY YOU WOULD ON PAPER', 'HOW YOUR ANSWER IS MARKED', 'WHAT YOU CAN DO',
  'FREE AND PREMIUM', 'WHAT PRI NEEDS', 'PRIVACY']);
const capsLines = full.split('\n').map((l) => l.trim()).filter((l) => /[A-Z]{2}/.test(l) && l === l.toUpperCase() && /[A-Z]/.test(l));
const strayCaps = capsLines.filter((l) => !labels.has(l));
check('no ALL-CAPS lines other than the section labels', strayCaps.length === 0, strayCaps.join(' | '));

// --- truthfulness -------------------------------------------------------------
const text = [name, short, full].join('\n');
const claims = [/\baccura(te|cy)\b/i, /\bcomplete syllabus\b/i, /\bsyllabus[- ]complete\b/i, /\bproduction[- ]ready\b/i,
  /\bguarantee/i, /\bofficial\b/i, /\bbest\b/i, /\b#1\b/];
const claimHits = claims.map((re) => text.match(re)?.[0]).filter(Boolean);
check('no accuracy / complete-syllabus / production-ready / superiority claims', claimHits.length === 0, claimHits.join(', '));
// "endorsed" is allowed only inside an explicit disclaimer ("not endorsed by").
const endorse = [...text.matchAll(/(\bnot\s+)?\bendorsed\b/gi)].filter((m) => !m[1]);
check('"endorsed" appears only as a disclaimer ("not endorsed by")', endorse.length === 0);

// --- prices -------------------------------------------------------------------
const approved = scope.match(/approved prices of (₹[\d,]+) \/ month and (₹[\d,]+) \/ year/);
check('approved prices found in PRI_V1_RELEASE_SCOPE.md', approved, approved ? `${approved[1]}, ${approved[2]}` : '');
const stated = [...new Set(full.match(/₹[\d,]+/g) ?? [])];
const want = approved ? [approved[1], approved[2]] : ['₹199', '₹1,499'];
check('prices in the description match the approved prices exactly', stated.length === 2 && want.every((p) => stated.includes(p)), stated.join(', '));
check('monthly/annual wording matches (₹199 a month, ₹1,499 a year)',
  new RegExp(`${want[0]} a month or ${want[1]}\\s+a year`).test(full));
const facts = listing.match(/Intended prices \| ([^|]+)\|/)?.[1] ?? '';
check('listing fact table states the same prices', want.every((p) => facts.includes(p)), facts.trim());

// --- graphics -----------------------------------------------------------------
function png(path) {
  const b = readFileSync(path);
  if (b.readUInt32BE(0) !== 0x89504e47) return null;
  let off = 8, trns = false;
  while (off < b.length) { const l = b.readUInt32BE(off); if (b.toString('ascii', off + 4, off + 8) === 'tRNS') trns = true; off += 12 + l; }
  const ct = b[25];
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), depth: b[24], ct, alpha: ct === 4 || ct === 6 || trns };
}
const iconPath = join(root, 'docs/release/store/play/icon-512.png');
const featPath = join(root, 'docs/release/store/play/feature-graphic-1024x500.png');
const icon = existsSync(iconPath) && png(iconPath);
const feat = existsSync(featPath) && png(featPath);
check('icon-512.png exists and is 512×512 PNG', icon && icon.w === 512 && icon.h === 512, icon ? `${icon.w}x${icon.h}` : 'missing');
check('feature graphic exists and is 1024×500 PNG', feat && feat.w === 1024 && feat.h === 500, feat ? `${feat.w}x${feat.h}` : 'missing');
check('feature graphic is 24-bit RGB with no alpha channel', feat && feat.ct === 2 && feat.depth === 8 && !feat.alpha,
  feat ? `colourType=${feat.ct} depth=${feat.depth}` : 'missing');
const s6 = listing.split(/^## 6\. /m)[1] ?? '';
check('§6 points at the generated graphics', s6.includes('store/play/icon-512.png') && s6.includes('store/play/feature-graphic-1024x500.png'));

// --- report -------------------------------------------------------------------
for (const r of results) console.log(`${r.ok ? 'ok  ' : 'FAIL'}  ${r.name}${r.detail ? ` — ${r.detail}` : ''}`);
const passed = results.filter((r) => r.ok).length;
const verdict = passed === results.length ? 'PASS' : 'FAIL';
console.log(`PLAY LISTING: ${verdict} — ${passed}/${results.length} checks`);
process.exit(verdict === 'PASS' ? 0 : 1);
