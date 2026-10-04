// Android parity: the stylus eraser end (buttons & 32) and the S Pen barrel
// button (buttons & 2) erase on the shared canvas; fingers, mice and a plain
// pen tip never do, so Apple Pencil behaviour is unchanged.
import { penWantsEraser } from '../src/ink/penButtons.js';
import { readFileSync } from 'node:fs';

let failures = 0;
const check = (name, ok) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}`); if (!ok) failures++; };

check('plain pen tip draws', !penWantsEraser({ pointerType: 'pen', buttons: 1, button: 0 }));
check('Apple Pencil (no buttons reported) draws', !penWantsEraser({ pointerType: 'pen', buttons: 0, button: 0 }));
check('eraser end (buttons & 32) erases', penWantsEraser({ pointerType: 'pen', buttons: 32, button: 5 }));
check('eraser end via button 5 alone erases', penWantsEraser({ pointerType: 'pen', buttons: 0, button: 5 }));
check('S Pen side button held while touching (buttons 3) erases', penWantsEraser({ pointerType: 'pen', buttons: 3, button: 0 }));
check('a finger with buttons set never erases', !penWantsEraser({ pointerType: 'touch', buttons: 32, button: 5 }));
check('a mouse right button never erases', !penWantsEraser({ pointerType: 'mouse', buttons: 2, button: 2 }));
check('missing event is safe', !penWantsEraser(null));

const src = readFileSync(new URL('../src/ink/InkCanvas.jsx', import.meta.url), 'utf8');
check('InkCanvas decides hardware erasing on pointerdown', /hwEraseRef\.current = penWantsEraser\(e\)/.test(src));
check('a hardware-erased stroke is never committed as ink', /if \(!hwErased && toolRef\.current !== 'eraser' && currentRef\.current\)/.test(src));

console.log(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} problem(s)`}`);
process.exit(failures ? 1 : 0);
