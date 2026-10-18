// Wave8: test all eight original figure types as actually rendered, not just source receipts.
// Browser-only synthetic demo, NOT real handwriting provider or physical iPad evidence.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium, webkit } from '@playwright/test';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { loadNotesForGrade } from '../src/notes/notesIndex.js';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const dist=join(root,'dist');
if (!process.argv.includes('--no-build')) {
 const b=spawnSync('npm',['run','build'],{cwd:root,stdio:'inherit'});
 assert.equal(b.status,0,'client must build at exact release SHA');
}
assert.ok(existsSync(join(dist,'index.html')),'build output missing');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
 const safe=normalize(pathname).replace(/^\/+/, '');
 if(safe==='..'||safe.startsWith('..'+sep)){res.writeHead(403).end();return;}
 let file=join(dist,safe);
 if(!existsSync(file)||safe==='') file=join(dist,'index.html');
 try {res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'}).end(await readFile(file));}
 catch {res.writeHead(404).end();}
});
const typesToCheck=['dot-plot','stem-leaf','pie','motion','network','ellipse','two-box','plane'];
const selected=new Map;
let gradeInstances=0,allInstances=0;
for(const group of IN_CURRICULUM){
 const notes=await loadNotesForGrade(group.grade);
 const wave8=(await import('../src/notes/data/notes-visual-wave8-class'+group.grade+'.js')).default;
 for(const [id,part] of Object.entries(wave8)){
  for(const ex of part.examples){
   gradeInstances++;allInstances+=Number(Boolean(ex.figure));
   const kind=ex.figure.type;
   if(!typesToCheck.includes(kind))continue;
   const complete=notes[id].examples;
   const visual=complete.filter(x=>x.figure);
   const position=visual.findIndex(x=>x.question===ex.question);
   assert.ok(position>=0,'Wave8 question lost from full chapter');
   if(!selected.has(kind)||position<selected.get(kind).position){
    selected.set(kind,{kind,grade:group.grade,chapter:id,position,question:ex.question,figure:ex.figure});
   }
  }
 }
}
assert.equal(gradeInstances,600,'exact 600 authored Wave8 investigations expected');
assert.equal(allInstances,600,'every Wave8 investigation must carry an illustration');
assert.equal(selected.size,typesToCheck.length,'some SVG family missing');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const rootUrl='http://127.0.0.1:'+server.address().port;
let checks=0;
try {
 for(const [engineName,engine] of [['Chromium desktop',chromium],['WebKit phone',webkit]]){
  const browser=await engine.launch({headless:true});
  try {
   const page=await browser.newPage({viewport:{width:engineName.includes('phone')?390:1024,height:844},reducedMotion:'reduce'});
   await page.goto(rootUrl+'/',{waitUntil:'domcontentloaded'});
   await page.getByText('Try the demo',{exact:false}).first().click();
   await page.locator('.shell').waitFor({state:'visible',timeout:20000});
   for(const item of selected.values()){
    await page.goto(rootUrl+'/notes/'+item.chapter+'?track=cbse',{waitUntil:'domcontentloaded'});
    const ex=page.locator('.nt-example');
    await ex.first().waitFor({timeout:18000});
    assert.equal(await ex.count(),6,item.kind+': bounded initial mount lost');checks++;
    await page.getByRole('button',{name:'Show illustrated examples'}).click();
    assert.equal(await page.getByRole('button',{name:'Show all worked examples'}).getAttribute('aria-pressed'),'true');checks++;
    const more=page.getByRole('button',{name:'Show more worked examples'});
    while(await ex.count()<=item.position){
      assert.ok(await more.count(),'new figure was hidden with no pagination');checks++;
      await more.click();
    }
    const actual=ex.nth(item.position);
    assert.ok((await actual.innerText()).includes(item.question.split(':')[0]),'wrong Wave8 question rendered');checks++;
    const img=actual.locator('svg[role="img"]');
    assert.equal(await img.count(),1,'SVG figure did not mount');checks++;
    assert.equal(await img.getAttribute('aria-label'),item.figure.description,'SVG screen-reader description lost');checks++;
    const drawable=img.locator('circle,path,ellipse,rect,line,polyline,polygon,text');
    assert.ok(await drawable.count()>=3,'diagram has no meaningful vector geometry');checks++;
    assert.equal(await actual.locator('.nt-steps li').count(),0,'private solution leaked before reveal');checks++;
    await actual.getByRole('button',{name:'Show next step'}).click();
    assert.equal(await actual.locator('.nt-steps li').count(),1,'student cannot reveal first step');checks++;
   }
   await page.close();
  } finally {await browser.close();}
 }
 console.log('WAVE8 CROSS-BROWSER: PASS — '+checks+' assertions, '+selected.size+' Wave8 figure families, 600 imported source investigations, Chromium desktop and WebKit phone');
} finally {await new Promise(resolve=>server.close(resolve));}
