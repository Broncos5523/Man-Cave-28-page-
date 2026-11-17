/* Ports of the immutable v8l live_data.py/playoffs.py data models. */
import {requireData as need,number,teamInfo,standingsGroups,normalizeEvent,sourceSeason,statisticRows} from './board-contract-common.mjs';
import {buildTeamPanels} from './team-panels-contract.mjs';
import {basketballLeaderSpecs} from './nba-page2-contract.mjs';
export const sports={nhl:'hockey/nhl',mlb:'baseball/mlb',wnba:'basketball/wnba',cfb:'football/college-football',cbb:'basketball/mens-college-basketball',nba:'basketball/nba'};
export const favorites={nhl:'1',mlb:'2',wnba:'5',cfb:'12',cbb:'12',nba:'2'};
export const footballSpecs=[['PASSING YARDS','passing','passingYards'],['PASSING TOUCHDOWNS','passing','passingTouchdowns'],
  ['RUSHING YARDS','rushing','rushingYards'],['RECEIVING YARDS','receiving','receivingYards'],
  ['SACKS','defensive','sacks'],['INTERCEPTIONS','defensiveinterceptions','interceptions']];
export const leaderSpecs={nba:basketballLeaderSpecs,wnba:basketballLeaderSpecs,cbb:basketballLeaderSpecs,cfb:footballSpecs,
  nhl:[['POINTS','offensive','points'],['GOALS','offensive','goals'],['ASSISTS','offensive','assists'],
    ['SHOTS ON GOAL','offensive','shotsTotal'],['GOALIE WINS','general','wins'],['SAVE PERCENTAGE','defensive','savePct']],
  mlb:[['HOME RUNS','batting','homeRuns'],['BATTING AVERAGE','batting','avg'],['RUNS BATTED IN','batting','RBIs'],
    ['STOLEN BASES','batting','stolenBases'],['STRIKEOUTS','pitching','strikeouts'],['SAVES','pitching','saves']]};
export function contextOf(sport,scoreboard,now=new Date()){
  const league=scoreboard.leagues?.[0],season=league?.season||scoreboard.season||{};
  const year=number(season.year),type=number(season.type?.type??season.type);
  need(Number.isInteger(year)&&year>=2024&&year<=2036&&[1,2,3,4].includes(type),'Unverified current league season');
  const regular=(league?.calendar||[]).find(x=>typeof x==='object'&&String(x.value)==='2');
  const start=Date.parse(season.startDate),end=Date.parse(season.endDate);
  let mode=now.getTime()>end?'offseason':type===1||now.getTime()<Date.parse(regular?.startDate)?'preseason':
    type===3?'postseason':type===2?'season':'offseason';
  if(sport==='cbb'&&now.getTime()<Date.UTC(year-1,10,1))mode='preseason';
  if(now.getTime()<start)mode='offseason';
  let statsYear=mode==='preseason'||mode==='offseason'&&now.getTime()<start?year-1:year;
  if(sport==='cfb'&&mode==='offseason'&&now.getUTCMonth()>=1&&now.getUTCMonth()<=6&&year===now.getUTCFullYear())statsYear=year-1;
  return {sport,year,statsYear,label:['nba','nhl','cbb'].includes(sport)?`${statsYear-1}–${String(statsYear).slice(-2)}`:String(statsYear),
    mode,seasonType:type,asOf:now.toISOString()};
}
export function baseFeed(board,sport,scoreboard,standings,ticker,now=new Date()){
  const context=contextOf(sport,scoreboard,now),groups=standingsGroups(standings,context.statsYear);
  const teams=groups.flatMap(g=>g.entries),expected={nba:30,nhl:32,mlb:30,wnba:15};
  if(expected[sport])need(teams.length===expected[sport],'Incomplete '+sport+' league standings');
  if(sport==='cfb')need(teams.length>=130,'Incomplete FBS standings');
  if(sport==='cbb')need(groups.length===32&&teams.length>=350,'Incomplete Division I standings');
  if(sport==='wnba'){
    const ordered=[...teams].sort((a,b)=>b.pct-a.pct||b.wins-a.wins||a.losses-b.losses);
    ordered.forEach((t,i)=>t.seed=i+1);
  }
  return {board,context,warnings:[],standings:{groups,season:standings.season,url:'https://site.api.espn.com/apis/v2/sports/'+sports[sport]+'/standings'},
    ticker,postseason:[],sources:[],fetchedAt:now.toISOString(),dataState:'current'};
}
export function buildLeaders(base,sport,sources,teamsData){
  const clubs=base.standings.groups.flatMap(g=>g.entries),byId=new Map(clubs.map(t=>[t.id,t]));
  const teamStats=new Map(statisticRows(teamsData).map(x=>[String(x.row.team?.id),x.stats]));
  need(sources.length===6,'Original six leader categories required');
  const players=leaderSpecs[sport].map(([label,cat,field],i)=>{
    const data=sources[i];sourceSeason(data,base.context.statsYear);
    let chosen;
    for(const candidate of statisticRows(data)){
      const athlete=candidate.row.athlete||{};
      const details=(athlete.teams||[athlete.team||candidate.row.team||{id:athlete.teamId,
        displayName:athlete.teamName,shortDisplayName:athlete.teamName,abbreviation:athlete.teamShortName,logos:athlete.teamLogos}])
        .find(t=>byId.has(String(t?.id)));
      const v=candidate.stats[cat+'.'+field];
      if(!details||number(v?.value)===null||!v?.display||['-','--'].includes(String(v.display)))continue;
      if(sport==='cbb'){
        const own=teamStats.get(String(details.id)),gp=candidate.stats['general.gamesPlayed']?.value,teamGp=own?.['general.gamesPlayed']?.value;
        if(!teamGp||gp<teamGp*.75)continue;
        if(field==='fieldGoalPct'&&(candidate.stats['offensive.avgFieldGoalsMade']?.value||0)<5)continue;
        if(field==='threePointFieldGoalPct'&&(candidate.stats['offensive.avgThreePointFieldGoalsMade']?.value||0)<2.5)continue;
      }
      chosen={candidate,athlete,details,v};break;
    }
    need(chosen,'No verified qualified '+sport+' '+label+' leader');
    const {candidate,athlete,details,v}=chosen;
    return {label,id:String(athlete.id),name:athlete.displayName,headshot:athlete.headshot?.href||'',
      team:{...byId.get(String(details.id)),...teamInfo(details)},value:String(v.display),number:v.value,stats:candidate.stats,
      source:'ESPN qualified '+cat+'.'+field,season:base.context.statsYear};
  });
  return {...base,leaders:{players,errors:[]},teamPanels:buildTeamPanels(base,teamsData,sport),
    migration:{sections:['six original athlete categories','five original team categories','standings','ticker'],
      excluded:['unverified award/editorial projections'],contract:'Original v8l '+sport+' Page2 JSON'}};
}
export function buildFootballLeagueLeaders(base,data,teamsData){
  sourceSeason(data,base.context.statsYear);
  const byId=new Map(base.standings.groups.flatMap(g=>g.entries).map(t=>[t.id,t]));
  const players=footballSpecs.map(([label,,field])=>{
    const category=data.leaders?.categories?.find(c=>c.name===field);
    const row=category?.leaders?.find(r=>byId.has(String(r.team?.id)));
    const athlete=row?.athlete,value=number(row?.value);
    need(athlete?.id&&athlete?.displayName&&value!==null,'Missing verified FBS '+label+' leader');
    return {label,id:String(athlete.id),name:athlete.displayName,headshot:athlete.headshot?.href||'',
      team:{...byId.get(String(row.team.id)),...teamInfo(row.team)},number:value,
      value:field==='sacks'?value.toFixed(1):value.toLocaleString('en-US',{maximumFractionDigits:0}),
      stats:{},source:'ESPN current FBS league leaders',season:base.context.statsYear};
  });
  return {...base,leaders:{players,errors:[]},teamPanels:buildTeamPanels(base,teamsData,'cfb'),
    migration:{sections:['six original FBS athlete categories','five original FBS team categories','standings','ticker'],
      excluded:['unverified award/editorial projections'],contract:'Original v8l CFB Page2 JSON'}};
}
export function buildSnapshot(base,sport,schedules,teamsData,advanced=[]){
  const id=favorites[sport],events=new Map();
  for(const data of schedules){
    if(!data.events?.length&&!data.requestedSeason)continue;
    need(number(data.requestedSeason?.year)===base.context.year&&String(data.team?.id)===id,'Schedule team/year mismatch');
    for(const raw of data.events||[]){
      const e=normalizeEvent(raw);
      need(e&&number(e.season.year)===base.context.year&&(e.away.id===id||e.home.id===id),'Unverified favorite schedule event');
      events.set(e.id,e);
    }
  }
  for(const e of base.ticker.events||[])if(e.away.id===id||e.home.id===id)events.set(e.id,e);
  const schedule=[...events.values()].sort((a,b)=>a.date.localeCompare(b.date));
  need(schedule.length>0,'No verified favorite schedule');
  const panels=buildTeamPanels(base,teamsData,sport,advanced);
  need(panels.snapshot.length===6,'All six original favorite-team metrics required');
  return {...base,schedule,teamPanels:panels,migration:{sections:['favorite season schedule','last game','last five','next game',
    'six original team metrics and league ranks','standings','ticker'],excluded:[],contract:'Original v8l '+sport+' Page3 JSON'}};
}
export function rankingsOf(data,ctx){
  need(number(data.requestedSeason?.year)===ctx.year,'College poll year mismatch');
  const poll=(data.rankings||[]).find(p=>p.name==='AP Top 25');
  need(number(poll?.season?.year)===ctx.year&&poll.ranks?.length>=25,'Current AP poll unavailable');
  const projectionPoll=(data.rankings||[]).find(p=>/playoff/i.test(p.name||'')&&number(p.season?.year)===ctx.year&&new Date(p.date).getUTCMonth()>=7)||poll;
  return {poll,projectionPoll,season:data.requestedSeason,url:'https://site.api.espn.com/apis/site/v2/sports/football/college-football/rankings'};
}
function conference(t,sport){
  const path=(t.path||[]).join(' ');
  return sport==='mlb'?(/American/.test(path)?'al':'nl'):/Eastern/.test(path)?'east':'west';
}
export function projectionOf(base,sport){
  const teams=base.standings.groups.flatMap(g=>g.entries),matches=[];
  const match=(conf,pair)=>matches.push({stage:'first',conference:conf,teams:pair.map(t=>t?{...t,score:''}:null),winner:null});
  if(sport==='cfb'){
    const poll=base.rankings.projectionPoll,index=new Map(poll.ranks.map(r=>[String(r.team.id),r.current]));
    const ordered=[...teams].sort((a,b)=>(index.get(a.id)||1000)-(index.get(b.id)||1000)||b.pct-a.pct);
    const automatic=['Atlantic Coast','Big Ten','Big 12','Southeastern'].map(c=>ordered.find(t=>t.path.some(p=>p.includes(c))));
    automatic.push(ordered.find(t=>t.path.some(p=>['American','Conference USA','Mid-American','Mountain West','Pac-12','Sun Belt'].some(c=>p.includes(c)))));
    need(automatic.every(Boolean),'CFP automatic-bid conference source incomplete');
    const field=new Map(automatic.map(t=>[t.id,t]));
    for(const t of ordered){if(field.size>=12)break;field.set(t.id,t);}
    const seeded=[...field.values()].sort((a,b)=>(index.get(a.id)||1000)-(index.get(b.id)||1000)).map((t,i)=>({...t,seed:i+1}));
    for(const [a,b] of [[8,9],[5,12],[7,10],[6,11]])match('',[seeded[a-1],seeded[b-1]]);
    return {kind:'projection',season:base.context.statsYear,matches,field:seeded,
      out:ordered.filter(t=>!field.has(t.id)).slice(0,4),method:poll.name+' + CFP automatic bids',
      sources:['https://collegefootballplayoff.com/news/2026/8/6/sc-aug-2627']};
  }
  const pools=new Map();for(const t of teams){const conf=sport==='wnba'?'all':conference(t,sport);if(!pools.has(conf))pools.set(conf,[]);pools.get(conf).push(t);}
  for(const [conf,pool] of pools){
    pool.sort((a,b)=>a.seed-b.seed);
    if(sport==='nhl'){
      const membership={Atlantic:['BOS','BUF','DET','FLA','MTL','OTT','TB','TOR'],Metropolitan:['CAR','CBJ','NJ','NYI','NYR','PHI','PIT','WSH'],
        Central:['CHI','COL','DAL','MIN','NSH','STL','UTA','WPG'],Pacific:['ANA','CGY','EDM','LA','SJ','SEA','VAN','VGK']};
      const divisions=new Map();for(const t of pool){
        t.division=Object.entries(membership).find(([,ids])=>ids.includes(t.abbr))?.[0];
        need(t.division,'Unverified NHL division');if(!divisions.has(t.division))divisions.set(t.division,[]);divisions.get(t.division).push(t);
      }
      const groups=[...divisions.values()].sort((a,b)=>a[0].seed-b[0].seed);need(groups.length===2,'NHL conference divisions incomplete');
      const top=new Set(groups.flatMap(g=>g.slice(0,3).map(t=>t.id))),wild=pool.filter(t=>!top.has(t.id)).slice(0,2);
      need(wild.length===2,'NHL wildcard pair incomplete');
      groups.forEach((g,i)=>{match(conf,[g[0],wild[1-i]]);match(conf,[g[1],g[2]]);});
    }else for(const [a,b] of sport==='mlb'?[[3,6],[4,5]]:[[1,8],[4,5],[2,7],[3,6]])match(conf,[pool[a-1],pool[b-1]]);
  }
  return {kind:'projection',season:base.context.statsYear,matches,sources:[]};
}
export function actualPlayoffs(base,sport,raw){
  const byId=new Map(base.standings.groups.flatMap(g=>g.entries).map(t=>[t.id,t]));
  const postseason=raw.flatMap(d=>(d.events||[]).map(normalizeEvent)).filter(e=>e&&number(e.season.year)===base.context.statsYear&&number(e.season.type)===3);
  const unique=[...new Map(postseason.map(e=>[e.id,e])).values()];
  const stageOf=note=>sport==='mlb'?['alwc','nlwc','alds','nlds','alcs','nlcs'].find(s=>note.toLowerCase().includes(s))||(/world series/i.test(note)?'world':null):
    /semifinal/i.test(note)?'second':/wnba finals/i.test(note)?'final':/first round|1st round/i.test(note)?'first':null;
  const grouped=new Map();
  for(const e of unique){
    const stage=stageOf(e.note);if(!stage)continue;
    const pair=[e.away.id,e.home.id].sort(),key=stage+':'+pair.join('-');
    if(!grouped.has(key))grouped.set(key,{stage,pair,events:[]});grouped.get(key).events.push(e);
  }
  const matches=[];
  for(const {stage,events} of grouped.values()){
    const played=events.filter(e=>['in','post'].includes(e.state)&&Date.parse(e.date)<=Date.now()).sort((a,b)=>a.date.localeCompare(b.date));
    const latest=played.at(-1);if(!latest)continue;
    const members=[latest.away,latest.home].map(t=>({...byId.get(t.id),...t,
      seed:byId.get(t.id)?.seed??t.seed,score:played.filter(e=>e.completed&&
        (e.away.id===t.id&&number(e.away.score)>number(e.home.score)||e.home.id===t.id&&number(e.home.score)>number(e.away.score))).length}));
    const threshold=sport==='mlb'&&stage.endsWith('wc')||sport==='wnba'&&stage==='first'?2:
      sport==='mlb'&&stage.endsWith('ds')||sport==='wnba'&&stage==='second'?3:4;
    const winner=members.find(t=>t.score>=threshold);
    matches.push({stage,conference:stage==='world'||stage==='final'?'':conference(byId.get(latest.away.id)||{},sport),region:'',
      teams:members,date:latest.date,state:latest.state,winner:winner?.id||null,eventId:latest.id,
      summary:winner?winner.abbr+' WINS '+winner.score+'–'+Math.min(...members.map(t=>t.score)):'SERIES '+members.map(t=>t.score).join('–')});
  }
  need(matches.length===(sport==='mlb'?11:7)&&matches.some(m=>['world','final'].includes(m.stage)&&m.winner),'Completed postseason archive unverified');
  matches.sort((a,b)=>a.conference.localeCompare(b.conference)||
    Math.min(...a.teams.map(t=>t.seed||999))-Math.min(...b.teams.map(t=>t.seed||999)));
  return {...base,postseason:unique,playoffs:{kind:'actual',season:base.context.statsYear,matches,sources:[]}};
}
