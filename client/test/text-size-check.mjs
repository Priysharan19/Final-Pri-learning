// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Text size: the device setting, its boot paint and its wiring.
// Static and unit checks (no browser). The layout proof at the largest step is
// client/test/tour-text-size.js.
// ─────────────────────────────────────────────────────────────────────────────
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { TEXT_SIZES, TEXT_SCALE, TEXT_SIZE_KEY, DEFAULT_TEXT_SIZE, cleanTextSize, readTextSize, applyTextSize } from '../src/lib/textSize.js';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n += 1; };
const read = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const fakeRoot = () => { const attrs = new Map(); const props = new Map();
  return { attrs, props, setAttribute: (k, v) => attrs.set(k, v), removeAttribute: k => attrs.delete(k), getAttribute: k => attrs.get(k) ?? null,
    style: { setProperty: (k, v) => props.set(k, v), removeProperty: k => props.delete(k), colorScheme: '' } }; };

// 1 · the steps and the default
ok(JSON.stringify(TEXT_SIZES) === '["standard","large","larger","largest"]', 'four steps, smallest first');
ok(DEFAULT_TEXT_SIZE === 'standard' && TEXT_SCALE.standard === 1, 'Standard is the default and is exactly 1');
ok(TEXT_SCALE.large === 1.125 && TEXT_SCALE.larger === 1.25 && TEXT_SCALE.largest === 1.4, 'each step sets the expected scale');
ok(cleanTextSize('huge') === 'standard' && cleanTextSize(undefined) === 'standard' && cleanTextSize('largest') === 'largest', 'anything unknown is Standard');

// 2 · each step persists and applies; Standard sets nothing
for (const size of TEXT_SIZES) {
  const root = fakeRoot(); const storage = mem();
  ok(applyTextSize(size, { root, storage }) === size, `${size} applies`);
  ok(readTextSize(storage) === size && storage.getItem(TEXT_SIZE_KEY) === size, `${size} persists on this device`);
  if (size === 'standard') ok(!root.attrs.has('data-text-size') && !root.props.has('--pri-text-scale'), 'Standard leaves <html> untouched');
  else ok(root.attrs.get('data-text-size') === size && root.props.get('--pri-text-scale') === String(TEXT_SCALE[size]), `${size} sets --pri-text-scale to ${TEXT_SCALE[size]}`);
}
const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
ok(readTextSize(blocked) === 'standard' && applyTextSize('large', { root: fakeRoot(), storage: blocked }) === 'large', 'blocked storage never throws and reads Standard');

// 3 · applied before first paint: public/theme-boot.js, run on its own, no app code
const boot = read('../public/theme-boot.js');
for (const size of TEXT_SIZES) {
  const root = fakeRoot(); const storage = mem(); storage.setItem(TEXT_SIZE_KEY, size);
  vm.runInNewContext(boot, { document: { documentElement: root, querySelector: () => null }, localStorage: storage, window: {}, matchMedia: undefined });
  if (size === 'standard') ok(!root.attrs.has('data-text-size'), 'boot: Standard paints nothing');
  else ok(root.attrs.get('data-text-size') === size && root.props.get('--pri-text-scale') === String(TEXT_SCALE[size]), `boot paints ${size} before the app loads`);
}
{ const root = fakeRoot(); vm.runInNewContext(boot, { document: { documentElement: root, querySelector: () => null }, localStorage: blocked, window: {} });
  ok(root.attrs.get('data-theme') === 'light' && !root.attrs.has('data-text-size'), 'boot with blocked storage still paints the theme and no size'); }

// 4 · the stylesheet: one rule on the content, only when a step is set
const css = read('../src/theme.css');
ok(/html\[data-text-size\] \.content \{ zoom: var\(--pri-text-scale, 1\); \}/.test(css), 'one zoom rule on main.content, scoped to a chosen step');
const others = css.split('\n').filter(l => /--pri-text-scale/.test(l) && !/^html\[data-text-size\] \.content \{ zoom/.test(l));
ok(others.length > 0 && others.every(l => /^(@media[^{]*\{ )?html\[data-text-size\] [^{]*\{ (min-|max-)?(height|width): calc\(.*\/ var\(--pri-text-scale\).*\}/.test(l) || /--pri-text-scale/.test(l) && /\/ var\(--pri-text-scale\)/.test(l)), 'the only other readers divide viewport units back out (nothing is scaled twice)');

// 5 · Settings: a labelled radio group in Appearance, keyboard buttons, announced
const settings = read('../src/pages/SettingsLegacy.jsx');
ok(/role="radiogroup" aria-labelledby="text-size-label"/.test(settings) && /id="text-size-label"/.test(settings), 'a labelled radio group');
ok(/role="radio" aria-checked=\{textSize === size\}/.test(settings) && /<button key=\{size\} type="button"/.test(settings), 'native buttons with radio semantics (Tab, Space, Enter)');
ok(/role="status" aria-live="polite">\{t\('settings.textSizeSet'/.test(settings), 'the change is announced');
ok(/MathText text=/.test(settings) && /settings\.appearance'\)\}<\/h2>[\s\S]*settings\.textSize'\)/.test(settings), 'the preview sentence has maths and sits under Appearance');

// 6 · strings in both languages, no em dashes
const en = read('../src/i18n/strings.en.js'); const hi = read('../src/i18n/strings.hi.js');
for (const k of ['settings.textSize', 'settings.textSize.standard', 'settings.textSize.large', 'settings.textSize.larger', 'settings.textSize.largest', 'settings.textSizeNote', 'settings.textSizePreview', 'settings.textSizeSet']) {
  const rx = new RegExp(`'${k.replace(/\./g, '\\.')}':\\s*'([^']+)'`);
  const a = en.match(rx)?.[1]; const b = hi.match(rx)?.[1];
  ok(a && b, `${k} exists in English and Hindi`);
  ok(!/—/.test(a + b), `${k} has no em dash`);
}

// 7 · the pen is mapped through the sheet's own box
const ink = read('../src/ink/InkCanvas.jsx');
ok(/rect\.width \/ canvas\.offsetWidth/.test(ink) && /k === 1 \? \{ x: e\.clientX - rect\.left, y: e\.clientY - rect\.top \}/.test(ink), 'ink: unscaled pages use the old mapping exactly; scaled pages divide by the ratio');

// 8 · the first-run note and the map: nothing fixed or hit-tested in the wrong units
const tour = read('../src/components/PracticeTour.jsx');
ok(/createPortal\(/.test(tour) && /document\.body\s*\);/.test(tour), 'the first-run note is rendered on <body>, outside the zoomed content');
const board = read('../src/progress/SyllabusBoard.jsx');
ok(/r\.width \/ el\.offsetWidth/.test(board) && /\(e\.clientX - r\.left\) \/ k/.test(board), 'map picking divides the scale out of the pointer');
ok(/\.content :is\(\.pri-explain-launch, \.pri-explain-backdrop/.test(css) && /\.ws-actions \.btn \{ white-space: nowrap; \}/.test(css), 'full-screen layers leave the zoom; the action bar keeps one line per button');

// 9 · the note's placement tries every side of its control and never covers the question or the picker
{
  const { tourNotePlace } = await import('../src/lib/firstRunTour.js');
  const rect = (l, t, r, b) => ({ left: l, top: t, right: r, bottom: b });
  const hit = (c, w, h, q) => c.left < q.right - 1 && c.left + w > q.left + 1 && c.top < q.bottom - 1 && c.top + h > q.top + 1;
  const prompt = rect(222, 26, 1044, 77), picker = rect(64, 90, 1216, 150);
  const w = 236, h = 183, base = { w, h, vw: 1280, vh: 800, minTop: 0 };
  // the reported case: usual place [16,57,252,240] over the question at Large on 1280x800
  const a = tourNotePlace({ ...base, anchor: rect(16, 0, 200, 56), usual: { left: 16, top: 57 }, avoids: [prompt] });
  ok(!hit(a, w, h, prompt) && a.left >= 16 && a.top >= 16 && a.left + w <= 1264 && a.top + h <= 784, 'Large 1280x800: the note leaves the question and stays on screen');
  const b = tourNotePlace({ ...base, anchor: rect(16, 0, 200, 56), usual: { left: 16, top: 57 }, avoids: [prompt, picker] });
  ok(!hit(b, w, h, prompt) && !hit(b, w, h, picker), 'it clears the question and the dot-point picker together');
  const c = tourNotePlace({ ...base, anchor: rect(300, 400, 500, 440), usual: { left: 300, top: 448 }, avoids: [rect(0, 0, 10, 10)] });
  ok(c.left === 300 && c.top === 448, 'nothing in the way: the usual place, unchanged');
  const everywhere = rect(0, 0, 1280, 800);
  const d = tourNotePlace({ ...base, anchor: rect(300, 400, 500, 440), usual: { left: 300, top: 448 }, avoids: [everywhere] });
  ok(d.left >= 16 && d.top >= 16 && d.left + w <= 1264 && d.top + h <= 784, 'no clear place at all: still wholly on screen');
}

console.log(`TEXT SIZE: PASS — ${n}/${n} checks — four steps, Standard changes nothing, persisted per device, painted before first paint, labelled and announced, strings in both languages`);
