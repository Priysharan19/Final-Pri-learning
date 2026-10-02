import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
// Route-only styles load with their routes (src/workspace.css, src/ink/InkAnswer.css);
// the system is these files read together, in load order.
const theme = readFileSync(new URL('../src/theme.css', import.meta.url), 'utf8')
  + '\n' + readFileSync(new URL('../src/workspace.css', import.meta.url), 'utf8')
  + '\n' + readFileSync(new URL('../src/ink/InkAnswer.css', import.meta.url), 'utf8');
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
check('question prose is set in the maths face', /\.q-prompt\s*\{[^}]*font-family:\s*var\(--font-prose-math\)/s.test(theme));
check('paper is the default identity', /:root\s*\{[^}]*color-scheme:\s*light[^}]*--page:\s*#f2f0ea/si.test(theme));
check('dark mode is the same notebook at night', /\[data-theme="dark"\]\s*\{[^}]*--page:\s*#121210/si.test(theme));
check('one flat teal accent, never a gradient', /--accent:\s*#0b6e69/i.test(theme) && /--brand-grad:\s*linear-gradient\(var\(--accent\),\s*var\(--accent\)\)/.test(theme));
for (const token of ['--correction', '--uncertain', '--bad', '--good']) {
  check(`state token ${token} is defined for paper and night`, (theme.match(new RegExp(`${token}:`, 'g')) || []).length >= 2, token);
}
check('correction, uncertainty and technical failure never share a colour', (() => {
  const val = n => (theme.match(new RegExp(`:root\\s*\\{[\\s\\S]*?${n}:\\s*(#[0-9a-f]{6})`, 'i')) || [])[1];
  const v = ['--correction', '--uncertain', '--bad', '--accent', '--good'].map(val);
  return v.every(Boolean) && new Set(v).size === v.length;
})());

// ── Anti-template lints: what makes an interface look generated ────────────
const componentLayer = theme.slice(theme.indexOf('Pri instrument layer'));
check('the instrument layer exists', componentLayer.length > 2000);
const gradients = (componentLayer.match(/(?<!repeating-)(?:linear|radial)-gradient\([^;]*;/g) || [])
  .filter(g => !/paper-|transparent|surface-2|var\(--m1\)|#000/.test(g));
check('no decorative gradients in the component layer', gradients.length === 0, gradients.slice(0, 3).join(' | '));
check('no glow shadows', !/box-shadow:[^;]*0 0 (1[2-9]|[2-9]\d)px/.test(componentLayer));
check('no glassmorphism blur on surfaces beyond the sticky bars', (componentLayer.match(/backdrop-filter:\s*blur\((1[3-9]|[2-9]\d)px\)/g) || []).length <= 1);
const radii = [...componentLayer.matchAll(/border-radius:\s*(\d+)px/g)].map(m => Number(m[1])).filter(n => n > 8);
check('hairline radii: no literal radius above 8px in the component layer', radii.length === 0, radii.join(','));
check('radius tokens stay precise', /--radius:\s*4px/.test(theme) && /--radius-lg:\s*6px/.test(theme));
const literal = (componentLayer.replace(/mask-image:[^;]*;/g, '').match(/#[0-9a-fA-F]{3,6}\b|rgba?\(\d/g) || []);
check('no literal colours below the token block', literal.length === 0, literal.slice(0, 5).join(','));

const ui = ['../src/App.jsx', '../src/pages/Home.jsx', '../src/pages/PracticeBase.jsx', '../src/components/QuestionCard.jsx', '../src/ink/InkAnswer.jsx', '../src/pages/ExamRoom.jsx']
  .map(f => [f, readFileSync(new URL(f, import.meta.url), 'utf8')]);
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\u{FE0F}?/u;
for (const [f, src] of ui) {
  const chrome = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const hit = chrome.match(EMOJI);
  check(`${f.split('/').pop()} draws no emoji in its chrome`, !hit || hit[0] === '✓' || hit[0] === '✕', hit?.[0]);
  check(`${f.split('/').pop()} has no typing-caret tagline or AI motif`, !/type-caret|sparkle|✨|🤖|AI is thinking/i.test(chrome));
}
check('one icon family: every nav mark comes from Icon.jsx', /const I = \{[\s\S]*?<Icon name="home" \/>/.test(app) && !/<span aria-hidden="true">[✎↺⚡▣☰]<\/span>/.test(app));
const icons = readFileSync(new URL('../src/components/Icon.jsx', import.meta.url), 'utf8');
check('the icon family is one grid and one stroke', /viewBox="0 0 24 24"/.test(icons) && /strokeWidth = 1\.6/.test(icons) && /aria-hidden="true"/.test(icons));

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
check('thinking mode removes the navigation furniture', /\.shell\.is-focus \.sidebar/.test(theme) && /is-focus/.test(app));
check('landscape tablets get the split workspace', /orientation:\s*landscape\)\s*\{[\s\S]*?\.qpage\.ws-split\s*\{\s*grid-template-columns:\s*minmax\(330px,\s*38fr\)\s*minmax\(0,\s*62fr\)/.test(theme));
check('phone recomposes the action bar to the bottom safe area', /max-width:\s*760px[\s\S]*\.ws-actions\s*\{\s*position:\s*fixed[^}]*env\(safe-area-inset-bottom\)/.test(theme));
check('phone layout has an explicit breakpoint', /@media\s*\(max-width:\s*760px\)/.test(theme));
check('single-column questions keep a readable measure', /\.ws-single \.ws-context, \.ws-single \.ws-work \{ width: min\(820px, 100%\)/.test(theme) && /--measure:\s*68ch/.test(theme));
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
  console.error(`\n✖ PRI DESIGN SYSTEM CHECK FAILED — ${pass}/${checks.length} checks`);
  process.exit(1);
}
console.log(`\n✔ PRI DESIGN SYSTEM CHECK PASSED — ${pass}/${checks.length} checks`);
console.log(`  source root: ${ROOT}`);
