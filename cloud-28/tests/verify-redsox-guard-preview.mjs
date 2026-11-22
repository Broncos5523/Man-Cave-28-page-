import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const host=process.env.PREVIEW_URL;
assert.match(host||'',/^https:\/\/img-source-[a-z0-9.-]+\.workers\.dev\/?$/);
const browser=await chromium.launch({headless:true});
const reports=[];
try {
 for(let attempt=1;attempt<=6;attempt++){
  const context=await browser.newContext({viewport:{width:720,height:1280},
   userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push((e.stack||String(e)).slice(0,500)));
  const response=await page.goto(host+'/staging/boards/page3_redsox',
    {waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(6200);
  const stats=await page.evaluate(()=>{
   const imgs=[...document.images];
   const runtime=[...document.scripts].find(s=>s.src.includes('/staging/runtime/runtime_redsox_p3_v7t.js'));
   return {total:imgs.length,loaded:imgs.filter(i=>i.complete&&i.naturalWidth>0).length,
    broken:imgs.filter(i=>i.complete&&i.naturalWidth===0).length,
    stagingRuntime:!!runtime};
  });
  const result={attempt,http:response?.status(),...stats,errors};reports.push(result);
  console.log('REDSOX_GUARDED_RENDER',JSON.stringify(result));
  await context.close();
  assert.equal(result.http,200);
  assert.equal(result.broken,0,'Approved Red Sox images broke');
  assert.equal(result.loaded,result.total,'Red Sox art not fully loaded');
  assert.ok(result.stagingRuntime,'Red Sox staging clone not loaded');
  assert.deepEqual(errors,[],'Red Sox renderer must be error-free after guard');
 }
 console.log('PASS_REDSOX_DETACHED_IMG_GUARD_ALL_SIX');
} finally {
 fs.writeFileSync('redsox-guard-validation.json',JSON.stringify(reports,null,2));
 await browser.close();
}
