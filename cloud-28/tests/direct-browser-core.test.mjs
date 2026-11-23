import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../cloudflare-public-feed-shim.js',import.meta.url),'utf8');
const core='https://sports.core.api.espn.com/v2/sports/football/leagues/college-football/seasons/2026/types/2/teams/12/leaders?lang=en&region=us';
const nba='https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2027/types/2/teams/2/statistics';
function mount(board,fetcher){
  const calls=[];
  const win={fetch:async(url,init)=>{calls.push({url,init});return fetcher(url,init);}};
  const context={window:win,location:{pathname:'/staging/boards/'+board+'.html'},URL,Response,Headers,Map,Set,Date,Promise,encodeURIComponent};
  runInNewContext(source,context);
  return {win,calls};
}
test('Cloudflare original proxied ESPN Core leader read uses direct official CORS GET',async()=>{
  const {win,calls}=mount('page4_arizona_cfb',async()=>new Response(JSON.stringify({categories:[{name:'passingLeader'}]}),{
    status:200,headers:{'Content-Type':'application/json'}}));
  const out=await win.fetch('/proxy?url='+encodeURIComponent(core));
  assert.equal(out.status,200);assert.deepEqual(await out.json(),{categories:[{name:'passingLeader'}]});
  assert.equal(calls.length,1);assert.equal(calls[0].url,core);
  assert.equal(calls[0].init.credentials,'omit');
  assert.equal(win.__MC_DIRECT_ESPN_STATS__.success,1);
  assert.equal(win.__MC_DIRECT_ESPN_STATS__.fallback,0);
});
test('NBA and WNBA current team stats are read directly; unrelated ESPN URLs keep proxy',async()=>{
  const {win,calls}=mount('page3_celtics',async()=>new Response('{}',{status:200,headers:{'Content-Type':'application/json'}}));
  await win.fetch(nba);
  assert.equal(calls[0].url,nba);
  const board='https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
  await win.fetch(board);
  assert.ok(calls[1].url.startsWith('/proxy?url='));
  assert.equal(new URL(calls[1].url,'https://dummy.invalid').searchParams.get('url'),board);
});
test('Direct CORS rejection falls back to existing same-origin verified relay',async()=>{
  const {win,calls}=mount('page4_arizona_cfb',async(url)=>{
    if(url.startsWith('https://sports.core.api.espn.com'))throw Error('CORS blocked');
    return new Response(JSON.stringify({fallback:true}),{status:200,headers:{'Content-Type':'application/json'}});
  });
  const out=await win.fetch(core);
  assert.equal((await out.json()).fallback,true);
  assert.equal(calls.length,2);
  assert.ok(calls[1].url.startsWith('/proxy?url='));
  assert.equal(win.__MC_DIRECT_ESPN_STATS__.fallback,1);
});
test('Broncos original validated season-row compatibility route remains unchanged',async()=>{
  const nfl='https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/2026/types/2/athletes/4426338/statistics/0?lang=en&region=us';
  const {win,calls}=mount('page4_broncos',async()=>new Response('{}',{status:200,headers:{'Content-Type':'application/json'}}));
  await win.fetch('/proxy?url='+encodeURIComponent(nfl));
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,'/migration-api/nfl/season-stats?season=2026&athlete=4426338&team=7');
  assert.equal(win.__MC_DIRECT_ESPN_STATS__.success,0);
});
test('Unapproved methods and destinations do not fetch untrusted absolute host directly',async()=>{
  const {win,calls}=mount('page4_arizona_cfb',async()=>new Response('{}',{status:200,headers:{'Content-Type':'application/json'}}));
  const evil='https://sports.core.api.espn.com.evil.example/v2/sports/football/leagues/college-football/seasons/2026/types/2/teams/12/leaders';
  await win.fetch(evil);assert.equal(calls[0].url,evil);
  await win.fetch(core,{method:'POST'});assert.ok(calls[1].url.startsWith('/proxy?url='));
  assert.equal(win.__MC_DIRECT_ESPN_STATS__.success,0);
});
