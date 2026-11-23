import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const host='https://man-cave-28-page.broncos5523.workers.dev';
const source=readFileSync('cloud-28/favorite-next-live.js','utf8');
const browser=await chromium.launch({headless:true});
const boards=[
 {id:'page1_cfb',selector:'.favorite-next',opponent:'VS ARIZONA STATE',date:'NOV 28',forbidden:/OCT 10|WEST VIRGINIA/},
 {id:'page1_cbb',selector:'.favnext',opponent:'VS COLORADO STATE',date:'NOV 23',forbidden:/SEASON OPENING SOON/}
];
const results=[];
try{
 for(const cfg of boards){
   const ctx=await browser.newContext({viewport:{width:720,height:1280}}),page=await ctx.newPage();
   const errors=[],requests=[];
   await ctx.addInitScript({content:source});
   page.on('pageerror',e=>errors.push(e.message));
   page.on('response',r=>{if(r.url().includes('/teams/12/schedule'))requests.push({status:r.status(),url:r.url()})});
   try{
    const nav=await page.goto(host+'/staging/boards/'+cfg.id+'?audit=verified-favorite-next',{waitUntil:'domcontentloaded',timeout:40000});
    assert.equal(nav?.status(),200);
    await page.waitForFunction(({selector,opponent,date})=>{
      const text=document.querySelector(selector)?.textContent||'';
      return text.includes(opponent)&&text.includes(date);
    },{selector:cfg.selector,opponent:cfg.opponent,date:cfg.date},{timeout:25000});
    const state=await page.evaluate(selector=>{
      const elem=document.querySelector(selector);
      return {text:elem?.textContent,html:elem?.outerHTML,status:window.__MC_FAVORITE_NEXT_STATUS__,
        ready:window.MCBoard?.ready};
    },cfg.selector);
    assert.doesNotMatch(state.text||'',cfg.forbidden);
    assert.ok(state.status?.selectedEvent&&state.status?.selectedDate,'Only real official event data is permitted');
    assert.equal(state.ready,true);
    assert.deepEqual(errors,[]);
    const api=await page.evaluate(async id=>{
      try{const r=await fetch('/api/board/'+id+'?diag='+Date.now(),{cache:'no-store'});
        const raw=await r.text();return {status:r.status,body:raw.slice(0,450)};}
      catch(error){return {error:String(error)}}
    },cfg.id);
    results.push({board:cfg.id,pass:true,event:state.status.selectedEvent,text:state.text,requests,api,errors});
   }catch(error){results.push({board:cfg.id,pass:false,error:String(error),errors,requests});}
   console.log('ARIZONA_FAVORITE_NEXT_PREVIEW',JSON.stringify(results.at(-1)));
   await ctx.close();
 }
}finally{await browser.close();}
if(results.some(x=>!x.pass))process.exitCode=1;
