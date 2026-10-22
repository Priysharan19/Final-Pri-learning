import { performance } from 'node:perf_hooks';
import { IN_CHAPTERS } from '../src/engine/curriculum-in.js';
import { buildAtlasGraph } from '../src/atlas/agent2/graphModel.js';
import { overlaps } from '../src/instrument/mapLayout.js';
const ids = [...new Set(IN_CHAPTERS.map(c => c.id))];
const sizes = [10, 20, 40, 80, Math.min(120,ids.length)].filter((x,i,a)=>i===0 || x>a[i-1]);
for(const size of sizes) {
  const samples=[];
  const input={ids:ids.slice(0,size)};
  for(let i=0;i<24;i++) {
    const t0=performance.now();
    const graph=buildAtlasGraph(input);
    const elapsed=performance.now()-t0;
    if(i>3)samples.push(elapsed);
    if(i===0 && size<=40) {
      const conflicts=overlaps(graph.nodes.map(n=>n.box));
      if(conflicts.length) console.log('WARN overlap count',size,conflicts.length);
    }
  }
  samples.sort((a,b)=>a-b);
  console.log(JSON.stringify({nodes:size,medianMs:Number(samples[10].toFixed(2)),p95Ms:Number(samples[19].toFixed(2)),runs:20,environment:'MacBook local Node 24, graph data/model only; not GPU frame rate'}));
}
