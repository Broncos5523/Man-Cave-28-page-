import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedBasketballSiteSeasonStat} from '../page4-site-season-fallback.mjs';
import {currentPlayerMap} from '../page4-live-contract.mjs';
const names=['gamesPlayed','avgPoints','avgRebounds','avgAssists','avgSteals','avgBlocks',
  'avgThreePointFieldGoalsMade-avgThreePointFieldGoalsAttempted'];
const values=['18','25.4','8.2','4.3','1.2','0.8','3.1-7.5'];
function source(year=2027,team='2'){
 return {filters:[{name:'seasontype',value:'2'}],categories:[
   {name:'averages',names,statistics:[
    {season:{year:2026},teamId:team,stats:['58','11.0','3.0','2.0','1.0','0.2','0.8-3.2']},
    {season:{year},teamId:team,stats:values}
   ]},
   {name:'totals',names:['points'],statistics:[{season:{year},teamId:team,stats:['9999']}]}
 ]};
}
const cfg={league:'nba',team:'2',year:2027,athlete:'4433188',regularSeasonVerified:true};
test('selects only current-team current-year per-game averages, never career totals',()=>{
 const b=verifiedBasketballSiteSeasonStat(source(),cfg,new Date('2026-11-22T23:20:00Z'));
 const parsed=currentPlayerMap(b,2027,'4433188');
 assert.equal(parsed.gamesPlayed,18);
 assert.equal(parsed.avgPoints,25.4);
 assert.equal(parsed.avgRebounds,8.2);
 assert.equal(parsed.avgThreePointFieldGoalsMade,3.1);
 assert.equal(b.__mcSource.kind,'verified-espn-site-current-season');
 assert.equal(b.__mcSource.fetchedAt,'2026-11-22T23:20:00.000Z');
 assert.equal(Object.values(parsed).includes(9999),false);
});
test('accepts CBB official season-and-team row even without exposed type filter when scoreboard confirms regular season',()=>{
 const data=source(2027,'12');delete data.filters;
 const b=verifiedBasketballSiteSeasonStat(data,{...cfg,league:'mens-college-basketball',team:'12'},new Date());
 assert.equal(currentPlayerMap(b,2027,cfg.athlete).avgThreePointFieldGoalsMade,3.1);
});
test('fails shut against wrong season, wrong team and missing current-season record',()=>{
 const a=source();a.categories[0].statistics=a.categories[0].statistics.slice(0,1);
 assert.throws(()=>verifiedBasketballSiteSeasonStat(a,cfg),/Exact year and team/);
 assert.throws(()=>verifiedBasketballSiteSeasonStat(source(),{...cfg,team:'12'}),/Exact year and team/);
 assert.throws(()=>verifiedBasketballSiteSeasonStat(source(),{...cfg,year:2025}),/Exact year and team/);
 assert.throws(()=>verifiedBasketballSiteSeasonStat(source(),{...cfg,regularSeasonVerified:false}),/Regular season/);
});
test('rejects postseason, malformed 3-point composite and zero appearances',()=>{
 const postseason=source();postseason.filters=[{name:'seasontype',value:'3'}];
 assert.throws(()=>verifiedBasketballSiteSeasonStat(postseason,cfg),/not regular season/);
 const broken=source();broken.categories[0].statistics[1].stats[6]='12-3';
 assert.throws(()=>verifiedBasketballSiteSeasonStat(broken,cfg),/Three-point average/);
 const noGame=source();noGame.categories[0].statistics[1].stats[0]='0';
 assert.throws(()=>verifiedBasketballSiteSeasonStat(noGame,cfg),/no verified/);
 const onlyTotals=source();onlyTotals.categories=onlyTotals.categories.slice(1);
 assert.throws(()=>verifiedBasketballSiteSeasonStat(onlyTotals,cfg),/averages absent/);
});
test('preserves original Core contract shape for three approved basketball Page 4 leagues',()=>{
 for(const [league,team,year] of [['nba','2',2027],['wnba','5',2026],['mens-college-basketball','12',2027]]){
  const payload=source(year,team);
  if(league==='mens-college-basketball')delete payload.filters;
  const value=verifiedBasketballSiteSeasonStat(payload,{...cfg,league,team,year});
  assert.equal(value.splits.categories.length,1);
  assert.equal(currentPlayerMap(value,year,cfg.athlete).avgThreePointFieldGoalsMade,3.1);
 }
});
