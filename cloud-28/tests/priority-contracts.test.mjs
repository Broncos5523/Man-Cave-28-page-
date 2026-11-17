import test from 'node:test';
import assert from 'node:assert/strict';
import {buildNbaPage2,basketballLeaderSpecs} from '../nba-page2-contract.mjs';
import {buildNflPage3} from '../nfl-page3-contract.mjs';
const team=id=>({id:String(id),name:'Fixture '+id,short:'Fixture '+id,stats:{}});
function fixture(sport){
  const year=sport==='nba'?2027:2026,count=sport==='nba'?30:32;
  const clubs=Array.from({length:count},(_,i)=>team(i+1));
  const base={board:'page1_'+sport,context:{sport,year,statsYear:year,seasonType:2,mode:'season'},
    standings:{groups:[{entries:clubs}]},ticker:{events:[],selected:[]}};
  const definitions=sport==='nba'?{general:['avgRebounds'],offensive:['avgPoints','avgAssists','fieldGoalPct']}:
    {general:['fumblesRecovered'],passing:['netPassingYardsPerGame','totalPointsPerGame','netYardsPerGame','passingTouchdowns','interceptions','sacks'],
      rushing:['rushingYardsPerGame'],defensiveinterceptions:['interceptions']};
  const data={requestedSeason:{year,type:{type:2}},categories:Object.entries(definitions).map(([name,names])=>({name,names})),
    teams:clubs.map((t,i)=>({team:{id:t.id},categories:Object.entries(definitions).flatMap(([name,names])=>[0,900].map(splitId=>({
      name,splitId:String(splitId),displayName:(splitId?'Opponent ':'Own ')+name,
      values:names.map((_,k)=>20+i+k+splitId/100),totals:names.map((_,k)=>String(20+i+k+splitId/100))}))) }))};
  return {base,data};
}
test('NBA uses the exact qualified byathlete metric, not the v3 ratio-format 3-point leaderboard',()=>{
  const {base,data}=fixture('nba');
  const sources=basketballLeaderSpecs.map(([,cat,field],i)=>({requestedSeason:{year:2027,type:{type:2}},
    categories:[{name:cat,names:[field]}],athletes:[{athlete:{id:String(1000+i),displayName:'Fixture Player '+i,
      headshot:{href:'https://a.espncdn.com/fixture.png'},teams:[{id:'2',displayName:'Boston Celtics',color:'007a33',alternateColor:'ffffff'}]},
      categories:[{name:cat,splitId:'0',totals:[i===4?'60.0':'20.1'],values:[i===4?60:20.1]}]}]}));
  const j=buildNbaPage2(base,sources,data);
  assert.equal(j.leaders.players.length,6);assert.equal(j.teamPanels.leaders.length,5);
  assert.equal(j.leaders.players[4].value,'60.0');assert.equal(j.leaders.players[4].number,60);
  assert.equal(j.leaders.players[0].team.color,'007a33');
  assert.equal(j.awards,undefined);
  const stale=structuredClone(sources);stale[3].requestedSeason.year=2026;
  assert.throws(()=>buildNbaPage2(base,stale,data));
  const missing=structuredClone(data);missing.teams.pop();assert.throws(()=>buildNbaPage2(base,sources,missing));
});
test('Broncos Page3 preserves eight original metrics, 32-team ranks and 17 regular-season games',()=>{
  const {base,data}=fixture('nfl');
  const schedule={team:{id:'7'},requestedSeason:{year:2026,type:2},events:Array.from({length:17},(_,i)=>({
    id:String(401000+i),date:'2026-11-22T21:00Z',season:{year:2026,type:2},
    competitions:[{status:{type:{state:i<10?'post':'pre',completed:i<10}},competitors:[
      {homeAway:'away',team:{id:'7',displayName:'Denver Broncos'},score:'21'},
      {homeAway:'home',team:{id:'12',displayName:'Kansas City Chiefs'},score:'14'}]}]}))};
  const j=buildNflPage3(base,[schedule,{events:[]}],data);
  assert.equal(j.board,'page3_broncos');assert.equal(j.schedule.length,17);assert.equal(j.teamPanels.snapshot.length,8);
  assert.ok(j.teamPanels.snapshot.every(s=>s.population===32&&s.rank>0));
  // Own passing = 26, total net offense = 28, opponent net defense = 37.
  const values=Object.fromEntries(j.teamPanels.snapshot.map(x=>[x.label,x.value]));
  assert.equal(values['PASS YPG'],'26.0');assert.equal(values['TOTAL YPG'],'28.0');assert.equal(values['TOTAL DEFENSE'],'37.0');
  const bad=structuredClone(schedule);bad.events[0].season.year=2025;assert.throws(()=>buildNflPage3(base,[bad],data));
  const incomplete=structuredClone(schedule);incomplete.events.pop();assert.throws(()=>buildNflPage3(base,[incomplete],data));
});
