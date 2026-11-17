/* Transport-only equivalents of the immutable v8l live_data.py contract. */
export const requireData=(ok,message)=>{if(!ok)throw Error(message);};
export const number=value=>value===null||value===undefined||value===''?null:
  Number.isFinite(Number(value))?Number(value):null;
export function teamInfo(team={}){
  return {id:String(team.id||''),name:team.displayName||team.name||'',
    short:team.shortDisplayName||team.nickname||team.name||'',abbr:team.abbreviation||'',
    logo:team.logo||team.logos?.find(x=>x.href)?.href||'',
    color:team.color||'',alternateColor:team.alternateColor||''};
}
export function normalizeEvent(event){
  const comp=event?.competitions?.[0],sides=comp?.competitors||[];
  const away=sides.find(x=>x.homeAway==='away'),home=sides.find(x=>x.homeAway==='home');
  if(!event?.id||!away?.team?.id||!home?.team?.id)return null;
  const status=comp.status||event.status||{},type=status.type||{};
  const club=x=>({...teamInfo(x.team),score:x.score?.displayValue??x.score??null,
    winner:x.winner===true,seed:x.curatedRank?.current||x.seed||null});
  return {id:String(event.id),date:event.date||comp.date,
    endDate:event.endDate||comp.endDate||status.endDate||null,
    away:club(away),home:club(home),state:type.state||'pre',completed:type.completed===true,
    status:type.shortDetail||type.detail||type.description||'',statusName:type.name||'',
    timeValid:comp.timeValid!==false,venue:comp.venue?.fullName||'',
    note:(comp.notes||[]).map(x=>x.headline||'').join(' • '),
    season:{...(event.season||{}),type:event.season?.type??event.seasonType?.type},
    series:comp.series||null,competitionType:comp.type||{},neutral:comp.neutralSite===true};
}
export function standingsGroups(data,year){
  requireData(number(data?.season?.year)===year,'Standings season mismatch');
  const groups=[];
  function walk(obj,trail=[]){
    if(!obj||typeof obj!=='object')return;
    const label=obj.name||obj.displayName||'',path=label&&!trail.includes(label)?[...trail,label]:trail;
    const table=obj.standings&&typeof obj.standings==='object'?obj.standings:obj;
    if(Array.isArray(table.entries)){
      requireData(number(table.season)===year&&number(table.seasonType)===2,'Conference season/type mismatch');
      const entries=table.entries.filter(e=>e.team).map(e=>{
        const stats={};for(const s of e.stats||[])if(s.name&&!(s.name in stats))stats[s.name]=s;
        const wins=number(stats.wins?.value),losses=number(stats.losses?.value);
        requireData(wins!==null&&losses!==null&&wins>=0&&losses>=0,'Missing verified team record');
        return {...teamInfo(e.team),wins,losses,ties:number(stats.ties?.value),
          otLosses:number(stats.otLosses?.value),points:number(stats.points?.value),
          seed:number(stats.playoffSeed?.value),pct:number(stats.winPercent?.value),
          streak:stats.streak?.displayValue||'',stats,record:stats.overall?.displayValue||'',group:label,path};
      });
      requireData(entries.length>0,'Empty standings group');
      groups.push({name:label,path,entries});
    }
    for(const child of obj.children||[])walk(child,path);
  }
  walk(data);
  const ids=groups.flatMap(g=>g.entries.map(t=>t.id));
  requireData(ids.length>0&&new Set(ids).size===ids.length,'Empty or duplicate standings teams');
  return groups;
}
export function tickerFromEvents(events,now=new Date()){
  const unique=new Map();
  for(const e of events)if(e&&!/postponed|cancell?ed|suspended/i.test(e.statusName+' '+e.status))unique.set(e.id,e);
  const values=[...unique.values()].sort((a,b)=>a.date.localeCompare(b.date));
  const live=values.filter(e=>e.state==='in'&&!e.completed),asOf=now.toISOString();
  if(live.length)return {events:values,selected:live,selection:'live',asOf};
  const start=now.getTime(),day=86400000;
  const finals=values.filter(e=>(e.completed||e.state==='post')&&
    Date.parse(e.endDate||e.date)>=start-day&&Date.parse(e.endDate||e.date)<=start);
  const upcoming=values.filter(e=>e.state==='pre'&&Date.parse(e.date)>=start&&Date.parse(e.date)<=start+7*day);
  return {events:values,selected:[...finals,...upcoming],selection:'finals-upcoming',asOf};
}
export function sourceSeason(data,year){
  const s=data?.requestedSeason;
  requireData(number(s?.year)===year&&number(s?.type?.type??s?.type)===2,'Statistics season/type mismatch');
}
export function statisticRows(data){
  // Some ESPN definitions repeat a category without names. Keep the first
  // complete glossary, just as the original Python athlete_stats_map does.
  const definitions=new Map();
  for(const c of data.categories||[])if(c.name&&Array.isArray(c.names)&&!definitions.has(c.name))definitions.set(c.name,c.names);
  return (data.teams||data.athletes||[]).map(row=>{
    const stats={};
    for(const c of row.categories||[]){
      const prefix=String(c.splitId)==='900'||/Opponent/.test(c.displayName||'')?'opponent.':'';
      (definitions.get(c.name)||[]).forEach((name,i)=>{
        const key=prefix+c.name+'.'+name;
        if(!(key in stats)&&i<(c.totals||[]).length)
          stats[key]={display:c.totals[i],value:number(c.values?.[i])};
      });
    }
    return {row,stats};
  });
}
