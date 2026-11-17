import {chromium} from "playwright";

const base="https://man-cave-28-page.broncos5523.workers.dev";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:720,height:1280}});
const errors=[];
page.on("pageerror",e=>errors.push((e.stack||String(e)).slice(0,600)));
// General route FIRST. Playwright evaluates newer route handlers before older
// handlers, so install the Firebase stub AFTER it to prevent real auth access.
await page.route("**/*",route=>route.request().resourceType()==="image"?route.abort():route.fallback());
await page.route("https://www.gstatic.com/firebasejs/**",route=>
  route.fulfill({status:200,contentType:"application/javascript",body:"// mocked Firebase SDK by read-only stage acceptance test"}));
await page.addInitScript(()=>{
  window.firebase={
    app(){throw Error("No pre-existing named app in mock");},
    initializeApp(){
      return {
        auth(){return {signInAnonymously(){return Promise.resolve({user:{uid:"mock-only"}})}};},
        database(){return {ref(path){
          if(path!=="screens/third")throw Error("Unexpected database path:"+path);
          return {on(event,callback){
            if(event!=="value")throw Error("Read-only test requires value listener");
            window.__mockFirebaseThird=(value)=>callback({val:()=>value});
            callback({val:()=>({type:"rotation"})});
          }};
        }};}
      };
    }
  };
});
try{
  const res=await page.goto(base+"/staging/tv3.html?rotate=off&test=tv3-mock-readonly",{waitUntil:"domcontentloaded",timeout:30000});
  console.log("TV3_NAV",res?.status(),page.url());
  try{
    await page.waitForFunction(()=>!!window.__mockFirebaseThird&&!!window.__MC_PRODUCTION?.current,null,{timeout:11000});
  }catch(error){
    console.log("TV3_INIT_DIAGNOSTIC",JSON.stringify(await page.evaluate(()=>({
      url:location.href,
      scripts:[...document.querySelectorAll('script[src]')].map(x=>x.src),
      player:window.__MC_PRODUCTION?.current||null,
      mock:!!window.__mockFirebaseThird,
      firebase:!!window.firebase,
      receiver:window.__MC_TV3_REMOTE__?.getState?.()||null,
      events:window.__MC_TV3_STAGING_EVENTS__||null
    }))));
    console.log("TV3_INIT_ERRORS",JSON.stringify(errors));
    throw error;
  }
  console.log("TV3_START",JSON.stringify(await page.evaluate(()=>({
    player:window.__MC_PRODUCTION?.current,receiver:window.__MC_TV3_REMOTE__?.getState(),events:window.__MC_TV3_STAGING_EVENTS__?.slice(-5)
  }))));
  await page.evaluate(()=>window.__mockFirebaseThird({type:"board",board:"page4_broncos"}));
  await page.waitForFunction(()=>window.__MC_TV3_REMOTE__?.getState()?.held==="page4_broncos",null,{timeout:15000});
  const single=await page.evaluate(()=>({
    state:window.__MC_TV3_REMOTE__?.getState(),
    src:document.getElementById("mc-tv3-single-board")?.getAttribute("src"),
    stageSize:document.getElementById("stage")?.getBoundingClientRect().toJSON(),
    overlaySize:document.getElementById("mc-tv3-single-board")?.getBoundingClientRect().toJSON()
  }));
  console.log("TV3_SINGLE",JSON.stringify(single));
  if(!single.src?.startsWith("/staging/boards/page4_broncos.html?tv3=hold"))
    throw Error("Cloudflare receiver did not honor approved third-TV individual board assignment");
  await page.evaluate(()=>window.__mockFirebaseThird({type:"rotation"}));
  await page.waitForFunction(()=>!document.getElementById("mc-tv3-single-board"),null,{timeout:12000});
  const final=await page.evaluate(()=>({
    state:window.__MC_TV3_REMOTE__?.getState(),current:window.__MC_PRODUCTION?.current
  }));
  console.log("TV3_RETURN",JSON.stringify(final));
  if(final.state.held!==""||final.current!=="page1_nfl")
    throw Error("Returning to approved 28-page rotation failed");
  console.log("TV3_ERRORS",JSON.stringify(errors.slice(0,10)));
  console.log("PASS_TV3_EXISTING_FIREBASE_ASSIGNMENT_PROTOCOL_CLOUDFLARE_STAGING_MOCKED_READ_ONLY");

  // Onn HDMI output is landscape even when the physical TV is portrait.
  // Verify the approved rotation/fit matrix is mirrored on the selected board.
  await page.setViewportSize({width:1920,height:1080});
  await page.goto(base+"/staging/tv3.html?rotate=cw&test=tv3-landscape-mock",{
    waitUntil:"domcontentloaded",timeout:30000
  });
  await page.waitForFunction(()=>!!window.__mockFirebaseThird&&!!window.__MC_ONN_FIT_REPORT__,null,{timeout:16000});
  await page.evaluate(()=>window.__mockFirebaseThird({type:"board",board:"page4_broncos"}));
  await page.waitForFunction(()=>window.__MC_TV3_REMOTE__?.getState()?.held==="page4_broncos",null,{timeout:16000});
  const rotated=await page.evaluate(()=>{
    const stage=document.getElementById("stage"),frame=document.getElementById("mc-tv3-single-board");
    return {
      fit:window.__MC_ONN_FIT_REPORT__,
      stage:stage.getBoundingClientRect().toJSON(),
      overlay:frame.getBoundingClientRect().toJSON(),
      matrix:frame.style.transform,
      src:frame.getAttribute("src")
    };
  });
  console.log("TV3_LANDSCAPE_ROTATED",JSON.stringify(rotated));
  for(const dimension of ["x","y","width","height"]){
    if(Math.abs(rotated.stage[dimension]-rotated.overlay[dimension])>2)
      throw Error("Landscape Onn overlay misaligned on "+dimension);
  }
  if(!rotated.fit.rotated||rotated.fit.mode!=="cw")
    throw Error("Expected original approved clockwise Onn rotation");
  console.log("PASS_CLOUDFLARE_TV3_ONN_LANDSCAPE_90DEG_GEOMETRY");

  // The on-TV orientation chooser must work with D-pad/click without touching
  // Firebase assignments or the approved board HTML. It is an outer HUD only.
  const orientationButton=page.locator('#mc-tv3-rotate-button');
  if(await orientationButton.count()!==1)throw Error("Onn TV orientation control missing");
  await orientationButton.click();
  const menu=page.locator('#mc-tv3-rotate-menu');
  if(!await menu.isVisible())throw Error("Screen orientation menu failed to open");
  const cwSelected=await page.locator('#mc-tv3-rotate-menu button[data-mode="cw"]').getAttribute('aria-pressed');
  if(cwSelected!=='true')throw Error("TV receiver did not identify selected clockwise orientation");
  await page.locator('#mc-tv3-rotate-menu button[data-mode="ccw"]').click();
  await page.waitForURL(url=>['/staging/tv3','/staging/tv3.html'].includes(url.pathname)&&url.searchParams.get('rotate')==='ccw'
    &&url.searchParams.get('test')==='tv3-landscape-mock',{timeout:20000});
  await page.waitForFunction(()=>window.__MC_ONN_FIT_REPORT__?.mode==="ccw"&&
    window.__MC_ONN_FIT_REPORT__?.rotated===true,null,{timeout:17000});
  const oriented=await page.evaluate(()=>({
    mode:window.__MC_ONN_FIT_REPORT__?.mode,
    selected:document.querySelector('#mc-tv3-rotate-menu button.selected')?.dataset.mode,
    parent:window.__MC_TV3_REMOTE__?.getState?.()
  }));
  if(oriented.mode!=='ccw'||oriented.selected!=='ccw')
    throw Error('Onn CCW menu choice did not update the actual rotated stage');
  console.log('PASS_CLOUDFLARE_TV3_SCREEN_ORIENTATION_MENU_NO_FIREBASE_WRITE',JSON.stringify(oriented));
}finally{await browser.close();}
