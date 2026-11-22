import {chromium} from 'playwright';
import fs from 'node:fs';
const base='https://man-cave-28-page.broncos5523.workers.dev';
const first=['page1_nfl','page1_nba','page1_nhl','page1_mlb','page1_wnba','page1_cfb','page1_cbb'];
const fourth=['page4_broncos','page4_celtics','page4_bruins','page4_redsox','page4_fever','page4_arizona_cfb','page4_arizona_cbb'];
const report={checkedAt:new Date().toISOString(),base,readOnly:true,boards:[],api:[]};
const safe=s=>String(s||'').slice(0,160);
for(const id of first){
 const path='/api/board/'+id;
 try{
  const response=await fetch(base+path,{headers:{accept:'application/json'} ,signal:AbortSignal.timeout(30000)});
  const data=await response.json().catch(()=>({}));
  report.api.push({id,status:response.status,cache:response.headers.get('cache-control'),
   source:response.headers.get('x-man-cave-contract'),dataState:data.dataState||null,
   context:data.context||null, fetchedAt:data.fetchedAt||null,reason:safe(data.error),
   sourceCount:data.sources?.length||0,
   sourceSummary:(data.sources||[]).slice(0,3).map(x=>({state:x.state,checked:x.fetched_at}))});
 }catch(e){report.api.push({id,error:safe(e)});}
}
for(const id of ['page4_celtics','page4_fever','page4_arizona_cbb']){
 const path='/production/api/page4-live?board='+id;
 try{
  const response=await fetch(base+path,{headers:{accept:'application/json'},signal:AbortSignal.timeout(30000)});
  const data=await response.json().catch(()=>({}));
  report.api.push({id,status:response.status,cache:response.headers.get('cache-control'),
    dataState:data.dataState||null,season:data.season||null,updatedAt:data.updatedAt||null,
    verifiedPlayers:data.verifiedPlayers||0,reason:safe(data.error||data.detail)});
 }catch(e){report.api.push({id,error:safe(e)});}
}
console.log('PAGE1_AND_PAGE4_LIVE_API_STATUS',JSON.stringify(report.api));
const browser=await chromium.launch({headless:true});
for(const board of [...first,...fourth]){
 const ctx=await browser.newContext({viewport:{width:720,height:1280},ignoreHTTPSErrors:false});
 const page=await ctx.newPage();
 const responses=[],errors=[];
 page.on('pageerror',e=>errors.push(safe(e.stack||e)));
 page.on('response',r=>{
  const u=new URL(r.url());
  if(u.pathname==='/proxy'||u.pathname.startsWith('/api/board/')||
     u.pathname.startsWith('/production/api/')||u.pathname.startsWith('/migration-api/')){
   if(responses.length<85){
    const remote=u.searchParams.get('url');
    responses.push({url:u.pathname,remote:remote?safe(remote):null,status:r.status(),
      source:r.headers()['x-man-cave-data-source']||null});
   }
  }
 });
 try{
  await page.route('**/*',route=>{
   const type=route.request().resourceType();
   if(['image','font','media'].includes(type))return route.abort();
   return route.continue();
  });
  const n=await page.goto(base+'/staging/boards/'+board+'?fresh-audit=20261122',
   {waitUntil:'domcontentloaded',timeout:42000});
  await page.waitForTimeout(10500);
  const state=await page.evaluate(()=>{
   const text=(document.body?.innerText||'').slice(0,3200);
   const fromLocal=[];
   for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(!/mc|feed|cache|board/i.test(key))continue;
    try{
     const x=JSON.parse(localStorage.getItem(key)||'null');
     if(x&&typeof x==='object'){
      const d=x.data||x;
      fromLocal.push({key,season:d.context?.label||d.seasonLabel||d.season||null,
       year:d.context?.year||null, statsYear:d.context?.statsYear||null,
       dataState:d.dataState||null, fetchedAt:d.fetchedAt||d.updatedAt||null,
       sourceCount:d.sources?.length||0, keys:Object.keys(d).slice(0,22)});
     }else fromLocal.push({key,type:typeof x});
    }catch{}
   }
   return {
     title:document.title,
     text,
     dates:[...new Set((text.match(/\b(?:202[4-9]|203[0-2])(?:[–/-]\d{2,4})?\b/g)||[]))].slice(0,18),
     renderedCards:document.querySelectorAll('.standing-row,.teamrow,.bp4-leader,.rs4-leader,[class*="leaderCard"]').length,
     local:fromLocal,
     boardReady:!!window.MCBoard?.ready,boardActive:!!window.MCBoard?.active,
     sourceScripts:[...document.scripts].map(x=>x.src).filter(x=>/runtime|shim|page4|page1/.test(x)).slice(0,14),
   };
  });
  const result={board,http:n?.status(),...state,network:responses,jsErrors:errors};
  report.boards.push(result);
  console.log('LIVE_BOARD_DATA_AUDIT',JSON.stringify({board,http:result.http,
   seasons:result.local.map(x=>({key:x.key,season:x.season,year:x.year,statsYear:x.statsYear,dataState:x.dataState,fetchedAt:x.fetchedAt})),
   dates:result.dates, textStart:result.text.slice(0,550),
   failedApi:responses.filter(x=>x.status>=400).slice(0,15),
   api200:responses.filter(x=>x.status===200).length, jsErrors:errors.slice(0,4)}));
 }catch(e){report.boards.push({board,error:safe(e),network:responses,jsErrors:errors});console.log('LIVE_BOARD_AUDIT_ERROR',board,safe(e));}
 await ctx.close();
}
await browser.close();
fs.writeFileSync('page1-page4-live-audit.json',JSON.stringify(report,null,2));
console.log('PAGE1_PAGE4_AUDIT_COMPLETE',JSON.stringify({boards:report.boards.length,
  apiChecked:report.api.length,failedApis:report.api.filter(x=>x.status>=400||x.error).map(x=>x.id),
  browserErrors:report.boards.filter(x=>x.error).map(x=>x.board)}));
