import {chromium} from 'playwright';
import fs from 'node:fs';
const base='https://man-cave-28-page.broncos5523.workers.dev';
const ids=['page1_nfl','page1_nba','page1_nhl','page1_mlb','page1_wnba','page1_cfb','page1_cbb',
 'page4_broncos','page4_celtics','page4_bruins','page4_redsox','page4_fever','page4_arizona_cfb','page4_arizona_cbb'];
const browser=await chromium.launch({headless:true});
let results=[],next=0;
async function inspect(){
 while(next<ids.length){
  const id=ids[next++];
  const ctx=await browser.newContext({viewport:{width:720,height:1280}});
  await ctx.route('**/*',route=>route.request().resourceType()==='image'?route.abort():route.continue());
  const page=await ctx.newPage(),responses=[],errors=[];
  page.on('pageerror',e=>errors.push(String(e).slice(0,200)));
  page.on('response',r=>{
   let u;try{u=new URL(r.url());}catch{return;}
   if(u.origin===base&&(/\/api\/board\//.test(u.pathname)||u.pathname.startsWith('/production/api/page4-live')||
        u.pathname.startsWith('/migration-api/nfl/season-stats')))
    responses.push({path:u.pathname,code:r.status(),boardParam:u.searchParams.get('board')});
  });
  const row={id,view:'production',firstSeen:Date.now()};
  try{
   const res=await page.goto(base+'/staging/boards/'+id,{waitUntil:'domcontentloaded',timeout:43000});
   await page.waitForTimeout(id==='page4_arizona_cfb'?9000:8500);
   Object.assign(row,await page.evaluate(id=>{
    const keys=Object.keys(localStorage).filter(k=>k.includes('feed-'+id)||k.includes('mc-v2-feed-'+id));
    const feed=keys.map(k=>{let x=null;try{x=JSON.parse(localStorage.getItem(k))}catch{}
       return {key:k,dataState:x?.dataState,year:x?.context?.year,statsYear:x?.context?.statsYear,
        fetchedAt:x?.fetchedAt,teams:x?.standings?.groups?.flatMap(g=>g.entries||[]).length,
        headline:x?.ticker?.selected?.length,
        sampleFirstTeam:x?.standings?.groups?.[0]?.entries?.[0]?.name||x?.standings?.groups?.[0]?.entries?.[0]?.displayName};});
    const body=(document.body?.innerText||'').replace(/\s+/g,' ').trim();
    const live4=window.__MC_PAGE4_LIVE_STATUS__||null;
    return {title:document.title,ready:window.MCBoard?.ready,
      mainText:body.slice(0,1400),lastText:body.slice(-380),
      page1Feed:feed,live4,
      firstYearTokens:[...new Set((body.match(/\b20(?:24|25|26|27)\b/g)||[]))].slice(0,6),
      sourceFlag:window.__MC_CLOUDFLARE_PUBLIC_FEED_RELAY__,
      errorsInDom:document.querySelectorAll('[role=alert],.error,.stale,.unavailable').length};
   },id));
   row.http=res?.status();row.requestStatuses=responses.slice(0,15);row.errors=errors.slice(0,7);
  }catch(e){row.error=String(e).slice(0,380);row.responses=responses.slice(0,20);row.errors=errors.slice(0,7);}
  console.log('LIVE_BOARD_FRESHNESS_DOM',JSON.stringify(row));
  results.push(row);
  await ctx.close();
 }
}
try{await Promise.all([inspect(),inspect(),inspect()]);}
finally{await browser.close();}
fs.writeFileSync('seven-page1-seven-page4-browser.json',JSON.stringify({checkedAt:new Date().toISOString(),rows:results},null,2));
console.log('LIVE_DOM_AUDIT_COMPLETE',results.length);
