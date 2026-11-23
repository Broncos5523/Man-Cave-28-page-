/* STAGING-ONLY: two approved v8l Page 1 Arizona favorite panels.
 * Replaces obsolete next-game text with the official upcoming ESPN schedule.
 * Preserves the existing DOM classes, page structure, artwork, and controller.
 * No writes, credentials, storage or synthetic sports records.
 */
(function(){
'use strict';
const match=/^\/staging\/boards\/page1_(cfb|cbb)(?:\.html)?\/?$/.exec(location.pathname);
if(!match)return;
const sport=match[1],football=sport==='cfb';
const selector=football?'.favorite-next':'.favnext';
const league=football?'football/college-football':'basketball/mens-college-basketball';
const date=new Date(),year=date.getUTCFullYear(),month=date.getUTCMonth();
const season=football?(month<3?year-1:year):(month>=7?year+1:year);
const official='https://site.api.espn.com/apis/site/v2/sports/'+league+
  '/teams/12/schedule?season='+season;
let current=null,lastFetch=0,latestError=null;
const status={source:'ESPN official Arizona schedule',sport,season,selectedEvent:null,selectedDate:null,
  refreshedAt:null,error:null};
window.__MC_FAVORITE_NEXT_STATUS__=status;
function upcoming(data){
  if(String(data?.team?.id)!=='12'||!Array.isArray(data.events))
    throw Error('Official Arizona team schedule contract missing');
  const candidates=data.events.map(event=>{
    const competition=event.competitions?.[0];
    const teams=competition?.competitors||[];
    const arizona=teams.find(x=>String(x.team?.id)==='12');
    const opponent=teams.find(x=>String(x.team?.id)!=='12');
    const date=event.date||competition?.date,at=Date.parse(date||'');
    const state=competition?.status?.type||event.status?.type||{};
    if(!arizona||!opponent||!Number.isFinite(at)||state.completed||state.name==='STATUS_FINAL')return null;
    const live=state.name==='STATUS_IN_PROGRESS'||state.state==='in';
    if(!live&&at<Date.now()-900000)return null;
    const place=opponent.team?.location||opponent.team?.shortDisplayName||opponent.team?.displayName;
    if(!place)return null;
    return {id:event.id||date,at,live,home:arizona.homeAway==='home',name:String(place).toUpperCase()};
  }).filter(Boolean).sort((a,b)=>a.at-b.at);
  return candidates[0]||null;
}
function timeInET(ms){
  const d=new Date(ms);
  const fmt=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',
    month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true});
  const parts=fmt.formatToParts(d);
  const pick=t=>parts.find(x=>x.type===t)?.value||'';
  return (pick('month')+' '+pick('day')+' • '+pick('hour')+':'+pick('minute')+' '+pick('dayPeriod')+' ET').toUpperCase();
}
function shortDate(ms){
  return new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',
    month:'short',day:'numeric'}).format(new Date(ms)).toUpperCase();
}
function render(){
  const target=document.querySelector(selector);
  if(!target)return;
  const label=document.createElement('em');label.textContent=football?'NEXT GAME':'NEXT';
  let message='',detail='';
  if(current){
    message=(current.home?'VS ':'AT ')+current.name;
    detail=football?timeInET(current.at):shortDate(current.at);
    if(current.live)detail='LIVE · '+detail;
  }else{
    message=latestError?'SCHEDULE UPDATE UNAVAILABLE':'NEXT MATCHUP NOT PUBLISHED';
  }
  const expected=football?label.textContent+message+detail:label.textContent+message+' • '+detail;
  if(target.textContent?.replace(/\s+/g,'').toUpperCase()===expected.replace(/\s+/g,'').toUpperCase())return;
  const nodes=[label,document.createTextNode(message)];
  if(football){
    nodes.push(document.createElement('br'));
    if(detail)nodes.push(document.createTextNode(detail));
  }else if(detail){
    nodes.push(document.createTextNode(' • '+detail));
  }
  target.replaceChildren(...nodes);
  target.title=current?message+' • '+timeInET(current.at):message;
}
async function refresh(){
  if(Date.now()-lastFetch<60000)return;
  lastFetch=Date.now();
  try{
    const url='/proxy?url='+encodeURIComponent(official);
    const response=await fetch(url,{method:'GET',cache:'no-store',credentials:'omit'});
    if(!response.ok)throw Error('ESPN schedule HTTP '+response.status);
    const data=await response.json();
    if(data.requestedSeason?.year&&Number(data.requestedSeason.year)!==season)
      throw Error('ESPN schedule year mismatch');
    current=upcoming(data);
    latestError=null;
    Object.assign(status,{selectedEvent:current?.id||null,
      selectedDate:current?new Date(current.at).toISOString():null,
      refreshedAt:new Date().toISOString(),error:null});
  }catch(error){
    current=null;latestError=String(error.message||error).slice(0,100);
    status.error=latestError;
  }
  render();
}
function start(){
  render();
  void refresh();
  // An approved original renderer may rebuild its favorite panel. Reassert
  // the fetched official text without refetching the sports feed every second.
  setInterval(render,4000);
  setInterval(()=>{void refresh()},120000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
})();
