// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · iPhone status-bar ink follows Pri's paper (PR #530 review).
//
// On iPhone the page runs under the status bar, and Pri's theme (paper, night,
// or follow the device) can differ from the device's appearance. The native
// shell maps the page's theme-color to a tone and colours the status bar from
// it. This check:
//   · compiles StatusBarAppearance.swift with a small driver and runs it for
//     every theme × device combination the page can produce (when swiftc is
//     present, i.e. on macOS; elsewhere it says SKIP for that part only);
//   · holds the wiring in both Swift packages, byte-identical.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { THEME_CHROME, resolveTheme } from '../src/lib/theme.js';

const ROOT = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, ROOT), 'utf8');
let failed = 0, passed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed++; console.log(`  ✔ ${name}`); }
  else { failed++; console.log(`  ✘ ${name}${detail ? `\n      ${detail}` : ''}`); }
};

const PACKAGES = ['PriLearning.swiftpm', 'PriLearning 2.swiftpm'];
const FILES = ['StatusBarAppearance.swift', 'PriLearningApp.swift', 'WebShell.swift'];
for (const file of FILES) {
  const [a, b] = PACKAGES.map(pkg => read(`ios/${pkg}/${file}`));
  check(`${file} is identical in both Swift packages`, a === b);
}
const app = read('ios/PriLearning.swiftpm/PriLearningApp.swift');
const shell = read('ios/PriLearning.swiftpm/WebShell.swift');
check('ContentView sets the status bar from the page tone, only where the page is edge to edge',
  /\.preferredColorScheme\(Self\.statusBarScheme\(for: pageTone\)\)/.test(app)
    && /guard !edgeToEdge\.isEmpty, let tone else \{ return nil \}/.test(app)
    && /\.onReceive\(NotificationCenter\.default\.publisher\(for: \.priPageTone\)\)/.test(app));
check('the web shell observes the page\'s theme-color and reports its tone (iPhone only)',
  /webView\.observe\(\\\.themeColor, options: \[\.initial, \.new\]\)/.test(shell)
    && /StatusBarAppearance\.tone\(/.test(shell)
    && /userInterfaceIdiom == \.phone \{ attachPageTone\(to: webView\) \}/.test(shell));
check('the web view keeps the device\'s appearance, so "follow the device" never reads the shell\'s choice',
  /webView\.overrideUserInterfaceStyle = device/.test(shell) && /didBecomeActiveNotification/.test(shell));
// #533: preferredColorScheme overrides the window scene's appearance on
// iPhone, so a scene trait registration never hears the device switch (seen in
// the iOS 27 simulator). The screen is watched while active, stopped inactive.
check('a device light/dark switch while Pri stays in the foreground re-pins the web view (screen watched while active, never through the overridden scene)',
  /watchDeviceAppearance\(webView\)/.test(shell)
    && /Timer\(timeInterval: 1, repeats: true\)/.test(shell)
    && /willResignActiveNotification[\s\S]{0,200}deviceAppearanceWatch\?\.invalidate\(\)/.test(shell)
    && /\.screen \?\? UIScreen\.main\)\.traitCollection\.userInterfaceStyle/.test(shell)
    && !/windowScene[^\n]*registerForTraitChanges|scene\.registerForTraitChanges/.test(shell));

// Every page the app can paint: preference × device appearance → theme-color.
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const cases = [];
for (const pref of ['light', 'dark', 'system']) {
  for (const device of ['light', 'dark']) {
    const resolved = resolveTheme(pref, { matches: device === 'dark' });
    cases.push({ pref, device, color: THEME_CHROME[resolved], want: resolved });
  }
}
// The boundary: pure white and black, and the WCAG crossover either side.
cases.push({ pref: 'edge', device: '-', color: '#ffffff', want: 'light' }, { pref: 'edge', device: '-', color: '#000000', want: 'dark' },
  { pref: 'edge', device: '-', color: '#808080', want: 'light' }, { pref: 'edge', device: '-', color: '#6e6e6e', want: 'dark' });

const swiftc = spawnSync('xcrun', ['--find', 'swiftc'], { encoding: 'utf8' });
if (swiftc.status !== 0) {
  console.log('  SKIP running StatusBarAppearance.swift: no swiftc on this machine (the wiring checks above still ran)');
} else {
  const dir = mkdtempSync(join(tmpdir(), 'pri-status-bar-'));
  const driver = join(dir, 'main.swift');
  writeFileSync(driver, `${cases.map(c => {
    const [r, g, b] = hex(c.color);
    return `print("${c.pref}|${c.device}|${c.color}|" + StatusBarAppearance.tone(red: ${r}, green: ${g}, blue: ${b}).rawValue)`;
  }).join('\n')}\n`);
  const bin = join(dir, 'status-bar');
  const build = spawnSync('xcrun', ['swiftc', '-o', bin, new URL('ios/PriLearning.swiftpm/StatusBarAppearance.swift', ROOT).pathname, driver], { encoding: 'utf8' });
  check('StatusBarAppearance.swift compiles on its own (Foundation only)', build.status === 0, build.stderr?.slice(0, 400));
  if (build.status === 0) {
    const out = spawnSync(bin, [], { encoding: 'utf8' }).stdout.trim().split('\n');
    cases.forEach((c, i) => {
      const tone = out[i]?.split('|')[3];
      check(`theme ${c.pref} on a ${c.device} device (${c.color}) → ${c.want === 'light' ? 'dark' : 'light'} status-bar ink`, tone === c.want, `got ${tone}`);
    });
  }
}

console.log(`\n${failed ? '✖ IOS STATUS BAR: FAIL' : '✔ IOS STATUS BAR: PASS'} — ${passed}/${passed + failed} checks`);
process.exit(failed ? 1 : 0);
