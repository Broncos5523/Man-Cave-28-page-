import {chromium} from "playwright";
const base="https://man-cave-28-page.broncos5523.workers.dev";
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:720,height:1280}});
const errors=[],responses=[];
page.on("pageerror",e=>errors.push((e.stack||String(e)).slice(0,750)));
page.on("response",r=>{if(r.url().includes("/api/board/page2_nfl"))responses.push({status:r.status(),url:r.url()})});
await page.route("**/*",route=>route.request().resourceType()==="image"?route.abort():route.continue());
try {
  const response=await page.goto(base+"/staging/boards/page2_nfl.html?qa=nfl-p2-live-verified-v1",
     {waitUntil:"domcontentloaded",timeout:30000});
  console.log("NFL_P2_NAV",response?.status(),page.url());
  await page.waitForFunction(()=>{
    try {
      const feed=JSON.parse(localStorage.getItem("mc-v2-feed-page2_nfl")||"null");
      return feed?.dataState==="current"&&feed?.context?.sport==="nfl"&&
        feed?.leaders?.players?.length===6&&feed?.teamPanels?.leaders?.length===5;
    }catch{return false}
  },null,{timeout:27000});
  const result=await page.evaluate(()=>{
    const data=JSON.parse(localStorage.getItem("mc-v2-feed-page2_nfl"));
    const playerCards=[...document.querySelectorAll(".leader-card,#leaderGrid .card")].map(x=>x.textContent.trim().replace(/\s+/g," ").slice(0,130));
    const teamCards=[...document.querySelectorAll(".team-card,.teamCard")].map(x=>x.textContent.trim().replace(/\s+/g," ").slice(0,110));
    return {
      ready:!!window.MCBoard?.ready,
      year:data.context.year,
      playerNames:data.leaders.players.map(x=>x.name),
      playerLabels:data.leaders.players.map(x=>x.label),
      teamLeaders:data.teamPanels.leaders.map(x=>x.team.name),
      DOMPlayers:playerCards.slice(0,8),
      DOMTeams:teamCards.slice(0,8),
      tickerCount:data.ticker?.selected?.length
    };
  });
  console.log("NFL_P2_BROWSER_DATA",JSON.stringify(result));
  console.log("NFL_P2_BROWSER_REQUESTS",JSON.stringify(responses));
  console.log("NFL_P2_BROWSER_ERRORS",JSON.stringify(errors.slice(0,8)));
  if(responses.length<1||responses.some(r=>r.status!==200))throw Error("Original Page2 runtime did not load verified Cloudflare API");
  if(!result.ready)throw Error("Original v8l Page2 never signaled ready");
  if(errors.length)throw Error("Original Page2 threw JS exceptions during current data loading");
  if(result.DOMPlayers.length<6||result.DOMTeams.length<5)throw Error("Approved 6+5 cards not present");
  const joined=result.DOMPlayers.join(" ")+" "+result.DOMTeams.join(" ");
  if(!result.playerNames.slice(0,6).every(n=>joined.toLowerCase().includes(n.toLowerCase())))
    throw Error("Original player names did not render into card DOM");
  console.log("PASS_CLOUDFLARE_LIVE_NFL_PAGE2_ORIGINAL_RENDERER");
} finally {await browser.close()}
