// Pri Learning · Pri Ink V4 structural annotation contract
// Structural supervision must stay explicit, local and trace-addressable.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, '../../tools/ink-annotate-v4/index.html');
const SERVER = join(HERE, '../../scripts/serve-lan.mjs');
const html = readFileSync(FILE, 'utf8');
const server = readFileSync(SERVER, 'utf8');
let failures = 0;
const check = (name, ok) => {
  if (ok) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}`);
};

console.log('\nPri Ink V4 structural annotator contract\n');

check('loads corpus through a local file picker', html.includes('type="file"') && html.includes('await f.text()'));
check('does not upload corpus data', !/\bfetch\s*\(/.test(html) && !/XMLHttpRequest|WebSocket/.test(html));
check('groups reference physical stroke indices', html.includes("symbol,strokes:[...selected]") && html.includes('Stroke ${i} belongs to more than one glyph'));
check('multi-stroke glyph assignment is explicit', html.includes('Select at least one unused physical stroke') && html.includes('Every glyph group needs a symbol'));
check('all strokes are required before completion', html.includes('Assign all physical strokes before validating'));
check('relations use named glyph ids', html.includes("rels.push({from,to,type})") && html.includes('relation references a missing glyph group'));
for (const relation of ['RIGHT','SUPERSCRIPT','SUBSCRIPT','ABOVE','BELOW','NUMERATOR','DENOMINATOR','INSIDE_ROOT']) {
  check(`supports ${relation} relation`, html.includes(relation));
}
check('annotator provenance is versioned', html.includes("pri-ink-structural-v4-v1"));
check('document-level structural annotation metadata is written', html.includes("format:'pri-ink-structural-v4',version:1"));
check('annotated output is downloaded locally', html.includes('new Blob') && html.includes("a.download=fileName"));
check('annotator has a dedicated LAN server mode', server.includes("process.argv.includes('--annotator')") && server.includes("../tools/ink-annotate-v4"));
check('collector and annotator modes cannot collide', server.includes('COLLECTOR && ANNOTATOR'));

console.log(`\n${failures ? `FAIL — ${failures} V4 annotation contract problem(s)` : 'PASS — explicit local trace-to-glyph annotation contract verified'}`);
process.exit(failures ? 1 : 0);
