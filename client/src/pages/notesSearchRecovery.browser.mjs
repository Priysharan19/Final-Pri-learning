import { pathToFileURL } from 'node:url';
// Synthetic browser network fault, no change to production service-worker
// behavior. Search must recover a missing class notes module with Retry.
export const flow = {
 id:'notes-retry',name:'Notes search retries failed class module',
 async run({page,ctx,base,goto,createProfile,check}) {
   await page.addInitScript(()=>{ window.__PRI_LAN_DEV__=true });
   let requests=0;
   await ctx.route('**/assets/notes-class9-*.js',route=>{
     requests++;
     if(requests===1) return route.abort('failed').catch(()=>{});
     return route.continue().catch(()=>{});
   });
   await goto('/');
   await createProfile({name:'Notes search recovery',year:10,course:'in'});
   await goto('/notes');
   await page.waitForSelector('[data-testid="notes-chapter"]',{timeout:20000});
   await page.getByTestId('notes-search').fill('discriminant');
   await page.waitForSelector('.nt-failed[role="alert"]',{timeout:25000});
   await check('failed class chunk shows Retry instead of partial misleading search',requests===1,'requests='+requests);
   await page.getByRole('button',{name:'Try again',exact:true}).click();
   await page.waitForSelector('.nt-results .nt-chapter',{timeout:25000});
   const names=await page.locator('.nt-results .nt-chapter-name').allInnerTexts();
   await check('Retry loads cross-class results',names.some(x=>/Quadratic Equations/.test(x)),JSON.stringify(names));
   await check('failed class module actually re-requested',requests>=2,'requests='+requests);
 }
};
if(process.argv[1]&&pathToFileURL(process.argv[1]).href===import.meta.url){
 const {runOne}=await import('../../test/e2e.mjs');
 process.exit(await runOne(flow)?1:0);
}
