import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const host='https://man-cave-28-page.broncos5523.workers.dev';
const browser=await chromium.launch({headless:true});
const results=[];
try{
 for(const id of ['page3_celtics','page4_arizona_cfb']){
   const ctx=await browser.newContext({viewport:{width:720,height:1280}}),page=await ctx.newPage();
   const core=[],errors=[];
   page.on('pageerror',e=>errors.push(String(e.message).slice(0,200)));
   page.on('response',r=>{if(r.url().startsWith('https://sports.core.api.espn.com/'))
     core.push({status:r.status(),path:new URL(r.url()).pathname});});
   const url=host+'/staging/boards/'+id+'?verified-direct-core-r1';
   try{
     const nav=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
     assert.equal(nav?.status(),200);
     await page.waitForFunction(id=>{
       const target=id==='page4_arizona_cfb'
          ?[...document.querySelectorAll('iframe')].find(f=>f.src.includes('/hosted/page4_arizona_cfb/'))?.contentWindow
          :window;
       return (target?.__MC_DIRECT_ESPN_STATS__?.success||0)>= (id==='page3_celtics'?20:5);
     },id,{timeout:48000});
     const frames=await Promise.all(page.frames().map(async f=>({url:f.url(),
       stats:await f.evaluate(()=>({
         direct:window.__MC_DIRECT_ESPN_STATS__||null,
         ready:window.MCBoard?.ready===true,
         text:(document.body?.innerText||'').slice(0,1800),
         leaders:document.querySelectorAll('._leaderCard_w3kwp_9').length
       })).catch(()=>null)})));
     const success=frames.reduce((n,f)=>n+(f.stats?.direct?.success||0),0);
     assert.ok(success >= (id==='page3_celtics'?20:5));
     assert.ok(core.filter(x=>x.status===200).length>=(id==='page3_celtics'?20:5));
     if(id==='page3_celtics'){
       assert.match(frames[0].stats?.text||'',/TEAM STATS[^\n]*2026-27/);
       assert.doesNotMatch(frames[0].stats?.text||'',/cached 2025-26 final stats retained/);
     }else {
       const nested=frames.find(f=>f.url.includes('/hosted/page4_arizona_cfb/'));
       assert.ok(nested?.stats?.ready,'Arizona nested original lifecycle must be ready');
       assert.ok(nested.stats.direct?.success>=5,'Arizona direct Core API must reach the child frame');
       assert.ok(nested.stats.leaders>=6,'Arizona native leader cards must be present');
     }
     assert.deepEqual(errors,[]);
     results.push({board:id,success:true,directRequests:success,core200:core.filter(x=>x.status===200).length});
   }catch(e){results.push({board:id,success:false,error:String(e),core:core.slice(0,12),errors});}
   console.log('DIRECT_CORE_PRODUCTION_RESULT',JSON.stringify(results.at(-1)));
   await ctx.close();
 }
}finally{await browser.close();}
if(results.some(x=>!x.success))process.exitCode=1;
