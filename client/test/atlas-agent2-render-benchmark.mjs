import { chromium, webkit } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';

const cases=[
  {name:'desktop-chromium',engine:chromium,viewport:{width:1440,height:900},cpu:1},
  {name:'throttled-tablet-chromium',engine:chromium,viewport:{width:820,height:1180},cpu:4},
  {name:'mobile-webkit',engine:webkit,viewport:{width:390,height:844},cpu:1}
];
const output=[];
for(const scenario of cases){
  const browser=await scenario.engine.launch({headless:true});
  try{
    const page=await browser.newPage({viewport:scenario.viewport});
    if(scenario.cpu>1){
      const session=await page.context().newCDPSession(page);
      await session.send('Emulation.setCPUThrottlingRate',{rate:scenario.cpu});
    }
    for(const n of [10,40,84]){
      const url='http://127.0.0.1:4217/atlas-agent2.html?graphNodes='+n;
      await page.goto(url,{waitUntil:'networkidle'});
      const count=await page.locator('[data-graph-node]').count();
      assert.equal(count,n);
      const samples=await page.evaluate(async ()=>{
        const samples=[];
        const svg=document.querySelector('.pa2-graph');
        let last=0,stop=false;
        function step(now){
          if(last)samples.push(now-last);
          last=now;
          if(!stop)requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
        for(let j=0;j<14;j++){
          const wheel=new WheelEvent('wheel',{deltaY:j%2?-18:22,bubbles:true,cancelable:true});
          svg.dispatchEvent(wheel);
          await new Promise(r=>setTimeout(r,35));
        }
        await new Promise(r=>setTimeout(r,450));
        stop=true;
        return samples.filter(x=>x>0&&x<1000);
      });
      samples.sort((a,b)=>a-b);
      const metric={environment:scenario.name,nodes:n,frames:samples.length,
        medianFrameMs:+samples[Math.floor(samples.length*.5)].toFixed(2),
        p95FrameMs:+samples[Math.floor(samples.length*.95)].toFixed(2),
        maxFrameMs:+samples.at(-1).toFixed(2),
        mode:'Headless emulation, wheel-zoom rendering; not a physical device benchmark'};
      output.push(metric);console.log(JSON.stringify(metric));
    }
  }finally{await browser.close();}
}
await mkdir('../docs/prototypes',{recursive:true});
await writeFile('../docs/prototypes/agent2-render-bench.json',JSON.stringify(output,null,2)+'\n');
