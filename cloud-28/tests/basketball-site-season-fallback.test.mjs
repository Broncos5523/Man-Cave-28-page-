import test from 'node:test';
import assert from 'node:assert/strict';
import {siteBasketballSeasonStats} from '../basketball-site-season-fallback.mjs';
import {currentPlayerMap} from '../page4-live-contract.mjs';
import {page4LiveApi} from '../page4-live-api.mjs';

function site(year,team,type='2',playerNo=0){
 return {filters:type===null?[]:[{name:'seasontype',value:type}],
  categories:[{name:'averages',
   names:['gamesPlayed','avgPoints','avgRebounds','avgAssists','avgSteals','avgBlocks',
     'avgThreePointFieldGoalsMade-avgThreePointFieldGoalsAttempted'],
   statistics:[
    {season:{year:year-1},teamId:team,stats:[35,22.8,8.2,7.1,3.0,2.2,'4.2-9.4']},
    {season:{year},teamId:team,
     stats:[20,String(10+playerNo/10),'4.3','3.7','1.1','0.6','2.4-6.1']}
   ]}]};
}
test('NBA and WNBA exact season and team athlete rows; never career totals or previous-season stats',()=>{
 for(const [league,year,team] of [['nba',2027,'2'],['wnba',2026,'5']]){
  const data=site(year,team),converted=siteBasketballSeasonStats(data,{league,team,season:year,athleteId:'123456'});
  const map=currentPlayerMap(converted,year,'123456');
  assert.equal(map.gamesPlayed,20);
  assert.equal(map.avgPoints,10);
  assert.equal(map.avgThreePointFieldGoalsMade,2.4);
  assert.equal(converted.__mcSource.kind,'verified-espn-site-basketball-season');
  assert.ok(!JSON.stringify(converted).includes('22.8'));
 }
});
test('CBB's documented missing season-type filter is accepted only with exact 2027 Arizona team row',()=>{
 const converted=siteBasketballSeasonStats(site(2027,'12',null),
  {league:'mens-college-basketball',team:'12',season:2027,athleteId:'5351296'});
 assert.equal(currentPlayerMap(converted,2027,'5351296').avgThreePointFieldGoalsMade,2.4);
 assert.throws(()=>siteBasketballSeasonStats(site(2027,'12',null),
  {league:'nba',team:'12',season:2027,athleteId:'5351296'}));
});
test('No prior season, wrong team, invalid fraction, postseason filter or zero inferred for active athlete',()=>{
 const input=site(2027,'2');
 assert.throws(()=>siteBasketballSeasonStats(input,{league:'nba',team:'5',season:2027,athleteId:'123456'}));
 assert.throws(()=>siteBasketballSeasonStats(input,{league:'nba',team:'2',season:2028,athleteId:'123456'}));
 assert.throws(()=>siteBasketballSeasonStats(site(2027,'2','3'),
  {league:'nba',team:'2',season:2027,athleteId:'123456'}));
 const invalid=site(2027,'2');
 invalid.categories[0].statistics[1].stats[6]='9.0-1.0';
 assert.throws(()=>siteBasketballSeasonStats(invalid,
  {league:'nba',team:'2',season:2027,athleteId:'123456'}));
});
for(const [board,league,team,year] of [
 ['page4_celtics','nba','2',2027],['page4_fever','wnba','5',2026],
 ['page4_arizona_cbb','mens-college-basketball','12',2027]
]){
 test(board+' falls back from expired ESPN Core to verified Site rows, preserving six leaders',async()=>{
  const roster={season:{year},team:{id:team},athletes:Array.from({length:12},(_,i)=>({
    id:String(100000+i),displayName:'Player '+i,position:{abbreviation:'G'},
    headshot:{href:'https://a.espncdn.com/i/headshots/basketball/players/full/1.png'}
  }))};
  const start=year===2027?'2026-10-01T00:00:00Z':'2026-04-01T00:00:00Z';
  const end=year===2027?'2027-06-30T00:00:00Z':'2026-10-01T00:00:00Z';
  const scoreboard={leagues:[{season:{year,type:{type:2},startDate:start,endDate:end},
    calendar:[{value:'2',startDate:start}]}]};
  let siteCount=0,coreErrors=0;
  async function read(url){
    if(url.includes('/scoreboard?'))return scoreboard;
    if(url.includes('/roster?'))return roster;
    if(url.includes('sports.core.api.espn.com')){coreErrors++;throw Error('Simulated ESPN Core 403');}
    if(url.includes('/apis/common/v3/sports/basketball/')){
      siteCount++;
      const id=/\/athletes\/(\d+)\//.exec(url)?.[1];
      assert.ok(id);
      return site(year,team,league==='mens-college-basketball'?null:'2',Number(id)-100000);
    }
    throw Error('Unexpected Site API URL: '+url);
  }
  const request=new Request('https://mancave.invalid/production/api/page4-live?board='+board);
  const response=await page4LiveApi(request,null,read);
  const data=await response.json();
  assert.equal(response.status,200,JSON.stringify(data));
  assert.equal(data.season,year);
  assert.equal(data.verifiedPlayers,12);
  assert.equal(data.leaders.length,6);
  assert.equal(data.dataState,'current');
  assert.equal(data.roster[0].stats['3PM'],2.4);
  assert.ok(siteCount===12&&coreErrors===12);
 });
}
