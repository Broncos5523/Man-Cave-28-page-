import {chromium} from 'playwright';

const root="https://man-cave-28-page.broncos5523.workers.dev";
const uri=root+"/staging/player.html?rotate=off&qa=rotation-v2";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:720,height:1280}});
const errors=[],reqs=[];
page.on("pageerror",err=>errors.push((err.stack||String(err)).slice(0,700)));
page.on("response",r=>{
  if(/\/staging\/(api\/|boards\.json|boards\/|player\.js)|\/api\/board\/|ticker_.*\.mjs/.test(r.url()))
    reqs.push({code:r.status(),path:new URL(r.url()).pathname});
});
await page.route('**/*',route=>route.request().resourceType()==="image"?route.abort():route.continue());
try{
  const response=await page.goto(uri,{waitUntil:"domcontentloaded",timeout:30000});
  console.log("ROTATION_NAV",response?.status(),page.url());
  await page.waitForFunction(()=>!!window.__MC_PRODUCTION?.current,{timeout:22000});
  const initial=await page.evaluate(()=>({
    current:window.__MC_PRODUCTION?.current,
    index:window.__MC_PRODUCTION?.index,
    frames:window.__MC_PRODUCTION?.frames,
    manifest:window.MCStore?.playback,
    spotlight:!!window.MCSpotlightState?.peek,
    orientation:window.__MC_ONN_FIT_REPORT__?.mode,
    history:window.__MC_PRODUCTION_EVENTS?.slice(-6)
  }));
  console.log("ROTATION_FIRST",JSON.stringify(initial));
  if(initial.current!=="page1_nfl"||initial.index!==0||!initial.spotlight)
    throw Error("Original first board or approved spotlight state missing");
  // Let original 30-second deadline elapse; diagnose iframe readiness
  // before asserting. waitForFunction options are the *third* argument.
  try{
    await page.waitForFunction(()=>window.__MC_PRODUCTION?.current==="page2_nfl",null,{timeout:55000});
  }catch(e){
    const stuck=await page.evaluate(()=>({
      current:window.__MC_PRODUCTION?.current,
      index:window.__MC_PRODUCTION?.index,
      frames:[...document.querySelectorAll('#stage iframe')].map(f=>({
        board:f.dataset.board,url:f.src,visible:f.classList.contains('current'),
        runtimeReady:f.contentWindow?.MCBoard?.ready,
        runtimeActive:f.contentWindow?.MCBoard?.active,
        runtimeError:f.contentWindow?.__MC_STAGING_HOST__||null
      })),
      events:window.__MC_PRODUCTION_EVENTS?.slice(-18)
    }));
    console.log('ROTATION_STUCK',JSON.stringify(stuck));
    console.log('ROTATION_REQUESTS_ON_FAILURE',JSON.stringify(reqs.slice(-100)));
    console.log('ROTATION_ERRORS_ON_FAILURE',JSON.stringify(errors.slice(0,20)));
    throw e;
  }
  const second=await page.evaluate(()=>({
    current:window.__MC_PRODUCTION?.current,
    index:window.__MC_PRODUCTION?.index,
    frames:window.__MC_PRODUCTION?.frames,
    visible:document.querySelector("#stage iframe.current")?.dataset.board,
    history:window.__MC_PRODUCTION_EVENTS?.filter(e=>e.event==="board-visible")
  }));
  console.log("ROTATION_SECOND",JSON.stringify(second));
  console.log("ROTATION_REQUESTS",JSON.stringify(reqs.slice(0,50)));
  console.log("ROTATION_ERRORS",JSON.stringify(errors.slice(0,12)));
  if(second.index!==1||second.visible!=="page2_nfl")throw Error("Approved second board did not replace first");
  if(!reqs.some(x=>x.code===200&&x.path==="/staging/boards.json"))throw Error("Board manifest not loaded");
  if(!reqs.some(x=>x.code===200&&x.path.startsWith("/staging/api/state")))throw Error("Local playback API unavailable");
  for(const ticker of ["ticker_nfl_final.mjs","ticker_pro_final.mjs","ticker_college_final.mjs"]){
    const bad=reqs.some(x=>x.path==="/"+ticker&&![200,304].includes(x.code));
    if(bad)throw Error("Original ticker missing: "+ticker);
  }
  console.log("PASS_CLOUDFLARE_ORIGINAL_ROTATION_30S");
}finally{await browser.close();}
