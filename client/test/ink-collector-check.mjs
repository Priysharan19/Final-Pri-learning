// Pri Learning · real-Pencil collector contract
// Prevents collection UI / ground-truth drift from poisoning the model corpus.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, '../../tools/ink-collect-v2/index.html');
const html = readFileSync(FILE, 'utf8');
let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}${detail ? ` — ${detail}` : ''}`);
};

console.log('\nReal-Pencil collector contract\n');

const pairs = [...html.matchAll(/\['([^']*)','([^']*)'\]/g)]
  .map(([, shown, target]) => ({ shown, target }));
const byShown = new Map(pairs.map(p => [p.shown, p.target]));

check('collector has a substantive prompt set', pairs.length >= 45, `${pairs.length} prompts`);
check('displayed capital O is labelled capital O, not zero', byShown.get('0  O  θ') === '0Otheta', byShown.get('0  O  θ'));
check('1/l/I/y ambiguity preserves literal identities', byShown.get('1  l  I  y') === '1lIy', byShown.get('1  l  I  y'));
check('multiplication sign canonicalises to *', byShown.get('x  ×  4  k') === 'x*4k');
check('superscripts are structural labels', byShown.get('x²') === 'x^(2)' && byShown.get('a³') === 'a^(3)');
check('subscripts are structural labels', byShown.get('x₁ + x₂') === 'x_1+x_2');
check('vertical fractions remain structural', byShown.get('1 over 2  (stack it vertically)') === '(1)/(2)');
check('prompt targets contain no whitespace', pairs.every(p => !/\s/.test(p.target)));
check('shown prompts are unique', new Set(pairs.map(p => p.shown)).size === pairs.length);

check('collector records versioned consent', /consent:\{granted:true,version:CONSENT_VERSION/.test(html));
check('writer split is deterministic', html.includes("fnv1a32-v1:70/10/10/10") && html.includes("deterministic:true"));
check('final holdout is explicitly locked', html.includes("holdoutLocked:split==='final-holdout'"));
check('finger input is rejected', html.includes("e.pointerType!=='pen'"));
check('stored samples are Pencil-labelled', html.includes("pen:true,strokes:"));
check('predicted touches are excluded', html.includes('predictedTouchesStored:false') && html.includes('predictedEvents:false'));
check('coalesced real events are captured', html.includes('getCoalescedEvents'));
check('overlapping coalesced batches cannot regress stroke time', html.includes('if(last&&q.t<last.t)return false'));
check('duplicate coalesced points are rejected', html.includes("q.t===last.t&&q.x===last.x&&q.y===last.y"));
check('drawing is frame-throttled', html.includes('requestAnimationFrame'));
check('stroke redraw is linear, not per-point restroking', /for\(let i=1;i<st\.points\.length;i\+\+\)\{const p=st\.points\[i\];ctx\.lineTo\(p\.x,p\.y\)\}ctx\.stroke\(\)/.test(html));
check('collector schema is at least v5', /collector:\{name:'pri-ink-collect-v2',version:([5-9]|[1-9][0-9]+)/.test(html));

console.log(`\n${failures ? `FAIL — ${failures} collector contract problem(s)` : `PASS — ${pairs.length} prompts and corpus provenance contract verified`}`);
process.exit(failures ? 1 : 0);
