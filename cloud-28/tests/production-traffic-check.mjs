import {chromium} from 'playwright';
import fs from 'node:fs';
const HOST='https://man-cave-28-page.broncos5523.workers.dev';
const browser=await chromium.launch({headless:true});
const ctx=await browser.newContext({viewport:{width:720,height:1280},
  userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
const page=await ctx.newPage();
const stats={requests:0,proxy:0,proxyImages:0,directESPN:0,imagesLoaded:0,imagesBroken:0,
  jsErrors:[],boards:[],workerFailures:[],photoFailures:[],production:true};
page.on('pageerror',e=>stats.jsErrors.push(String(e).slice(0,220)));
page.on('request',r=>{
 let u;try{u=new URL(r.url());}catch{return;}
 stats.requests++;
 if(u.origin===HOST&&u.pathname==='/proxy'){
   stats.proxy++;
   try{const t=new URL(u.searchParams.get('url'));if(t.hostname==='a.espncdn.com')stats.proxyImages++;}catch{}
 }
 if(u.hostname==='a.espncdn.com'&&/^\/(?:i\/|combiner\/)/.test(u.pathname))stats.directESPN++;
});
page.on('response',r=>{
 let u;try{u=new URL(r.url());}catch{return;}
 if(r.status()>=400&&u.origin===HOST&&u.pathname==='/proxy')
   stats.workerFailures.push({status:r.status(),path:u.pathname});
 if(r.status()>=400&&u.hostname==='a.espncdn.com')
   stats.photoFailures.push({status:r.status(),path:u.pathname});
});
let failure=null;
try{
 for(const board of ['page1_nfl','page2_nfl']){
   const res=await page.goto(HOST+'/staging/boards/'+board,{waitUntil:'domcontentloaded',timeout:35000});
   await page.waitForTimeout(11500);
   const imgs=await page.evaluate(()=>{
     const a=[...document.images];
     return {loaded:a.filter(x=>x.complete&&x.naturalWidth>0).length,
       broken:a.filter(x=>x.complete&&x.naturalWidth===0).length,total:a.length,
       stagingRuntime:[...document.scripts].some(s=>s.src.includes('/staging/runtime/'))};
   });
   stats.boards.push({board,status:res?.status(),...imgs});
   stats.imagesLoaded+=imgs.loaded;stats.imagesBroken+=imgs.broken;
   console.log('LIVE_PRODUCTION_BOARD',JSON.stringify(stats.boards.at(-1)));
   if(res?.status()!==200||!imgs.stagingRuntime||imgs.broken||imgs.total!==imgs.loaded)
     throw Error('Production image display or runtime check failed for '+board);
 }
 if(stats.proxyImages!==0)throw Error('ESPN images still routed through Worker: '+stats.proxyImages);
 if(stats.directESPN<10)throw Error('Direct ESPN artwork requests unexpectedly low');
 if(stats.photoFailures.length)throw Error('Direct ESPN images failed');
 if(stats.jsErrors.length)throw Error('Board JavaScript errors');
 if(stats.proxy>=40)throw Error('Excessive production relay requests: '+stats.proxy);
 console.log('PASS_PRODUCTION_BROWSER_QUOTA_OPTIMIZATION',JSON.stringify({
   proxy:stats.proxy,proxyImages:stats.proxyImages,directESPN:stats.directESPN,
   loaded:stats.imagesLoaded,broken:stats.imagesBroken,sourceBaselineProxy:85}));
}catch(e){
 failure=String(e.stack||e);
 console.error('PRODUCTION_BROWSER_CHECK_FAILED',failure.slice(0,1000));
}finally{
 stats.passed=!failure;stats.error=failure;
 fs.writeFileSync('production-image-traffic-check.json',JSON.stringify(stats,null,2));
 await browser.close();
 if(failure)process.exitCode=1;
}
