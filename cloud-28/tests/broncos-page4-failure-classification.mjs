/* Diagnostic only. No Firebase access, TV writes, or production changes.
   Explain why ESPN's Denver 2026 regular-season player rows fail strict validation. */
import {readFileSync,writeFileSync} from 'node:fs';
import {seasonStatsFromSite} from '../cloudflare-live-proxy.mjs';
const live='https://man-cave-28-page.broncos5523.workers.dev';
const site='https://site.api.espn.com/apis/common/v3/sports/football/nfl/athletes/';
const year=2026,team='7';
const audit=JSON.parse(readFileSync('broncos-page4-source-state.json','utf8'));
const requests=audit.responses||[];
const ids=[...new Set(requests.filter(x=>x.status>=400).map(x=>x.athleteId).filter(Boolean))];
async function jsonAt(url){
  const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'ManCavePage4ReadOnlyAudit/1.0'},signal:AbortSignal.timeout(14000)});
  let body;try{body=await r.json()}catch{body={}};
  return {status:r.status,body};
}
async function one(id){
  const route=live+'/migration-api/nfl/season-stats?athlete='+encodeURIComponent(id)+'&season=2026&team=7&audit=1';
  const rawUrl=site+encodeURIComponent(id)+'/stats?season=2026&seasontype=2';
  const [routeResult,sourceResult]=await Promise.allSettled([jsonAt(route),jsonAt(rawUrl)]);
  const routeValue=routeResult.status==='fulfilled'?routeResult.value:{status:0,body:{}};
  const source=sourceResult.status==='fulfilled'?sourceResult.value:{status:0,body:{}};
  const data=source.body;
  const filters=(data.filters||[]).map(f=>({name:f.name,value:f.value}));
  const categories=(data.categories||[]).map(c=>({
    name:c.name,
    currentDenver:(c.statistics||[]).filter(x=>Number(x?.season?.year)===year&&String(x?.teamId)===team).length,
    currentOther:(c.statistics||[]).filter(x=>Number(x?.season?.year)===year&&String(x?.teamId)!==team).map(x=>String(x.teamId)).slice(0,3),
    years:[...new Set((c.statistics||[]).map(x=>Number(x?.season?.year)).filter(Number.isFinite))].sort().slice(-4)
  }));
  let validation='unknown'; if(source.status===200){
    try{const converted=seasonStatsFromSite(data,year,id,team);
      validation='valid:'+converted.splits.categories.length;
    }catch(e){validation=String(e.message||e).slice(0,120);}
  }else validation='source-status-'+source.status;
  return {id,routeStatus:routeValue.status,routeError:routeValue.body?.error||null,
    sourceStatus:source.status,validation,filters,
    currentDenverCategories:categories.filter(c=>c.currentDenver>0).length,
    currentOtherTeamIds:[...new Set(categories.flatMap(c=>c.currentOther))],
    recentYears:[...new Set(categories.flatMap(c=>c.years))].sort(),categories:categories.length};
}
const results=[];
for(let i=0;i<ids.length;i+=5){
  results.push(...await Promise.all(ids.slice(i,i+5).map(one)));
}
const states={};for(const x of results)states[x.validation]=(states[x.validation]||0)+1;
const report={asOf:new Date().toISOString(),year,team,failedAthleteIds:ids.length,
  countsByValidation:states,results};
writeFileSync('broncos-page4-failure-classification.json',JSON.stringify(report,null,2));
console.log('BRONCOS_PAGE4_FAILURE_CLASSIFICATION',JSON.stringify({total:ids.length,counts:states,records:results.map(x=>({
  id:x.id,route:x.routeStatus,source:x.sourceStatus,valid:x.validation,
  denver:x.currentDenverCategories,other:x.currentOtherTeamIds,years:x.recentYears
}))}));
