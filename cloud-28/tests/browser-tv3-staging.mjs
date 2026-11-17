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

  // Existing TV3 receiver must now accept both wing board modes as well,
  // without interfering with fixed CCW orientation or any board artwork.
  for(const [type,url] of [
    ['upcoming','https://caveup.pages.dev/'],
    ['live','https://testcave.pages.dev/'],
    ['wrestling','https://broncos5523.github.io/Inside-the-squared-circle/staging/?view=tv&mode=active&rotate=none']
  ]){
    await page.evaluate(type=>window.__mockFirebaseThird({type}),type);
    await page.waitForFunction(type=>window.__MC_TV3_REMOTE__?.getState()?.held===type,
      type,{timeout:15000});
    const target=await page.locator('#mc-tv3-single-board').getAttribute('src');
    if(target!==url)throw Error('Cloudflare Onn did not load '+type+' external board: '+target);
    console.log('PASS_TV3_LIBRARY_'+type.toUpperCase(),target);
  }
  await page.evaluate(()=>window.__mockFirebaseThird({type:'rotation'}));
  await page.waitForFunction(()=>!document.getElementById('mc-tv3-single-board'),
    null,{timeout:15000});
  // Beyond simply removing the top-layer frame, verify the 28-page player
  // itself remains live and advances after the controller returns to rotation.
  const beforeRotation=await page.evaluate(()=>({
   index:window.__MC_PRODUCTION?.index,current:window.__MC_PRODUCTION?.current
  }));
  await page.waitForFunction(before=>window.__MC_PRODUCTION?.index!==before.index&&
     !!window.__MC_PRODUCTION?.current&&
     !!document.querySelector('#stage iframe.current'),
   beforeRotation,{timeout:65000});
  const afterRotation=await page.evaluate(()=>({
   index:window.__MC_PRODUCTION?.index,current:window.__MC_PRODUCTION?.current,
   visible:document.querySelector('#stage iframe.current')?.dataset.board
  }));
  if(afterRotation.visible!==afterRotation.current)
    throw Error('Controller 28-board rotation returned but visible board did not advance');
  console.log('PASS_ONN_TV3_28_BOARD_ROTATION_AFTER_WRESTLING',JSON.stringify({beforeRotation,afterRotation}));

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

  // The owner uses a fixed URL to rotate the physical Onn display.
  // No on-screen Rotate button/menu should obstruct approved board content.
  if(await page.locator('#mc-tv3-rotate-button, #mc-tv3-rotate-menu').count()!==0)
    throw Error("Removed TV3 Rotate tab is still visible in the receiver");
  await page.goto(base+"/staging/tv3.html?rotate=ccw&test=tv3-landscape-mock",{
    waitUntil:"domcontentloaded",timeout:30000
  });
  await page.waitForFunction(()=>window.__mockFirebaseThird&&
    window.__MC_ONN_FIT_REPORT__?.mode==="ccw"&&window.__MC_ONN_FIT_REPORT__?.rotated===true,
    null,{timeout:16000});
  await page.evaluate(()=>window.__mockFirebaseThird({type:"board",board:"page4_broncos"}));
  await page.waitForFunction(()=>window.__MC_TV3_REMOTE__?.getState()?.held==="page4_broncos",
    null,{timeout:16000});
  const ccw=await page.evaluate(()=>{
    const stage=document.getElementById("stage"),frame=document.getElementById("mc-tv3-single-board");
    return {mode:window.__MC_ONN_FIT_REPORT__?.mode,rotated:window.__MC_ONN_FIT_REPORT__?.rotated,
      geometry:stage.getBoundingClientRect().toJSON(),overlay:frame.getBoundingClientRect().toJSON(),
      matrix:frame.style.transform,hasRotateMenu:!!document.querySelector("#mc-tv3-rotate-button, #mc-tv3-rotate-menu")};
  });
  if(ccw.mode!=="ccw"||!ccw.rotated||ccw.hasRotateMenu)
    throw Error("Fixed CCW URL or no-menu receiver contract broken");
  for(const dimension of ["x","y","width","height"]){
    if(Math.abs(ccw.geometry[dimension]-ccw.overlay[dimension])>2)
      throw Error("Fixed CCW board assignment misaligned on "+dimension);
  }
  console.log("PASS_TV3_FIXED_CCW_URL_NO_ROTATE_TAB",JSON.stringify(ccw));
  if(await page.locator('#mc-tv3-readonly-diagnostics').count())
    throw Error("Normal TV receiver should never display diagnostic overlay");

  // Diagnostic overlay appears only when explicitly requested. Firebase
  // remains mocked/read-only, and this does not send any controller commands.
  await page.goto(base+"/staging/tv3.html?rotate=ccw&debug=1&test=tv3-mock-diagnostics",{
    waitUntil:"domcontentloaded",timeout:30000
  });
  await page.waitForFunction(()=>window.__mockFirebaseThird&&
    document.querySelector('#mc-tv3-readonly-diagnostics')?.textContent?.includes('Firebase: Connected'),
    null,{timeout:17000});
  await page.evaluate(()=>window.__mockFirebaseThird({type:"board",board:"page1_nfl"}));
  await page.waitForFunction(()=>document.querySelector('#mc-tv3-readonly-diagnostics')?.textContent
    .includes('On screen: page1_nfl'),null,{timeout:12000});
  const diagnostic=await page.locator('#mc-tv3-readonly-diagnostics').textContent();
  if(!diagnostic.includes('Assigned: page1_nfl')||!diagnostic.includes('On screen: page1_nfl'))
    throw Error("Read-only diagnostic did not identify the receiver's selected board");
  if(await page.locator('#mc-tv3-rotate-button').count())
    throw Error("Rotate tab must remain removed even in debug mode");
  console.log("PASS_TV3_READONLY_DEBUG_STATUS_WITH_MOCKED_FIREBASE",diagnostic.replaceAll('\\n',' | '));
}finally{await browser.close();}
