import test from 'node:test';
import assert from 'node:assert/strict';
import {buildCbbPage1} from '../cbb-page1-contract.mjs';
import {tickerFromEvents,normalizeEvent} from '../board-contract-common.mjs';
import app from '../cloudflare-live-proxy.mjs';

// Deliberately synthetic unit fixtures, never used by the deployed adapter.
const club=id=>({id:String(id),displayName:'Fixture '+id,name:'Fixture '+id});
const event=(id,stage,year=2026)=>({id:String(id),date:'2026-04-06T00:00Z',season:{year,type:3},
  status:{type:{state:'post',completed:true,shortDetail:'Final'}},competitions:[{
    notes:[{headline:"NCAA Men's Basketball Championship - "+stage}],
    competitors:[{homeAway:'away',team:club(1),seed:1,score:'70',winner:true},
      {homeAway:'home',team:club(2),seed:2,score:'60',winner:false}]}]});
function fixtures(){
  const scoreboard={leagues:[{season:{year:2027,type:{type:2}}}],events:[]};
  let id=0;
  const standings={name:'Division I',season:{year:2027},children:Array.from({length:32},(_,i)=>({name:'Conference '+i,
    standings:{season:2027,seasonType:2,entries:Array.from({length:11},()=>({team:club(++id),
      stats:[{name:'wins',value:3},{name:'losses',value:1}]}))}}))};
  const rankings={requestedSeason:{year:2027},rankings:[{name:'AP Top 25',date:'2026-11-16',
    season:{year:2027,type:{type:2}},ranks:Array.from({length:25},(_,i)=>({current:i===18?18:i+1,team:club(i+1)}))}]};
  const rounds=[['1st Round - East Region',32],['2nd Round - East Region',16],['Sweet 16 - East Region',8],
    ['Elite 8 - East Region',4],['Final Four',2],['National Championship',1],['First Four',4]];
  let gid=0;
  const tournament={events:rounds.flatMap(([stage,n])=>Array.from({length:n},()=>event(++gid,stage)))};
  return {scoreboard,standings,rankings,tournament};
}
const build=f=>buildCbbPage1(f.scoreboard,f.standings,f.rankings,f.tournament,new Date('2026-11-17T16:00:00Z'));
test('CBB keeps current AP25 (including ties), 32 conferences and explicitly historical 63-match NCAA recap',()=>{
  const j=build(fixtures());
  assert.equal(j.context.year,2027);assert.equal(j.context.label,'2026–27');
  assert.equal(j.rankings.poll.ranks.length,25);assert.equal(j.standings.groups.length,32);
  assert.equal(j.postseason.length,67);assert.equal(j.playoffs.matches.length,63);
  assert.equal(j.playoffs.kind,'actual');assert.equal(j.playoffs.season,2026);
  assert.ok(j.playoffs.matches.every(m=>m.winner==='1'));
});
test('CBB rejects stale AP, missing teams, duplicate school or incomplete/unplayed tournament',()=>{
  for(const mutate of [
    f=>f.rankings.rankings[0].season.year=2026,
    f=>f.standings.children.pop(),
    f=>f.rankings.rankings[0].ranks[1].team.id='1',
    f=>f.tournament.events.pop(),
    f=>f.tournament.events[0].season.year=2027,
    f=>f.tournament.events[0].status.type.completed=false,
    f=>f.tournament.events[0].competitions[0].competitors[0].winner=false
  ]){const f=fixtures();mutate(f);assert.throws(()=>build(f));}
});
test('Ticker preserves live-only priority, deduplication, last-24h finals, next-seven-day window and cancelled exclusions',()=>{
  const now=new Date('2026-11-17T16:00:00Z');
  const base=normalizeEvent(event('1','Final Four'));
  const final={...base,id:'final',date:'2026-11-16T17:00:00Z'};
  const next={...base,id:'next',date:'2026-11-18T17:00:00Z',state:'pre',completed:false};
  const old={...base,id:'old',date:'2026-11-15T17:00:00Z'};
  const cancelled={...next,id:'bad',statusName:'STATUS_CANCELED'};
  assert.deepEqual(tickerFromEvents([old,final,final,next,cancelled],now).selected.map(x=>x.id),['final','next']);
  const live={...next,id:'live',state:'in'};
  assert.deepEqual(tickerFromEvents([final,next,live],now).selected.map(x=>x.id),['live']);
});
test('CBB Worker accepts internally bounded >5MB standings without widening the public relay or forwarding credentials',async()=>{
  const f=fixtures(),original=globalThis.fetch,requests=[];
  globalThis.fetch=async(url,options)=>{
    requests.push({url,options});
    let body=url.includes('/standings?')?JSON.stringify({...f.standings,padding:'x'.repeat(5*1024*1024)}):
      JSON.stringify(url.includes('/rankings?')?f.rankings:url.includes('groups=100')?f.tournament:f.scoreboard);
    return new Response(body,{headers:{'Content-Type':'application/json'}});
  };
  try{
    const r=await app.fetch(new Request('https://fixture.invalid/api/board/page1_cbb',{
      headers:{Cookie:'private',Authorization:'Bearer secret'}}),{},null);
    assert.equal(r.status,200);assert.equal((await r.json()).playoffs.matches.length,63);
    assert.ok(requests.every(r=>!r.options.headers.Cookie&&!r.options.headers.Authorization));
    const proxy=await app.fetch(new Request('https://fixture.invalid/proxy?url='+encodeURIComponent(
      'https://site.api.espn.com/apis/v2/sports/basketball/mens-college-basketball/standings?season=2027')),{},null);
    assert.equal(proxy.status,502);
  }finally{globalThis.fetch=original;}
});
