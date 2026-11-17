import {requireData as need,number} from './board-contract-common.mjs';
import {sports,favorites,leaderSpecs,contextOf,baseFeed,buildLeaders,buildFootballLeagueLeaders,buildSnapshot,rankingsOf,projectionOf,actualPlayoffs} from './remaining-board-contracts.mjs';
const aliases={celtics:'nba',bruins:'nhl',redsox:'mlb',fever:'wnba',arizona_cfb:'cfb',arizona_cbb:'cbb'};
export const remainingBoardIds=['page1_nhl','page1_mlb','page1_wnba','page1_cfb',
  'page2_nhl','page2_mlb','page2_wnba','page2_cfb','page2_cbb',
  'page3_celtics','page3_bruins','page3_redsox','page3_fever','page3_arizona_cfb','page3_arizona_cbb'];
export async function remainingBoard(request,ctx,readJson,gameWindow){
  const json=(value,status=200)=>{
    const cached=(value.sources||[]).filter(s=>s.state==='verified-public-season-cache');
    const remaining=cached.length?Math.floor(Math.min(...cached.map(s=>900-(Date.now()/1000-s.fetched_at)))):60;
    if(status===200&&remaining<=0)return new Response(JSON.stringify({ok:false,error:'Verified season source expired'}),{status:503});
    return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':status===200?'public, max-age='+Math.min(60,remaining):'no-store','X-Content-Type-Options':'nosniff',
      'X-Man-Cave-Contract':'original-v8l-remaining-staging'}});
  };
  if(request.method!=='GET')return json({ok:false,error:'GET only'},405);
  const board=new URL(request.url).pathname.split('/').at(-1);
  if(!remainingBoardIds.includes(board))return json({ok:false,error:'Unknown board'},404);
  const page=board.slice(0,5),suffix=board.slice(6),sport=aliases[suffix]||suffix,path=sports[sport],sources=[];
  const read=async url=>{
    const data=await readJson(url,ctx,8*1024*1024);
    sources.push({url,state:data.__mcSource?.kind||'current',fetched_at:
      data.__mcSource?.fetchedAt?Date.parse(data.__mcSource.fetchedAt)/1000:Date.now()/1000});return data;
  };
  try{
    const site='https://site.api.espn.com',root=site+'/apis/site/v2/sports/'+path;
    const groups=sport==='cfb'?'&groups=80':sport==='cbb'?'&groups=50':'';
    const scoreboard=await read(root+'/scoreboard?limit=1000'+groups),context=contextOf(sport,scoreboard);
    const [standings,ticker]=await Promise.all([
      read(site+'/apis/v2/sports/'+path+'/standings?season='+context.statsYear+'&seasontype=2'),
      gameWindow(path,scoreboard,context.year,ctx)
    ]);
    let base=baseFeed(board,sport,scoreboard,standings,ticker);
    if(page==='page1'){
      if(sport==='cfb'){
        need(context.mode==='season','CFB postseason adapter requires a verified playoff archive');
        base.rankings=rankingsOf(await read(root+'/rankings?season='+context.year),context);
      }
      if(context.mode==='season')base.playoffs=projectionOf(base,sport);
      else if(['mlb','wnba'].includes(sport)){
        // ESPN's MLB range form returns HTTP 400; verified YYYYMM queries
        // cover October/November without dozens of per-date subrequests.
        const archives=await Promise.all((sport==='mlb'?[
          ...Array.from({length:6},(_,i)=>String(context.statsYear)+'09'+(25+i)),String(context.statsYear)+'10',String(context.statsYear)+'11']:
          [String(context.statsYear)]).map(date=>read(root+'/scoreboard?dates='+date+'&limit=1000&seasontype=3')));
        base=actualPlayoffs(base,sport,archives);
      }else throw Error('Postseason source not yet verified for '+sport);
      base.migration={sections:['standings','rankings or verified postseason/projection','ticker'],excluded:[],contract:'Original v8l '+sport+' Page1 JSON'};
    }else{
      const common=site+'/apis/common/v3/sports/'+path+'/statistics/';
      const query='season='+context.statsYear+'&seasontype=2&limit=400&region=us&lang=en&page=';
      const first=await read(common+'byteam?'+query+'1');
      const pages=number(first.pagination?.pages)||1;need(pages>=1&&pages<=9,'Unexpected ESPN team-stat pagination');
      const others=await Promise.all(Array.from({length:pages-1},(_,i)=>read(common+'byteam?'+query+(i+2))));
      for(const data of others)need(number(data.requestedSeason?.year)===context.statsYear,'Team-stat page season mismatch');
      const teamsData={...first,teams:[...(first.teams||[]),...others.flatMap(d=>d.teams||[])]};
      // CBB's provider advertises 554 paginated records but only publishes 400
      // rows; page 2 can be empty. Resolve any missing D-I schools from their
      // exact current-year Core team stats rather than silently dropping ranks.
      if(sport==='cbb'){
        const present=new Set(teamsData.teams.map(r=>String(r.team?.id)));
        const missing=base.standings.groups.flatMap(g=>g.entries).filter(t=>!present.has(t.id));
        need(missing.length<=30,'Unexpected college team-stat source gap');
        const extra=await Promise.all(missing.map(async t=>{
          const d=await read(root+'/teams/'+t.id+'/statistics?season='+context.statsYear+'&seasontype=2');
          need(number(d.requestedSeason?.year)===context.statsYear&&
            number(d.requestedSeason?.type?.type??d.requestedSeason?.type)===2&&String(d.team?.id)===t.id,'CBB team Site year/type/identity mismatch');
          const categories=[];
          for(const c of d.results?.stats?.categories||[]){
            const names=first.categories.find(x=>x.name===c.name&&Array.isArray(x.names))?.names;if(!names)continue;
            const map=new Map((c.stats||[]).map(s=>[s.name,s]));
            categories.push({name:c.name,splitId:'0',displayName:'Own '+c.name,
              totals:names.map(n=>map.get(n)?.displayValue??''),values:names.map(n=>map.get(n)?.value??null)});
          }
          return {team:{id:t.id},categories};
        }));
        teamsData.teams.push(...extra);
      }
      if(page==='page2'){
        if(sport==='cfb'){
          const data=await read(site+'/apis/site/v3/sports/'+path+'/leaders?season='+context.statsYear+'&seasontype=2&groups=80');
          base=buildFootballLeagueLeaders(base,data,teamsData);
        }else{
        const leaders=await Promise.all(leaderSpecs[sport].map(([,cat,field])=>read(common+'byathlete?season='+context.statsYear+
          '&seasontype=2&isqualified='+(sport==='mlb'&&field!=='avg'?'false':'true')+
          '&limit='+(['cbb','cfb'].includes(sport)?400:5)+'&page=1&sort='+cat+'.'+field+':desc'+groups)));
        base=buildLeaders(base,sport,leaders,teamsData);
        }
      }else{
        const schedulesPromise=Promise.allSettled([1,2,3].map(type=>read(root+'/teams/'+favorites[sport]+'/schedule?season='+context.year+'&seasontype='+type)));
        const advancedPromise=['nba','wnba'].includes(sport)?Promise.all(base.standings.groups.flatMap(g=>g.entries).map(async t=>{
          const year=context.statsYear,url='https://sports.core.api.espn.com/v2/sports/basketball/leagues/'+sport+
            '/seasons/'+year+'/types/2/teams/'+t.id+'/statistics';
          const data=await read(url);
          need(String(data.season?.$ref||'').includes('/seasons/'+year+'?')&&
            String(data.seasonType?.$ref||'').includes('/seasons/'+year+'/types/2?'),'Advanced statistics year/type mismatch');
          const stats={};for(const c of data.splits?.categories||[])for(const s of c.stats||[])
            if(number(s.value)!==null)stats[c.name+'.'+s.name]={value:number(s.value),display:s.displayValue};
          return {id:t.id,stats};
        })):Promise.resolve([]);
        const [scheduleResults,advanced]=await Promise.all([schedulesPromise,advancedPromise]);
        base=buildSnapshot(base,sport,scheduleResults.filter(r=>r.status==='fulfilled').map(r=>r.value),teamsData,advanced);
        base.migration.scheduleSources=scheduleResults.map((r,i)=>({seasonType:i+1,state:r.status==='fulfilled'?
          (r.value.events?.length?'published':'not-published'):'unavailable'}));
      }
    }
    base.sources=sources;return json(base);
  }catch(error){return json({ok:false,board,error:'Original board data contract not verified',detail:error.message},503);}
}
