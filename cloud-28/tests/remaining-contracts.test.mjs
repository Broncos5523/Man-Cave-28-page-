import test from 'node:test';import assert from 'node:assert/strict';
import {contextOf,baseFeed,projectionOf,actualPlayoffs} from '../remaining-board-contracts.mjs';
import {standingsGroups} from '../board-contract-common.mjs';
const now=new Date('2026-11-17T17:00:00Z');
test('Completed MLB/WNBA seasons use their verified 2026 finals, while NHL uses 2026–27 current season',()=>{
  const score=(year,end)=>({leagues:[{season:{year,type:{type:2},startDate:'2026-01-01',endDate:end}}]});
  assert.equal(contextOf('mlb',score(2026,'2026-11-12'),now).mode,'offseason');
  assert.equal(contextOf('wnba',score(2026,'2026-11-05'),now).statsYear,2026);
  assert.equal(contextOf('nhl',score(2027,'2027-07-01'),now).label,'2026–27');
  assert.throws(()=>contextOf('nhl',score(undefined,'2027-07-01'),now));
});
test('College record normalization uses the provider overall record when numeric losses are omitted',()=>{
  const data={name:'FBS',season:{year:2026},children:[{name:'Big 12',standings:{season:2026,seasonType:2,
    entries:[{team:{id:'12',displayName:'Arizona Wildcats'},stats:[{name:'wins',value:8},{name:'overall',displayValue:'8-2'},
      {name:'wins',value:5}]}]}}]};
  const row=standingsGroups(data,2026)[0].entries[0];assert.equal(row.wins,8);assert.equal(row.losses,2);
  assert.equal(row.record,'8-2');
  data.children[0].standings.entries[0].stats[1].displayValue='Unknown';assert.throws(()=>standingsGroups(data,2026));
});
test('NHL first round preserves the actual top-three-per-division and two-wild-card format',()=>{
  const divisions=[['BOS','BUF','DET','FLA','MTL','OTT','TB','TOR'],['CAR','CBJ','NJ','NYI','NYR','PHI','PIT','WSH'],
    ['CHI','COL','DAL','MIN','NSH','STL','UTA','WPG'],['ANA','CGY','EDM','LA','SJ','SEA','VAN','VGK']];
  const clubs=divisions.flatMap((ids,d)=>ids.map((abbr,i)=>({id:abbr,abbr,path:[d<2?'Eastern':'Western'],seed:i*2+(d%2)+1})));
  const j=projectionOf({context:{statsYear:2027},standings:{groups:[{entries:clubs}]}},'nhl');
  assert.equal(j.matches.length,8);
  const boss=j.matches.find(m=>m.teams.some(t=>t.id==='BOS'));
  assert.deepEqual(boss.teams.map(t=>t.id),['BOS','NYI']);
  assert.ok(j.matches.every(m=>m.stage==='first'&&m.winner===null));
});
test('Offseason series archives fail closed when a whole postseason round is missing',()=>{
  const base={context:{statsYear:2026},standings:{groups:[{entries:[]}]}};
  assert.throws(()=>actualPlayoffs(base,'mlb',[]));assert.throws(()=>actualPlayoffs(base,'wnba',[]));
});
