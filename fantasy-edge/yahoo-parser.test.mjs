import test from "node:test";
import assert from "node:assert/strict";
import {fields,leagueMeta,scoreboardFrom,standingsFrom,playersFrom} from "./yahoo-parser.mjs";
test("unwrap Yahoo fields and league info",()=>{
 assert.equal(fields([[{name:"League"},{num_teams:"12"}],{current_week:"11"}]).name,"League");
 assert.deepEqual(leagueMeta({league:[[{name:"My League"},{current_week:"11"}],{num_teams:"12"}]}),
   {name:"My League",week:11,team_count:12});
});
test("matchup parsing ignores duplicate nested references",()=>{
 const a=[[{team_key:"461.l.12.t.1"},{team_id:"1"},{name:"Away"}],{team_points:{total:"80.5"}}];
 const b=[[{team_key:"461.l.12.t.2"},{team_id:"2"},{name:"Home"}],{team_points:{total:"90.7"}}];
 const source={scoreboard:{matchups:{0:{matchup:{teams:{0:{team:a},1:{team:b}}}}}}};
 const rows=scoreboardFrom(source);
 assert.equal(rows.length,1);assert.equal(rows[0].left.score,80.5);
 assert.equal(rows[0].right.score,90.7);
});
test("standings and roster distinguish missing from zero",()=>{
 const standings=standingsFrom({teams:{0:{team:[{team_key:"461.l.12.t.1"},{name:"A"},
   {team_standings:{rank:"1",outcome_totals:{wins:"8",losses:"2",ties:"0",percentage:".8"}}}]}}});
 assert.equal(standings[0].record,"8-2");
 const players=playersFrom({players:{0:{player:[[{player_key:"461.p.42"},{player_id:"42"},
  {name:{full:"Jane Doe"}}],{selected_position:{position:"WR"}},
  {player_points:{total:"0.00"}}]}}});
 assert.equal(players.length,1); assert.equal(players[0].current_points,0);
 assert.equal(players[0].slot,"WR");
});
