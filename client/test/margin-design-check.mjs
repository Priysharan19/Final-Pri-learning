// Pri Learning · the luxury layer (C "Examiner's Chronograph" + A's light)
// keeps its own promises.
//
// It pins: scoping to the instrument build; no surface gradients (the one
// radial-gradient is the rim light, masked to a 1px ring); glass only through
// .c-glass with opaque fallbacks; no full-screen blend layer; Reduce Motion
// clamps motion without adding fades; every colour token has a night twin and
// an OKLCH value that matches its hex; text and mark colours meet WCAG AA; the
// radius rule (8px at most, plus one named --radius-pill for primary actions
// and chips only) across every instrument stylesheet; the icon and mark rules;
// and the motion vocabulary's plane spring settling as the reference does.
//
// Usage: node client/test/margin-design-check.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulateSpring, rotFrames } from '../src/instrument/margin/motion.js';
import { lightAt } from '../src/instrument/margin/light.js';

const dir = fileURLToPath(new URL('../src/instrument/', import.meta.url));
const css = readFileSync(join(dir, 'margin/margin.css'), 'utf8');
const icons = readFileSync(join(dir, 'margin/MarginIcon.jsx'), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const bare = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail });

// Scope, materials, fallbacks.
const rules = bare(css).split('}').map(r => r.split('{')[0].trim()).filter(sel => sel && !sel.startsWith('@') && !/^--|:\s/.test(sel));
check('every rule is scoped to the instrument build', rules.every(sel => /ui-instrument/.test(sel)), rules.filter(s => !/ui-instrument/.test(s)).join(' | '));
check('the instrument loads the layer after instrument.css, behind the flag', /INSTRUMENT_ON[\s\S]{0,500}instrument\.css'\)\.then\(\(\) => import\('\.\/instrument\/margin\/margin\.css'\)\)/.test(app));
const grads = [...bare(css).matchAll(/(?<!repeating-)(linear|radial|conic)-gradient\(/g)].length;
const maskGrads = [...bare(css).matchAll(/mask[^;]*linear-gradient\(#000 0 0\)/g)].join('').match(/linear-gradient/g)?.length || 0;
check('no surface gradients: only the masked rim light', /\.c-rim::before\s*\{[^}]*radial-gradient[^}]*mask:/s.test(bare(css)) && grads === 1 + maskGrads, `gradients ${grads}, mask helpers ${maskGrads}`);
check('backdrop blur lives only in .c-glass', [...bare(css).replace(/@supports[^{]*\{/g, '').matchAll(/([^{}]+)\{[^}]*backdrop-filter:\s*blur/g)].every(m => /\.c-glass/.test(m[1])));
check('glass is opaque before color-mix support and under Reduce Transparency', /\.c-glass \{ background: var\(--c-sheet\)/.test(css) && /prefers-reduced-transparency:\s*reduce\)[\s\S]{0,200}c-glass[\s\S]{0,120}backdrop-filter:\s*none/.test(css));
check('no full-screen blend layer (it would re-blend every ink frame)', !/mix-blend-mode/.test(bare(css)) && !/body::after/.test(bare(css)));
const rm = (bare(css).match(/prefers-reduced-motion:\s*reduce\)\s*\{([\s\S]*?\}\s*)\}/) || [])[1] || '';
check('Reduce Motion clamps durations without forcing new fades', /animation-duration:\s*1ms/.test(rm) && /transition-duration:\s*1ms/.test(rm) && !/transition-property/.test(rm));
check('the rim light disappears in forced colours', /forced-colors:\s*active\)\s*\{[^}]*c-rim::before[^}]*display:\s*none/.test(css));

// Colours.
const block = sel => (css.match(new RegExp(`${sel.replace(/[[\]]/g, '\\$&')}\\s*\\{([\\s\\S]*?)\\n\\}`)) || [])[1] || '';
const day = block('html.ui-instrument'), night = block('html.ui-instrument[data-theme="dark"]');
const colourTokens = [...day.matchAll(/(--c-[a-z0-9-]+):\s*(#|rgba)/g)].map(m => m[1]);
const missing = colourTokens.filter(t => !night.includes(`${t}:`));
check('every colour token has a midnight-enamel twin', missing.length === 0, missing.join(','));

const hex = (b, t) => (b.match(new RegExp(`${t}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
const lin = c => (c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const oklab = h => {
  const [r, g, b] = [1, 3, 5].map(i => lin(parseInt(h.slice(i, i + 2), 16)));
  const [l, m, s] = [0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b, 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b, 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b].map(Math.cbrt);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
};
const supports = [...css.matchAll(/@supports \(color: oklch\(0% 0 0\)\) \{([\s\S]*?)\n\}/g)].map(m => m[1]);
let oklchBad = [];
supports.forEach((s, i) => {
  for (const [, tok, L, C, H] of s.matchAll(/(--c-[a-z0-9-]+): oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)/g)) {
    const [l, a, b] = oklab(hex(i ? night : day, tok));
    const want = [l * 100, Math.hypot(a, b), (Math.atan2(b, a) * 180 / Math.PI + 360) % 360];
    if (Math.abs(want[0] - L) > 0.15 || Math.abs(want[1] - C) > 0.002 || (want[1] > 0.01 && Math.abs(want[2] - H) > 1)) oklchBad.push(`${i ? 'night' : 'day'} ${tok}`);
  }
});
check('every OKLCH value matches its sRGB fallback', supports.length === 2 && oklchBad.length === 0, oklchBad.join(','));

const lum = h => { const c = [1, 3, 5].map(i => lin(parseInt(h.slice(i, i + 2), 16))); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
for (const [label, b] of [['cotton paper', day], ['midnight enamel', night]]) {
  for (const bg of ['--c-paper', '--c-sheet', '--c-paper-2']) {
    for (const t of ['--c-ink', '--c-ink-2', '--c-ink-3', '--c-teal', '--c-copper', '--c-pen']) {
      const r = ratio(hex(b, t), hex(b, bg));
      check(`${t} meets AA on ${bg} (${label})`, r >= 4.5, r.toFixed(2));
    }
  }
  check(`the lume meets 3:1 on the dial (${label})`, ratio(hex(b, '--c-lume'), hex(b, '--c-dial')) >= 3, ratio(hex(b, '--c-lume'), hex(b, '--c-dial')).toFixed(2));
  check(`primary text on teal meets AA (${label})`, ratio(hex(b, '--c-on-teal'), hex(b, '--c-teal')) >= 4.5, ratio(hex(b, '--c-on-teal'), hex(b, '--c-teal')).toFixed(2));
}

// Night must re-state every --in-* remap: instrument.css's night literals sit
// on html.ui-instrument[data-theme="dark"], which outranks the day block.
const instCss = readFileSync(join(dir, 'instrument.css'), 'utf8');
const instNight = (instCss.match(/html\.ui-instrument\[data-theme="dark"\]\s*\{([^}]*)\}/) || [])[1] || '';
const overridden = [...instNight.matchAll(/(--in-[a-z0-9-]+):/g)].map(m => m[1]).filter(t => !/^--in-c\d|--in-unc|--in-tx-4|--in-shadow|--in-dot/.test(t));
const unmapped = overridden.filter(t => !night.includes(`${t}:`));
check('every night token instrument.css sets is remapped in the night block', unmapped.length === 0, unmapped.join(','));

// Radius: 8px at most everywhere in the instrument interface, plus one named
// pill token that only primary actions and chips may use.
const sheets = [];
const walk = d => readdirSync(d).forEach(f => { const p = join(d, f); statSync(p).isDirectory() ? walk(p) : /\.css$/.test(f) && sheets.push(p); });
walk(dir);
const radiusBad = [], pillBad = [];
for (const p of sheets) {
  for (const m of bare(readFileSync(p, 'utf8')).matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    for (const r of m[2].matchAll(/border(?:-[a-z]+)*-radius:\s*([^;]+)/g)) {
      if ([...r[1].matchAll(/(\d+(?:\.\d+)?)px/g)].some(n => Number(n[1]) > 8)) radiusBad.push(`${p.slice(dir.length)}: ${m[1].trim()}`);
      if (/--radius-pill/.test(r[1]) && !m[1].split(',').every(s => /\.c-btn-primary|\.c-chip|\.c-pill-ok/.test(s))) pillBad.push(`${p.slice(dir.length)}: ${m[1].trim()}`);
    }
  }
}
check('no literal radius above 8px in any instrument stylesheet', radiusBad.length === 0, radiusBad.slice(0, 4).join(' | '));
check('--radius-pill is used only by primary actions and chips', pillBad.length === 0, pillBad.slice(0, 4).join(' | '));
check('the pill is one named token', /--radius-pill:\s*999px/.test(day) && (css.match(/999px/g) || []).length === 1);

// Fonts: four subset faces, no faux bold or italic of Instrument Serif.
const faces = [...css.matchAll(/@font-face\s*\{[^}]*\}/g)].map(m => m[0]);
check('exactly four self-hosted faces (budget)', faces.length === 4 && faces.every(f => /url\(\.\/fonts\//.test(f)), String(faces.length));
check('no Instrument Serif italic is requested (it is not shipped)', !/var\(--c-serif\)[^;]*italic|italic[^;]*var\(--c-serif\)/.test(bare(css)));

// Icons and marks.
const iconNames = [...icons.matchAll(/^\s{2}([a-z]+): /gm)].map(m => m[1]);
check('the icon set has sixteen icons and three marks', iconNames.length === 19 && ['ok', 'x', 'ecf'].every(n => iconNames.includes(n)), iconNames.join(','));
check('icons are drawn on the 24 grid at 1.5 stroke, round, unfilled, hidden from AT', /viewBox="0 0 24 24"/.test(icons) && /strokeWidth="1\.5"/.test(icons) && /strokeLinecap="round"/.test(icons) && /fill="none"/.test(icons) && /aria-hidden="true"/.test(icons));
check('copper appears only on marking icons', [...icons.matchAll(/^\s{2}([a-z]+): .*className="cop"/gm)].every(m => ['error', 'carried', 'offline'].includes(m[1])));
check('marks differ by shape: circle, diamond, dashed capsule', /ok: <><circle/.test(icons) && /x: <><rect[^>]*rotate\(45/.test(icons) && /ecf: <><rect[^>]*strokeDasharray/.test(icons));
check('marks are images named by their caller', /role="img" aria-label=\{label\}/.test(icons));

// One brand mark.
const pmark = readFileSync(join(dir, 'margin/PMark.jsx'), 'utf8');
check('the brand mark is one Instrument Serif P′ in an engraved bezel', /Instrument Serif/.test(pmark) && /P<tspan[^>]*>′/.test(pmark) && /reduced\(\)/.test(pmark));

// Motion.
const s = simulateSpring({ from: -1400, to: 0 }, 1.2);
check('the plane spring (k170 c22) settles within 1.2 s, as in the reference', Math.abs(s.x) < 1400 * 0.0015 && Math.abs(s.v) < 1400 * 0.01, `${s.x.toFixed(2)} ${s.v.toFixed(2)}`);
const zeta = 22 / (2 * Math.sqrt(170));
check('the plane spring is underdamped but never bouncy (ζ ≈ 0.84)', zeta > 0.8 && zeta < 0.9, zeta.toFixed(3));
const f = rotFrames(-540, 0, 4);
check('a hand sweep overshoots then returns exactly to its reading', f.length === 4 && f[1].transform === 'rotate(4deg)' && f[3].transform === 'rotate(0deg)');
const c = lightAt(0, 0);
check('the key light rests where the reference puts it (30%, −10%)', c.lx === 30 && c.ly === -10);

const failed = checks.filter(x => !x.ok);
for (const x of checks) console.log(`${x.ok ? 'ok  ' : 'FAIL'} ${x.name}${x.ok || !x.detail ? '' : ` — ${x.detail}`}`);
console.log(`\n${checks.length - failed.length}/${checks.length} luxury-layer checks passed`);
process.exit(failed.length ? 1 : 0);
