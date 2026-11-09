// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Aurora skin stays on chrome (V1 decisions D7, D8, D9)
//
// client/src/instrument/aurora.css dresses the Instrument's chrome in the
// owner's Aurora (glass, one violet, light pools). D9 allows that on chrome
// only: content keeps the Instrument's tokens, and glass or glow never sits
// behind mathematics or handwriting. D8 makes this a gate: if it cannot pass,
// the setting goes back to 'instrument'. This suite reads the stylesheet and
// the instrument tokens and holds:
//
//   1. scope: every rule is under html.ui-instrument.skin-aurora (or is the
//      rule hiding the pools without it), and no --in-* token is declared, so
//      the content palette is byte-for-byte the Instrument's under both skins;
//   2. reach: no selector names a content surface (questions, KaTeX, working,
//      ink, transcripts, marks, feedback, Report, Scripts, the scope), and
//      glass (backdrop-filter) is only ever on chrome surfaces;
//   3. the light pools: drawn by Aurora.jsx, mounted by App.jsx only on the
//      Index, the Map and Settings, paused when hidden; the Index plate (which
//      holds the chapter's mathematics) is opaque wherever they show;
//   4. fallbacks: Reduce Transparency and forced colours make every glass
//      surface opaque and remove the pools; Reduce Motion stops them;
//   5. contrast, in light and dark: every chrome text colour meets WCAG AA
//      (4.5:1) on its glass composited over each Instrument surface that can
//      scroll beneath it, and over the pools at their strongest; the focus and
//      current-place violet meets 3:1 as a non-text indicator.
//
// The browser half (content-token identity, ink alignment, emulated Reduce
// Motion / Transparency / forced colours) is tour-instrument's Aurora flow.
//
// Usage: node client/test/aurora-skin-check.mjs
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const read = rel => readFileSync(join(ROOT, rel), 'utf8');
const css = read('client/src/instrument/aurora.css');
const instrument = read('client/src/instrument/instrument.css');
const app = read('client/src/App.jsx');
const pools = read('client/src/instrument/Aurora.jsx');

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };

// ── Parse: top-level rules and the rules inside @media / @supports ──────────
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, '');
function rules(src) {
  const out = [];
  let i = 0; const s = stripComments(src);
  const walk = (text, ctx) => {
    let depth = 0, start = 0, head = '';
    for (let j = 0; j < text.length; j++) {
      const c = text[j];
      if (c === '{') { if (depth === 0) { head = text.slice(start, j).trim(); start = j + 1; } depth++; }
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          const body = text.slice(start, j);
          if (/^@(media|supports)/.test(head)) walk(body, [...ctx, head]);
          else if (!/^@keyframes/.test(head)) out.push({ selector: head, body, ctx });
          start = j + 1;
        }
      }
    }
  };
  walk(s, []);
  void i;
  return out;
}
const all = rules(css);
ok(all.length > 20, `aurora.css parses into rules (${all.length})`);

// ── 1 · scope and no content tokens ─────────────────────────────────────────
// Split a selector list on its top-level commas (not those inside :is(...)).
const split = sel => { const out = []; let depth = 0, cur = ''; for (const ch of sel) { if (ch === '(') depth++; if (ch === ')') depth--; if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; } if (cur.trim()) out.push(cur.trim()); return out; };
const selectors = all.flatMap(r => split(r.selector));
const unscoped = selectors.filter(s => !s.startsWith('html.ui-instrument.skin-aurora') && s !== 'html.ui-instrument:not(.skin-aurora) .a-aurora');
ok(unscoped.length === 0, `every rule is scoped to html.ui-instrument.skin-aurora: ${JSON.stringify(unscoped.slice(0, 4))}`);
const declaresIn = all.filter(r => /(^|[;\s{])--in-[a-z0-9-]+\s*:/.test(r.body));
ok(declaresIn.length === 0, `no --in-* content token is declared under the skin: ${JSON.stringify(declaresIn.map(r => r.selector).slice(0, 3))}`);
ok(!/--(page|surface|paper|ink|accent|good|bad|slip)\s*:/.test(stripComments(css)), 'no legacy content alias (--page, --surface, --paper, --ink, --accent, marks) is redeclared either');

// ── 2 · reach: chrome only ───────────────────────────────────────────────────
const CONTENT = /\.(qpage|q-card|q-prompt|q-figure|katex|ink-|in-scope|in-ex\b|in-exs|in-kpis|in-next\b|in-led|in-report|in-rp|in-map-|hist-|eval-|verdict|ws-|editor|answer-|mathfield|step|solution|criteria|nt-|in-reading|in-step|in-mark-strip|markstrip|exam-|in-pal-q input)/;
const content = selectors.filter(s => CONTENT.test(s));
ok(content.length === 0, `no selector reaches a content surface (questions, KaTeX, working, ink, marks, Report, Scripts, scope): ${JSON.stringify(content.slice(0, 4))}`);
const CHROME_GLASS = /^html\.ui-instrument\.skin-aurora :is\((\.(in-bar|mobilenav|in-tabs|in-cmd|in-more|in-more-menu|acct-menu|mnav-sheet|in-pal)(, )?)+\)$/;
const glass = all.filter(r => /backdrop-filter:\s*blur/.test(r.body));
ok(glass.length >= 2, `glass is used (${glass.length} rules)`);
ok(glass.every(r => split(r.selector).every(s => CHROME_GLASS.test(s))), `glass only on the bars, the tab well, ⌘K, More, the menus, the sheet and the palette: ${JSON.stringify(glass.map(r => r.selector))}`);
ok(!all.some(r => /\.(ws-bar|ws-qpeek|ws-actions)/.test(r.selector)), 'the practice bars over a question are never restyled (they stay opaque, dream-interface-check)');
ok(all.some(r => r.ctx.some(c => c.includes('max-width: 760px')) && r.selector === 'html.ui-instrument.skin-aurora .in-bar' && /background:\s*var\(--in-base\)/.test(r.body) && /backdrop-filter:\s*none/.test(r.body)),
  'on a phone the top bar is opaque, so the status-bar strip is exactly the page colour');
// A glow is a blurred, unoffset shadow (the token, or a literal of 12 px and
// more), as design-system-check defines it; declaring the token is not one.
const uses = body => body.replace(/--[a-z0-9-]+\s*:[^;]*;/g, '');
const glow = all.filter(r => /var\(--au-glow\)|drop-shadow|0 0 (1[2-9]|[2-9]\d)px/.test(uses(r.body)));
ok(glow.every(r => /\.in-index \.in-btn\.is-primary/.test(r.selector) || /^@/.test(r.selector)), `glow only on the Index's primary action: ${JSON.stringify(glow.map(r => r.selector))}`);
const gradients = all.filter(r => /gradient\(/.test(r.body));
ok(gradients.every(r => /\.a-aurora i|\.in-mark-glyph/.test(r.selector)), `gradients only in the light pools and the P′ tile: ${JSON.stringify(gradients.map(r => r.selector))}`);
const radii = [...stripComments(css).matchAll(/border-radius:\s*(\d+)px/g)].map(m => Number(m[1]));
ok(radii.every(n => n <= 6), `radii stay 2–6 px on chrome (${radii.join(',')})`);
ok(!/✨|sparkle|robot|brain|magic/i.test(stripComments(css)) && !/✨|sparkle/i.test(pools), 'no sparkle or AI motif');

// ── 3 · the pools ─────────────────────────────────────────────────────────────
ok(/const AURORA_POOL_ROUTES = new Set\(\['\/', '\/map', '\/settings'\]\);/.test(app), 'the pools may show only on the Index, the Map and Settings');
ok(/INSTRUMENT_ON && INTERFACE_SKIN_UI === 'aurora' && user\.role !== 'teacher' && AURORA_POOL_ROUTES\.has\(loc\.pathname\) && <Aurora \/>/.test(app), 'App mounts them only with the aurora skin, on those routes');
ok(/if \(INTERFACE_SKIN_UI === 'aurora'\) document\.documentElement\?\.classList\?\.add\('skin-aurora'\);/.test(app), 'the skin class follows the setting (D8: \'instrument\' turns every rule off)');
ok(/visibilitychange/.test(pools) && /animationPlayState = document\.hidden \? 'paused'/.test(pools), 'the pools pause while the page is hidden');
ok(/aria-hidden="true"/.test(pools), 'and are hidden from assistive technology');
ok(all.some(r => /\[data-aurora-pools\] \.in-plate$/.test(r.selector) && /background:\s*var\(--in-base\)/.test(r.body)), 'where the pools show, the Index plate (the chapter\'s mathematics) is opaque');
ok(all.some(r => r.selector === 'html.ui-instrument:not(.skin-aurora) .a-aurora' && /display:\s*none/.test(r.body)), 'without the skin no pool is drawn');

// ── 4 · fallbacks ─────────────────────────────────────────────────────────────
const inMedia = q => all.filter(r => r.ctx.some(c => c.includes(q)));
const rt = inMedia('prefers-reduced-transparency: reduce');
ok(rt.some(r => /backdrop-filter:\s*none/.test(r.body) && /\.in-bar/.test(r.selector)) && rt.some(r => /backdrop-filter:\s*none/.test(r.body) && /\.in-pal/.test(r.selector)), 'Reduce Transparency: the bars, menus and palette are opaque');
ok(rt.some(r => /\.a-aurora/.test(r.selector) && /display:\s*none/.test(r.body)), 'Reduce Transparency: no pools');
// iOS WebKit leaves prefers-reduced-transparency unanswered, so the shell
// states UIAccessibility.isReduceTransparencyEnabled as a class on <html>, kept
// current on change, and the same opaque fallback keys on that class. Android
// exposes no Reduce Transparency setting to apps, so it has nothing to pass.
const rtc = all.filter(r => /\.a11y-reduce-transparency/.test(r.selector) && !r.ctx.length);
ok(rtc.some(r => /\.in-bar/.test(r.selector) && /backdrop-filter:\s*none/.test(r.body)) && rtc.some(r => /\.in-pal/.test(r.selector) && /backdrop-filter:\s*none/.test(r.body)) && rtc.some(r => /\.a-aurora/.test(r.selector) && /display:\s*none/.test(r.body)), 'the shell\'s Reduce Transparency class makes the same rules opaque as the media query (bars, menus, palette, no pools)');
const shell = read('ios/PriLearning.swiftpm/WebShell.swift');
ok(/reduceTransparencyScript\(UIAccessibility\.isReduceTransparencyEnabled\)/.test(shell) && /injectionTime: \.atDocumentStart/.test(shell.slice(shell.indexOf('reduceTransparencyScript(UIAccessibility'))) && /UIAccessibility\.reduceTransparencyStatusDidChangeNotification/.test(shell) && /classList\.toggle\('a11y-reduce-transparency'/.test(shell), 'the iOS shell sets that class from the first paint and on every change of the setting');
ok(/didFinish navigation[\s\S]{0,600}applyReduceTransparency\(\)/.test(shell), 'and states it again when every navigation finishes, so a reload never keeps a stale value');
ok(read('ios/PriLearning 2.swiftpm/WebShell.swift') === shell, 'the second iOS project (PriLearning 2.swiftpm) carries the same shell');
const fc = inMedia('forced-colors: active');
ok(fc.some(r => /\.a-aurora/.test(r.selector) && /display:\s*none/.test(r.body)) && fc.some(r => /backdrop-filter:\s*none/.test(r.body)), 'forced colours: no pools, no glass');
ok(inMedia('prefers-reduced-motion: reduce').some(r => /\.a-aurora i/.test(r.selector) && /animation:\s*none/.test(r.body)), 'Reduce Motion: the pools stand still');
ok(all.filter(r => /animation/.test(r.body)).every(r => /\.a-aurora i/.test(r.selector)), 'nothing else on the chrome is animated by the skin');

// ── 5 · contrast ──────────────────────────────────────────────────────────────
const hex = h => { const m = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(m.slice(i, i + 2), 16)); };
const rgba = s => { const m = s.match(/rgba?\(([^)]+)\)/); const [r, g, b, a = 1] = m[1].split(',').map(Number); return { c: [r, g, b], a }; };
const over = (top, a, bottom) => top.map((v, i) => v * a + bottom[i] * (1 - a));
const lum = c => { const [r, g, b] = c.map(v => v / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + 0.05) / (lo + 0.05); };
const block = (src, start) => src.slice(src.indexOf(start), src.indexOf('\n}', src.indexOf(start)));
const tok = (blk, name) => (blk.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6}|rgba?\\([^)]*\\))`)) || [])[1];
const themes = [
  ['light', block(instrument, 'html.ui-instrument {'), block(css, 'html.ui-instrument.skin-aurora {')],
  ['dark', block(instrument, 'html.ui-instrument[data-theme="dark"] {'), block(css, 'html.ui-instrument.skin-aurora[data-theme="dark"] {')]
];
const glassAlpha = (sel, fallback) => { const r = all.find(x => x.selector.includes(sel) && /color-mix/.test(x.body)); const m = r?.body.match(/color-mix\(in srgb, var\(--in-([a-z0-9]+)\) (\d+)%/); return m ? { token: `in-${m[1]}`, a: Number(m[2]) / 100 } : fallback; };
const barGlass = glassAlpha('.in-bar', null);
const wellGlass = glassAlpha('.in-tabs', null);
const menuGlass = glassAlpha('.in-more-menu', null);
ok(barGlass && wellGlass && menuGlass, 'the glass tints are read from the stylesheet');
for (const [name, ins, au] of themes) {
  const T = n => hex(tok(ins, n));
  const surfaces = ['in-void', 'in-base', 'in-l1', 'in-l2', 'in-l3', 'in-l4', 'in-l5'].map(n => [n, T(n)]);
  const violet = hex(tok(au, 'au-violet'));
  const soft = rgba(tok(au, 'au-violet-soft'));
  const pairs = [];
  for (const [sname, s] of surfaces) {
    const bar = over(T(barGlass.token), barGlass.a, s);
    const well = over(T(wellGlass.token), wellGlass.a, bar);
    const menu = over(T(menuGlass.token), menuGlass.a, s);
    pairs.push([`tab label (tx-3) on the tab well over ${sname}`, T('in-tx-3'), well, 4.5]);
    pairs.push([`⌘K and More (tx-3) over ${sname}`, T('in-tx-3'), well, 4.5]);
    pairs.push([`current tab (violet) on violet-soft over ${sname}`, violet, over(soft.c, soft.a, well), 4.5]);
    pairs.push([`phone bar label (tx-3) over ${sname}`, T('in-tx-3'), bar, 4.5]);
    pairs.push([`phone bar current (violet) over ${sname}`, violet, bar, 4.5]);
    pairs.push([`menu item (tx-2) over ${sname}`, T('in-tx-2'), menu, 4.5]);
    pairs.push([`menu current (violet) over ${sname}`, violet, menu, 4.5]);
    pairs.push([`focus ring (violet, non-text) on the bar over ${sname}`, violet, bar, 3]);
  }
  // The pools at their strongest: all three stacked on the desk.
  const desk = T('in-base');
  const p = ['au-pool-1', 'au-pool-2', 'au-pool-3'].map(n => rgba(tok(au, n)));
  const lit = p.reduce((bg, q) => over(q.c, q.a, bg), desk);
  for (const t of ['in-tx', 'in-tx-2', 'in-tx-3']) pairs.push([`Index text (${t}) over the pools at their strongest`, T(t), lit, 4.5]);
  pairs.push(['Index primary (on-violet on violet)', hex(tok(au, 'au-on-violet')), violet, 4.5]);
  const fails = pairs.map(([label, fg, bg, min]) => [label, ratio(fg, bg), min]).filter(([, r, min]) => r < min);
  ok(fails.length === 0, `${name}: every chrome text pair meets AA (${pairs.length} pairs): ${fails.map(([l, r]) => `${l} ${r.toFixed(2)}`).slice(0, 4).join('; ')}`);
}

if (failures.length) {
  console.log(`AURORA SKIN: FAIL — ${failures.length} of ${pass + failures.length} checks failed\n  · ${failures.join('\n  · ')}`);
  process.exit(1);
}
console.log(`AURORA SKIN: PASS — ${pass}/${pass} checks — chrome only (no --in-* token, no content selector, glass only on chrome surfaces), pools only on the Index, Map and Settings, opaque under Reduce Transparency and forced colours, still under Reduce Motion, AA on every chrome text pair in light and dark.`);
