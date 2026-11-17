import {requireData as need,sourceSeason,statisticRows,number,teamInfo} from './board-contract-common.mjs';
import {buildTeamPanels} from './team-panels-contract.mjs';
export const basketballLeaderSpecs=[['POINTS / GAME','offensive','avgPoints'],['REBOUNDS / GAME','general','avgRebounds'],
  ['ASSISTS / GAME','offensive','avgAssists'],['FIELD GOAL %','offensive','fieldGoalPct'],
  ['3-POINT %','offensive','threePointFieldGoalPct'],['STEALS / GAME','defensive','avgSteals']];
export function buildNbaPage2(base,sources,teamsData){
  const year=number(base?.context?.year);
  need(base?.board==='page1_nba'&&base.context.mode==='season'&&base.context.seasonType===2,'Verified current NBA base required');
  const clubs=base.standings.groups.flatMap(g=>g.entries),byId=new Map(clubs.map(t=>[t.id,t]));
  need(clubs.length===30&&sources.length===6,'Incomplete original NBA source set');
  const players=basketballLeaderSpecs.map(([label,cat,field],i)=>{
    const data=sources[i];sourceSeason(data,year);
    const candidate=statisticRows(data).find(x=>x.stats[cat+'.'+field]?.value!==null&&x.stats[cat+'.'+field]?.display);
    const athlete=candidate?.row?.athlete,stat=candidate?.stats[cat+'.'+field];
    const teamId=String(athlete?.teams?.[0]?.id||athlete?.team?.id||candidate?.row?.team?.id||athlete?.teamId||'');
    const club=byId.get(teamId),details=athlete?.teams?.[0]||athlete?.team||candidate?.row?.team;
    const team=club?{...club,...teamInfo(details)}:null;
    need(athlete?.id&&athlete?.displayName&&team&&number(stat?.value)!==null,'Missing exact qualified NBA leader: '+field);
    return {label,id:String(athlete.id),name:athlete.displayName,headshot:athlete.headshot?.href||'',team,
      value:String(stat.display),number:stat.value,stats:candidate.stats,
      source:'ESPN qualified current regular-season '+cat+'.'+field,season:year};
  });
  return {...base,board:'page2_nba',leaders:{players,errors:[]},teamPanels:buildTeamPanels(base,teamsData,'nba'),
    migration:{sections:['six qualified player leaders','five exact team leaders','standings','ticker'],
      excluded:['unverified NBA MVP editorial tracker'],contract:'Original v8l NBA Page2 JSON; approved MVP snapshot retained'}};
}
