import test from "node:test";
import assert from "node:assert/strict";
import app from "../cloudflare-live-proxy.mjs";
import {buildNflPage2} from "../nfl-page2-contract.mjs";
const year=2026;
const records=Array.from({length:32},(_,i)=>({
  id:String(i+1),name:"Club "+(i+1),short:"C"+(i+1),
  abbr:"T"+(i+1),logo:"https://a.espncdn.com/logo.png",color:"123456",
  alternateColor:"abcdef",seed:i%16+1,wins:10,losses:1,ties:0,pct:.91
}));
const base={
  board:"page1_nfl",context:{year,statsYear:year,sport:"nfl",mode:"season",seasonType:2,label:"2026"},
  standings:{groups:[
    {name:"American Football Conference",entries:records.slice(0,16)},
    {name:"National Football Conference",entries:records.slice(16)}
  ]},ticker:{events:[],selected:[]},
  sources:[],migration:{sections:["scoreboard","ticker"]}
};
const rules=[
  ["RUSHING YARDS","rushingYards","1000","2"],
  ["PASSING YARDS","passingYards","2838","9"],
  ["SACKS","sacks","10.5","16"],
  ["RECEIVING YARDS","receivingYards","1207","26"],
  ["PASSING TOUCHDOWNS","passingTouchdowns","27","4"],
  ["INTERCEPTIONS","interceptions","6","9"]
];
const season={year:2026,type:{type:2}};
const league={requestedSeason:season,
  leaders:{categories:rules.map(([label,name,n,team],i)=>({
    name,leaders:[{
      athlete:{id:String(4000000+i),displayName:"Player "+name,headshot:{href:"https://a.espncdn.com/player.png"}},
      team:{id:team},value:Number(n),displayValue:name==="sacks"?"10":n
    }]
  }))}};
const leagueStats={requestedSeason:season,
  categories:[
    {name:"passing",names:["netPassingYardsPerGame","passingTouchdowns","sacks"]},
    {name:"rushing",names:["rushingYardsPerGame"]},
    {name:"defensiveinterceptions",names:["interceptions"]}
  ],
  teams:records.map((team,i)=>{
    const net=i===3?298.9:50+i,passingTD=i===3?27:3,rush=i===27?163.9:30+i;
    const sacks=i===15?37:1+i/3,picks=i===26?16:1+i/5;
    return {team:{id:team.id},categories:[
      {name:"passing",splitId:"0",values:[net,passingTD,0],totals:[String(net),String(passingTD),"0"]},
      {name:"passing",splitId:"900",values:[0,0,sacks],totals:["0","0",String(sacks)]},
      {name:"rushing",splitId:"0",values:[rush],totals:[String(rush)]},
      {name:"defensiveinterceptions",splitId:"0",values:[picks],totals:[String(picks)]}
    ]};
  })
};
test("original Page2 labels populated by six verified NFL player leaders, including fractional sacks",()=>{
  const out=buildNflPage2(base,league,leagueStats);
  assert.equal(out.board,"page2_nfl");
  assert.deepEqual(out.leaders.players.map(x=>x.label),rules.map(x=>x[0]));
  assert.equal(out.leaders.players.find(x=>x.label==="PASSING YARDS").value,"2,838");
  assert.equal(out.leaders.players.find(x=>x.label==="SACKS").value,"10.5");
  assert.equal(out.leaders.players.find(x=>x.label==="SACKS").number,10.5);
  assert.equal(out.leaders.players.length,6);
  assert.equal(out.leaders.players[0].team.name,"Club 2");
  assert.equal(out.leaders.players[0].season,2026);
  assert.equal(out.awards,undefined,"Do not fabricate NFL.com MVP projections");
});
test("five team cards use verified net passing and exact ESPN offense/defense split IDs",()=>{
  const out=buildNflPage2(base,league,leagueStats);
  assert.deepEqual(out.teamPanels.leaders.map(x=>x.label),[
    "PASSING OFFENSE","RUSHING OFFENSE","TEAM SACKS","INTERCEPTIONS","PASSING TDS"]);
  const by=Object.fromEntries(out.teamPanels.leaders.map(x=>[x.label,x]));
  assert.equal(by["PASSING OFFENSE"].value,"298.9");
  assert.equal(by["RUSHING OFFENSE"].value,"163.9");
  assert.equal(by["TEAM SACKS"].value,"37.0");
  assert.equal(by["INTERCEPTIONS"].value,"16");
  assert.equal(by["PASSING TDS"].value,"27");
});
test("fail closed on outdated year, wrong team season, missing split or player identity",()=>{
  assert.throws(()=>buildNflPage2(base,{...league,requestedSeason:{year:2025,type:{type:2}}},leagueStats));
  assert.throws(()=>buildNflPage2(base,league,{...leagueStats,requestedSeason:{year:2026,type:{type:3}}}));
  const swapped=structuredClone(leagueStats);
  swapped.teams[0].categories=swapped.teams[0].categories.filter(x=>x.splitId!=="900");
  assert.throws(()=>buildNflPage2(base,league,swapped));
  const playerless=structuredClone(league);playerless.leaders.categories[0].leaders[0].team.id="1000";
  assert.throws(()=>buildNflPage2(base,playerless,leagueStats));
});
const makeStandings=()=>({
  season:{year:2026},
  children:["AFC","NFC"].map((group,g)=>({
    name:g===0?"American Football Conference":"National Football Conference",
    isConference:true,standings:{season:2026,seasonType:2,entries:records.slice(g*16,(g+1)*16).map(t=>({
      team:{id:t.id,displayName:t.name,shortDisplayName:t.short,abbreviation:t.abbr,logo:t.logo},
      stats:["playoffSeed","wins","losses","ties","winPercent"].map((name,i)=>({
        name,value:[t.seed,10,1,0,.91][i],displayValue:String([t.seed,10,1,0,.91][i])
      }))
    }))}
  }))
});
const makeScoreboard=()=>({
  season:{year:2026,type:2},
  events:[{id:"401873001",date:"2026-11-17T20:00Z",season:{year:2026,type:2},
    status:{type:{state:"pre",completed:false,name:"STATUS_SCHEDULED",shortDetail:"Tonight"}},
    competitions:[{timeValid:true,competitors:[
      {homeAway:"away",score:"0",team:{id:"1",displayName:"Club 1"}},
      {homeAway:"home",score:"0",team:{id:"2",displayName:"Club 2"}}
    ]}]}]
});
test("actual Cloudflare Page2 Worker route handles four public ESPN sources without credentials",async()=>{
  const original=globalThis.fetch;const urls=[];
  globalThis.fetch=async(url,options)=>{
    urls.push({url,options});
    const source=url.includes("/scoreboard?")?makeScoreboard():
      url.includes("/standings?")?makeStandings():
      url.includes("/apis/site/v3/")?league:
      url.includes("/statistics/byteam?")?leagueStats:null;
    if(!source)throw Error("Unexpected external sports source "+url);
    return new Response(JSON.stringify(source),{status:200,headers:{"Content-Type":"application/json"}});
  };
  try{
    const r=await app.fetch(new Request("https://man-cave-28-page.broncos5523.workers.dev/api/board/page2_nfl",{
      headers:{"Authorization":"Bearer secret","Cookie":"secret"}
    }),{},null);
    assert.equal(r.status,200);
    const j=await r.json();
    assert.equal(j.board,"page2_nfl");
    assert.equal(j.leaders.players.length,6);
    assert.equal(j.teamPanels.leaders.length,5);
    assert.equal(urls.length,4);
    assert.ok(urls.every(x=>x.url.startsWith("https://site.api.espn.com/")));
    assert.ok(urls.every(x=>!x.options.headers.Authorization&&!x.options.headers.Cookie));
    assert.equal(j.migration.excluded.includes("NFL.com MVP Tracker"),true);
  }finally{globalThis.fetch=original;}
});
