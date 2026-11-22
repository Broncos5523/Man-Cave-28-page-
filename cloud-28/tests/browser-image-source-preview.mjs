// Source-only image-routing experiment. Read-only isolated Preview.
// Samples same two NFL boards and 12s dwell as original 85-proxy-call profile.
// No production URLs or Firebase actions, with a hard deadline and saved report.
import {chromium} from 'playwright';
import fs from 'node:fs';

const ORIGIN=process.env.PREVIEW_URL;
if(!/^https:\/\/img-source-[a-z0-9.-]+\.workers\.dev\/?$/.test(ORIGIN||''))
  throw Error('Image-source experimental preview only; refusing unknown URL');
const watchdog=setTimeout(()=>{console.error('IMAGE_SOURCE_PROFILE_TIMEOUT');process.exit(1)},75000);
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:720,height:1280},
 userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
const page=await context.newPage();
const proxies=[],direct=[],failed=[],result=[],errors=[];
let current='none',error=null;
page.on('pageerror',e=>errors.push(String(e).slice(0,300)));
page.on('request',req=>{
 try{
  const u=new URL(req.url());
  if(u.origin===ORIGIN && u.pathname==='/proxy'){
   let target=null;try{target=new URL(u.searchParams.get('url'));}catch{}
   proxies.push({board:current,host:target?.hostname||'invalid',path:target?.pathname||'invalid'});
  }
  if(u.hostname==='a.espncdn.com' && (/^\/(?:i\/|combiner\/)/.test(u.pathname)))
   direct.push({board:current,path:u.pathname});
 }catch{}
});
page.on('response',response=>{
 const u=new URL(response.url());
 if(response.status()>=400 && (u.hostname==='a.espncdn.com'||(u.origin===ORIGIN&&u.pathname==='/proxy')))
  failed.push({board:current,host:u.hostname,path:u.pathname,status:response.status()});
});
page.on('requestfailed',req=>{
 try{
  const u=new URL(req.url());
  if(u.hostname==='a.espncdn.com')
   failed.push({board:current,host:u.hostname,path:u.pathname,error:req.failure()?.errorText});
 }catch{}
});
try{
 for(const id of ['page1_nfl','page2_nfl']){
  current=id;
  const start=Date.now();
  const r=await page.goto(ORIGIN+'/staging/boards/'+id,{
   waitUntil:'domcontentloaded',timeout:25000});
  await page.waitForTimeout(12000);
  const state=await page.evaluate(()=>({
   images:document.images.length,
   loaded:[...document.images].filter(x=>x.complete&&x.naturalWidth>0).length,
   broken:[...document.images].filter(x=>x.complete&&x.naturalWidth===0).length,
   runtimeScript:[...document.scripts].find(x=>x.src.includes('/staging/runtime/'))?.src||null
  }));
  result.push({board:id,status:r?.status(),elapsedMs:Date.now()-start,...state});
  console.log('IMAGE_EXPERIMENT_BOARD',JSON.stringify(result.at(-1)));
 }
 const proxiedESPN=proxies.filter(x=>x.host==='a.espncdn.com');
 const summary={
   originalBaseline:{proxyTotal:85,imageProxy:81,boards:2,dwellSeconds:12},
   imageSourcePreview:{proxyTotal:proxies.length,imageProxy:proxiedESPN.length,
     directESPN:direct.length,failedDirect:failed.filter(x=>x.host==='a.espncdn.com').length},
   byBoard:result,failed:failed.slice(0,30),jsErrors:errors.slice(0,15),
   independentPreview:true,productionChanged:false
 };
 console.log('IMAGE_SOURCE_PROFILE',JSON.stringify(summary));
 if(result.some(x=>x.status!==200||!x.runtimeScript))throw Error('Approved staging board did not load source-only runtime');
 if(proxiedESPN.length>=81)throw Error('ESPN image proxy calls did not decrease');
 if(direct.length<10)throw Error('Expected direct image requests not observed');
 if(failed.filter(x=>x.host==='a.espncdn.com').length>0)
   throw Error('Direct ESPN images failed; do not cut over without asset fallback');
 if(result.some(x=>x.broken>0))
   throw Error('Broken images observed: original visual parity not proven');
 fs.writeFileSync('image-source-profile.json',JSON.stringify({...summary,pass:true},null,2));
}catch(e){
 error=String(e.stack||e);
 console.error('IMAGE_EXPERIMENT_FAILED',error.slice(0,1600));
 fs.writeFileSync('image-source-profile.json',JSON.stringify({
  pass:false,error,byBoard:result,proxyTotal:proxies.length,directESPN:direct.length,
  failed:failed.slice(0,40),jsErrors:errors.slice(0,15),productionChanged:false},null,2));
 process.exitCode=1;
}finally{
 await page.screenshot({path:'image-source-preview.png'}).catch(()=>{});
 await browser.close();
 clearTimeout(watchdog);
}
