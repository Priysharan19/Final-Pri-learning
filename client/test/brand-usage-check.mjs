// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · where the brand's two colours may appear (plan E4)
//
// docs/brand/editions-decision.md: red belongs to the prime; the edition
// accent belongs to the icon cut (and, later, the email header rule and
// marketing links). Never to marks or verdicts, charts, focus rings or fills.
// This suite fails when either token is used anywhere else in the client,
// so a verdict can never borrow the brand's colour.
//
//   --edition-accent / --edition-on-accent  defined only by client/brand/edition-brand.mjs
//                                          (the build writes them into index.html),
//                                          used only by client/src/components/BrandMark.jsx
//   --brand-prime                           defined only in client/src/theme.css,
//                                          used only by BrandMark.jsx's prime paths
//
// Usage: node client/test/brand-usage-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

function grep(pattern) {
  try {
    return execFileSync('git', ['-C', ROOT, 'grep', '--untracked', '-n', '-e', pattern, '--', 'client', ':!client/test', ':!client/node_modules', ':!client/dist', ':!*.md'], { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean);
  } catch (e) {
    if (e.status === 1) return [];
    throw e;
  }
}
// A line that only mentions the token in a comment is not a use.
const code = line => !/^[^:]+:\d+:\s*(\/\/|\*|\/\*)/.test(line);
const fileOf = line => line.slice(0, line.indexOf(':'));

const ACCENT_FILES = new Set(['client/brand/edition-brand.mjs', 'client/src/components/BrandMark.jsx']);
for (const token of ['--edition-accent', '--edition-on-accent']) {
  const uses = grep(token).filter(code);
  const stray = uses.filter(l => !ACCENT_FILES.has(fileOf(l)));
  ok(stray.length === 0, `${token} is used only by the brand mark and the build's token block: ${stray.join(' | ')}`);
}
{
  const uses = grep('--edition-accent').filter(code).filter(l => fileOf(l) === 'client/src/components/BrandMark.jsx');
  ok(uses.length === 1 && /CUT_PATH\b/.test(uses[0]), 'in BrandMark.jsx, the accent fills the counter cut and nothing else');
}
{
  const uses = grep('--brand-prime').filter(code);
  const allowed = l => (fileOf(l) === 'client/src/theme.css' && /--brand-prime:\s*#[0-9a-f]{6};/.test(l))
    || (fileOf(l) === 'client/src/components/BrandMark.jsx' && /(PRIME_PATH|prime)\b.*fill="var\(--brand-prime\)"/.test(l));
  const stray = uses.filter(l => !allowed(l));
  ok(stray.length === 0, `--brand-prime is defined in theme.css and used only for the prime: ${stray.join(' | ')}`);
}

// The mark draws ink, cut, prime — in that order, so the prime is never covered.
{
  const src = readFileSync(join(ROOT, 'client/src/components/BrandMark.jsx'), 'utf8');
  const mark = src.slice(src.indexOf('export function BrandMark'), src.indexOf('export function BrandWordmark'));
  const order = ['P_PATH', 'CUT_PATH}', 'PRIME_PATH'].map(s => mark.indexOf(s));
  ok(order.every(i => i > 0) && order[0] < order[1] && order[1] < order[2], 'BrandMark draws the P, then the cut, then the prime');
  ok(!/gradient|filter=|drop-shadow|glow/i.test(src), 'no gradient, filter or glow in the brand component');
}

if (failures.length) {
  console.error(`\nbrand-usage-check: ${failures.length} FAILED, ${pass} passed`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(`brand-usage-check: ${pass} passed`);
