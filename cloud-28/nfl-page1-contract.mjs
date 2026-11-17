/*
 * Cloudflare v8l ESPN NFL Page 1 — contract-preserving DATA adapter.
 * Never changes original visual HTML, CSS, transitions or spotlight timing.
 * Sources: ESPN current NFL scoreboard + year-matched regular-season standings.
 * Intentionally excludes MVP, individual leaders and unsupported playoff results.
 */
const required=(ok,message)=>{if(!ok)throw Error(message);};
const number=(v)=>v===null||v===undefined||v===""?NaN:Number(v);
const stat=(entry,key)=>{
  const x=(entry?.stats||[]).find(s=>s?.name===key);
  return x&&Number.isFinite(number(x.value))?x:null;
};
const logo=(team)=>team?.logos?.find(x=>(x.rel||[]).includes("default"))?.href||
  team?.logos?.[0]?.href||team?.logo||"";
function convertStanding(entry){
  required(entry?.team?.id&&entry?.team?.displayName,"ESPN standings team missing");
  const stats=Object.fromEntries((entry.stats||[]).filter(x=>typeof x?.name==="string").map(x=>[x.name,x]));
  const get=k=>{const s=stat(entry,k);required(s,"ESPN current-season standings missing "+k);return Number(s.value);};
  const team=entry.team;
  const seed=get("playoffSeed"),wins=get("wins"),losses=get("losses"),ties=get("ties");
  const pct=get("winPercent");
  required(Number.isInteger(seed)&&seed>=1&&seed<=16,"Invalid ESPN conference seed");
  required(wins>=0&&losses>=0&&ties>=0&&pct>=0&&pct<=1,"Invalid ESPN record");
  return {
    id:String(team.id),name:team.displayName,short:team.shortDisplayName||team.name,
    abbr:team.abbreviation||"",logo:logo(team),color:team.color||"",alternateColor:team.alternateColor||"",
    wins,losses,ties,otLosses:null,points:null,seed,pct,
    streak:stats.streak?.displayValue||"",stats,
    record:wins+"-"+losses+(ties?"-"+ties:"")
  };
}
function convertGame(event){
  const c=event?.competitions?.[0],r=c?.competitors||[];
  const a=r.find(x=>x.homeAway==="away"),h=r.find(x=>x.homeAway==="home");
  if(!event?.id||!event?.date||!a?.team?.id||!h?.team?.id)return null;
  const season=event.season;
  const team=(entry)=>({
    id:String(entry.team.id),name:entry.team.displayName||entry.team.name||"",
    short:entry.team.shortDisplayName||entry.team.name||"",
    abbr:entry.team.abbreviation||"",logo:logo(entry.team),
    color:entry.team.color||"",alternateColor:entry.team.alternateColor||"",
    score:String(entry.score?.displayValue??entry.score??""),
    winner:entry.winner===true,seed:null
  });
  const status=event.status||c.status||{},type=status.type||{};
  const state=type.state;
  if(!["pre","in","post"].includes(state))return null;
  return {
    id:String(event.id),date:event.date,endDate:status.clock===0&&state==="post"?(event.competitions?.[0]?.date||null):null,
    away:team(a),home:team(h),state,completed:type.completed===true,
    status:type.shortDetail||type.detail||status.displayClock||"Scheduled",
    statusName:type.name||"",timeValid:c.timeValid!==false,
    venue:c.venue?.fullName||"",note:c.notes?.[0]?.headline||"",
    season:season||null,series:null,competitionType:c.type||null,neutral:c.neutralSite===true
  };
}
export function buildNflPage1(scoreboard,standings,now=new Date()){
  const scSeason=scoreboard?.season||scoreboard?.leagues?.[0]?.season;
  const year=Number(scSeason?.year||scoreboard?.leagues?.[0]?.season?.year);
  const type=Number(scSeason?.type?.type??scSeason?.type??2);
  required(Number.isInteger(year)&&year>=2024&&year<=2035,"ESPN NFL season unavailable");
  required(type===2,"NFL Page 1 Cloudflare adapter currently supports regular season only");
  required(Number(standings?.season?.year)===year,"NFL scoreboard/standings season mismatch");
  const conf=(standings.children||[]).filter(g=>g?.isConference&&Array.isArray(g?.standings?.entries));
  required(conf.length===2,"Expected ESPN AFC and NFC standings");
  const groups=conf.map(g=>{
    const name=g.name||"";
    required(/American Football|National Football|AFC|NFC/i.test(name),"Unknown ESPN NFL conference");
    required(Number(g.standings.season)===year&&Number(g.standings.seasonType)===2,
      "Conference season type mismatch");
    const entries=g.standings.entries.map(convertStanding);
    required(entries.length===16,"Expected 16 NFL clubs per conference");
    required(new Set(entries.map(e=>e.id)).size===16,"Duplicate NFL conference team");
    required(new Set(entries.map(e=>e.seed)).size===16,"Duplicate ESPN conference seed");
    return {name,path:[standings.name||"National Football League",name],entries};
  });
  required(new Set(groups.flatMap(g=>g.entries.map(e=>e.id))).size===32,"ESPN standings not complete");
  const games=(scoreboard.events||[]).map(convertGame).filter(Boolean).filter(e=>
    Number(e.season?.year)===year&&Number(e.season?.type)===2);
  required(games.length>0,"No verified current-season NFL games in scoreboard");
  games.sort((a,b)=>a.date.localeCompare(b.date));
  const stamp=now.toISOString();
  return {
    board:"page1_nfl",
    context:{sport:"nfl",year,statsYear:year,label:String(year),mode:"season",seasonType:2,asOf:stamp},
    warnings:[],
    postseason:[],
    ticker:{events:games,selected:games,selection:"ESPN current regular-season week",asOf:stamp},
    standings:{groups,season:standings.season,url:"https://site.api.espn.com/apis/v2/sports/football/nfl/standings"},
    sources:[
      {url:"https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard",state:"current",fetched_at:now.getTime()/1000},
      {url:"https://site.api.espn.com/apis/v2/sports/football/nfl/standings",state:"current",fetched_at:now.getTime()/1000}
    ],
    fetchedAt:stamp,dataState:"current",
    migration:{sections:["scoreboard","ticker","conference-standings","projected-seeds"],
      excluded:["mvp-projections","verified-playoff-results"],
      contract:"Cloudflare experimental NFL regular season page1; no fake player stats"}
  };
}
