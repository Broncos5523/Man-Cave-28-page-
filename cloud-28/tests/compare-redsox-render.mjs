import {chromium} from 'playwright';
import fs from 'node:fs';
// Isolate Red Sox Page 3 renderer errors using a fresh browser page on each
// baseline vs image-source run, not a rapid 28-page navigation teardown.
const sites=[
 {version:'original-staging',base:'https://pr-2-man-cave-28-page.broncos5523.workers.dev'},
 {version:'image-source',base:'https://img-source-man-cave-28-page.broncos5523.workers.dev'}
];
const browser=await chromium.launch({headless:true});
const results=[];
for(const site of sites)for(let attempt=1;attempt<=2;attempt++){
 const context=await browser.newContext({viewport:{width:720,height:1280},
  userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push((e.stack||String(e)).slice(0,1400)));
 const response=await page.goto(site.base+'/staging/boards/page3_redsox',
    {waitUntil:'domcontentloaded',timeout:30000});
 await page.waitForTimeout(7300);
 const state=await page.evaluate(()=>{
   const imgs=[...document.images];
   return {images:imgs.length,loaded:imgs.filter(x=>x.complete&&x.naturalWidth>0).length,
     broken:imgs.filter(x=>x.complete&&x.naturalWidth===0).length};
 });
 const row={site:site.version,attempt,http:response?.status(),...state,errors};
 results.push(row);
 console.log('REDSOX_ISOLATED_RENDER',JSON.stringify(row));
 await context.close();
}
fs.writeFileSync('redsox-render-compare.json',JSON.stringify(results,null,2));
await browser.close();
