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
    // Inject the proposed shim into every same-origin frame BEFORE any
    // original board scripts, including the nested Arizona hosted app.
    // The old deployed external shim is replaced with an inert duplicate.
    let hostedIntercepts=0;
    await ctx.route('**/*',async route=>{
      const request=route.request(),url=new URL(request.url());
      if(request.resourceType()==='document'&&url.pathname.startsWith('/hosted/page4_arizona_cfb/')){
        const response=await route.fetch();
        let body=await response.text();
        const head=/<head\b[^>]*>/i.exec(body);
        if(!head)throw Error('Arizona nested document lacks head');
        body=body.slice(0,head.index+head[0].length)+
          '<script src="/staging/espn-fetch-shim.js?v=direct-core-r1"></script>'+
          body.slice(head.index+head[0].length);
        hostedIntercepts++;
        return route.fulfill({response,body});
      }
      return route.continue();
    });
    await ctx.route('**/staging/espn-fetch-shim.js?*',route=>route.fulfill({
      status:200,contentType:'application/javascript',body:shim
    }));
    page.on('response',r=>{
      const url=r.url();
      if(url.includes('sports.core.api.espn.com')||
        url.includes('/proxy?url=')&&decodeURIComponent(url).includes('sports.core.api.espn.com'))
        requests.push({status:r.status(),url:url.slice(0,230),frame:(()=>{try{return r.request().frame().url().slice(0,160)}catch{return 'unknown'}})(),kind:r.request().resourceType()});
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
        seasonStatus:window.__MC_PAGE4_LIVE_STATUS__||null,
        iframes:[...document.querySelectorAll('iframe')].map(f=>({src:f.src.slice(0,150)}))
      }));
      outer.frames=await Promise.all(page.frames().map(async frame=>({url:frame.url().slice(0,190),data:await frame.evaluate(()=>({direct:window.__MC_DIRECT_ESPN_STATS__||null,shim:window.__MC_CLOUDFLARE_PUBLIC_FEED_RELAY__||null,ready:window.MCBoard?.ready||null})).catch(e=>({error:String(e)}))})));
      results.push({board:id,status:nav?.status(),...outer,requests:requests.slice(-35),errors:errors.slice(-6)});
    }catch(e){results.push({board:id,error:String(e),requests:requests.slice(-30),errors});}
    const out=results.at(-1);
    const grouped={};for(const req of requests)grouped[req.status]=(grouped[req.status]||0)+1;
    console.log('DIRECT_CORE_INTEGRATION_SUMMARY',JSON.stringify({
      board:id,status:out.status,hostedIntercepts,frames:out.frames,requestsByStatus:grouped,
      firstRequests:requests.slice(0,8),text:out.text?.slice(0,300),errors:out.errors
    }));
    if(out.status!==200)throw Error('Board HTML unavailable '+id);
    const totalDirect=out.frames?.reduce((n,f)=>n+(f.data?.direct?.success||0),0)||0;
    if(totalDirect===0)errors.push('Direct ESPN Core shim not exercised on '+id);
    if(id==='page4_arizona_cfb'&&hostedIntercepts===0)errors.push('Hosted Arizona document interception was not exercised');
    if(id==='page4_arizona_cfb'&&
       !out.frames?.some(f=>f.url.includes('/hosted/page4_arizona_cfb/')&&f.data?.direct?.success>0))
      errors.push('Nested Arizona Core stats still bypass direct transport');
    out.errors=errors;
    await ctx.close();
  }
}finally{await browser.close();}
if(results.some(x=>x.status!==200||x.errors?.length>0))process.exitCode=1;
