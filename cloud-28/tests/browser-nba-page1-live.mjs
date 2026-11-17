import {chromium} from "playwright";
const host="https://man-cave-28-page.broncos5523.workers.dev";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:720,height:1280}});
const errors=[],api=[];
page.on("pageerror",e=>errors.push((e.stack||String(e)).slice(0,750)));
page.on("response",r=>{if(r.url().includes("/api/board/page1_nba"))api.push({code:r.status(),url:r.url()})});
await page.route("**/*",route=>route.request().resourceType()==="image"?route.abort():route.continue());
try{
  const navigation=await page.goto(host+"/staging/boards/page1_nba.html?nba=cloudflare-2026-27-v1",
    {waitUntil:"domcontentloaded",timeout:30000});
  console.log("NBA_PAGE1_NAV",navigation?.status(),page.url());
  await page.waitForFunction(()=>{
    try{
      const f=JSON.parse(localStorage.getItem("mc-v2-feed-page1_nba")||"null");
      return f?.dataState==="current"&&f?.context?.sport==="nba"&&
        f?.standings?.groups?.length===2&&f?.playoffs?.matches?.length===8;
    }catch{return false;}
  },null,{timeout:28000});
  const state=await page.evaluate(()=>{
    const feed=JSON.parse(localStorage.getItem("mc-v2-feed-page1_nba"));
    return {ready:!!window.MCBoard?.ready,season:feed.context.label,
      standings:feed.standings.groups.map(g=>({name:g.name,count:g.entries.length})),
      ticker:feed.ticker.selected.length,projected:feed.playoffs.matches.length,
      names:[...document.querySelectorAll(".standing-row .team-name")].slice(0,5).map(x=>x.textContent.trim()),
      DOMRows:document.querySelectorAll(".standing-row").length,
      seenTicker:!!document.querySelector(".mc-ticker-track")}
  });
  console.log("NBA_PAGE1_BROWSER_STATE",JSON.stringify(state));
  console.log("NBA_PAGE1_BROWSER_API",JSON.stringify(api));
  console.log("NBA_PAGE1_BROWSER_ERRORS",JSON.stringify(errors.slice(0,9)));
  if(!api.some(x=>x.code===200)||api.some(x=>x.code>=400))throw Error("NBA Page1 browser did not receive verified source");
  if(!state.ready||state.standings.some(g=>g.count!==15))throw Error("NBA original visual/runtime did not apply season standings");
  if(errors.length)throw Error("NBA original board had JavaScript errors");
  console.log("PASS_CLOUDFLARE_ORIGINAL_NBA_PAGE1_LIVE");
}finally{await browser.close();}
