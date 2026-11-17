/*
 * NFL Page 2 — reproduce approved 6 league player leaders and 5 team cards
 * using VERIFIED regular-season ESPN Site feeds (no Core API dependency).
 * Never changes original board markup, portrait graphics or the MVP logic.
 */
const categories=[
  ["RUSHING YARDS","rushingYards"],
  ["PASSING YARDS","passingYards"],
  ["SACKS","sacks"],
  ["RECEIVING YARDS","receivingYards"],
  ["PASSING TOUCHDOWNS","passingTouchdowns"],
  ["INTERCEPTIONS","interceptions"]
];
// ESPN /statistics/byteam splits rows with IDs "0" and "900".
// Their meaning varies by category; each metric + split ID below was checked
// against the exact original v8l player-board values, never inferred by order.
// "NET passing" is intentionally different from gross passing yards.
const teamCards=[
  ["PASSING OFFENSE","passing","0","netPassingYardsPerGame",1],
  ["RUSHING OFFENSE","rushing","0","rushingYardsPerGame",1],
  ["TEAM SACKS","passing","900","sacks",1],
  ["INTERCEPTIONS","defensiveinterceptions","0","interceptions",0],
  ["PASSING TDS","passing","0","passingTouchdowns",0]
];
function requireValue(condition,error){if(!condition)throw Error(error);}
const validNumeric=n=>typeof n==="number"&&Number.isFinite(n)&&n>=0;
const display=(number,decimals=0)=>number.toLocaleString("en-US",{
  minimumFractionDigits:decimals,maximumFractionDigits:Math.max(decimals,1)
});
function yearCheck(value,year,what){
  requireValue(Number(value?.requestedSeason?.year)===year&&
    Number(value?.requestedSeason?.type?.type)===2,
    "Source season mismatch: "+what);
}
function currentTeams(base){
  const array=(base.standings?.groups||[]).flatMap(x=>x.entries||[]);
  requireValue(array.length===32,"Expected verified 32-club NFL standings");
  return new Map(array.map(t=>[String(t.id),t]));
}
export function buildNflPage2(base,leadersData,teamsData){
  const year=Number(base?.context?.year);
  requireValue(base?.board==="page1_nfl"&&base?.context?.mode==="season"&&
    Number(base.context.seasonType)===2&&Number.isInteger(year),
    "Original Page1 current NFL source required");
  yearCheck(leadersData,year,"league-player-leaders");
  yearCheck(teamsData,year,"league-team-stats");
  const map=currentTeams(base);
  const cats=leadersData?.leaders?.categories||[];
  const players=categories.map(([label,key])=>{
    const group=cats.find(c=>c?.name===key);
    const first=group?.leaders?.[0];
    const athlete=first?.athlete,teamId=String(first?.team?.id||"");
    const team=map.get(teamId),number=Number(first?.value);
    requireValue(athlete?.id&&athlete?.displayName&&team&&validNumeric(number),
      "Missing verified ESPN top athlete for "+key);
    return {
      label,id:String(athlete.id),name:athlete.displayName,
      headshot:athlete.headshot?.href||"",
      team,value:display(number),number,stats:{},
      source:"ESPN NFL regular-season leaderboard",
      season:year
    };
  });
  const glossary=new Map((teamsData.categories||[]).map(x=>[x.name,x.names||[]]));
  const teams=teamsData.teams||[];
  requireValue(teams.length===32,"Expected verified NFL league-wide team statistics");
  requireValue(new Set(teams.map(x=>String(x.team?.id))).size===32,
    "Missing or duplicate NFL team statistics");
  const panels=teamCards.map(([label,cat,splitId,field,decimals])=>{
    const names=glossary.get(cat)||[],indexOfField=names.indexOf(field);
    requireValue(indexOfField>=0,"ESPN team metric not found: "+field);
    const rows=teams.map(x=>{
      const row=(x.categories||[]).find(c=>c.name===cat&&String(c.splitId)===splitId);
      const value=row?.values?.[indexOfField],number=Number(value);
      if(!validNumeric(number))return null;
      return {number,team:map.get(String(x.team.id)),reported:row.totals?.[indexOfField]};
    }).filter(x=>x&&x.team);
    requireValue(rows.length===32,"Incomplete current-season NFL team metric: "+field);
    rows.sort((a,b)=>b.number-a.number);
    const winner=rows[0];
    requireValue(winner?.team,"Missing team leader for "+field);
    // Preserve the original UI unit conventions, including 37.0 sacks.
    const value=decimals?Number(winner.number).toFixed(1):display(winner.number);
    return {label,value,team:winner.team};
  });
  return {
    ...base,board:"page2_nfl",
    leaders:{players,errors:[]},
    teamPanels:{leaders:panels,snapshot:[],warnings:[]},
    sources:[...(base.sources||[]),
      {url:"https://site.api.espn.com/apis/site/v3/sports/football/nfl/leaders",
        state:"current"},
      {url:"https://site.api.espn.com/apis/common/v3/sports/football/nfl/statistics/byteam",
        state:"current"}],
    migration:{
      sections:[...(base.migration?.sections||[]),"six-player-leaders","five-team-leaders"],
      excluded:["NFL.com MVP Tracker"],
      contract:"Cloudflare experimental NFL regular-season page2; original layouts unchanged"
    }
  };
}
