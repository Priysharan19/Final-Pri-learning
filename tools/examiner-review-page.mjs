#!/usr/bin/env node
// Pri Learning · examiner review page generator
//
// Builds ONE self-contained, OFFLINE html file per jurisdiction from the packet
// (docs/marking/packets/<jurisdiction>/): every item's worked cases, three tap
// targets (A approved · C approved with changes · R rejected) and a note, an
// examiner details block, and two exports that match the decision form:
//   · "Export JSON"  — a DRAFT of the certification record
//                      (docs/marking/certifications/schema.json). It always
//                      carries `draftNotSigned: true`, which the schema forbids, so
//                      tools/verify-examiner-certification.mjs REFUSES it. It also leaves
//                      independence unconfirmed and signedOriginal/recordedBy empty, so it is
//                      refused for those too; a certification is a human act done on the printed,
//                      signed form and recorded by a person, never produced by this page.
//   · "Print / Save as PDF" — the decision form with the examiner's verdicts, notes
//                      and BLANK signature lines. Only the examiner signs.
//
// HARD RULES this generator keeps:
//   · No verdict is ever pre-filled, and the AI pre-review (docs/marking/prereview/)
//     is not read, quoted or linked from the page (to avoid anchoring).
//   · The page sets no certification record and turns nothing on; method marks stay off.
//   · No network request: KaTeX is rendered at generation time and its CSS and fonts are inlined.
//
//   node tools/examiner-review-page.mjs           # writes docs/marking/review/<jurisdiction>.html
//   node tools/examiner-review-page.mjs --check   # fails if a committed page is stale
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'docs/marking/review');
const katex = createRequire(path.join(ROOT, 'client/package.json'))('katex');
const KATEX_DIST = path.join(ROOT, 'client/node_modules/katex/dist');
const JURISDICTIONS = [['nsw-hsc', 'hsc', 'NSW HSC (Prithagoras)'], ['cbse', 'cbse', 'CBSE (Priyabhata)']];

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
/** Text with $…$ maths: rendered by KaTeX now, so the page needs no script to show it. */
function renderMath(text) {
  const parts = String(text).split(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g);
  return parts.map((p, i) => (i % 2 ? katex.renderToString(p.replace(/\\\\/g, '\\'), { throwOnError: false, strict: false }) : esc(p.replace(/\\\$/g, '$')).replace(/`([^`]+)`/g, '<code>$1</code>'))).join('');
}

/** KaTeX's stylesheet with its woff2 fonts inlined as data URIs (one file, no network). */
function katexCss() {
  let css = readFileSync(path.join(KATEX_DIST, 'katex.min.css'), 'utf8');
  css = css.replace(/url\(fonts\/([^)]+?\.woff2)\) format\("woff2"\),url\(fonts\/[^)]+?\.woff\) format\("woff"\),url\(fonts\/[^)]+?\.ttf\) format\("truetype"\)/g,
    (_, f) => `url(data:font/woff2;base64,${readFileSync(path.join(KATEX_DIST, 'fonts', f)).toString('base64')}) format("woff2")`);
  return css;
}

function parsePacket(dir) {
  const items = JSON.parse(readFileSync(path.join(dir, 'items.json'), 'utf8')).items;
  const form = readFileSync(path.join(dir, 'decision-form.md'), 'utf8');
  const cases = readFileSync(path.join(dir, 'worked-cases.md'), 'utf8');
  const what = new Map();
  for (const m of form.matchAll(/^\| \d+ \| `([^`]+)` \| (.*?) \|  \|  \|$/gm)) what.set(m[1], m[2]);
  const sections = new Map();
  for (const m of cases.matchAll(/^## `([^`]+)` — (.*?)\n([\s\S]*?)(?=^## `|\s*$(?![\s\S]))/gm)) {
    const body = m[3];
    const question = (body.match(/^> (.*)$/m) || [])[1] || '';
    const rows = [...body.matchAll(/^\| (correct|alternative|common wrong|partial|[^|]+?) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \| (.*?) \|$/gm)]
      .filter(r => !/^Case$|^---/.test(r[1].trim()))
      .map(r => r.slice(1, 7).map(c => c.trim()));
    sections.set(m[1], { seed: m[2], question, rows });
  }
  return { items, what, sections };
}

const kindOf = id => (id.startsWith('nsw-convention') || id.startsWith('cbse-policy') ? 'Conventions and policy' : /-method:|cbse-rubric|cbse-call/.test(id) ? 'Method rubrics and calls (marks stay off)' : /-final:|cbse-bank/.test(id) ? 'Questions and marking' : 'Other');

function renderItem(id, n, p) {
  const sec = p.sections.get(id);
  const rows = sec ? sec.rows.map(r => `<tr><th>${esc(r[0])}</th><td>${renderMath(r[1].replace(/^`|`$/g, ''))}</td><td>${esc(r[2])}</td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td class="note">${renderMath(r[5])}</td></tr>`).join('') : '';
  return `<article class="item" id="i${n}" data-id="${esc(id)}" data-kind="${esc(kindOf(id))}" tabindex="0">
<header><span class="n">${n}</span><code>${esc(id)}</code><span class="what">${renderMath(p.what.get(id) || '')}</span></header>
${sec ? `<p class="q">${renderMath(sec.question)}</p><p class="seed">sample question, ${esc(String(sec.seed).replace(/^seed\s+/i, 'seed '))}</p>
<table class="cases"><thead><tr><th>Case</th><th>Written</th><th>Engine: correct?</th><th>Final answer only</th><th>With method marks</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="q muted">A rule or policy, not a sample question: judge it against the dossier section named above.</p>'}
<div class="decide"><div class="vb" role="radiogroup" aria-label="Verdict for ${esc(id)}">
<button type="button" data-v="A" aria-pressed="false">A <small>approved</small></button>
<button type="button" data-v="C" aria-pressed="false">C <small>with changes</small></button>
<button type="button" data-v="R" aria-pressed="false">R <small>rejected</small></button></div>
<textarea rows="1" placeholder="Note (required for C and R)" aria-label="Note for ${esc(id)}"></textarea></div></article>`;
}

const CSS = `*{box-sizing:border-box}body{margin:0;font:15px/1.5 Georgia,'Times New Roman',serif;color:#1a1a1a;background:#fbfaf7}
code{font:12.5px ui-monospace,Menlo,monospace;background:#efece4;padding:1px 5px;border-radius:3px}
.bar{position:sticky;top:0;z-index:5;background:#fff;border-bottom:1px solid #d8d4c8;padding:8px 14px;display:flex;gap:14px;align-items:center;flex-wrap:wrap;font:13px system-ui,sans-serif}
.bar progress{width:160px;height:10px}.bar button,.bar select{font:13px system-ui;padding:5px 10px;border:1px solid #b9b4a4;background:#fff;border-radius:4px;cursor:pointer}
.bar .primary{background:#1d3a5f;color:#fff;border-color:#1d3a5f}
main{max-width:980px;margin:0 auto;padding:14px}h1{font-size:22px;margin:8px 0}.banner{border:1px solid #b9b4a4;background:#fff;padding:10px 14px;margin:10px 0;font:13.5px system-ui,sans-serif}
.details{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:8px;margin:10px 0;font:13px system-ui,sans-serif}.details label{display:block}.details input,.details textarea{width:100%;font:13px system-ui;padding:5px;border:1px solid #b9b4a4;border-radius:4px}
.item{background:#fff;border:1px solid #d8d4c8;border-radius:6px;padding:10px 14px;margin:10px 0;scroll-margin-top:60px}.item:focus{outline:2px solid #1d3a5f}
.item header{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.n{font:12px system-ui;color:#777}.what{font:13px system-ui;color:#555}
.q{margin:.5em 0;font-size:16px}.muted{color:#777}.seed{margin:0 0 4px;font:11.5px system-ui;color:#888}
table.cases{border-collapse:collapse;width:100%;font:13px system-ui,sans-serif}table.cases th,table.cases td{border:1px solid #e4e0d4;padding:3px 7px;text-align:left;vertical-align:top}.note{color:#555}
.decide{display:flex;gap:10px;align-items:flex-start;margin-top:8px;flex-wrap:wrap}.vb{display:flex;gap:6px}.vb button{font:600 15px system-ui;min-width:96px;padding:8px 10px;border:1px solid #9d9885;background:#fff;border-radius:5px;cursor:pointer}
.vb small{font-weight:400;font-size:11px;color:#666;display:block}.vb button[aria-pressed=true]{color:#fff}.vb button[data-v=A][aria-pressed=true]{background:#2b6b3a;border-color:#2b6b3a}.vb button[data-v=C][aria-pressed=true]{background:#8a6410;border-color:#8a6410}.vb button[data-v=R][aria-pressed=true]{background:#8e2d2d;border-color:#8e2d2d}.vb button[aria-pressed=true] small{color:#fff}
.decide textarea{flex:1;min-width:220px;font:13px system-ui;padding:6px;border:1px solid #b9b4a4;border-radius:4px}.item.need .decide textarea{border-color:#8e2d2d;background:#fff6f6}
.group{font:600 13px system-ui;letter-spacing:.04em;text-transform:uppercase;color:#555;margin:22px 0 4px;border-bottom:1px solid #d8d4c8}.hide{display:none}
#printform{display:none}@media print{.bar,main>.banner,.details,.item,.group,#msg{display:none!important}#printform{display:block}body{background:#fff;font-size:11pt}#printform table{border-collapse:collapse;width:100%;font-size:9.5pt}#printform th,#printform td{border:1px solid #888;padding:2px 5px;vertical-align:top}.sig{margin-top:22px}.sig div{margin:16px 0}}
@media (prefers-color-scheme:dark){body{background:#15171b;color:#e6e6e3}.bar,.item,.banner{background:#1d2025;border-color:#3a3f48}code{background:#2a2e35}.details input,.details textarea,.decide textarea,.bar button,.bar select,.vb button{background:#23272e;color:#e6e6e3;border-color:#4b515c}.what,.note,.vb small{color:#aab}table.cases th,table.cases td{border-color:#3a3f48}.group{border-color:#3a3f48;color:#aab}}`;

const SCRIPT = `(function(){
var D=JSON.parse(document.getElementById('data').textContent);var KEY='pri-examiner-review:'+D.jurisdiction+':'+D.digest;
var state={};try{state=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}if(!state.items)state.items={};if(!state.who)state.who={};
var items=[].slice.call(document.querySelectorAll('.item'));
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
function paint(el){var id=el.getAttribute('data-id'),s=state.items[id]||{};el.querySelectorAll('.vb button').forEach(function(b){b.setAttribute('aria-pressed',String(s.v===b.getAttribute('data-v')))});var t=el.querySelector('textarea');if(t.value!==(s.note||''))t.value=s.note||'';el.classList.toggle('need',(s.v==='C'||s.v==='R')&&!(s.note||'').trim())}
function counts(){var a=0,c=0,r=0;items.forEach(function(el){var s=state.items[el.getAttribute('data-id')]||{};if(s.v==='A')a++;else if(s.v==='C')c++;else if(s.v==='R')r++});var n=a+c+r;document.getElementById('prog').value=n;document.getElementById('prog').max=items.length;document.getElementById('cnt').textContent=n+' of '+items.length+' decided · A '+a+' · C '+c+' · R '+r;return{a:a,c:c,r:r,n:n}}
function filt(){var f=document.getElementById('filter').value;items.forEach(function(el){var s=state.items[el.getAttribute('data-id')]||{};var show=f==='all'||(f==='open'&&!s.v)||(f==='A'&&s.v==='A')||(f==='C'&&s.v==='C')||(f==='R'&&s.v==='R')||(f==='need'&&(s.v==='C'||s.v==='R')&&!(s.note||'').trim());el.classList.toggle('hide',!show)})}
function set(el,v){var id=el.getAttribute('data-id');var s=state.items[id]||(state.items[id]={});s.v=s.v===v?'':v;paint(el);counts();save();filt()}
items.forEach(function(el){paint(el);el.querySelectorAll('.vb button').forEach(function(b){b.addEventListener('click',function(){set(el,b.getAttribute('data-v'))})});
 el.querySelector('textarea').addEventListener('input',function(e){var id=el.getAttribute('data-id');(state.items[id]||(state.items[id]={})).note=e.target.value;paint(el);save();filt()});
 el.addEventListener('keydown',function(e){if(e.target.tagName==='TEXTAREA')return;var k=e.key.toLowerCase();if(k==='a'||k==='c'||k==='r'){set(el,k.toUpperCase());e.preventDefault()}else if(k==='j'||k==='arrowdown'){var n=el.nextElementSibling;while(n&&!(n.classList.contains('item')&&!n.classList.contains('hide')))n=n.nextElementSibling;if(n){n.focus();e.preventDefault()}}else if(k==='k'||k==='arrowup'){var p=el.previousElementSibling;while(p&&!(p.classList.contains('item')&&!p.classList.contains('hide')))p=p.previousElementSibling;if(p){p.focus();e.preventDefault()}}})});
['name','qualification','affiliation','date','commit','independence','conflicts'].forEach(function(k){var i=document.getElementById('w-'+k);if(!i)return;i.value=state.who[k]||'';i.addEventListener('input',function(){state.who[k]=i.value;save()})});
document.getElementById('filter').addEventListener('change',filt);counts();filt();
function problems(){var p=[];var w=state.who;if(!(w.name||'').trim())p.push('examiner name');if(!(w.qualification||'').trim())p.push('qualification');if(!(w.affiliation||'').trim())p.push('affiliation');if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(w.date||''))p.push('date (YYYY-MM-DD)');if(!/^[0-9a-f]{40}$/.test((w.commit||'').trim()))p.push('repository commit (40 hex characters)');if((w.independence||'').trim().length<20)p.push('your own independence statement (at least 20 characters)');if(!(w.conflicts||'').trim())p.push('conflicts (write none if none)');var c=counts();if(c.n<items.length)p.push((items.length-c.n)+' item(s) without a verdict');items.forEach(function(el){var s=state.items[el.getAttribute('data-id')]||{};if((s.v==='C'||s.v==='R')&&!(s.note||'').trim())p.push('a note for '+el.getAttribute('data-id'))});return p}
function say(t){document.getElementById('msg').textContent=t}
function download(name,text,type){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:type}));a.download=name;document.body.appendChild(a);a.click();a.remove()}
document.getElementById('exj').addEventListener('click',function(){var p=problems();if(p.length&&!confirm('Not complete yet: '+p.slice(0,6).join('; ')+(p.length>6?'; …':'')+'.\\n\\nExport an incomplete draft anyway?'))return;
 var map={A:'approved',C:'approved-with-changes',R:'rejected'},dec={};items.forEach(function(el){var id=el.getAttribute('data-id'),s=state.items[id]||{};if(s.v){var d={verdict:map[s.v]};if((s.note||'').trim())d.notes=s.note.trim();dec[id]=d}});
 var w=state.who;var rec={schemaVersion:1,draftNotSigned:true,jurisdiction:D.jurisdiction,syllabusVersions:D.syllabusVersions,dossierDigest:D.digest,commit:(w.commit||'').trim(),examiners:[{name:(w.name||'').trim(),qualification:(w.qualification||'').trim(),affiliation:(w.affiliation||'').trim(),date:(w.date||'').trim(),independent:false,independenceStatement:(w.independence||'').trim(),conflicts:(w.conflicts||'').trim()}],decisions:dec,signedOriginal:'',recordedBy:''};
 download('examiner-review-'+D.jurisdiction+'-draft.json',JSON.stringify(rec,null,2),'application/json');say('Draft JSON saved. It carries draftNotSigned:true and is NOT a certification record: it is refused by the verifier: it also leaves independence unconfirmed and signedOriginal/recordedBy empty, which only a person completes on the signed form.')});
document.getElementById('pdf').addEventListener('click',function(){var w=state.who;var rows=items.map(function(el,i){var id=el.getAttribute('data-id'),s=state.items[id]||{};return '<tr><td>'+(i+1)+'</td><td><code>'+id.replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</code></td><td>'+(s.v||'')+'</td><td>'+(s.note||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')+'</td></tr>'}).join('');
 var e=function(x){return (x||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')};
 document.getElementById('printform').innerHTML='<h2>'+e(D.title)+' — decision form</h2><p><b>Not yet reviewed by a human examiner until it is signed below.</b> Draft prepared with the offline review page; the signature is the examiner\\'s alone.</p><pre>Jurisdiction: '+e(D.jurisdiction)+'\\nSyllabus version(s): '+e(D.syllabusVersions.join(', '))+'\\nDossier digest reviewed: '+e(D.digest)+'\\nRepository commit reviewed: '+e(w.commit)+'\\nExaminer full name: '+e(w.name)+'\\nQualification: '+e(w.qualification)+'\\nAffiliation: '+e(w.affiliation)+'\\nDate: '+e(w.date)+'\\nConflicts: '+e(w.conflicts)+'\\nIndependence statement (examiner\\'s own words): '+e(w.independence)+'</pre><p>Verdict per item: A approved · C approved with changes · R rejected</p><table><thead><tr><th>#</th><th>Item</th><th>Verdict</th><th>Notes</th></tr></thead><tbody>'+rows+'</tbody></table><div class="sig"><div>Independence statement signed (independence-statement.md): [ ] yes</div><div>Signature: ______________________________________</div><div>Date signed: ______________</div></div>';
 window.print()});
document.getElementById('clr').addEventListener('click',function(){if(confirm('Clear every verdict, note and detail saved in this browser?')){state={items:{},who:{}};save();location.reload()}});
})();`;

function build(jurisdiction, dirName, title) {
  const dir = path.join(ROOT, 'docs/marking/packets', dirName);
  const p = parsePacket(dir);
  const meta = JSON.parse(readFileSync(path.join(dir, 'items.json'), 'utf8'));
  let body = '', n = 0, lastKind = '';
  for (const id of p.items) {
    n += 1;
    const k = kindOf(id);
    if (k !== lastKind) { body += `<h2 class="group">${esc(k)}</h2>`; lastKind = k; }
    body += renderItem(id, n, p);
  }
  const data = { jurisdiction, title, digest: meta.dossierDigest, syllabusVersions: meta.syllabusVersions || [], itemCount: p.items.length };
  const html = `<!doctype html>
<html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Examiner review — ${esc(title)}</title>
<style>${katexCss()}</style><style>${CSS}</style></head><body>
<div class="bar"><strong>${esc(title)}</strong><progress id="prog" value="0" max="${p.items.length}"></progress><span id="cnt"></span>
<select id="filter" aria-label="Show"><option value="all">All items</option><option value="open">Undecided</option><option value="A">A</option><option value="C">C</option><option value="R">R</option><option value="need">C or R without a note</option></select>
<button id="exj" class="primary" type="button">Export JSON (draft)</button><button id="pdf" type="button">Print / Save as PDF</button><button id="clr" type="button">Clear</button></div>
<main><h1>Examiner review — ${esc(title)}</h1>
<div class="banner"><b>Not yet reviewed by a human examiner.</b> This page is generated from the packet in <code>docs/marking/packets/${esc(dirName)}/</code> for dossier digest <code>${esc(meta.dossierDigest || '')}</code>. It fills in no verdict. Tap <b>A</b> (approved as the engine behaves), <b>C</b> (approved with changes: say what) or <b>R</b> (rejected) on each item, or focus an item and press <b>a</b>, <b>c</b> or <b>r</b>; <b>j</b>/<b>k</b> move between items. Your work is saved in this browser only and nothing leaves your computer. Pri does not sign, approve or certify anything: only you can, by signing the printed form. The examiner-certified method rubric stays off until examiners sign a result. Separately, the owner decided on 24 November 2026 that Australian step marks may be paid for question types the author has approved; those are labelled as the author\'s practice marking and are not examiner-certified.</div>
<section class="details" aria-label="Examiner details">
<label>Examiner full name<input id="w-name" autocomplete="off"></label><label>Qualification<input id="w-qualification"></label><label>Affiliation<input id="w-affiliation"></label>
<label>Date (YYYY-MM-DD)<input id="w-date" placeholder="2026-12-01"></label><label>Repository commit reviewed (40 hex characters)<input id="w-commit"></label><label>Conflicts (write “none” if none)<input id="w-conflicts"></label>
<label style="grid-column:1/-1">Your independence statement, in your own words (read independence-statement.md first)<textarea id="w-independence" rows="2"></textarea></label></section>
<p id="msg" role="status"></p>
${body}
</main><div id="printform"></div>
<script type="application/json" id="data">${JSON.stringify(data)}</script><script>${SCRIPT}</script></body></html>
`;
  return html;
}

mkdirSync(OUT, { recursive: true });
let bad = 0;
for (const [jurisdiction, dirName, title] of JURISDICTIONS) {
  const html = build(jurisdiction, dirName, title);
  const file = path.join(OUT, `${jurisdiction}.html`);
  if (process.argv.includes('--check')) {
    let same = false;
    try { same = readFileSync(file, 'utf8') === html; } catch { /* missing */ }
    console.log(`${same ? 'ok   ' : 'STALE'} ${path.relative(ROOT, file)}`);
    if (!same) bad += 1;
  } else {
    writeFileSync(file, html);
    console.log(`wrote ${path.relative(ROOT, file)} — ${(html.length / 1024).toFixed(0)} kB`);
  }
}
if (process.argv.includes('--check')) { console.log(bad ? 'EXAMINER REVIEW PAGE: FAIL — run node tools/examiner-review-page.mjs' : 'EXAMINER REVIEW PAGE: PASS — the committed pages match the packets'); process.exit(bad ? 1 : 0); }
