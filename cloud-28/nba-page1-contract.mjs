/*
 * MAN CAVE SPORTS BOOK / Cloudflare NBA Page 1
 * Original v8l contract: 30 NBA clubs, 2026-27 ESPN season, regular season
 * scoreboard, conference standings and CURRENT projected bracket.
 * No fabricated playoff results. No source/visual modifications.
 */
const insist=(condition,message)=>{if(!condition)throw Error(message);};
const n=v=>v===null||v===undefined||v===""?NaN:Number(v);
const logos=t=>t?.logos?.find(x=>Array.isArray(x.rel)&&x.rel.includes("default"))?.href||
  t?.logos?.[0]?.href||t?.logo||"";
function gameOf(event){
  const comp=event?.competitions?.[0],sides=comp?.competitors||[];
  const away=sides.find(x=>x?.homeAway==="away"),home=sides.find(x=>x?.homeAway==="home");
  if(!event?.id||!event?.date||!away?.team?.id||!home?.team?.id)return null;
  const status=event.status||comp?.status||{},type=status.type||{};
  const state=type.state;
  if(!["pre","in","post"].includes(state))return null;
  const club=x=>({
    id:String(x.team.id),name:x.team.displayName||x.team.name||"",
    short:x.team.shortDisplayName||x.team.name||"",
    abbr:x.team.abbreviation||"",logo:logos(x.team),
    color:x.team.color||"",alternateColor:x.team.alternateColor||"",
    score:String(x.score?.displayValue??x.score??""),
    winner:x.winner===true,seed:null
  });
  return {
    id:String(event.id),date:event.date,endDate:null,
    away:club(away),home:club(home),state,completed:type.completed===true,
    status:type.shortDetail||type.detail||status.displayClock||"Scheduled",
    statusName:type.name||"",timeValid:comp?.timeValid!==false,
    venue:comp?.venue?.fullName||"",note:comp?.notes?.[0]?.headline||"",
    season:event.season||null,series:null,competitionType:comp?.type||null,
    neutral:comp?.neutralSite===true
  };
}
function standingOf(row){
  const club=row?.team;insist(club?.id&&club?.displayName,"NBA standing club missing identity");
  const stats=Object.fromEntries((row.stats||[]).filter(x=>typeof x?.name==="string").map(x=>[x.name,x]));
  const needed=k=>{const value=n(stats[k]?.value);insist(Number.isFinite(value),"NBA standing missing "+k);return value;};
  const seed=needed("playoffSeed"),wins=needed("wins"),losses=needed("losses"),pct=needed("winPercent");
  insist(Number.isInteger(seed)&&seed>=1&&seed<=15&&wins>=0&&losses>=0&&pct>=0&&pct<=1,
    "Invalid NBA standings seed or record");
  return {
    id:String(club.id),name:club.displayName,short:club.shortDisplayName||club.name,
    abbr:club.abbreviation||"",logo:logos(club),
    color:club.color||"",alternateColor:club.alternateColor||"",
    wins,losses,ties:null,otLosses:null,points:n(stats.points?.value),
    seed,pct,streak:stats.streak?.displayValue||"",
    stats,record:wins+"-"+losses
  };
}
function projection(groups,year){
  const matches=[];
  const pairs=[[1,8],[4,5],[2,7],[3,6]];
  for(const g of groups){
    const league=g.name.startsWith("Eastern")?"east":"west";
    for(const [a,b] of pairs){
      const t1=g.entries.find(x=>x.seed===a),t2=g.entries.find(x=>x.seed===b);
      insist(t1&&t2,"NBA projected seed unavailable");
      matches.push({
        stage:"first",conference:league,teams:[t1,t2],
        winner:null,state:"pre",summary:"Current standings projection — no series result",
        eventId:null
      });
    }
  }
  return {kind:"projection",season:year,matches,sources:[]};
}
export function buildNbaPage1(scoreboard,standings,now=new Date()){
  const season=scoreboard?.season||scoreboard?.leagues?.[0]?.season||{},
  year=n(season?.year),type=n(season?.type?.type??season?.type);
  insist(Number.isInteger(year)&&year>=2025&&year<=2036&&type===2,
    "Current ESPN NBA regular season unavailable");
  insist(n(standings?.season?.year)===year,"NBA scoreboard and standings season mismatch");
  const conferences=(standings.children||[]).filter(x=>x?.isConference&&Array.isArray(x?.standings?.entries));
  insist(conferences.length===2,"Expected NBA Eastern and Western conferences");
  const groups=conferences.map(g=>{
    const name=g.name||"";
    insist(/^(Eastern|Western) Conference$/.test(name),"Unknown NBA conference "+name);
    insist(n(g.standings.season)===year&&n(g.standings.seasonType)===2,
      "NBA conference year/type mismatch");
    const entries=g.standings.entries.map(standingOf);
    insist(entries.length===15&&new Set(entries.map(x=>x.id)).size===15,"Incomplete NBA conference");
    insist(new Set(entries.map(x=>x.seed)).size===15,"Duplicate NBA projected playoff seed");
    return {name,path:[standings.name||"National Basketball Association",name],entries};
  });
  insist(groups.some(x=>x.name==="Eastern Conference")&&groups.some(x=>x.name==="Western Conference"),"Missing NBA conference");
  insist(new Set(groups.flatMap(x=>x.entries.map(y=>y.id))).size===30,"NBA standings missing unique clubs");
  const games=(scoreboard.events||[]).map(gameOf).filter(Boolean)
    .filter(x=>n(x.season?.year)===year&&n(x.season?.type)===2)
    .sort((a,b)=>a.date.localeCompare(b.date));
  insist(games.length>0,"ESPN NBA schedule has no current-season games");
  const asOf=now.toISOString(),label=(year-1)+"–"+String(year).slice(-2);
  return {
    board:"page1_nba",
    context:{sport:"nba",year,statsYear:year,label,mode:"season",seasonType:2,asOf},
    warnings:[],postseason:[],
    standings:{groups,season:standings.season,url:"https://site.api.espn.com/apis/v2/sports/basketball/nba/standings"},
    ticker:{events:games,selected:games,selection:"ESPN current regular-season schedule",asOf},
    playoffs:projection(groups,year),
    sources:[
      {url:"https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard",state:"current",fetched_at:now.getTime()/1000},
      {url:"https://site.api.espn.com/apis/v2/sports/basketball/nba/standings",state:"current",fetched_at:now.getTime()/1000}
    ],
    fetchedAt:asOf,dataState:"current",
    migration:{sections:["scoreboard","ticker","conference-standings","projected-playoff-seeds"],
      excluded:["real playoff outcomes","NBA MVP awards"],
      contract:"Original v8l NBA Page1 2026-27 regular-season JSON subset"}
  };
}
