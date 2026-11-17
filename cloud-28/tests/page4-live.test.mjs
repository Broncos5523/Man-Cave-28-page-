import test from 'node:test';import assert from 'node:assert/strict';
import {buildPage4,currentPlayerMap} from '../page4-live-contract.mjs';
function stat(id,year=2027){const root='https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/'+year;
  return {$ref:root+'/types/2/athletes/'+id+'/statistics/0?lang=en',season:{$ref:root+'?lang=en'},
    seasonType:{$ref:root+'/types/2?lang=en'},splits:{categories:[{name:'general',stats:[{name:'gamesPlayed',value:4},
      ...['avgPoints','avgRebounds','avgAssists','avgSteals','avgBlocks','avgThreePointFieldGoalsMade'].map((name,i)=>({name,value:Number(id)%10+i+.5}))]}]}};}
const roster={season:{year:2027},team:{id:'2'},athletes:Array.from({length:10},(_,i)=>({id:String(100+i),displayName:'Fixture '+i}))};
test('Page4 uses current roster identities and exact season averages; unavailable players display null, never career or guessed zero',()=>{
  const stats=Object.fromEntries(['100','101','102'].map(id=>[id,stat(id)]));
  const j=buildPage4('page4_celtics',2027,roster,stats);
  assert.equal(j.verifiedPlayers,3);assert.equal(j.leaders.length,6);assert.equal(j.roster[0].stats.PTS,.5);
  assert.equal(j.roster[8].gamesPlayed,null);assert.ok(Object.values(j.roster[8].stats).every(v=>v===null));
  assert.equal(j.leaders[0].id,'102');
});
test('Wrong athlete, prior season or postseason cannot populate an approved current Page4',()=>{
  assert.throws(()=>currentPlayerMap(stat('100'),2027,'101'));
  assert.throws(()=>currentPlayerMap(stat('100',2026),2027,'100'));
  const bad=stat('100');bad.seasonType.$ref=bad.seasonType.$ref.replace('/types/2?','/types/3?');
  assert.throws(()=>currentPlayerMap(bad,2027,'100'));
  assert.throws(()=>buildPage4('page4_celtics',2027,roster,{'100':bad}));
});
test('Page4 source timestamp reflects the verified cache check instead of the HTTP response time',()=>{
  const stats=Object.fromEntries(['100','101','102'].map(id=>[id,{...stat(id),__mcSource:{fetchedAt:'2026-11-17T17:00:00Z'}}]));
  const j=buildPage4('page4_celtics',2027,roster,stats,new Date('2026-11-17T17:05:00Z'));
  assert.equal(j.updatedAt,'2026-11-17T17:00:00.000Z');
});
