import {requireData as need,number,standingsGroups,normalizeEvent,tickerFromEvents} from './board-contract-common.mjs';

/* Exact original CBB Page1 sections: AP25, D-I standings, previous NCAA
 * tournament recap, ticker. AP rankings are never turned into a fake bracket. */
export function buildCbbPage1(scoreboard,standings,rankings,tournament,now=new Date(),ticker){
  const season=scoreboard?.leagues?.[0]?.season||scoreboard?.season||{},year=number(season.year);
  need(Number.isInteger(year)&&year>=2025&&year<=2036&&number(season.type?.type??season.type)===2,
    'Current CBB regular season unavailable');
  const groups=standingsGroups(standings,year);
  need(groups.length===32&&groups.flatMap(g=>g.entries).length>=350,'Incomplete Division I standings');
  const poll=(rankings.rankings||[]).find(p=>p.name==='AP Top 25');
  need(number(rankings.requestedSeason?.year)===year&&number(poll?.season?.year)===year,
    'AP poll season mismatch');
  need(number(poll?.season?.type?.type)===2&&poll.ranks?.length===25&&
    new Set(poll.ranks.map(r=>String(r.team?.id))).size===25&&
    poll.ranks.every(r=>r.team?.id&&number(r.current)>=1&&number(r.current)<=25),'Incomplete AP Top 25');
  const archiveYear=year-1;
  const postseason=(tournament.events||[]).map(normalizeEvent).filter(e=>e&&number(e.season.year)===archiveYear&&
    number(e.season.type)===3&&/ncaa men's basketball championship/i.test(e.note));
  need(postseason.length===67&&new Set(postseason.map(e=>e.id)).size===67&&postseason.every(e=>e.completed&&e.state==='post'),
    'Last completed NCAA tournament requires all 67 verified finals');
  const stageOf=note=>[['national championship','final'],['final four','conference'],['elite 8','elite'],
    ['sweet 16','sweet'],['2nd round','second'],['1st round','first']].find(([word])=>note.toLowerCase().includes(word))?.[1];
  const matches=postseason.flatMap(e=>{
    const stage=stageOf(e.note);if(!stage)return [];
    const members=[e.away,e.home];
    need(members.every(t=>number(t.score)!==null)&&members.filter(t=>t.winner).length===1,'Unverified NCAA final result');
    return [{stage,conference:'',region: /- (East|West|South|Midwest) Region/.exec(e.note)?.[1]||'',
      teams:members,date:e.date,state:e.state,winner:members.find(t=>t.winner).id,summary:e.status,eventId:e.id}];
  });
  const expected={first:32,second:16,sweet:8,elite:4,conference:2,final:1};
  need(matches.length===63&&Object.entries(expected).every(([s,n])=>matches.filter(m=>m.stage===s).length===n),
    'Incomplete NCAA tournament rounds');
  const asOf=now.toISOString();
  return {board:'page1_cbb',context:{sport:'cbb',year,statsYear:year,label:`${year-1}–${String(year).slice(-2)}`,
    mode:'season',seasonType:2,asOf},warnings:[],
    rankings:{poll,projectionPoll:poll,season:rankings.requestedSeason,url:'https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/rankings'},
    standings:{groups,season:standings.season,url:'https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/standings'},
    postseason,ticker:ticker||tickerFromEvents((scoreboard.events||[]).map(normalizeEvent),now),
    playoffs:{kind:'actual',season:archiveYear,matches,sources:[]},
    sources:[],fetchedAt:asOf,dataState:'current',migration:{sections:['AP25','Division I standings','last completed NCAA tournament','ticker'],
      excluded:['unverified bracketology projections'],contract:'Original v8l CBB Page1 JSON'}};
}
