import {requireData as need,normalizeEvent,number} from './board-contract-common.mjs';
import {buildTeamPanels} from './team-panels-contract.mjs';
export function buildNflPage3(base,schedules,teamsData){
  const year=number(base?.context?.year);
  need(base?.board==='page1_nfl'&&base.context.mode==='season'&&base.context.seasonType===2,'Verified current NFL base required');
  const events=new Map();
  for(const data of schedules){
    // ESPN omits requestedSeason for an empty, not-yet-published postseason.
    if(!data.events?.length&&!data.requestedSeason)continue;
    need(number(data.requestedSeason?.year)===year&&String(data.team?.id)==='7','Favorite schedule year/team mismatch');
    for(const raw of data.events||[]){
      const event=normalizeEvent(raw);
      need(event&&number(event.season.year)===year&&['1','2','3'].includes(String(event.season.type))&&
        (event.away.id==='7'||event.home.id==='7'),'Schedule returned another team or season');
      events.set(event.id,event);
    }
  }
  // The scoreboard is fresher than the season schedule, as in original v8l.
  for(const e of base.ticker.events||[])if(e.away.id==='7'||e.home.id==='7')events.set(e.id,e);
  const schedule=[...events.values()].sort((a,b)=>a.date.localeCompare(b.date));
  need(schedule.filter(e=>number(e.season.type)===2).length===17,'Incomplete 17-game regular-season Denver schedule');
  return {...base,board:'page3_broncos',schedule,teamPanels:buildTeamPanels(base,teamsData,'nfl'),
    migration:{sections:['current Denver schedule','last game','last five results','eight exact team metrics and ranks','standings','ticker'],
      excluded:[],contract:'Original v8l Broncos Page3 JSON'}};
}
