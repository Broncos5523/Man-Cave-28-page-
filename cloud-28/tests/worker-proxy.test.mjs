import test from "node:test";
import assert from "node:assert/strict";
import app,{validExternal,ttlFor,seasonStatsFromSite} from "../cloudflare-live-proxy.mjs";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const host="https://man-cave-28-page.broncos5523.workers.dev";
test("public feed allowlist rejects SSRF, HTTP and credentials",()=>{
  for(const url of [
    "http://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",
    "https://127.0.0.1:8080/secrets",
    "https://metadata.google.internal/computeMetadata/v1/",
    "https://sports.core.api.espn.com.evil.example/api",
    "https://user:pass@site.api.espn.com/api",
    "https://site.api.espn.com:8443/api",
    "javascript:alert(1)"
  ]) assert.throws(()=>validExternal(url),{name:"Error"},url);
});
test("public sports hosts accepted; scoreboard TTL stays short",()=>{
  const u=validExternal("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
  assert.equal(u.hostname,"site.api.espn.com");
  assert.equal(ttlFor(u),35);
});
test("read-only Cloudflare relay delivers ESPN JSON and strips incoming secrets",async()=>{
  const native=globalThis.fetch;
  let called;
  globalThis.fetch=async (url,options)=>{
    called={url,options};
    return new Response(JSON.stringify({events:[{id:"test"}]}),{
      status:200,headers:{"Content-Type":"application/json"}
    });
  };
  try {
    const url=host+"/proxy?url="+encodeURIComponent("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
    const out=await app.fetch(new Request(url,{headers:{Cookie:"private",Authorization:"Bearer no"}}),{},null);
    assert.equal(out.status,200);
    assert.deepEqual(await out.json(),{events:[{id:"test"}]});
    assert.equal(out.headers.get("X-Man-Cave-Data-Source"),"public-upstream");
    assert.equal(called.url,"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
    assert.equal(called.options.headers.Cookie,undefined);
    assert.equal(called.options.headers.Authorization,undefined);
  }finally {globalThis.fetch=native;}
});
test("rejects unsupported upstream content type without leaking it",async()=>{
  const native=globalThis.fetch;
  globalThis.fetch=async()=>new Response("<html>not json</html>",{headers:{"Content-Type":"text/html"}});
  try {
    const url=host+"/proxy?url="+encodeURIComponent("https://site.api.espn.com/fake");
    const r=await app.fetch(new Request(url),{},null);
    assert.equal(r.status,502);
  }finally {globalThis.fetch=native;}
});
test("blocks non-GET relay and arbitrary domain",async()=>{
  const bad=host+"/proxy?url="+encodeURIComponent("https://example.com/data");
  assert.equal((await app.fetch(new Request(bad),{},null)).status,403);
  assert.equal((await app.fetch(new Request(host+"/proxy",{method:"POST"}),{},null)).status,405);
});
test("migration health advertises unported features accurately",async()=>{
  const r=await app.fetch(new Request(host+"/migration-api/health"),{},null);
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.boardApi,"NOT PORTED");
  assert.equal(data.firebaseTV,"NOT SWITCHED");
});
test("other requests defer to static assets",async()=>{
  const seen=[];
  const env={ASSETS:{fetch:async req=>{seen.push(new URL(req.url).pathname);return new Response("staged", {status:200});}}};
  const r=await app.fetch(new Request(host+"/staging/"),env,{});
  assert.equal(r.status,200);assert.equal(await r.text(),"staged");
  assert.deepEqual(seen,["/staging/"]);
});


// ESPN site/common v3 has season rows AND aggregated career "totals".
// No career aggregate is ever valid as a 2026 Broncos season number.
const nflFixture={
  filters:[{name:"seasontype",value:"2"}],
  categories:[
    {name:"passing",names:["passingYards","passingTouchdowns","completionPct"],
     totals:["9,436","65","64.0"],
     statistics:[
       {teamId:"7",season:{year:2024},stats:["3,775","29","66.3"]},
       {teamId:"7",season:{year:2025},stats:["3,931","25","63.4"]},
       {teamId:"7",season:{year:2026},stats:["1,842","11","60.6"]}]},
    {name:"rushing",names:["rushingYards","rushingTouchdowns"],totals:["902","11"],
     statistics:[{teamId:"7",season:{year:2026},stats:["116","2"]}]},
    {name:"defensive",names:["totalTackles","sacks","interceptions"],totals:["500","5","3"],
     statistics:[{teamId:"7",season:{year:2026},stats:["0","0","0"]}]}
  ]
};
test("Broncos site adapter uses only requested season and team, not career totals",()=>{
  const data=seasonStatsFromSite(nflFixture,2026,"4426338");
  assert.ok(data.$ref.includes("/seasons/2026/types/2/athletes/4426338/statistics/0"));
  assert.ok(data.season.$ref.includes("/seasons/2026"));
  const flat=new Map(data.splits.categories.flatMap(c=>c.stats.map(s=>[c.name+"."+s.name,s.value])));
  assert.equal(flat.get("passing.passingYards"),1842);
  assert.equal(flat.get("passing.passingTouchdowns"),11);
  assert.equal(flat.get("passing.completionPct"),60.6);
  assert.equal(flat.get("rushing.rushingYards"),116);
  assert.equal(flat.get("defensive.totalTackles"),0);
  assert.equal([...flat.values()].includes(9436),false,"Never show career yardage as 2026");
});
test("Broncos site adapter fails closed on wrong season or wrong team",()=>{
  assert.throws(()=>seasonStatsFromSite(nflFixture,2027,"4426338"),/No verified current-year|ESPN did not confirm regular-season/);
  assert.throws(()=>seasonStatsFromSite(nflFixture,2026,"4426338","33"),/No verified current-year|ESPN did not confirm regular-season/);
  assert.throws(()=>seasonStatsFromSite({categories:[{name:"passing",names:["passingYards"],totals:["99999"]}]},2026,"4426338"),/No verified current-year|ESPN did not confirm regular-season/);
});
test("Cloudflare NFL stats route returns a Core-compatible response built from 2026 row",async()=>{
  const real=globalThis.fetch;let url,authorization;
  globalThis.fetch=async(target,options)=>{
    url=target;authorization=options.headers.Authorization;
    return new Response(JSON.stringify(nflFixture),{status:200,headers:{"Content-Type":"application/json"}});
  };
  try{
    const req=new Request(host+"/migration-api/nfl/season-stats?athlete=4426338&season=2026&team=7",
      {headers:{Authorization:"Bearer private"}});
    const resp=await app.fetch(req,{},null);
    assert.equal(resp.status,200);
    assert.equal(resp.headers.get("X-Man-Cave-Data-Source"),"espn-site-season-row");
    assert.match(url,/^https:\/\/site\.api\.espn\.com\/apis\/common\/v3\/sports\/football\/nfl\/athletes\/4426338\/stats\?season=2026&seasontype=2$/);
    assert.equal(authorization,undefined);
    const body=await resp.json();
    assert.equal(body.splits.categories.find(x=>x.name==="passing").stats.find(x=>x.name==="passingYards").value,1842);
    assert.ok(!JSON.stringify(body).includes("9,436"));
    const invalid=await app.fetch(new Request(host+"/migration-api/nfl/season-stats?athlete=4426338&season=2026&team=8"),{},null);
    assert.equal(invalid.status,400);
  }finally{globalThis.fetch=real;}
});
test("Staging shim rewrites only Broncos NFL player-stat requests",async()=>{
  const source=readFileSync(new URL("../cloudflare-public-feed-shim.js",import.meta.url),"utf8");
  const urls=[];
  function build(path){
    const win={fetch:async url=>{urls.push(url);return new Response("ok")}};
    const ctx={window:win,location:{pathname:path},URL,encodeURIComponent,Set};
    runInNewContext(source,ctx,{filename:"cloudflare-public-feed-shim.js"});
    return win;
  }
  const broncos=build("/staging/boards/page4_broncos.html");
  await broncos.fetch("https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4426338/statistics/0?lang=en&region=us");
  assert.match(urls.pop(),/^\/migration-api\/nfl\/season-stats\?season=2026&athlete=4426338&team=7$/);
  await broncos.fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard");
  assert.match(urls.pop(),/^\/proxy\?url=/);
  const other=build("/staging/boards/page1_nfl.html");
  await other.fetch("https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4426338/statistics/0");
  assert.match(urls.pop(),/^\/proxy\?url=/);
});
