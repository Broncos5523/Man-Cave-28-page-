import test from "node:test";
import assert from "node:assert/strict";
import app,{seasonStatsFromSite} from "../cloudflare-live-proxy.mjs";

// This fixture intentionally contains a MUCH LARGER career total so a silent
// totals[] fallback would fail rather than masquerade as current-season data.
const siteFixture={
  filters:[{name:"league",value:"nfl"},{name:"seasontype",value:"2"}],
  categories:[
    {name:"passing",names:["passingYards","passingTouchdowns","completionPct","missing"],
     totals:["9,436","65","64.0","10,000"],
     statistics:[
       {teamId:"7",season:{year:2024},stats:["3,775","29","66.3",""]},
       {teamId:"7",season:{year:2025},stats:["3,931","25","63.4",""]},
       {teamId:"7",season:{year:2026},stats:["1,846","11","60.6",null]}
     ]},
    {name:"rushing",names:["rushingYards","rushingTouchdowns"],
     totals:["902","11"],
     statistics:[{teamId:"7",season:{year:2026},stats:["116","2"]}]}
  ]
};
test("2026 ESPN Site player stats adapt exactly to original Core season split contract",()=>{
  const out=seasonStatsFromSite(siteFixture,2026,"4426338","7");
  assert.equal(out.season.year,2026);
  assert.match(out.$ref,/\/seasons\/2026\/types\/2\/athletes\/4426338\/statistics\/0/);
  assert.match(out.season.$ref,/\/seasons\/2026/);
  const pass=out.splits.categories.find(x=>x.name==="passing");
  assert.equal(pass.stats.find(x=>x.name==="passingYards").value,1846);
  assert.equal(pass.stats.find(x=>x.name==="passingTouchdowns").value,11);
  assert.equal(pass.stats.find(x=>x.name==="completionPct").value,60.6);
  assert.equal(pass.stats.find(x=>x.name==="missing"),undefined,"NULL must not become zero");
  assert.notEqual(pass.stats.find(x=>x.name==="passingYards").value,9436,"career total incorrectly used");
  assert.equal(out.splits.categories.find(x=>x.name==="rushing").stats[0].value,116);
});
test("rejects incorrect season, wrong team, and postseason data",()=>{
  assert.throws(()=>seasonStatsFromSite(siteFixture,2027,"4426338","7"));
  assert.throws(()=>seasonStatsFromSite(siteFixture,2026,"4426338","99"));
  const post={...siteFixture,filters:[{name:"seasontype",value:"3"}]};
  assert.throws(()=>seasonStatsFromSite(post,2026,"4426338","7"));
});
test("actual Worker route returns season-shaped ESPN Site stats (no incoming private headers)",async()=>{
  const saved=globalThis.fetch;
  let seen;
  globalThis.fetch=async(url,opts)=>{
    seen={url,opts};
    return new Response(JSON.stringify(siteFixture),{status:200,headers:{"Content-Type":"application/json"}});
  };
  try{
    const address="https://man-cave-28-page.broncos5523.workers.dev/migration-api/nfl/season-stats?season=2026&athlete=4426338&team=7";
    const r=await app.fetch(new Request(address,{headers:{Cookie:"privatecookie",Authorization:"Bearer private"}}),{},null);
    assert.equal(r.status,200);
    const result=await r.json();
    assert.equal(result.splits.categories[0].stats[0].value,1846);
    assert.match(seen.url,/^https:\/\/site\.api\.espn\.com\/apis\/common\/v3\/sports\/football\/nfl\/athletes\/4426338\/stats\?season=2026&seasontype=2$/);
    assert.equal(seen.opts?.headers?.Authorization,undefined);
    assert.equal(seen.opts?.headers?.Cookie,undefined);
    assert.equal(r.headers.get("X-Man-Cave-Data-Source"),"espn-site-season-row");
  }finally{globalThis.fetch=saved;}
});
test("unknown seasons and teams are rejected",async()=>{
  const host="https://man-cave-28-page.broncos5523.workers.dev";
  for(const q of ["season=2026&athlete=4426338&team=8","season=1999&athlete=4426338&team=7","season=2026&athlete=../../x&team=7"]){
    const r=await app.fetch(new Request(host+"/migration-api/nfl/season-stats?"+q),{},null);
    assert.equal(r.status,400);
  }
});
