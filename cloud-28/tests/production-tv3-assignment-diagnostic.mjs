import {chromium} from 'playwright';
import fs from 'node:fs';
const target='https://man-cave-28-page.broncos5523.workers.dev/staging/player.html?rotate=off';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:720,height:1280},
  userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
const page=await context.newPage();
const errors=[],failures=[];
page.on('pageerror',e=>errors.push(String(e).slice(0,210)));
page.on('requestfailed',r=>{
 const url=new URL(r.url());
 if(url.hostname.includes('firebase')||url.hostname.includes('gstatic'))
   failures.push({host:url.hostname,error:r.failure()?.errorText||'unknown'});
});
let answer={readOnly:true,production:true,checkTime:new Date().toISOString()};
try{
 const response=await page.goto(target,{waitUntil:'domcontentloaded',timeout:38000});
 await page.waitForFunction(()=>window.__MC_TV3_REMOTE__?.getState?.().connected===true,
    null,{timeout:35000});
 const state=await page.evaluate(async()=>{
  const app=firebase.app('man-cave-tv3');
  const snap=await app.database().ref('screens/third').once('value');
  const v=snap.val();
  const recent=window.__MC_TV3_STAGING_EVENTS__||[];
  const updated=Number(v?.updatedAt)||0;
  return {
    assignmentType:typeof v?.type==='string'?v.type:null,
    assignmentBoard:typeof v?.board==='string'?v.board:null,
    updatedAtISO:updated?new Date(updated).toISOString():null,
    updatedAtMs:updated||null,
    receiverState:window.__MC_TV3_REMOTE__.getState(),
    receiverEvents:[...new Set(recent.map(x=>x.event))].slice(-12),
    firstCommandEvent:recent.find(x=>x.event==='command-received')?.detail||null
  };
 });
 answer={...answer,http:response?.status(),...state,errors,failures};
 console.log('PRODUCTION_32_ONN_FIREBASE_ASSIGNMENT',JSON.stringify({
   type:state.assignmentType,board:state.assignmentBoard,
   updatedAtISO:state.updatedAtISO,connected:state.receiverState.connected,
   desired:state.receiverState.desired,held:state.receiverState.held,
   events:state.receiverEvents,jsErrorCount:errors.length}));
}catch(e){answer.error=String(e).slice(0,500);console.error('PRODUCTION_TV3_SNAPSHOT_FAILED',answer.error);process.exitCode=1;}
finally{fs.writeFileSync('tv3-read-only-state.json',JSON.stringify(answer,null,2));await browser.close();}
