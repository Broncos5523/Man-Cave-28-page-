import {chromium} from 'playwright';
import fs from 'node:fs';
const root='https://man-cave-28-page.broncos5523.workers.dev';
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:720,height:1280}});
const responses=[],jsErrors=[];
page.on('pageerror',e=>jsErrors.push(String(e).slice(0,300)));
page.on('response',r=>{
 const u=new URL(r.url());
 if(u.pathname==='/migration-api/nfl/season-stats'){
  responses.push({athleteId:u.searchParams.get('athlete'),
    season:u.searchParams.get('season'),status:r.status(),
    source:r.headers()['x-man-cave-data-source']||null});
 }
});
let result={readOnly:true,url:root+'/staging/boards/page4_broncos',responses:[]};
try{
 const nav=await page.goto(result.url,{waitUntil:'domcontentloaded',timeout:48000});
 await page.waitForTimeout(16500);
 result={...result,http:nav?.status(),responses,jsErrors,
  dom:await page.evaluate(()=>({
   text:(document.body?.innerText||'').slice(0,1400),
   readiness:window.MCBoard?.ready,
   errors:(window.__MC_STAGING_FEED_CACHE_STATS__||{})
  }))};
 const codes={};for(const r of responses)codes[r.status]=(codes[r.status]||0)+1;
 console.log('BRONCOS_PAGE4_SOURCE_STATE',JSON.stringify({
  status:result.http,codes,total:responses.length,
  failedAthleteIds:[...new Set(responses.filter(r=>r.status>=400).map(r=>r.athleteId))],
  verifiedAthleteIds:[...new Set(responses.filter(r=>r.status===200).map(r=>r.athleteId))],
  onScreen:result.dom.text.slice(0,650),
  jsErrors:jsErrors.slice(0,3)}));
}catch(e){result.error=String(e).slice(0,300);console.error('BRONCOS_PAGE4_DIAGNOSTIC_ERROR',result.error);}
finally{fs.writeFileSync('broncos-page4-source-state.json',JSON.stringify(result,null,2));await browser.close();}
