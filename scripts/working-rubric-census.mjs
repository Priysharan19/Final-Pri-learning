import { GENERATORS, loadAllBanks, generateQuestion } from '../client/src/engine/generators/index.js';
import { marksPossibleFor, stepMetaFor } from '../server/platform/markerOps.js';
await loadAllBanks();
const rows=[];
for (const id of Object.keys(GENERATORS)) {
  let multi=0, plan=0, numeric=0, n=0, metaKinds=new Set();
  for (const d of [1,2,3,4]) for (let s=1;s<=6;s++) {
    let q; try { q=generateQuestion(id,d,s*7919+d); } catch { continue; }
    if(!q) continue; n++;
    if (q.answerType!=='numeric') continue; numeric++;
    if (marksPossibleFor(q)<2) continue; multi++;
    const m=stepMetaFor(q); if (m) metaKinds.add(m.kind+(m.chain?':chain':''));
    if (q.stepcheck?.kind==='plan') plan++;
  }
  if (multi) rows.push([id, multi, plan, [...metaKinds].join('|')]);
}
rows.sort((a,b)=>b[1]-a[1]);
console.log('subtopics with multi-mark numeric:', rows.length, 'with plan:', rows.filter(r=>r[2]).length);
for (const r of rows) console.log(r.join('\t'));
