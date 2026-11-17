import {chromium} from "playwright";
const base="https://man-cave-28-page.broncos5523.workers.dev";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:720,height:1280}});
const errors=[],responses=[];
page.on("pageerror",e=>errors.push((e.stack||String(e)).slice(0,700)));
page.on("response",r=>{
  if(r.url().includes("/api/board/page1_nfl"))responses.push({status:r.status(),url:r.url()});
});
await page.route("**/*",route=>route.request().resourceType()==="image"?route.abort():route.continue());
try{
  const r=await page.goto(base+"/staging/boards/page1_nfl.html?contract=nfl-p1-live-v1",
    {waitUntil:"domcontentloaded",timeout:28000});
  console.log("NFL_PAGE1_NAV",r?.status(),page.url());
  await page.waitForFunction(()=>{
    try{
      const f=JSON.parse(localStorage.getItem("mc-v2-feed-page1_nfl")||"null");
      return f?.dataState==="current"&&f?.standings?.groups?.length===2&&
        f?.context?.sport==="nfl";
    }catch{return false;}
  },null,{timeout:23000});
  const d=await page.evaluate(()=>{
    const f=JSON.parse(localStorage.getItem("mc-v2-feed-page1_nfl"));
    return {year:f.context.year,groups:f.standings.groups.map(x=>({name:x.name,teams:x.entries.length})),
      ticker:f.ticker.selected.length,domReady:!!window.MCBoard?.ready,
      updates:document.querySelectorAll(".teamrow").length,
      source:f.migration.sections,
      title:document.title};
  });
  console.log("NFL_PAGE1_BROWSER_DATA",JSON.stringify(d));
  console.log("NFL_PAGE1_BROWSER_API",JSON.stringify(responses));
  console.log("NFL_PAGE1_BROWSER_ERRORS",JSON.stringify(errors.slice(0,6)));
  if(responses.some(x=>x.status!==200)||!responses.length)throw Error("NFL Page 1 API did not return 200");
  if(errors.length)throw Error("Original page javascript threw during live data load");
  if(!d.domReady)throw Error("Approved original board never reported ready");
  if(d.groups.some(x=>x.teams!==16))throw Error("Expected all 32 current NFL clubs");
  console.log("PASS_LIVE_NFL_PAGE1_CLOUDFLARE_BROWSER");
}finally{await browser.close();}
