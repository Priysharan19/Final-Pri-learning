// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · where the brand's two colours may appear (plan E4)
//
// docs/brand/editions-decision.md: red belongs to the prime; the edition
// accent belongs to the icon cut (and, later, the email header rule and
// marketing links). Never to marks or verdicts, charts, focus rings or fills.
// The amendment of 14 November 2026 (Lit Instrument D1, D3, D6;
// docs/design/lit-instrument-decision.md) lets the Aurora chrome use it for the
// current place, the one light pool and the working indicator, and nothing
// else. This suite fails when either token is used anywhere else in the
// client, so a verdict can never borrow the brand's colour.
//
//   --edition-accent / --edition-on-accent  defined only by client/brand/edition-brand.mjs
//                                          (the build writes them into index.html),
//                                          used only by client/src/components/BrandMark.jsx
//                                          and client/src/instrument/aurora.css (the
//                                          --au-light, --au-light-soft and --au-pool
//                                          tokens, in the selectors AURORA_PLACES lists)
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

const AURORA = 'client/src/instrument/aurora.css';
const ACCENT_FILES = new Set(['client/brand/edition-brand.mjs', 'client/src/components/BrandMark.jsx', AURORA]);
for (const token of ['--edition-accent', '--edition-on-accent']) {
  const uses = grep(token).filter(code);
  const stray = uses.filter(l => !ACCENT_FILES.has(fileOf(l)) || (token === '--edition-on-accent' && fileOf(l) === AURORA));
  ok(stray.length === 0, `${token} is used only by the brand mark, the build's token block and (accent only) the Aurora chrome: ${stray.join(' | ')}`);
}
// The accent's light derived tokens are the only way the skin reaches it, and
// no other client file reads them.
for (const token of ['--au-light', '--au-pool']) {
  const stray = grep(token).filter(code).filter(l => fileOf(l) !== AURORA);
  ok(stray.length === 0, `${token} is read only in aurora.css: ${stray.join(' | ')}`);
}

// ── aurora.css: the current place, the pool and the working indicator ───────
// Lit Instrument D1/D3/D6. Every rule that reaches the accent (directly or
// through --au-light, --au-light-soft or --au-pool) is one of these places,
// never a focus rule, and never paints a fill: a background is a color-mix of
// 16% or less, the pool's radial wash, or a 2 px rule (the current-place line).
const AURORA_PLACES = [
  '.in-tab[aria-current="page"]',
  '.mnav-item.active',
  '.in-more-item.is-here',
  '.in-index .in-resume',
  '.in-index .in-ch[aria-pressed="true"]',
  '.in-pal-item[aria-selected="true"]',
  '.a-aurora i',
  '.pri-working'
];
{
  const css = readFileSync(join(ROOT, AURORA), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  const walk = text => {
    let depth = 0, start = 0, head = '';
    for (let j = 0; j < text.length; j++) {
      if (text[j] === '{') { if (depth === 0) { head = text.slice(start, j).trim(); start = j + 1; } depth++; }
      else if (text[j] === '}') { depth--; if (depth === 0) { const body = text.slice(start, j); if (/^@(media|supports)/.test(head)) walk(body); else if (!/^@keyframes/.test(head)) rules.push({ selector: head, body }); start = j + 1; } }
    }
  };
  walk(css);
  const LIGHT = /var\(--(edition-accent|au-light|au-light-soft|au-pool)\)/;
  const TOKEN_BLOCKS = new Set(['html.ui-instrument.skin-aurora', 'html.ui-instrument.skin-aurora[data-theme="dark"]']);
  const declares = body => body.replace(/--[a-z0-9-]+\s*:[^;]*;?/g, '');
  const lit = rules.filter(r => LIGHT.test(r.body));
  ok(lit.length >= AURORA_PLACES.length, `aurora.css reaches the edition light in its places (${lit.length} rules)`);
  for (const r of lit) {
    if (TOKEN_BLOCKS.has(r.selector)) {
      ok(!LIGHT.test(declares(r.body)), `${r.selector} only declares the light tokens`);
      continue;
    }
    const sels = r.selector.split(/,(?![^(]*\))/).map(x => x.trim().replace(/^html\.ui-instrument\.skin-aurora\s+/, ''));
    const placed = sels.every(sel => AURORA_PLACES.some(p => sel === p || sel.startsWith(`${p} `) || sel.startsWith(`${p}::`) || sel.startsWith(`:is(${p}`)));
    ok(placed, `the edition light appears only in the current place, the pool and the working indicator: ${r.selector}`);
    ok(!/:focus/.test(r.selector) && !/outline/.test(r.body), `no focus ring is the edition light (D2): ${r.selector}`);
    for (const decl of r.body.split(';').map(d => d.trim()).filter(d => /^background(-color|-image)?\s*:/.test(d) && LIGHT.test(d))) {
      const mix = decl.match(/color-mix\(in srgb, var\(--edition-accent\) (\d+)%, transparent\)/);
      const fine = (mix && Number(mix[1]) <= 16)
        || /var\(--au-light-soft\)/.test(decl)
        || /radial-gradient\(closest-side, var\(--au-pool\), transparent\)/.test(decl)
        || (/^background:\s*var\(--au-light\)$/.test(decl) && /(^|;)\s*(height|width):\s*2px/.test(r.body));
      ok(fine, `a background in the edition light is a wash of 16% or less, the pool, or a 2 px rule — never a fill: ${r.selector} { ${decl} }`);
    }
  }
  for (const [name, max] of [['au-light-soft', 16], ['au-pool', 10]]) {
    const pcts = [...css.matchAll(new RegExp(`--${name}:\\s*color-mix\\(in srgb, var\\(--edition-accent\\) (\\d+)%, transparent\\)`, 'g'))].map(m => Number(m[1]));
    ok(pcts.length === 2 && pcts.every(p => p <= max), `--${name} is a wash of at most ${max}% in light and dark (${pcts.join(', ')})`);
  }
  ok(/--au-light:\s*var\(--edition-accent\)/.test(css) && !/--edition-on-accent/.test(css), 'the skin reads the accent itself, never the on-accent (nothing is filled with it)');
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
