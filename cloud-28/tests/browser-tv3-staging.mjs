import {chromium} from "playwright";

const base="https://man-cave-28-page.broncos5523.workers.dev";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:720,height:1280}});
const errors=[];
page.on("pageerror",e=>errors.push((e.stack||String(e)).slice(0,600)));
await page.route("https://www.gstatic.com/firebasejs/**",route=>
  route.fulfill({status:200,contentType:"application/javascript",body:"// mocked Firebase SDK by read-only stage acceptance test"}));
await page.route("**/*",route=>route.request().resourceType()==="image"?route.abort():route.continue());
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
}finally{await browser.close();}
