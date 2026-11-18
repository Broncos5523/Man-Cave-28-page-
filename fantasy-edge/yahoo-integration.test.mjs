import test from "node:test";
import assert from "node:assert/strict";
import {FantasyState} from "./worker.mjs";

const fixtureEnv=()=>({
  FANTASY_SESSION_SECRET:"_".repeat(40),
  FANTASY_VIEW_PIN:"test-private-pin",
  YAHOO_CLIENT_ID:"unit-test-client",
  YAHOO_CLIENT_SECRET:"unit-test-secret",
  YAHOO_LEAGUE_ID:"12345",
  YAHOO_GAME_KEY:"nfl",
  PUBLIC_BASE_URL:"https://man-cave-fantasy-cloud.example.workers.dev",
});
const createState=()=>{
  const values=new Map();
  return {values,storage:{
    async get(k){return values.get(k);},
    async put(k,v){values.set(k,v);},
    async delete(k){values.delete(k);}
  }};
};
const team=(id,name,points)=>[[{team_key:"469.l.12345.t."+id},{team_id:String(id)},{name}],
  {team_points:{total:String(points)}}];
const fixtures={
  game:{fantasy_content:{game:[[{game_key:"469"},{code:"nfl"}],{season:"2026"}]}},
  league:{fantasy_content:{league:[[{league_key:"469.l.12345"},{current_week:"11"},
    {num_teams:"2"},{name:"Sample Two-Team League"}]]}},
  scoreboard:{fantasy_content:{league:[{scoreboard:{matchups:{0:{
    matchup:{teams:{0:{team:team(1,"Away",91.6)},1:{team:team(2,"Home",90.1)}}}}
  }}}]}},
  roster:{fantasy_content:{team:[{roster:{players:{0:{player:[
    [{player_key:"469.p.1"},{player_id:"1"},{name:{full:"Player One"}}],
    {selected_position:{position:"QB"}},{player_points:{total:"17.2"}}]}}}}]}},
  standings:{fantasy_content:{league:[{standings:{teams:{0:{team:[
    [{team_key:"469.l.12345.t.1"},{team_id:"1"},{name:"Away"}],
    {team_standings:{rank:"1",outcome_totals:{wins:"7",losses:"3"}}]}}}}}]}}
};
test("Yahoo OAuth token exchange, verified current-season league lookup, roster and standings",async()=>{
  const orig=globalThis.fetch, urls=[];
  globalThis.fetch=async (input,options={})=>{
    const u=String(input);urls.push(u);
    if(u.endsWith("/oauth2/get_token"))return Response.json({access_token:"sensitive-private-token",
      refresh_token:"sensitive-private-refresh",expires_in:3600});
    if(u.includes("/fantasy/v2/game/nfl?"))return Response.json(fixtures.game);
    if(u.includes("/fantasy/v2/league/469.l.12345/scoreboard;week=11?"))
      return Response.json(fixtures.scoreboard);
    if(u.includes("/fantasy/v2/league/469.l.12345/standings?"))
      return Response.json(fixtures.standings);
    if(u.includes("/fantasy/v2/league/469.l.12345?"))return Response.json(fixtures.league);
    if(u.includes("/fantasy/v2/team/469.l.12345.t.") && u.includes("/roster;week=11/"))
      return Response.json(fixtures.roster);
    return new Response("unexpected mocked upstream path",{status:500});
  };
  try{
    const state=createState(),env=fixtureEnv(),d=new FantasyState(state,env);
    const oauth=await d.fetch(new Request("https://internal/token-exchange",{
      method:"POST",body:JSON.stringify({code:"test-code",redirect_uri:env.PUBLIC_BASE_URL+"/oauth/yahoo/callback"})
    }));
    assert.equal(oauth.status,200);
    const encrypted=state.values.get("token-v1");
    assert.ok(encrypted?.iv&&encrypted?.data);
    assert.ok(!JSON.stringify(encrypted).includes("sensitive-private-token"));
    assert.ok(!JSON.stringify(encrypted).includes("sensitive-private-refresh"));
    const refreshed=await d.fetch(new Request("https://internal/refresh"));
    assert.equal(refreshed.status,200);
    const dashboard=await (await d.fetch(new Request("https://internal/data"))).json();
    assert.equal(dashboard.loading,undefined,JSON.stringify(dashboard));
    assert.equal(dashboard.matchup_count,1);
    assert.equal(dashboard.matchups[0].left.score,91.6);
    assert.equal(dashboard.matchups[0].right.score,90.1);
    assert.equal(dashboard.matchups[0].left.starters[0].current_points,17.2);
    assert.equal(dashboard.standings[0].record,"7-3");
    assert.equal(dashboard.source,"Yahoo Fantasy Sports API");
    assert.equal(dashboard.matchups[0].left.original_projection,null);
    assert.ok(urls.every(x=>!x.includes("/league/nfl.l.")),"must use season-specific key 469");
    const status=await (await d.fetch(new Request("https://internal/status"))).json();
    assert.equal(status.connected,true);
    assert.equal(status.matchups,1);
    assert.ok(!JSON.stringify(status).includes("sensitive-private"));
    const stale=state.values.get("dashboard-v1");
    await state.storage.put("dashboard-v1",{...stale,captured_at_unix:Math.floor(Date.now()/1000)-160});
    assert.equal((await (await d.fetch(new Request("https://internal/data"))).json()).loading,true);
  }finally{globalThis.fetch=orig;}
});
