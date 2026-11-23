import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const host='https://man-cave-28-page.broncos5523.workers.dev';
const shim=readFileSync('cloud-28/cloudflare-public-feed-shim.js','utf8');
const browser=await chromium.launch({headless:true}),results=[];
try{
  for(const id of ['page4_arizona_cfb','page3_celtics']){
    const ctx=await browser.newContext({viewport:{width:720,height:1280}}),page=await ctx.newPage();
    const requests=[],errors=[];
    await ctx.route('**/staging/espn-fetch-shim.js?*',route=>route.fulfill({
      status:200,contentType:'application/javascript',body:shim
    }));
    page.on('response',r=>{
      const url=r.url();
      if(url.includes('sports.core.api.espn.com')||
        url.includes('/proxy?url=')&&decodeURIComponent(url).includes('sports.core.api.espn.com'))
        requests.push({status:r.status(),url:url.slice(0,230)});
    });
    page.on('pageerror',e=>errors.push(String(e).slice(0,270)));
    let outer={};
    try{
      const nav=await page.goto(host+'/staging/boards/'+id,{waitUntil:'domcontentloaded',timeout:45000});
      await page.waitForTimeout(15000);
      outer=await page.evaluate(()=>({
        text:(document.body?.innerText||'').slice(0,650),
        direct:window.__MC_DIRECT_ESPN_STATS__,
        ready:window.MCBoard?.ready,
        seasonStatus:window.__MC_PAGE4_LIVE_STATUS__||null
      }));
      results.push({board:id,status:nav?.status(),...outer,requests:requests.slice(-35),errors:errors.slice(-6)});
    }catch(e){results.push({board:id,error:String(e),requests:requests.slice(-30),errors});}
    console.log('DIRECT_CORE_INTEGRATION',JSON.stringify(results.at(-1)).slice(0,12000));
    await ctx.close();
  }
}finally{await browser.close();}
if(results.some(x=>x.status!==200))process.exitCode=1;
