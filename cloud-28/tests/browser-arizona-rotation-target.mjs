/* Targeted staging-only repro for the approved original player's Arizona
 * football Page 4 iframe readiness. No production TV/Firebase writes.
 * Starts from approved Arizona football Page 3 via fresh local playback state.
 */
import {chromium} from 'playwright';
import fs from 'node:fs';

const HOST='https://man-cave-28-page.broncos5523.workers.dev';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:720,height:1280}});
await context.addInitScript(()=>{
  if(location.pathname.startsWith('/staging/player')){
    localStorage.setItem('mc-production-v1',JSON.stringify({
      spots:{},playback:{index:22,startedAt:Date.now(),duration:30000}
    }));
    window.__MC_ARIZONA_MESSAGES__=[];
    addEventListener('message',e=>{
      const data=e.data;
      if(data&&typeof data.type==='string'&&data.type.startsWith('mc-')){
        const rows=window.__MC_ARIZONA_MESSAGES__;
        rows.push({type:data.type,board:data.board,at:Date.now()});
        if(rows.length>100)rows.shift();
      }
    });
  }
});
const page=await context.newPage(),errors=[],failures=[],observations=[];
page.on('pageerror',e=>errors.push(String(e)));
page.on('response',r=>{
  if(r.status()>=400&&r.url().includes('arizona'))
    failures.push({code:r.status(),url:r.url().slice(0,250)});
});
page.on('requestfailed',r=>{
  if(r.url().includes('arizona'))
    failures.push({error:r.failure()?.errorText,url:r.url().slice(0,250)});
});
try{
  const r=await page.goto(HOST+'/staging/player.html?rotate=off&qa=arizona-rotation-target',
    {waitUntil:'domcontentloaded',timeout:45000});
  if(r.status()!==200)throw Error('Staging player unavailable');
  const until=Date.now()+85000;
  while(Date.now()<until){
    const state=await page.evaluate(()=>{
      const p=window.__MC_PRODUCTION;
      return {at:Date.now(),board:p?.current,index:p?.index,
        frames:[...document.querySelectorAll('#stage iframe')].map(f=>({
          id:f.dataset.board,visible:f.classList.contains('current'),
          ready:!!f.contentWindow?.MCBoard?.ready,active:!!f.contentWindow?.MCBoard?.active,
          href:f.src,subframe:!!f.contentWindow?.document?.querySelector('iframe')
        })),messages:window.__MC_ARIZONA_MESSAGES__?.slice(-8),
        recent:window.__MC_PRODUCTION_EVENTS?.slice(-6)};
    });
    observations.push(state);
    const seen=observations.some(o=>o.board==='page4_arizona_cfb');
    if(seen&&observations.filter(o=>o.board==='page4_arizona_cfb').length>=3)break;
    if(state.index>=24&&!seen)break;
    await page.waitForTimeout(2500);
  }
  const success=observations.some(o=>o.board==='page4_arizona_cfb');
  const summary={checkedAt:new Date().toISOString(),passed:success,
    observed:observations.length,startingBoard:observations[0]?.board,
    last:observations.at(-1),errors,failures,messages:observations.flatMap(o=>o.messages||[])
      .filter((item,i,arr)=>arr.findIndex(x=>x.at===item.at&&x.type===item.type&&x.board===item.board)===i),
    physicalOnnVerified:false,productionWrites:false};
  fs.writeFileSync('arizona-player-target.json',JSON.stringify({summary,observations},null,2));
  console.log('ARIZONA_ROTATION_REPRO',JSON.stringify(summary));
  if(!success)process.exitCode=1;
}finally{await page.screenshot({path:'arizona-player-target.png'}).catch(()=>{});await browser.close();}
