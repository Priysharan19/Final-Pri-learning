// Browser integration: existing reviewed Complex Numbers notes → worked examples
// → same exact practice filters. Does not simulate server recognition/marking.
import { chromium } from '@playwright/test';
import { serveDist } from './e2e.mjs';

const server=await serveDist();
const browser=await chromium.launch();
let checks=0;
const check=(name,ok)=>{ if(!ok) throw Error(name); checks++; };
try {
  const ctx=await browser.newContext({viewport:{width:1024,height:1366},hasTouch:true,deviceScaleFactor:2});
  const page=await ctx.newPage();
  page.setDefaultTimeout(15000);
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(server.origin,{waitUntil:'domcontentloaded'});
  await page.getByRole('button',{name:'Use without an account'}).click();
  await page.waitForSelector('[data-onboarding-step="1"]');
  await page.getByRole('button',{name:'Student',exact:true}).click();
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="2"]');
  await page.locator('#signup-track').selectOption('11');
  await page.locator('.auth-card .btn-primary').click();
  await page.waitForSelector('[data-onboarding-step="3"]');
  await page.locator('#signup-name').fill('Study Test');
  await page.locator('.auth-card .btn-primary').click();
  for(const step of [4,5]){
    await page.waitForSelector(`[data-onboarding-step="${step}"]`);
    await page.locator('.auth-card .btn-primary').click();
  }
  await page.waitForSelector('.home-greet',{timeout:30000});

  // Reach real Home topic chooser; no direct URL injected until it has produced one.
  await page.getByTestId('choose-topic').click();
  await page.locator('.gen-pane').getByRole('button',{name:/CBSE/}).first().click();
  const topic=page.locator('.gen-pane .gen-opt').filter({hasText:'Complex Numbers'}).first();
  await topic.waitFor();
  await topic.click();
  await page.getByRole('tab',{name:/dot points|outcomes|dotpoint/i}).first().click().catch(async()=>{
    await page.locator('.gen-cats button').nth(3).click();
  });
  const options=page.locator('.gen-pane .gen-opt:not([disabled])');
  const pointCount=await options.count();
  check('complex-number outcomes are selectable',pointCount>0);
  const firstOutcome=await options.first().innerText();
  await options.first().click();
  await page.locator('.gen-cats button').last().click();
  const d3=page.locator('.gen-pane .gen-opt').filter({hasText:/D3/}).first();
  await d3.click();
  const study=page.locator('[data-study-journey]');
  await study.getByText('Study Notes',{exact:true}).waitFor({timeout:15000});
  check('the existing verified notes are exposed',await page.locator('[data-study-notes]').isEnabled());
  await page.locator('[data-study-notes]').click();
  await page.waitForURL(/\/notes\/c11-complex-numbers\?/);
  const selectedUrl=new URL(page.url());
  check('outcome zero survives into notes',selectedUrl.searchParams.get('dotpoint')==='0');
  check('D3 survives into notes',selectedUrl.searchParams.get('difficulty')==='3');
  check('track survives into notes',selectedUrl.searchParams.get('track')==='cbse');
  await page.locator('.nt-argand svg').waitFor();
  check('complex Argand SVG is rendered',await page.locator('.nt-argand svg line.nt-argand-radius').count()===1);
  check('typeset mathematics is rendered',await page.locator('.nt-formula .katex').count()>=3);
  check('outcome remains visibly identified',(await page.locator('.nt-selected-outcome').innerText()).length>25);
  await page.locator('.nt-journey-tabs [data-study-examples]').click();
  await page.waitForURL(/view=examples/);
  check('example view preserves dotpoint',new URL(page.url()).searchParams.get('dotpoint')==='0');
  check('example initially hides all solution steps',await page.locator('.nt-example').first().locator('.nt-step').count()===0);
  await page.locator('.nt-example').first().getByRole('button',{name:'Show all steps'}).click();
  check('reviewed alternative method is accessible',await page.locator('.nt-example').first().getByText('Alternative method').count()===1);
  await page.locator('.nt-journey-tabs [data-study-practice]').click();
  await page.waitForURL(/\/practice\?/);
  const query=new URL(page.url()).searchParams;
  check('practice receives same complex subtopic',query.get('subtopic')==='c11-complex-numbers');
  check('practice receives same dotpoint',query.get('dotpoint')==='0');
  check('practice receives D3',query.get('difficulty')==='3');
  check('practice receives CBSE',query.get('track')==='cbse');
  check('no uncaught browser errors',errors.length===0);
  console.log(`STUDY JOURNEY BROWSER: PASS ${checks}/${checks}; first selected outcome: ${firstOutcome.slice(0,75)}`);
  await ctx.close();
} finally { await browser.close(); await server.close(); }
