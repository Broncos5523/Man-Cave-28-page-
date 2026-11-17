import {chromium} from 'playwright';

const root='https://man-cave-28-page.broncos5523.workers.dev';
const manifest=await (await fetch(root+'/staging/boards.json',{headers:{'User-Agent':'ManCaveBoardAudit/1.0'}})).json();
if(manifest.boards.length!==28)throw Error('Not the approved 28-board manifest');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:720,height:1280}});
const results=[];
for(const board of manifest.boards){
  const page=await context.newPage();
  const failed=new Map(),errors=[];
  page.on('pageerror',e=>errors.push((e.stack||String(e)).slice(0,300)));
  page.on('response',r=>{
    const uri=new URL(r.url());
    if(r.status()>=400 && /^\/(?:api|production|proxy|migration-api|runtime_|ticker_)/.test(uri.pathname))
      failed.set(uri.pathname,(failed.get(uri.pathname)||0)+1);
  });
  // Don't repeatedly download headshots/artwork in this compatibility audit.
  await page.route('**/*',route=>route.request().resourceType()==='image'?route.abort():route.continue());
  let code=0,seen={};
  try{
    const res=await page.goto(root+'/staging/boards/'+board.id+'.html?audit=28-v1',{waitUntil:'domcontentloaded',timeout:20000});
    code=res?.status()||0;
    await page.waitForTimeout(2000);
    seen=await page.evaluate(()=>({
      bridge:!!window.MCBoard?.activate,
      ready:!!window.MCBoard?.ready,
      shim:window.__MC_CLOUDFLARE_PUBLIC_FEED_RELAY__||null,
      stat:document.body?.textContent?.replace(/\s+/g,' ').slice(0,95)||'',
      html:document.body?.children?.length||0
    }));
  }catch(e){errors.push(String(e).slice(0,400));}
  finally{await page.close();}
  const row={id:board.id,sport:board.sport,code,bridge:seen.bridge,ready:seen.ready,
    shim:seen.shim,blocks:seen.html,failed:[...failed].map(([path,count])=>({path,count})).slice(0,10),errors:errors.slice(0,3)};
  results.push(row);
  console.log('BOARD_AUDIT',JSON.stringify(row));
}
console.log('AUDIT_SUMMARY',JSON.stringify({
  boards:results.length,
  html200:results.filter(x=>x.code===200).length,
  ready:results.filter(x=>x.ready).length,
  missing:results.filter(x=>x.code!==200||!x.bridge).map(x=>x.id),
  withApiErrors:results.filter(x=>x.failed.length).map(x=>x.id)
}));
await browser.close();
if(results.some(x=>x.code!==200||!x.bridge||!x.shim))
  throw Error('At least one approved Cloudflare board does not load its original runtime and staging data shim');
// For dynamic/stat API failures we report the detailed gaps; don't pretend all 28 are live.
console.log('PASS_28_BOARD_VISUAL_AND_RUNTIME_AUDIT_DYNAMIC_GAPS_REPORTED');
