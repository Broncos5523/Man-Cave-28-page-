// Isolated Red Sox P3 staging-only null parent safety check; no live TV changes.
import {chromium} from 'playwright';
import fs from 'node:fs';
const host=process.env.RED_SOX_PREVIEW;
if(!/^https:\/\/redsox-guard-[a-z0-9.-]+\.workers\.dev$/.test(host||''))
  throw Error('Refusing non-isolated preview');
const browser=await chromium.launch({headless:true});
const results=[],errors=[],failures=[];
try{
 for(let attempt=1;attempt<=3;attempt++){
  const context=await browser.newContext({viewport:{width:720,height:1280},
   userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
  const page=await context.newPage();
  const pageErrors=[];
  page.on('pageerror',err=>pageErrors.push(String(err.stack||err).slice(0,500)));
  const response=await page.goto(host+'/staging/boards/page3_redsox',
    {waitUntil:'domcontentloaded',timeout:35000});
  await page.waitForTimeout(6700);
  const state=await page.evaluate(()=>{
   const imgs=[...document.images];
   return {images:imgs.length,loaded:imgs.filter(x=>x.complete&&x.naturalWidth>0).length,
     broken:imgs.filter(x=>x.complete&&x.naturalWidth===0).length,
     guard:[...document.scripts].some(s=>s.src.includes('staging/runtime/runtime_redsox_p3_v7t.js'))};
  });
  const row={attempt,http:response?.status(),...state,errors:pageErrors};
  results.push(row);
  console.log('REDSOX_GUARD_PREVIEW',JSON.stringify(row));
  if(response?.status()!==200||state.broken||!state.guard||pageErrors.length)
   failures.push(row);
  await context.close();
 }
 // Original 30-second NFL rotation still progresses as built. Keep this test
 // short: the unmodified 28-page full-cycle mechanics already ran end to end.
 const context=await browser.newContext({viewport:{width:720,height:1280}});
 const page=await context.newPage();
 const nav=await page.goto(host+'/staging/player.html?rotate=off&qa=redsox-guard',
  {waitUntil:'domcontentloaded',timeout:35000});
 if(nav?.status()!==200)throw Error('Player HTTP unavailable');
 await page.waitForFunction(()=>window.__MC_PRODUCTION?.current==='page1_nfl',null,{timeout:45000});
 const first=Date.now();
 await page.waitForFunction(()=>window.__MC_PRODUCTION?.current==='page2_nfl',null,{timeout:60000});
 const elapsed=Date.now()-first;
 console.log('REDSOX_GUARD_ROTATION',JSON.stringify({elapsed,first:'page1_nfl',second:'page2_nfl'}));
 if(elapsed<20000||elapsed>65000)throw Error('Approved 30s player rotation changed');
 await context.close();
 if(failures.length)throw Error('Red Sox guard regression: '+failures.length);
 console.log('PASS_REDSOX_GUARD_PREVIEW',JSON.stringify({attempts:results.length,allLoaded:true}));
}catch(e){
 errors.push(String(e.stack||e));console.error('REDSOX_GUARD_FAILURE',errors[0].slice(0,1100));
 process.exitCode=1;
}finally{
 fs.writeFileSync('redsox-guard-preview.json',JSON.stringify({attempts:results,errors,
  productionModified:false,originalGoldMasterModified:false},null,2));
 await browser.close();
}
