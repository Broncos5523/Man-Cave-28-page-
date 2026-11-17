import {requireData as need,number} from './board-contract-common.mjs';
export const page4Teams={page4_celtics:{league:'nba',team:'2'},page4_arizona_cbb:{league:'mens-college-basketball',team:'12'},
  page4_fever:{league:'wnba',team:'5'}};
const fields={PTS:'avgPoints',REB:'avgRebounds',AST:'avgAssists',STL:'avgSteals',BLK:'avgBlocks','3PM':'avgThreePointFieldGoalsMade'};
const leaders=[['avgPoints','POINTS','PPG'],['avgRebounds','REBOUNDS','RPG'],['avgAssists','ASSISTS','APG'],
  ['avgSteals','STEALS','SPG'],['avgBlocks','BLOCKS','BPG'],['avgThreePointFieldGoalsMade','3-POINTERS','3PM/G']];
export function currentPlayerMap(data,year,id){
  need(String(data?.season?.$ref||'').includes('/seasons/'+year+'?')&&
    String(data?.seasonType?.$ref||'').includes('/seasons/'+year+'/types/2?'),'Player season/type unverified');
  need(new RegExp('/athletes/'+id+'/statistics(?:/0)?(?:\\?|$)').test(data.$ref||''),'Player identity unverified');
  const map={};for(const c of data.splits?.categories||[])for(const s of c.stats||[])if(s.name&&number(s.value)!==null)map[s.name]=number(s.value);
  need(Number.isInteger(map.gamesPlayed)&&map.gamesPlayed>=0,'Player appearances unverified');return map;
}
export function buildPage4(board,year,roster,stats,now=new Date()){
  const config=page4Teams[board];need(config,'Unknown Page4 board');
  need(number(roster?.season?.year)===year&&String(roster.team?.id)===config.team,'Current roster year/team mismatch');
  need(Array.isArray(roster.athletes)&&roster.athletes.length>=10,'Incomplete current team roster');
  const players=roster.athletes.filter(p=>p.id&&p.displayName).map(p=>{
    let map=null;try{if(stats[String(p.id)])map=currentPlayerMap(stats[String(p.id)],year,String(p.id));}catch{}
    return {id:String(p.id),name:p.displayName,pos:p.position?.abbreviation||'',headshot:p.headshot?.href||'',
      gamesPlayed:map?.gamesPlayed??null,stats:Object.fromEntries(Object.entries(fields).map(([label,key])=>
        [label,map?.gamesPlayed>0&&number(map[key])!==null?map[key]:null])),dataState:map?'current':'unavailable'};
  });
  const current=players.filter(p=>p.gamesPlayed>0);need(current.length>=3,'Insufficient verified current-season appearances');
  const teamLeaders=leaders.map(([key,cat,unit])=>{
    const field=Object.keys(fields).find(f=>fields[f]===key),eligible=current.filter(p=>number(p.stats[field])!==null);
    need(eligible.length>0,'Current team leader unavailable for '+key);
    const winner=[...eligible].sort((a,b)=>b.stats[field]-a.stats[field])[0];
    return {key,cat,unit,id:winner.id,name:winner.name,pos:winner.pos,value:winner.stats[field].toFixed(1)};
  });
  const stamps=Object.values(stats).map(d=>d?.__mcSource?.fetchedAt).filter(Boolean).map(Date.parse);
  const updatedAt=stamps.length?new Date(Math.min(...stamps)).toISOString():now.toISOString();
  return {board,season:year,seasonLabel:config.league==='wnba'?String(year):`${year-1}–${String(year).slice(-2)}`,
    updatedAt,roster:players,leaders:teamLeaders,verifiedPlayers:current.length,dataState:'current'};
}
