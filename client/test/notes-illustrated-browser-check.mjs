// Independent browser smoke for the live Notes surface. Source-count tests
// cannot certify a rendered figure, a hidden answer or a functional tablet UI.
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium, webkit } from '@playwright/test';
import { IN_CURRICULUM } from '../src/engine/curriculum-in.js';
import { loadNotesForGrade } from '../src/notes/notesIndex.js';
import { startOnlinePlatform } from './support/online-session.mjs';
import { createVerifiedProfile } from './support/verified-onboarding.mjs';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const dist=join(root,'dist');
if(!process.argv.includes('--no-build')) {
  const b=spawnSync('npm',['run','build'],{cwd:root,stdio:'inherit'});
  assert.equal(b.status,0,'current client build must pass');
}
assert.ok(existsSync(join(dist,'index.html')),'built client missing');
// The built app is served by the real platform server from one origin: the
// app opens for nobody without a verified account (issue #477), and the
// student here enters through the landing card (email delivery: the server's
// TEST adapter, read at the test desk).
const platform=await startOnlinePlatform({ dist });
const url=platform.origin;
// Two high-diagram chapters from EVERY grade: cover graphics, data, geometry,
 // trigonometry, distributions, and probability on desktop and Apple WebKit.
const chapters=[
 'c7-triangles-current','c7-number-play-current',
 'c8-data-handling','c8-mensuration',
 'c9-coordinate-geometry','c9-probability',
 'c10-triangles','c10-statistics',
 'c11-trig-functions','c11-relations-functions',
 'c12-vector-algebra','c12-probability'
];
const exhaustive=process.argv.includes('--all-chapters');
const selected=exhaustive ? IN_CURRICULUM.flatMap(group=>group.chapters.map(ch=>ch.id)) : chapters;
const available=new Map();
if(exhaustive){
 for(const group of IN_CURRICULUM) {
  const notes=await loadNotesForGrade(group.grade);
  for(const ch of group.chapters)available.set(ch.id,notes[ch.id].examples.length);
 }
 assert.equal(selected.length,77,'all-chapter sweep must cover every official app chapter');
}
let checks=0;
try {
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:name==='webkit'?390:1024,height:844},reducedMotion:'reduce'});
  await page.goto(url+'/',{waitUntil:'domcontentloaded'});
  await createVerifiedProfile(page,platform,{name:'Illustrated Notes Learner',year:12,landing:'practice'});
  await page.locator('.shell').waitFor({state:'visible',timeout:20000});
  for(const id of selected){
   await page.goto(url+'/notes/'+id+'?track=cbse',{waitUntil:'domcontentloaded'});
   await page.locator('.nt-example').first().waitFor({timeout:18000});
   const a=page.locator('.nt-example');
   const total=available.get(id) ?? 12;
   assert.equal(await a.count(),Math.min(6,total), name+' '+id+': too many figures mounted initially');checks++;
   const show=page.getByRole('button',{name:'Show more worked examples'});
   assert.equal(await show.count(),total>6?1:0,'accessible pagination state inconsistent');checks++;
   if(total>6)await show.click();
   assert.equal(await a.count(),Math.min(12,total),name+' '+id+': load-more failed');checks++;
   // Some valuable visual investigations (e.g. Class 11 complex numbers) begin
   // far beyond the introductory worked examples. Test the actual discovery filter.
   const illustrate=page.getByRole('button',{name:'Show illustrated examples'});
   assert.equal(await illustrate.count(),1,'visual discovery filter missing');checks++;
   await illustrate.click();
   assert.equal(await page.getByRole('button',{name:'Show all worked examples'}).getAttribute('aria-pressed'),'true','illustrated-only action must report pressed state');checks++;
   const rendered=page.locator('.nt-example').filter({has:page.locator('svg[role="img"]')});
   assert.ok(await rendered.count()>0,name+' '+id+': original diagram not drawn');checks++;
   assert.equal(await rendered.count(),await a.count(),name+' '+id+': nonvisual example leaked through filter');checks++;
   const ex=rendered.first(),svg=ex.locator('svg[role="img"]').first();
   assert.ok(await svg.locator('title').count()||await svg.getAttribute('aria-label'), 'image has no accessible name');checks++;
   assert.equal(await ex.locator('.nt-steps li').count(),0,'solved maths leaked before reveal');checks++;
   await ex.getByRole('button',{name:'Show next step'}).click();
   assert.equal(await ex.locator('.nt-steps li').count(),1,'first worked step not revealed');checks++;
   await page.getByRole('button',{name:'Show all worked examples'}).click();
   assert.equal(await a.count(),Math.min(6,total),'switching back must restore the bounded all-examples list');checks++;
   if(id==='c11-complex-numbers'){
     assert.equal(await a.first().locator('.nt-steps li').count(),0,'filtered solution steps leaked into a different complex-number question');checks++;
   }
   const shelf=page.locator('[data-testid="notes-study-resources"]');
   assert.ok(await shelf.count()>0,'external resources missing');checks++;
   assert.ok((await page.locator('body').innerText()).toLowerCase().includes('external study references'), 'resource title not meaningful: '+(await page.locator('#resources').innerText()).slice(0,100));checks++;
   const links=await shelf.locator('a').evaluateAll(as=>as.map(a=>({href:a.href,rel:a.rel,target:a.target})));
   assert.ok(links.every(a=>a.href.startsWith('https://')&&a.rel.includes('noopener')&&a.rel.includes('noreferrer')&&a.target==='_blank'),'unsafe reference navigation');checks++;
  }
  await page.close();
 } finally {await browser.close();}
}
console.log('NOTES VISUAL BROWSER: PASS — '+checks+' assertions across '+selected.length+' chapters spanning Classes 7–12, Chromium desktop and WebKit phone; bounded diagram rendering, accessible vectors, withheld solutions, reveal and safe references');
} finally {await platform.close();}
