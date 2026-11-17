const { chromium } = await import(new URL('../../../client/node_modules/@playwright/test/index.mjs', import.meta.url).href);
const { mkdirSync, writeFileSync } = await import('node:fs');
const R='/Users/priysharantripathi/Developer/Final-Pri-learning/.claude/worktrees/modest-gauss-acbf10';
const { startOnlinePlatform } = await import(R+'/client/test/support/online-session.mjs');
const { createVerifiedProfile } = await import(R+'/client/test/support/verified-onboarding.mjs');
const OUT = R+'/docs/qa/2026-11-18/shots'; mkdirSync(OUT,{recursive:true});
const server = await startOnlinePlatform();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:1100,height:900}, deviceScaleFactor:1 });
const page = await ctx.newPage(); page.setDefaultTimeout(30000);
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.goto(server.origin,{waitUntil:'domcontentloaded'});
await createVerifiedProfile(page, server, { name:'QA Student', year:12, course:'in' });
await page.goto(server.origin+'/notes',{waitUntil:'domcontentloaded'});
await page.waitForSelector('[data-testid="notes-chapter"]');
const ids = await page.evaluate(()=>[...document.querySelectorAll('[data-testid="notes-chapter"]')].map(a=>a.getAttribute('href')||a.querySelector('a')?.getAttribute('href')));
console.log('chapters', ids.length, ids.slice(0,3));
const findings=[];
for (const href of ids.filter(Boolean)) {
  await page.goto(server.origin+href,{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(500);
  await page.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=500){window.scrollTo(0,y);await new Promise(r=>setTimeout(r,25));}});
  const r = await page.evaluate(()=>{
    const out={katexErr:document.querySelectorAll('.katex-error').length, hOverflow:document.documentElement.scrollWidth>innerWidth+1, uni:[], textOverlap:[]};
    const RE=/[\u2713\u2714\u2715\u2716\u2717\u2718\u00b2\u00b3\u2070-\u2079\u2192]/;
    const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    for(let n=w.nextNode();n;n=w.nextNode()){ if(n.parentElement.closest('.katex-mathml,script,style,[aria-hidden=true] .katex-mathml')) continue; if(RE.test(n.nodeValue)) out.uni.push(n.nodeValue.trim().slice(0,70)+' <'+n.parentElement.className+'>'); }
    for(const svg of document.querySelectorAll('figure svg')){ const fo=[...svg.querySelectorAll('foreignObject')].map(f=>f.getBoundingClientRect()); for(let i=0;i<fo.length;i++)for(let j=i+1;j<fo.length;j++){const A=fo[i],B=fo[j]; const ox=Math.min(A.right,B.right)-Math.max(A.left,B.left), oy=Math.min(A.bottom,B.bottom)-Math.max(A.top,B.top); if(ox>6&&oy>6) out.textOverlap.push((svg.closest('figure').querySelector('figcaption')?.innerText||svg.getAttribute('aria-label')||'?').slice(0,40));}}
    return out;});
  const slug = href.split('/').pop();
  const figs = await page.$$('[data-diagram], [data-diagram-interactive], .nt-diagram, svg[role=img]');
  for (let i = 0; i < figs.length; i++) {
    await figs[i].screenshot({ path: OUT + '/fig-' + slug + '-' + String(i + 1).padStart(2, '0') + '.png' }).catch(() => {});
  }
  r.figures = figs.length;
  if (r.katexErr||r.hOverflow||r.uni.length||r.textOverlap.length) findings.push({href,...r});
}
writeFileSync(R+'/docs/qa/2026-11-18/notes-sweep.json', JSON.stringify({total:ids.length,findings,errs},null,1));
console.log(JSON.stringify({total:ids.length,bad:findings.length,errs:errs.slice(0,5)}));
await browser.close(); process.exit(0);
