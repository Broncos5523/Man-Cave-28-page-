import test from "node:test";
import assert from "node:assert/strict";
import app from "../cloudflare-live-proxy.mjs";
import {buildNbaPage1} from "../nba-page1-contract.mjs";

const year=2027;
const sourceTeams=Array.from({length:30},(_,i)=>({
  id:String(i+1),displayName:"2026 Team "+(i+1),shortDisplayName:"Team"+(i+1),
  abbreviation:"T"+(i+1),
  logos:[{href:"https://a.espncdn.com/i/teamlogos/nba/500/test.png",rel:["default"]}]
}));
const numeric=(name,value)=>({name,value,displayValue:String(value)});
const standings={
  name:"National Basketball Association",season:{year:2027,displayName:"2026-27"},
  children:["Eastern Conference","Western Conference"].map((name,g)=>({
    name,isConference:true,
    standings:{season:2027,seasonType:2,
      entries:sourceTeams.slice(g*15,g*15+15).map((team,i)=>({
        team,stats:[
          numeric("wins",15-i),numeric("losses",i+1),
          numeric("playoffSeed",i+1),numeric("winPercent",(15-i)/16),
          numeric("points",100)
        ]
      }))
    }
  }))
};
const score={
  season:{year:2027,type:2},
  leagues:[{season:{year:2027,type:{type:2}}}],
  events:[{
    id:"401910002",date:"2026-11-18T00:30Z",season:{year:2027,type:2,slug:"regular-season"},
    status:{type:{state:"pre",completed:false,name:"STATUS_SCHEDULED",shortDetail:"7:30 PM"}},
    competitions:[{timeValid:true,neutralSite:false,venue:{fullName:"NBA Arena"},competitors:[
      {homeAway:"away",team:sourceTeams[0],score:"0",winner:false},
      {homeAway:"home",team:sourceTeams[15],score:"0",winner:false}
    ]}]
  }]
};
test("NBA 2026-27 Page1 contract has 30 verified teams and eight projected first-round matchups",()=>{
  const j=buildNbaPage1(score,standings,new Date("2026-11-17T15:30:00Z"));
  assert.equal(j.board,"page1_nba");
  assert.deepEqual([j.context.year,j.context.statsYear,j.context.mode,j.context.seasonType,j.context.label],[2027,2027,"season",2,"2026–27"]);
  assert.equal(j.standings.groups.length,2);
  assert.deepEqual(j.standings.groups.map(x=>x.entries.length),[15,15]);
  assert.equal(j.playoffs.kind,"projection");
  assert.equal(j.playoffs.matches.length,8);
  assert.ok(j.playoffs.matches.every(x=>x.winner===null&&x.teams.length===2&&x.state==="pre"));
  assert.equal(j.ticker.events.length,1);
  assert.equal(j.ticker.selected[0].away.id,"1");
  assert.deepEqual(j.postseason,[]);
  assert.equal(j.migration.excluded.includes("real playoff outcomes"),true);
});
test("NBA fails closed for wrong season, incomplete teams, duplicated seed or offseason game",()=>{
  assert.throws(()=>buildNbaPage1({...score,season:{year:2026,type:2}},standings));
  assert.throws(()=>buildNbaPage1({...score,season:{year:2027,type:3}},standings));
  const incomplete=structuredClone(standings);incomplete.children[1].standings.entries.pop();
  assert.throws(()=>buildNbaPage1(score,incomplete));
  const duplicated=structuredClone(standings);duplicated.children[0].standings.entries[1].stats[2].value=1;
  assert.throws(()=>buildNbaPage1(score,duplicated));
  const noGames=structuredClone(score);noGames.events[0].season.year=2026;
  assert.throws(()=>buildNbaPage1(noGames,standings));
});
test("Worker NBA route uses only approved public ESPN sources and never forwards incoming credentials",async()=>{
  const orig=globalThis.fetch,requested=[];
  globalThis.fetch=async(url,options)=>{
    requested.push({url,options});
    return new Response(JSON.stringify(url.includes("scoreboard?")?score:standings),{
      headers:{"Content-Type":"application/json"},status:200
    });
  };
  try{
    const r=await app.fetch(new Request("https://man-cave-28-page.broncos5523.workers.dev/api/board/page1_nba",{
      headers:{Cookie:"private",Authorization:"Bearer secret"}
    }),{},null);
    assert.equal(r.status,200);
    assert.equal(r.headers.get("X-Man-Cave-Data-Source"),"verified-espn-nba-current-season");
    const j=await r.json();
    assert.equal(j.standings.groups[0].entries.length,15);
    assert.equal(j.playoffs.matches.length,8);
    assert.equal(requested.length,2);
    assert.ok(requested.every(x=>x.url.startsWith("https://site.api.espn.com/")));
    assert.ok(requested.every(x=>!x.options?.headers?.Cookie&&!x.options?.headers?.Authorization));
  }finally{globalThis.fetch=orig}
});
test("NBA Worker refuses missing standings or wrong method",async()=>{
  const r=await app.fetch(new Request("https://example.com/api/board/page1_nba",{method:"POST"}),{},null);
  assert.equal(r.status,405);
});
