// Fast Apple Pencil gestures must never escape into Safari text selection.
// This runs the browser guard against a tiny deterministic DOM stub so a future
// refactor cannot silently remove either layer of protection:
//   1) the whole page is non-selectable while the handwriting editor exists;
//   2) a detected fast Pencil pointer remains guarded even outside the canvas.
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
let inkSession = true;

global.document = {
  documentElement: html,
  head: { appendChild: (node) => { injectedStyle = node; } },
  createElement: () => ({ id: '', textContent: '' }),
  getElementById: () => null,
  querySelector: (selector) => selector === '.ink-answer' && inkSession ? {} : null,
  addEventListener: (name, fn) => documentHandlers.set(name, fn)
};
global.window = {
  getSelection: () => ({ removeAllRanges: () => { selectionClears++; } }),
  addEventListener: (name, fn) => windowHandlers.set(name, fn)
};

const moduleUrl = pathToFileURL(join(HERE, '../src/ink/interactionGuard.js')).href;
const mod = await import(`${moduleUrl}?contract=3`);
const { activeClass, sessionClass, syncSessionClass } = mod.__interactionGuardContract;

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
check('guard injects explicit session-wide no-selection style',
  injectedStyle?.textContent.includes(`html.${sessionClass}`)
  && !injectedStyle.textContent.includes(':has(.ink-answer)')
  && injectedStyle.textContent.includes('-webkit-user-select: none !important')
  && injectedStyle.textContent.includes('-webkit-touch-callout: none !important')
  && injectedStyle.textContent.includes('-webkit-user-drag: none !important'));
check('real text-entry controls are explicitly exempted',
  injectedStyle?.textContent.includes(`html.${sessionClass} input`)
  && injectedStyle.textContent.includes('[contenteditable="true"]'));
check('non-interactive handwriting hint cannot become a Pencil hit target',
  injectedStyle?.textContent.includes('.ink-hint')
  && injectedStyle.textContent.includes('pointer-events: none !important'));
check('handwriting editor present adds explicit session class', html.classList.contains(sessionClass));
for (const name of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'selectstart', 'dragstart', 'contextmenu', 'selectionchange']) {
  check(`capture handler registered for ${name}`, typeof documentHandlers.get(name) === 'function');
}

// Critical physical-iPad invariant: even if WebKit reports no useful Pencil
// pointer at all, selection is forbidden for the whole writing session.
const sessionSelection = event('selectstart', { inInk: false, pointerType: 'touch', pointerId: 99 });
documentHandlers.get('selectstart')(sessionSelection);
check('open handwriting session blocks selection without relying on Pencil pointerType', sessionSelection.prevented === 1);
const sessionContext = event('contextmenu', { inInk: false, pointerType: 'touch', pointerId: 99 });
documentHandlers.get('contextmenu')(sessionContext);
check('open handwriting session blocks WebKit callout/context gesture', sessionContext.prevented === 1);
const clearsBeforeChange = selectionClears;
documentHandlers.get('selectionchange')({});
check('selectionchange is actively cleared throughout the handwriting session', selectionClears > clearsBeforeChange);

const down = event('pointerdown');
documentHandlers.get('pointerdown')(down);
check('Pencil down in ink also arms document pointer guard', html.classList.contains(activeClass));
check('Pencil down cancels native browser gesture', down.prevented === 1);

const selection = event('selectstart', { inInk: false });
documentHandlers.get('selectstart')(selection);
check('selection is blocked if fast Pencil moves outside canvas', selection.prevented === 1);

const move = event('pointermove', { inInk: false });
documentHandlers.get('pointermove')(move);
check('active Pencil move outside canvas remains browser-gesture-free', move.prevented === 1);

const up = event('pointerup', { inInk: false });
documentHandlers.get('pointerup')(up);
check('Pencil up is suppressed before release', up.prevented === 1);
await new Promise(resolve => setTimeout(resolve, mod.__interactionGuardContract.releaseGraceMs + 30));
check('pointer-specific guard releases after WebKit post-pointer window', !html.classList.contains(activeClass));

const finger = event('pointerdown', { pointerType: 'touch', pointerId: 8 });
documentHandlers.get('pointerdown')(finger);
check('finger pointer itself is not captured, preserving scroll policy', finger.prevented === 0 && !html.classList.contains(activeClass));

inkSession = false;
syncSessionClass();
check('session class is removed when handwriting editor closes', !html.classList.contains(sessionClass));
const afterSession = event('selectstart', { inInk: false, pointerType: 'touch', pointerId: 8 });
documentHandlers.get('selectstart')(afterSession);
check('ordinary page selection returns after handwriting editor closes', afterSession.prevented === 0);
const outside = event('pointerdown', { inInk: false, pointerId: 9 });
documentHandlers.get('pointerdown')(outside);
check('Pencil starting outside writing surface keeps normal page behaviour after session', outside.prevented === 0 && !html.classList.contains(activeClass));
check('selection ranges were actively cleared', selectionClears >= 5);
check('blur/pagehide emergency release handlers exist',
  typeof windowHandlers.get('blur') === 'function' && typeof windowHandlers.get('pagehide') === 'function');

console.log(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} problem(s)`}`);
process.exit(failures === 0 ? 0 : 1);
