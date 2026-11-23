import { chromium } from 'playwright';
const host='https://man-cave-28-page.broncos5523.workers.dev';
const ids=['page1_nfl','page1_nba','page1_nhl','page1_mlb','page1_wnba','page1_cfb','page1_cbb',
  'page4_broncos','page4_celtics','page4_bruins','page4_redsox','page4_fever','page4_arizona_cfb','page4_arizona_cbb'];
const browser=await chromium.launch({headless:true});
const results=[], work=[...ids];
async function inspect(){
  const ctx=await browser.newContext({viewport:{width:720,height:1280},userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
  try{
    while(work.length){
      const id=work.shift(),page=await ctx.newPage(),network=[],errors=[];
      page.on('pageerror',e=>errors.push(e.message.slice(0,240)));
      page.on('response',r=>{
        const u=new URL(r.url());
        if(u.pathname.startsWith('/api/board/')||u.pathname.includes('/page4-live')||u.pathname==='/proxy'||u.hostname==='sports.core.api.espn.com'){
          if(network.length<60)network.push({status:r.status(),path:u.pathname.includes('/api/board/')?u.pathname:
            u.pathname.includes('/page4-live')?u.pathname:u.pathname==='/proxy'?'proxy:'+new URL(u.searchParams.get('url')||host).pathname.slice(0,110):'direct:'+u.pathname.slice(0,110)});
        }
      });
      try{
        const r=await page.goto(host+'/staging/boards/'+id+'?readOnlyAudit=20261122',{waitUntil:'domcontentloaded',timeout:35000});
        await page.waitForTimeout(8500);
        const frames=await Promise.all(page.frames().map(async f=>({url:f.url().slice(0,130),view:await f.evaluate(()=>{
          const t=(document.body?.innerText||'').replace(/\\r/g,'');
          const markers=t.split('\\n').map(x=>x.trim()).filter(x=>/202[4-9]|cached|loading|no data|unavailable|last update|live espn|data verified|season|rank|leader|first|source/i.test(x)).slice(0,24);
          return {title:document.title,ready:window.MCBoard?.ready===true,direct:window.__MC_DIRECT_ESPN_STATS__||null,markers,hasContent:t.length,excerpt:t.slice(0,340),sections:document.querySelectorAll('.leader-card,.bp4-leader,.rs4-leader,.fvp4-leader-card,.teamrow,.standing-row,.srow,.standRow,.rankrow').length,
            sha:document.querySelector('script[src*="espn-fetch-shim"]')?.getAttribute('src')||null};
        }).catch(e=>({error:String(e)}))})));
        const count={};for(const n of network)count[n.status]=(count[n.status]||0)+1;
        const out={board:id,status:r?.status(),frames,networkStatus:count,errors:errors.slice(0,4),failed:network.filter(x=>x.status>=400).slice(0,5)};
        results.push(out);console.log('TV_PAGE1_PAGE4_AUDIT',JSON.stringify(out));
      }catch(e){const out={board:id,error:String(e),errors,network:network.slice(-7)};results.push(out);console.log('TV_PAGE1_PAGE4_AUDIT',JSON.stringify(out));}
      finally{await page.close();}
    }
  }finally{await ctx.close();}
}
try{await Promise.all([inspect(),inspect(),inspect()]);}finally{await browser.close();}
console.log('TV_PAGE1_PAGE4_SUMMARY',JSON.stringify({total:results.length,failedResponses:results.filter(x=>Object.entries(x.networkStatus||{}).some(([k])=>Number(k)>=400)).map(x=>x.board),empty:results.filter(x=>x.frames?.every(f=>!f.view?.hasContent)).map(x=>x.board)}));
if(results.length!==14)process.exitCode=1;
