/* ESPN Bracketology source monitor for approved NCAA Page 1.
   Does NOT display a projected bracket without all 76 verified teams.
   Debug: window.__MC_BRACKETOLOGY_STATUS__. */
(()=>{
'use strict';
const state={lastChecked:null,lastArticleModified:null,source:'ESPN',complete:false,error:null};
window.__MC_BRACKETOLOGY_STATUS__=state;
const controller=new AbortController();
setTimeout(()=>controller.abort(),14000);
fetch('/production/api/bracketology-status',{cache:'no-store',signal:controller.signal})
.then(r=>{if(!r.ok)throw Error('ESPN Bracketology check HTTP '+r.status);return r.json()})
.then(d=>{
 state.lastChecked=d.checkedAt;
 state.lastArticleModified=d.articleModifiedAt;
 state.complete=d.completeProjectedBracket===true;
 state.sourceUrl=d.sourceUrl;
 state.status=d.status;
 state.title=d.title;
 // The underlying article exposes only metadata, not 76 verified entries.
 // Do not overwrite the approved 2026 recap with a guessed projection.
})
.catch(e=>{state.error=String(e&&e.message||e)});
})();