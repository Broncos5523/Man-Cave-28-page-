// Isolated Cloudflare Preview only. Sample each approved board without running
// 14 minutes of rotation; full real-time cycle is checked in a separate workflow.
import {chromium} from 'playwright';
import fs from 'node:fs';

const host='https://img-source-man-cave-28-page.broncos5523.workers.dev';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:720,height:1280},deviceScaleFactor:1,
 userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
const page=await context.newPage();
const failures=[],jsErrors=[],imageNetworkErrors=[],boards=[],requests={};
const watchdog=setTimeout(()=>{console.error('ALL_BOARD_PREVIEW_TIMEOUT');process.exit(1)},290000);
let active='none';
page.on('pageerror',e=>jsErrors.push({board:active,message:String(e).slice(0,320)}));
page.on('request',req=>{
 try{
  const u=new URL(req.url());
  if(u.origin===host&&u.pathname==='/proxy'){
   const upstream=new URL(u.searchParams.get('url'));
   const key=upstream.hostname;
   requests[key]=(requests[key]||0)+1;
  }
 }catch{}
});
page.on('response',res=>{
 try{
  const u=new URL(res.url());
  if(res.status()>=400&&(u.hostname==='a.espncdn.com'||(u.origin===host&&u.pathname==='/proxy')))
   imageNetworkErrors.push({board:active,host:u.hostname,status:res.status(),path:u.pathname});
 }catch{}
});
let fatal=null;
try {
 const raw=await page.request.get(host+'/staging/boards.json',{timeout:25000});
 if(raw.status()!==200)throw Error('Manifest unavailable');
 const manifest=await raw.json();
 const ids=manifest.boards?.map(b=>b.id)||[];
 if(ids.length!==28||new Set(ids).size!==28||manifest.duration_ms!==30000)
  throw Error('Original 28-board manifest order or rotation duration changed');
 for(let i=0;i<ids.length;i++){
  const id=ids[i];active=id;
  let response=null;const started=Date.now();
  try{
   response=await page.goto(host+'/staging/boards/'+id,{waitUntil:'domcontentloaded',timeout:27000});
   await page.waitForTimeout(3200);
   const state=await page.evaluate(()=>{
    const imgs=[...document.images];
    return {
     imgs:imgs.length,
     loaded:imgs.filter(x=>x.complete&&x.naturalWidth>0).length,
     broken:imgs.filter(x=>x.complete&&x.naturalWidth===0).length,
     pending:imgs.filter(x=>!x.complete).length,
     scripts:[...document.scripts].filter(s=>s.src.includes('/staging/runtime/')).map(s=>s.src),
     boardMark:document.querySelector('[data-board]')?.getAttribute('data-board')||null
    };
   });
   const row={index:i+1,id,http:response?.status(),ms:Date.now()-started,...state};
   boards.push(row);
   console.log('ALL_BOARDS_PREVIEW',JSON.stringify({...row,scripts:state.scripts.length}));
   if(i%4===0||i===27)await page.screenshot({path:'image-preview-board-'+String(i+1).padStart(2,'0')+'.png'}).catch(()=>{});
  }catch(error){
   const row={index:i+1,id,http:response?.status()||null,ms:Date.now()-started,error:String(error).slice(0,550)};
   boards.push(row);
   failures.push(row);
   console.error('ALL_BOARDS_PREVIEW_FAILURE',JSON.stringify(row));
   await page.screenshot({path:'image-preview-error-'+String(i+1).padStart(2,'0')+'.png'}).catch(()=>{});
  }
 }
 const missing=boards.filter(x=>x.http!==200);
 const broken=boards.filter(x=>x.broken>0);
 if(missing.length)throw Error('Failed board pages: '+missing.map(x=>x.id).join(','));
 if(broken.length)throw Error('Broken images: '+broken.map(x=>x.id+':'+x.broken).join(','));
 if(imageNetworkErrors.length)throw Error('Image/proxy HTTP errors: '+imageNetworkErrors.length);
 // Non-image page errors are captured for engineering triage, not silently discarded.
 if(jsErrors.length)throw Error('Page JavaScript errors: '+jsErrors.length);
 console.log('PASS_28_STAGING_PAGE_IMAGE_SWEEP',JSON.stringify({
  inspected:boards.length,totalImages:boards.reduce((n,x)=>n+(x.imgs||0),0),
  loadedImages:boards.reduce((n,x)=>n+(x.loaded||0),0),
  nonHTMLImages:boards.reduce((n,x)=>n+(x.broken||0),0),proxyHosts:requests}));
}catch(e){fatal=String(e.stack||e);console.error('ALL_BOARDS_PREVIEW_FAIL',fatal.slice(0,1500));}
finally{
 const report={timestamp:new Date().toISOString(),passed:!fatal,boards,
  totalLoaded:boards.reduce((n,x)=>n+(x.loaded||0),0),
  totalImages:boards.reduce((n,x)=>n+(x.imgs||0),0),
  failedImageResponses:imageNetworkErrors.slice(0,40),
  jsErrors:jsErrors.slice(0,30),proxyTargetsByHost:requests,
  exceptions:failures,fatal,productionChanged:false,physicalTvTested:false};
 fs.writeFileSync('all-28-image-preview.json',JSON.stringify(report,null,2));
 await browser.close();clearTimeout(watchdog);
 if(fatal)process.exitCode=1;
}
