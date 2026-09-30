import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const theme = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8');
const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');

const checks = [];
const check = (name, ok, detail = '') => checks.push({ name, ok: !!ok, detail });

const requiredTokens = [
  '--font-display', '--font-math', '--space-1', '--space-4', '--space-8',
  '--page', '--surface', '--surface-2', '--surface-3', '--surface-raised',
  '--ink', '--ink-2', '--ink-3',
  '--brand-1', '--brand-2', '--brand-grad', '--brand-soft', '--brand-ring',
  '--good', '--bad', '--warn', '--info', '--focus', '--disabled',
  '--radius-sm', '--radius', '--radius-lg', '--shadow-sm', '--shadow',
  '--motion-fast', '--motion-base', '--ease-standard'
];

for (const token of requiredTokens) {
  check(`canonical token ${token} exists`, theme.includes(token + ':'), token);
}

check('UI typography is Inter-based', /--font:\s*['"]Inter Variable['"]/.test(theme));
check('math typography is independently defined', /--font-math:\s*['"]KaTeX_Main['"]/.test(theme));
check('light mode has semantic overrides', theme.includes('[data-theme="light"]') && /--brand-1:\s*#315fdd/i.test(theme));
check('dark mode has Pri midnight surface', /--page:\s*#090f1d/i.test(theme));
check('brand gradient is present', /--brand-grad:\s*linear-gradient/i.test(theme));

const selectors = [
  '.topbar', '.sidebar', '.nav-item.active', '.card', '.btn-primary', '.input',
  '.auth-wrap', '.home-greet', '.genbar-head', '.q-prompt', '.editor-shell',
  '.eval-card', '.verdict-good', '.pri-explain-dialog', '.mobilenav'
];
for (const selector of selectors) check(`core primitive ${selector} is adopted`, theme.includes(selector), selector);

check('keyboard focus is visible', /:focus-visible\s*\{[^}]*outline:\s*3px\s+solid\s+var\(--focus\)/s.test(theme));
check('reduced motion is globally respected', /prefers-reduced-motion:\s*reduce[\s\S]*animation-duration:\s*0\.001ms\s*!important/s.test(theme));
check('tablet has a persistent touch navigation contract',
  /pointer:\s*coarse[\s\S]*min-width:\s*761px[\s\S]*max-width:\s*1180px[\s\S]*\.sidebar\s*\{\s*width:\s*178px/s.test(theme));
check('tablet touch controls reach at least 44px',
  /pointer:\s*coarse[\s\S]*\.mode-tab[\s\S]*min-height:\s*44px/s.test(theme));
check('phone layout has an explicit breakpoint', /@media\s*\(max-width:\s*760px\)/.test(theme));
check('question width remains bounded', /\.qpage\s*\{\s*max-width:\s*980px/s.test(theme));
check('Pri Explain uses the same surface system', /\.pri-explain-dialog[\s\S]*background:\s*var\(--surface\)/s.test(theme));

const forbidden = [
  'The exact visual language of the reference platform',
  "drawn to match the reference's icon rail"
];
for (const phrase of forbidden) {
  check(`reference-derived instruction removed: ${phrase}`, !theme.includes(phrase) && !app.includes(phrase));
}

const pass = checks.filter(c => c.ok).length;
for (const row of checks) {
  console.log(`  ${row.ok ? '✔' : '✖'} ${row.name}${row.ok || !row.detail ? '' : ` — ${row.detail}`}`);
}
if (pass !== checks.length) {
  console.error(`\n✖ KALP-01 DESIGN SYSTEM CHECK FAILED — ${pass}/${checks.length} checks`);
  process.exit(1);
}
console.log(`\n✔ KALP-01 DESIGN SYSTEM CHECK PASSED — ${pass}/${checks.length} checks`);
console.log(`  source root: ${ROOT}`);
