import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";

const origin="https://fantasy.example.workers.dev";
const sessionSecret="s".repeat(48);
const env={
  FANTASY_SESSION_SECRET:sessionSecret,
  FANTASY_VIEW_PIN:"private-11",
  YAHOO_CLIENT_ID:"test-client-id",
  YAHOO_CLIENT_SECRET:"test-client-secret",
  YAHOO_LEAGUE_ID:"957146",
  PUBLIC_BASE_URL:origin,
  FANTASY_STATE:{
    idFromName(){return "private";},
    get(){return {async fetch(url,{body}={}){
      const path=new URL(url).pathname;
      if(path==="/auth-check")return new Response(JSON.stringify({
        ok:JSON.parse(body).pin==="private-11"
      }),{status:JSON.parse(body).pin==="private-11"?200:403});
      if(path==="/status")return new Response(JSON.stringify({connected:false}));
      throw Error("Unexpected Durable Object route: "+path);
    }};}
  }
};
function csrf(html){
  const match=html.match(/name='form_token' value='([^']+)'/);
  assert.ok(match,"Form must contain signed permit");
  return match[1];
}
function submitted(path,values,{cookie}={}){
  return new Request(origin+path,{
    method:"POST",
    headers:{
      "Content-Type":"application/x-www-form-urlencoded",
      "Origin":"https://chatgpt.com",
      "Sec-Fetch-Site":"cross-site",
      ...(cookie?{"Cookie":cookie}:{})
    },
    body:new URLSearchParams(values)
  });
}
test("iPhone embedded browser unlocks with signed form despite unusual fetch-site headers",async()=>{
  const page=await worker.fetch(new Request(origin+"/setup"),env,{});
  assert.equal(page.status,200);
  const permit=csrf(await page.text());
  const res=await worker.fetch(submitted("/unlock",{pin:"private-11",form_token:permit}),env,{});
  assert.equal(res.status,303);
  assert.equal(res.headers.get("location"),"/setup");
  assert.match(res.headers.get("set-cookie"),/^mc_fantasy_session=/);

  const sessionCookie=res.headers.get("set-cookie").split(";")[0];
  const ownerPage=await worker.fetch(new Request(origin+"/setup",{headers:{Cookie:sessionCookie}}),env,{});
  assert.equal(ownerPage.status,200);
  const pageText=await ownerPage.text();
  assert.match(pageText,/Connect Yahoo Fantasy/);
  const connectPermit=csrf(pageText);
  const connect=await worker.fetch(submitted("/connect/yahoo",{form_token:connectPermit},{cookie:sessionCookie}),env,{});
  assert.equal(connect.status,303);
  const toYahoo=new URL(connect.headers.get("location"));
  assert.equal(toYahoo.host,"api.login.yahoo.com");
  assert.equal(toYahoo.searchParams.get("redirect_uri"),origin+"/oauth/yahoo/callback");
  assert.match(connect.headers.get("set-cookie"),/^mc_fantasy_oauth=/);
});
test("invalid or expired form permits cannot bypass unlock protection",async()=>{
  const noToken=await worker.fetch(submitted("/unlock",{pin:"private-11"}),env,{});
  assert.equal(noToken.status,403);
  const badToken=await worker.fetch(submitted("/unlock",{pin:"private-11",form_token:"not-valid"}),env,{});
  assert.equal(badToken.status,403);
});
test("signed public form permit cannot authorize a Yahoo connect action",async()=>{
  const initial=await worker.fetch(new Request(origin+"/setup"),env,{});
  const publicPermit=csrf(await initial.text());
  const unlocked=await worker.fetch(submitted("/unlock",{pin:"private-11",form_token:publicPermit}),env,{});
  const sessionCookie=unlocked.headers.get("set-cookie").split(";")[0];
  const invalid=await worker.fetch(submitted("/connect/yahoo",{form_token:publicPermit},{cookie:sessionCookie}),env,{});
  assert.equal(invalid.status,403);
});
