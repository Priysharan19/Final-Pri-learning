// Independent browser smoke for the live Notes surface. Source-count tests
// cannot certify a rendered figure, a hidden answer or a functional tablet UI.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { chromium, webkit } from '@playwright/test';
const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const dist=join(root,'dist');
if(!process.argv.includes('--no-build')) {
  const b=spawnSync('npm',['run','build'],{cwd:root,stdio:'inherit'});
  assert.equal(b.status,0,'current client build must pass');
}
assert.ok(existsSync(join(dist,'index.html')),'built client missing');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.webmanifest':'application/manifest+json'};
const server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const safe=normalize(pathname).replace(/^\/+/, '');
  if(safe==='..'||safe.startsWith('..'+sep)){res.writeHead(403).end();return;}
  let file=join(dist,safe);
  if(!existsSync(file)||safe==='')file=join(dist,'index.html');
  try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream'}).end(bytes);}
  catch{res.writeHead(404).end();}
});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const url='http://127.0.0.1:'+server.address().port;
const chapters=['c7-triangles-current','c10-triangles','c12-vector-algebra'];
let checks=0;
try {
for(const [name,engine] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await engine.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:name==='webkit'?390:1024,height:844},reducedMotion:'reduce'});
  await page.goto(url+'/',{waitUntil:'domcontentloaded'});
  await page.getByText('Try the demo',{exact:false}).first().click();
  await page.getByText('Good morning, Pri.',{exact:false}).first().waitFor({timeout:20000});
  for(const id of chapters){
   await page.goto(url+'/notes/'+id+'?track=cbse',{waitUntil:'domcontentloaded'});
   await page.locator('.nt-example').first().waitFor({timeout:18000});
   const a=page.locator('.nt-example');
   assert.equal(await a.count(),6, name+' '+id+': too many figures mounted initially');checks++;
   const show=page.getByRole('button',{name:'Show more worked examples'});
   assert.equal(await show.count(),1,'accessible incremental pagination absent');checks++;
   await show.click();
   assert.equal(await a.count(),12,name+' '+id+': load-more failed');checks++;
   const rendered=page.locator('.nt-example').filter({has:page.locator('svg[role="img"]')});
   assert.ok(await rendered.count()>0,name+' '+id+': original diagram not drawn');checks++;
   const ex=rendered.first(),svg=ex.locator('svg[role="img"]').first();
   assert.ok(await svg.locator('title').count()||await svg.getAttribute('aria-label'), 'image has no accessible name');checks++;
   assert.equal(await ex.locator('.nt-steps li').count(),0,'solved maths leaked before reveal');checks++;
   await ex.getByRole('button',{name:'Show next step'}).click();
   assert.equal(await ex.locator('.nt-steps li').count(),1,'first worked step not revealed');checks++;
   const shelf=page.locator('[data-testid="notes-study-resources"]');
   assert.ok(await shelf.count()>0,'external resources missing');checks++;
   assert.ok((await page.locator('body').innerText()).toLowerCase().includes('external study references'), 'resource title not meaningful: '+(await page.locator('#resources').innerText()).slice(0,100));checks++;
   const links=await shelf.locator('a').evaluateAll(as=>as.map(a=>({href:a.href,rel:a.rel,target:a.target})));
   assert.ok(links.every(a=>a.href.startsWith('https://')&&a.rel.includes('noopener')&&a.rel.includes('noreferrer')&&a.target==='_blank'),'unsafe reference navigation');checks++;
  }
  await page.close();
 } finally {await browser.close();}
}
console.log('NOTES VISUAL BROWSER: PASS — '+checks+' assertions across 3 chapters, Chromium desktop and WebKit phone; bounded diagram rendering, accessible vectors, withheld solutions, reveal and safe references');
} finally {await new Promise(ok=>server.close(ok));}
