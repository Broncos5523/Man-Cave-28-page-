import {requireData as need,sourceSeason,statisticRows,number} from './board-contract-common.mjs';
const fmt=(v,kind)=>kind==='int'?v.toLocaleString('en-US',{maximumFractionDigits:0}):
  kind==='pct'?v.toFixed(1)+'%':kind==='signed'?(v>=0?'+':'')+v.toFixed(1):
  kind==='two'?v.toFixed(2):kind==='baseball'?v.toFixed(3).replace(/^0/,''):v.toFixed(1);
export function buildTeamPanels(base,data,sport){
  const year=number(base.context?.statsYear);sourceSeason(data,year);
  const clubs=(base.standings?.groups||[]).flatMap(g=>g.entries||[]),byId=new Map(clubs.map(t=>[t.id,t]));
  const rows=statisticRows(data).map(({row,stats})=>({team:byId.get(String(row.team?.id)),stats})).filter(t=>t.team);
  need(rows.length===clubs.length&&new Set(rows.map(t=>t.team.id)).size===clubs.length,'Incomplete league team statistics');
  const get=(t,key)=>number(t.stats[key]?.value);
  const against=t=>get(t,'opponent.offensive.avgPoints')??number(t.team.stats?.avgPointsAgainst?.value);
  const ints=t=>get(t,'defensiveinterceptions.interceptions')??get(t,'opponent.passing.interceptions');
  const sacks=t=>get(t,'opponent.passing.sacks');
  const sum=(...v)=>v.every(x=>x!==null)?v.reduce((a,b)=>a+b,0):null;
  const metric=key=>t=>get(t,key);
  const divide=(a,b)=>t=>{const x=get(t,a),y=get(t,b);return x!==null&&y?x/y:null;};
  const specs={
    nfl:{favorite:'7',leaders:[
      ['PASSING OFFENSE',metric('passing.netPassingYardsPerGame'),true,'one'],
      ['RUSHING OFFENSE',metric('rushing.rushingYardsPerGame'),true,'one'],['TEAM SACKS',sacks,true,'one'],
      ['INTERCEPTIONS',ints,true,'int'],['PASSING TDS',metric('passing.passingTouchdowns'),true,'int']],
      snapshot:[['POINTS / GAME',metric('passing.totalPointsPerGame'),true,'one'],
        ['TOTAL YPG',metric('passing.netYardsPerGame'),true,'one'],['RUSH YPG',metric('rushing.rushingYardsPerGame'),true,'one'],
        ['PASS YPG',metric('passing.netPassingYardsPerGame'),true,'one'],
        ['TOTAL DEFENSE',metric('opponent.passing.netYardsPerGame'),false,'one'],
        ['SCORING DEFENSE',metric('opponent.passing.totalPointsPerGame'),false,'one'],
        ['SACKS',sacks,true,'one'],['TAKEAWAYS',t=>sum(ints(t),get(t,'general.fumblesRecovered')),true,'int']]},
    nba:{favorite:'2',leaders:[['SCORING OFFENSE',metric('offensive.avgPoints'),true,'one'],
      ['SCORING DEFENSE',against,false,'one'],['REBOUNDS',metric('general.avgRebounds'),true,'one'],
      ['ASSISTS',metric('offensive.avgAssists'),true,'one'],['FIELD GOAL %',metric('offensive.fieldGoalPct'),true,'pct']],snapshot:[]}
  }[sport];
  need(specs,'Team panel sport not implemented');
  const valid=(label,fn)=>{
    const pairs=rows.map(t=>({t,v:fn(t)})).filter(x=>x.v!==null&&Number.isFinite(x.v));
    need(pairs.length===clubs.length,'Missing league-wide original metric: '+label);return pairs;
  };
  const leaders=specs.leaders.map(([label,fn,high,kind])=>{
    const pairs=valid(label,fn);pairs.sort((a,b)=>high?b.v-a.v:a.v-b.v);
    return {label,value:fmt(pairs[0].v,kind),team:pairs[0].t.team};
  });
  const own=rows.find(t=>t.team.id===specs.favorite);need(own,'Favorite team statistics missing');
  const snapshot=specs.snapshot.map(([label,fn,high,kind])=>{
    const pairs=valid(label,fn),v=fn(own);need(v!==null,'Favorite metric missing: '+label);
    return {label,value:fmt(v,kind),rank:1+pairs.filter(x=>high?x.v>v:x.v<v).length,population:pairs.length};
  });
  return {leaders,snapshot,warnings:[]};
}
