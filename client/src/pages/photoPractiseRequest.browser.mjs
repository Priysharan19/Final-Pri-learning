import { pathToFileURL } from 'node:url';
// Browser-mounted synthetic recognition race. No live OCR or physical evidence.
// Browser-generated valid mathematical image avoids WebKit's strict rejection
// of the legacy 1x1 PNG fixture; it is synthetic and contains no student data.
async function makeImage(page) {
 const encoded=await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=640;c.height=300;
   const ctx=c.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,640,300);
   ctx.fillStyle='#111';ctx.font='30px sans-serif';
   ctx.fillText('y = 2x + 3',25,60);ctx.fillText('x^2 - 5x + 6 = 0',25,135);
   ctx.fillText('sqrt(16) / 2 = 2',25,210);
   return c.toDataURL('image/png');
 });
 return Buffer.from(encoded.split(',')[1],'base64');
}
const candidate = { chapterId:'c10-quadratic-equations', chapterName:'Quadratic Equations', grade:10, skillId:'c10-quadratic-discriminant', dotpoint:2, confidence:.93 };
export const flow = {
 id:'photo-latest-only', name:'Photo: replacement wins, recognition failure recovers',
 async run({page,ctx,base,goto,createProfile,check}) {
   // Isolate the Photo race: production service-worker installation is covered
   // separately by QA. WebKit routes a controlled page's request outside
   // Playwright network mocks; LAN research mode prevents that SW test leak.
   await page.addInitScript(origin=>{window.__PRI_CLOUD_ORIGIN__=origin;window.__PRI_LAN_DEV__=true},base);
   let requests=0;
   await ctx.route('**/v1/**',async route=>{
     const url=new URL(route.request().url());
     if(url.pathname!=='/v1/question-photo/identify') return route.fulfill({status:404,contentType:'application/json',body:'{"error":{"code":"NOT_FOUND"}}'}).catch(()=>{});
     const k=++requests;
     if(k===1) await new Promise(r=>setTimeout(r,1900));
     if(k===3) return route.fulfill({status:503,contentType:'application/json',body:'{"error":{"code":"QUESTION_PHOTO_PROVIDER_5XX","message":"down"}}'}).catch(()=>{});
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({identification:{
       isMathsQuestion:true,readable:true,questionText:k===1?'OLD PHOTO TRANSCRIPT':'NEW PHOTO TRANSCRIPT',
       candidates:[candidate],needsConfirmation:true
     }})}).catch(()=>{});
   });
   await goto('/');
   await createProfile({name:'Synthetic Photo QA Student',year:10,course:'in'});
   await goto('/practise-photo');
   const file=page.locator('[data-photo-practise-input]');
   const IMG=await makeImage(page);
   await file.setInputFiles({name:'one.png',mimeType:'image/png',buffer:IMG});
   for(let n=0;n<80&&requests<1;n++)await page.waitForTimeout(40);
   await check('first identification actually reached server',requests===1,String(requests));
   await file.setInputFiles({name:'two.png',mimeType:'image/png',buffer:IMG});
   await page.waitForSelector('[data-photo-practise-question]',{timeout:15000});
   let txt=await page.locator('[data-photo-practise-question]').innerText();
   await check('latest photo wins',txt==='NEW PHOTO TRANSCRIPT',txt);
   await page.waitForTimeout(2200);
   txt=await page.locator('[data-photo-practise-question]').innerText();
   await check('late older provider reply ignored',txt==='NEW PHOTO TRANSCRIPT',txt);
   await check('chapter belongs to latest photo',await page.locator('[data-photo-practise-chapter]').inputValue()==='c10-quadratic-equations');
   await check('new photo can be practised',await page.locator('[data-photo-practise-start]').isEnabled());
   await file.setInputFiles({name:'down.png',mimeType:'image/png',buffer:IMG});
   await page.waitForSelector('[data-photo-practise-state="provider-down"]',{timeout:15000});
   await check('server outage is honest and stale chapter cannot launch',await page.locator('[data-photo-practise-start]').count()===0);
   await file.setInputFiles({name:'recovered.png',mimeType:'image/png',buffer:IMG});
   await page.waitForSelector('[data-photo-practise-state="ok"]',{timeout:15000});
   await check('next photo recovers after outage',await page.locator('[data-photo-practise-start]').isEnabled());
 }
};
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const {runOne}=await import('../../test/e2e.mjs');
 process.exit(await runOne(flow)?1:0);
}
