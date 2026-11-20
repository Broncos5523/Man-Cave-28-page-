import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const shim=readFileSync(new URL('../cloudflare-public-feed-shim.js',import.meta.url),'utf8');
const state=readFileSync(new URL('../staging-local-state.js',import.meta.url),'utf8');
const build=readFileSync(new URL('../build_cloudflare_visual_staging.py',import.meta.url),'utf8');
const url='https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';
const map=new Map();
const storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
let clock=Date.now(),calls=0;
const FakeDate=class extends Date{static now(){return clock;}};
const native=async()=>{calls++;return new Response(JSON.stringify({calls}),{
 headers:{'Content-Type':'application/json','Cache-Control':'public, max-age=35'}});};
function board(id){
 const window={fetch:native,sessionStorage:storage};
 runInNewContext(shim,{window,location:{pathname:'/staging/boards/'+id},URL,Response,Headers,Date:FakeDate,encodeURIComponent});
 return window;
}
test('public JSON shared between board iframes, expires after 20 seconds',async()=>{
 map.clear();clock=Date.now();calls=0;
 const first=board('page1_nfl');
 assert.equal((await (await first.fetch(url)).json()).calls,1);
 await new Promise(r=>setTimeout(r,2));
 assert.equal((await (await first.fetch(url)).json()).calls,1);
 const second=board('page2_nfl');
 assert.equal((await (await second.fetch(url)).json()).calls,1);
 assert.equal(calls,1);
 clock+=21000;
 assert.equal((await (await second.fetch(url)).json()).calls,2);
});
test('non-GET and authenticated requests bypass cache',async()=>{
 map.clear();calls=0;
 const w=board('page1_nba');
 await w.fetch(url,{method:'POST'});await w.fetch(url,{method:'POST'});
 await w.fetch(url,{headers:{Authorization:'Bearer test'}});
 await w.fetch(url,{headers:{Authorization:'Bearer test'}});
 await w.fetch(url,{cache:'no-store'});
 await w.fetch(url,{cache:'no-store'});
 await w.fetch(url,{credentials:'include'});
 await w.fetch(url,{credentials:'include'});
 assert.equal(calls,8);
});
test('local state and heartbeat match existing stateless Worker response',async()=>{
 let hits=0;
 const window={fetch:async()=>{hits++;return new Response('remote');}};
 const location={origin:'https://demo.test',href:'https://demo.test/staging/player.html'};
 runInNewContext(state,{window,location,URL,Response,Promise});
 assert.equal((await (await window.fetch('/staging/api/state')).json()).playback.constructor.name,'Object');
 assert.equal((await (await window.fetch('/staging/api/heartbeat',{method:'POST',
   headers:{'Content-Type':'application/json'},body:'{"board":"page1_nfl"}'})).json()).ok,true);
 assert.equal((await window.fetch('/staging/api/state',{method:'POST'})).status,415);
 assert.equal((await window.fetch('/staging/api/heartbeat',{method:'POST',
   headers:{'Content-Type':'application/json'},body:'not-json'})).status,400);
 assert.equal(hits,0);
 await window.fetch('/staging/boards.json');assert.equal(hits,1);
});
test('staging only changes transport, not original 30-second rotation',()=>{
 assert.match(build,/frame\.src='\/staging\/boards\/'\+encodeURIComponent\(board\.id\)/);
 assert.match(build,/const DUR=30000/);
 assert.match(build,/local-state\.js\?v=local-r1/);
});


test('failed upstream data never gets saved as a successful replay',async()=>{
 let hits=0;
 const window={sessionStorage:storage,fetch:async()=>{
   hits++;
   return new Response('{"error":"unavailable"}',{status:503,headers:{'Content-Type':'application/json'}});
 }};
 map.clear();
 runInNewContext(shim,{window,location:{pathname:'/staging/boards/page1_nba'},URL,Response,Headers,Date:FakeDate,encodeURIComponent});
 assert.equal((await window.fetch(url)).status,503);
 assert.equal((await window.fetch(url)).status,503);
 assert.equal(hits,2);
});
test('concurrent requests coalesce within a single board',async()=>{
 let hits=0;
 const window={sessionStorage:storage,fetch:async()=>{
  hits++;await new Promise(r=>setTimeout(r,15));
  return new Response('{"games":[]}',{headers:{'Content-Type':'application/json','Cache-Control':'public'}});
 }};
 map.clear();
 runInNewContext(shim,{window,location:{pathname:'/staging/boards/page3_nfl'},URL,Response,Headers,Date:FakeDate,encodeURIComponent});
 const [a,b,c]=await Promise.all([window.fetch(url),window.fetch(url),window.fetch(url)]);
 assert.equal((await a.json()).games.length,0);
 assert.equal((await b.json()).games.length,0);
 assert.equal((await c.json()).games.length,0);
 assert.equal(hits,1);
});
