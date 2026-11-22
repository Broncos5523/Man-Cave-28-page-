// Hosted Preview-only acceptance: no Cloudflare deployment, no Firebase writes.
// Watches two approved 30-second board transitions and actual browser requests.
import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const ORIGIN='https://pr-2-man-cave-28-page.broncos5523.workers.dev';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:720,height:1280},deviceScaleFactor:1,
  userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36'});
const page=await context.newPage();
const paths=new Map(),errors=[],failedResponses=[];
let success=false,first=null,second=null,failure='';
const started=Date.now();
page.on('pageerror',e=>errors.push(String(e).slice(0,350)));
page.on('request',req=>{
  let u;try{u=new URL(req.url());}catch{return;}
  if(u.origin!==ORIGIN)return;
  const key=u.pathname;paths.set(key,(paths.get(key)||0)+1);
});
page.on('response',res=>{
  let u;try{u=new URL(res.url());}catch{return;}
  if(u.origin===ORIGIN&&res.status()>=400)failedResponses.push({path:u.pathname,status:res.status()});
});
try{
  const response=await page.goto(ORIGIN+'/staging/player.html?rotate=off',
    {waitUntil:'domcontentloaded',timeout:35000});
  assert.equal(response?.status(),200,'Preview player did not load');
  await page.waitForFunction(()=>{
    const p=window.__MC_PRODUCTION;
    return p?.current&&Number.isInteger(p.index)&&document.querySelector('#stage iframe.current');
  },null,{timeout:55000});
  first=await page.evaluate(()=>({
    index:window.__MC_PRODUCTION?.index,
    board:window.__MC_PRODUCTION?.current,
    visible:document.querySelector('#stage iframe.current')?.dataset.board
  }));
  await page.waitForFunction(firstIndex=>{
    const p=window.__MC_PRODUCTION;
    return p?.current&&Number.isInteger(p.index)&&p.index!==firstIndex&&
      document.querySelector('#stage iframe.current')?.dataset.board===p.current;
  },first.index,{timeout:85000,polling:300});
  second=await page.evaluate(()=>({
    index:window.__MC_PRODUCTION?.index,
    board:window.__MC_PRODUCTION?.current,
    visible:document.querySelector('#stage iframe.current')?.dataset.board
  }));
  assert.notEqual(first.index,second.index,'Player did not rotate');
  assert.equal(first.visible,first.board,'First board not current');
  assert.equal(second.visible,second.board,'Second board not current');
  assert.equal((paths.get('/staging/api/state')||0)+(paths.get('/staging/api/heartbeat')||0),0,
    'Stateless heartbeat/state requests still reached Cloudflare');
  success=true;
}catch(e){failure=String(e?.message||e).slice(0,1200);}
const counts=Object.fromEntries([...paths].sort((a,b)=>b[1]-a[1]));
const report={success,first,second,elapsedSec:Math.round((Date.now()-started)/1000),
  workerUrls:counts,workerPathCount:[...paths.values()].reduce((a,b)=>a+b,0),
  statelessWorkerInvocations:(paths.get('/staging/api/state')||0)+(paths.get('/staging/api/heartbeat')||0),
  errors:errors.slice(0,15),failedResponses:failedResponses.slice(0,25),failure,
  productionModified:false};
console.log('QUOTA_PREVIEW_BROWSER',JSON.stringify(report));
fs.writeFileSync('quota-preview-browser.json',JSON.stringify(report,null,2));
await page.screenshot({path:'quota-preview-first-rotation.png'}).catch(()=>{});
await browser.close();
if(!success)process.exitCode=1;
