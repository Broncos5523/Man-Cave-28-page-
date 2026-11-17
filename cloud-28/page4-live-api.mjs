import {page4Teams,buildPage4,currentPlayerMap} from './page4-live-contract.mjs';
import {contextOf} from './remaining-board-contracts.mjs';
import {requireData as need} from './board-contract-common.mjs';
export async function page4LiveApi(request,ctx,read){
  const answer=(data,status=200)=>{
    const checked=Date.parse(data.updatedAt||data.fetchedAt);
    const ttl=Number.isFinite(checked)?Math.min(30,Math.floor(900-(Date.now()-checked)/1000)):30;
    if(status===200&&ttl<=0)return answer({ok:false,error:'Verified player season source expired'},503);
    return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':status===200?'public, max-age='+ttl:'no-store','X-Content-Type-Options':'nosniff'}});
  };
  if(request.method!=='GET')return answer({ok:false,error:'GET only'},405);
  const url=new URL(request.url),draft=url.pathname.endsWith('/draft-watch-stats'),board=url.searchParams.get('board');
  const config=draft?{league:'mens-college-basketball',team:'2305'}:page4Teams[board];
  if(!config)return answer({ok:false,error:'Unknown approved player board'},400);
  try{
    const site='https://site.api.espn.com/apis/site/v2/sports/basketball/'+config.league;
    const scoreboard=await read(site+'/scoreboard?limit=10',ctx);
    const sport=config.league==='mens-college-basketball'?'cbb':config.league;
    const context=contextOf(sport,scoreboard),year=context.statsYear;
    const roster=await read(site+'/teams/'+config.team+'/roster?season='+year,ctx);
    if(draft){
      need(roster.season?.year===year&&roster.team?.id===config.team,'Draft Watch roster year/team mismatch');
      need(roster.athletes?.some(p=>String(p.id)==='5142731'&&p.displayName?.toLowerCase()==='tyran stokes'),'Tyran Stokes is not on the verified current Kansas roster');
      const data=await read('https://sports.core.api.espn.com/v2/sports/basketball/leagues/mens-college-basketball/seasons/'+year+'/types/2/athletes/5142731/statistics/0?lang=en&region=us',ctx);
      const map=currentPlayerMap(data,year,'5142731');need(map.gamesPlayed>0,'No verified current-year Draft Watch appearances');
      const stats={PPG:map.avgPoints,RPG:map.avgRebounds,APG:map.avgAssists};
      need(Object.values(stats).every(v=>typeof v==='number'&&Number.isFinite(v)),'Draft Watch averages incomplete');
      return answer({source:'ESPN',season:year,seasonLabel:`${year-1}–${String(year).slice(-2)}`,playerId:'5142731',name:'Tyran Stokes',
        team:'Kansas Jayhawks',gamesPlayed:map.gamesPlayed,stats,dataState:'current',fetchedAt:data.__mcSource?.fetchedAt||new Date().toISOString()});
    }
    const results=await Promise.allSettled((roster.athletes||[]).map(async p=>{
      const id=String(p.id);if(!/^\d+$/.test(id))return null;
      return [id,await read('https://sports.core.api.espn.com/v2/sports/basketball/leagues/'+config.league+
        '/seasons/'+year+'/types/2/athletes/'+id+'/statistics/0?lang=en&region=us',ctx)];
    }));
    const stats=Object.fromEntries(results.filter(r=>r.status==='fulfilled'&&r.value).map(r=>r.value));
    return answer(buildPage4(board,year,roster,stats));
  }catch(error){return answer({ok:false,error:'Current-year player statistics not verified',detail:error.message},503);}
}
