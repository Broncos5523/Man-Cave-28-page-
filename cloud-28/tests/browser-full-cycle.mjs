/* MAN CAVE SPORTS BOOK — full approved 28-page 30-second rotation.
 * A read-only long-session staging browser run, NEVER a production cutover.
 * No mocked clock: catches real timers, iframe cleanup and stale page behavior.
 */
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const HOST='https://man-cave-28-page.broncos5523.workers.dev';
const manifest=await (await fetch(HOST+'/staging/boards.json',{headers:{Accept:'application/json'}})).json();
const ids=manifest.boards?.map(b=>b.id)||[];
assert.equal(ids.length,28,'The approved Gold Master requires exactly 28 boards');
assert.equal(new Set(ids).size,28,'Duplicate board IDs in approved manifest');

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:720,height:1280},deviceScaleFactor:1});
const page=await context.newPage();
const results=[],errors=[],networkErrors=[];
page.on('pageerror',error=>{errors.push(String(error).slice(0,600))});
page.on('response',response=>{
  const url=new URL(response.url());
  if(response.status()>=400&&
     (/^\/(?:api\/board\/|production\/api\/|staging\/api\/)/.test(url.pathname)||url.pathname==='/proxy'))
    networkErrors.push({path:url.pathname,status:response.status(),at:new Date().toISOString()});
});
let failure=null;
try {
  const res=await page.goto(HOST+'/staging/player.html?rotate=off&qa=full-original-cycle',
    {waitUntil:'domcontentloaded',timeout:45000});
  assert.equal(res.status(),200);
  await page.waitForFunction(id=>window.__MC_PRODUCTION?.current===id &&
    window.__MC_PRODUCTION?.index===0 && !!window.MCSpotlightState?.peek,ids[0],{timeout:55000});
  const first=await page.evaluate(()=>{
    const p=window.__MC_PRODUCTION;
    return {index:p.index,current:p.current,visible:document.querySelector('#stage iframe.current')?.dataset.board};
  });
  assert.equal(first.current,ids[0]);
  console.log('FULL_CYCLE_START',JSON.stringify({current:ids[0],count:ids.length,at:new Date().toISOString()}));
  let last=Date.now();
  results.push({step:0,board:ids[0],at:new Date().toISOString(),elapsedMs:0,visible:first.visible});
  for(let step=1;step<=ids.length;step++){
    const target=step%ids.length,expected=ids[target];
    try{
      await page.waitForFunction(({target,expected})=>{
        const p=window.__MC_PRODUCTION;
        const visible=document.querySelector('#stage iframe.current');
        return p?.index===target && p?.current===expected &&
          visible?.dataset.board===expected;
      },{target,expected},{timeout:90000,polling:250});
      const observed=await page.evaluate(()=>{
        const p=window.__MC_PRODUCTION,visible=document.querySelector('#stage iframe.current');
        return {index:p.index,current:p.current,visible:visible?.dataset.board,
          frameCount:document.querySelectorAll('#stage iframe').length,
          ready:!!visible?.contentWindow?.MCBoard?.ready,
          active:!!visible?.contentWindow?.MCBoard?.active,
          eventCount:window.__MC_PRODUCTION_EVENTS?.length||0};
      });
      if(!observed.ready){
        await page.waitForFunction(id=>{
          const el=document.querySelector('#stage iframe.current');
          return el?.dataset.board===id&&!!el.contentWindow?.MCBoard?.ready;
        },expected,{timeout:18000});
        observed.ready=true;
      }
      const now=Date.now();
      const item={step,board:expected,at:new Date().toISOString(),
        elapsedMs:now-last,...observed};
      assert.ok(observed.frameCount<=4,'Original player retained too many old iframe instances');
      assert.ok(observed.ready,'Approved original board did not become ready');
      results.push(item);last=now;
      console.log('FULL_CYCLE_BOARD',JSON.stringify(item));
      if(step%7===0)await page.screenshot({path:'cycle-step-'+step+'.png'}).catch(()=>{});
    }catch(error){
      const details=await page.evaluate(()=>({
        current:window.__MC_PRODUCTION?.current,index:window.__MC_PRODUCTION?.index,
        frames:[...document.querySelectorAll('#stage iframe')].map(f=>({
          id:f.dataset.board,active:f.classList.contains('current'),
          ready:!!f.contentWindow?.MCBoard?.ready,src:f.src
        })),events:window.__MC_PRODUCTION_EVENTS?.slice(-12)
      })).catch(()=>null);
      failure={step,expected,message:error.message,details};
      console.error('FULL_CYCLE_FAILURE',JSON.stringify(failure));
      await page.screenshot({path:'cycle-error.png'}).catch(()=>{});
      break;
    }
  }
  if(!failure){
    assert.equal(results.length,29,'Missing one or more original rotation transitions');
    assert.equal(results.at(-1).board,ids[0],'A complete 28-board rotation did not return to the first page');
    assert.equal(errors.length,0,'JavaScript errors during extended rotation: '+errors.join(' | '));
    console.log('PASS_ALL_28_BOARDS_FULL_30_SECOND_ROTATION');
  }
}finally{
  const report={checkedAt:new Date().toISOString(),passed:!failure&&results.length===29&&errors.length===0,
    originalPageCount:ids.length,transitionsCompleted:results.length-1,results,errors,
    networkErrors:networkErrors.slice(0,40),failure,
    productionChanged:false,physicalOnnTested:false};
  fs.writeFileSync('full-28-board-rotation.json',JSON.stringify(report,null,2));
  await browser.close();
  if(!report.passed)process.exitCode=1;
}
