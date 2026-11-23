import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const host='https://man-cave-28-page.broncos5523.workers.dev';
const checks=[
  {board:'page1_cfb',selector:'.favorite-next',expected:'VS ARIZONA STATE',date:'NOV 28',bad:/WEST VIRGINIA|OCT 10/,year:2026},
  {board:'page1_cbb',selector:'.favnext',expected:'VS COLORADO STATE',date:'NOV 23',bad:/SEASON OPENING SOON/,year:2027}
];
const browser=await chromium.launch({headless:true});
const results=[];
try{
  for(const c of checks){
    const context=await browser.newContext({viewport:{width:720,height:1280}}),page=await context.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      const response=await page.goto(host+'/staging/boards/'+c.board+'?release=arizona-next-r1',
        {waitUntil:'domcontentloaded',timeout:40000});
      assert.equal(response?.status(),200);
      await page.waitForFunction(({selector,expected,date})=>{
        const text=document.querySelector(selector)?.textContent||'';
        return text.includes(expected)&&text.includes(date)&&!!window.__MC_FAVORITE_NEXT_STATUS__?.selectedEvent;
      },c,{timeout:40000});
      const got=await page.evaluate(selector=>({
        text:document.querySelector(selector)?.textContent,
        script:document.querySelector('script[src*="favorite-next-live.js"]')?.src,
        state:window.__MC_FAVORITE_NEXT_STATUS__,
        ready:window.MCBoard?.ready
      }),c.selector);
      assert.ok(got.script?.includes('arizona-next-r1'),'Live page must contain new staged script');
      assert.equal(got.ready,true);
      assert.doesNotMatch(got.text,c.bad);
      const api=await fetch(host+'/api/board/'+c.board+'?live-qa-arizona-next-r1',
        {headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(65000)});
      assert.equal(api.status,200,'Page1 Worker must not throw 500');
      const feed=await api.json();
      assert.equal(feed.dataState,'current');
      assert.equal(feed.context.statsYear,c.year);
      assert.ok(feed.ticker?.selected?.length>0,'Live scoreboard ticker data required');
      assert.deepEqual(errors,[]);
      const item={board:c.board,pass:true,event:got.state.selectedEvent,text:got.text,
        feedYear:feed.context.statsYear,tickerEvents:feed.ticker.selected.length};
      results.push(item);console.log('LIVE_PAGE1_ARIZONA_RELEASE',JSON.stringify(item));
    }catch(error){const item={board:c.board,pass:false,error:String(error),errors};
      results.push(item);console.log('LIVE_PAGE1_ARIZONA_RELEASE',JSON.stringify(item));}
    await context.close();
  }
}finally{await browser.close();}
if(results.some(r=>!r.pass))process.exitCode=1;
