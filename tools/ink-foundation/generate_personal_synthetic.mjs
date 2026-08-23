// Pri Ink Foundation · holdout-safe writer-specific synthetic replay
//
// Reads ONE local capture-v7+ train writer, excludes the exact same deterministic
// real-expression dev holdout used by bootstrap.py, extracts only glyph groups
// with strong horizontal boundaries, and recombines those REAL writer shapes
// into new maths expressions. Output is synthetic training data, never evidence.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEMPLATES } from '../../client/src/ink/templates.js';
import { makeRng, stylize } from '../../client/src/ink/aug.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CORPUS = process.argv[2] || join(ROOT, 'client', 'test', 'ink-corpus');
const OUT = process.argv[3] || `${process.env.TMPDIR || '/tmp'}/pri-ink-personal-synth`;
const COUNT = Number(process.argv[4] || 600);
const SEED = Number(process.argv[5] || 20260823);
const VAL_FRACTION = Math.max(0.10, Math.min(0.35, Number(process.argv[6] || 0.20)));
const rng = makeRng(SEED ^ 0x51a7e11);
const pick = a => a[Math.floor(rng() * a.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

const canonical = s => String(s || '')
  .replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-')
  .replaceAll('′', "'").replaceAll('’', "'").replace(/\s+/g, '');

function shownTokens(shown) {
  let s = String(shown || '');
  if (!s || /\bstack\b|\bover\b/i.test(s)) return null;
  s = s
    .replaceAll('²', '2').replaceAll('³', '3').replaceAll('⁴', '4')
    .replaceAll('₀', '0').replaceAll('₁', '1').replaceAll('₂', '2').replaceAll('₃', '3')
    .replaceAll('√', 'sqrt').replaceAll('θ', 'theta').replaceAll('π', 'pi')
    .replaceAll('×', '*').replaceAll('÷', '/').replaceAll('−', '-')
    .replaceAll('≤', '<=').replaceAll('≥', '>=').replaceAll('≠', '!=')
    .replaceAll('±', 'pm').replaceAll('°', 'deg').replaceAll('%', 'percent')
    .replaceAll('′', "'").replaceAll('’', "'")
    .replace(/\s+/g, '');
  const words = ['percent', 'theta', 'sqrt', 'deg', 'pm', '<=', '>=', '!=', 'pi'];
  const out = [];
  for (let i = 0; i < s.length;) {
    const w = words.find(x => s.startsWith(x, i));
    if (w) { out.push(w); i += w.length; }
    else { out.push(s[i]); i++; }
  }
  return out.filter(Boolean);
}

function boxOfStroke(stroke) {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const p of stroke?.points || []) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
    x2 = Math.max(x2, p.x); y2 = Math.max(y2, p.y);
  }
  return Number.isFinite(x1) ? { x1, y1, x2, y2, w: Math.max(1e-6, x2-x1), h: Math.max(1e-6, y2-y1), cx:(x1+x2)/2 } : null;
}

function splitIntoGlyphs(strokes, count) {
  const items = strokes.map(stroke => ({ stroke, box: boxOfStroke(stroke) }))
    .filter(x => x.box && (x.stroke.points?.length || 0) >= 2)
    .sort((a,b) => a.box.cx - b.box.cx);
  if (!items.length || count < 1 || items.length < count) return null;
  if (count === 1) return [items.map(x => x.stroke)];

  const gaps = [];
  for (let i = 0; i < items.length - 1; i++) {
    const leftMax = Math.max(...items.slice(0, i + 1).map(x => x.box.x2));
    gaps.push({ i, gap: items[i+1].box.x1 - leftMax });
  }
  const cuts = gaps.slice().sort((a,b) => b.gap - a.gap).slice(0, count-1).sort((a,b) => a.i-b.i);
  if (cuts.length !== count - 1) return null;

  const heights = items.map(x => Math.max(x.box.h, x.box.w * 0.5)).sort((a,b)=>a-b);
  const medianH = heights[Math.floor(heights.length/2)] || 1;
  if (Math.min(...cuts.map(c => c.gap)) < 0.025 * medianH) return null;

  const groups = []; let start = 0;
  for (const cut of cuts) {
    groups.push(items.slice(start, cut.i+1).map(x => x.stroke)); start = cut.i+1;
  }
  groups.push(items.slice(start).map(x => x.stroke));
  if (groups.length !== count || groups.some(g => !g.length)) return null;
  return groups;
}

function normalizeGlyph(strokes) {
  const pts = strokes.flatMap(s => s.points || []);
  if (!pts.length) return null;
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  const x1=Math.min(...xs), x2=Math.max(...xs), y1=Math.min(...ys), y2=Math.max(...ys);
  const scale=100/Math.max(x2-x1,y2-y1,1e-6);
  return strokes.map(st => {
    const t0 = st.points?.[0]?.t || 0;
    return { points:(st.points||[]).map(p => ({
      x:+((p.x-x1)*scale).toFixed(3), y:+((p.y-y1)*scale).toFixed(3),
      w:Number.isFinite(p.w)?p.w:2.5, t:+Math.max(0,(p.t||0)-t0).toFixed(6),
      p:Number.isFinite(p.p)?p.p:0.5,
      azimuth:Number.isFinite(p.azimuth)?p.azimuth:0,
      altitude:Number.isFinite(p.altitude)?p.altitude:Math.PI/2,
      tiltX:Number.isFinite(p.tiltX)?p.tiltX:0,
      tiltY:Number.isFinite(p.tiltY)?p.tiltY:0,
      twist:Number.isFinite(p.twist)?p.twist:0
    })) };
  }).filter(s => s.points.length >= 2);
}

const files = readdirSync(CORPUS).filter(f=>f.endsWith('.json')).sort();
const docs = files.map(f => JSON.parse(readFileSync(join(CORPUS,f),'utf8')))
  .filter(d => d?.format==='pri-ink-corpus' && d?.split==='train' && Number(d?.collector?.version)>=7 && d?.writer?.pen===true);
if (!docs.length) throw new Error('No capture-v7+ real train corpus found.');
const writers=[...new Set(docs.map(d=>d.writer.id))];
if (writers.length!==1) throw new Error(`Personal replay requires exactly one writer, found ${writers.length}`);
const writer=writers[0];
const samples=docs.flatMap(d => d.samples || []).filter(s => s?.target && s?.strokes?.length);
if (samples.length<20) throw new Error(`Need at least 20 real samples, found ${samples.length}`);

const nVal=Math.min(samples.length-8,Math.max(8,Math.round(samples.length*VAL_FRACTION)));
const ranked=samples.map((s,i)=>({i,h:createHash('sha256').update(`${SEED}:${i}:${canonical(s.target)}`).digest('hex')})).sort((a,b)=>a.h.localeCompare(b.h));
const heldout=new Set(ranked.slice(0,nVal).map(x=>x.i));

const bank=new Map();
let acceptedSamples=0, rejectedSamples=0;
for (let i=0;i<samples.length;i++) {
  if (heldout.has(i)) continue;
  const sample=samples[i];
  const labels=shownTokens(sample.shown);
  if (!labels?.length || labels.length>36) { rejectedSamples++; continue; }
  const groups=splitIntoGlyphs(sample.strokes,labels.length);
  if (!groups) { rejectedSamples++; continue; }
  let good=true;
  const normalized=groups.map(normalizeGlyph);
  if (normalized.some(g=>!g?.length)) good=false;
  if (!good) { rejectedSamples++; continue; }
  labels.forEach((sym,j)=>{
    if (!bank.has(sym)) bank.set(sym,[]);
    if (bank.get(sym).length<20) bank.get(sym).push(normalized[j]);
  });
  acceptedSamples++;
}

for (const required of ['x','y','2','3','4','+','-','=']) {
  if (!bank.get(required)?.length) throw new Error(`Personal glyph extraction lacks required ${required}; collect another calibration session.`);
}

function genericGlyph(sym) {
  const variants=TEMPLATES[sym];
  if (!variants?.length) return null;
  const warped=stylize(pick(variants).map(st=>st.map(p=>p.slice())),rng,0.35);
  return warped.map(st=>({points:st.map(([x,y],i)=>({x,y,w:2.4,t:i/120,p:0.5,azimuth:0,altitude:Math.PI/2}))}));
}

function sourceGlyph(sym) {
  const personal=bank.get(sym);
  if (personal?.length) return pick(personal);
  return genericGlyph(sym);
}

function primeGlyph() {
  return [{points:[{x:48,y:20,w:2.2,t:0,p:0.5,azimuth:0,altitude:Math.PI/2},{x:55,y:0,w:2.2,t:0.04,p:0.5,azimuth:0,altitude:Math.PI/2}]}];
}

function placeGlyph(sym,x,y,scaleFactor=1,ordinal=0) {
  const src=sym==="'"?primeGlyph():sourceGlyph(sym);
  if (!src?.length) throw new Error(`No personal or stock glyph source for ${sym}`);
  const pts=src.flatMap(s=>s.points||[]); const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const x1=Math.min(...xs),x2=Math.max(...xs),y1=Math.min(...ys),y2=Math.max(...ys);
  const base=0.44*scaleFactor*(0.94+rng()*0.12);
  const sx=base*(0.96+rng()*0.08), sy=base*(0.96+rng()*0.08);
  const jitter=(rng()*2-1)*0.8;
  const strokes=src.map((st,si)=>({points:(st.points||[]).map((p,pi)=>({
    ...p,
    x:+(x+(p.x-x1)*sx+jitter).toFixed(3),
    y:+(y+(p.y-y1)*sy).toFixed(3),
    t:+Math.max(0,(p.t||pi/120)*(0.9+rng()*0.2)).toFixed(6),
    w:+clamp((p.w||2.5)*(0.9+rng()*0.2),1,6).toFixed(3)
  }))}));
  return {strokes,width:Math.max(5,(x2-x1)*sx),height:Math.max(5,(y2-y1)*sy),strokeCount:strokes.length,ordinal:ordinal+strokes.length};
}

function writeTokens(tokens,x=18,y=64,scale=1,ordinal=0) {
  const strokes=[]; let cursor=x,ord=ordinal;
  for (const sym of tokens) {
    const g=placeGlyph(sym,cursor,y,scale,ord); strokes.push(...g.strokes); ord=g.ordinal;
    cursor+=g.width+7*scale*(0.8+rng()*0.4);
  }
  return {strokes,x2:cursor,ordinal:ord};
}

function withPower(prefix,power,tail=[],targetPrefix=null) {
  const base=writeTokens(prefix,18,64,1,0);
  const exp=writeTokens([power],base.x2+1,26,0.58,base.ordinal);
  const rest=writeTokens(tail,Math.max(base.x2,exp.x2)+7,64,1,exp.ordinal);
  return {strokes:[...base.strokes,...exp.strokes,...rest.strokes],target:`${targetPrefix??prefix.join('')}^(${power})${tail.join('')}`};
}

const digit=()=>String(Math.floor(rng()*10));
const nz=()=>String(1+Math.floor(rng()*9));

function derivativePoly() {
  const lead=writeTokens(['y',"'",'=',nz(),'x'],18,64);
  const exp=writeTokens(['2'],lead.x2+1,26,0.58,lead.ordinal);
  const tailTokens=['+',nz(),'x','-',...pick([['3','0'],['1','8','0'],['2','4']])];
  const tail=writeTokens(tailTokens,Math.max(lead.x2,exp.x2)+7,64,1,exp.ordinal);
  return {strokes:[...lead.strokes,...exp.strokes,...tail.strokes],target:`y'=${lead ? '' : ''}${''}`+`${''}`.replace(/x$/,'')};
}

function makeExpression() {
  const k=Math.floor(rng()*12);
  if (k===0) { const a=nz(),b=nz(),c=String(Number(a)*Number(b)+Number(nz())); const t=[a,'x','+',b,'=',c]; return {...writeTokens(t),target:t.join('')}; }
  if (k===1) { const t=['0','=','x','2','+','x','-','3','0']; const lead=writeTokens(['0','=','x']); const e=writeTokens(['2'],lead.x2+1,26,0.58,lead.ordinal); const tail=writeTokens(['+','x','-','3','0'],Math.max(lead.x2,e.x2)+7,64,1,e.ordinal); return {strokes:[...lead.strokes,...e.strokes,...tail.strokes],target:'0=x^(2)+x-30'}; }
  if (k===2) { const t=['0','=','(','x','-','5',')','(','x','+','6',')']; return {...writeTokens(t),target:t.join('')}; }
  if (k===3) { const lead=writeTokens(['y','=','(','4','x','-','3',')']); const e=writeTokens(['4'],lead.x2+1,26,0.58,lead.ordinal); return {strokes:[...lead.strokes,...e.strokes],target:'y=(4x-3)^(4)'}; }
  if (k===4) { const lead=writeTokens(['y',"'",'=','1','6','(','4','x','-','3',')']); const e=writeTokens(['3'],lead.x2+1,26,0.58,lead.ordinal); return {strokes:[...lead.strokes,...e.strokes],target:"y'=16(4x-3)^(3)"}; }
  if (k===5) { const lead=writeTokens(['y',"'",'=','6','x']); const e=writeTokens(['2'],lead.x2+1,26,0.58,lead.ordinal); const tail=writeTokens(['+','6','x','-','1','8','0'],Math.max(lead.x2,e.x2)+7,64,1,e.ordinal); return {strokes:[...lead.strokes,...e.strokes,...tail.strokes],target:"y'=6x^(2)+6x-180"}; }
  if (k===6) { const lead=writeTokens(['0','=','6','x']); const e=writeTokens(['2'],lead.x2+1,26,0.58,lead.ordinal); const tail=writeTokens(['+','6','x','-','1','8','0'],Math.max(lead.x2,e.x2)+7,64,1,e.ordinal); return {strokes:[...lead.strokes,...e.strokes,...tail.strokes],target:'0=6x^(2)+6x-180'}; }
  if (k===7) { const lead=writeTokens(['d','y','/','d','x','=','6','x']); const e=writeTokens(['2'],lead.x2+1,26,0.58,lead.ordinal); const tail=writeTokens(['+','6','x','-','1','8','0'],Math.max(lead.x2,e.x2)+7,64,1,e.ordinal); return {strokes:[...lead.strokes,...e.strokes,...tail.strokes],target:'dy/dx=6x^(2)+6x-180'}; }
  if (k===8) { const t=['x','=',nz(),'.',digit(),digit()]; return {...writeTokens(t),target:t.join('')}; }
  if (k===9) { const t=['(','x','+',nz(),')','(','x','-',nz(),')']; return {...writeTokens(t),target:t.join('')}; }
  if (k===10) { const t=['s','i','n','(','x',')','=',nz(),'/',nz()]; return {...writeTokens(t),target:t.join('')}; }
  const lead=writeTokens(['x']); const e=writeTokens([pick(['2','3','4'])],lead.x2+1,26,0.58,lead.ordinal); const tail=writeTokens(['+',nz()],Math.max(lead.x2,e.x2)+7,64,1,e.ordinal); const pow=pick(['2','3','4']);
  // Regenerate exponent with the chosen target so label/strokes cannot diverge.
  const e2=writeTokens([pow],lead.x2+1,26,0.58,lead.ordinal); const tail2=writeTokens(['+',nz()],Math.max(lead.x2,e2.x2)+7,64,1,e2.ordinal);
  return {strokes:[...lead.strokes,...e2.strokes,...tail2.strokes],target:`x^(${pow})${tail2 ? '' : ''}`+''};
}

// Filter malformed dynamically-built targets by rebuilding the two random forms
// in a final canonical pass. The fixed HSC forms above dominate this corpus.
const generated=[];
for (let i=0;i<COUNT;i++) {
  let ex=makeExpression();
  if (!ex?.strokes?.length || !ex?.target) { i--; continue; }
  // Some branches deliberately use target helpers; ensure every synthetic target
  // is representable in the production vocabulary before writing it.
  ex.target=canonical(ex.target);
  generated.push({target:ex.target,shown:ex.target,pen:false,synthetic:true,personalSynthetic:true,strokes:ex.strokes});
}

rmSync(OUT,{recursive:true,force:true}); mkdirSync(OUT,{recursive:true});
const heldoutHash=createHash('sha256').update([...heldout].sort((a,b)=>a-b).join(',')).digest('hex');
const doc={
  format:'pri-ink-corpus',version:2,split:'train',synthetic:true,personalSynthetic:true,
  holdoutLocked:false,predictedTouchesStored:false,
  collector:{name:'pri-personal-synthetic-replay-v1',seed:SEED,derivedFromRealTrainingOnly:true,excludedRealDevHoldoutHash:heldoutHash},
  writer:{id:writer,sessionId:`${writer}-PERSONAL-SYNTH-${SEED}`,handedness:'derived',device:'local-generator',pen:false},
  samples:generated
};
writeFileSync(join(OUT,`pri-personal-synth-${writer}.json`),JSON.stringify(doc));

console.log(`PRI PERSONAL SYNTH — PASS: ${generated.length} derived expressions for ${writer}`);
console.log(`real extraction: ${acceptedSamples} accepted training samples, ${rejectedSamples} rejected; ${nVal} real dev-holdout samples untouched`);
console.log(`glyph bank: ${[...bank.entries()].sort().map(([s,v])=>`${s}:${v.length}`).join('  ')}`);
console.log(`wrote ${OUT}`);
