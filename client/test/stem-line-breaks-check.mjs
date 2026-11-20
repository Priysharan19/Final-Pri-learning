// Pri Learning · a "Line 1 / Line 2 / …" stem renders one step per line.
// Root cause fixed: stems carry "\n\n" between lines, MathText emitted it as plain
// whitespace, and HTML collapsed the lines into one run-on paragraph.
import { breaksToHtml } from '../src/lib/textBreaks.js';
import { makeRng } from '../src/engine/qhelpers.js';

let pass = 0; const fails = [];
const ok = (c, l) => { if (c) pass++; else fails.push(l); };

ok(breaksToHtml('a\n\nb') === 'a<span class="mt-par"></span>b', 'blank line becomes a paragraph break');
ok(breaksToHtml('a\nb') === 'a<br>b', 'single newline becomes <br>');
ok(breaksToHtml('a b') === 'a b', 'no newline is untouched');

// Every generated stem that labels steps must put each label after a newline.
import fs from 'node:fs';
const dir = new URL('../src/engine/generators/', import.meta.url);
const SEEDS = [0x51a10001, 0x51a10002, 0x51a10003, 0x51a10004, 0x51a10005, 0x51a10006, 0x51a10007, 0x51a10008];
let stems = 0; const families = new Set();
for (const file of fs.readdirSync(dir).filter(f => f.endsWith('.js'))) {
  const mod = await import(new URL(file, dir));
  for (const [topic, list] of Object.entries(mod.forms || {})) {
    if (!Array.isArray(list)) continue;
    for (const [idx, form] of list.entries()) {
      const id = `${topic}#${idx}`;
      for (let diff = 1; diff <= 4; diff++) for (const seed of SEEDS) {
        let q; try { q = form.make(makeRng((seed + diff * 7919) >>> 0), diff); } catch { continue; }
        if (!q || typeof q.prompt !== 'string' || !/Line 1\b/.test(q.prompt)) continue;
        stems++; families.add(`${file}/${id}`);
        for (const m of q.prompt.matchAll(/(?:\*\*)?Line (\d+)(?::|\*\*)/g)) {
          if (m.index === 0 || q.prompt.slice(0, m.index).endsWith('\\text{')) continue; // inside an aligned block: \\\\ already breaks it
          ok(/\n[ \t]*$/.test(q.prompt.slice(0, m.index)), `${file}/${id} Line ${m[1]} not on its own line: ${JSON.stringify(q.prompt.slice(Math.max(0, m.index - 25), m.index + 12))}`);
        }
        if (/Which line/.test(q.prompt)) ok(/\n[ \t]*Which line[^\n]*$/.test(q.prompt), `${file}/${id} final question not on its own line`);
      }
    }
  }
}
ok(stems > 20, `sweep reached Line-N stems (${stems})`);
console.log(fails.length ? `STEM LINE BREAKS: FAIL\n  · ${fails.slice(0, 10).join('\n  · ')}` : `STEM LINE BREAKS: PASS — ${pass} checks (${stems} stems, ${families.size} families)`);
process.exit(fails.length ? 1 : 0);
