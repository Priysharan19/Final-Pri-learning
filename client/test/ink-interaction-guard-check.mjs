// Fast Apple Pencil gestures must never escape into Safari text selection.
// This runs the browser guard against a tiny deterministic DOM stub so a future
// refactor cannot silently remove the capture-phase protection.
import { pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
let failures = 0;
const check = (name, ok) => {
  if (ok) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}`);
};

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(v) { this.values.add(v); }
  remove(v) { this.values.delete(v); }
  contains(v) { return this.values.has(v); }
}
class FakeElement {
  constructor(inInk = false) { this.inInk = inInk; }
  closest(selector) { return selector === '.ink-wrap' && this.inInk ? this : null; }
}

global.Element = FakeElement;
const documentHandlers = new Map();
const windowHandlers = new Map();
const html = { classList: new FakeClassList() };
let injectedStyle = null;
let selectionClears = 0;

global.document = {
  documentElement: html,
  head: { appendChild: (node) => { injectedStyle = node; } },
  createElement: () => ({ id: '', textContent: '' }),
  getElementById: () => null,
  addEventListener: (name, fn) => documentHandlers.set(name, fn)
};
global.window = {
  getSelection: () => ({ removeAllRanges: () => { selectionClears++; } }),
  addEventListener: (name, fn) => windowHandlers.set(name, fn)
};

const moduleUrl = pathToFileURL(join(HERE, '../src/ink/interactionGuard.js')).href;
const mod = await import(`${moduleUrl}?contract=1`);
const activeClass = mod.__interactionGuardContract.activeClass;

const event = (type, { inInk = true, pointerType = 'pen', pointerId = 7 } = {}) => {
  let prevented = 0;
  return {
    type,
    target: new FakeElement(inInk), pointerType, pointerId, cancelable: true,
    preventDefault: () => { prevented++; },
    get prevented() { return prevented; }
  };
};

console.log('Ink interaction guard contract\n');
check('guard injects a no-selection style',
  injectedStyle?.textContent.includes('-webkit-user-select: none !important')
  && injectedStyle.textContent.includes('-webkit-touch-callout: none !important'));
for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'selectstart', 'dragstart']) {
  check(`capture handler registered for ${name}`, typeof documentHandlers.get(name) === 'function');
}

const down = event('pointerdown');
documentHandlers.get('pointerdown')(down);
check('Pencil down in ink arms document guard', html.classList.contains(activeClass));
check('Pencil down cancels native browser gesture', down.prevented === 1);

const selection = event('selectstart', { inInk: false });
documentHandlers.get('selectstart')(selection);
check('selection is blocked even if fast Pencil has moved outside canvas', selection.prevented === 1);

const move = event('pointermove', { inInk: false });
documentHandlers.get('pointermove')(move);
check('active Pencil move outside canvas remains browser-gesture-free', move.prevented === 1);

const up = event('pointerup', { inInk: false });
documentHandlers.get('pointerup')(up);
check('Pencil up is suppressed before release', up.prevented === 1);
await new Promise(resolve => setTimeout(resolve, mod.__interactionGuardContract.releaseGraceMs + 30));
check('guard releases after WebKit post-pointer selection window', !html.classList.contains(activeClass));

const finger = event('pointerdown', { pointerType: 'touch', pointerId: 8 });
documentHandlers.get('pointerdown')(finger);
check('finger gesture is not captured by Pencil guard', finger.prevented === 0 && !html.classList.contains(activeClass));

const outside = event('pointerdown', { inInk: false, pointerId: 9 });
documentHandlers.get('pointerdown')(outside);
check('Pencil starting outside writing surface keeps normal page behaviour', outside.prevented === 0 && !html.classList.contains(activeClass));
check('selection ranges were actively cleared', selectionClears >= 3);
check('blur/pagehide emergency release handlers exist',
  typeof windowHandlers.get('blur') === 'function' && typeof windowHandlers.get('pagehide') === 'function');

console.log(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} problem(s)`}`);
process.exit(failures === 0 ? 0 : 1);
