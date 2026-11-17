/* MAN CAVE SPORTS BOOK — Page 4 cloud-only basketball data.
   Approved spotlights, portraits, typography, timing, team logos, ticker untouched.
   No prior-season fallback. Debug: window.__MC_PAGE4_LIVE_STATUS__. */
(()=>{
'use strict';
const board=window.__MC_PRODUCTION_BOARD;
if(!['page4_celtics','page4_arizona_cbb','page4_fever'].includes(board))return;
const apply=()=>board==='page4_celtics'?window.__MC_NBA_P4_APPLY__:
  board==='page4_fever'?window.__MC_FEV_P4_APPLY__:window.__MC_CBB_P4_APPLY__;
const state={board,lastAttempt:null,lastSuccess:null,lastError:null,season:null,verifiedPlayers:0};
window.__MC_PAGE4_LIVE_STATUS__=state;
let fetching=false,hadGood=false;
function message(value){
 const el=document.getElementById('fresh');
 if(el)el.textContent=value;
}
function update(){
 if(fetching)return;fetching=true;state.lastAttempt=new Date().toISOString();
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),24000);
 fetch('/production/api/page4-live?board='+encodeURIComponent(board)+'&time='+Date.now(),{
   cache:'no-store',signal:ctrl.signal
 }).then(r=>{
   if(!r.ok)throw Error('ESPN current-season feed HTTP '+r.status);
   return r.json();
 }).then(data=>{
   const minimumSeason=board==='page4_fever'?2026:2027;
   if(data.board!==board||data.season<minimumSeason||!Array.isArray(data.roster)||data.roster.length<10||
      !Array.isArray(data.leaders)||data.leaders.length!==6||data.verifiedPlayers<3)
     throw Error('Incomplete verified current-season data');
   const callback=apply();
   if(typeof callback!=='function')throw Error('Page 4 live binding not installed');
   callback(data);
   state.lastSuccess=new Date().toISOString();state.lastError=null;
   state.season=data.season;state.verifiedPlayers=data.verifiedPlayers;hadGood=true;
   const at=new Date(data.updatedAt).toLocaleTimeString('en-US',{
      timeZone:'America/New_York',hour:'numeric',minute:'2-digit'});
   message('ESPN · '+data.seasonLabel+' CURRENT SEASON · UPDATED '+at+' ET');
 }).catch(error=>{
   state.lastError=String(error&&error.message||error);
   message(hadGood?'ESPN DATA DELAYED · LAST VERIFIED '+state.season+' SNAPSHOT':
        'ESPN CURRENT-SEASON DATA UNAVAILABLE · STATS NOT VERIFIED');
 }).finally(()=>{clearTimeout(timer);fetching=false});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',update,{once:true});
else update();
setInterval(update,90000);
addEventListener('online',update);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
})();
