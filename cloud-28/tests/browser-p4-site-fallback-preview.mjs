import {chromium} from 'playwright';
import fs from 'node:fs';
const url=process.env.PREVIEW_URL;
if(!/^https:\/\/p4-fresh-[a-z0-9.-]+\.workers\.dev$/.test(url||''))throw Error('Isolated Preview URL required');
const ids=['page4_celtics','page4_fever','page4_arizona_cbb'];
const browser=await chromium.launch({headless:true});
const rows=[];
try{
 for(const id of ids){
  const context=await browser.newContext({viewport:{width:720,height:1280}});
  const page=await context.newPage(),api=[],errors=[];
  page.on('pageerror',e=>errors.push(String(e).slice(0,320)));
  page.on('response',r=>{
   const u=new URL(r.url());
   if(u.pathname==='/production/api/page4-live'&&u.searchParams.get('board')===id)api.push(r.status());
  });
  const row={id,expectedSeason:id==='page4_fever'?2026:2027};
  try{
   const n=await page.goto(url+'/staging/boards/'+id,{waitUntil:'domcontentloaded',timeout:40000});
   if(n?.status()!==200)throw Error('Board HTML status '+n?.status());
   await page.waitForFunction(()=>!!window.__MC_PAGE4_LIVE_STATUS__?.lastSuccess,null,{timeout:65000});
   const state=await page.evaluate(()=>{
    const status=window.__MC_PAGE4_LIVE_STATUS__;
    const b=document.body.innerText||'';
    return {season:status.season,verifiedPlayers:status.verifiedPlayers,lastSuccess:status.lastSuccess,
      lastError:status.lastError,footer:document.getElementById('fresh')?.textContent,
      text:b.slice(0,320),ready:!!window.MCBoard?.ready};
   });
   Object.assign(row,state,{api,jsErrors:errors});
   if(row.season!==row.expectedSeason)throw Error('Wrong season applied');
   if(row.verifiedPlayers<3)throw Error('Insufficient current-year verified players');
   if(!row.footer?.includes('CURRENT SEASON'))throw Error('UI did not confirm current season');
   if(!row.ready)throw Error('Approved 28-board lifecycle failed');
   if(errors.length)throw Error('JavaScript errors');
   console.log('PASS_ISOLATED_CURRENT_SEASON_P4',JSON.stringify({
      id,season:row.season,verifiedPlayers:row.verifiedPlayers,api,
      lastError:row.lastError}));
   row.pass=true;
  }catch(e){row.pass=false;row.error=String(e).slice(0,320);
   row.api=api;row.jsErrors=errors;console.error('FAIL_ISOLATED_CURRENT_SEASON_P4',JSON.stringify(row));}
  rows.push(row);
  await context.close();
 }
}finally{await browser.close();}
fs.writeFileSync('current-page4-fallback-preview-result.json',JSON.stringify({url,rows,at:new Date().toISOString()},null,2));
if(rows.some(x=>!x.pass))process.exitCode=1;
