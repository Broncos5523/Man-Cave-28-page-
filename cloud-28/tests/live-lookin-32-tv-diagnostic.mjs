import {chromium} from 'playwright';
import fs from 'node:fs';
const target='https://man-cave-28-page.broncos5523.workers.dev/staging/player.html?rotate=off';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:720,height:1280},
 userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
const page=await context.newPage(),errors=[],failed=[],responses=[];
page.on('pageerror',e=>errors.push('js: '+String(e).slice(0,190)));
page.on('console',m=>{
 const s=m.text();
 if(m.type()==='error'&&/refused to display|frame|X-Frame|content security|net::ERR|failed to load/i.test(s))
  errors.push('browser: '+s.slice(0,280));
});
page.on('response',r=>{
 const u=new URL(r.url());
 if(['testcave.pages.dev','caveup.pages.dev'].includes(u.hostname))
  responses.push({host:u.hostname,path:u.pathname,status:r.status(),
   csp:r.headers()['content-security-policy']||null,
   xfo:r.headers()['x-frame-options']||null});
});
page.on('requestfailed',r=>{
 const u=new URL(r.url());
 if(['testcave.pages.dev','caveup.pages.dev','www.gstatic.com','man-cave-left-right-default-rtdb.firebaseio.com'].includes(u.hostname))
  failed.push({host:u.hostname,path:u.pathname,error:r.failure()?.errorText});
});
let report={readOnly:true,production:true,target};
try{
 const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:38000});
 await page.waitForFunction(()=>window.__MC_TV3_REMOTE__?.getState?.().connected===true,null,{timeout:30000});
 await page.waitForTimeout(5500);
 report.http=response?.status();
 const view=await page.evaluate(()=>{
  const f=document.getElementById('mc-tv3-single-board'),st=document.getElementById('stage');
  const bounds=n=>{if(!n)return null;const b=n.getBoundingClientRect();const style=getComputedStyle(n);return {
   left:Math.round(b.left),top:Math.round(b.top),width:Math.round(b.width),height:Math.round(b.height),
   visibility:style.visibility,opacity:style.opacity,zIndex:style.zIndex,display:style.display};
  };
  return {state:window.__MC_TV3_REMOTE__?.getState(),frameSrc:f?.src,
   frameBounds:bounds(f),stageBounds:bounds(st),
   bodyCount:document.body.children.length,
   recvEvents:(window.__MC_TV3_STAGING_EVENTS__||[]).map(x=>x.event).slice(-20)};
 });
 report={...report,...view,externalResponses:responses,failedRequests:failed,
  browserErrors:errors,frameLoadEvents:responses.length};
 console.log('LIVE_LOOKIN_TV_RECEIVER_DIAG',JSON.stringify(report));
 await page.screenshot({path:'live-lookin-32-tv-headless.png'}).catch(()=>{});
}catch(e){report.error=String(e).slice(0,400);console.error('LIVE_LOOKIN_TV_RECEIVER_FAILED',report.error);process.exitCode=1;}
finally{
 fs.writeFileSync('live-lookin-tv-receiver-diagnostic.json',JSON.stringify(report,null,2));
 await browser.close();
}
