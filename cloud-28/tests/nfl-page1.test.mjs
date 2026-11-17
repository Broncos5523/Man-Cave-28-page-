import test from "node:test";
import assert from "node:assert/strict";
import app from "../cloudflare-live-proxy.mjs";
import {buildNflPage1} from "../nfl-page1-contract.mjs";

const stamp="2026-11-17T16:05:00.000Z";
const makeTeam=(i,conf)=>({
  id:String(conf==="AFC"?i:i+16),
  name:"Club "+i,
  displayName:"Test "+conf+" Club "+i,
  shortDisplayName:"Club"+i,
  abbreviation:(conf==="AFC"?"A":"N")+i,
  logos:[{href:"https://a.espncdn.com/i/teamlogos/nfl/500/test.png",rel:["default"]}]
});
const makeStat=(name,value)=>({name,value,displayValue:String(value)});
const makeEntry=(i,conf)=>({
  team:makeTeam(i,conf),
  stats:[
    makeStat("playoffSeed",i),makeStat("wins",16-i),makeStat("losses",i-1),
    makeStat("ties",0),makeStat("winPercent",(16-i)/16),
    makeStat("streak","") // data shape ignored by strict numeric parser except displayValue
  ]
});
const standings={
  name:"National Football League",season:{year:2026,displayName:"2026"},
  children:["AFC","NFC"].map(c=>({
    name:c==="AFC"?"American Football Conference":"National Football Conference",
    isConference:true,
    standings:{season:2026,seasonType:2,entries:Array.from({length:16},(_,i)=>makeEntry(i+1,c))}
  }))
};
const scoreboard={
  season:{year:2026,type:2},
  events:[{id:"401873052",date:"2026-11-17T01:15Z",
    season:{year:2026,type:2,slug:"regular-season"},
    status:{type:{state:"post",completed:true,name:"STATUS_FINAL",shortDetail:"Final"}},
    competitions:[{timeValid:true,neutralSite:false,
      type:{id:"1",abbreviation:"STD"},
      venue:{fullName:"NFL Field"},
      competitors:[
        {homeAway:"away",team:makeTeam(1,"AFC"),score:"23",winner:true},
        {homeAway:"home",team:makeTeam(1,"NFC"),score:"20",winner:false}
      ]}]
  }]
};
test("verified regular-season 2026 NFL Page 1 returns exact original render keys",()=>{
  const p=buildNflPage1(scoreboard,standings,new Date(stamp));
  assert.equal(p.board,"page1_nfl");
  assert.equal(p.context.mode,"season");
  assert.equal(p.context.year,2026);
  assert.equal(p.context.seasonType,2);
  assert.equal(p.standings.groups.length,2);
  assert.equal(p.standings.groups[0].entries.length,16);
  assert.equal(p.standings.groups[1].entries[0].seed,1);
  assert.deepEqual(p.ticker.events.map(x=>x.id),["401873052"]);
  assert.deepEqual(p.ticker.selected.map(x=>x.id),["401873052"]);
  assert.equal(p.ticker.events[0].away.score,"23");
  assert.equal(p.ticker.events[0].state,"post");
  assert.deepEqual(p.postseason,[]);
  assert.equal(p.migration.excluded.includes("mvp-projections"),true);
  assert.equal(p.dataState,"current");
});
test("page1 refuses wrong season, incomplete conference, wrong type, or guessed rank",()=>{
  assert.throws(()=>buildNflPage1({...scoreboard,season:{year:2027,type:2}},standings));
  assert.throws(()=>buildNflPage1({...scoreboard,season:{year:2026,type:3}},standings));
  const notFull=structuredClone(standings);notFull.children[0].standings.entries.pop();
  assert.throws(()=>buildNflPage1(scoreboard,notFull));
  const noSeed=structuredClone(standings);
  noSeed.children[0].standings.entries[0].stats=noSeed.children[0].standings.entries[0].stats.filter(x=>x.name!=="playoffSeed");
  assert.throws(()=>buildNflPage1(scoreboard,noSeed));
  const stale=structuredClone(standings);stale.children[0].standings.season=2025;
  assert.throws(()=>buildNflPage1(scoreboard,stale));
});
test("actual Worker route reads ONLY public ESPN sources and returns 200",async()=>{
  const native=globalThis.fetch;const requested=[];
  globalThis.fetch=async(url,options)=>{
    requested.push({url,options});
    const payload=url.includes("/scoreboard?")?scoreboard:url.includes("/standings?")?standings:null;
    if(!payload)throw Error("Unapproved upstream URL "+url);
    return new Response(JSON.stringify(payload),{
      status:200,headers:{"Content-Type":"application/json"}
    });
  };
  try{
    const request=new Request("https://man-cave-28-page.broncos5523.workers.dev/api/board/page1_nfl",{
      headers:{"Cookie":"private","Authorization":"Bearer private"}
    });
    const r=await app.fetch(request,{},null);
    assert.equal(r.status,200);
    assert.equal(r.headers.get("X-Man-Cave-Data-Source"),"verified-espn-nfl-regular-season");
    const data=await r.json();
    assert.equal(data.standings.groups[0].entries[0].seed,1);
    assert.equal(data.ticker.selected[0].status,"Final");
    assert.equal(requested.length,2);
    assert.ok(requested.every(x=>x.url.startsWith("https://site.api.espn.com/")));
    assert.ok(requested.every(x=>!x.options.headers.Cookie&&!x.options.headers.Authorization));
  }finally{globalThis.fetch=native;}
});
test("actual Worker route fails closed when ESPN league season mismatches",async()=>{
  const native=globalThis.fetch;
  globalThis.fetch=async(url)=>new Response(JSON.stringify(url.includes("/scoreboard?")?
    {...scoreboard,season:{year:2025,type:2}}:standings),{headers:{"Content-Type":"application/json"}});
  try{
    const r=await app.fetch(new Request("https://example.com/api/board/page1_nfl"),{},null);
    assert.equal(r.status,503);
    const e=await r.json();assert.equal(e.ok,false);
  }finally{globalThis.fetch=native;}
});
test("non-GET is rejected for board read-only API",async()=>{
  const r=await app.fetch(new Request("https://example.com/api/board/page1_nfl",{method:"POST"}),{},null);
  assert.equal(r.status,405);
});
