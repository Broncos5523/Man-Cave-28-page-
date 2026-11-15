/* Current ESPN Draft Watch per-game stats; original design untouched. */
(()=>{
'use strict';
const state={lastSuccess:null,lastAttempt:null,error:null,season:null,stats:null};
window.__MC_DRAFT_STATS_SYNC__=state;
let latest=null,busy=false;
function updateDOM(){
 const cells=[...document.querySelectorAll('#draftSpotlight .hero-substats > div')];
 if(cells.length!==3||!latest)return;
 const current=document.querySelector('.hero-name')?.textContent?.replace(/\s+/g,' ').trim().toLowerCase()==='tyran stokes';
 ['PPG','RPG','APG'].forEach((key,i)=>{
   const value=cells[i].querySelector('b'),label=cells[i].querySelector('span');
   if(label)label.textContent=key;
   if(value)value.textContent=current&&latest.stats[key]!=null?Number(latest.stats[key]).toFixed(1):'—';
 });
 const note=document.querySelector('#draftSpotlight .hero-note');
 if(note&&current)note.title='ESPN '+latest.seasonLabel+' • '+latest.gamesPlayed+' GP • checked '+latest.fetchedAt;
}
function refresh(){
 if(busy)return;busy=true;state.lastAttempt=new Date().toISOString();
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),18000);
 fetch('/production/api/draft-watch-stats?ts='+Date.now(),{cache:'no-store',signal:ctrl.signal})
  .then(r=>{if(!r.ok)throw Error('ESPN stats HTTP '+r.status);return r.json()})
  .then(d=>{
   if(d.playerId!=='5142731'||d.season<2027||d.gamesPlayed<1||
      !['PPG','RPG','APG'].every(k=>Number.isFinite(Number(d.stats?.[k]))))
     throw Error('Incomplete current-season statistics');
   latest=d;state.lastSuccess=new Date().toISOString();state.error=null;
   state.season=d.season;state.stats=d.stats;updateDOM();
  })
  .catch(e=>{
   state.error=String(e&&e.message||e);
   if(!latest)document.querySelectorAll('#draftSpotlight .hero-substats b').forEach(x=>x.textContent='—');
  }).finally(()=>{clearTimeout(timer);busy=false});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});
else refresh();
setInterval(refresh,90000);
setInterval(updateDOM,2000);
addEventListener('online',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();