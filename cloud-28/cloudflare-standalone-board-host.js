/* MAN CAVE SPORTS BOOK — standalone Cloudflare VISUAL STAGING HOST.
 * The approved board runtime expects window.top.MCSpotlightState and MCStore
 * from the production iframe player. A directly opened page has no parent.
 * Load the ORIGINAL /production/spotlight-state.js before this file.
 * Restore the existing 7s spotlight lifecycle without editing the original
 * renderer, players, animation, stat computations, or TV controller.
 */
(()=>{
 'use strict';
 const id=/^\/staging\/boards\/([a-z0-9_]+)(?:\.html)?\/?$/.exec(location.pathname);
 if(!id)return;
 if(!window.MCSpotlightState?.peek||!window.MCSpotlightState?.reserve){
   console.error('[Man Cave staging] Original spotlight state module unavailable');
   return;
 }
 if(!window.MCStore){
   const KEY='mc-cloudflare-staging-spotlights-v1';
   let spots={};
   try {
     const saved=JSON.parse(localStorage.getItem(KEY)||'{}');
     if(saved&&typeof saved==='object'&&!Array.isArray(saved))spots=saved;
   }catch{}
   window.MCStore={
     spots,
     saveSpot(board,state){
       if(typeof board!=='string'||!state||typeof state!=='object')return;
       spots[board]=state;
       try{localStorage.setItem(KEY,JSON.stringify(spots))}catch{}
     },
     get playback(){return null}
   };
 }
 // The original runtime sends this after images/font readiness. Reuse the
 // production activation signal instead of creating a competing timer.
 const activate=(event)=>{
   if(event.source!==window||event.origin!==location.origin||
      event.data?.type!=='mc-board-ready')return;
   if(event.data.board!==id[1])return;
   window.MCBoard?.activate(true);
 };
 window.addEventListener('message',activate);
 window.__MC_STAGING_HOST__='approved-spotlight-state-and-store';
})();
